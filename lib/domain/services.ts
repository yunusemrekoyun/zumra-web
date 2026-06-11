import {
  workspaceLeads,
  workspaceLessons,
  workspaceMeetings,
  workspaceOffers,
  workspacePayments,
  workspaceReportLanguageStats,
  workspaceReminders,
  workspaceStudentProgressSummaries,
  workspaceStudentTimelineEvents,
  workspaceStudents,
  workspaceUsers,
} from './mock-data';
import type {
  CommunicationChannel,
  Lead,
  Lesson,
  Meeting,
  MeetingChannel,
  Offer,
  PaymentTransaction,
  Reminder,
  ReportLanguageStat,
  StudentProfile,
  StudentProgressSummary,
  StudentTimelineEvent,
  User,
} from './types';

export type MeetingLinkInput = {
  channel: MeetingChannel;
  meetingId: string;
  title: string;
};

export type MeetingLinkResult = {
  link: string;
  qrPayload: string;
};

export type NotificationResult = {
  externalId: string;
  queuedAt: string;
};

export type OfferNotificationInput = {
  channels: CommunicationChannel[];
  offerId: string;
  recipientEmail?: string;
  recipientPhone?: string;
};

export type ReminderNotificationInput = {
  channels: CommunicationChannel[];
  meetingId: string;
  recipientUserId: string;
  scheduledAt: string;
};

export type StudentImportPreviewRow = {
  email?: string;
  errors: string[];
  fullName?: string;
  language?: string;
  phone?: string;
  status: 'valid' | 'warning' | 'invalid';
};

export type StudentImportPreview = {
  rows: StudentImportPreviewRow[];
  totalRows: number;
  validRows: number;
};

export interface WorkspaceDataService {
  getUsers(): Promise<User[]>;
  getStudents(): Promise<StudentProfile[]>;
  getLeads(): Promise<Lead[]>;
  getLessons(): Promise<Lesson[]>;
  getMeetings(): Promise<Meeting[]>;
  getOffers(): Promise<Offer[]>;
  getPayments(): Promise<PaymentTransaction[]>;
  getReportLanguageStats(): Promise<ReportLanguageStat[]>;
  getReminders(): Promise<Reminder[]>;
  getStudentProgressSummaries(): Promise<StudentProgressSummary[]>;
  getStudentTimelineEvents(): Promise<StudentTimelineEvent[]>;
}

export interface MeetingService {
  createMeetingLink(input: MeetingLinkInput): Promise<MeetingLinkResult>;
}

export interface WorkspaceMessagingService {
  sendOffer(input: OfferNotificationInput): Promise<NotificationResult>;
  sendMeetingReminder(input: ReminderNotificationInput): Promise<NotificationResult>;
}

export interface StudentImportService {
  preview(file: File): Promise<StudentImportPreview>;
  import(preview: StudentImportPreview): Promise<{ importedRows: number }>;
}

export const mockWorkspaceDataService: WorkspaceDataService = {
  async getUsers() {
    return workspaceUsers;
  },
  async getStudents() {
    return workspaceStudents;
  },
  async getLeads() {
    return workspaceLeads;
  },
  async getLessons() {
    return workspaceLessons;
  },
  async getMeetings() {
    return workspaceMeetings;
  },
  async getOffers() {
    return workspaceOffers;
  },
  async getPayments() {
    return workspacePayments;
  },
  async getReportLanguageStats() {
    return workspaceReportLanguageStats;
  },
  async getReminders() {
    return workspaceReminders;
  },
  async getStudentProgressSummaries() {
    return workspaceStudentProgressSummaries;
  },
  async getStudentTimelineEvents() {
    return workspaceStudentTimelineEvents;
  },
};

export const mockMeetingService: MeetingService = {
  async createMeetingLink(input) {
    const slug = input.title
      .toLocaleLowerCase('tr-TR')
      .replace(/[^a-z0-9ğüşöçıİ\s-]/gi, '')
      .trim()
      .replace(/\s+/g, '-');

    return {
      link: `https://meet.zumraakademi.com/${slug || input.meetingId}`,
      qrPayload: `zumra:meeting:${input.meetingId}`,
    };
  },
};

export const mockNotificationService: WorkspaceMessagingService = {
  async sendOffer(input) {
    return {
      externalId: `mock-offer-${input.offerId}-${input.channels.join('-')}`,
      queuedAt: new Date().toISOString(),
    };
  },
  async sendMeetingReminder(input) {
    return {
      externalId: `mock-reminder-${input.meetingId}-${input.recipientUserId}`,
      queuedAt: new Date().toISOString(),
    };
  },
};
