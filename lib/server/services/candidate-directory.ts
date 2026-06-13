import 'server-only';

import { and, desc, eq, inArray } from 'drizzle-orm';
import { database } from '@/lib/server/db/client';
import {
  appointmentPreferences,
  appointmentRequests,
  assessmentAttempts,
  candidateActivities,
  candidateInquiries,
  candidateProfiles,
  contacts,
  enrollmentDrafts,
  studentProfiles,
  users,
} from '@/lib/server/db/schema';

export type CandidateDirectoryRecord = {
  activeEnrollmentDraft?: {
    id: string;
    status: string;
  };
  activities: Array<{
    occurredAt: string;
    type: string;
  }>;
  advisorName?: string;
  applicationCount: number;
  appointmentPreferences: Array<{
    rank: number;
    startsAt: string;
  }>;
  appointmentStatus?: string;
  assessmentStatus: 'completed' | 'in_progress' | 'not_started';
  city?: string;
  communicationComplete: boolean;
  email: string;
  fullName: string;
  id: string;
  isMinor: boolean;
  language?: string;
  lastActivityAt: string;
  lastActivityMinutesAgo: number;
  learningGoal?: string;
  locale?: string;
  phone?: string;
  preferredContactChannel?: string;
  resultLevel?: string;
  score?: number;
  source?: string;
  stage: string;
  studentId?: string;
  timezone?: string;
};

export async function listCandidateDirectory(): Promise<
  CandidateDirectoryRecord[]
> {
  const generatedAt = Date.now();
  const candidates = await database
    .select({
      advisorName: users.name,
      email: contacts.email,
      firstName: contacts.firstName,
      id: candidateProfiles.id,
      isMinor: contacts.isMinor,
      lastActivityAt: candidateProfiles.lastActivityAt,
      lastName: contacts.lastName,
      learningGoal: contacts.learningGoal,
      phone: contacts.phone,
      preferredContactChannel: contacts.preferredContactChannel,
      stage: candidateProfiles.stage,
      timezone: contacts.timezone,
      city: contacts.city,
    })
    .from(candidateProfiles)
    .innerJoin(contacts, eq(contacts.id, candidateProfiles.contactId))
    .leftJoin(users, eq(users.id, candidateProfiles.advisorId))
    .orderBy(desc(candidateProfiles.lastActivityAt));

  if (!candidates.length) {
    return [];
  }

  const candidateIds = candidates.map((candidate) => candidate.id);
  const inquiries = await database
    .select({
      candidateId: candidateInquiries.candidateId,
      createdAt: candidateInquiries.createdAt,
      id: candidateInquiries.id,
      language: candidateInquiries.language,
      locale: candidateInquiries.locale,
      source: candidateInquiries.source,
    })
    .from(candidateInquiries)
    .where(inArray(candidateInquiries.candidateId, candidateIds))
    .orderBy(desc(candidateInquiries.createdAt));

  const inquiryIds = inquiries.map((inquiry) => inquiry.id);
  const attempts = inquiryIds.length
    ? await database
        .select({
          inquiryId: assessmentAttempts.inquiryId,
          resultLevel: assessmentAttempts.resultLevel,
          score: assessmentAttempts.score,
          status: assessmentAttempts.status,
        })
        .from(assessmentAttempts)
        .where(inArray(assessmentAttempts.inquiryId, inquiryIds))
        .orderBy(desc(assessmentAttempts.createdAt))
    : [];
  const appointments = inquiryIds.length
    ? await database
        .select({
          id: appointmentRequests.id,
          inquiryId: appointmentRequests.inquiryId,
          status: appointmentRequests.status,
        })
        .from(appointmentRequests)
        .where(inArray(appointmentRequests.inquiryId, inquiryIds))
        .orderBy(desc(appointmentRequests.createdAt))
    : [];
  const appointmentIds = appointments.map((appointment) => appointment.id);
  const [preferences, activities, drafts, students] = await Promise.all([
    appointmentIds.length
      ? database
          .select({
            rank: appointmentPreferences.rank,
            requestId: appointmentPreferences.requestId,
            startsAt: appointmentPreferences.startsAt,
          })
          .from(appointmentPreferences)
          .where(inArray(appointmentPreferences.requestId, appointmentIds))
          .orderBy(appointmentPreferences.rank)
      : Promise.resolve([]),
    database
      .select({
        candidateId: candidateActivities.candidateId,
        occurredAt: candidateActivities.occurredAt,
        type: candidateActivities.type,
      })
      .from(candidateActivities)
      .where(inArray(candidateActivities.candidateId, candidateIds))
      .orderBy(desc(candidateActivities.occurredAt)),
    database
      .select({
        candidateId: enrollmentDrafts.candidateId,
        id: enrollmentDrafts.id,
        status: enrollmentDrafts.status,
      })
      .from(enrollmentDrafts)
      .where(
        and(
          inArray(enrollmentDrafts.candidateId, candidateIds),
          inArray(enrollmentDrafts.status, [
            'draft',
            'review_required',
            'ready',
          ]),
        ),
      ),
    database
      .select({
        candidateId: studentProfiles.candidateId,
        id: studentProfiles.id,
      })
      .from(studentProfiles)
      .where(inArray(studentProfiles.candidateId, candidateIds)),
  ]);

  return candidates.map((candidate) => {
    const candidateInquiriesList = inquiries.filter(
      (inquiry) => inquiry.candidateId === candidate.id,
    );
    const latestInquiry = candidateInquiriesList[0];
    const latestAttempt = attempts.find(
      (attempt) => attempt.inquiryId === latestInquiry?.id,
    );
    const latestAppointment = appointments.find(
      (appointment) => appointment.inquiryId === latestInquiry?.id,
    );
    const activeEnrollmentDraft = drafts.find(
      (draft) => draft.candidateId === candidate.id,
    );
    const student = students.find(
      (item) => item.candidateId === candidate.id,
    );

    return {
      activeEnrollmentDraft: activeEnrollmentDraft
        ? {
            id: activeEnrollmentDraft.id,
            status: activeEnrollmentDraft.status,
          }
        : undefined,
      activities: activities
        .filter((activity) => activity.candidateId === candidate.id)
        .slice(0, 12)
        .map((activity) => ({
          occurredAt: activity.occurredAt.toISOString(),
          type: activity.type,
        })),
      advisorName: candidate.advisorName ?? undefined,
      applicationCount: candidateInquiriesList.length,
      appointmentPreferences: latestAppointment
        ? preferences
            .filter(
              (preference) =>
                preference.requestId === latestAppointment.id,
            )
            .map((preference) => ({
              rank: preference.rank,
              startsAt: preference.startsAt.toISOString(),
            }))
        : [],
      appointmentStatus: latestAppointment?.status,
      assessmentStatus: latestAttempt?.status ?? 'not_started',
      city: candidate.city ?? undefined,
      communicationComplete: Boolean(candidate.phone),
      email: candidate.email,
      fullName: `${candidate.firstName} ${candidate.lastName}`.trim(),
      id: candidate.id,
      isMinor: candidate.isMinor,
      language: latestInquiry?.language,
      lastActivityAt: candidate.lastActivityAt.toISOString(),
      lastActivityMinutesAgo: Math.max(
        0,
        Math.floor(
          (generatedAt - candidate.lastActivityAt.getTime()) / 60_000,
        ),
      ),
      locale: latestInquiry?.locale,
      learningGoal: candidate.learningGoal ?? undefined,
      phone: candidate.phone ?? undefined,
      preferredContactChannel:
        candidate.preferredContactChannel ?? undefined,
      resultLevel: latestAttempt?.resultLevel ?? undefined,
      score: latestAttempt?.score ?? undefined,
      source: latestInquiry?.source,
      stage: candidate.stage,
      studentId: student?.id,
      timezone: candidate.timezone ?? undefined,
    };
  });
}
