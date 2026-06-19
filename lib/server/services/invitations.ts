import 'server-only';

import { randomUUID } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import type {
  CreateInvitationInput,
  InvitationService,
  WorkspacePrincipal,
} from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import {
  accounts,
  contacts,
  instructorAccountInvitations,
  instructorProfiles,
  studentAccountInvitations,
  studentProfiles,
  userInvitations,
  users,
} from '@/lib/server/db/schema';
import { getAuthEnv } from '@/lib/server/env';
import { PublicFlowError } from '@/lib/server/http/errors';
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
    if (
      (input.role === 'teacher' && !input.instructorProfileId) ||
      (input.role !== 'teacher' && input.instructorProfileId)
    ) {
      throw new PublicFlowError('invalid_invitation_target', 400);
    }
    const username = normalizeInvitationUsername(input.username);
    const email = input.email.trim().toLocaleLowerCase('en-US');
    const { hash, token } = createOpaqueToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    const created = await database.transaction(async (transaction) => {
      const [duplicateUser] = await transaction
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (duplicateUser) {
        throw new PublicFlowError(
          'invitation_email_already_registered',
          409,
        );
      }

      const [duplicateUsername] = await transaction
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (duplicateUsername) {
        throw new PublicFlowError('username_already_registered', 409);
      }

      const [pendingEmailInvitation] = await transaction
        .select({ id: userInvitations.id })
        .from(userInvitations)
        .where(
          and(
            eq(userInvitations.email, email),
            eq(userInvitations.status, 'pending'),
            gt(userInvitations.expiresAt, new Date()),
          ),
        )
        .limit(1);

      if (pendingEmailInvitation) {
        throw new PublicFlowError('invitation_already_pending', 409);
      }

      const [pendingUsernameInvitation] = await transaction
        .select({ id: userInvitations.id })
        .from(userInvitations)
        .where(
          and(
            eq(userInvitations.username, username),
            eq(userInvitations.status, 'pending'),
            gt(userInvitations.expiresAt, new Date()),
          ),
        )
        .limit(1);

      if (pendingUsernameInvitation) {
        throw new PublicFlowError('invitation_username_already_pending', 409);
      }

      if (input.instructorProfileId) {
        const [profile] = await transaction
          .select({
            email: instructorProfiles.email,
            id: instructorProfiles.id,
            userId: instructorProfiles.userId,
          })
          .from(instructorProfiles)
          .where(eq(instructorProfiles.id, input.instructorProfileId))
          .limit(1)
          .for('update');
        if (
          !profile ||
          profile.userId ||
          profile.email !== email ||
          input.role !== 'teacher'
        ) {
          throw new PublicFlowError(
            'instructor_invitation_unavailable',
            409,
          );
        }

        const [pendingInvitation] = await transaction
          .select({ id: userInvitations.id })
          .from(instructorAccountInvitations)
          .innerJoin(
            userInvitations,
            eq(userInvitations.id, instructorAccountInvitations.invitationId),
          )
          .where(
            and(
              eq(
                instructorAccountInvitations.instructorId,
                input.instructorProfileId,
              ),
              eq(userInvitations.status, 'pending'),
              gt(userInvitations.expiresAt, new Date()),
            ),
          )
          .limit(1);
        if (pendingInvitation) {
          throw new PublicFlowError('invitation_already_pending', 409);
        }
      }

      const [invitation] = await transaction
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

      if (invitation && input.instructorProfileId) {
        await transaction.insert(instructorAccountInvitations).values({
          instructorId: input.instructorProfileId,
          invitationId: invitation.id,
        });
      }

      return invitation;
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
      throw new PublicFlowError('invalid_password', 400);
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
        throw new PublicFlowError('invalid_or_expired_invitation', 400);
      }

      const [duplicate] = await transaction
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, invitation.email))
        .limit(1);

      if (duplicate) {
        throw new PublicFlowError(
          'invitation_email_already_registered',
          409,
        );
      }

      const [duplicateUsername] = await transaction
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, invitation.username))
        .limit(1);

      if (duplicateUsername) {
        throw new PublicFlowError('username_already_registered', 409);
      }

      const [linkedInstructor] =
        invitation.role === 'teacher'
          ? await transaction
              .select({
                instructorId: instructorAccountInvitations.instructorId,
              })
              .from(instructorAccountInvitations)
              .where(
                eq(
                  instructorAccountInvitations.invitationId,
                  invitation.id,
                ),
              )
              .limit(1)
          : [];
      if (invitation.role === 'teacher' && !linkedInstructor) {
        throw new PublicFlowError('instructor_invitation_invalid', 409);
      }

      const [linkedStudent] =
        invitation.role === 'student'
          ? await transaction
              .select({
                contactId: studentProfiles.contactId,
                email: contacts.email,
                studentId: studentAccountInvitations.studentId,
                userId: studentProfiles.userId,
              })
              .from(studentAccountInvitations)
              .innerJoin(
                studentProfiles,
                eq(studentProfiles.id, studentAccountInvitations.studentId),
              )
              .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
              .where(
                eq(studentAccountInvitations.invitationId, invitation.id),
              )
              .limit(1)
              .for('update')
          : [];
      if (
        invitation.role === 'student' &&
        (!linkedStudent ||
          linkedStudent.userId ||
          linkedStudent.email !== invitation.email)
      ) {
        throw new PublicFlowError('student_invitation_invalid', 409);
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

      if (linkedInstructor) {
        const [linkedProfile] = await transaction
          .update(instructorProfiles)
          .set({ userId, updatedAt: now })
          .where(
            and(
              eq(instructorProfiles.id, linkedInstructor.instructorId),
              isNull(instructorProfiles.userId),
              eq(instructorProfiles.email, invitation.email),
            ),
          )
          .returning({ id: instructorProfiles.id });
        if (!linkedProfile) {
          throw new PublicFlowError('instructor_invitation_invalid', 409);
        }
      }

      if (linkedStudent) {
        const [linkedProfile] = await transaction
          .update(studentProfiles)
          .set({ updatedAt: now, userId })
          .where(
            and(
              eq(studentProfiles.id, linkedStudent.studentId),
              isNull(studentProfiles.userId),
            ),
          )
          .returning({ id: studentProfiles.id });
        if (!linkedProfile) {
          throw new PublicFlowError('student_invitation_invalid', 409);
        }

        await transaction
          .update(contacts)
          .set({ emailVerifiedAt: now, updatedAt: now })
          .where(eq(contacts.id, linkedStudent.contactId));
      }

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

function normalizeInvitationUsername(value: string) {
  try {
    return assertValidUsername(value);
  } catch {
    throw new PublicFlowError('invalid_username', 400);
  }
}
