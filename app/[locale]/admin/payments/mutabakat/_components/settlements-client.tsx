'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, CheckCircle2, Handshake, Loader2 } from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  FormField,
  Input,
  ModulePanel,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import type { PaymentRecordView } from '@/lib/server/services/payments';

export type SettlementInstructor = {
  id: string;
  name: string;
  unsettledCents: number;
  unsettledCount: number;
};

function formatTry(cents: number) {
  return `${(cents / 100).toLocaleString('tr-TR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} ₺`;
}

export function SettlementsClient({
  instructors,
}: {
  instructors: SettlementInstructor[];
}) {
  const t = useTranslations('admin.settlements');
  const locale = useLocale();
  const router = useRouter();

  const [selected, setSelected] = useState<SettlementInstructor | null>(null);
  const [payments, setPayments] = useState<PaymentRecordView[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    [locale],
  );

  const groups = useMemo(() => {
    const byCourse = new Map<string, PaymentRecordView[]>();
    for (const payment of payments) {
      const list = byCourse.get(payment.courseLabel) ?? [];
      list.push(payment);
      byCourse.set(payment.courseLabel, list);
    }
    return [...byCourse.entries()];
  }, [payments]);

  const selectedTotalCents = useMemo(
    () =>
      payments
        .filter((payment) => selectedIds.has(payment.id))
        .reduce((sum, payment) => sum + (payment.zumraShareCents ?? 0), 0),
    [payments, selectedIds],
  );

  async function openInstructor(instructor: SettlementInstructor) {
    setSelected(instructor);
    setPayments([]);
    setSelectedIds(new Set());
    setNote('');
    setConfirming(false);
    setError(undefined);
    setSuccess(false);
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/teacher-settlements?instructorId=${instructor.id}`,
        { credentials: 'same-origin' },
      );
      const body = (await response.json().catch(() => ({}))) as {
        payments?: PaymentRecordView[];
      };
      if (!response.ok) {
        throw new Error('request_failed');
      }
      setPayments(body.payments ?? []);
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }

  function toggle(paymentId: string) {
    setConfirming(false);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(paymentId)) {
        next.delete(paymentId);
      } else {
        next.add(paymentId);
      }
      return next;
    });
  }

  async function submit() {
    if (!selected || selectedIds.size === 0) return;
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch('/api/admin/teacher-settlements', {
        body: JSON.stringify({
          instructorId: selected.id,
          note: note.trim() || undefined,
          paymentIds: [...selectedIds],
        }),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      if (response.ok) {
        setSelected(null);
        setPayments([]);
        setSelectedIds(new Set());
        setConfirming(false);
        setSuccess(true);
        router.refresh();
        return;
      }
      setError(t('errorGeneric'));
      setConfirming(false);
    } catch {
      setError(t('errorGeneric'));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  if (!selected) {
    return (
      <div className="space-y-4">
        {success && (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="h-5 w-5 flex-none" />
            {t('success')}
          </div>
        )}

        {instructors.length === 0 ? (
          <ModulePanel className="rounded-3xl py-12 text-center text-sm font-semibold text-[#2E286C]/55">
            {t('empty')}
          </ModulePanel>
        ) : (
          <ModulePanel className="space-y-3 rounded-3xl">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#2E286C]/60">
              {t('instructorsTitle')}
            </h2>
            {instructors.map((instructor) => (
              <div
                key={instructor.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-black/[0.05] bg-white px-4 py-3"
              >
                <Avatar name={instructor.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-[#2E286C]">
                    {instructor.name}
                  </div>
                  <div className="text-xs font-medium text-[#2E286C]/50">
                    {t('countPayments', { count: instructor.unsettledCount })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/40">
                    {t('colUnsettled')}
                  </div>
                  <div className="text-sm font-bold text-[#2E286C]">
                    {formatTry(instructor.unsettledCents)}
                  </div>
                </div>
                <Button size="sm" onClick={() => openInstructor(instructor)}>
                  <Handshake className="h-3.5 w-3.5" />
                  {t('open')}
                </Button>
              </div>
            ))}
          </ModulePanel>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <button
          className="inline-flex items-center gap-2 rounded-xl px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-[#533089] transition-colors hover:bg-[#533089]/5"
          onClick={() => setSelected(null)}
          type="button"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </button>
      </div>

      <Card padded={false} className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-black/[0.03] p-5 md:flex-row md:items-center md:justify-between lg:p-6">
          <div>
            <h2 className="font-rosmatika text-lg font-medium text-[#2E286C]">
              {selected.name}
            </h2>
            <p className="text-sm font-medium text-[#2E286C]/55">
              {t('treeTitle')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setConfirming(false);
                setSelectedIds(new Set(payments.map((payment) => payment.id)));
              }}
            >
              {t('selectAll')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setConfirming(false);
                setSelectedIds(new Set());
              }}
            >
              {t('clearAll')}
            </Button>
          </div>
        </div>

        <div className="space-y-5 p-5 lg:p-6">
          {loading && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-[#533089]/60" />
            </div>
          )}

          {!loading &&
            groups.map(([courseLabel, coursePayments]) => (
              <div key={courseLabel} className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#2E286C]/60">
                  {courseLabel}
                </h3>
                {coursePayments.map((payment) => {
                  const checked = selectedIds.has(payment.id);
                  return (
                    <label
                      key={payment.id}
                      className={cn(
                        'flex cursor-pointer flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 transition-colors',
                        checked
                          ? 'border-[#533089]/30 bg-[#533089]/5'
                          : 'border-black/[0.05] bg-white hover:bg-black/[0.01]',
                      )}
                    >
                      <input
                        checked={checked}
                        className="h-4 w-4 accent-[#533089]"
                        onChange={() => toggle(payment.id)}
                        type="checkbox"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-[#2E286C]">
                          {payment.studentName}
                        </div>
                        <div className="text-xs font-medium text-[#2E286C]/50">
                          {payment.installmentLabel ?? '—'}
                          {payment.reviewedAt
                            ? ` · ${t('colConfirmedAt')}: ${dateFormatter.format(new Date(payment.reviewedAt))}`
                            : ''}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/40">
                          {t('colAmount')}
                        </div>
                        <div className="text-sm font-medium text-[#2E286C]/70">
                          {payment.amountCents !== null
                            ? formatTry(payment.amountCents)
                            : '—'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/40">
                          {t('colZumraShare')}
                        </div>
                        <div className="text-sm font-bold text-[#2E286C]">
                          {payment.zumraShareCents !== null
                            ? formatTry(payment.zumraShareCents)
                            : '—'}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            ))}

          {!loading && payments.length === 0 && !error && (
            <p className="py-8 text-center text-sm font-semibold text-[#2E286C]/45">
              {t('empty')}
            </p>
          )}

          {error && (
            <p className="text-sm font-semibold text-red-600">{error}</p>
          )}
        </div>

        <div className="space-y-4 border-t border-black/[0.03] bg-[#F8F9FC] p-5 lg:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <p className="text-sm font-bold text-[#2E286C]">
              {t('selectedTotal', { amount: formatTry(selectedTotalCents) })}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <FormField label={t('noteLabel')} className="sm:w-64">
                <Input
                  onChange={(event) => setNote(event.target.value)}
                  value={note}
                />
              </FormField>
              <Button
                disabled={busy || selectedIds.size === 0 || confirming}
                onClick={() => setConfirming(true)}
              >
                <Handshake className="h-4 w-4" />
                {t('submit')}
              </Button>
            </div>
          </div>

          {confirming && (
            <div className="flex flex-col gap-3 rounded-2xl border border-[#533089]/20 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-[#2E286C]">
                {t('confirmPrompt', {
                  amount: formatTry(selectedTotalCents),
                  name: selected.name,
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setConfirming(false)}
                >
                  {t('confirmCancel')}
                </Button>
                <Button size="sm" disabled={busy} onClick={submit}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('confirmYes')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
