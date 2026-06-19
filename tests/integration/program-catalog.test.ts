import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@/lib/domain';
import { database, databasePool } from '@/lib/server/db/client';
import {
  branchLessonScheduleRules,
  candidateProfiles,
  contacts,
  enrollmentDrafts,
  enrollments,
  privateLessonStudentRates,
  programBranches,
  programs,
  instructorLanguageCompetencies,
  instructorProfiles,
  lessonSessionMeetings,
  lessonSessions,
  studentProfiles,
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
import {
  getAdminCalendarData,
  getStudentCalendarData,
  getTeacherCalendarData,
  replaceBranchLessonSchedule,
} from '@/lib/server/services/lesson-schedules';

const integration =
  process.env.RUN_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

afterAll(async () => {
  await databasePool.end();
});

integration('program catalog and private lesson student pricing', () => {
  it('keeps catalog prices and private lesson rates historically stable', async () => {
    const marker = randomUUID();
    const adminId = `program-admin-${marker}`;
    const teacherUserId = `program-teacher-user-${marker}`;
    const studentUserId = `program-student-user-${marker}`;
    let candidateId: string | undefined;
    let contactId: string | undefined;
    let draftId: string | undefined;
    let enrollmentId: string | undefined;
    let instructorId: string | undefined;
    let programId: string | undefined;
    let branchId: string | undefined;
    let studentId: string | undefined;
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
        {
          accountStatus: 'active',
          email: `program-teacher-user-${marker}@example.invalid`,
          emailVerified: true,
          id: teacherUserId,
          name: 'Program Teacher',
          role: 'teacher',
          twoFactorEnabled: false,
        },
        {
          accountStatus: 'active',
          email: `program-student-user-${marker}@example.invalid`,
          emailVerified: true,
          id: studentUserId,
          name: 'Program Student',
          role: 'student',
          twoFactorEnabled: false,
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
      await database
        .update(instructorProfiles)
        .set({ userId: teacherUserId })
        .where(eq(instructorProfiles.id, instructorId));

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

      const weeklySchedule = await replaceBranchLessonSchedule(
        principal,
        branchId,
        {
          repeatWeekly: true,
          startTime: '10:00',
          weekday: 3,
        },
      );
      expect(weeklySchedule.schedule?.repeatWeekly).toBe(true);
      expect(weeklySchedule.schedule?.sessionCount).toBeGreaterThan(0);
      expect(weeklySchedule.schedule?.sessions[0]?.startTime).toBe('10:00');
      const meetingRows = await database
        .select({
          lessonSessionId: lessonSessionMeetings.lessonSessionId,
          status: lessonSessionMeetings.status,
        })
        .from(lessonSessionMeetings)
        .where(
          inArray(
            lessonSessionMeetings.lessonSessionId,
            weeklySchedule.schedule!.sessions.map((session) => session.id),
          ),
        );
      expect(meetingRows).toHaveLength(
        weeklySchedule.schedule!.sessions.length,
      );
      expect(
        meetingRows.every((row) =>
          ['disabled', 'pending'].includes(row.status),
        ),
      ).toBe(true);

      const managementAfterSchedule =
        await getProgramManagementData(principal);
      const scheduledBranch = managementAfterSchedule.branches.find(
        (item) => item.id === branchId,
      );
      expect(scheduledBranch?.canDelete).toBe(false);
      expect(scheduledBranch?.lessonSchedule?.sessionCount).toBe(
        weeklySchedule.schedule?.sessionCount,
      );

      const studentEmail = `program-student-${marker}@example.invalid`;
      const [contact] = await database
        .insert(contacts)
        .values({
          email: studentEmail,
          firstName: 'Program',
          lastName: 'Student',
          normalizedEmail: studentEmail,
          phone: '+905551110000',
        })
        .returning({ id: contacts.id });
      contactId = contact!.id;
      const [candidate] = await database
        .insert(candidateProfiles)
        .values({ contactId })
        .returning({ id: candidateProfiles.id });
      candidateId = candidate!.id;
      const [student] = await database
        .insert(studentProfiles)
        .values({
          candidateId,
          contactId,
          currentLevel: 'A1',
          userId: studentUserId,
        })
        .returning({ id: studentProfiles.id });
      studentId = student!.id;
      const [draft] = await database
        .insert(enrollmentDrafts)
        .values({
          candidateId,
          completedAt: new Date(),
          createdByUserId: adminId,
          currentStep: 9,
          status: 'completed',
        })
        .returning({ id: enrollmentDrafts.id });
      draftId = draft!.id;
      const [enrollment] = await database
        .insert(enrollments)
        .values({
          branchId,
          candidateId,
          courseMode: 'group',
          draftId,
          finalPriceCents: 130_000,
          programId,
          programReferenceId: programId,
          registeredByUserId: adminId,
          studentId,
        })
        .returning({ id: enrollments.id });
      enrollmentId = enrollment!.id;

      const adminCalendar = await getAdminCalendarData(principal);
      const adminBranchEvents = adminCalendar.events.filter(
        (event) => event.branchName === 'Integration Morning Class',
      );
      expect(adminBranchEvents.length).toBe(
        weeklySchedule.schedule?.sessionCount,
      );
      expect(adminBranchEvents[0]?.kind).toBe('group_lesson');
      expect(adminBranchEvents[0]?.studentCount).toBe(1);

      const teacherPrincipal: WorkspacePrincipal = {
        accountStatus: 'active',
        email: `program-teacher-user-${marker}@example.invalid`,
        id: teacherUserId,
        name: 'Program Teacher',
        role: 'teacher',
        sessionCreatedAt: new Date().toISOString(),
        sessionId: randomUUID(),
        sessionLastVerifiedAt: new Date().toISOString(),
        sessionSecurityLevel: 'standard',
        twoFactorEnabled: false,
      };
      const teacherCalendar = await getTeacherCalendarData(teacherPrincipal);
      expect(teacherCalendar.instructor?.id).toBe(instructorId);
      expect(teacherCalendar.sessions.length).toBe(
        weeklySchedule.schedule?.sessionCount,
      );
      expect(teacherCalendar.sessions[0]?.branchName).toBe(
        'Integration Morning Class',
      );

      const studentPrincipal: WorkspacePrincipal = {
        accountStatus: 'active',
        email: `program-student-user-${marker}@example.invalid`,
        id: studentUserId,
        name: 'Program Student',
        role: 'student',
        sessionCreatedAt: new Date().toISOString(),
        sessionId: randomUUID(),
        sessionLastVerifiedAt: new Date().toISOString(),
        sessionSecurityLevel: 'standard',
        twoFactorEnabled: false,
      };
      const studentCalendar = await getStudentCalendarData(studentPrincipal);
      expect(studentCalendar.student?.id).toBe(studentId);
      expect(studentCalendar.events.length).toBe(
        weeklySchedule.schedule?.sessionCount,
      );
      expect(studentCalendar.events[0]?.branchName).toBe(
        'Integration Morning Class',
      );

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
      expect(managedInstructor?.userId).toBe(teacherUserId);
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
      await database
        .delete(enrollments)
        .where(eq(enrollments.id, enrollmentId!));
      enrollmentId = undefined;
      await database
        .delete(enrollmentDrafts)
        .where(eq(enrollmentDrafts.id, draftId!));
      draftId = undefined;
      await database
        .delete(studentProfiles)
        .where(eq(studentProfiles.id, studentId!));
      studentId = undefined;
      await database
        .delete(candidateProfiles)
        .where(eq(candidateProfiles.id, candidateId!));
      candidateId = undefined;
      await database.delete(contacts).where(eq(contacts.id, contactId!));
      contactId = undefined;
      await database
        .delete(lessonSessions)
        .where(eq(lessonSessions.branchId, branchId));
      await database
        .delete(branchLessonScheduleRules)
        .where(eq(branchLessonScheduleRules.branchId, branchId));
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
      if (enrollmentId) {
        await database
          .delete(enrollments)
          .where(eq(enrollments.id, enrollmentId));
      }
      if (draftId) {
        await database
          .delete(enrollmentDrafts)
          .where(eq(enrollmentDrafts.id, draftId));
      }
      if (studentId) {
        await database
          .delete(studentProfiles)
          .where(eq(studentProfiles.id, studentId));
      }
      if (candidateId) {
        await database
          .delete(candidateProfiles)
          .where(eq(candidateProfiles.id, candidateId));
      }
      if (contactId) {
        await database.delete(contacts).where(eq(contacts.id, contactId));
      }
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
        if (branchId) {
          await database
            .delete(lessonSessions)
            .where(eq(lessonSessions.branchId, branchId));
          await database
            .delete(branchLessonScheduleRules)
            .where(eq(branchLessonScheduleRules.branchId, branchId));
        }
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
      await database.delete(users).where(eq(users.id, studentUserId));
      await database.delete(users).where(eq(users.id, teacherUserId));
      await database.delete(users).where(eq(users.id, adminId));
    }
  });
});
