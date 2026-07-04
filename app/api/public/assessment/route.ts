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
  clearPublicAssessmentCookie,
  publicAssessmentCookieName,
  setPublicAssessmentCookie,
} from '@/lib/server/security/public-assessment-cookie';
import {
  isTrustedRequestOrigin,
  maskIp,
  requestIp,
} from '@/lib/server/security/network';
import { hashToken } from '@/lib/server/security/tokens';
import {
  getPublicAssessmentState,
  publicAssessmentLanguages,
  startPublicAssessment,
} from '@/lib/server/services/public-assessments';

const localeSchema = z.enum(['tr', 'en']);
const startSchema = z.object({
  attribution: z.record(z.string(), z.string().max(200)).optional(),
  email: z.string().email().max(254),
  firstName: z.string().trim().min(2).max(60),
  formStartedAt: z.number().int().positive(),
  idempotencyKey: z.string().uuid(),
  language: z.enum(publicAssessmentLanguages),
  lastName: z.string().trim().min(2).max(60),
  locale: localeSchema,
  marketingConsent: z.boolean().default(false),
  referrer: z.string().max(500).optional(),
  restart: z.boolean().default(false),
  website: z.string().max(0).default(''),
});

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const id = requestId(request);

  try {
    const locale = localeSchema.parse(
      request.nextUrl.searchParams.get('locale') ?? 'tr',
    );
    const token = request.cookies.get(publicAssessmentCookieName())?.value;

    if (!token) {
      return apiResponse({ state: null }, 200, id);
    }

    const state = await getPublicAssessmentState(token, locale);
    const response = apiResponse({ state }, 200, id);

    if (!state) {
      clearPublicAssessmentCookie(response);
    }

    return response;
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}

export async function POST(request: NextRequest) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const parsed = startSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const isPhone = parsed.error.issues.some((i) => i.path[0] === 'phone');
      return apiResponse(
        { error: isPhone ? 'invalid_phone' : 'invalid_request' },
        400,
        id,
      );
    }
    const input = parsed.data;

    if (Date.now() - input.formStartedAt < 800) {
      throw new PublicFlowError('invalid_request');
    }

    const ip = requestIp(request.headers) ?? 'unknown';
    const normalizedEmail = input.email.trim().toLocaleLowerCase('en-US');
    const [ipLimit, emailLimit] = await Promise.all([
      consumeRateLimit(`public-assessment-start-ip:${hashToken(ip)}`, 20, 60 * 60 * 1000),
      consumeRateLimit(
        `public-assessment-start-email:${hashToken(normalizedEmail)}`,
        8,
        24 * 60 * 60 * 1000,
      ),
    ]);

    if (!ipLimit.allowed || !emailLimit.allowed) {
      throw new PublicFlowError('rate_limited', 429);
    }

    const result = await startPublicAssessment(
      input,
      request.cookies.get(publicAssessmentCookieName())?.value,
      maskIp(ip),
    );
    const response = apiResponse({ state: result.state }, 201, id);
    setPublicAssessmentCookie(response, result.token, result.expiresAt);
    return response;
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}

export async function DELETE(request: NextRequest) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  const response = apiResponse({ status: 'cleared' }, 200, id);
  clearPublicAssessmentCookie(response);
  return response;
}
