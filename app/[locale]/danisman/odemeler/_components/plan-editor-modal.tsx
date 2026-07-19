'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { GraduationCap, Loader2, Lock, Plus, Trash2 } from 'lucide-react';
import type { InstallmentView } from '@/lib/server/services/payments';
import {
  Button,
  DatePicker,
  EntityPickerField,
  FormField,
  IconButton,
  Input,
  ModulePanel,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { ModalShell } from './modal-shell';
import { centsToInput, formatCents, parseTlToCents } from './format';
import type { PayableEnrollment } from './advisor-payments-client';

type PlanRow = {
  amountText: string;
  dueDate: string;
  id?: string;
  key: string;
  label: string;
  note: string | null;
  paidCents: number;
};

let rowCounter = 0;

function nextRowKey() {
  rowCounter += 1;
  return `plan-row-${rowCounter}`;
}

// Client-side mirror of the server's plan rules; the server re-validates.
function rowIssue(row: PlanRow): 'amount' | 'due' | 'locked' | null {
  const cents = parseTlToCents(row.amountText);
  if (cents === null) {
    return 'amount';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.dueDate)) {
    return 'due';
  }
  if (cents < row.paidCents) {
    return 'locked';
  }
  return null;
}

export function PlanEditorModal({
  enrollments,
  initialEnrollmentId,
  locale,
  onClose,
  onDone,
}: {
  enrollments: PayableEnrollment[];
  initialEnrollmentId?: string;
  locale: string;
  onClose: () => void;
  onDone: (notice: string) => void;
}) {
  const t = useTranslations('advisor.payments');
  const [enrollmentId, setEnrollmentId] = useState(initialEnrollmentId ?? '');
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const selected = enrollments.find((item) => item.id === enrollmentId);
  const canSave =
    rows.length > 0 && rows.every((row) => rowIssue(row) === null);

  useEffect(() => {
    if (!enrollmentId) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setRows([]);
    setError(undefined);
    fetch(`/api/payments/installments/${enrollmentId}`, {
      credentials: 'same-origin',
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('plan_load_failed');
        }
        const payload = (await response.json()) as {
          installments: InstallmentView[];
        };
        if (cancelled) {
          return;
        }
        setRows(
          payload.installments.map((installment) => ({
            amountText: centsToInput(installment.amountCents),
            dueDate: installment.dueDate,
            id: installment.id,
            key: installment.id,
            label: installment.label ?? '',
            note: installment.note,
            paidCents: installment.paidCents,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setError(t('errorGeneric'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enrollmentId, t]);

  function toPickerItem(enrollment: PayableEnrollment) {
    return {
      id: enrollment.id,
      identity: { kind: 'person' as const, name: enrollment.studentName },
      subtitle: enrollment.courseLabel,
      title: enrollment.studentName,
    };
  }

  function updateRow(index: number, patch: Partial<PlanRow>) {
    setRows((previous) =>
      previous.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function addRow() {
    setRows((previous) => [
      ...previous,
      {
        amountText: '',
        dueDate: '',
        key: nextRowKey(),
        label: '',
        note: null,
        paidCents: 0,
      },
    ]);
  }

  async function save() {
    if (!canSave || busy || !enrollmentId) {
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch(
        `/api/payments/installments/${enrollmentId}`,
        {
          body: JSON.stringify({
            plan: rows.map((row) => ({
              amountCents: parseTlToCents(row.amountText) ?? 0,
              dueDate: row.dueDate,
              id: row.id,
              label: row.label.trim() || undefined,
              note: row.note ?? undefined,
            })),
          }),
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          method: 'PUT',
        },
      );
      if (response.ok) {
        onDone(t('planSaved'));
        return;
      }
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setError(
        payload.error === 'installment_has_payments' ||
          payload.error === 'installment_below_paid'
          ? t('planLockedRow')
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
      wide
      closeLabel={t('cancel')}
      onClose={onClose}
      title={
        selected
          ? t('planTitle', { name: selected.studentName })
          : t('planEdit')
      }
    >
      <div className="space-y-4">
        <FormField label={t('modalEnrollment')} required>
          <EntityPickerField
            busy={loading}
            icon={GraduationCap}
            items={enrollments.map(toPickerItem)}
            placeholder={t('modalEnrollmentPlaceholder')}
            title={t('modalEnrollment')}
            value={selected ? toPickerItem(selected) : null}
            onSelect={(item) => setEnrollmentId(item.id)}
          />
        </FormField>

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-[#533089]/60" />
          </div>
        )}

        {enrollmentId && !loading && rows.length === 0 && !error && (
          <p className="py-4 text-center text-sm font-semibold text-[#2E286C]/45">
            {t('planEmpty')}
          </p>
        )}

        {rows.length > 0 && (
          <div className="space-y-2">
            {rows.map((row, index) => {
              const locked = row.paidCents > 0;
              const issue = rowIssue(row);
              return (
                <ModulePanel
                  key={row.key}
                  padded={false}
                  variant="muted"
                  className="rounded-2xl p-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      aria-label={t('planLabel')}
                      maxLength={80}
                      placeholder={t('planLabel')}
                      value={row.label}
                      onChange={(event) =>
                        updateRow(index, { label: event.target.value })
                      }
                      className="bg-white sm:flex-1"
                    />
                    <Input
                      aria-label={t('planAmount')}
                      inputMode="decimal"
                      placeholder={t('planAmount')}
                      value={row.amountText}
                      onChange={(event) =>
                        updateRow(index, { amountText: event.target.value })
                      }
                      className={cn(
                        'bg-white sm:w-32',
                        (issue === 'amount' || issue === 'locked') &&
                          'border-red-400',
                      )}
                    />
                    <div className="sm:w-44">
                      <DatePicker
                        error={issue === 'due'}
                        locale={locale}
                        placeholder={t('planDue')}
                        value={row.dueDate}
                        onChange={(value) =>
                          updateRow(index, { dueDate: value })
                        }
                      />
                    </div>
                    <IconButton
                      aria-label={t('planRemove')}
                      disabled={locked || busy}
                      icon={<Trash2 className="h-4 w-4" />}
                      size="sm"
                      variant="danger"
                      onClick={() =>
                        setRows((previous) =>
                          previous.filter((_, i) => i !== index),
                        )
                      }
                      className="self-end border border-black/5 sm:self-auto"
                    />
                  </div>
                  {locked && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                      <Lock className="h-3.5 w-3.5 flex-none" />
                      {t('planLockedRow')} • {formatCents(row.paidCents)}
                    </p>
                  )}
                </ModulePanel>
              );
            })}
          </div>
        )}

        {enrollmentId && !loading && (
          <Button size="sm" variant="secondary" onClick={addRow}>
            <Plus className="h-4 w-4" />
            {t('planAddRow')}
          </Button>
        )}
      </div>

      {error && (
        <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          {t('cancel')}
        </Button>
        <Button disabled={busy || loading || !canSave} onClick={save}>
          {t('planSave')}
        </Button>
      </div>
    </ModalShell>
  );
}
