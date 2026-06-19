import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@/lib/domain';
import { database, databasePool } from '@/lib/server/db/client';
import {
  accounts,
  instructorAccountInvitations,
  instructorLanguageCompetencies,
  instructorProfiles,
  userInvitations,
  users,
} from '@/lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { createOpaqueToken } from '@/lib/server/security/tokens';
import { createInstructorProfile } from '@/lib/server/services/instructors';
import { invitationService } from '@/lib/server/services/invitations';

const integration =
  process.env.RUN_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

afterAll(async () => {
  await databasePool.end();
});

integration('instructor profile and panel account lifecycle', () => {
  it('keeps the instructor independent and links an invited teacher account', async () => {
    const marker = randomUUID();
    const adminId = `instructor-admin-${marker}`;
    const instructorEmail = `instructor-${marker}@example.invalid`;
    let instructorId: string | undefined;
    let invitationId: string | undefined;
    let teacherUserId: string | undefined;

    const principal: WorkspacePrincipal = {
      accountStatus: 'active',
      email: `instructor-admin-${marker}@example.invalid`,
      id: adminId,
      name: 'Instructor Admin',
      role: 'admin',
      sessionCreatedAt: new Date().toISOString(),
      sessionId: randomUUID(),
      sessionLastVerifiedAt: new Date().toISOString(),
      sessionSecurityLevel: 'mfa',
      twoFactorEnabled: true,
    };

    try {
      await database.insert(users).values({
        accountStatus: 'active',
        email: principal.email,
        emailVerified: true,
        id: adminId,
        name: principal.name,
        role: 'admin',
        twoFactorEnabled: true,
      });

      const instructor = await createInstructorProfile(principal, {
        competencies: [{ language: 'english', levels: ['A1', 'A2'] }],
        email: instructorEmail,
        firstName: 'Panel',
        lastName: 'Instructor',
        phone: '+905551112233',
        specialties: ['conversation'],
        status: 'active',
      });
      instructorId = instructor.id;

      const [independentProfile] = await database
        .select({ userId: instructorProfiles.userId })
        .from(instructorProfiles)
        .where(eq(instructorProfiles.id, instructorId));
      expect(independentProfile?.userId).toBeNull();

      await expect(
        invitationService.create(principal, {
          email: instructorEmail,
          locale: 'tr',
          name: 'Panel Instructor',
          role: 'teacher',
          username: `teacher.${marker.slice(0, 8)}`,
        }),
      ).rejects.toThrow('invalid_invitation_target');

      const { hash, token } = createOpaqueToken();
      const [invitation] = await database
        .insert(userInvitations)
        .values({
          email: instructorEmail,
          expiresAt: new Date(Date.now() + 60_000),
          invitedByUserId: adminId,
          name: 'Panel Instructor',
          role: 'teacher',
          tokenHash: hash,
          username: `teacher.${marker.slice(0, 8)}`,
        })
        .returning({ id: userInvitations.id });
      invitationId = invitation!.id;

      await database.insert(instructorAccountInvitations).values({
        instructorId,
        invitationId,
      });

      const activated = await invitationService.activate(
        token,
        'Integration-Password-2026',
      );
      teacherUserId = activated.userId;

      const [linkedProfile] = await database
        .select({
          role: users.role,
          userId: instructorProfiles.userId,
        })
        .from(instructorProfiles)
        .innerJoin(users, eq(users.id, instructorProfiles.userId))
        .where(eq(instructorProfiles.id, instructorId));
      expect(linkedProfile).toEqual({
        role: 'teacher',
        userId: teacherUserId,
      });

      await expect(
        invitationService.create(principal, {
          email: instructorEmail,
          instructorProfileId: instructorId,
          locale: 'tr',
          name: 'Panel Instructor',
          role: 'teacher',
          username: `teacher.${marker.slice(9, 17)}`,
        }),
      ).rejects.toThrow('invitation_email_already_registered');
    } finally {
      if (teacherUserId) {
        await database
          .delete(accounts)
          .where(eq(accounts.userId, teacherUserId));
        await database.delete(users).where(eq(users.id, teacherUserId));
      }
      if (invitationId) {
        await database
          .delete(userInvitations)
          .where(eq(userInvitations.id, invitationId));
      }
      if (instructorId) {
        await database
          .delete(instructorLanguageCompetencies)
          .where(eq(instructorLanguageCompetencies.instructorId, instructorId));
        await database
          .delete(instructorProfiles)
          .where(eq(instructorProfiles.id, instructorId));
      }
      await database.delete(users).where(eq(users.id, adminId));
    }
  });
});
