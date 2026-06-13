import { type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { PublicFlowError } from '@/lib/server/http/errors';
import { consumeRateLimit } from '@/lib/server/redis/rate-limit';
import { publicAssessmentCookieName } from '@/lib/server/security/public-assessment-cookie';
import {
  isTrustedRequestOrigin,
  requestIp,
} from '@/lib/server/security/network';
import { hashToken } from '@/lib/server/security/tokens';
import { completePublicCandidateProfile } from '@/lib/server/services/public-assessments';

const inputSchema = z.object({
  city: z.string().trim().max(100).optional(),
  contactWindow: z.string().trim().max(80).optional(),
  isMinor: z.boolean(),
  learningGoal: z.enum([
    'daily_life',
    'career',
    'academic',
    'exam',
    'travel',
    'other',
  ]),
  lessonModel: z.enum(['one_to_one', 'group', 'undecided']).optional(),
  locale: z.enum(['tr', 'en']),
  phone: z.string().trim().min(7).max(30),
  preferredContactChannel: z.enum(['phone', 'whatsapp', 'email']),
  timezone: z.string().trim().min(1).max(100),
});

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const input = inputSchema.parse(await request.json());
    const token = request.cookies.get(publicAssessmentCookieName())?.value;

    if (!token) {
      throw new PublicFlowError('assessment_session_expired', 410);
    }

    const limit = await consumeRateLimit(
      `public-assessment-profile:${hashToken(
        `${token}:${requestIp(request.headers) ?? 'unknown'}`,
      )}`,
      10,
      15 * 60 * 1000,
    );

    if (!limit.allowed) {
      throw new PublicFlowError('rate_limited', 429);
    }

    const state = await completePublicCandidateProfile(
      token,
      input,
      input.locale,
    );
    return apiResponse({ state }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
