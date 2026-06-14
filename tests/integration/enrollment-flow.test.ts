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
  enrollmentParties,
  enrollments,
  programs,
  studentProfiles,
  users,
} from '@/lib/server/db/schema';
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
    let programId: string | undefined;

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

      const started = await beginEnrollmentDraft(principal, candidateId);
      draftId = started.id;
      expect(started.created).toBe(true);

      const resumed = await beginEnrollmentDraft(principal, candidateId);
      expect(resumed).toEqual({ created: false, id: draftId });

      await updateEnrollmentDraft(principal, draftId, {
        data: {
          birthDate: '2000-01-01',
          birthPlace: 'Istanbul',
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
          programId,
        },
        step: 3,
      });
      await updateEnrollmentDraft(principal, draftId, {
        data: { correctedSource: 'integration_test' },
        step: 4,
      });
      await updateEnrollmentDraft(principal, draftId, {
        data: { registrationChannel: 'office' },
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
    } finally {
      if (candidateId) {
        await database
          .delete(candidateActivities)
          .where(eq(candidateActivities.candidateId, candidateId));
      }
      if (enrollmentId) {
        await database
          .delete(enrollments)
          .where(eq(enrollments.id, enrollmentId));
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
      if (candidateId) {
        await database
          .delete(candidateProfiles)
          .where(eq(candidateProfiles.id, candidateId));
      }
      if (contactId) {
        await database.delete(contacts).where(eq(contacts.id, contactId));
      }
      if (programId) {
        await database.delete(programs).where(eq(programs.id, programId));
      }
      await database.delete(users).where(eq(users.id, adminId));
    }
  });
});
