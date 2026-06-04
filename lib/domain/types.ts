export type UserRole = 'admin' | 'advisor' | 'teacher' | 'student';

export type User = {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone?: string;
  role: UserRole;
  handle: string;
  title: string;
};

export type StudentStatus = 'active' | 'paused' | 'graduated' | 'candidate';
export type StudentProgramType = 'generalEducation';

export type StudentProfile = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  language: string;
  level: string;
  programType: StudentProgramType;
  status: StudentStatus;
  progress: number;
  advisorId: string;
  teacherIds: string[];
  nextSessionAt?: string;
};

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'meeting_scheduled'
  | 'offer_pending'
  | 'converted'
  | 'lost';

export type Lead = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  interestedProgram: string;
  level?: string;
  source: string;
  status: LeadStatus;
  advisorId: string;
  createdAt: string;
  lastActivityLabel: string;
};

export type LessonStatus = 'upcoming' | 'completed' | 'cancelled';

export type Lesson = {
  id: string;
  studentId: string;
  teacherId: string;
  title: string;
  topic: string;
  startsAt: string;
  status: LessonStatus;
};

export type MeetingStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';
export type MeetingChannel = 'zoom' | 'google_meet' | 'phone' | 'in_person';

export type Meeting = {
  id: string;
  title: string;
  studentId?: string;
  leadId?: string;
  advisorId: string;
  teacherId?: string;
  startsAt: string;
  channel: MeetingChannel;
  status: MeetingStatus;
  link?: string;
  qrPayload?: string;
};

export type OfferStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
export type CommunicationChannel = 'email' | 'whatsapp';

export type Offer = {
  id: string;
  title: string;
  leadId?: string;
  studentId?: string;
  advisorId: string;
  amount: number;
  currency: 'TRY';
  status: OfferStatus;
  channels: CommunicationChannel[];
  sentAt?: string;
};

export type PaymentStatus = 'paid' | 'pending' | 'failed';

export type PaymentTransaction = {
  id: string;
  studentId?: string;
  leadId?: string;
  payerName: string;
  planKey: string;
  amount: number;
  currency: 'TRY';
  paidAt: string;
  status: PaymentStatus;
};

export type ReportLanguageStat = {
  language: string;
  percentage: number;
  count: number;
  colorClass: string;
};

export type StudentProgressSkill = {
  key: 'speaking' | 'listening' | 'reading' | 'writing';
  icon: 'speaking' | 'listening' | 'reading' | 'writing';
  value: number;
  tone: 'brand' | 'blue' | 'emerald' | 'amber';
};

export type StudentProgressBadge = {
  earned: boolean;
};

export type StudentProgressSummary = {
  studentId: string;
  overall: number;
  completedLessons: number;
  totalLessons: number;
  streak: number;
  skills: StudentProgressSkill[];
  badges: StudentProgressBadge[];
};

export type StudentTimelineHomeworkState = 'assigned' | 'completed';

export type StudentTimelineEvent = {
  id: string;
  studentId: string;
  lessonId: string;
  noteKey: string;
  homeworkState: StudentTimelineHomeworkState;
  attachmentName?: string;
};

export type ReminderStatus = 'scheduled' | 'sent' | 'failed' | 'cancelled';

export type Reminder = {
  id: string;
  meetingId: string;
  recipientUserId: string;
  channel: CommunicationChannel;
  scheduledAt: string;
  status: ReminderStatus;
};

export type Assignment = {
  id: string;
  advisorId?: string;
  teacherId?: string;
  studentId?: string;
  leadId?: string;
};
