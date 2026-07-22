import { ne } from 'drizzle-orm';
import { z } from 'zod';
import { requireCriticalAdmin } from '@/lib/server/authorization';
import { database } from '@/lib/server/db/client';
import { sessions } from '@/lib/server/db/schema';
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
import { getSetting, updateSettings } from '@/lib/server/services/settings';

const bodySchema = z.object({
  enabled: z.boolean(),
  password: z.string().min(1).max(128),
});

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    // Toggling the master login-verification switch is the single most
    // security-critical setting in the app — it can drop admin TOTP and every
    // staff/student device check at once — so it demands a fresh password, not
    // just a (possibly stale or hijacked) admin cookie. requireCriticalAdmin
    // enforces the full MFA-admin bar, verifies the password, and rate-limits
    // failed attempts.
    const principal = await requireCriticalAdmin(parsed.data.password);

    const wasEnabled = await getSetting('loginVerificationEnabled');
    await updateSettings(
      { loginVerificationEnabled: parsed.data.enabled },
      principal.id,
    );

    // Re-enabling must actually re-secure access. Sessions minted during the
    // OFF window are password-only yet carry an elevated securityLevel that the
    // enforcement layer keeps trusting until natural (14-day) expiry — so
    // flipping the flag back on is not enough. On the off->on transition,
    // revoke every OTHER session, forcing everyone to sign in again through the
    // restored verification. The acting admin, who just re-proved their
    // password above, keeps their current session.
    let sessionsRevoked = 0;
    if (parsed.data.enabled && !wasEnabled) {
      const revoked = await database
        .delete(sessions)
        .where(ne(sessions.id, principal.sessionId))
        .returning({ id: sessions.id });
      sessionsRevoked = revoked.length;
    }

    await auditService.record({
      action: 'admin.login_verification_changed',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      metadata: { enabled: parsed.data.enabled, sessionsRevoked },
      requestId: id,
      result: 'success',
      targetType: 'workspace',
    });

    return apiResponse({ enabled: parsed.data.enabled, sessionsRevoked }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
