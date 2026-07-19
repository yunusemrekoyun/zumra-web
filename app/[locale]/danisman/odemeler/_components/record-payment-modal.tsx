'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { GraduationCap } from 'lucide-react';
import { Button, EntityPickerField, FormField, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import { ModalShell } from './modal-shell';
import { centsToInput, formatCents, formatDay, parseTlToCents } from './format';
import type { PayableEnrollment } from './advisor-payments-client';

const METHODS = ['bank_transfer', 'cash', 'other'] as const;

type Method = (typeof METHODS)[number];

export function RecordPaymentModal({
  enrollments,
  locale,
  onClose,
  onDone,
}: {
  enrollments: PayableEnrollment[];
  locale: string;
  onClose: () => void;
  onDone: (notice: string) => void;
}) {
  const t = useTranslations('advisor.payments');
  const [enrollmentId, setEnrollmentId] = useState('');
  const [installmentId, setInstallmentId] = useState('');
  const [amountText, setAmountText] = useState('');
  const [method, setMethod] = useState<Method>('bank_transfer');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const selected = enrollments.find((item) => item.id === enrollmentId);
  const openInstallments =
    selected?.installments.filter(
      (installment) => installment.status !== 'paid',
    ) ?? [];
  const amountCents = parseTlToCents(amountText);
  const canSubmit = Boolean(enrollmentId) && amountCents !== null;

  const methodLabels: Record<Method, string> = {
    bank_transfer: t('methodBankTransfer'),
    cash: t('methodCash'),
    other: t('methodOther'),
  };

  function toPickerItem(enrollment: PayableEnrollment) {
    return {
      id: enrollment.id,
      identity: { kind: 'person' as const, name: enrollment.studentName },
      subtitle: enrollment.courseLabel,
      title: enrollment.studentName,
    };
  }

  async function submit() {
    if (!canSubmit || busy) {
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch('/api/payments/staff', {
        body: JSON.stringify({
          amountCents,
          enrollmentId,
          installmentId: installmentId || undefined,
          method,
          note: note.trim() || undefined,
        }),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      if (response.ok) {
        onDone(t('saved'));
        return;
      }
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setError(
        payload.error === 'commission_rate_missing'
          ? t('commissionMissing')
          : t('errorGeneric'),
      );
      setBusy(false);
    } catch {
      setError(t('errorGeneric'));
      setBusy(false);
    }
  }

  return (
    <ModalShell
      closeLabel={t('cancel')}
      onClose={onClose}
      title={t('modalTitle')}
    >
      <div className="space-y-4">
        <FormField label={t('modalEnrollment')} required>
          <EntityPickerField
            icon={GraduationCap}
            items={enrollments.map(toPickerItem)}
            placeholder={t('modalEnrollmentPlaceholder')}
            title={t('modalEnrollment')}
            value={selected ? toPickerItem(selected) : null}
            onSelect={(item) => {
              setEnrollmentId(item.id);
              setInstallmentId('');
            }}
          />
        </FormField>

        <FormField label={t('modalInstallment')}>
          <select
            disabled={!selected}
            value={installmentId}
            onChange={(event) => {
              const next = event.target.value;
              setInstallmentId(next);
              const installment = openInstallments.find(
                (item) => item.id === next,
              );
              if (installment) {
                setAmountText(
                  centsToInput(
                    installment.amountCents - installment.paidCents,
                  ),
                );
              }
            }}
            className="h-10 w-full appearance-none rounded-xl border border-[#2E286C]/10 bg-[#F8F9FC] px-4 text-sm font-medium text-[#2E286C] outline-none transition-all focus:border-[#533089]/30 disabled:opacity-50"
          >
            <option value="">{t('modalInstallmentNone')}</option>
            {openInstallments.map((installment) => (
              <option key={installment.id} value={installment.id}>
                {`${installment.label ?? `#${installment.sequence}`} • ${formatCents(installment.amountCents - installment.paidCents)} • ${formatDay(installment.dueDate, locale)}`}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label={t('modalAmount')} required>
          <Input
            inputMode="decimal"
            value={amountText}
            onChange={(event) => setAmountText(event.target.value)}
          />
        </FormField>

        <FormField label={t('modalMethod')}>
          <div className="flex gap-2">
            {METHODS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMethod(value)}
                className={cn(
                  'flex-1 rounded-2xl border px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors',
                  method === value
                    ? 'border-[#533089]/30 bg-[#533089]/5 text-[#533089]'
                    : 'border-black/[0.06] bg-white text-[#2E286C]/45 hover:bg-black/[0.02]',
                )}
              >
                {methodLabels[value]}
              </button>
            ))}
          </div>
        </FormField>

        <FormField label={t('modalNote')}>
          <Input
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </FormField>
      </div>

      {error && (
        <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          {t('cancel')}
        </Button>
        <Button disabled={busy || !canSubmit} onClick={submit}>
          {t('modalSubmit')}
        </Button>
      </div>
    </ModalShell>
  );
}
