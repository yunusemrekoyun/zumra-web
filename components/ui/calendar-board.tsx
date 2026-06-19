import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Send,
  Users,
  Video,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  CalendarEventKind,
  CalendarEventStatus,
  CalendarEventView,
} from '@/lib/server/services/lesson-schedules';
import { ModulePanel } from './module-panel';
import { StatusChip } from './status-chip';

type CalendarMeetingStatus = NonNullable<CalendarEventView['meetingStatus']>;

type CalendarBoardLabels = {
  absenceNotePlaceholder: string;
  absenceReported: string;
  agendaTitle: string;
  connectGoogle: string;
  detailView: string;
  emptyDescription: string;
  emptyTitle: string;
  eventKinds: Record<CalendarEventKind, string>;
  hoverHint: string;
  joinLesson: string;
  legendTitle: string;
  meetingAttempts?: (count: number) => string;
  meetingLastError?: string;
  meetingStatuses: Record<CalendarMeetingStatus, string>;
  monthView: string;
  moreEvents: (count: number) => string;
  nextMonth: string;
  noEventsInMonth: string;
  previousMonth: string;
  reportAbsence: string;
  retryMeeting: string;
  status: Record<CalendarEventStatus, string>;
  studentCount: (count: number) => string;
};

type CalendarBoardProps = {
  currentMonth?: string;
  events: CalendarEventView[];
  labels: CalendarBoardLabels;
  locale: string;
  returnPath?: string;
};

const kindStyles: Record<
  CalendarEventKind,
  {
    accent: string;
    chip: string;
    dot: string;
    soft: string;
  }
> = {
  appointment: {
    accent: 'border-l-amber-400',
    chip: 'border-amber-500/20 bg-amber-50 text-amber-700',
    dot: 'bg-amber-400',
    soft: 'bg-amber-50 text-amber-700',
  },
  group_lesson: {
    accent: 'border-l-[#533089]',
    chip: 'border-[#533089]/20 bg-[#533089]/7 text-[#533089]',
    dot: 'bg-[#533089]',
    soft: 'bg-[#533089]/7 text-[#533089]',
  },
  private_lesson: {
    accent: 'border-l-blue-500',
    chip: 'border-blue-500/20 bg-blue-50 text-blue-700',
    dot: 'bg-blue-500',
    soft: 'bg-blue-50 text-blue-700',
  },
};

export function CalendarBoard({
  currentMonth,
  events,
  labels,
  locale,
  returnPath,
}: CalendarBoardProps) {
  const sortedEvents = [...events].sort(compareCalendarEvents);
  const monthStart = getDisplayMonth(sortedEvents, currentMonth);
  const monthKey = serializeMonth(monthStart);
  const previousMonth = serializeMonth(addMonths(monthStart, -1));
  const nextMonth = serializeMonth(addMonths(monthStart, 1));
  const monthLabel = new Intl.DateTimeFormat(resolveLocale(locale), {
    month: 'long',
    year: 'numeric',
  }).format(monthStart);
  const days = calendarDays(monthStart);
  const eventsByDate = groupEventsByDate(sortedEvents);
  const monthEvents = sortedEvents.filter((event) =>
    event.date.startsWith(monthKey),
  );

  if (!events.length) {
    return (
      <ModulePanel className="rounded-3xl p-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#533089]/7">
          <CalendarDays className="h-7 w-7 text-[#533089]/45" />
        </div>
        <h2 className="mt-5 text-xl font-bold text-[#2E286C]">
          {labels.emptyTitle}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-[#2E286C]/45">
          {labels.emptyDescription}
        </p>
      </ModulePanel>
    );
  }

  return (
    <div className="space-y-5">
      <ModulePanel className="rounded-3xl p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold capitalize text-[#2E286C]">
              {monthLabel}
            </h2>
            <p className="mt-1 text-sm font-medium text-[#2E286C]/45">
              {labels.hoverHint}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-full bg-[#F8F9FC] p-1 shadow-inner shadow-black/[0.03]">
              <MonthNavLink
                href={`?month=${previousMonth}`}
                label={labels.previousMonth}
              >
                <ChevronLeft className="h-4 w-4" />
              </MonthNavLink>
              <MonthNavLink href={`?month=${nextMonth}`} label={labels.nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </MonthNavLink>
            </div>
            <span className="rounded-full bg-[#533089] px-3 py-1.5 text-xs font-bold text-white shadow-sm">
              {labels.monthView}
            </span>
            <CalendarLegend labels={labels} />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-7 gap-2 text-center text-[10px] font-bold uppercase tracking-wider text-[#2E286C]/35">
          {weekdayLabels(locale).map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-2">
          {days.map((day, index) => {
            const dateKey = serializeDate(day);
            const dayEvents = eventsByDate.get(dateKey) ?? [];
            const inMonth = day.getMonth() === monthStart.getMonth();
            const hasEvents = dayEvents.length > 0;
            const align = index % 7 >= 5 ? 'right' : 'left';

            return (
              <div
                key={dateKey}
                tabIndex={hasEvents ? 0 : undefined}
                className={cn(
                  'group/day relative min-h-24 rounded-2xl border p-2 outline-none transition-[background,border-color,box-shadow,transform] duration-150 ease-out sm:min-h-28',
                  inMonth
                    ? 'border-black/[0.04] bg-[#F8F9FC]'
                    : 'border-transparent bg-[#F8F9FC]/45 text-[#2E286C]/25',
                  hasEvents &&
                    'cursor-default hover:z-20 hover:-translate-y-0.5 hover:border-[#533089]/20 hover:bg-white hover:shadow-xl focus-visible:z-20 focus-visible:border-[#533089]/30 focus-visible:ring-2 focus-visible:ring-[#533089]/15',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-h-6 flex-wrap gap-1">
                    {dayEvents.slice(0, 4).map((event) => (
                      <span
                        key={event.id}
                        className={cn(
                          'h-2.5 w-2.5 rounded-full shadow-sm shadow-black/5',
                          kindStyles[event.kind].dot,
                        )}
                      />
                    ))}
                    {dayEvents.length > 4 && (
                      <span className="rounded-full bg-white px-1.5 text-[9px] font-black leading-4 text-[#2E286C]/45 shadow-sm">
                        +{dayEvents.length - 4}
                      </span>
                    )}
                  </div>
                  <div
                    className={cn(
                      'text-xs font-bold',
                      inMonth ? 'text-[#2E286C]/55' : 'text-[#2E286C]/25',
                    )}
                  >
                    {day.getDate()}
                  </div>
                </div>

                {hasEvents && (
                  <div className="mt-5 flex items-end justify-between gap-2">
                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-[#2E286C]/45 shadow-sm">
                      {dayEvents.length}
                    </span>
                    <span className="truncate text-[10px] font-bold text-[#533089]/70">
                      {dayEvents[0]?.startTime}
                    </span>
                  </div>
                )}

                {hasEvents && (
                  <CalendarDayPopover
                    align={align}
                    date={dateKey}
                    events={dayEvents}
                    labels={labels}
                    locale={locale}
                  />
                )}
              </div>
            );
          })}
        </div>
      </ModulePanel>

      <details className="group/details rounded-3xl border border-black/[0.02] bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-3xl p-4 transition-colors duration-150 ease-out marker:hidden hover:bg-[#F8F9FC] sm:p-5 [&::-webkit-details-marker]:hidden">
          <div>
            <div className="text-sm font-bold text-[#2E286C]">
              {labels.detailView}
            </div>
            <p className="mt-1 text-xs font-medium text-[#2E286C]/40">
              {labels.agendaTitle}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[#533089]/7 px-3 py-1 text-xs font-bold text-[#533089]">
              {monthEvents.length}
            </span>
            <span className="relative h-6 w-11 rounded-full bg-[#F0ECF7] transition-colors duration-150 ease-out group-open/details:bg-[#533089]">
              <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150 ease-out group-open/details:translate-x-5" />
            </span>
          </div>
        </summary>

        <div className="border-t border-black/[0.04] p-4 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#2E286C]/45">
              {labels.legendTitle}
            </p>
            <CalendarLegend labels={labels} />
          </div>
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {monthEvents.map((event) => (
              <CalendarAgendaCard
                currentMonth={currentMonth}
                key={event.id}
                event={event}
                labels={labels}
                locale={locale}
                returnPath={returnPath}
              />
            ))}
            {!monthEvents.length && (
              <div className="rounded-2xl bg-[#F8F9FC] p-5 text-sm font-semibold leading-6 text-[#2E286C]/45">
                {labels.noEventsInMonth}
              </div>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}

function MonthNavLink({
  children,
  href,
  label,
}: {
  children: ReactNode;
  href: string;
  label: string;
}) {
  return (
    <Link
      aria-label={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#533089] transition-[background,transform,color] duration-150 ease-out hover:bg-white hover:text-[#2E286C] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#533089]/20"
      href={href}
      title={label}
    >
      {children}
    </Link>
  );
}

function CalendarLegend({ labels }: { labels: CalendarBoardLabels }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(['group_lesson', 'private_lesson', 'appointment'] as const).map(
        (kind) => (
          <span
            key={kind}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider',
              kindStyles[kind].chip,
            )}
          >
            <span
              className={cn('h-2 w-2 rounded-full', kindStyles[kind].dot)}
            />
            {labels.eventKinds[kind]}
          </span>
        ),
      )}
    </div>
  );
}

function CalendarDayPopover({
  align,
  date,
  events,
  labels,
  locale,
}: {
  align: 'left' | 'right';
  date: string;
  events: CalendarEventView[];
  labels: CalendarBoardLabels;
  locale: string;
}) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute top-full z-30 mt-2 w-72 max-w-[calc(100vw-3rem)] translate-y-1 rounded-3xl border border-black/[0.04] bg-white p-3 text-left opacity-0 shadow-2xl transition-[opacity,transform] duration-150 ease-out group-hover/day:pointer-events-auto group-hover/day:translate-y-0 group-hover/day:opacity-100 group-focus/day:pointer-events-auto group-focus/day:translate-y-0 group-focus/day:opacity-100',
        align === 'right' ? 'right-0' : 'left-0',
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-black/[0.04] pb-3">
        <div className="text-xs font-bold text-[#2E286C]">
          {formatDate(date, locale)}
        </div>
        <span className="rounded-full bg-[#533089]/7 px-2.5 py-1 text-[10px] font-bold text-[#533089]">
          {events.length}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {events.map((event) => (
          <div key={event.id} className="rounded-2xl bg-[#F8F9FC] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-[#2E286C]">
                  {event.title}
                </div>
                {event.subtitle && (
                  <div className="mt-1 truncate text-[10px] font-semibold text-[#2E286C]/40">
                    {event.subtitle}
                  </div>
                )}
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-1 text-[9px] font-bold',
                  kindStyles[event.kind].soft,
                )}
              >
                {labels.eventKinds[event.kind]}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold text-[#2E286C]/45">
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3 w-3 text-[#533089]" />
                {event.startTime}
              </span>
              {event.studentCount !== undefined && (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3 w-3 text-[#533089]" />
                  {labels.studentCount(event.studentCount)}
                </span>
              )}
              {event.meetingStatus && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-1 text-[9px] font-bold text-[#533089]">
                  <Video className="h-3 w-3" />
                  {labels.meetingStatuses[event.meetingStatus]}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarAgendaCard({
  currentMonth,
  event,
  labels,
  locale,
  returnPath,
}: {
  currentMonth?: string;
  event: CalendarEventView;
  labels: CalendarBoardLabels;
  locale: string;
  returnPath?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-black/[0.04] border-l-4 bg-white p-4 shadow-sm',
        kindStyles[event.kind].accent,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-[#2E286C]">{event.title}</div>
          {event.subtitle && (
            <div className="mt-1 text-xs font-semibold text-[#2E286C]/40">
              {event.subtitle}
            </div>
          )}
        </div>
        <StatusChip tone={event.status === 'scheduled' ? 'emerald' : 'gray'}>
          {labels.status[event.status]}
        </StatusChip>
      </div>

      <div className="mt-4 grid gap-2 text-xs font-semibold text-[#2E286C]/55">
        <span className="inline-flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-[#533089]" />
          {formatDate(event.date, locale)}
        </span>
        <span className="inline-flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-[#533089]" />
          {event.startTime}
        </span>
        {event.studentCount !== undefined && (
          <span className="inline-flex items-center gap-2">
            <Users className="h-4 w-4 text-[#533089]" />
            {labels.studentCount(event.studentCount)}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span
          className={cn(
            'rounded-full px-3 py-1 text-[10px] font-bold',
            kindStyles[event.kind].soft,
          )}
        >
          {labels.eventKinds[event.kind]}
        </span>
        {event.instructorName && (
          <span className="rounded-full bg-[#F8F9FC] px-3 py-1 text-[10px] font-bold text-[#2E286C]/45">
            {event.instructorName}
          </span>
        )}
        {event.meetingStatus && event.meetingStatus !== 'ready' && (
          <span className="rounded-full bg-[#F8F9FC] px-3 py-1 text-[10px] font-bold text-[#2E286C]/45">
            {labels.meetingStatuses[event.meetingStatus]}
          </span>
        )}
      </div>

      {(labels.meetingAttempts || labels.meetingLastError) &&
        (event.meetingAttempts !== undefined || event.meetingLastError) && (
          <div className="mt-3 rounded-2xl bg-red-50 px-3 py-2 text-[11px] font-semibold leading-5 text-red-700">
            {labels.meetingAttempts && event.meetingAttempts !== undefined && (
              <div>{labels.meetingAttempts(event.meetingAttempts)}</div>
            )}
            {labels.meetingLastError && event.meetingLastError && (
              <div className="break-words">
                {labels.meetingLastError}: {event.meetingLastError}
              </div>
            )}
          </div>
        )}

      <CalendarEventActions
        currentMonth={currentMonth}
        event={event}
        labels={labels}
        locale={locale}
        returnPath={returnPath}
      />
    </div>
  );
}

function CalendarEventActions({
  currentMonth,
  event,
  labels,
  locale,
  returnPath,
}: {
  currentMonth?: string;
  event: CalendarEventView;
  labels: CalendarBoardLabels;
  locale: string;
  returnPath?: string;
}) {
  const returnTo = returnPath ?? buildCalendarReturnTo(locale, currentMonth);
  const showMeetingAction =
    event.meetingStatus === 'ready' &&
    (event.joinUrl || event.requiresGoogleLink);
  const showAbsenceAction = Boolean(event.absenceReportUrl);
  const showRetryAction = Boolean(event.meetingRetryUrl);

  if (!showMeetingAction && !showAbsenceAction && !showRetryAction) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3 border-t border-black/[0.04] pt-4">
      {showMeetingAction ? (
        event.requiresGoogleLink ? (
          <Link
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#F8F9FC] px-4 py-3 text-xs font-bold text-[#533089] transition-colors duration-150 hover:bg-[#533089]/7"
            href={`/${locale}/ogrenci/profil?google=required`}
          >
            <Video className="h-4 w-4" />
            {labels.connectGoogle}
          </Link>
        ) : event.joinUrl ? (
          <Link
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#533089] px-4 py-3 text-xs font-bold text-white shadow-sm transition-[background,transform] duration-150 hover:bg-[#43236f] active:scale-[0.99]"
            href={event.joinUrl}
            rel="noreferrer"
            target="_blank"
          >
            <Video className="h-4 w-4" />
            {labels.joinLesson}
          </Link>
        ) : null
      ) : null}

      {event.meetingRetryUrl ? (
        <form action={event.meetingRetryUrl} method="post">
          <input name="returnTo" type="hidden" value={returnTo} />
          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-xs font-bold text-red-700 transition-colors duration-150 hover:bg-red-100"
            type="submit"
          >
            <Video className="h-4 w-4" />
            {labels.retryMeeting}
          </button>
        </form>
      ) : null}

      {event.absenceReportUrl ? (
        event.absenceReported ? (
          <div className="inline-flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">
            <Send className="h-4 w-4" />
            {labels.absenceReported}
          </div>
        ) : (
          <form
            action={event.absenceReportUrl}
            className="space-y-2 rounded-2xl bg-[#F8F9FC] p-3"
            method="post"
          >
            <input
              name="reason"
              type="hidden"
              value="student_absence_report"
            />
            <input name="returnTo" type="hidden" value={returnTo} />
            <textarea
              aria-label={labels.absenceNotePlaceholder}
              className="min-h-16 w-full resize-none rounded-xl border border-black/[0.04] bg-white px-3 py-2 text-xs font-medium text-[#2E286C] outline-none transition-shadow placeholder:text-[#2E286C]/30 focus:ring-2 focus:ring-[#533089]/15"
              maxLength={1000}
              name="note"
              placeholder={labels.absenceNotePlaceholder}
            />
            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#533089] shadow-sm transition-colors duration-150 hover:bg-[#533089]/7"
              type="submit"
            >
              <Send className="h-4 w-4" />
              {labels.reportAbsence}
            </button>
          </form>
        )
      ) : null}
    </div>
  );
}

function buildCalendarReturnTo(locale: string, currentMonth?: string) {
  const query = currentMonth
    ? `?month=${encodeURIComponent(currentMonth)}`
    : '';
  return `/${locale}/ogrenci/takvim${query}`;
}

function getDisplayMonth(events: CalendarEventView[], requestedMonthKey?: string) {
  const requestedMonth = parseMonth(requestedMonthKey);
  if (requestedMonth) return requestedMonth;

  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthKey = serializeMonth(currentMonth);
  const hasCurrentMonthEvent = events.some((event) =>
    event.date.startsWith(currentMonthKey),
  );
  if (hasCurrentMonthEvent) return currentMonth;

  const first = events[0]?.date;
  if (!first) return currentMonth;
  const parsed = new Date(`${first}T12:00:00`);
  return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
}

function addMonths(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

function parseMonth(value?: string) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null;
  const [year, month] = value.split('-').map(Number);
  if (month < 1 || month > 12) return null;
  return new Date(year, month - 1, 1);
}

function calendarDays(monthStart: Date) {
  const start = new Date(monthStart);
  const day = start.getDay();
  const offset = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - offset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function groupEventsByDate(events: CalendarEventView[]) {
  const result = new Map<string, CalendarEventView[]>();
  for (const event of events) {
    const items = result.get(event.date) ?? [];
    items.push(event);
    result.set(event.date, items);
  }
  return result;
}

function weekdayLabels(locale: string) {
  const formatter = new Intl.DateTimeFormat(resolveLocale(locale), {
    weekday: 'short',
  });
  const monday = new Date('2026-06-15T12:00:00Z');
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    return formatter.format(date);
  });
}

function compareCalendarEvents(
  first: CalendarEventView,
  second: CalendarEventView,
) {
  return first.startsAt.localeCompare(second.startsAt);
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(resolveLocale(locale), {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00Z`));
}

function serializeDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function serializeMonth(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function resolveLocale(locale: string) {
  return locale === 'en' ? 'en-US' : 'tr-TR';
}
