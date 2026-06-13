import 'server-only';

import { desc, eq, inArray } from 'drizzle-orm';
import { database } from '@/lib/server/db/client';
import {
  appointmentRequests,
  assessmentAttempts,
  candidateInquiries,
  candidateProfiles,
  contacts,
  users,
} from '@/lib/server/db/schema';

export type CandidateDirectoryRecord = {
  advisorName?: string;
  applicationCount: number;
  appointmentStatus?: string;
  assessmentStatus: 'completed' | 'in_progress' | 'not_started';
  communicationComplete: boolean;
  email: string;
  fullName: string;
  id: string;
  language?: string;
  lastActivityAt: string;
  lastActivityMinutesAgo: number;
  locale?: string;
  phone?: string;
  resultLevel?: string;
  score?: number;
  source?: string;
  stage: string;
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
      lastActivityAt: candidateProfiles.lastActivityAt,
      lastName: contacts.lastName,
      phone: contacts.phone,
      stage: candidateProfiles.stage,
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
          inquiryId: appointmentRequests.inquiryId,
          status: appointmentRequests.status,
        })
        .from(appointmentRequests)
        .where(inArray(appointmentRequests.inquiryId, inquiryIds))
        .orderBy(desc(appointmentRequests.createdAt))
    : [];

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

    return {
      advisorName: candidate.advisorName ?? undefined,
      applicationCount: candidateInquiriesList.length,
      appointmentStatus: latestAppointment?.status,
      assessmentStatus: latestAttempt?.status ?? 'not_started',
      communicationComplete: Boolean(candidate.phone),
      email: candidate.email,
      fullName: `${candidate.firstName} ${candidate.lastName}`.trim(),
      id: candidate.id,
      language: latestInquiry?.language,
      lastActivityAt: candidate.lastActivityAt.toISOString(),
      lastActivityMinutesAgo: Math.max(
        0,
        Math.floor(
          (generatedAt - candidate.lastActivityAt.getTime()) / 60_000,
        ),
      ),
      locale: latestInquiry?.locale,
      phone: candidate.phone ?? undefined,
      resultLevel: latestAttempt?.resultLevel ?? undefined,
      score: latestAttempt?.score ?? undefined,
      source: latestInquiry?.source,
      stage: candidate.stage,
    };
  });
}
