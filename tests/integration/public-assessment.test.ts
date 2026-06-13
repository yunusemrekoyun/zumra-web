import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { database, databasePool } from '@/lib/server/db/client';
import {
  appointmentPreferences,
  appointmentRequests,
  assessmentAnswers,
  assessmentAttempts,
  assessmentResults,
  candidateActivities,
  candidateConsents,
  candidateInquiries,
  candidateProfiles,
  contacts,
} from '@/lib/server/db/schema';
import {
  answerPublicAssessment,
  completePublicCandidateProfile,
  requestPublicAppointment,
  startPublicAssessment,
} from '@/lib/server/services/public-assessments';

const integration =
  process.env.RUN_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

afterAll(async () => {
  await databasePool.end();
});

integration('public candidate assessment flow', () => {
  it('deduplicates candidates, protects results and creates one appointment request', async () => {
    const marker = randomUUID();
    const email = `assessment-${marker}@example.invalid`;
    let contactId: string | undefined;
    let candidateId: string | undefined;

    try {
      const first = await startPublicAssessment(
        {
          email,
          firstName: 'Integration',
          idempotencyKey: randomUUID(),
          language: 'english',
          lastName: 'Candidate',
          locale: 'tr',
          marketingConsent: false,
        },
        undefined,
        '127.0.0.0/24',
      );

      const resumed = await startPublicAssessment(
        {
          email,
          firstName: 'Integration',
          idempotencyKey: randomUUID(),
          language: 'english',
          lastName: 'Candidate',
          locale: 'tr',
          marketingConsent: false,
        },
        first.token,
        '127.0.0.0/24',
      );

      expect(resumed.token).toBe(first.token);
      expect(resumed.state.question?.order).toBe(1);

      let state = first.state;

      while (state.stage === 'assessment' && state.question) {
        const correct = state.question.options.find((option) =>
          option.label.startsWith('Doğru'),
        );
        expect(correct).toBeDefined();
        state = await answerPublicAssessment(
          first.token,
          state.question.id,
          correct!.id,
          'tr',
        );
      }

      expect(state.stage).toBe('profile');
      expect(state.result).toBeUndefined();
      expect(state.resultReady).toBe(true);

      state = await completePublicCandidateProfile(
        first.token,
        {
          city: 'Istanbul',
          isMinor: false,
          learningGoal: 'career',
          lessonModel: 'one_to_one',
          phone: '+905551112233',
          preferredContactChannel: 'whatsapp',
          timezone: 'Europe/Istanbul',
        },
        'tr',
      );

      expect(state.stage).toBe('result');
      expect(state.result).toMatchObject({
        correctCount: 15,
        level: 'C1',
        score: 100,
      });

      const base = Date.now() + 24 * 60 * 60 * 1000;
      state = await requestPublicAppointment(
        first.token,
        'Europe/Istanbul',
        [1, 2, 3].map((day) =>
          new Date(base + day * 24 * 60 * 60 * 1000).toISOString(),
        ),
        'tr',
      );

      expect(state.appointment).toMatchObject({
        status: 'requested',
        timezone: 'Europe/Istanbul',
      });
      expect(state.appointment?.preferences).toHaveLength(3);

      const second = await startPublicAssessment(
        {
          email,
          firstName: 'Changed',
          idempotencyKey: randomUUID(),
          language: 'german',
          lastName: 'Name',
          locale: 'en',
          marketingConsent: true,
        },
        undefined,
        '127.0.0.0/24',
      );
      expect(second.token).not.toBe(first.token);

      const [contact] = await database
        .select({ id: contacts.id })
        .from(contacts)
        .where(eq(contacts.normalizedEmail, email))
        .limit(1);
      expect(contact).toBeDefined();
      contactId = contact!.id;

      const [candidate] = await database
        .select({ id: candidateProfiles.id })
        .from(candidateProfiles)
        .where(eq(candidateProfiles.contactId, contactId))
        .limit(1);
      expect(candidate).toBeDefined();
      candidateId = candidate!.id;

      const inquiries = await database
        .select({ id: candidateInquiries.id })
        .from(candidateInquiries)
        .where(eq(candidateInquiries.candidateId, candidateId));
      expect(inquiries).toHaveLength(2);
    } finally {
      if (candidateId) {
        const inquiries = await database
          .select({ id: candidateInquiries.id })
          .from(candidateInquiries)
          .where(eq(candidateInquiries.candidateId, candidateId));

        for (const inquiry of inquiries) {
          const attempts = await database
            .select({ id: assessmentAttempts.id })
            .from(assessmentAttempts)
            .where(eq(assessmentAttempts.inquiryId, inquiry.id));
          const requests = await database
            .select({ id: appointmentRequests.id })
            .from(appointmentRequests)
            .where(eq(appointmentRequests.inquiryId, inquiry.id));

          for (const request of requests) {
            await database
              .delete(appointmentPreferences)
              .where(eq(appointmentPreferences.requestId, request.id));
          }
          await database
            .delete(appointmentRequests)
            .where(eq(appointmentRequests.inquiryId, inquiry.id));

          for (const attempt of attempts) {
            await database
              .delete(assessmentAnswers)
              .where(eq(assessmentAnswers.attemptId, attempt.id));
            await database
              .delete(assessmentResults)
              .where(eq(assessmentResults.attemptId, attempt.id));
          }
          await database
            .delete(assessmentAttempts)
            .where(eq(assessmentAttempts.inquiryId, inquiry.id));
          await database
            .delete(candidateConsents)
            .where(eq(candidateConsents.inquiryId, inquiry.id));
        }

        await database
          .delete(candidateActivities)
          .where(eq(candidateActivities.candidateId, candidateId));
        await database
          .delete(candidateInquiries)
          .where(eq(candidateInquiries.candidateId, candidateId));
        await database
          .delete(candidateProfiles)
          .where(eq(candidateProfiles.id, candidateId));
      }

      if (contactId) {
        await database.delete(contacts).where(eq(contacts.id, contactId));
      }
    }
  });
});
