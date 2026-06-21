import 'server-only';

import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  or,
} from 'drizzle-orm';
import type { WorkspacePrincipal } from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import {
  contacts,
  enrollments,
  instructorProfiles,
  programBranches,
  programs,
  studentProfiles,
} from '@/lib/server/db/schema';
import { AuthorizationDeniedError } from '@/lib/server/http/errors';

const activeEnrollmentStatuses = ['active', 'paused'] as const;

export type TeacherStudentView = {
  branchName?: string;
  courseMode: 'group' | 'private';
  currentLevel?: string;
  email: string;
  enrolledAt: string;
  enrollmentId: string;
  fullName: string;
  phone?: string;
  programName?: string;
  status: 'active' | 'paused';
  studentId: string;
};

export type TeacherBranchView = {
  currentEnrollmentCount: number;
  id: string;
  name: string;
  plannedEndDate: string;
  plannedStartDate: string;
  programName: string;
  status: string;
  timezone: string;
};

export type TeacherWorkspaceData = {
  branches: TeacherBranchView[];
  instructor?: {
    email: string;
    fullName: string;
    id: string;
    phone?: string;
  };
  students: TeacherStudentView[];
};

export async function getTeacherWorkspaceData(
  principal: WorkspacePrincipal,
): Promise<TeacherWorkspaceData> {
  assertTeacher(principal);

  const [profile] = await database
    .select({
      email: instructorProfiles.email,
      firstName: instructorProfiles.firstName,
      id: instructorProfiles.id,
      lastName: instructorProfiles.lastName,
      phone: instructorProfiles.phone,
    })
    .from(instructorProfiles)
    .where(eq(instructorProfiles.userId, principal.id))
    .limit(1);

  if (!profile) {
    return { branches: [], students: [] };
  }

  const [studentRows, branchRows] = await Promise.all([
    database
      .select({
        branchId: enrollments.branchId,
        branchName: programBranches.name,
        courseMode: enrollments.courseMode,
        currentLevel: studentProfiles.currentLevel,
        email: contacts.email,
        enrolledAt: enrollments.enrolledAt,
        enrollmentId: enrollments.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        phone: contacts.phone,
        programName: programs.name,
        status: enrollments.status,
        studentId: studentProfiles.id,
      })
      .from(enrollments)
      .innerJoin(
        studentProfiles,
        eq(studentProfiles.id, enrollments.studentId),
      )
      .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
      .leftJoin(programs, eq(programs.id, enrollments.programId))
      .leftJoin(programBranches, eq(programBranches.id, enrollments.branchId))
      .where(
        and(
          inArray(enrollments.status, activeEnrollmentStatuses),
          or(
            eq(programBranches.instructorProfileId, profile.id),
            eq(enrollments.selectedInstructorProfileId, profile.id),
          ),
        ),
      )
      .orderBy(asc(contacts.lastName), asc(contacts.firstName)),
    database
      .select({
        id: programBranches.id,
        name: programBranches.name,
        plannedEndDate: programBranches.plannedEndDate,
        plannedStartDate: programBranches.plannedStartDate,
        programName: programs.name,
        status: programBranches.status,
        timezone: programBranches.timezone,
      })
      .from(programBranches)
      .innerJoin(programs, eq(programs.id, programBranches.programId))
      .where(
        and(
          eq(programBranches.instructorProfileId, profile.id),
          isNull(programBranches.archivedAt),
        ),
      )
      .orderBy(
        desc(programBranches.plannedStartDate),
        asc(programBranches.name),
      ),
  ]);

  const countByBranch = new Map<string, number>();
  for (const student of studentRows) {
    if (student.branchId) {
      countByBranch.set(
        student.branchId,
        (countByBranch.get(student.branchId) ?? 0) + 1,
      );
    }
  }

  return {
    branches: branchRows.map((branch) => ({
      ...branch,
      currentEnrollmentCount: countByBranch.get(branch.id) ?? 0,
    })),
    instructor: {
      email: profile.email,
      fullName: fullName(profile.firstName, profile.lastName),
      id: profile.id,
      phone: profile.phone ?? undefined,
    },
    students: studentRows.map((student) => ({
      branchName: student.branchName ?? undefined,
      courseMode: student.courseMode,
      currentLevel: student.currentLevel ?? undefined,
      email: student.email,
      enrolledAt: student.enrolledAt.toISOString(),
      enrollmentId: student.enrollmentId,
      fullName: fullName(student.firstName, student.lastName),
      phone: student.phone ?? undefined,
      programName: student.programName ?? undefined,
      status: student.status as 'active' | 'paused',
      studentId: student.studentId,
    })),
  };
}

function assertTeacher(principal: WorkspacePrincipal) {
  if (principal.role !== 'teacher') {
    throw new AuthorizationDeniedError('Teacher access is required.');
  }
}

function fullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}
