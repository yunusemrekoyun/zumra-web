import { type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { PublicFlowError } from '@/lib/server/http/errors';
import { consumeRateLimit } from '@/lib/server/redis/rate-limit';
import {
  isTrustedRequestOrigin,
  maskIp,
  requestIp,
} from '@/lib/server/security/network';
import { hashToken } from '@/lib/server/security/tokens';
import { createPublicLead } from '@/lib/server/services/public-assessments';

const leadSchema = z.object({
  attribution: z.record(z.string(), z.string().max(200)).optional(),
  consent: z.literal(true),
  contactWindow: z.string().trim().max(120).optional(),
  email: z.string().email().max(254),
  firstName: z.string().trim().min(2).max(60),
  formStartedAt: z.number().int().positive(),
  idempotencyKey: z.string().uuid(),
  kind: z.enum(['program', 'callback']),
  language: z.enum(['english', 'german', 'french', 'arabic']).optional(),
  lastName: z.string().trim().min(1).max(60),
  learningGoal: z
    .enum(['daily_life', 'career', 'academic', 'exam', 'travel', 'other'])
    .optional(),
  lessonModel: z.enum(['one_to_one', 'group', 'undecided']).optional(),
  locale: z.enum(['tr', 'en']),
  marketingConsent: z.boolean().default(false),
  phone: z.string().trim().min(7).max(32),
  programId: z.string().uuid().optional(),
  referrer: z.string().max(500).optional(),
  website: z.string().max(0).default(''),
});

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const input = leadSchema.parse(await request.json());

    if (Date.now() - input.formStartedAt < 800) {
      throw new PublicFlowError('invalid_request');
    }

    const ip = requestIp(request.headers) ?? 'unknown';
    const normalizedEmail = input.email.trim().toLocaleLowerCase('en-US');
    const [ipLimit, emailLimit] = await Promise.all([
      consumeRateLimit(`public-lead-ip:${hashToken(ip)}`, 20, 60 * 60 * 1000),
      consumeRateLimit(
        `public-lead-email:${hashToken(normalizedEmail)}`,
        8,
        24 * 60 * 60 * 1000,
      ),
    ]);

    if (!ipLimit.allowed || !emailLimit.allowed) {
      throw new PublicFlowError('rate_limited', 429);
    }

    await createPublicLead(
      {
        attribution: input.attribution,
        contactWindow: input.contactWindow,
        email: input.email,
        firstName: input.firstName,
        idempotencyKey: input.idempotencyKey,
        kind: input.kind,
        language: input.language,
        lastName: input.lastName,
        learningGoal: input.learningGoal,
        lessonModel: input.lessonModel,
        locale: input.locale,
        marketingConsent: input.marketingConsent,
        phone: input.phone,
        programId: input.programId,
        referrer: input.referrer,
      },
      maskIp(ip),
    );

    return apiResponse({ ok: true }, 201, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
