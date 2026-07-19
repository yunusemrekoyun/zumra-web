'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, CheckCircle2, Loader2, Pencil } from 'lucide-react';
import { Button, FormField, Input, ModulePanel, StatusChip } from '@/components/ui';
import { parseTlToCents } from '@/lib/domain/money';
import { cn } from '@/lib/utils';

export type CommissionCatalog = {
  branches: Array<{
    id: string;
    instructorName: string | null;
    label: string;
    language: string | null;
    note: string | null;
    status: string;
    teacherShareBasisPoints: number | null;
  }>;
  privateInstructors: Array<{
    id: string;
    name: string;
    note: string | null;
    teacherShareBasisPoints: number | null;
  }>;
};

type RateScope = 'branch' | 'instructor_private';

type RateRowData = {
  id: string;
  instructorName: string | null;
  label: string;
  note: string | null;
  scope: RateScope;
  teacherShareBasisPoints: number | null;
};

function basisPointsToInput(basisPoints: number) {
  return (basisPoints / 100).toLocaleString('tr-TR', {
    maximumFractionDigits: 2,
    useGrouping: false,
  });
}

// Percent input in TR format; parseTlToCents maps "62,5" → 6250, which is
// exactly the basis-point scale (a percent's "cents" are basis points).
function parseRateInput(value: string): number | null {
  const basisPoints = parseTlToCents(value);
  if (basisPoints === null || basisPoints > 10_000) {
    return null;
  }
  return basisPoints;
}

export function CommissionsClient({ catalog }: { catalog: CommissionCatalog }) {
  const t = useTranslations('admin.commissions');
  const locale = useLocale();
  const router = useRouter();

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [rateInput, setRateInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const percentFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
        maximumFractionDigits: 2,
        style: 'percent',
      }),
    [locale],
  );

  const branchRows: RateRowData[] = catalog.branches.map((branch) => ({
    id: branch.id,
    instructorName: branch.instructorName,
    label: branch.label,
    note: branch.note,
    scope: 'branch',
    teacherShareBasisPoints: branch.teacherShareBasisPoints,
  }));
  const privateRows: RateRowData[] = catalog.privateInstructors.map(
    (instructor) => ({
      id: instructor.id,
      instructorName: instructor.name,
      label: instructor.name,
      note: instructor.note,
      scope: 'instructor_private',
      teacherShareBasisPoints: instructor.teacherShareBasisPoints,
    }),
  );

  const hasMissing = [...branchRows, ...privateRows].some(
    (row) => row.teacherShareBasisPoints === null,
  );

  function rowKey(row: RateRowData) {
    return `${row.scope}:${row.id}`;
  }

  function startEditing(row: RateRowData) {
    setEditingKey(rowKey(row));
    setRateInput(
      row.teacherShareBasisPoints !== null
        ? basisPointsToInput(row.teacherShareBasisPoints)
        : '',
    );
    setNoteInput(row.note ?? '');
    setError(undefined);
  }

  async function save(row: RateRowData) {
    const teacherShareBasisPoints = parseRateInput(rateInput);
    if (teacherShareBasisPoints === null) {
      setError(t('errorGeneric'));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch('/api/admin/commission-rates', {
        body: JSON.stringify({
          branchId: row.scope === 'branch' ? row.id : undefined,
          instructorId: row.scope === 'instructor_private' ? row.id : undefined,
          note: noteInput.trim() || undefined,
          scope: row.scope,
          teacherShareBasisPoints,
        }),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      if (response.ok) {
        const key = rowKey(row);
        setEditingKey(null);
        setSavedKey(key);
        window.setTimeout(
          () => setSavedKey((current) => (current === key ? null : current)),
          2500,
        );
        router.refresh();
        return;
      }
      setError(t('errorGeneric'));
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  function renderRow(row: RateRowData, showInstructor: boolean) {
    const key = rowKey(row);
    const missing = row.teacherShareBasisPoints === null;
    const editing = editingKey === key;

    return (
      <div
        key={key}
        className={cn(
          'rounded-2xl border px-4 py-3',
          missing
            ? 'border-amber-400/40 bg-amber-50/60'
            : 'border-black/[0.05] bg-white',
        )}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-[#2E286C]">
              {row.label}
            </div>
            {showInstructor && (
              <div className="truncate text-xs font-medium text-[#2E286C]/50">
                {row.instructorName ?? t('noInstructor')}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/40">
              {t('colTeacherShare')}
            </div>
            {missing ? (
              <StatusChip
                tone="amber"
                icon={<AlertTriangle className="h-3 w-3" />}
              >
                {t('notSet')}
              </StatusChip>
            ) : (
              <div className="text-sm font-bold text-[#2E286C]">
                {percentFormatter.format(row.teacherShareBasisPoints! / 10_000)}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/40">
              {t('colZumraShare')}
            </div>
            <div className="text-sm font-bold text-[#2E286C]">
              {missing
                ? '—'
                : percentFormatter.format(
                    (10_000 - row.teacherShareBasisPoints!) / 10_000,
                  )}
            </div>
          </div>
          {savedKey === key && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t('saved')}
            </span>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => (editing ? setEditingKey(null) : startEditing(row))}
          >
            <Pencil className="h-3.5 w-3.5" />
            {editing ? t('cancel') : t('edit')}
          </Button>
        </div>

        {!editing && row.note && (
          <p className="mt-2 text-xs font-medium text-[#2E286C]/50">
            {t('colNote')}: {row.note}
          </p>
        )}

        {editing && (
          <div className="mt-4 space-y-4 border-t border-black/[0.04] pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label={t('rateLabel')}
                description={t('rateHint')}
                required
              >
                <Input
                  inputMode="decimal"
                  onChange={(event) => setRateInput(event.target.value)}
                  value={rateInput}
                />
              </FormField>
              <FormField label={t('noteLabel')}>
                <Input
                  onChange={(event) => setNoteInput(event.target.value)}
                  value={noteInput}
                />
              </FormField>
            </div>
            {error && (
              <p className="text-sm font-semibold text-red-600">{error}</p>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setEditingKey(null)}>
                {t('cancel')}
              </Button>
              <Button disabled={busy} onClick={() => save(row)}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('save')}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {hasMissing && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/40 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          <AlertTriangle className="h-5 w-5 flex-none" />
          {t('missingWarning')}
        </div>
      )}

      <ModulePanel className="space-y-3 rounded-3xl">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#2E286C]/60">
          {t('groupSection')}
        </h2>
        {branchRows.length === 0 ? (
          <p className="py-6 text-center text-sm font-semibold text-[#2E286C]/45">
            {t('emptyGroups')}
          </p>
        ) : (
          branchRows.map((row) => renderRow(row, true))
        )}
      </ModulePanel>

      <ModulePanel className="space-y-3 rounded-3xl">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#2E286C]/60">
          {t('privateSection')}
        </h2>
        {privateRows.length === 0 ? (
          <p className="py-6 text-center text-sm font-semibold text-[#2E286C]/45">
            {t('emptyPrivate')}
          </p>
        ) : (
          privateRows.map((row) => renderRow(row, false))
        )}
      </ModulePanel>
    </div>
  );
}
