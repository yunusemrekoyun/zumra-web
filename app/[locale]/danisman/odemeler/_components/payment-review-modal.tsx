'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PaymentRecordView } from '@/lib/server/services/payments';
import {
  AttachmentInput,
  type Attachment,
} from '@/components/attachment-input';
import { Button, FormField, Input } from '@/components/ui';
import { ModalShell } from './modal-shell';
import { centsToInput, formatCents, parseTlToCents } from './format';

export function PaymentReviewModal({
  mode,
  onClose,
  onDone,
  payment,
}: {
  mode: 'confirm' | 'reject';
  onClose: () => void;
  onDone: (notice: string) => void;
  payment: PaymentRecordView;
}) {
  const t = useTranslations('advisor.payments');
  const [amountText, setAmountText] = useState(
    payment.declaredAmountCents === null
      ? ''
      : centsToInput(payment.declaredAmountCents),
  );
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [receipt, setReceipt] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const amountCents = parseTlToCents(amountText);
  const canSubmit =
    mode === 'confirm' ? amountCents !== null : reason.trim().length > 0;

  async function submit() {
    if (!canSubmit || busy) {
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const body =
        mode === 'confirm'
          ? {
              amountCents,
              receiptMediaAssetId: receipt[0]?.mediaAssetId,
              reviewNote: note.trim() || undefined,
            }
          : { reason: reason.trim() };
      const response = await fetch(`/api/payments/${payment.id}/${mode}`, {
        body: JSON.stringify(body),
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
      title={mode === 'confirm' ? t('confirmTitle') : t('reject')}
    >
      <div className="mb-4 rounded-2xl bg-[#F8F9FC] p-4">
        <div className="text-sm font-bold text-[#2E286C]">
          {payment.studentName}
        </div>
        <div className="mt-0.5 text-xs font-medium text-[#2E286C]/55">
          {payment.courseLabel}
          {payment.installmentLabel ? ` • ${payment.installmentLabel}` : ''}
        </div>
        {payment.declaredAmountCents !== null && (
          <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/40">
            {t('colDeclared')}
            <span className="ml-2 text-sm normal-case tracking-normal text-[#2E286C]">
              {formatCents(payment.declaredAmountCents)}
            </span>
          </div>
        )}
        {payment.studentNote && (
          <p className="mt-2 text-xs font-medium leading-5 text-[#2E286C]/60">
            {payment.studentNote}
          </p>
        )}
      </div>

      {mode === 'confirm' ? (
        <div className="space-y-4">
          <FormField label={t('confirmAmount')} required>
            <Input
              inputMode="decimal"
              value={amountText}
              onChange={(event) => setAmountText(event.target.value)}
            />
          </FormField>
          <FormField label={t('confirmNote')}>
            <Input
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </FormField>
          <FormField label={t('receipt')}>
            <AttachmentInput
              disabled={busy}
              value={receipt}
              onChange={(next) => setReceipt(next.slice(-1))}
              labels={{
                add: t('receiptUpload'),
                error: t('receiptUploadError'),
                uploading: t('receiptUploading'),
              }}
            />
          </FormField>
        </div>
      ) : (
        <FormField label={t('rejectReason')} required>
          <textarea
            maxLength={500}
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="w-full rounded-xl border border-[#2E286C]/10 bg-[#F8F9FC] px-4 py-3 text-sm font-medium text-[#2E286C] outline-none transition-all placeholder:text-[#2E286C]/35 focus:border-[#533089]/30"
          />
        </FormField>
      )}

      {error && (
        <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          {t('cancel')}
        </Button>
        <Button
          disabled={busy || !canSubmit}
          onClick={submit}
          className={
            mode === 'reject'
              ? 'bg-red-600 shadow-red-600/20 hover:bg-red-700'
              : undefined
          }
        >
          {mode === 'confirm' ? t('confirm') : t('reject')}
        </Button>
      </div>
    </ModalShell>
  );
}
