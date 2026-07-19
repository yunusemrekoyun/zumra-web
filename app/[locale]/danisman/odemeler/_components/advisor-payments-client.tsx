'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CheckCircle2, ClipboardList, Paperclip } from 'lucide-react';
import type {
  InstallmentView,
  PaymentRecordView,
} from '@/lib/server/services/payments';
import {
  Avatar,
  Button,
  Card,
  FilterTabs,
  IconButton,
  ModulePanel,
  SearchInput,
  StatusChip,
} from '@/components/ui';
import { PaymentReviewModal } from './payment-review-modal';
import { PlanEditorModal } from './plan-editor-modal';
import { RecordPaymentModal } from './record-payment-modal';
import { formatCents, formatDateTime } from './format';

export type PayableEnrollment = {
  courseLabel: string;
  id: string;
  installments: InstallmentView[];
  studentName: string;
};

type StatusFilter = 'all' | 'confirmed' | 'rejected' | 'reported';

const STATUS_TONES = {
  confirmed: 'emerald',
  rejected: 'red',
  reported: 'amber',
} as const;

export function AdvisorPaymentsClient({
  enrollments,
  locale,
  payments,
}: {
  enrollments: PayableEnrollment[];
  locale: string;
  payments: PaymentRecordView[];
}) {
  const t = useTranslations('advisor.payments');
  const router = useRouter();
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [review, setReview] = useState<{
    mode: 'confirm' | 'reject';
    payment: PaymentRecordView;
  }>();
  const [recordOpen, setRecordOpen] = useState(false);
  const [plan, setPlan] = useState<{ enrollmentId?: string }>();
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    if (!notice) {
      return;
    }
    const timer = setTimeout(() => setNotice(undefined), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const payableIds = useMemo(
    () => new Set(enrollments.map((enrollment) => enrollment.id)),
    [enrollments],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return payments.filter((payment) => {
      if (filter !== 'all' && payment.status !== filter) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return [
        payment.studentName,
        payment.courseLabel,
        payment.instructorName,
      ].some((value) => value.toLowerCase().includes(needle));
    });
  }, [filter, payments, query]);

  const statusLabels: Record<PaymentRecordView['status'], string> = {
    confirmed: t('statusConfirmed'),
    rejected: t('statusRejected'),
    reported: t('statusReported'),
  };

  function finishMutation(message: string) {
    setReview(undefined);
    setRecordOpen(false);
    setPlan(undefined);
    setNotice(message);
    router.refresh();
  }

  function renderActions(payment: PaymentRecordView) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {payment.receiptMediaAssetId && (
          <a
            href={`/api/media/${payment.receiptMediaAssetId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#533089]/8 px-2.5 py-1.5 text-xs font-bold text-[#533089] transition-colors hover:bg-[#533089]/15"
          >
            <Paperclip className="h-3.5 w-3.5" />
            {t('receipt')}
          </a>
        )}
        {payableIds.has(payment.enrollmentId) && (
          <IconButton
            aria-label={t('planEdit')}
            icon={<ClipboardList className="h-4 w-4" />}
            size="sm"
            variant="ghost"
            onClick={() => setPlan({ enrollmentId: payment.enrollmentId })}
          />
        )}
        {payment.status === 'reported' && (
          <>
            <Button
              size="sm"
              onClick={() => setReview({ mode: 'confirm', payment })}
            >
              {t('confirm')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setReview({ mode: 'reject', payment })}
              className="border-red-200 text-red-600 hover:bg-red-50"
            >
              {t('reject')}
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      {notice && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4 flex-none" />
          {notice}
        </div>
      )}

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <FilterTabs
          activeValue={filter}
          onChange={(value) => setFilter(value as StatusFilter)}
          items={[
            { label: t('filterAll'), value: 'all' },
            { label: t('statusReported'), value: 'reported' },
            { label: t('statusConfirmed'), value: 'confirmed' },
            { label: t('statusRejected'), value: 'rejected' },
          ]}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            placeholder={t('searchPlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            containerClassName="sm:w-64"
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={enrollments.length === 0}
              onClick={() => setPlan({})}
            >
              {t('planEdit')}
            </Button>
            <Button
              disabled={enrollments.length === 0}
              onClick={() => setRecordOpen(true)}
            >
              {t('recordPayment')}
            </Button>
          </div>
        </div>
      </div>

      <Card padded={false} className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm font-semibold text-[#2E286C]/45">
            {t('empty')}
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-3 p-4 md:hidden">
              {filtered.map((payment) => (
                <ModulePanel
                  key={payment.id}
                  variant="muted"
                  className="rounded-2xl p-4"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={payment.studentName} size="sm" />
                      <div className="min-w-0">
                        <div className="truncate font-bold text-[#2E286C]">
                          {payment.studentName}
                        </div>
                        <div className="truncate text-xs text-[#2E286C]/55">
                          {payment.courseLabel}
                          {payment.installmentLabel
                            ? ` • ${payment.installmentLabel}`
                            : ''}
                        </div>
                      </div>
                    </div>
                    <StatusChip tone={STATUS_TONES[payment.status]}>
                      {statusLabels[payment.status]}
                    </StatusChip>
                  </div>
                  <div className="mb-3 grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/40">
                        {t('colDeclared')}
                      </div>
                      <div className="font-bold text-[#2E286C]">
                        {payment.declaredAmountCents === null
                          ? '—'
                          : formatCents(payment.declaredAmountCents)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/40">
                        {t('colAmount')}
                      </div>
                      <div className="font-bold text-[#2E286C]">
                        {payment.amountCents === null
                          ? '—'
                          : formatCents(payment.amountCents)}
                      </div>
                    </div>
                  </div>
                  <div className="mb-3 text-xs text-[#2E286C]/50">
                    {payment.instructorName} •{' '}
                    {formatDateTime(payment.reportedAt, locale)}
                  </div>
                  {renderActions(payment)}
                </ModulePanel>
              ))}
            </div>

            {/* Desktop table */}
            <div className="admin-table-wrap hidden md:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-black/[0.03] bg-[#F8F9FC] text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/50">
                    <th className="px-5 py-4 font-bold">{t('colStudent')}</th>
                    <th className="px-5 py-4 font-bold">{t('colCourse')}</th>
                    <th className="px-5 py-4 font-bold">
                      {t('colInstallment')}
                    </th>
                    <th className="px-5 py-4 font-bold">
                      {t('colInstructor')}
                    </th>
                    <th className="px-5 py-4 font-bold">{t('colDeclared')}</th>
                    <th className="px-5 py-4 font-bold">{t('colAmount')}</th>
                    <th className="px-5 py-4 font-bold">{t('colStatus')}</th>
                    <th className="px-5 py-4 font-bold">
                      {t('colReportedAt')}
                    </th>
                    <th className="px-5 py-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.02] text-sm font-medium text-[#2E286C]/80">
                  {filtered.map((payment) => (
                    <tr
                      key={payment.id}
                      className="transition-colors hover:bg-black/[0.01]"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3 font-bold text-[#2E286C]">
                          <Avatar name={payment.studentName} size="sm" />
                          {payment.studentName}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-[#2E286C]/60">
                        {payment.courseLabel}
                      </td>
                      <td className="px-5 py-4 text-[#2E286C]/60">
                        {payment.installmentLabel ?? '—'}
                      </td>
                      <td className="px-5 py-4 text-[#2E286C]/60">
                        {payment.instructorName}
                      </td>
                      <td className="px-5 py-4 font-bold text-[#2E286C]">
                        {payment.declaredAmountCents === null
                          ? '—'
                          : formatCents(payment.declaredAmountCents)}
                      </td>
                      <td className="px-5 py-4 font-bold text-[#2E286C]">
                        {payment.amountCents === null
                          ? '—'
                          : formatCents(payment.amountCents)}
                      </td>
                      <td className="px-5 py-4">
                        <StatusChip tone={STATUS_TONES[payment.status]}>
                          {statusLabels[payment.status]}
                        </StatusChip>
                      </td>
                      <td className="px-5 py-4 text-[#2E286C]/60">
                        {formatDateTime(payment.reportedAt, locale)}
                      </td>
                      <td className="px-5 py-4">{renderActions(payment)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {review && (
        <PaymentReviewModal
          mode={review.mode}
          payment={review.payment}
          onClose={() => setReview(undefined)}
          onDone={finishMutation}
        />
      )}
      {recordOpen && (
        <RecordPaymentModal
          enrollments={enrollments}
          locale={locale}
          onClose={() => setRecordOpen(false)}
          onDone={finishMutation}
        />
      )}
      {plan && (
        <PlanEditorModal
          enrollments={enrollments}
          initialEnrollmentId={plan.enrollmentId}
          locale={locale}
          onClose={() => setPlan(undefined)}
          onDone={finishMutation}
        />
      )}
    </>
  );
}
