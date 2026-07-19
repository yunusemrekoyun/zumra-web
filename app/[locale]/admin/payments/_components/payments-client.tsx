'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Handshake,
  Loader2,
  Percent,
  Plus,
  Printer,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { APP_TIME_ZONE } from '@/lib/datetime';
import { centsToInput, parseTlToCents } from '@/lib/domain/money';
import { AttachmentInput, type Attachment } from '@/components/attachment-input';
import {
  Button,
  Card,
  EntityPickerField,
  FilterTabs,
  FormField,
  Input,
  KpiCard,
  SearchInput,
  StatusChip,
} from '@/components/ui';
import type {
  InstallmentView,
  PaymentRecordView,
} from '@/lib/server/services/payments';

export type AdminPaymentStats = {
  monthConfirmedCents: number;
  overdueCents: number;
  overdueCount: number;
  pendingCount: number;
  pendingDeclaredCents: number;
  unsettledZumraCents: number;
};

export type PayableEnrollmentOption = {
  courseLabel: string;
  id: string;
  installments: InstallmentView[];
  studentName: string;
};

type StatusFilter = 'all' | 'confirmed' | 'rejected' | 'reported';

const statusKeys = {
  confirmed: 'statusConfirmed',
  rejected: 'statusRejected',
  reported: 'statusReported',
} as const;

const statusTones = {
  confirmed: 'emerald',
  rejected: 'red',
  reported: 'amber',
} as const;

const selectClassName =
  'h-10 w-full rounded-xl border border-[#2E286C]/10 bg-[#F8F9FC] px-3 text-sm font-medium text-[#2E286C] outline-none transition-all focus:border-[#533089]/30';
const textareaClassName =
  'min-h-20 w-full rounded-xl border border-[#2E286C]/10 bg-[#F8F9FC] px-4 py-3 text-sm font-medium text-[#2E286C] outline-none transition-all placeholder:text-[#2E286C]/35 focus:border-[#533089]/30';
const secondaryLinkClassName =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white px-4 text-xs font-bold uppercase tracking-wider text-[#2E286C] transition-colors hover:bg-black/[0.03]';

function formatTry(cents: number) {
  return `${(cents / 100).toLocaleString('tr-TR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} ₺`;
}

export function AdminPaymentsClient({
  enrollments,
  payments,
  stats,
}: {
  enrollments: PayableEnrollmentOption[];
  payments: PaymentRecordView[];
  stats: AdminPaymentStats;
}) {
  const t = useTranslations('admin.payments');
  const locale = useLocale();
  const router = useRouter();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');

  // Confirm modal state.
  const [confirmTarget, setConfirmTarget] = useState<PaymentRecordView | null>(
    null,
  );
  const [confirmAmount, setConfirmAmount] = useState('');
  const [confirmNote, setConfirmNote] = useState('');
  const [confirmReceipt, setConfirmReceipt] = useState<Attachment[]>([]);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string>();

  // Reject modal state.
  const [rejectTarget, setRejectTarget] = useState<PaymentRecordView | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState('');
  const [rejectBusy, setRejectBusy] = useState(false);
  const [rejectError, setRejectError] = useState<string>();

  // Staff collection modal state.
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordEnrollmentId, setRecordEnrollmentId] = useState('');
  const [recordInstallmentId, setRecordInstallmentId] = useState('');
  const [recordAmount, setRecordAmount] = useState('');
  const [recordMethod, setRecordMethod] = useState('bank_transfer');
  const [recordNote, setRecordNote] = useState('');
  const [recordReceipt, setRecordReceipt] = useState<Attachment[]>([]);
  const [recordBusy, setRecordBusy] = useState(false);
  const [recordError, setRecordError] = useState<string>();

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        month: 'short',
        timeZone: APP_TIME_ZONE,
      }),
    [locale],
  );
  const dueDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    [locale],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr-TR');
    return payments.filter((payment) => {
      if (statusFilter !== 'all' && payment.status !== statusFilter) {
        return false;
      }
      if (
        needle &&
        !payment.studentName.toLocaleLowerCase('tr-TR').includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [payments, query, statusFilter]);

  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (query.trim()) params.set('query', query.trim());
    const suffix = params.toString();
    return suffix
      ? `/api/admin/payments-export?${suffix}`
      : '/api/admin/payments-export';
  }, [query, statusFilter]);

  const selectedEnrollment = useMemo(
    () =>
      enrollments.find((enrollment) => enrollment.id === recordEnrollmentId) ??
      null,
    [enrollments, recordEnrollmentId],
  );

  function openConfirm(payment: PaymentRecordView) {
    setConfirmTarget(payment);
    setConfirmAmount(
      payment.declaredAmountCents !== null
        ? centsToInput(payment.declaredAmountCents)
        : '',
    );
    setConfirmNote('');
    setConfirmReceipt([]);
    setConfirmError(undefined);
  }

  function openReject(payment: PaymentRecordView) {
    setRejectTarget(payment);
    setRejectReason('');
    setRejectError(undefined);
  }

  function resetRecordModal() {
    setRecordEnrollmentId('');
    setRecordInstallmentId('');
    setRecordAmount('');
    setRecordMethod('bank_transfer');
    setRecordNote('');
    setRecordReceipt([]);
    setRecordError(undefined);
  }

  function mapApiError(code: string | undefined) {
    return code === 'commission_rate_missing'
      ? t('commissionMissing')
      : t('errorGeneric');
  }

  async function submitConfirm() {
    if (!confirmTarget) return;
    const amountCents = parseTlToCents(confirmAmount);
    if (amountCents === null) {
      setConfirmError(t('errorGeneric'));
      return;
    }
    setConfirmBusy(true);
    setConfirmError(undefined);
    try {
      const response = await fetch(
        `/api/payments/${confirmTarget.id}/confirm`,
        {
          body: JSON.stringify({
            amountCents,
            receiptMediaAssetId: confirmReceipt[0]?.mediaAssetId,
            reviewNote: confirmNote.trim() || undefined,
          }),
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        },
      );
      if (response.ok) {
        setConfirmTarget(null);
        router.refresh();
        return;
      }
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setConfirmError(mapApiError(body.error));
    } catch {
      setConfirmError(t('errorGeneric'));
    } finally {
      setConfirmBusy(false);
    }
  }

  async function submitReject() {
    if (!rejectTarget || !rejectReason.trim()) return;
    setRejectBusy(true);
    setRejectError(undefined);
    try {
      const response = await fetch(`/api/payments/${rejectTarget.id}/reject`, {
        body: JSON.stringify({ reason: rejectReason.trim() }),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      if (response.ok) {
        setRejectTarget(null);
        router.refresh();
        return;
      }
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setRejectError(mapApiError(body.error));
    } catch {
      setRejectError(t('errorGeneric'));
    } finally {
      setRejectBusy(false);
    }
  }

  async function submitRecord() {
    const amountCents = parseTlToCents(recordAmount);
    if (!recordEnrollmentId || amountCents === null) {
      setRecordError(t('errorGeneric'));
      return;
    }
    setRecordBusy(true);
    setRecordError(undefined);
    try {
      const response = await fetch('/api/payments/staff', {
        body: JSON.stringify({
          amountCents,
          enrollmentId: recordEnrollmentId,
          installmentId: recordInstallmentId || undefined,
          method: recordMethod,
          note: recordNote.trim() || undefined,
          receiptMediaAssetId: recordReceipt[0]?.mediaAssetId,
        }),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      if (response.ok) {
        setRecordOpen(false);
        resetRecordModal();
        router.refresh();
        return;
      }
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setRecordError(mapApiError(body.error));
    } catch {
      setRecordError(t('errorGeneric'));
    } finally {
      setRecordBusy(false);
    }
  }

  const attachmentLabels = {
    add: t('uploadReceipt'),
    error: t('uploadFailed'),
    uploading: t('uploading'),
  };

  const filterItems = [
    { label: t('filterAll'), value: 'all' },
    { label: t('statusReported'), value: 'reported' },
    { label: t('statusConfirmed'), value: 'confirmed' },
    { label: t('statusRejected'), value: 'rejected' },
  ];

  return (
    <div className="space-y-4 lg:space-y-6">
      <style>{`
        @media print {
          html, body { height: auto !important; overflow: visible !important; }
          body div { height: auto !important; overflow: visible !important; }
          aside, header, nav, .print-hide { display: none !important; }
          #admin-payments-print { display: block !important; }
          #admin-payments-print table { width: 100%; }
        }
      `}</style>

      <div className="admin-kpi-grid print-hide">
        <KpiCard
          label={t('kpiMonthCollected')}
          value={formatTry(stats.monthConfirmedCents)}
        />
        <KpiCard
          label={t('kpiPendingReview')}
          value={stats.pendingCount}
          trend={{
            label: t('kpiPendingAmount', {
              amount: formatTry(stats.pendingDeclaredCents),
            }),
          }}
        />
        <KpiCard
          label={t('kpiOverdue')}
          value={formatTry(stats.overdueCents)}
          trend={{ label: t('kpiOverdueCount', { count: stats.overdueCount }) }}
        />
        <KpiCard
          label={t('kpiUnsettled')}
          value={formatTry(stats.unsettledZumraCents)}
        />
      </div>

      <div className="print-hide flex flex-wrap gap-3">
        <Link href="/admin/payments/komisyonlar" className={secondaryLinkClassName}>
          <Percent className="h-4 w-4" />
          {t('commissionsLink')}
        </Link>
        <Link href="/admin/payments/mutabakat" className={secondaryLinkClassName}>
          <Handshake className="h-4 w-4" />
          {t('settlementsLink')}
        </Link>
        <a href={exportHref} className={secondaryLinkClassName}>
          <FileSpreadsheet className="h-4 w-4" />
          {t('exportCsv')}
        </a>
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          {t('print')}
        </Button>
        <Button
          onClick={() => {
            resetRecordModal();
            setRecordOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          {t('recordPayment')}
        </Button>
      </div>

      <Card padded={false} className="overflow-hidden">
        <div className="print-hide flex flex-col gap-4 border-b border-black/[0.03] p-5 md:flex-row md:items-center md:justify-between lg:p-6">
          <FilterTabs
            activeValue={statusFilter}
            items={filterItems}
            onChange={(value) => setStatusFilter(value as StatusFilter)}
          />
          <SearchInput
            containerClassName="w-full md:w-64"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchPlaceholder')}
            value={query}
          />
        </div>

        {/* Mobile cards */}
        <div className="print-hide space-y-3 p-4 md:hidden">
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm font-semibold text-[#2E286C]/45">
              {t('empty')}
            </p>
          )}
          {filtered.map((payment) => (
            <div
              key={payment.id}
              className="rounded-2xl border border-black/[0.03] bg-[#F8F9FC] p-4"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-bold text-[#2E286C]">
                    {payment.studentName}
                  </div>
                  <div className="truncate text-xs font-medium text-[#2E286C]/55">
                    {payment.courseLabel}
                    {payment.installmentLabel
                      ? ` · ${payment.installmentLabel}`
                      : ''}
                  </div>
                  <div className="truncate text-xs font-medium text-[#2E286C]/45">
                    {payment.instructorName}
                  </div>
                </div>
                <StatusChip tone={statusTones[payment.status]}>
                  {t(statusKeys[payment.status])}
                </StatusChip>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <MobileStat
                  label={t('colDeclared')}
                  value={
                    payment.declaredAmountCents !== null
                      ? formatTry(payment.declaredAmountCents)
                      : '—'
                  }
                />
                <MobileStat
                  label={t('colAmount')}
                  value={
                    payment.amountCents !== null
                      ? formatTry(payment.amountCents)
                      : '—'
                  }
                />
                <MobileStat
                  label={t('colZumraShare')}
                  value={
                    payment.zumraShareCents !== null
                      ? formatTry(payment.zumraShareCents)
                      : '—'
                  }
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#2E286C]/45">
                  {dateFormatter.format(new Date(payment.reportedAt))}
                </span>
                {payment.status === 'confirmed' && (
                  <StatusChip tone={payment.settled ? 'purple' : 'gray'}>
                    {payment.settled ? t('settledYes') : t('settledNo')}
                  </StatusChip>
                )}
              </div>
              {(payment.receiptMediaAssetId ||
                payment.status === 'reported') && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {payment.receiptMediaAssetId && (
                    <ReceiptLink
                      label={t('receipt')}
                      mediaAssetId={payment.receiptMediaAssetId}
                    />
                  )}
                  {payment.status === 'reported' && (
                    <>
                      <Button size="sm" onClick={() => openConfirm(payment)}>
                        {t('confirm')}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="text-red-600"
                        onClick={() => openReject(payment)}
                      >
                        {t('reject')}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Desktop table (also the print area) */}
        <div id="admin-payments-print" className="admin-table-wrap hidden md:block">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-black/[0.03] bg-[#F8F9FC] text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/50">
                <th className="px-4 py-3 font-bold">{t('colStudent')}</th>
                <th className="px-4 py-3 font-bold">{t('colCourse')}</th>
                <th className="px-4 py-3 font-bold">{t('colInstallment')}</th>
                <th className="px-4 py-3 font-bold">{t('colInstructor')}</th>
                <th className="px-4 py-3 text-right font-bold">
                  {t('colDeclared')}
                </th>
                <th className="px-4 py-3 text-right font-bold">
                  {t('colAmount')}
                </th>
                <th className="px-4 py-3 text-right font-bold">
                  {t('colZumraShare')}
                </th>
                <th className="px-4 py-3 font-bold">{t('colStatus')}</th>
                <th className="px-4 py-3 font-bold">{t('colReportedAt')}</th>
                <th className="px-4 py-3 font-bold">{t('colSettled')}</th>
                <th className="print-hide px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.02] text-sm font-medium text-[#2E286C]/80">
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-10 text-center text-sm font-semibold text-[#2E286C]/45"
                  >
                    {t('empty')}
                  </td>
                </tr>
              )}
              {filtered.map((payment) => (
                <tr
                  key={payment.id}
                  className="transition-colors hover:bg-black/[0.01]"
                >
                  <td className="px-4 py-3 font-bold text-[#2E286C]">
                    {payment.studentName}
                  </td>
                  <td className="px-4 py-3 text-[#2E286C]/60">
                    {payment.courseLabel}
                  </td>
                  <td className="px-4 py-3 text-[#2E286C]/60">
                    {payment.installmentLabel ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-[#2E286C]/60">
                    {payment.instructorName}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {payment.declaredAmountCents !== null
                      ? formatTry(payment.declaredAmountCents)
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-[#2E286C]">
                    {payment.amountCents !== null
                      ? formatTry(payment.amountCents)
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {payment.zumraShareCents !== null
                      ? formatTry(payment.zumraShareCents)
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip tone={statusTones[payment.status]}>
                      {t(statusKeys[payment.status])}
                    </StatusChip>
                  </td>
                  <td className="px-4 py-3 text-[#2E286C]/60">
                    {dateFormatter.format(new Date(payment.reportedAt))}
                  </td>
                  <td className="px-4 py-3">
                    {payment.status === 'confirmed' ? (
                      <StatusChip tone={payment.settled ? 'purple' : 'gray'}>
                        {payment.settled ? t('settledYes') : t('settledNo')}
                      </StatusChip>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="print-hide px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {payment.receiptMediaAssetId && (
                        <ReceiptLink
                          label={t('receipt')}
                          mediaAssetId={payment.receiptMediaAssetId}
                        />
                      )}
                      {payment.status === 'reported' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => openConfirm(payment)}
                          >
                            {t('confirm')}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="text-red-600"
                            onClick={() => openReject(payment)}
                          >
                            {t('reject')}
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {confirmTarget && (
        <Modal
          closeLabel={t('cancel')}
          onClose={() => setConfirmTarget(null)}
          title={t('confirmTitle')}
        >
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#F8F9FC] p-4 text-sm font-medium text-[#2E286C]/70">
              <div className="font-bold text-[#2E286C]">
                {confirmTarget.studentName}
              </div>
              <div>
                {confirmTarget.courseLabel}
                {confirmTarget.installmentLabel
                  ? ` · ${confirmTarget.installmentLabel}`
                  : ''}
              </div>
              {confirmTarget.declaredAmountCents !== null && (
                <div className="mt-1">
                  {t('colDeclared')}:{' '}
                  <span className="font-bold text-[#2E286C]">
                    {formatTry(confirmTarget.declaredAmountCents)}
                  </span>
                </div>
              )}
            </div>
            <FormField label={t('confirmAmount')} required>
              <Input
                inputMode="decimal"
                onChange={(event) => setConfirmAmount(event.target.value)}
                value={confirmAmount}
              />
            </FormField>
            <FormField label={t('confirmNote')}>
              <textarea
                className={textareaClassName}
                onChange={(event) => setConfirmNote(event.target.value)}
                value={confirmNote}
              />
            </FormField>
            <FormField label={t('modalReceipt')}>
              <AttachmentInput
                disabled={confirmBusy}
                labels={attachmentLabels}
                onChange={(next) => setConfirmReceipt(next.slice(-1))}
                value={confirmReceipt}
              />
            </FormField>
            {confirmError && (
              <p className="text-sm font-semibold text-red-600">
                {confirmError}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setConfirmTarget(null)}
              >
                {t('cancel')}
              </Button>
              <Button disabled={confirmBusy} onClick={submitConfirm}>
                {confirmBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('confirm')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {rejectTarget && (
        <Modal
          closeLabel={t('cancel')}
          onClose={() => setRejectTarget(null)}
          title={t('reject')}
        >
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#F8F9FC] p-4 text-sm font-medium text-[#2E286C]/70">
              <div className="font-bold text-[#2E286C]">
                {rejectTarget.studentName}
              </div>
              <div>
                {rejectTarget.courseLabel}
                {rejectTarget.installmentLabel
                  ? ` · ${rejectTarget.installmentLabel}`
                  : ''}
              </div>
            </div>
            <FormField label={t('rejectReason')} required>
              <textarea
                className={textareaClassName}
                onChange={(event) => setRejectReason(event.target.value)}
                value={rejectReason}
              />
            </FormField>
            {rejectError && (
              <p className="text-sm font-semibold text-red-600">
                {rejectError}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setRejectTarget(null)}>
                {t('cancel')}
              </Button>
              <Button
                className="bg-red-600 shadow-red-600/20 hover:bg-red-700"
                disabled={rejectBusy || !rejectReason.trim()}
                onClick={submitReject}
              >
                {rejectBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('reject')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {recordOpen && (
        <Modal
          closeLabel={t('cancel')}
          onClose={() => setRecordOpen(false)}
          title={t('modalTitle')}
        >
          <div className="space-y-4">
            <FormField label={t('modalEnrollment')} required>
              <EntityPickerField
                icon={GraduationCap}
                items={enrollments.map((enrollment) => ({
                  id: enrollment.id,
                  identity: {
                    kind: 'person' as const,
                    name: enrollment.studentName,
                  },
                  subtitle: enrollment.courseLabel,
                  title: enrollment.studentName,
                }))}
                onSelect={(item) => {
                  setRecordEnrollmentId(item.id);
                  setRecordInstallmentId('');
                }}
                placeholder={t('modalEnrollmentPlaceholder')}
                title={t('modalEnrollment')}
                value={
                  selectedEnrollment
                    ? {
                        id: selectedEnrollment.id,
                        identity: {
                          kind: 'person' as const,
                          name: selectedEnrollment.studentName,
                        },
                        subtitle: selectedEnrollment.courseLabel,
                        title: selectedEnrollment.studentName,
                      }
                    : null
                }
              />
            </FormField>

            {selectedEnrollment && (
              <FormField label={t('modalInstallment')}>
                <select
                  className={selectClassName}
                  onChange={(event) => {
                    const installmentId = event.target.value;
                    setRecordInstallmentId(installmentId);
                    const installment = selectedEnrollment.installments.find(
                      (row) => row.id === installmentId,
                    );
                    if (installment) {
                      const remaining =
                        installment.amountCents - installment.paidCents;
                      if (remaining > 0) {
                        setRecordAmount(centsToInput(remaining));
                      }
                    }
                  }}
                  value={recordInstallmentId}
                >
                  <option value="">{t('modalInstallmentNone')}</option>
                  {selectedEnrollment.installments.map((installment) => (
                    <option key={installment.id} value={installment.id}>
                      {`${installment.label ?? `#${installment.sequence}`} · ${formatTry(installment.amountCents)} · ${dueDateFormatter.format(new Date(`${installment.dueDate}T00:00:00`))}`}
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={t('modalAmount')} required>
                <Input
                  inputMode="decimal"
                  onChange={(event) => setRecordAmount(event.target.value)}
                  value={recordAmount}
                />
              </FormField>
              <FormField label={t('modalMethod')}>
                <select
                  className={selectClassName}
                  onChange={(event) => setRecordMethod(event.target.value)}
                  value={recordMethod}
                >
                  <option value="bank_transfer">
                    {t('methodBankTransfer')}
                  </option>
                  <option value="cash">{t('methodCash')}</option>
                  <option value="other">{t('methodOther')}</option>
                </select>
              </FormField>
            </div>

            <FormField label={t('modalNote')}>
              <textarea
                className={textareaClassName}
                onChange={(event) => setRecordNote(event.target.value)}
                value={recordNote}
              />
            </FormField>

            <FormField label={t('modalReceipt')}>
              <AttachmentInput
                disabled={recordBusy}
                labels={attachmentLabels}
                onChange={(next) => setRecordReceipt(next.slice(-1))}
                value={recordReceipt}
              />
            </FormField>

            {recordError && (
              <p className="text-sm font-semibold text-red-600">
                {recordError}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setRecordOpen(false)}>
                {t('cancel')}
              </Button>
              <Button
                disabled={recordBusy || !recordEnrollmentId}
                onClick={submitRecord}
              >
                {recordBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('modalSubmit')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function MobileStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/40">
        {label}
      </div>
      <div className="font-bold text-[#2E286C]">{value}</div>
    </div>
  );
}

function ReceiptLink({
  label,
  mediaAssetId,
}: {
  label: string;
  mediaAssetId: string;
}) {
  return (
    <a
      className="inline-flex items-center gap-1.5 rounded-xl bg-[#533089]/8 px-3 py-1.5 text-xs font-bold text-[#533089] transition-colors hover:bg-[#533089]/15"
      href={`/api/media/${mediaAssetId}`}
      rel="noreferrer"
      target="_blank"
    >
      <FileText className="h-3.5 w-3.5" />
      {label}
    </a>
  );
}

function Modal({
  children,
  closeLabel,
  onClose,
  title,
}: {
  children: ReactNode;
  closeLabel: string;
  onClose: () => void;
  title: string;
}) {
  return (
    <div
      className="print-hide fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="font-rosmatika text-xl font-medium text-[#2E286C]">
            {title}
          </h3>
          <button
            aria-label={closeLabel}
            className="rounded-full p-1.5 text-[#2E286C]/40 transition-colors hover:bg-black/5 hover:text-[#2E286C]"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
