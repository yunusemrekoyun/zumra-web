import 'server-only';

import { and, desc, eq, gt, inArray, isNull, ne } from 'drizzle-orm';
import { database } from '@/lib/server/db/client';
import {
  notificationOutbox,
  securityChallenges,
  sessions,
  trustedDevices,
} from '@/lib/server/db/schema';
import { notificationService } from '@/lib/server/services/notifications';
import { hashToken, createNumericOtp, safeTokenEqual } from '@/lib/server/security/tokens';

const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const TRUST_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function findActiveDeviceChallenge(input: {
  sessionId: string;
  userId: string;
}) {
  const [challenge] = await database
    .select({
      expiresAt: securityChallenges.expiresAt,
      id: securityChallenges.id,
    })
    .from(securityChallenges)
    .where(
      and(
        eq(securityChallenges.userId, input.userId),
        eq(securityChallenges.sessionId, input.sessionId),
        eq(securityChallenges.purpose, 'device_verification'),
        gt(securityChallenges.expiresAt, new Date()),
        isNull(securityChallenges.consumedAt),
      ),
    )
    .orderBy(desc(securityChallenges.createdAt))
    .limit(1);

  return challenge
    ? {
        challengeId: challenge.id,
        expiresAt: challenge.expiresAt.toISOString(),
      }
    : null;
}

export async function retireOtherPendingDeviceSessions(input: {
  currentSessionId: string;
  userId: string;
}) {
  await database.transaction(async (transaction) => {
    const previousSessions = await transaction
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, input.userId),
          eq(sessions.securityLevel, 'pending'),
          ne(sessions.id, input.currentSessionId),
        ),
      );
    const previousSessionIds = previousSessions.map((session) => session.id);

    if (previousSessionIds.length === 0) {
      return;
    }

    const activeChallenges = await transaction
      .select({ id: securityChallenges.id })
      .from(securityChallenges)
      .where(
        and(
          inArray(securityChallenges.sessionId, previousSessionIds),
          eq(securityChallenges.purpose, 'device_verification'),
          isNull(securityChallenges.consumedAt),
        ),
      );
    const now = new Date();

    if (activeChallenges.length > 0) {
      const challengeIds = activeChallenges.map((challenge) => challenge.id);
      const idempotencyKeys = challengeIds.map(
        (challengeId) => `device-challenge:${challengeId}`,
      );

      await transaction
        .update(securityChallenges)
        .set({ consumedAt: now })
        .where(inArray(securityChallenges.id, challengeIds));
      await transaction
        .update(notificationOutbox)
        .set({
          encryptedPayload: null,
          lastError: 'superseded_by_new_login',
          processedAt: now,
          status: 'dead',
          updatedAt: now,
        })
        .where(
          and(
            inArray(notificationOutbox.idempotencyKey, idempotencyKeys),
            inArray(notificationOutbox.status, [
              'pending',
              'queued',
              'failed',
            ]),
          ),
        );
    }

    await transaction
      .delete(sessions)
      .where(inArray(sessions.id, previousSessionIds));
  });
}

export async function createDeviceChallenge(input: {
  deviceCookie: string;
  email: string;
  locale: 'tr' | 'en';
  sessionId: string;
  userId: string;
}) {
  const otp = createNumericOtp();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

  const [challenge] = await database
    .insert(securityChallenges)
    .values({
      expiresAt,
      purpose: 'device_verification',
      secretHash: hashToken(otp),
      sessionId: input.sessionId,
      userId: input.userId,
    })
    .returning({ id: securityChallenges.id });

  if (!challenge) {
    throw new Error('Device challenge could not be created.');
  }

  await notificationService.enqueue({
    channel: 'email',
    idempotencyKey: `device-challenge:${challenge.id}`,
    locale: input.locale,
    payload: {
      expiresAt: expiresAt.toISOString(),
    },
    recipient: input.email,
    sensitivePayload: { otp },
    templateKey: 'device-verification',
  });

  return {
    challengeId: challenge.id,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function verifyDeviceChallenge(input: {
  challengeId: string;
  deviceCookie: string;
  otp: string;
  sessionId: string;
  userAgent?: string;
  userId: string;
}) {
  const result = await database.transaction(async (transaction) => {
    const [challenge] = await transaction
      .select()
      .from(securityChallenges)
      .where(
        and(
          eq(securityChallenges.id, input.challengeId),
          eq(securityChallenges.userId, input.userId),
          eq(securityChallenges.sessionId, input.sessionId),
          eq(securityChallenges.purpose, 'device_verification'),
          gt(securityChallenges.expiresAt, new Date()),
          isNull(securityChallenges.consumedAt),
        ),
      )
      .limit(1)
      .for('update');

    if (!challenge || challenge.attempts >= challenge.maxAttempts) {
      return null;
    }

    if (!safeTokenEqual(input.otp, challenge.secretHash)) {
      await transaction
        .update(securityChallenges)
        .set({ attempts: challenge.attempts + 1 })
        .where(eq(securityChallenges.id, challenge.id));
      return null;
    }

    const now = new Date();
    const deviceIdHash = hashToken(input.deviceCookie);

    await transaction
      .insert(trustedDevices)
      .values({
        deviceIdHash,
        expiresAt: new Date(now.getTime() + TRUST_TTL_MS),
        lastSeenAt: now,
        userAgentHash: input.userAgent
          ? hashToken(input.userAgent)
          : undefined,
        userId: input.userId,
        verifiedAt: now,
      })
      .onConflictDoUpdate({
        set: {
          expiresAt: new Date(now.getTime() + TRUST_TTL_MS),
          lastSeenAt: now,
          revokedAt: null,
          userAgentHash: input.userAgent
            ? hashToken(input.userAgent)
            : undefined,
          verifiedAt: now,
        },
        target: [trustedDevices.userId, trustedDevices.deviceIdHash],
      });

    await transaction
      .update(securityChallenges)
      .set({ consumedAt: now })
      .where(eq(securityChallenges.id, challenge.id));

    const [verifiedSession] = await transaction
      .update(sessions)
      .set({
        lastVerifiedAt: now,
        securityLevel: 'standard',
        updatedAt: now,
      })
      .where(
        and(
          eq(sessions.id, input.sessionId),
          eq(sessions.userId, input.userId),
          eq(sessions.securityLevel, 'pending'),
        ),
      )
      .returning({ id: sessions.id });

    if (!verifiedSession) {
      throw new Error('Device verification session is no longer pending.');
    }

    return { verifiedAt: now };
  });

  if (!result) {
    throw new Error('Device verification code is invalid or expired.');
  }

  return result;
}
