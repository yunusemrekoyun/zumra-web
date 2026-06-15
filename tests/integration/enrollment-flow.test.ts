import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@/lib/domain';
import { database, databasePool } from '@/lib/server/db/client';
import {
  candidateActivities,
  candidateProfiles,
  contacts,
  enrollmentDrafts,
  enrollmentBranchTransfers,
  enrollmentParties,
  enrollments,
  programBranches,
  programs,
  studentProfiles,
  users,
} from '@/lib/server/db/schema';
import {
  archiveProgramBranch,
  deleteUnusedProgramBranch,
  getProgramBranchArchivePreview,
} from '@/lib/server/services/programs';
import {
  beginEnrollmentDraft,
  completeEnrollment,
  getEnrollmentDraftForAdmin,
  updateEnrollmentDraft,
} from '@/lib/server/services/enrollments';

const integration =
  process.env.RUN_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

afterAll(async () => {
  await databasePool.end();
});

integration('candidate enrollment flow', () => {
  it('keeps drafts separate and converts a candidate atomically', async () => {
    const marker = randomUUID();
    const adminId = `enrollment-admin-${marker}`;
    const email = `enrollment-${marker}@example.invalid`;
    let contactId: string | undefined;
    let candidateId: string | undefined;
    let draftId: string | undefined;
    let studentId: string | undefined;
    let enrollmentId: string | undefined;
    let branchId: string | undefined;
    let programId: string | undefined;
    let secondDraftId: string | undefined;
    let targetBranchId: string | undefined;
    let otherProgramId: string | undefined;
    let otherBranchId: string | undefined;
    let occupancyDraftId: string | undefined;
    let occupancyEnrollmentId: string | undefined;

    const principal: WorkspacePrincipal = {
      accountStatus: 'active',
      email: `admin-${marker}@example.invalid`,
      id: adminId,
      name: 'Enrollment Admin',
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
      const [contact] = await database
        .insert(contacts)
        .values({
          email,
          firstName: 'Enrollment',
          lastName: 'Candidate',
          normalizedEmail: email,
          phone: '+905551110000',
        })
        .returning({ id: contacts.id });
      contactId = contact!.id;

      const [candidate] = await database
        .insert(candidateProfiles)
        .values({ contactId })
        .returning({ id: candidateProfiles.id });
      candidateId = candidate!.id;

      const [program] = await database
        .insert(programs)
        .values({
          createdByUserId: adminId,
          kind: 'group',
          language: 'english',
          levels: ['A1', 'A2'],
          listPriceCents: 100_000,
          name: 'Integration English Program',
        })
        .returning({ id: programs.id });
      programId = program!.id;
      const [branch] = await database
        .insert(programBranches)
        .values({
          createdByUserId: adminId,
          maximumCapacity: 1,
          minimumCapacity: 1,
          name: 'Integration Class',
          plannedEndDate: '2026-09-30',
          plannedStartDate: '2026-07-01',
          programId,
          status: 'enrollment_open',
        })
        .returning({ id: programBranches.id });
      branchId = branch!.id;

      const started = await beginEnrollmentDraft(principal, candidateId);
      draftId = started.id;
      expect(started.created).toBe(true);

      const resumed = await beginEnrollmentDraft(principal, candidateId);
      expect(resumed).toEqual({ created: false, id: draftId });

      await updateEnrollmentDraft(principal, draftId, {
        data: {
          birthAdministrativeArea: 'Istanbul',
          birthCountryCode: 'TR',
          birthDate: '2000-01-01',
          birthLocality: 'Kadikoy',
          firstName: 'Enrollment',
          gender: 'prefer_not_to_say',
          identityDocument: 'TESTPASS123',
          identityDocumentType: 'passport',
          lastName: 'Candidate',
          school: 'Integration School',
        },
        step: 1,
      });
      await updateEnrollmentDraft(principal, draftId, {
        data: {
          email,
          parties: [],
          primaryPhone: '+905551110000',
          residenceAddress: 'Integration Test Address 1',
          studentIsContractParty: true,
        },
        step: 2,
      });
      await updateEnrollmentDraft(principal, draftId, {
        data: {
          branchId,
          programId,
        },
        step: 3,
      });
      await updateEnrollmentDraft(principal, draftId, {
        data: {
          correctedSource: 'other',
          correctedSourceDetail: 'Integration test',
        },
        step: 4,
      });
      await updateEnrollmentDraft(principal, draftId, {
        data: { registrationChannel: 'web' },
        step: 5,
      });
      await updateEnrollmentDraft(principal, draftId, {
        data: {
          discountType: 'fixed',
          discountValue: 10_000,
          initialPaymentCents: 20_000,
          installmentCount: 4,
          paymentMethod: 'bank_transfer',
        },
        step: 7,
      });
      await updateEnrollmentDraft(principal, draftId, {
        data: {
          scheduleMode: 'pending',
          schedulePreferences: [],
        },
        step: 8,
      });
      await updateEnrollmentDraft(principal, draftId, {
        data: { internalNotes: 'Integration enrollment' },
        step: 9,
      });

      const view = await getEnrollmentDraftForAdmin(principal, candidateId);
      expect(view?.draft.identityDocumentMasked).toBe('****S123');

      const [storedDraft] = await database
        .select({
          encrypted: enrollmentDrafts.identityDocumentEncrypted,
        })
        .from(enrollmentDrafts)
        .where(eq(enrollmentDrafts.id, draftId))
        .limit(1);
      expect(storedDraft?.encrypted).not.toContain('TESTPASS123');

      const completed = await completeEnrollment(principal, draftId);
      expect(completed).toBeDefined();
      studentId = completed!.studentId;
      enrollmentId = completed!.id;

      const [candidateAfter] = await database
        .select({ stage: candidateProfiles.stage })
        .from(candidateProfiles)
        .where(eq(candidateProfiles.id, candidateId))
        .limit(1);
      expect(candidateAfter?.stage).toBe('enrolled');

      const repeated = await completeEnrollment(principal, draftId);
      expect(repeated).toEqual({ id: enrollmentId, studentId });

      const secondDraft = await beginEnrollmentDraft(principal, candidateId);
      secondDraftId = secondDraft.id;
      await expect(
        updateEnrollmentDraft(principal, secondDraftId, {
          data: { branchId, programId },
          step: 3,
        }),
      ).rejects.toThrow('program_branch_capacity_full');

      await updateEnrollmentDraft(principal, secondDraftId, {
        data: {
          branchId,
          capacityOverride: true,
          capacityOverrideNote: 'Integration capacity approval',
          programId,
        },
        step: 3,
      });
      const [overriddenDraft] = await database
        .select({
          capacityOverride: enrollmentDrafts.capacityOverride,
          capacityOverrideByUserId:
            enrollmentDrafts.capacityOverrideByUserId,
        })
        .from(enrollmentDrafts)
        .where(eq(enrollmentDrafts.id, secondDraftId))
        .limit(1);
      expect(overriddenDraft?.capacityOverride).toBe(true);
      expect(overriddenDraft?.capacityOverrideByUserId).toBe(adminId);

      const [targetBranch] = await database
        .insert(programBranches)
        .values({
          createdByUserId: adminId,
          maximumCapacity: 1,
          minimumCapacity: 1,
          name: 'Integration Target Class',
          plannedEndDate: '2026-10-31',
          plannedStartDate: '2026-07-01',
          programId,
          status: 'enrollment_open',
        })
        .returning({ id: programBranches.id });
      targetBranchId = targetBranch!.id;

      const [otherProgram] = await database
        .insert(programs)
        .values({
          createdByUserId: adminId,
          kind: 'group',
          language: 'german',
          levels: ['A1'],
          listPriceCents: 90_000,
          name: 'Integration Other Program',
        })
        .returning({ id: programs.id });
      otherProgramId = otherProgram!.id;
      const [otherBranch] = await database
        .insert(programBranches)
        .values({
          createdByUserId: adminId,
          maximumCapacity: 5,
          minimumCapacity: 1,
          name: 'Integration Other Class',
          plannedEndDate: '2026-10-31',
          plannedStartDate: '2026-07-01',
          programId: otherProgramId,
          status: 'enrollment_open',
        })
        .returning({ id: programBranches.id });
      otherBranchId = otherBranch!.id;

      const [occupancyDraft] = await database
        .insert(enrollmentDrafts)
        .values({
          candidateId,
          completedAt: new Date(),
          createdByUserId: adminId,
          currentStep: 9,
          status: 'completed',
        })
        .returning({ id: enrollmentDrafts.id });
      occupancyDraftId = occupancyDraft!.id;
      const [occupancyEnrollment] = await database
        .insert(enrollments)
        .values({
          branchId: targetBranchId,
          candidateId,
          courseMode: 'group',
          draftId: occupancyDraftId,
          finalPriceCents: 100_000,
          programId,
          programReferenceId: programId,
          registeredByUserId: adminId,
          studentId,
        })
        .returning({ id: enrollments.id });
      occupancyEnrollmentId = occupancyEnrollment!.id;

      const preview = await getProgramBranchArchivePreview(
        principal,
        branchId,
      );
      expect(preview.students).toEqual([
        expect.objectContaining({ enrollmentId }),
      ]);
      expect(preview.targets.map((target) => target.id)).toContain(
        targetBranchId,
      );
      expect(preview.targets.map((target) => target.id)).not.toContain(
        otherBranchId,
      );

      await expect(
        archiveProgramBranch(principal, branchId, {
          reason: 'Invalid cross-program transfer',
          transfers: [
            {
              enrollmentId,
              targetBranchId: otherBranchId,
            },
          ],
        }),
      ).rejects.toThrow('branch_transfer_target_invalid');

      await expect(
        archiveProgramBranch(principal, branchId, {
          reason: 'Missing capacity approval',
          transfers: [
            {
              enrollmentId,
              targetBranchId,
            },
          ],
        }),
      ).rejects.toThrow('branch_transfer_capacity_override_required');

      const archived = await archiveProgramBranch(principal, branchId, {
        reason: 'Integration branch closure',
        transfers: [
          {
            capacityOverride: true,
            capacityOverrideNote: 'Approved by integration test',
            enrollmentId,
            targetBranchId,
          },
        ],
      });
      expect(archived.transferred).toBe(1);
      await expect(
        deleteUnusedProgramBranch(principal, branchId),
      ).rejects.toThrow('program_branch_in_use');

      const [transferredEnrollment] = await database
        .select({
          branchId: enrollments.branchId,
          capacityOverride: enrollments.capacityOverride,
        })
        .from(enrollments)
        .where(eq(enrollments.id, enrollmentId))
        .limit(1);
      expect(transferredEnrollment).toMatchObject({
        branchId: targetBranchId,
        capacityOverride: true,
      });
      const [transferHistory] = await database
        .select()
        .from(enrollmentBranchTransfers)
        .where(eq(enrollmentBranchTransfers.enrollmentId, enrollmentId))
        .limit(1);
      expect(transferHistory).toMatchObject({
        fromBranchId: branchId,
        toBranchId: targetBranchId,
      });
    } finally {
      if (candidateId) {
        await database
          .delete(candidateActivities)
          .where(eq(candidateActivities.candidateId, candidateId));
      }
      if (enrollmentId) {
        await database
          .delete(enrollmentBranchTransfers)
          .where(eq(enrollmentBranchTransfers.enrollmentId, enrollmentId));
        await database
          .delete(enrollments)
          .where(eq(enrollments.id, enrollmentId));
      }
      if (occupancyEnrollmentId) {
        await database
          .delete(enrollments)
          .where(eq(enrollments.id, occupancyEnrollmentId));
      }
      if (studentId) {
        await database
          .delete(studentProfiles)
          .where(eq(studentProfiles.id, studentId));
      }
      if (draftId) {
        await database
          .delete(enrollmentParties)
          .where(eq(enrollmentParties.draftId, draftId));
        await database
          .delete(enrollmentDrafts)
          .where(eq(enrollmentDrafts.id, draftId));
      }
      if (secondDraftId) {
        await database
          .delete(enrollmentDrafts)
          .where(eq(enrollmentDrafts.id, secondDraftId));
      }
      if (occupancyDraftId) {
        await database
          .delete(enrollmentDrafts)
          .where(eq(enrollmentDrafts.id, occupancyDraftId));
      }
      if (candidateId) {
        await database
          .delete(candidateProfiles)
          .where(eq(candidateProfiles.id, candidateId));
      }
      if (contactId) {
        await database.delete(contacts).where(eq(contacts.id, contactId));
      }
      if (programId) {
        await database
          .delete(programBranches)
          .where(eq(programBranches.programId, programId));
        await database.delete(programs).where(eq(programs.id, programId));
      }
      if (otherProgramId) {
        await database
          .delete(programBranches)
          .where(eq(programBranches.programId, otherProgramId));
        await database
          .delete(programs)
          .where(eq(programs.id, otherProgramId));
      }
      await database.delete(users).where(eq(users.id, adminId));
    }
  });
});
