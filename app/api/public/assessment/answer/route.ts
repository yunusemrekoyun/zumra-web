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
import { answerPublicAssessment } from '@/lib/server/services/public-assessments';

const inputSchema = z.object({
  locale: z.enum(['tr', 'en']),
  optionId: z.string().uuid(),
  questionId: z.string().uuid(),
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

    const ip = requestIp(request.headers) ?? 'unknown';
    const limit = await consumeRateLimit(
      `public-assessment-answer:${hashToken(`${token}:${ip}`)}`,
      120,
      15 * 60 * 1000,
    );

    if (!limit.allowed) {
      throw new PublicFlowError('rate_limited', 429);
    }

    const state = await answerPublicAssessment(
      token,
      input.questionId,
      input.optionId,
      input.locale,
    );
    return apiResponse({ state }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
