import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@/lib/domain';
import { database, databasePool } from '@/lib/server/db/client';
import {
  privateLessonStudentRates,
  programBranches,
  programs,
  instructorLanguageCompetencies,
  instructorProfiles,
  users,
} from '@/lib/server/db/schema';
import {
  createInstructorProfile,
  getInstructorDirectory,
} from '@/lib/server/services/instructors';
import {
  archiveProgram,
  archiveProgramBranch,
  createProgramBranch,
  createProgram,
  deleteUnusedProgram,
  deleteUnusedProgramBranch,
  getProgramManagementData,
  PRIVATE_LESSON_PROGRAM_ID,
  resolveProgramPricing,
  setPrivateLessonStudentRate,
  updateProgram,
} from '@/lib/server/services/programs';

const integration =
  process.env.RUN_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

afterAll(async () => {
  await databasePool.end();
});

integration('program catalog and private lesson student pricing', () => {
  it('keeps catalog prices and private lesson rates historically stable', async () => {
    const marker = randomUUID();
    const adminId = `program-admin-${marker}`;
    let instructorId: string | undefined;
    let programId: string | undefined;
    let branchId: string | undefined;
    const rateIds: string[] = [];

    const principal: WorkspacePrincipal = {
      accountStatus: 'active',
      email: `program-admin-${marker}@example.invalid`,
      id: adminId,
      name: 'Program Admin',
      role: 'admin',
      sessionCreatedAt: new Date().toISOString(),
      sessionId: randomUUID(),
      sessionLastVerifiedAt: new Date().toISOString(),
      sessionSecurityLevel: 'mfa',
      twoFactorEnabled: true,
    };

    try {
      await database.insert(users).values([
        {
          accountStatus: 'active',
          email: principal.email,
          emailVerified: true,
          id: adminId,
          name: principal.name,
          role: 'admin',
          twoFactorEnabled: true,
        },
      ]);
      const instructor = await createInstructorProfile(principal, {
        competencies: [
          {
            language: 'english',
            levels: ['A1', 'A2', 'B1'],
          },
        ],
        email: `program-teacher-${marker}@example.invalid`,
        firstName: 'Program',
        lastName: 'Teacher',
        phone: '+905551234567',
        specialties: [],
        status: 'active',
      });
      instructorId = instructor.id;

      const program = await createProgram(principal, {
        active: true,
        description: 'Integration program',
        language: 'english',
        levels: ['A1', 'A2', 'B1'],
        listPriceCents: 125_000,
        name: 'Integration Group Program',
      });
      programId = program!.id;

      await updateProgram(principal, programId, {
        active: true,
        description: 'Updated integration program',
        language: 'english',
        levels: ['A1', 'A2', 'B1'],
        listPriceCents: 130_000,
        name: 'Integration Group Program',
      });

      const branch = await createProgramBranch(principal, {
        maximumCapacity: 12,
        minimumCapacity: 4,
        name: 'Integration Morning Class',
        plannedEndDate: '2026-09-30',
        plannedStartDate: '2026-07-01',
        programId,
        instructorProfileId: instructorId,
      });
      branchId = branch!.id;

      const groupPricing = await database.transaction((transaction) =>
        resolveProgramPricing(transaction, {
          branchId,
          programId: programId!,
        }),
      );
      expect(groupPricing.basePriceCents).toBe(130_000);
      expect(groupPricing.snapshot.levels).toEqual(['A1', 'A2', 'B1']);
      expect(groupPricing.snapshot.branchName).toBe(
        'Integration Morning Class',
      );

      const management = await getProgramManagementData(principal);
      const managedBranch = management.branches.find(
        (item) => item.id === branchId,
      );
      expect(managedBranch?.instructorProfileId).toBe(instructorId);
      expect(managedBranch?.instructorName).toBe('Program Teacher');
      expect(managedBranch?.currentEnrollmentCount).toBe(0);
      expect(managedBranch?.status).toBe('enrollment_open');
      expect(managedBranch?.canDelete).toBe(true);

      const firstRate = await setPrivateLessonStudentRate(principal, {
        hourlyPriceCents: 2_000,
        language: 'english',
        instructorProfileId: instructorId,
      });
      rateIds.push(firstRate!.id);

      const secondRate = await setPrivateLessonStudentRate(principal, {
        hourlyPriceCents: 2_500,
        language: 'english',
        instructorProfileId: instructorId,
      });
      rateIds.push(secondRate!.id);

      const privatePricing = await database.transaction((transaction) =>
        resolveProgramPricing(transaction, {
          privateLessonHours: 12,
          privateLessonLanguage: 'english',
          programId: PRIVATE_LESSON_PROGRAM_ID,
          instructorProfileId: instructorId,
        }),
      );
      expect(privatePricing.basePriceCents).toBe(30_000);
      expect(privatePricing.snapshot.hourlyStudentPriceCents).toBe(2_500);
      expect(privatePricing.snapshot.teacherName).toBe('Program Teacher');

      const currentRates = await database
        .select()
        .from(privateLessonStudentRates)
        .where(
          and(
            eq(
              privateLessonStudentRates.instructorProfileId,
              instructorId!,
            ),
            eq(privateLessonStudentRates.language, 'english'),
            eq(privateLessonStudentRates.active, true),
            isNull(privateLessonStudentRates.effectiveUntil),
          ),
        );
      expect(currentRates).toHaveLength(1);
      expect(currentRates[0]?.id).toBe(secondRate!.id);

      const directory = await getInstructorDirectory(principal);
      const managedInstructor = directory.find(
        (item) => item.id === instructorId,
      );
      expect(managedInstructor?.userId).toBeUndefined();
      expect(managedInstructor?.branchCount).toBe(1);
      expect(managedInstructor?.privateLessonLanguages).toEqual(['english']);

      await expect(
        setPrivateLessonStudentRate(principal, {
          hourlyPriceCents: 2_500,
          language: 'german',
          instructorProfileId: instructorId,
        }),
      ).rejects.toThrow();

      await expect(
        archiveProgram(principal, programId),
      ).rejects.toThrow('program_has_unarchived_branches');
      const archivedBranch = await archiveProgramBranch(
        principal,
        branchId,
        {
          reason: 'Integration empty branch closure',
          transfers: [],
        },
      );
      expect(archivedBranch.transferred).toBe(0);
      expect(['cancelled', 'completed']).toContain(archivedBranch.status);
      await deleteUnusedProgramBranch(principal, branchId);
      branchId = undefined;
      const archived = await archiveProgram(principal, programId);
      expect(archived.archivedAt).toBeTruthy();
      await deleteUnusedProgram(principal, programId);
      programId = undefined;
    } finally {
      if (rateIds.length) {
        await database
          .delete(privateLessonStudentRates)
          .where(
            eq(
              privateLessonStudentRates.instructorProfileId,
              instructorId!,
            ),
          );
      }
      if (programId) {
        await database
          .delete(programBranches)
          .where(eq(programBranches.programId, programId));
        await database.delete(programs).where(eq(programs.id, programId));
      }
      if (instructorId) {
        await database
          .delete(instructorLanguageCompetencies)
          .where(
            eq(
              instructorLanguageCompetencies.instructorId,
              instructorId,
            ),
          );
        await database
          .delete(instructorProfiles)
          .where(eq(instructorProfiles.id, instructorId));
      }
      await database.delete(users).where(eq(users.id, adminId));
    }
  });
});
