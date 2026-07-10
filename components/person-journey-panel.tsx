'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowLeftRight,
  CalendarCheck,
  Lock,
  Route,
  StickyNote,
  UserRound,
} from 'lucide-react';
import { Avatar, ModulePanel, StatusChip, TimelineItem } from '@/components/ui';
import { APP_TIME_ZONE } from '@/lib/datetime';
import { useRouter } from '@/i18n/navigation';
import type { AdvisorOption } from '@/lib/server/services/candidate-pipeline';
import type { PersonJourney } from '@/lib/server/services/person-journey';

/**
 * Staff-only 360° view of one person: consultation history, shared advisor
 * notes and the full activity timeline — the same panel on the admin student
 * detail and the advisor's student profile.
 */
export function PersonJourneyPanel({
  advisors,
  journey,
  locale,
}: {
  advisors: AdvisorOption[];
  journey: PersonJourney;
  locale: string;
}) {
  const t = useTranslations('workspace.journey');
  const leads = useTranslations('admin.leads');
  const appointment = useTranslations('admin.leads.appointment');
  const router = useRouter();
  const [noteBody, setNoteBody] = useState('');
  const [transferOpen, setTransferOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const transferTargets = advisors.filter(
    (advisor) => advisor.id !== journey.advisorId,
  );

  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: APP_TIME_ZONE,
  });

  async function transferAdvisor(advisorId: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/admin/candidates/${journey.candidateId}`,
        {
          body: JSON.stringify({ advisorId: advisorId || null }),
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          method: 'PATCH',
        },
      );
      if (!response.ok) throw new Error('transfer_failed');
      setTransferOpen(false);
      router.refresh();
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  }

  async function submitNote() {
    const body = noteBody.trim();
    if (!body || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/admin/candidates/${journey.candidateId}/notes`,
        {
          body: JSON.stringify({ body }),
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        },
      );
      if (!response.ok) throw new Error('note_failed');
      setNoteBody('');
      router.refresh();
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModulePanel className="rounded-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#2E286C]/40">
          <Route className="h-4 w-4" />
          {t('title')}
        </h3>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F8F0DC] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#9A6A0B]">
          <Lock className="h-3 w-3" />
          {t('staffOnly')}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-[#F8F7FB] p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#2E286C]/40">
            {t('firstSeen')}
          </div>
          <div className="mt-1 text-sm font-bold text-[#2E286C]">
            {formatter.format(new Date(journey.firstSeenAt))}
          </div>
        </div>
        <div className="rounded-2xl bg-[#F8F7FB] p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#2E286C]/40">
            {t('stage')}
          </div>
          <div className="mt-1 text-sm font-bold text-[#2E286C]">
            {leads(`stages.${journey.stage}`)}
          </div>
        </div>
        <div className="rounded-2xl bg-[#F8F7FB] p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#2E286C]/40">
            {t('advisor')}
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {journey.advisorName ? (
                <>
                  <Avatar name={journey.advisorName} size="sm" />
                  <span className="truncate text-sm font-bold text-[#2E286C]">
                    {journey.advisorName}
                  </span>
                </>
              ) : (
                <span className="text-sm font-semibold text-[#2E286C]/45">
                  {leads('noAdvisor')}
                </span>
              )}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setTransferOpen(!transferOpen);
                setError('');
              }}
              className="inline-flex min-h-8 flex-none items-center gap-1.5 rounded-xl bg-white px-2.5 text-[11px] font-bold text-[#533089] ring-1 ring-[#533089]/20 transition-colors hover:bg-[#533089]/10 disabled:opacity-50"
            >
              <ArrowLeftRight className="h-3 w-3" />
              {t('transferCta')}
            </button>
          </div>
        </div>
      </div>

      {transferOpen && (
        <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-[#533089]/10">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#533089]">
              {t('transferTitle')}
            </div>
            <div className="flex items-center gap-3">
              {journey.advisorId && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => transferAdvisor('')}
                  className="text-[11px] font-bold text-red-600/80 hover:text-red-700 disabled:opacity-50"
                >
                  {t('unassign')}
                </button>
              )}
              <button
                type="button"
                onClick={() => setTransferOpen(false)}
                className="text-[11px] font-bold text-[#2E286C]/50 hover:text-[#2E286C]"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
          {transferTargets.length ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {transferTargets.map((advisor) => (
                <button
                  key={advisor.id}
                  type="button"
                  disabled={busy}
                  onClick={() => transferAdvisor(advisor.id)}
                  className="group flex items-center gap-3 rounded-2xl bg-[#F8F7FB] p-3 text-left ring-1 ring-black/[0.04] transition-all hover:ring-[#533089]/40 disabled:opacity-50"
                >
                  <Avatar name={advisor.name} size="md" className="bg-white shadow-sm" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-[#2E286C] transition-colors group-hover:text-[#533089]">
                      {advisor.name}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-[#2E286C]/45">
                      <UserRound className="h-3 w-3" />
                      {t('advisorRole')}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[#2E286C]/50">
              {t('noOtherAdvisors')}
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>
      )}

      {journey.appointments.length > 0 && (
        <div className="mt-6">
          <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#2E286C]/40">
            <CalendarCheck className="h-3.5 w-3.5" />
            {t('meetings')}
          </h4>
          <ul className="mt-3 space-y-2">
            {journey.appointments.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-2 rounded-2xl bg-[#F8F7FB] px-4 py-2.5 text-sm"
              >
                <span className="font-semibold text-[#2E286C]/70">
                  {item.scheduledStartsAt
                    ? formatter.format(new Date(item.scheduledStartsAt))
                    : t('noTime')}
                </span>
                <StatusChip
                  tone={
                    item.status === 'completed'
                      ? item.outcomeResult === 'negative'
                        ? 'red'
                        : item.outcomeResult === 'thinking'
                          ? 'amber'
                          : 'emerald'
                      : item.status === 'scheduled' || item.status === 'requested'
                        ? 'purple'
                        : item.status === 'no_show'
                          ? 'amber'
                          : 'red'
                  }
                >
                  {item.status === 'completed' && item.outcomeResult
                    ? appointment(`result_${item.outcomeResult}`)
                    : appointment(
                        item.status === 'requested' || item.status === 'scheduled'
                          ? item.status === 'requested'
                            ? 'statusRequested'
                            : 'statusScheduled'
                          : `outcome_${item.status}`,
                      )}
                </StatusChip>
                {item.outcomeNote && (
                  <span className="min-w-0 flex-1 truncate text-xs text-[#2E286C]/55">
                    {item.outcomeNote}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6">
        <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#2E286C]/40">
          <StickyNote className="h-3.5 w-3.5" />
          {t('notes')}
        </h4>
        <div className="mt-3 flex gap-2">
          <input
            value={noteBody}
            onChange={(event) => setNoteBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitNote();
            }}
            placeholder={t('notePlaceholder')}
            maxLength={2000}
            className="min-w-0 flex-1 rounded-xl border border-[#2E286C]/10 bg-white px-3 py-2 text-sm text-[#2E286C] outline-none focus:border-[#533089]/30"
          />
          <button
            type="button"
            disabled={busy || !noteBody.trim()}
            onClick={submitNote}
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#533089] px-4 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#462878] disabled:opacity-50"
          >
            {t('noteCta')}
          </button>
        </div>
        {journey.notes.length > 0 && (
          <ul className="mt-3 space-y-2">
            {journey.notes.map((note) => (
              <li
                key={note.id}
                className="rounded-2xl bg-white p-3 text-sm text-[#2E286C]/80 ring-1 ring-black/[0.04]"
              >
                <p>{note.body}</p>
                <p className="mt-1 text-xs font-semibold text-[#2E286C]/40">
                  {note.authorName ?? '—'} ·{' '}
                  {formatter.format(new Date(note.createdAt))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#2E286C]/40">
          {t('timeline')}
        </h4>
        <div className="mt-3">
          {journey.activities.map((activity) => (
            <TimelineItem
              key={activity.id}
              title={activityLabel(activity.type, leads)}
              time={formatter.format(new Date(activity.occurredAt))}
              tone={activityTone(activity.type)}
            />
          ))}
        </div>
      </div>
    </ModulePanel>
  );
}

const SUPPORTED_ACTIVITIES = new Set([
  'candidate.created_from_public_assessment',
  'candidate.inquiry_received',
  'candidate.assessment_completed',
  'candidate.profile_completed',
  'candidate.appointment_requested',
  'candidate.appointment_scheduled',
  'candidate.appointment_rescheduled',
  'candidate.appointment_resolved',
  'candidate.advisor_assigned',
  'candidate.stage_changed',
  'candidate.note_added',
  'candidate.contact_called',
  'candidate.contact_emailed',
  'candidate.contact_no_answer',
  'candidate.enrollment_started',
  'candidate.enrollment_completed',
]);

function activityLabel(
  type: string,
  t: ReturnType<typeof useTranslations>,
) {
  return SUPPORTED_ACTIVITIES.has(type)
    ? t(`activities.${type.replace('candidate.', '')}`)
    : type;
}

function activityTone(type: string) {
  if (type.includes('enrollment_completed')) return 'emerald' as const;
  if (type.includes('no_answer')) return 'amber' as const;
  if (type.includes('resolved')) return 'blue' as const;
  return 'brand' as const;
}
