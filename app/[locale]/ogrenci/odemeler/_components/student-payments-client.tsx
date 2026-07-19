'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  Landmark,
  X,
} from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import {
  Button,
  Card,
  FormField,
  Input,
  ModulePanel,
  StatusChip,
} from '@/components/ui';
import { APP_TIME_ZONE } from '@/lib/datetime';
import { centsToInput, parseTlToCents } from '@/lib/domain/money';
import type {
  getStudentPaymentOverview,
  InstallmentView,
} from '@/lib/server/services/payments';

type OverviewEnrollment = Awaited<
  ReturnType<typeof getStudentPaymentOverview>
>['enrollments'][number];

export type StudentPaymentEnrollment = OverviewEnrollment & {
  statusLabel: string;
};

const enrollmentTone = {
  active: 'emerald',
  cancelled: 'red',
  completed: 'purple',
  paused: 'amber',
} as const;

const installmentTone = {
  paid: 'emerald',
  partial: 'amber',
  pending: 'gray',
} as const;

const installmentStatusKey = {
  paid: 'statusPaid',
  partial: 'statusPartial',
  pending: 'statusPending',
} as const;

const paymentTone = {
  confirmed: 'emerald',
  rejected: 'red',
  reported: 'amber',
} as const;

const paymentStatusKey = {
  confirmed: 'statusConfirmed',
  rejected: 'statusRejected',
  reported: 'statusReported',
} as const;

function formatTry(cents: number) {
  return `${(cents / 100).toLocaleString('tr-TR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} ₺`;
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
    day: 'numeric',
    month: 'short',
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
  }).format(new Date(value));
}

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
  }).format(new Date(value));
}

function installmentTitle(
  installment: Pick<InstallmentView, 'label' | 'sequence'>,
) {
  return installment.label ?? `#${installment.sequence}`;
}

function remainingCents(installment: InstallmentView) {
  return Math.max(0, installment.amountCents - installment.paidCents);
}

function hasOpenReport(
  payments: OverviewEnrollment['payments'],
  installmentId: string,
) {
  return payments.some(
    (payment) =>
      payment.installmentId === installmentId && payment.status === 'reported',
  );
}

export function StudentPaymentsClient({
  enrollments,
  locale,
}: {
  enrollments: StudentPaymentEnrollment[];
  locale: string;
}) {
  const t = useTranslations('student.payments');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<{
    enrollmentId: string;
    installment: InstallmentView;
  } | null>(null);

  async function copyIban(enrollmentId: string, iban: string) {
    try {
      await navigator.clipboard.writeText(iban);
      setCopiedId(enrollmentId);
      window.setTimeout(
        () =>
          setCopiedId((current) =>
            current === enrollmentId ? null : current,
          ),
        2000,
      );
    } catch {
      // Clipboard unavailable; keep the button unchanged.
    }
  }

  function installmentAction(
    enrollment: StudentPaymentEnrollment,
    installment: InstallmentView,
  ) {
    if (installment.status === 'paid') {
      return null;
    }
    if (hasOpenReport(enrollment.payments, installment.id)) {
      return <StatusChip tone="blue">{t('pendingBadge')}</StatusChip>;
    }
    return (
      <Button
        size="sm"
        onClick={() =>
          setReportTarget({ enrollmentId: enrollment.id, installment })
        }
      >
        {t('report')}
      </Button>
    );
  }

  return (
    <div className="space-y-6">
      {enrollments.map((enrollment) => {
        const bankAccount = enrollment.bankAccount;

        return (
          <Card key={enrollment.id} className="space-y-6">
            {/* Enrollment header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-[#2E286C]">
                  {enrollment.courseLabel}
                </h2>
                {enrollment.instructorName && (
                  <p className="mt-0.5 text-sm font-medium text-[#2E286C]/50">
                    {enrollment.instructorName}
                  </p>
                )}
              </div>
              <StatusChip tone={enrollmentTone[enrollment.status]}>
                {enrollment.statusLabel}
              </StatusChip>
            </div>

            {/* Bank account */}
            <section>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#2E286C]/60">
                {t('bankTitle')}
              </h3>
              {bankAccount ? (
                <ModulePanel variant="muted" className="rounded-2xl p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#533089]/8 text-[#533089]">
                        <Landmark className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/40">
                          {t('holder')}
                        </p>
                        <p className="truncate text-sm font-bold text-[#2E286C]">
                          {bankAccount.holderName ??
                            enrollment.instructorName ??
                            '-'}
                        </p>
                        <p className="break-all font-mono text-sm font-semibold text-[#2E286C]/80">
                          {bankAccount.iban}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-none"
                      onClick={() => copyIban(enrollment.id, bankAccount.iban)}
                    >
                      {copiedId === enrollment.id ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copiedId === enrollment.id ? t('copied') : t('copyIban')}
                    </Button>
                  </div>
                </ModulePanel>
              ) : (
                <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/20 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                  {t('noAccount')}
                </div>
              )}
            </section>

            {/* Installment plan */}
            <section>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#2E286C]/60">
                {t('planTitle')}
              </h3>
              {enrollment.installments.length === 0 ? (
                <p className="text-sm font-medium text-[#2E286C]/50">
                  {t('noInstallments')}
                </p>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="space-y-3 md:hidden">
                    {enrollment.installments.map((installment) => (
                      <ModulePanel
                        key={installment.id}
                        variant="muted"
                        className="rounded-2xl p-4"
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-[#2E286C]">
                              {installmentTitle(installment)}
                            </p>
                            <p className="text-xs font-medium text-[#2E286C]/50">
                              {t('colDue')} ·{' '}
                              {formatDate(installment.dueDate, locale)}
                            </p>
                          </div>
                          <StatusChip tone={installmentTone[installment.status]}>
                            {t(installmentStatusKey[installment.status])}
                          </StatusChip>
                        </div>
                        <div className="flex items-end justify-between gap-3">
                          <div>
                            <p className="font-bold text-[#2E286C]">
                              {formatTry(installment.amountCents)}
                            </p>
                            <p className="text-xs font-medium text-[#2E286C]/50">
                              {t('colPaid')}: {formatTry(installment.paidCents)}
                            </p>
                          </div>
                          {installmentAction(enrollment, installment)}
                        </div>
                      </ModulePanel>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-b border-black/[0.04] text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/45">
                          <th className="px-3 py-3 font-bold">
                            {t('colInstallment')}
                          </th>
                          <th className="px-3 py-3 font-bold">{t('colDue')}</th>
                          <th className="px-3 py-3 font-bold">
                            {t('colAmount')}
                          </th>
                          <th className="px-3 py-3 font-bold">{t('colPaid')}</th>
                          <th className="px-3 py-3 font-bold">
                            {t('colStatus')}
                          </th>
                          <th className="px-3 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/[0.03] text-sm font-medium text-[#2E286C]/80">
                        {enrollment.installments.map((installment) => (
                          <tr key={installment.id}>
                            <td className="px-3 py-3 font-bold text-[#2E286C]">
                              {installmentTitle(installment)}
                            </td>
                            <td className="px-3 py-3">
                              {formatDate(installment.dueDate, locale)}
                            </td>
                            <td className="px-3 py-3 font-bold text-[#2E286C]">
                              {formatTry(installment.amountCents)}
                            </td>
                            <td className="px-3 py-3">
                              {formatTry(installment.paidCents)}
                            </td>
                            <td className="px-3 py-3">
                              <StatusChip
                                tone={installmentTone[installment.status]}
                              >
                                {t(installmentStatusKey[installment.status])}
                              </StatusChip>
                            </td>
                            <td className="px-3 py-3 text-right">
                              {installmentAction(enrollment, installment)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>

            {/* Payment history */}
            <section>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#2E286C]/60">
                {t('historyTitle')}
              </h3>
              {enrollment.payments.length === 0 ? (
                <p className="text-sm font-medium text-[#2E286C]/50">
                  {t('historyEmpty')}
                </p>
              ) : (
                <ul className="space-y-3">
                  {enrollment.payments.map((payment) => (
                    <li key={payment.id}>
                      <ModulePanel variant="muted" className="rounded-2xl p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-[#2E286C]">
                              {formatTry(
                                payment.amountCents ??
                                  payment.declaredAmountCents ??
                                  0,
                              )}
                              {payment.installmentLabel && (
                                <span className="ml-2 text-xs font-semibold text-[#2E286C]/45">
                                  {payment.installmentLabel}
                                </span>
                              )}
                            </p>
                            <p className="mt-1 text-xs font-medium text-[#2E286C]/50">
                              {t('colReportedAt')}:{' '}
                              {formatDateTime(payment.reportedAt, locale)}
                              {payment.reviewedAt && (
                                <>
                                  {' · '}
                                  {t('colReviewedAt')}:{' '}
                                  {formatDateTime(payment.reviewedAt, locale)}
                                </>
                              )}
                            </p>
                            {payment.status === 'rejected' &&
                              payment.reviewNote && (
                                <p className="mt-1.5 text-xs font-semibold text-red-600">
                                  {t('rejectedReason', {
                                    reason: payment.reviewNote,
                                  })}
                                </p>
                              )}
                          </div>
                          <div className="flex flex-none items-center gap-2">
                            {payment.receiptMediaAssetId && (
                              <a
                                href={`/api/media/${payment.receiptMediaAssetId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-xl bg-[#533089]/8 px-3 py-1.5 text-xs font-bold text-[#533089] transition-colors hover:bg-[#533089]/15"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                {t('receipt')}
                              </a>
                            )}
                            <StatusChip tone={paymentTone[payment.status]}>
                              {t(paymentStatusKey[payment.status])}
                            </StatusChip>
                          </div>
                        </div>
                      </ModulePanel>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </Card>
        );
      })}

      {reportTarget && (
        <ReportPaymentModal
          enrollmentId={reportTarget.enrollmentId}
          installment={reportTarget.installment}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  );
}

function ReportPaymentModal({
  enrollmentId,
  installment,
  onClose,
}: {
  enrollmentId: string;
  installment: InstallmentView;
  onClose: () => void;
}) {
  const t = useTranslations('student.payments');
  const router = useRouter();
  const remaining = remainingCents(installment);
  const [amount, setAmount] = useState(() =>
    remaining > 0 ? centsToInput(remaining) : '',
  );
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  async function submit() {
    setError(undefined);
    const amountCents = parseTlToCents(amount);
    if (amountCents === null) {
      setError(t('errorGeneric'));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/payments/report', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amountCents,
          enrollmentId,
          installmentId: installment.id,
          note: note.trim() || undefined,
        }),
      });
      if (response.ok) {
        setDone(true);
        router.refresh();
        return;
      }
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setError(
        body.error === 'payment_already_reported'
          ? t('alreadyReported')
          : t('errorGeneric'),
      );
      setBusy(false);
    } catch {
      setError(t('errorGeneric'));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1646]/35 p-4">
      <ModulePanel className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        {done ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="text-sm font-semibold text-[#2E286C]">
              {t('reportSuccess')}
            </p>
            <Button variant="secondary" size="sm" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
              {t('cancel')}
            </Button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-[#2E286C]">
              {t('reportTitle')}
            </h2>
            <p className="mt-1 text-sm font-medium leading-6 text-[#2E286C]/60">
              {t('reportHint')}
            </p>

            <div className="mt-4 rounded-2xl bg-[#F8F9FC] px-4 py-3">
              <p className="text-sm font-bold text-[#2E286C]">
                {installmentTitle(installment)} ·{' '}
                {formatTry(installment.amountCents)}
              </p>
              <p className="mt-0.5 text-xs font-medium text-[#2E286C]/50">
                {t('remaining', { amount: formatTry(remaining) })}
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <FormField label={t('reportAmount')} required>
                <Input
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </FormField>
              <FormField label={t('reportNote')}>
                <Input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </FormField>
            </div>

            {error && (
              <p className="mt-4 text-sm font-semibold text-red-600">{error}</p>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <Button variant="ghost" onClick={onClose} disabled={busy}>
                {t('cancel')}
              </Button>
              <Button onClick={submit} disabled={busy}>
                {t('reportSubmit')}
              </Button>
            </div>
          </>
        )}
      </ModulePanel>
    </div>
  );
}
