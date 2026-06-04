import { getVisibleLeads, getVisibleLessons, getVisibleStudents } from './access';
import { workspaceSeed } from './mock-data';
import { mockWorkspaceDataService } from './services';
import type {
  Lead,
  Lesson,
  Meeting,
  Offer,
  PaymentTransaction,
  Reminder,
  ReportLanguageStat,
  StudentProfile,
  StudentProgressSummary,
  StudentTimelineEvent,
  User,
  UserRole,
} from './types';

export type WorkspaceDashboardData = {
  currentUser: User;
  leads: Lead[];
  lessons: Lesson[];
  meetings: Meeting[];
  offers: Offer[];
  payments: PaymentTransaction[];
  reminders: Reminder[];
  students: StudentProfile[];
  users: User[];
};

export type WorkspaceStudentDetailData = {
  advisor?: User;
  lessons: Lesson[];
  meetings: Meeting[];
  offers: Offer[];
  payments: PaymentTransaction[];
  student: StudentProfile;
  teachers: User[];
  timeline: StudentTimelineEvent[];
};

export type WorkspaceReportsData = {
  currentUser: User;
  languageStats: ReportLanguageStat[];
};

const userIdByScope: Record<UserRole, string> = {
  admin: 'user-admin-yunus',
  advisor: 'user-advisor-aylin',
  student: 'user-student-zeynep',
  teacher: 'user-teacher-sarah',
};

export function getWorkspaceDataService() {
  return mockWorkspaceDataService;
}

export function getWorkspaceSnapshot() {
  return workspaceSeed;
}

export function getCurrentWorkspaceUser(scope: UserRole) {
  const user = workspaceSeed.users.find((item) => item.id === userIdByScope[scope]);

  if (!user) {
    throw new Error(`Missing mock workspace user for scope: ${scope}`);
  }

  return user;
}

export function getDashboardData(
  scope: UserRole,
  user = getCurrentWorkspaceUser(scope),
): WorkspaceDashboardData {
  if (scope === 'admin') {
    return {
      currentUser: user,
      leads: workspaceSeed.leads,
      lessons: workspaceSeed.lessons,
      meetings: workspaceSeed.meetings,
      offers: workspaceSeed.offers,
      payments: workspaceSeed.payments,
      reminders: workspaceSeed.reminders,
      students: workspaceSeed.students,
      users: workspaceSeed.users,
    };
  }

  const students = getVisibleStudents(user, workspaceSeed.students);
  const leads = getVisibleLeads(user, workspaceSeed.leads);
  const lessons = getVisibleLessons(user, workspaceSeed.lessons, workspaceSeed.students);
  const studentIds = new Set(students.map((student) => student.id));
  const leadIds = new Set(leads.map((lead) => lead.id));
  const meetings = workspaceSeed.meetings.filter((meeting) =>
    meeting.advisorId === user.id ||
    meeting.teacherId === user.id ||
    Boolean(meeting.studentId && studentIds.has(meeting.studentId)) ||
    Boolean(meeting.leadId && leadIds.has(meeting.leadId)),
  );
  const offers = workspaceSeed.offers.filter((offer) =>
    offer.advisorId === user.id ||
    Boolean(offer.studentId && studentIds.has(offer.studentId)) ||
    Boolean(offer.leadId && leadIds.has(offer.leadId)),
  );

  return {
    currentUser: user,
    leads,
    lessons,
    meetings,
    offers,
    payments: getVisiblePayments(user, students, leads),
    reminders: workspaceSeed.reminders.filter((reminder) => reminder.recipientUserId === user.id),
    students,
    users: workspaceSeed.users,
  };
}

export function getStudentDetailData(
  scope: UserRole,
  user: User | undefined,
  studentId: string,
): WorkspaceStudentDetailData | null {
  const currentUser = user ?? getCurrentWorkspaceUser(scope);
  const resolvedStudentId = resolveStudentId(studentId);
  const student = workspaceSeed.students.find((item) => item.id === resolvedStudentId);

  if (!student || !canSeeStudent(currentUser, student)) {
    return null;
  }

  const teachers = workspaceSeed.users.filter((item) => student.teacherIds.includes(item.id));

  return {
    advisor: workspaceSeed.users.find((item) => item.id === student.advisorId),
    lessons: workspaceSeed.lessons.filter((lesson) => lesson.studentId === student.id),
    meetings: workspaceSeed.meetings.filter((meeting) => meeting.studentId === student.id),
    offers: workspaceSeed.offers.filter((offer) => offer.studentId === student.id),
    payments: workspaceSeed.payments.filter((payment) => payment.studentId === student.id),
    student,
    teachers,
    timeline: workspaceSeed.studentTimelineEvents.filter((event) => event.studentId === student.id),
  };
}

export function getReportsData(
  scope: UserRole,
  user = getCurrentWorkspaceUser(scope),
): WorkspaceReportsData {
  return {
    currentUser: user,
    languageStats: scope === 'admin' || scope === 'advisor'
      ? workspaceSeed.reportLanguageStats
      : [],
  };
}

export function getStudentProgressData(
  scope: UserRole,
  user = getCurrentWorkspaceUser(scope),
  studentId?: string,
): StudentProgressSummary | null {
  const students = getVisibleStudents(user, workspaceSeed.students);
  const resolvedStudentId = studentId ? resolveStudentId(studentId) : students[0]?.id;

  if (!resolvedStudentId || !students.some((student) => student.id === resolvedStudentId)) {
    return null;
  }

  return workspaceSeed.studentProgressSummaries.find((summary) => summary.studentId === resolvedStudentId) ?? null;
}

function getVisiblePayments(
  user: User,
  students: StudentProfile[],
  leads: Lead[],
): PaymentTransaction[] {
  if (user.role === 'teacher') {
    return [];
  }

  const studentIds = new Set(students.map((student) => student.id));
  const leadIds = new Set(leads.map((lead) => lead.id));

  return workspaceSeed.payments.filter((payment) =>
    Boolean(payment.studentId && studentIds.has(payment.studentId)) ||
    Boolean(payment.leadId && leadIds.has(payment.leadId)),
  );
}

function canSeeStudent(user: User, student: StudentProfile) {
  if (user.role === 'admin') {
    return true;
  }

  if (user.role === 'advisor') {
    return student.advisorId === user.id;
  }

  if (user.role === 'teacher') {
    return student.teacherIds.includes(user.id);
  }

  return student.userId === user.id;
}

function resolveStudentId(studentId: string) {
  return studentId === '1' ? 'student-zeynep' : studentId;
}
