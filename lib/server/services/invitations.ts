import 'server-only';

import { randomUUID } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import type {
  CreateInvitationInput,
  InvitationService,
  WorkspacePrincipal,
} from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import { accounts, userInvitations, users } from '@/lib/server/db/schema';
import { getAuthEnv } from '@/lib/server/env';
import { createOpaqueToken, hashToken } from '@/lib/server/security/tokens';
import { assertValidUsername } from '@/lib/server/security/username';
import { notificationService } from './notifications';

const INVITATION_TTL_MS = 24 * 60 * 60 * 1000;

function assertAdmin(actor: WorkspacePrincipal) {
  if (
    actor.role !== 'admin' ||
    actor.accountStatus !== 'active' ||
    actor.sessionSecurityLevel !== 'mfa'
  ) {
    throw new Error('An active admin MFA session is required.');
  }
}

export const invitationService: InvitationService = {
  async create(actor, input: CreateInvitationInput) {
    assertAdmin(actor);
    const username = assertValidUsername(input.username);
    const email = input.email.trim().toLocaleLowerCase('en-US');
    const { hash, token } = createOpaqueToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    const [created] = await database
      .insert(userInvitations)
      .values({
        email,
        expiresAt,
        invitedByUserId: actor.id,
        name: input.name.trim(),
        role: input.role,
        tokenHash: hash,
        username,
      })
      .returning({
        expiresAt: userInvitations.expiresAt,
        id: userInvitations.id,
        status: userInvitations.status,
        username: userInvitations.username,
      });

    if (!created) {
      throw new Error('Invitation could not be created.');
    }

    const activationUrl = new URL(
      `/${input.locale}/aktivasyon`,
      getAuthEnv().APP_URL,
    );
    activationUrl.searchParams.set('token', token);

    await notificationService.enqueue({
      channel: 'email',
      idempotencyKey: `invitation:${created.id}`,
      locale: input.locale,
      payload: {
        expiresAt: created.expiresAt.toISOString(),
        name: input.name,
        username,
      },
      recipient: email,
      sensitivePayload: {
        activationUrl: activationUrl.toString(),
      },
      templateKey: 'account-invitation',
    });

    return {
      expiresAt: created.expiresAt.toISOString(),
      id: created.id,
      status: created.status,
      username: created.username,
    };
  },

  async activate(token, password) {
    if (password.length < 12 || password.length > 128) {
      throw new Error('Password must be between 12 and 128 characters.');
    }

    return database.transaction(async (transaction) => {
      const [invitation] = await transaction
        .select()
        .from(userInvitations)
        .where(
          and(
            eq(userInvitations.tokenHash, hashToken(token)),
            eq(userInvitations.status, 'pending'),
            gt(userInvitations.expiresAt, new Date()),
          ),
        )
        .limit(1)
        .for('update');

      if (!invitation) {
        throw new Error('Invitation is invalid or expired.');
      }

      const [duplicate] = await transaction
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, invitation.email))
        .limit(1);

      if (duplicate) {
        throw new Error('Invitation cannot be activated.');
      }

      const userId = randomUUID();
      const now = new Date();

      await transaction.insert(users).values({
        accountStatus: 'active',
        createdAt: now,
        displayUsername: invitation.username,
        email: invitation.email,
        emailVerified: true,
        id: userId,
        name: invitation.name,
        role: invitation.role as 'advisor' | 'teacher' | 'student',
        updatedAt: now,
        username: invitation.username,
      });

      await transaction.insert(accounts).values({
        accountId: userId,
        createdAt: now,
        id: randomUUID(),
        password: await hashPassword(password),
        providerId: 'credential',
        updatedAt: now,
        userId,
      });

      await transaction
        .update(userInvitations)
        .set({
          acceptedAt: now,
          status: 'accepted',
          updatedAt: now,
        })
        .where(eq(userInvitations.id, invitation.id));

      return { userId };
    });
  },

  async revoke(actor, invitationId) {
    assertAdmin(actor);
    await database
      .update(userInvitations)
      .set({
        revokedAt: new Date(),
        status: 'revoked',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userInvitations.id, invitationId),
          eq(userInvitations.status, 'pending'),
        ),
      );
  },
};
