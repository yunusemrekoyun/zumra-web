import 'server-only';

import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  sql,
} from 'drizzle-orm';
import { database } from '@/lib/server/db/client';
import {
  appointmentPreferences,
  appointmentRequests,
  assessmentAnswers,
  assessmentAttempts,
  assessmentOptions,
  assessmentQuestions,
  assessmentResults,
  assessments,
  assessmentVersions,
  candidateActivities,
  candidateConsents,
  candidateInquiries,
  candidateProfiles,
  contacts,
  programs,
  type LocalizedText,
  advisorTasks,
} from '@/lib/server/db/schema';
import { normalizePhoneNumber, phoneNumberIsValid } from '@/lib/domain/phone';
import { PublicFlowError } from '@/lib/server/http/errors';
import { createOpaqueToken, hashToken } from '@/lib/server/security/tokens';
import { notifyLeadReceived } from './notify-events';

const ATTEMPT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FORM_VERSION = 'public-level-test-v1';
const CONSENT_VERSION = 'candidate-notice-v1';
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;

export const publicAssessmentLanguages = [
  'english',
  'german',
  'french',
  'arabic',
] as const;

export type PublicAssessmentLanguage =
  (typeof publicAssessmentLanguages)[number];
export type PublicAssessmentLocale = 'en' | 'tr';

type StartAssessmentInput = {
  attribution?: Record<string, string>;
  email: string;
  firstName: string;
  idempotencyKey: string;
  language: PublicAssessmentLanguage;
  lastName: string;
  locale: PublicAssessmentLocale;
  marketingConsent: boolean;
  referrer?: string;
  restart?: boolean;
};

type CompleteProfileInput = {
  city?: string;
  contactWindow?: string;
  isMinor: boolean;
  learningGoal: string;
  lessonModel?: string;
  phone: string;
  preferredContactChannel: string;
  timezone: string;
};

type AttemptContext = {
  attemptId: string;
  candidateId: string;
  completedAt: Date | null;
  contactId: string;
  currentQuestionOrder: number;
  email: string;
  expiresAt: Date;
  firstName: string;
  inquiryId: string;
  language: string;
  lastName: string;
  profileCompletedAt: Date | null;
  questionCount: number;
  resultLevel: string | null;
  score: number | null;
  status: 'completed' | 'in_progress' | 'not_started';
  versionId: string;
};

export type PublicAssessmentState = {
  appointment?: {
    preferences: string[];
    status: 'cancelled' | 'completed' | 'no_show' | 'requested' | 'scheduled';
    timezone: string;
  };
  candidate: {
    firstName: string;
    language: string;
  };
  expiresAt: string;
  question?: {
    difficulty: number;
    id: string;
    level: string;
    options: Array<{ id: string; label: string }>;
    order: number;
    prompt: string;
    topic: string;
  };
  result?: {
    correctCount: number;
    level: string;
    levelBreakdown: Record<string, { correct: number; total: number }>;
    score: number;
    totalQuestions: number;
  };
  resultReady: boolean;
  stage: 'assessment' | 'profile' | 'result';
  totalQuestions: number;
};

function normalizeEmail(value: string) {
  return value.trim().toLocaleLowerCase('en-US');
}

function normalizePhone(value: string) {
  // Store E.164 (default region TR) so contacts stay valid when the enrollment
  // wizard and admin edits later re-validate the same number.
  const normalized = normalizePhoneNumber(value, 'TR');
  if (!phoneNumberIsValid(normalized)) {
    throw new PublicFlowError('invalid_phone');
  }
  return normalized;
}

function localized(value: LocalizedText, locale: PublicAssessmentLocale) {
  return value[locale] || value.tr || value.en;
}

function consentCopy(locale: PublicAssessmentLocale) {
  return locale === 'tr'
    ? 'Bilgilerimin adaylık, seviye tespiti ve iletişim sürecinin yürütülmesi için işlenmesini kabul ediyorum. 18 yaşın altındaysam bu bilgileri velimin bilgisi ve onayıyla verdiğimi beyan ederim.'
    : 'I consent to the processing of my information for candidacy, level assessment and communication. If I am under 18, I confirm that I provide this information with my guardian’s knowledge and approval.';
}

async function getAttemptContext(token: string): Promise<AttemptContext | null> {
  const [context] = await database
    .select({
      attemptId: assessmentAttempts.id,
      candidateId: candidateProfiles.id,
      completedAt: assessmentAttempts.completedAt,
      contactId: contacts.id,
      currentQuestionOrder: assessmentAttempts.currentQuestionOrder,
      email: contacts.email,
      expiresAt: assessmentAttempts.expiresAt,
      firstName: contacts.firstName,
      inquiryId: candidateInquiries.id,
      language: candidateInquiries.language,
      lastName: contacts.lastName,
      profileCompletedAt: assessmentAttempts.profileCompletedAt,
      questionCount: assessmentVersions.questionCount,
      resultLevel: assessmentAttempts.resultLevel,
      score: assessmentAttempts.score,
      status: assessmentAttempts.status,
      versionId: assessmentVersions.id,
    })
    .from(assessmentAttempts)
    .innerJoin(
      candidateInquiries,
      eq(candidateInquiries.id, assessmentAttempts.inquiryId),
    )
    .innerJoin(
      candidateProfiles,
      eq(candidateProfiles.id, candidateInquiries.candidateId),
    )
    .innerJoin(contacts, eq(contacts.id, candidateProfiles.contactId))
    .innerJoin(
      assessmentVersions,
      eq(assessmentVersions.id, assessmentAttempts.versionId),
    )
    .where(
      and(
        eq(assessmentAttempts.continuationTokenHash, hashToken(token)),
        gt(assessmentAttempts.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return context ?? null;
}

async function requireAttemptContext(token: string) {
  const context = await getAttemptContext(token);

  if (!context) {
    throw new PublicFlowError('assessment_session_expired', 410);
  }

  return context;
}

async function buildState(
  context: AttemptContext,
  locale: PublicAssessmentLocale,
): Promise<PublicAssessmentState> {
  const base = {
    candidate: {
      firstName: context.firstName,
      language: context.language,
    },
    expiresAt: context.expiresAt.toISOString(),
    resultReady: context.status === 'completed',
    totalQuestions: context.questionCount,
  };

  if (context.status !== 'completed') {
    const [question] = await database
      .select({
        difficulty: assessmentQuestions.difficulty,
        id: assessmentQuestions.id,
        level: assessmentQuestions.level,
        order: assessmentQuestions.order,
        prompt: assessmentQuestions.prompt,
        topic: assessmentQuestions.topic,
      })
      .from(assessmentQuestions)
      .where(
        and(
          eq(assessmentQuestions.versionId, context.versionId),
          eq(assessmentQuestions.order, context.currentQuestionOrder),
        ),
      )
      .limit(1);

    if (!question) {
      throw new PublicFlowError('assessment_unavailable', 409);
    }

    const options = await database
      .select({
        id: assessmentOptions.id,
        label: assessmentOptions.label,
      })
      .from(assessmentOptions)
      .where(eq(assessmentOptions.questionId, question.id))
      .orderBy(asc(assessmentOptions.order));

    return {
      ...base,
      question: {
        ...question,
        options: options.map((option) => ({
          id: option.id,
          label: localized(option.label, locale),
        })),
        prompt: localized(question.prompt, locale),
      },
      stage: 'assessment',
    };
  }

  if (!context.profileCompletedAt) {
    return {
      ...base,
      stage: 'profile',
    };
  }

  const [result] = await database
    .select({
      correctCount: assessmentResults.correctCount,
      level: assessmentResults.level,
      levelBreakdown: assessmentResults.levelBreakdown,
      score: assessmentResults.score,
      totalQuestions: assessmentResults.totalQuestions,
    })
    .from(assessmentResults)
    .where(eq(assessmentResults.attemptId, context.attemptId))
    .limit(1);

  if (!result) {
    throw new PublicFlowError('assessment_result_unavailable', 409);
  }

  const [appointment] = await database
    .select({
      id: appointmentRequests.id,
      status: appointmentRequests.status,
      timezone: appointmentRequests.timezone,
    })
    .from(appointmentRequests)
    .where(eq(appointmentRequests.inquiryId, context.inquiryId))
    .orderBy(desc(appointmentRequests.createdAt))
    .limit(1);

  const preferences = appointment
    ? await database
        .select({ startsAt: appointmentPreferences.startsAt })
        .from(appointmentPreferences)
        .where(eq(appointmentPreferences.requestId, appointment.id))
        .orderBy(asc(appointmentPreferences.rank))
    : [];

  return {
    ...base,
    appointment: appointment
      ? {
          preferences: preferences.map((item) => item.startsAt.toISOString()),
          status: appointment.status,
          timezone: appointment.timezone,
        }
      : undefined,
    result,
    stage: 'result',
  };
}

export async function getPublicAssessmentState(
  token: string,
  locale: PublicAssessmentLocale,
) {
  const context = await getAttemptContext(token);
  return context ? buildState(context, locale) : null;
}

export type PublicLeadKind = 'program' | 'callback';

export type CreatePublicLeadInput = {
  attribution?: Record<string, string>;
  contactWindow?: string;
  email: string;
  firstName: string;
  idempotencyKey: string;
  kind: PublicLeadKind;
  language?: PublicAssessmentLanguage;
  lastName: string;
  learningGoal?: string;
  lessonModel?: string;
  locale: PublicAssessmentLocale;
  marketingConsent?: boolean;
  phone: string;
  programId?: string;
  referrer?: string;
};

// Low-friction lead capture (program "bilgi al" + "sizi arayalım" callback).
// Lands in the same candidate pool as the assessment funnel, with a distinct
// source and — for program inquiries — the program tagged on the inquiry.
export async function createPublicLead(
  input: CreatePublicLeadInput,
  maskedIp: string | undefined,
): Promise<{ ok: true }> {
  const email = normalizeEmail(input.email);
  const phone = input.phone.trim();
  const normalizedPhone = normalizePhone(input.phone);
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const now = new Date();
  const source =
    input.kind === 'program' ? 'program_inquiry' : 'callback_request';
  const contactWindow =
    input.kind === 'callback'
      ? input.contactWindow?.trim() || undefined
      : undefined;

  let language: string = input.language ?? 'english';
  let programId: string | undefined;
  let programName: string | undefined;
  if (input.kind === 'program' && input.programId) {
    const [program] = await database
      .select({
        id: programs.id,
        language: programs.language,
        name: programs.name,
      })
      .from(programs)
      .where(
        and(
          eq(programs.id, input.programId),
          eq(programs.publicVisible, true),
        ),
      )
      .limit(1);
    if (program) {
      programId = program.id;
      programName = program.name;
      language = program.language ?? language;
    }
  }

  let created = false;
  await database.transaction(async (transaction) => {
    const [contact] = await transaction
      .insert(contacts)
      .values({
        contactWindow,
        email: input.email.trim(),
        firstName,
        lastName,
        learningGoal: input.learningGoal,
        lessonModel: input.lessonModel,
        marketingConsent: input.marketingConsent ?? false,
        normalizedEmail: email,
        normalizedPhone,
        phone,
        preferredContactChannel: 'phone',
      })
      .onConflictDoUpdate({
        set: {
          contactWindow: contactWindow ?? sql`${contacts.contactWindow}`,
          learningGoal: input.learningGoal ?? sql`${contacts.learningGoal}`,
          lessonModel: input.lessonModel ?? sql`${contacts.lessonModel}`,
          normalizedPhone,
          phone,
          updatedAt: now,
        },
        target: contacts.normalizedEmail,
      })
      .returning({ id: contacts.id });
    if (!contact) {
      throw new PublicFlowError('candidate_could_not_be_created', 409);
    }

    const [candidate] = await transaction
      .insert(candidateProfiles)
      .values({ contactId: contact.id, lastActivityAt: now })
      .onConflictDoUpdate({
        set: { lastActivityAt: now, updatedAt: now },
        target: candidateProfiles.contactId,
      })
      .returning({ id: candidateProfiles.id });
    if (!candidate) {
      throw new PublicFlowError('candidate_could_not_be_created', 409);
    }

    const [inquiry] = await transaction
      .insert(candidateInquiries)
      .values({
        attribution: input.attribution ?? {},
        candidateId: candidate.id,
        formVersion: FORM_VERSION,
        idempotencyKey: input.idempotencyKey,
        language,
        locale: input.locale,
        programId,
        referrer: input.referrer,
        source,
      })
      .onConflictDoNothing({ target: candidateInquiries.idempotencyKey })
      .returning({ id: candidateInquiries.id });
    if (!inquiry) {
      // Duplicate submission (same idempotency key) — already captured.
      return;
    }
    created = true;

    await transaction.insert(candidateConsents).values([
      {
        accepted: true,
        contactId: contact.id,
        inquiryId: inquiry.id,
        locale: input.locale,
        maskedIp,
        textSnapshot: consentCopy(input.locale),
        type: 'candidate_notice',
        version: CONSENT_VERSION,
      },
      {
        accepted: input.marketingConsent ?? false,
        contactId: contact.id,
        inquiryId: inquiry.id,
        locale: input.locale,
        maskedIp,
        textSnapshot:
          input.locale === 'tr'
            ? 'Haber ve duyuruları e-posta yoluyla almak istiyorum.'
            : 'I would like to receive news and announcements by email.',
        type: 'marketing_email',
        version: CONSENT_VERSION,
      },
    ]);

    await transaction.insert(candidateActivities).values([
      {
        candidateId: candidate.id,
        inquiryId: inquiry.id,
        metadata: { kind: input.kind, source },
        type: 'candidate.inquiry_received',
      },
    ]);

    // Fresh unowned lead → pool task so somebody makes the first touch.
    const [profile] = await transaction
      .select({
        advisorId: candidateProfiles.advisorId,
        stage: candidateProfiles.stage,
      })
      .from(candidateProfiles)
      .where(eq(candidateProfiles.id, candidate.id))
      .limit(1);
    if (profile && !profile.advisorId && profile.stage === 'new') {
      await transaction
        .insert(advisorTasks)
        .values({
          assigneeUserId: null,
          candidateId: candidate.id,
          kind: 'first_contact',
          visibility: 'staff',
        })
        .onConflictDoNothing();
    }
  });

  if (created) {
    await notifyLeadReceived({
      email: input.email.trim(),
      firstName,
      idempotencyKey: input.idempotencyKey,
      kind: input.kind,
      lastName,
      locale: input.locale,
      programName,
    });
  }

  return { ok: true };
}

export async function startPublicAssessment(
  input: StartAssessmentInput,
  existingToken: string | undefined,
  maskedIp: string | undefined,
) {
  if (existingToken && !input.restart) {
    const existing = await getAttemptContext(existingToken);

    if (existing) {
      return {
        expiresAt: existing.expiresAt,
        state: await buildState(existing, input.locale),
        token: existingToken,
      };
    }
  }

  const email = normalizeEmail(input.email);
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ATTEMPT_TTL_MS);
  const continuation = createOpaqueToken();

  const created = await database.transaction(async (transaction) => {
    const [contact] = await transaction
      .insert(contacts)
      .values({
        email: input.email.trim(),
        firstName,
        lastName,
        marketingConsent: input.marketingConsent,
        normalizedEmail: email,
      })
      .onConflictDoUpdate({
        set: {
          // An unverified repeat submission must not opt an existing contact
          // into marketing communication.
          marketingConsent: sql`${contacts.marketingConsent}`,
          updatedAt: now,
        },
        target: contacts.normalizedEmail,
      })
      .returning({
        id: contacts.id,
      });

    if (!contact) {
      throw new PublicFlowError('candidate_could_not_be_created', 409);
    }

    const [existingCandidate] = await transaction
      .select({ id: candidateProfiles.id })
      .from(candidateProfiles)
      .where(eq(candidateProfiles.contactId, contact.id))
      .limit(1);

    const [candidate] = await transaction
      .insert(candidateProfiles)
      .values({
        contactId: contact.id,
        lastActivityAt: now,
      })
      .onConflictDoUpdate({
        set: {
          lastActivityAt: now,
          updatedAt: now,
        },
        target: candidateProfiles.contactId,
      })
      .returning({ id: candidateProfiles.id });

    if (!candidate) {
      throw new PublicFlowError('candidate_could_not_be_created', 409);
    }

    const [assessment] = await transaction
      .select({
        questionCount: assessmentVersions.questionCount,
        versionId: assessmentVersions.id,
      })
      .from(assessments)
      .innerJoin(
        assessmentVersions,
        eq(assessmentVersions.assessmentId, assessments.id),
      )
      .where(
        and(
          eq(assessments.language, input.language),
          eq(assessments.active, true),
          eq(assessmentVersions.status, 'published'),
        ),
      )
      .orderBy(desc(assessmentVersions.version))
      .limit(1);

    if (!assessment) {
      throw new PublicFlowError('assessment_unavailable', 409);
    }

    const [inquiry] = await transaction
      .insert(candidateInquiries)
      .values({
        attribution: input.attribution ?? {},
        candidateId: candidate.id,
        formVersion: FORM_VERSION,
        idempotencyKey: input.idempotencyKey,
        language: input.language,
        locale: input.locale,
        referrer: input.referrer,
      })
      .returning({ id: candidateInquiries.id });

    if (!inquiry) {
      throw new PublicFlowError('application_could_not_be_created', 409);
    }

    const [attempt] = await transaction
      .insert(assessmentAttempts)
      .values({
        continuationTokenHash: continuation.hash,
        expiresAt,
        inquiryId: inquiry.id,
        versionId: assessment.versionId,
      })
      .returning({ id: assessmentAttempts.id });

    if (!attempt) {
      throw new PublicFlowError('assessment_could_not_be_started', 409);
    }

    await transaction.insert(candidateConsents).values([
      {
        accepted: true,
        contactId: contact.id,
        inquiryId: inquiry.id,
        locale: input.locale,
        maskedIp,
        textSnapshot: consentCopy(input.locale),
        type: 'candidate_notice',
        version: CONSENT_VERSION,
      },
      {
        accepted: input.marketingConsent,
        contactId: contact.id,
        inquiryId: inquiry.id,
        locale: input.locale,
        maskedIp,
        textSnapshot:
          input.locale === 'tr'
            ? 'Haber ve duyuruları e-posta yoluyla almak istiyorum.'
            : 'I would like to receive news and announcements by email.',
        type: 'marketing_email',
        version: CONSENT_VERSION,
      },
    ]);

    await transaction.insert(candidateActivities).values([
      ...(!existingCandidate
        ? [
            {
              candidateId: candidate.id,
              inquiryId: inquiry.id,
              metadata: {
                language: input.language,
                source: 'public_level_test',
              },
              type: 'candidate.created_from_public_assessment',
            },
          ]
        : []),
      {
        candidateId: candidate.id,
        inquiryId: inquiry.id,
        metadata: {
          language: input.language,
          source: 'public_level_test',
        },
        type: 'candidate.inquiry_received',
      },
    ]);

    if (!existingCandidate) {
      await transaction
        .insert(advisorTasks)
        .values({
          assigneeUserId: null,
          candidateId: candidate.id,
          kind: 'first_contact',
          visibility: 'staff',
        })
        .onConflictDoNothing();
    }

    return attempt.id;
  });

  const context = await getAttemptContext(continuation.token);

  if (!created || !context) {
    throw new PublicFlowError('assessment_could_not_be_started', 409);
  }

  return {
    expiresAt,
    state: await buildState(context, input.locale),
    token: continuation.token,
  };
}

export async function answerPublicAssessment(
  token: string,
  questionId: string,
  optionId: string,
  locale: PublicAssessmentLocale,
) {
  const context = await requireAttemptContext(token);

  await database.transaction(async (transaction) => {
    const [lockedAttempt] = await transaction
      .select({
        currentQuestionOrder: assessmentAttempts.currentQuestionOrder,
        status: assessmentAttempts.status,
      })
      .from(assessmentAttempts)
      .where(eq(assessmentAttempts.id, context.attemptId))
      .limit(1)
      .for('update');

    if (!lockedAttempt || lockedAttempt.status === 'completed') {
      return;
    }

    const [question] = await transaction
      .select({
        id: assessmentQuestions.id,
        order: assessmentQuestions.order,
      })
      .from(assessmentQuestions)
      .where(
        and(
          eq(assessmentQuestions.id, questionId),
          eq(assessmentQuestions.versionId, context.versionId),
          eq(
            assessmentQuestions.order,
            lockedAttempt.currentQuestionOrder,
          ),
        ),
      )
      .limit(1);

    if (!question) {
      throw new PublicFlowError('invalid_assessment_question', 409);
    }

    const [option] = await transaction
      .select({
        id: assessmentOptions.id,
        isCorrect: assessmentOptions.isCorrect,
      })
      .from(assessmentOptions)
      .where(
        and(
          eq(assessmentOptions.id, optionId),
          eq(assessmentOptions.questionId, question.id),
        ),
      )
      .limit(1);

    if (!option) {
      throw new PublicFlowError('invalid_assessment_option', 409);
    }

    const [inserted] = await transaction
      .insert(assessmentAnswers)
      .values({
        attemptId: context.attemptId,
        isCorrect: option.isCorrect,
        optionId: option.id,
        questionId: question.id,
      })
      .onConflictDoNothing()
      .returning({ id: assessmentAnswers.id });

    if (!inserted) {
      return;
    }

    const completed = question.order >= context.questionCount;

    if (!completed) {
      await transaction
        .update(assessmentAttempts)
        .set({
          currentQuestionOrder: question.order + 1,
          lastActivityAt: new Date(),
          startedAt: sql`coalesce(${assessmentAttempts.startedAt}, now())`,
          status: 'in_progress',
          updatedAt: new Date(),
        })
        .where(eq(assessmentAttempts.id, context.attemptId));
      return;
    }

    const answers = await transaction
      .select({
        isCorrect: assessmentAnswers.isCorrect,
        level: assessmentQuestions.level,
      })
      .from(assessmentAnswers)
      .innerJoin(
        assessmentQuestions,
        eq(assessmentQuestions.id, assessmentAnswers.questionId),
      )
      .where(eq(assessmentAnswers.attemptId, context.attemptId));

    const levelBreakdown = Object.fromEntries(
      LEVELS.map((level) => [
        level,
        {
          correct: answers.filter(
            (answer) => answer.level === level && answer.isCorrect,
          ).length,
          total: answers.filter((answer) => answer.level === level).length,
        },
      ]),
    );
    const correctCount = answers.filter((answer) => answer.isCorrect).length;
    const score = Math.round((correctCount / context.questionCount) * 100);
    let level = 'A1';

    for (const candidateLevel of LEVELS) {
      if (levelBreakdown[candidateLevel].correct < 2) {
        break;
      }
      level = candidateLevel;
    }

    await transaction.insert(assessmentResults).values({
      attemptId: context.attemptId,
      correctCount,
      level,
      levelBreakdown,
      score,
      totalQuestions: context.questionCount,
    });

    await transaction
      .update(assessmentAttempts)
      .set({
        completedAt: new Date(),
        currentQuestionOrder: context.questionCount,
        lastActivityAt: new Date(),
        resultLevel: level,
        score,
        startedAt: sql`coalesce(${assessmentAttempts.startedAt}, now())`,
        status: 'completed',
        updatedAt: new Date(),
      })
      .where(eq(assessmentAttempts.id, context.attemptId));

    const now = new Date();
    await Promise.all([
      transaction.insert(candidateActivities).values({
        candidateId: context.candidateId,
        inquiryId: context.inquiryId,
        metadata: { level, score },
        type: 'candidate.assessment_completed',
      }),
      transaction
        .update(candidateProfiles)
        .set({ lastActivityAt: now, updatedAt: now })
        .where(eq(candidateProfiles.id, context.candidateId)),
    ]);
  });

  return buildState(await requireAttemptContext(token), locale);
}

export async function completePublicCandidateProfile(
  token: string,
  input: CompleteProfileInput,
  locale: PublicAssessmentLocale,
) {
  const context = await requireAttemptContext(token);

  if (context.status !== 'completed') {
    throw new PublicFlowError('assessment_not_completed', 409);
  }

  const phone = input.phone.trim();
  const normalizedPhone = normalizePhone(phone);
  const now = new Date();

  await database.transaction(async (transaction) => {
    await transaction
      .update(contacts)
      .set({
        city: input.city?.trim() || null,
        contactWindow: input.contactWindow?.trim() || null,
        isMinor: input.isMinor,
        learningGoal: input.learningGoal,
        lessonModel: input.lessonModel?.trim() || null,
        normalizedPhone,
        phone,
        phoneOwner: input.isMinor ? 'guardian' : 'candidate',
        preferredContactChannel: input.preferredContactChannel,
        timezone: input.timezone,
        updatedAt: now,
      })
      .where(eq(contacts.id, context.contactId));

    await transaction
      .update(candidateInquiries)
      .set({
        profileCompletedAt: now,
        status: 'completed',
        updatedAt: now,
      })
      .where(eq(candidateInquiries.id, context.inquiryId));

    await transaction
      .update(assessmentAttempts)
      .set({
        profileCompletedAt: now,
        updatedAt: now,
      })
      .where(eq(assessmentAttempts.id, context.attemptId));

    await transaction
      .update(candidateProfiles)
      .set({
        lastActivityAt: now,
        updatedAt: now,
      })
      .where(eq(candidateProfiles.id, context.candidateId));

    await transaction.insert(candidateActivities).values({
      candidateId: context.candidateId,
      inquiryId: context.inquiryId,
      metadata: {
        contactChannel: input.preferredContactChannel,
        isMinor: input.isMinor,
      },
      type: 'candidate.profile_completed',
    });
  });

  return buildState(await requireAttemptContext(token), locale);
}

export async function requestPublicAppointment(
  token: string,
  timezone: string,
  preferenceValues: string[],
  locale: PublicAssessmentLocale,
) {
  const context = await requireAttemptContext(token);

  if (context.status !== 'completed' || !context.profileCompletedAt) {
    throw new PublicFlowError('candidate_profile_incomplete', 409);
  }

  const preferences = preferenceValues.map((value) => new Date(value));
  const now = Date.now();
  const latestAllowed = now + 180 * 24 * 60 * 60 * 1000;

  if (
    preferences.length !== 3 ||
    preferences.some(
      (value) =>
        Number.isNaN(value.getTime()) ||
        value.getTime() <= now ||
        value.getTime() > latestAllowed,
    ) ||
    new Set(preferences.map((value) => value.toISOString())).size !== 3
  ) {
    throw new PublicFlowError('invalid_appointment_preferences');
  }

  const [existing] = await database
    .select({ id: appointmentRequests.id })
    .from(appointmentRequests)
    .where(
      and(
        eq(appointmentRequests.inquiryId, context.inquiryId),
        inArray(appointmentRequests.status, ['requested', 'scheduled']),
      ),
    )
    .limit(1);

  if (!existing) {
    await database.transaction(async (transaction) => {
      const [result] = await transaction
        .select({ id: assessmentResults.id })
        .from(assessmentResults)
        .where(eq(assessmentResults.attemptId, context.attemptId))
        .limit(1);

      const [request] = await transaction
        .insert(appointmentRequests)
        .values({
          assessmentResultId: result?.id,
          candidateId: context.candidateId,
          inquiryId: context.inquiryId,
          timezone,
        })
        .returning({ id: appointmentRequests.id });

      if (!request) {
        throw new PublicFlowError('appointment_could_not_be_requested', 409);
      }

      await transaction.insert(appointmentPreferences).values(
        preferences.map((startsAt, index) => ({
          rank: index + 1,
          requestId: request.id,
          startsAt,
        })),
      );

      const activityAt = new Date();
      const [ownerProfile] = await transaction
        .select({ advisorId: candidateProfiles.advisorId })
        .from(candidateProfiles)
        .where(eq(candidateProfiles.id, context.candidateId))
        .limit(1);
      await Promise.all([
        transaction.insert(candidateActivities).values({
          candidateId: context.candidateId,
          inquiryId: context.inquiryId,
          metadata: { preferenceCount: 3, timezone },
          type: 'candidate.appointment_requested',
        }),
        transaction
          .update(candidateProfiles)
          .set({ lastActivityAt: activityAt, updatedAt: activityAt })
          .where(eq(candidateProfiles.id, context.candidateId)),
        // The lead picked times → answering this is now a work item: the
        // owner's if the candidate has one, otherwise the shared pool's.
        transaction
          .insert(advisorTasks)
          .values({
            appointmentId: request.id,
            assigneeUserId: ownerProfile?.advisorId ?? null,
            candidateId: context.candidateId,
            dueAt: preferences[0] ?? null,
            kind: 'appointment_request',
            visibility: 'staff',
          })
          .onConflictDoNothing(),
      ]);
    });
  }

  return buildState(await requireAttemptContext(token), locale);
}
