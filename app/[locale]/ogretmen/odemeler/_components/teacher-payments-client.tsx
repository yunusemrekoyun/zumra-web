'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Banknote,
  CheckCircle2,
  FileText,
  Handshake,
  Landmark,
  ReceiptText,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import {
  Button,
  FormField,
  Input,
  KpiCard,
  ModulePanel,
  SectionHeader,
  StatusChip,
} from '@/components/ui';
import {
  AttachmentInput,
  type Attachment,
} from '@/components/attachment-input';
import { useRouter } from '@/i18n/navigation';
import { APP_TIME_ZONE } from '@/lib/datetime';
import { parseTlToCents } from '@/lib/domain/money';
import type {
  getTeacherPaymentWorkspace,
  PaymentRecordView,
} from '@/lib/server/services/payments';

export type TeacherPaymentWorkspace = Awaited<
  ReturnType<typeof getTeacherPaymentWorkspace>
>;

const textareaClassName =
  'min-h-24 w-full rounded-xl border border-[#2E286C]/10 bg-[#F8F9FC] px-4 py-3 text-sm font-medium text-[#2E286C] outline-none transition-all placeholder:text-[#2E286C]/35 focus:border-[#533089]/30';

function formatMoney(cents: number) {
  return `${(cents / 100).toLocaleString('tr-TR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} ₺`;
}

function centsToInput(cents: number) {
  return cents % 100 === 0
    ? String(cents / 100)
    : (cents / 100).toFixed(2).replace('.', ',');
}

function formatShare(basisPoints: number) {
  return (basisPoints / 100).toLocaleString('tr-TR', {
    maximumFractionDigits: 2,
  });
}

export function TeacherPaymentsClient({
  data,
  locale,
}: {
  data: TeacherPaymentWorkspace;
  locale: string;
}) {
  const t = useTranslations('teacher.payments');
  const router = useRouter();
  const [confirmTarget, setConfirmTarget] = useState<PaymentRecordView | null>(
    null,
  );
  const [rejectTarget, setRejectTarget] = useState<PaymentRecordView | null>(
    null,
  );
  const [amountValue, setAmountValue] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [receipt, setReceipt] = useState<Attachment[]>([]);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();

  const dateLocale = locale === 'en' ? 'en-US' : 'tr-TR';
  const dateTimeFormat = new Intl.DateTimeFormat(dateLocale, {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    timeZone: APP_TIME_ZONE,
  });
  const dateFormat = new Intl.DateTimeFormat(dateLocale, {
    day: 'numeric',
    month: 'short',
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
  });

  function shareLabel(basisPoints: number) {
    return t('shareFormat', {
      teacher: formatShare(basisPoints),
      zumra: formatShare(10_000 - basisPoints),
    });
  }

  function openConfirm(record: PaymentRecordView) {
    setConfirmTarget(record);
    setAmountValue(centsToInput(record.declaredAmountCents ?? 0));
    setReviewNote('');
    setReceipt([]);
    setError(undefined);
    setSuccess(undefined);
  }

  function openReject(record: PaymentRecordView) {
    setRejectTarget(record);
    setRejectReason('');
    setError(undefined);
    setSuccess(undefined);
  }

  const confirmAmountCents = parseTlToCents(amountValue);
  const mismatch =
    confirmTarget !== null &&
    confirmTarget.declaredAmountCents !== null &&
    confirmAmountCents !== null &&
    confirmAmountCents !== confirmTarget.declaredAmountCents;

  async function submitConfirm() {
    if (!confirmTarget || !receipt.length) return;
    if (confirmAmountCents === null) {
      setError(t('errorGeneric'));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch(
        `/api/payments/${confirmTarget.id}/confirm`,
        {
          body: JSON.stringify({
            amountCents: confirmAmountCents,
            receiptMediaAssetId: receipt[0].mediaAssetId,
            reviewNote: reviewNote.trim() || undefined,
          }),
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(
          body.error === 'commission_rate_missing'
            ? t('commissionMissing')
            : t('errorGeneric'),
        );
        setBusy(false);
        return;
      }
      setConfirmTarget(null);
      setSuccess(t('successConfirm'));
      setBusy(false);
      router.refresh();
    } catch {
      setError(t('errorGeneric'));
      setBusy(false);
    }
  }

  async function submitReject() {
    if (!rejectTarget || !rejectReason.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/payments/${rejectTarget.id}/reject`, {
        body: JSON.stringify({ reason: rejectReason.trim() }),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      if (!response.ok) {
        setError(t('errorGeneric'));
        setBusy(false);
        return;
      }
      setRejectTarget(null);
      setSuccess(t('successReject'));
      setBusy(false);
      router.refresh();
    } catch {
      setError(t('errorGeneric'));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {success && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4 flex-none" />
          {success}
        </div>
      )}

      {/* Pending reports */}
      <ModulePanel padded={false} className="overflow-hidden">
        <div className="border-b border-black/[0.03] p-5 lg:p-6">
          <SectionHeader title={t('pendingTitle')} className="mb-0" />
        </div>

        {data.pending.length === 0 ? (
          <p className="p-8 text-center text-sm font-semibold text-[#2E286C]/45">
            {t('pendingEmpty')}
          </p>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-3 p-4 md:hidden">
              {data.pending.map((record) => (
                <ModulePanel
                  key={record.id}
                  variant="muted"
                  className="rounded-2xl p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-bold text-[#2E286C]">
                        {record.studentName}
                      </div>
                      <div className="truncate text-xs font-medium text-[#2E286C]/55">
                        {record.courseLabel}
                      </div>
                    </div>
                    {record.installmentLabel && (
                      <StatusChip tone="purple">
                        {record.installmentLabel}
                      </StatusChip>
                    )}
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/40">
                        {t('colDeclared')}
                      </div>
                      <div className="text-lg font-bold text-[#2E286C]">
                        {formatMoney(record.declaredAmountCents ?? 0)}
                      </div>
                    </div>
                    <div className="text-xs font-medium text-[#2E286C]/50">
                      {dateTimeFormat.format(new Date(record.reportedAt))}
                    </div>
                  </div>
                  {record.studentNote && (
                    <p className="mt-2 text-xs font-medium italic text-[#2E286C]/55">
                      {record.studentNote}
                    </p>
                  )}
                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => openConfirm(record)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t('confirm')}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => openReject(record)}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      {t('reject')}
                    </Button>
                  </div>
                </ModulePanel>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-black/[0.03] bg-[#F8F9FC] text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/50">
                    <th className="px-6 py-4 font-bold">{t('colStudent')}</th>
                    <th className="px-6 py-4 font-bold">{t('colCourse')}</th>
                    <th className="px-6 py-4 font-bold">
                      {t('colInstallment')}
                    </th>
                    <th className="px-6 py-4 font-bold">{t('colDeclared')}</th>
                    <th className="px-6 py-4 font-bold">
                      {t('colReportedAt')}
                    </th>
                    <th className="px-6 py-4" aria-hidden="true" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.02] text-sm font-medium text-[#2E286C]/80">
                  {data.pending.map((record) => (
                    <tr
                      key={record.id}
                      className="transition-colors hover:bg-black/[0.01]"
                    >
                      <td className="px-6 py-4">
                        <div className="font-bold text-[#2E286C]">
                          {record.studentName}
                        </div>
                        {record.studentNote && (
                          <div className="mt-0.5 max-w-56 truncate text-xs font-medium italic text-[#2E286C]/50">
                            {record.studentNote}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-[#2E286C]/60">
                        {record.courseLabel}
                      </td>
                      <td className="px-6 py-4 text-[#2E286C]/60">
                        {record.installmentLabel ?? '—'}
                      </td>
                      <td className="px-6 py-4 text-base font-bold text-[#2E286C]">
                        {formatMoney(record.declaredAmountCents ?? 0)}
                      </td>
                      <td className="px-6 py-4 text-[#2E286C]/60">
                        {dateTimeFormat.format(new Date(record.reportedAt))}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => openConfirm(record)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {t('confirm')}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="border-red-200 text-red-600 hover:bg-red-50"
                            onClick={() => openReject(record)}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            {t('reject')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </ModulePanel>

      {/* Account totals */}
      <section>
        <SectionHeader title={t('accountTitle')} className="mb-4" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 lg:gap-6">
          <KpiCard
            icon={Wallet}
            label={t('totalCollected')}
            value={formatMoney(data.totals.confirmedCents)}
          />
          <KpiCard
            icon={Banknote}
            label={t('teacherShare')}
            value={formatMoney(data.totals.teacherCents)}
          />
          <KpiCard
            icon={Landmark}
            label={t('zumraShare')}
            value={formatMoney(data.totals.zumraCents)}
          />
          <KpiCard
            icon={Handshake}
            label={t('unsettled')}
            value={formatMoney(data.totals.unsettledZumraCents)}
            trend={{ label: t('unsettledHint') }}
          />
        </div>
      </section>

      {/* Commission rates + bank account */}
      <div className="grid gap-6 xl:grid-cols-3">
        <ModulePanel className="xl:col-span-2">
          <SectionHeader title={t('ratesTitle')} className="mb-2" />
          <ul className="divide-y divide-black/[0.04]">
            {data.commissionRates.branches.map((rate, index) => (
              <li
                key={`${rate.courseLabel}-${index}`}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-3"
              >
                <span className="text-sm font-bold text-[#2E286C]">
                  {rate.courseLabel}
                </span>
                <span className="text-sm font-semibold text-[#533089]">
                  {shareLabel(rate.teacherShareBasisPoints)}
                </span>
              </li>
            ))}
            <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-3">
              <span className="text-sm font-bold text-[#2E286C]">
                {t('privateRateLabel')}
              </span>
              {data.commissionRates.privateShareBasisPoints === null ? (
                <StatusChip tone="gray">{t('rateNotSet')}</StatusChip>
              ) : (
                <span className="text-sm font-semibold text-[#533089]">
                  {shareLabel(data.commissionRates.privateShareBasisPoints)}
                </span>
              )}
            </li>
          </ul>
        </ModulePanel>

        <ModulePanel>
          <SectionHeader title={t('bankTitle')} className="mb-4" />
          {data.bankAccount ? (
            <div className="rounded-2xl border border-black/[0.03] bg-[#F8F9FC] p-4">
              <p className="break-all font-mono text-sm font-bold tracking-wide text-[#2E286C]">
                {data.bankAccount.iban}
              </p>
              {data.bankAccount.holderName && (
                <p className="mt-1 text-xs font-semibold text-[#2E286C]/50">
                  {data.bankAccount.holderName}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm font-semibold text-[#2E286C]/45">
              {t('noBank')}
            </p>
          )}
        </ModulePanel>
      </div>

      {/* Settlement history */}
      <ModulePanel padded={false} className="overflow-hidden">
        <div className="border-b border-black/[0.03] p-5 lg:p-6">
          <SectionHeader title={t('settlementsTitle')} className="mb-0" />
        </div>
        {data.settlements.length === 0 ? (
          <p className="p-8 text-center text-sm font-semibold text-[#2E286C]/45">
            {t('settlementsEmpty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-black/[0.03] bg-[#F8F9FC] text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/50">
                  <th className="px-6 py-4 font-bold">
                    {t('colSettlementDate')}
                  </th>
                  <th className="px-6 py-4 font-bold">
                    {t('colSettlementTotal')}
                  </th>
                  <th className="px-6 py-4" aria-hidden="true" />
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.02] text-sm font-medium text-[#2E286C]/80">
                {data.settlements.map((settlement) => (
                  <tr key={settlement.id}>
                    <td className="px-6 py-4 text-[#2E286C]/70">
                      {dateFormat.format(new Date(settlement.receivedAt))}
                    </td>
                    <td className="px-6 py-4 font-bold text-[#2E286C]">
                      {formatMoney(settlement.totalCents)}
                    </td>
                    <td className="px-6 py-4 text-xs text-[#2E286C]/50">
                      {settlement.note ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ModulePanel>

      {/* Past records */}
      <ModulePanel padded={false} className="overflow-hidden">
        <div className="border-b border-black/[0.03] p-5 lg:p-6">
          <SectionHeader title={t('historyTitle')} className="mb-0" />
        </div>
        {data.history.length === 0 ? (
          <p className="p-8 text-center text-sm font-semibold text-[#2E286C]/45">
            {t('historyEmpty')}
          </p>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-3 p-4 md:hidden">
              {data.history.map((record) => (
                <ModulePanel
                  key={record.id}
                  variant="muted"
                  className="rounded-2xl p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-bold text-[#2E286C]">
                        {record.studentName}
                      </div>
                      <div className="truncate text-xs font-medium text-[#2E286C]/55">
                        {record.courseLabel}
                        {record.installmentLabel
                          ? ` · ${record.installmentLabel}`
                          : ''}
                      </div>
                    </div>
                    <StatusChip
                      tone={record.status === 'confirmed' ? 'emerald' : 'red'}
                    >
                      {record.status === 'confirmed'
                        ? t('statusConfirmed')
                        : t('statusRejected')}
                    </StatusChip>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div className="font-bold text-[#2E286C]">
                      {formatMoney(
                        record.amountCents ?? record.declaredAmountCents ?? 0,
                      )}
                    </div>
                    {record.status === 'confirmed' && (
                      <StatusChip tone={record.settled ? 'blue' : 'amber'}>
                        {record.settled ? t('settledYes') : t('settledNo')}
                      </StatusChip>
                    )}
                  </div>
                  {record.receiptMediaAssetId && (
                    <a
                      href={`/api/media/${record.receiptMediaAssetId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#533089] hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {t('receiptLink')}
                    </a>
                  )}
                </ModulePanel>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-black/[0.03] bg-[#F8F9FC] text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/50">
                    <th className="px-6 py-4 font-bold">{t('colStudent')}</th>
                    <th className="px-6 py-4 font-bold">{t('colCourse')}</th>
                    <th className="px-6 py-4 font-bold">
                      {t('colInstallment')}
                    </th>
                    <th className="px-6 py-4 font-bold">{t('colAmount')}</th>
                    <th className="px-6 py-4 font-bold">{t('colStatus')}</th>
                    <th className="px-6 py-4 font-bold">{t('colSettled')}</th>
                    <th className="px-6 py-4" aria-hidden="true" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.02] text-sm font-medium text-[#2E286C]/80">
                  {data.history.map((record) => (
                    <tr
                      key={record.id}
                      className="transition-colors hover:bg-black/[0.01]"
                    >
                      <td className="px-6 py-4 font-bold text-[#2E286C]">
                        {record.studentName}
                      </td>
                      <td className="px-6 py-4 text-[#2E286C]/60">
                        {record.courseLabel}
                      </td>
                      <td className="px-6 py-4 text-[#2E286C]/60">
                        {record.installmentLabel ?? '—'}
                      </td>
                      <td className="px-6 py-4 font-bold text-[#2E286C]">
                        {formatMoney(
                          record.amountCents ?? record.declaredAmountCents ?? 0,
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <StatusChip
                          tone={
                            record.status === 'confirmed' ? 'emerald' : 'red'
                          }
                        >
                          {record.status === 'confirmed'
                            ? t('statusConfirmed')
                            : t('statusRejected')}
                        </StatusChip>
                      </td>
                      <td className="px-6 py-4">
                        {record.status === 'confirmed' ? (
                          <StatusChip tone={record.settled ? 'blue' : 'amber'}>
                            {record.settled ? t('settledYes') : t('settledNo')}
                          </StatusChip>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {record.receiptMediaAssetId && (
                          <a
                            href={`/api/media/${record.receiptMediaAssetId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#533089] hover:underline"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            {t('receiptLink')}
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </ModulePanel>

      {/* Confirm modal */}
      {confirmTarget && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#221B4B]/35 p-3 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) {
              setConfirmTarget(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-payment-title"
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <ReceiptText className="h-5 w-5" />
                </div>
                <div>
                  <h2
                    id="confirm-payment-title"
                    className="text-lg font-bold text-[#2E286C]"
                  >
                    {t('confirmTitle')}
                  </h2>
                  <p className="mt-1 text-sm leading-5 text-[#2E286C]/50">
                    {t('confirmHint', {
                      amount: formatMoney(
                        confirmTarget.declaredAmountCents ?? 0,
                      ),
                    })}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label={t('cancel')}
                disabled={busy}
                onClick={() => setConfirmTarget(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#2E286C]/40 transition-colors hover:bg-black/[0.03] hover:text-[#2E286C]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-black/[0.03] bg-[#F8F9FC] px-4 py-3 text-sm">
              <span className="font-bold text-[#2E286C]">
                {confirmTarget.studentName}
              </span>
              <span className="text-[#2E286C]/55">
                {' · '}
                {confirmTarget.courseLabel}
                {confirmTarget.installmentLabel
                  ? ` · ${confirmTarget.installmentLabel}`
                  : ''}
              </span>
              {confirmTarget.studentNote && (
                <p className="mt-1 text-xs font-medium italic text-[#2E286C]/55">
                  {confirmTarget.studentNote}
                </p>
              )}
            </div>

            <div className="mt-5 space-y-5">
              <FormField label={t('confirmAmount')} required>
                <Input
                  inputMode="decimal"
                  value={amountValue}
                  onChange={(event) => setAmountValue(event.target.value)}
                />
              </FormField>

              {(mismatch || reviewNote) && (
                <FormField label={t('mismatchNote')}>
                  <textarea
                    className={textareaClassName}
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                  />
                </FormField>
              )}

              <FormField
                label={t('receipt')}
                description={t('receiptHint')}
                required
              >
                <AttachmentInput
                  value={receipt}
                  onChange={(next) => setReceipt(next.slice(-1))}
                  disabled={busy}
                  labels={{
                    add: t('attachmentsAdd'),
                    error: t('attachmentsError'),
                    uploading: t('attachmentsUploading'),
                  }}
                />
              </FormField>

              {error && (
                <p className="text-sm font-semibold text-red-600">{error}</p>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setConfirmTarget(null)}
                >
                  {t('cancel')}
                </Button>
                <Button
                  disabled={
                    busy || !receipt.length || confirmAmountCents === null
                  }
                  onClick={submitConfirm}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {t('submit')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#221B4B]/35 p-3 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) {
              setRejectTarget(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-payment-title"
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                  <XCircle className="h-5 w-5" />
                </div>
                <div>
                  <h2
                    id="reject-payment-title"
                    className="text-lg font-bold text-[#2E286C]"
                  >
                    {t('rejectTitle')}
                  </h2>
                  <p className="mt-1 text-sm leading-5 text-[#2E286C]/50">
                    {rejectTarget.studentName}
                    {' · '}
                    {formatMoney(rejectTarget.declaredAmountCents ?? 0)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label={t('cancel')}
                disabled={busy}
                onClick={() => setRejectTarget(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#2E286C]/40 transition-colors hover:bg-black/[0.03] hover:text-[#2E286C]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <FormField label={t('rejectReason')} required>
                <textarea
                  className={textareaClassName}
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                />
              </FormField>

              {error && (
                <p className="text-sm font-semibold text-red-600">{error}</p>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setRejectTarget(null)}
                >
                  {t('cancel')}
                </Button>
                <Button
                  disabled={busy || !rejectReason.trim()}
                  onClick={submitReject}
                  className="bg-red-600 shadow-red-600/20 hover:bg-red-700"
                >
                  <XCircle className="h-4 w-4" />
                  {t('reject')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
