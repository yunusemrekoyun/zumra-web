'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarClock, CalendarDays, Check, X } from 'lucide-react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { enUS, tr } from 'react-day-picker/locale';
import { isoToIstanbulWallClock, istanbulWallClockToISO } from '@/lib/datetime';
import { cn } from '@/lib/utils';

function parseDate(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function serializeDate(value?: Date) {
  if (!value) return '';
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(value: string, locale: string) {
  const parsed = parseDate(value);
  return parsed
    ? new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(parsed)
    : '';
}

function parseDateTime(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function serializeDateTime(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hour = String(value.getHours()).padStart(2, '0');
  const minute = String(value.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function formatDateTime(value: string, locale: string) {
  const parsed = parseDateTime(value);
  return parsed
    ? new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(parsed)
    : '';
}

export function DatePicker({
  disabledAfter,
  disabledBefore,
  error,
  id,
  locale,
  onChange,
  placeholder,
  value,
}: {
  disabledAfter?: Date;
  disabledBefore?: Date;
  error?: boolean;
  id?: string;
  locale: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = parseDate(value);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex h-12 w-full items-center justify-between rounded-xl border bg-[#F8F9FC] px-4 text-left text-sm font-medium outline-none transition-colors',
          error ? 'border-red-400' : 'border-transparent focus:border-[#533089]/30',
          value ? 'text-[#2E286C]' : 'text-[#2E286C]/35',
        )}
      >
        <span>{value ? formatDate(value, locale) : placeholder}</span>
        <CalendarDays className="h-4 w-4 text-[#533089]" />
      </button>
      {open && (
        <>
          <div
            role="dialog"
            className="absolute left-0 top-[calc(100%+0.5rem)] z-[80] hidden rounded-2xl bg-white p-4 shadow-2xl sm:block"
          >
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={(day) => {
                onChange(serializeDate(day));
                if (day) setOpen(false);
              }}
              locale={locale === 'en' ? enUS : tr}
              weekStartsOn={1}
              showOutsideDays
              fixedWeeks
              captionLayout="dropdown"
              reverseYears
              startMonth={disabledBefore ?? new Date(1920, 0)}
              endMonth={disabledAfter ?? new Date(2100, 11)}
              disabled={[
                ...(disabledBefore ? [{ before: disabledBefore }] : []),
                ...(disabledAfter ? [{ after: disabledAfter }] : []),
              ]}
              className="zumra-calendar"
            />
          </div>
          <CalendarPortal>
            <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[#2E286C]/20 p-3 backdrop-blur-[2px] sm:hidden">
              <div
                role="dialog"
                aria-modal="true"
                className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl"
              >
                <button
                  type="button"
                  aria-label={
                    locale === 'en' ? 'Close calendar' : 'Takvimi kapat'
                  }
                  onClick={() => setOpen(false)}
                  className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-[#2E286C]/50 hover:bg-black/[0.04]"
                >
                  <X className="h-4 w-4" />
                </button>
                <DayPicker
                  mode="single"
                  selected={selected}
                  onSelect={(day) => {
                    onChange(serializeDate(day));
                    if (day) setOpen(false);
                  }}
                  locale={locale === 'en' ? enUS : tr}
                  weekStartsOn={1}
                  showOutsideDays
                  fixedWeeks
                  captionLayout="dropdown"
                  reverseYears
                  startMonth={disabledBefore ?? new Date(1920, 0)}
                  endMonth={disabledAfter ?? new Date(2100, 11)}
                  disabled={[
                    ...(disabledBefore ? [{ before: disabledBefore }] : []),
                    ...(disabledAfter ? [{ after: disabledAfter }] : []),
                  ]}
                  className="zumra-calendar"
                />
              </div>
            </div>
          </CalendarPortal>
        </>
      )}
    </div>
  );
}

export function DateRangePicker({
  endValue,
  locale,
  onChange,
  placeholders,
  startValue,
}: {
  endValue: string;
  locale: string;
  onChange: (range: { end: string; start: string }) => void;
  placeholders: { end: string; start: string };
  startValue: string;
}) {
  const [open, setOpen] = useState(false);
  const selected: DateRange = {
    from: parseDate(startValue),
    to: parseDate(endValue),
  };

  return (
    <div className="relative grid gap-4 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-12 items-center justify-between rounded-xl bg-[#F8F9FC] px-4 text-left text-sm font-medium text-[#2E286C]"
      >
        {startValue ? formatDate(startValue, locale) : placeholders.start}
        <CalendarDays className="h-4 w-4 text-[#533089]" />
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-12 items-center justify-between rounded-xl bg-[#F8F9FC] px-4 text-left text-sm font-medium text-[#2E286C]"
      >
        {endValue ? formatDate(endValue, locale) : placeholders.end}
        <CalendarDays className="h-4 w-4 text-[#533089]" />
      </button>
      {open && (
        <CalendarPortal>
          <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[#2E286C]/20 p-3 backdrop-blur-[2px]">
            <div className="relative max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl">
              <button
                type="button"
                aria-label={
                  locale === 'en' ? 'Close calendar' : 'Takvimi kapat'
                }
                onClick={() => setOpen(false)}
                className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-[#2E286C]/50 hover:bg-black/[0.04]"
              >
                <X className="h-4 w-4" />
              </button>
              <DayPicker
                mode="range"
                selected={selected}
                onSelect={(range) => {
                  onChange({
                    end: serializeDate(range?.to),
                    start: serializeDate(range?.from),
                  });
                  if (range?.from && range.to) setOpen(false);
                }}
                locale={locale === 'en' ? enUS : tr}
                weekStartsOn={1}
                showOutsideDays
                fixedWeeks
                numberOfMonths={1}
                className="zumra-calendar"
              />
            </div>
          </div>
        </CalendarPortal>
      )}
    </div>
  );
}

export function DateTimePicker({
  error,
  id,
  locale,
  min,
  onChange,
  placeholder,
  value,
}: {
  error?: boolean;
  id?: string;
  locale: string;
  min?: Date;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState<Date>();
  const [hour, setHour] = useState('10');
  const [minute, setMinute] = useState('00');

  function openPicker() {
    const current = parseDateTime(value) ?? roundedFutureDate(min);
    setDraftDate(current);
    setHour(String(current.getHours()).padStart(2, '0'));
    setMinute(String(current.getMinutes()).padStart(2, '0'));
    setOpen(true);
  }

  const candidate = draftDate
    ? new Date(
        draftDate.getFullYear(),
        draftDate.getMonth(),
        draftDate.getDate(),
        Number(hour),
        Number(minute),
      )
    : undefined;
  // Callers interpret the emitted value as Istanbul wall-clock, so compare the
  // candidate's Istanbul instant against `min` instead of a browser-local one.
  const candidateIsValid =
    candidate &&
    (!min ||
      new Date(
        istanbulWallClockToISO(serializeDateTime(candidate)),
      ).getTime() >= min.getTime());

  return (
    <div className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openPicker}
        className={cn(
          'flex h-12 w-full items-center justify-between rounded-2xl border bg-white px-4 text-left text-sm font-semibold outline-none transition',
          error
            ? 'border-red-400'
            : 'border-[#2E286C]/10 focus:border-[#533089]/40 focus:ring-4 focus:ring-[#533089]/5',
          value ? 'text-[#2E286C]' : 'text-[#2E286C]/35',
        )}
      >
        <span>{value ? formatDateTime(value, locale) : placeholder}</span>
        <CalendarClock className="h-4 w-4 text-[#533089]" />
      </button>
      {open && (
        <CalendarPortal>
          <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[#2E286C]/20 p-3 backdrop-blur-[2px]">
            <div
              role="dialog"
              aria-modal="true"
              className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl"
            >
            <button
              type="button"
              aria-label={locale === 'en' ? 'Close calendar' : 'Takvimi kapat'}
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-[#2E286C]/50 hover:bg-black/[0.04]"
            >
              <X className="h-4 w-4" />
            </button>
            <DayPicker
              mode="single"
              selected={draftDate}
              onSelect={setDraftDate}
              locale={locale === 'en' ? enUS : tr}
              weekStartsOn={1}
              showOutsideDays
              fixedWeeks
              disabled={min ? [{ before: toIstanbulWallClock(min) }] : undefined}
              className="zumra-calendar"
            />
            <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <select
                aria-label={locale === 'en' ? 'Hour' : 'Saat'}
                value={hour}
                onChange={(event) => setHour(event.target.value)}
                className="h-11 rounded-xl border border-[#2E286C]/10 bg-[#F8F9FC] px-3 text-center text-sm font-bold text-[#2E286C] outline-none focus:border-[#533089]/30"
              >
                {Array.from({ length: 24 }, (_, index) =>
                  String(index).padStart(2, '0'),
                ).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <span className="font-bold text-[#2E286C]/40">:</span>
              <select
                aria-label={locale === 'en' ? 'Minute' : 'Dakika'}
                value={minute}
                onChange={(event) => setMinute(event.target.value)}
                className="h-11 rounded-xl border border-[#2E286C]/10 bg-[#F8F9FC] px-3 text-center text-sm font-bold text-[#2E286C] outline-none focus:border-[#533089]/30"
              >
                {['00', '15', '30', '45'].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            {!candidateIsValid && (
              <p className="mt-3 text-xs font-semibold text-red-600">
                {locale === 'en'
                  ? 'Choose a future date and time.'
                  : 'Gelecekte bir tarih ve saat seçin.'}
              </p>
            )}
            <button
              type="button"
              disabled={!candidateIsValid}
              onClick={() => {
                if (!candidateIsValid || !candidate) return;
                onChange(serializeDateTime(candidate));
                setOpen(false);
              }}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#533089] text-sm font-bold text-white transition hover:bg-[#452575] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check className="h-4 w-4" />
              {locale === 'en' ? 'Use this time' : 'Bu zamanı kullan'}
            </button>
            </div>
          </div>
        </CalendarPortal>
      )}
    </div>
  );
}

/** Project an instant onto Istanbul wall-clock, carried in a local Date. */
function toIstanbulWallClock(instant: Date) {
  const [datePart, timePart] =
    isoToIstanbulWallClock(instant.toISOString()).split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

function roundedFutureDate(min?: Date) {
  // Default draft in Istanbul wall-clock so it stays valid for the min check.
  const value = toIstanbulWallClock(
    new Date(Math.max(Date.now() + 60 * 60 * 1000, min?.getTime() ?? 0)),
  );
  value.setSeconds(0, 0);
  value.setMinutes(Math.ceil(value.getMinutes() / 15) * 15);
  return value;
}

function CalendarPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}
