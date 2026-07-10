import 'server-only';

import { and, eq, inArray } from 'drizzle-orm';
import type {
  MediaAuthorizationService,
  WorkspacePrincipal,
} from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import {
  assignmentAttachments,
  assignments,
  assignmentSubmissionAttachments,
  assignmentSubmissions,
  conversations,
  enrollments,
  instructorProfiles,
  messageAttachments,
  messages,
  studentProfiles,
} from '@/lib/server/db/schema';
import { isProfilePhotoAsset } from '@/lib/server/services/profile-photo';

const activeEnrollmentStatuses = ['active', 'paused'] as const;

// A media asset attached to an assignment/submission is readable by the people
// on either side of that relationship — beyond the uploader (owner) check:
//  - the instructor who owns the assignment (their assignment's files + their
//    students' submission files)
//  - a student who is a target of the assignment (the assignment's files)
// A student's own submission files are already covered by the owner check.
async function canReadAssignmentMedia(
  principal: WorkspacePrincipal,
  assetId: string,
): Promise<boolean> {
  if (principal.role === 'teacher') {
    const [profile] = await database
      .select({ id: instructorProfiles.id })
      .from(instructorProfiles)
      .where(eq(instructorProfiles.userId, principal.id))
      .limit(1);
    if (!profile) return false;

    const ownedAssignment = await database
      .select({ id: assignments.id })
      .from(assignmentAttachments)
      .innerJoin(
        assignments,
        eq(assignments.id, assignmentAttachments.assignmentId),
      )
      .where(
        and(
          eq(assignmentAttachments.mediaAssetId, assetId),
          eq(assignments.instructorProfileId, profile.id),
        ),
      )
      .limit(1);
    if (ownedAssignment.length) return true;

    const ownedSubmission = await database
      .select({ id: assignmentSubmissions.id })
      .from(assignmentSubmissionAttachments)
      .innerJoin(
        assignmentSubmissions,
        eq(
          assignmentSubmissions.id,
          assignmentSubmissionAttachments.submissionId,
        ),
      )
      .innerJoin(
        assignments,
        eq(assignments.id, assignmentSubmissions.assignmentId),
      )
      .where(
        and(
          eq(assignmentSubmissionAttachments.mediaAssetId, assetId),
          eq(assignments.instructorProfileId, profile.id),
        ),
      )
      .limit(1);
    return ownedSubmission.length > 0;
  }

  if (principal.role === 'student') {
    const [profile] = await database
      .select({ id: studentProfiles.id })
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, principal.id))
      .limit(1);
    if (!profile) return false;

    const enrollmentRows = await database
      .select({
        enrollmentId: enrollments.id,
        branchId: enrollments.branchId,
      })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, profile.id),
          inArray(enrollments.status, activeEnrollmentStatuses),
        ),
      );
    const branchIds = new Set(
      enrollmentRows
        .map((row) => row.branchId)
        .filter((value): value is string => Boolean(value)),
    );
    const enrollmentIds = new Set(
      enrollmentRows.map((row) => row.enrollmentId),
    );

    const rows = await database
      .select({
        targetType: assignments.targetType,
        targetBranchId: assignments.targetBranchId,
        targetEnrollmentId: assignments.targetEnrollmentId,
      })
      .from(assignmentAttachments)
      .innerJoin(
        assignments,
        eq(assignments.id, assignmentAttachments.assignmentId),
      )
      .where(eq(assignmentAttachments.mediaAssetId, assetId));
    return rows.some(
      (row) =>
        (row.targetType === 'branch' &&
          row.targetBranchId != null &&
          branchIds.has(row.targetBranchId)) ||
        (row.targetType === 'student' &&
          row.targetEnrollmentId != null &&
          enrollmentIds.has(row.targetEnrollmentId)),
    );
  }

  return false;
}

// A media asset attached to a chat message is readable by either party of the
// conversation it belongs to (beyond the uploader/owner check).
async function canReadMessageMedia(
  principal: WorkspacePrincipal,
  assetId: string,
): Promise<boolean> {
  if (principal.role === 'teacher') {
    const [profile] = await database
      .select({ id: instructorProfiles.id })
      .from(instructorProfiles)
      .where(eq(instructorProfiles.userId, principal.id))
      .limit(1);
    if (!profile) return false;
    const rows = await database
      .select({ id: messages.id })
      .from(messageAttachments)
      .innerJoin(messages, eq(messages.id, messageAttachments.messageId))
      .innerJoin(conversations, eq(conversations.id, messages.conversationId))
      .where(
        and(
          eq(messageAttachments.mediaAssetId, assetId),
          eq(conversations.instructorProfileId, profile.id),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  if (principal.role === 'student') {
    const [profile] = await database
      .select({ id: studentProfiles.id })
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, principal.id))
      .limit(1);
    if (!profile) return false;
    const rows = await database
      .select({ id: messages.id })
      .from(messageAttachments)
      .innerJoin(messages, eq(messages.id, messageAttachments.messageId))
      .innerJoin(conversations, eq(conversations.id, messages.conversationId))
      .where(
        and(
          eq(messageAttachments.mediaAssetId, assetId),
          eq(conversations.studentProfileId, profile.id),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  return false;
}

export const mediaAuthorizationService: MediaAuthorizationService = {
  async canRead(principal, asset) {
    if (asset.visibility === 'public') {
      return true;
    }

    if (
      !principal ||
      principal.accountStatus !== 'active' ||
      principal.sessionSecurityLevel === 'pending'
    ) {
      return false;
    }

    if (principal.role === 'admin') {
      return principal.sessionSecurityLevel === 'mfa';
    }

    if (asset.ownerUserId === principal.id) {
      return true;
    }

    // Profile photos are identity, not content: any active session may see
    // them (they render in lists, chat and pickers across every role).
    if (await isProfilePhotoAsset(asset.id)) {
      return true;
    }

    if (await canReadAssignmentMedia(principal, asset.id)) {
      return true;
    }

    return canReadMessageMedia(principal, asset.id);
  },

  async canUpload(principal, visibility) {
    if (
      principal.accountStatus !== 'active' ||
      principal.sessionSecurityLevel === 'pending'
    ) {
      return false;
    }

    return visibility === 'private' || principal.role === 'admin';
  },
};
