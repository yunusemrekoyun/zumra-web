import type { CalendarEventView } from '@/lib/server/services/lesson-schedules';

export function lessonTitle(event: CalendarEventView) {
  return event.kind === 'private_lesson'
    ? (event.programName ?? event.title)
    : event.title;
}

export function lessonCardProps(
  event: CalendarEventView,
  locale: string,
  status: 'completed' | 'upcoming',
) {
  const title = lessonTitle(event);
  const attendance = event.studentAttendance?.status;
  return {
    attendanceStatus:
      attendance && attendance !== 'needs_review' ? attendance : undefined,
    dateTime: formatEventDateTime(event, locale),
    instructor: event.instructorName ?? '',
    status,
    title,
    topic:
      event.kind === 'group_lesson' &&
      event.programName &&
      event.programName !== title
        ? event.programName
        : undefined,
  };
}

export function formatEventDateTime(event: CalendarEventView, locale: string) {
  const day = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${event.date}T12:00:00`));
  return `${day} • ${event.startTime}`;
}
