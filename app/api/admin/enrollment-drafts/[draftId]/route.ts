import { z } from 'zod';
import { phoneNumberIsValid } from '@/lib/domain/phone';
import { requireAdminSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import {
  isTrustedRequestOrigin,
  requestIp,
} from '@/lib/server/security/network';
import { auditService } from '@/lib/server/services/audit';
import {
  type EnrollmentDraftPatch,
  updateEnrollmentDraft,
} from '@/lib/server/services/enrollments';
import { supportedProgramLanguages } from '@/lib/server/services/programs';

const identityType = z.enum(['national_id', 'passport']);
const gender = z.enum([
  'female',
  'male',
  'non_binary',
  'other',
  'prefer_not_to_say',
]);
const party = z.object({
  email: z.string().email().optional().or(z.literal('')),
  fullName: z.string().trim().min(2).max(160),
  id: z.string().uuid().optional(),
  identityDocument: z.string().trim().max(32).optional().or(z.literal('')),
  identityDocumentType: identityType.optional(),
  phone: z
    .string()
    .trim()
    .max(32)
    .refine((value) => !value || phoneNumberIsValid(value))
    .optional()
    .or(z.literal('')),
  relationship: z.enum(['mother', 'father', 'sibling', 'other']),
  relationshipOther: z.string().trim().max(80).optional().or(z.literal('')),
  roles: z
    .array(z.enum(['guardian', 'payer', 'promissory_debtor', 'other']))
    .min(1),
});

const patchSchema = z.discriminatedUnion('step', [
  z.object({
    step: z.literal(1),
    data: z.object({
      birthAdministrativeArea: z
        .string()
        .trim()
        .max(120)
        .optional()
        .or(z.literal('')),
      birthCountryCode: z
        .string()
        .trim()
        .length(2)
        .optional()
        .or(z.literal('')),
      birthDate: z.string().date().optional().or(z.literal('')),
      birthLocality: z.string().trim().max(120).optional().or(z.literal('')),
      firstName: z.string().trim().min(2).max(80),
      gender: gender.optional().or(z.literal('')),
      identityDocument: z.string().trim().max(32).optional().or(z.literal('')),
      identityDocumentType: identityType,
      lastName: z.string().trim().min(2).max(80),
      school: z.string().trim().max(180).optional().or(z.literal('')),
    }),
  }),
  z.object({
    step: z.literal(2),
    data: z.object({
      email: z.string().email(),
      parties: z.array(party).max(100),
      primaryPhone: z
        .string()
        .trim()
        .min(7)
        .max(32)
        .refine(phoneNumberIsValid),
      residenceAddress: z.string().trim().min(8).max(500),
      secondaryPhone: z
        .string()
        .trim()
        .max(32)
        .refine((value) => !value || phoneNumberIsValid(value))
        .optional()
        .or(z.literal('')),
      studentIsContractParty: z.boolean(),
      username: z
        .string()
        .trim()
        .min(5)
        .max(30)
        .regex(/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/i),
    }),
  }),
  z.object({
    step: z.literal(3),
    data: z.object({
      branchId: z.string().uuid().optional(),
      capacityOverride: z.boolean().optional(),
      capacityOverrideNote: z
        .string()
        .trim()
        .max(500)
        .optional()
        .or(z.literal('')),
      instagramHandle: z.string().trim().max(80).optional().or(z.literal('')),
      privateLessonHours: z.number().int().min(1).max(1000).optional(),
      privateLessonLanguage: z.enum(supportedProgramLanguages).optional(),
      programId: z.string().uuid(),
      instructorProfileId: z.string().uuid().optional(),
    }),
  }),
  z.object({
    step: z.literal(4),
    data: z
      .object({
        correctedSource: z
          .enum([
            'instagram',
            'google',
            'referral',
            'web_level_test',
            'whatsapp',
            'other',
          ])
          .optional()
          .or(z.literal('')),
        correctedSourceDetail: z
          .string()
          .trim()
          .max(160)
          .optional()
          .or(z.literal('')),
      })
      .superRefine((value, context) => {
        if (
          value.correctedSource === 'other' &&
          !value.correctedSourceDetail?.trim()
        ) {
          context.addIssue({
            code: 'custom',
            message: 'source_detail_required',
            path: ['correctedSourceDetail'],
          });
        }
      }),
  }),
  z.object({
    step: z.literal(5),
    data: z.object({
      registrationChannel: z.enum([
        'web',
        'phone',
        'whatsapp',
        'video_call',
        'other',
      ]),
    }),
  }),
  z.object({
    step: z.literal(6),
    data: z.object({}),
  }),
  z.object({
    step: z.literal(7),
    data: z.object({
      discountNote: z.string().trim().max(500).optional().or(z.literal('')),
      discountType: z.enum(['none', 'percentage', 'fixed']),
      discountValue: z.number().int().nonnegative(),
      financialNotes: z.string().trim().max(1000).optional().or(z.literal('')),
      initialPaymentCents: z.number().int().nonnegative(),
      installmentCount: z.number().int().min(1).max(120),
      paymentMethod: z.string().trim().max(80).optional().or(z.literal('')),
    }),
  }),
  z.object({
    step: z.literal(8),
    data: z.object({
      scheduleMode: z.enum(['inherited', 'custom', 'pending']),
      scheduleNotes: z.string().trim().max(1000).optional().or(z.literal('')),
      schedulePreferences: z
        .array(
          z.object({
            day: z.string().trim().min(2).max(20),
            endTime: z.string().regex(/^\d{2}:\d{2}$/),
            startTime: z.string().regex(/^\d{2}:\d{2}$/),
          }),
        )
        .max(14),
    }),
  }),
  z.object({
    step: z.literal(9),
    data: z.object({
      internalNotes: z.string().trim().max(5000).optional().or(z.literal('')),
    }),
  }),
]);

export const runtime = 'nodejs';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> },
) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const parsed = patchSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse(
        {
          error: 'invalid_request',
          fieldErrors: Object.fromEntries(
            parsed.error.issues.map((issue) => [
              String(issue.path.at(-1) ?? 'form'),
              issue.code,
            ]),
          ),
        },
        400,
        id,
      );
    }

    const principal = await requireAdminSession();
    const { draftId } = await params;
    const result = await updateEnrollmentDraft(
      principal,
      draftId,
      parsed.data as EnrollmentDraftPatch,
    );
    if (
      parsed.data.step === 3 &&
      'draft' in result &&
      result.draft?.capacityOverride === true
    ) {
      await auditService.record({
        action: 'program_branch.capacity_overridden',
        actorUserId: principal.id,
        ip: requestIp(request.headers),
        requestId: id,
        result: 'success',
        targetId: parsed.data.data.branchId,
        targetType: 'program_branch',
      });
    }
    return apiResponse(result, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
