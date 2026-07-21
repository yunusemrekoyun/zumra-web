'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { BadgePercent, Pencil, Plus, X } from 'lucide-react';
import {
  Button,
  Card,
  DatePicker,
  EmptyState,
  FilterTabs,
  FormField,
  Input,
  PageHeader,
  StatusChip,
  useToast,
} from '@/components/ui';
import { errorCodeFromBody, useApiErrorText } from '@/lib/client/api-error';
import { APP_TIME_ZONE, isoToIstanbulWallClock } from '@/lib/datetime';
import { centsToInput, formatCents, parseTlToCents } from '@/lib/domain/money';
import type { ManualDiscountView } from '@/lib/server/services/pricing';
import type { DiscountPackageView } from '@/lib/server/services/programs';

type BranchOption = {
  id: string;
  name: string;
  programName: string;
};

type PackageDraft = {
  active: boolean;
  branchId: string;
  discountType: 'percentage' | 'fixed';
  endsAt: string;
  id?: string;
  name: string;
  note: string;
  scope: 'branch' | 'private';
  startsAt: string;
  valueInput: string;
};

type PackageStatus = 'active' | 'expired' | 'inactive' | 'upcoming';

const statusTone: Record<
  PackageStatus,
  'amber' | 'emerald' | 'gray' | 'red'
> = {
  active: 'emerald',
  expired: 'red',
  inactive: 'gray',
  upcoming: 'amber',
};

const statusKey = {
  active: 'statusActive',
  expired: 'statusExpired',
  inactive: 'statusInactive',
  upcoming: 'statusUpcoming',
} as const;

export function DiscountsClient({
  branches,
  manualDiscounts,
  packages,
}: {
  branches: BranchOption[];
  manualDiscounts: ManualDiscountView[];
  packages: DiscountPackageView[];
}) {
  const t = useTranslations('admin.discounts');
  const locale = useLocale();
  const router = useRouter();
  const errorText = useApiErrorText();
  const { toast } = useToast();
  const [draft, setDraft] = useState<PackageDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [modalError, setModalError] = useState('');
  const [valueErrorText, setValueErrorText] = useState('');

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
        day: '2-digit',
        month: 'short',
        timeZone: APP_TIME_ZONE,
        year: 'numeric',
      }),
    [locale],
  );

  const branchPackages = packages.filter((pkg) => pkg.scope === 'branch');
  const privatePackages = packages.filter((pkg) => pkg.scope === 'private');

  function openCreate() {
    setDraft(emptyDraft());
    setModalError('');
    setValueErrorText('');
  }

  function openEdit(pkg: DiscountPackageView) {
    setDraft(draftFromPackage(pkg));
    setModalError('');
    setValueErrorText('');
  }

  function closeModal() {
    if (!busy) setDraft(null);
  }

  const saveDisabled =
    busy ||
    !draft ||
    draft.name.trim().length < 2 ||
    !draft.valueInput.trim() ||
    (draft.scope === 'branch' && !draft.branchId);

  async function savePackage(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;

    // A valid number over 100% gets a specific message; genuinely malformed
    // input falls through to the generic inline "enter a valid value" hint.
    if (draft.discountType === 'percentage') {
      const percent = Number.parseFloat(
        draft.valueInput.trim().replace('%', '').replace(',', '.'),
      );
      if (Number.isFinite(percent) && percent > 100) {
        setValueErrorText(errorText('discount_percentage_invalid'));
        return;
      }
    }

    const discountValue =
      draft.discountType === 'percentage'
        ? parsePercentToBasisPoints(draft.valueInput)
        : parseTlToCents(draft.valueInput);

    if (discountValue === null) {
      setValueErrorText(t('valueInvalid'));
      return;
    }

    setValueErrorText('');
    setBusy(true);
    setModalError('');

    try {
      const response = await fetch(
        draft.id
          ? `/api/admin/discount-packages/${draft.id}`
          : '/api/admin/discount-packages',
        {
          body: JSON.stringify({
            active: draft.active,
            branchId: draft.scope === 'branch' ? draft.branchId : null,
            discountType: draft.discountType,
            discountValue,
            endsAt: draft.endsAt ? istanbulDayEndISO(draft.endsAt) : null,
            name: draft.name.trim(),
            note: draft.note.trim() || null,
            scope: draft.scope,
            startsAt: draft.startsAt
              ? istanbulDayStartISO(draft.startsAt)
              : null,
          }),
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          method: draft.id ? 'PATCH' : 'POST',
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.id) {
        setModalError(errorText(errorCodeFromBody(body, response.status)));
        return;
      }

      setDraft(null);
      setMessage(t('saved'));
      toast({ variant: 'success', description: t('saved') });
      router.refresh();
    } catch {
      setModalError(errorText('network_error'));
    } finally {
      setBusy(false);
    }
  }

  function renderSection(
    title: string,
    sectionPackages: DiscountPackageView[],
    emptyText: string,
    targetLabel: (pkg: DiscountPackageView) => string,
  ) {
    return (
      <Card padded={false} className="overflow-hidden">
        <div className="border-b border-black/[0.04] px-5 py-4 lg:px-6">
          <h2 className="font-bold text-[#2E286C]">{title}</h2>
        </div>
        {sectionPackages.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-[#2E286C]/35">
                    <th className="px-6 py-3">{t('colName')}</th>
                    <th className="px-4 py-3">{t('colTarget')}</th>
                    <th className="px-4 py-3">{t('colDiscount')}</th>
                    <th className="px-4 py-3">{t('colValidity')}</th>
                    <th className="px-4 py-3">{t('colStatus')}</th>
                    <th className="px-6 py-3">
                      <span className="sr-only">{t('edit')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04]">
                  {sectionPackages.map((pkg) => {
                    const status = packageStatus(pkg);
                    return (
                      <tr key={pkg.id}>
                        <td className="px-6 py-4 font-bold text-[#2E286C]">
                          {pkg.name}
                        </td>
                        <td className="px-4 py-4 font-medium text-[#2E286C]/60">
                          {targetLabel(pkg)}
                        </td>
                        <td className="px-4 py-4 font-bold text-[#533089]">
                          {discountLabel(pkg)}
                        </td>
                        <td className="px-4 py-4 font-medium text-[#2E286C]/60">
                          {validityLabel(pkg)}
                        </td>
                        <td className="px-4 py-4">
                          <StatusChip tone={statusTone[status]}>
                            {t(statusKey[status])}
                          </StatusChip>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openEdit(pkg)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            {t('edit')}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-black/[0.04] md:hidden">
              {sectionPackages.map((pkg) => {
                const status = packageStatus(pkg);
                return (
                  <div key={pkg.id} className="space-y-3 px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold text-[#2E286C]">
                          {pkg.name}
                        </div>
                        <div className="mt-0.5 text-xs font-medium text-[#2E286C]/45">
                          {targetLabel(pkg)}
                        </div>
                      </div>
                      <StatusChip tone={statusTone[status]}>
                        {t(statusKey[status])}
                      </StatusChip>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-medium text-[#2E286C]/45">
                        <span className="text-sm font-bold text-[#533089]">
                          {discountLabel(pkg)}
                        </span>
                        {' · '}
                        {validityLabel(pkg)}
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openEdit(pkg)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {t('edit')}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="px-5 py-10 text-center text-sm font-semibold text-[#2E286C]/40">
            {emptyText}
          </p>
        )}
      </Card>
    );
  }

  function discountLabel(pkg: DiscountPackageView) {
    return pkg.discountType === 'percentage'
      ? t('percentValue', { value: pkg.discountValue / 100 })
      : formatCents(pkg.discountValue);
  }

  function validityLabel(pkg: DiscountPackageView) {
    const start = pkg.startsAt
      ? dateFormatter.format(new Date(pkg.startsAt))
      : '';
    const end = pkg.endsAt ? dateFormatter.format(new Date(pkg.endsAt)) : '';
    if (start && end) return `${start} – ${end}`;
    if (start) return t('validityFrom', { date: start });
    if (end) return t('validityUntil', { date: end });
    return t('validityAlways');
  }

  return (
    <div className="admin-page">
      <PageHeader
        title={t('title')}
        description={t('description')}
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t('newPackage')}
          </Button>
        }
      />

      {message && (
        <div className="mb-5 rounded-2xl bg-[#533089]/7 px-5 py-3 text-sm font-semibold text-[#533089]">
          {message}
        </div>
      )}

      <div className="space-y-6">
        {renderSection(
          t('branchSection'),
          branchPackages,
          t('emptyBranch'),
          (pkg) => pkg.branchName ?? '—',
        )}
        {renderSection(
          t('privateSection'),
          privatePackages,
          t('emptyPrivate'),
          () => t('targetPrivate'),
        )}

        <Card padded={false} className="overflow-hidden">
          <div className="border-b border-black/[0.04] px-5 py-4 lg:px-6">
            <h2 className="font-bold text-[#2E286C]">{t('manualTitle')}</h2>
            <p className="mt-1 text-xs font-medium leading-5 text-[#2E286C]/40">
              {t('manualDescription')}
            </p>
          </div>
          {manualDiscounts.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-[#2E286C]/35">
                    <th className="px-6 py-3">{t('colStudent')}</th>
                    <th className="px-4 py-3">{t('colCourse')}</th>
                    <th className="px-4 py-3">{t('colAmount')}</th>
                    <th className="px-4 py-3">{t('colFinal')}</th>
                    <th className="px-4 py-3">{t('colNote')}</th>
                    <th className="px-6 py-3">{t('colDate')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04]">
                  {manualDiscounts.map((discount) => (
                    <tr key={discount.enrollmentId}>
                      <td className="px-6 py-4 font-bold text-[#2E286C]">
                        {discount.studentName}
                      </td>
                      <td className="px-4 py-4 font-medium text-[#2E286C]/60">
                        {discount.courseLabel}
                      </td>
                      <td className="px-4 py-4 font-bold text-[#533089]">
                        {formatCents(discount.discountCents)}
                      </td>
                      <td className="px-4 py-4 font-bold text-[#2E286C]">
                        {formatCents(discount.finalPriceCents)}
                      </td>
                      <td className="max-w-[16rem] truncate px-4 py-4 font-medium text-[#2E286C]/60">
                        {discount.discountNote ?? '—'}
                      </td>
                      <td className="px-6 py-4 font-medium text-[#2E286C]/60">
                        {dateFormatter.format(new Date(discount.enrolledAt))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={BadgePercent}
              description={t('manualEmpty')}
              className="min-h-0 rounded-none border-0 lg:h-auto"
            />
          )}
        </Card>
      </div>

      {draft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          // mousedown (not click) so a text-selection drag that starts inside
          // an input and ends on the backdrop cannot close the modal and wipe
          // the form; the target check keeps clicks inside the panel inert.
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-rosmatika text-xl font-medium text-[#2E286C]">
                {draft.id ? t('modalEditTitle') : t('modalCreateTitle')}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                aria-label={t('cancel')}
                className="rounded-full p-1.5 text-[#2E286C]/40 transition-colors hover:bg-black/5 hover:text-[#2E286C]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form className="mt-5 space-y-4" onSubmit={savePackage}>
              <FormField label={t('nameLabel')}>
                <Input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft(
                      (current) =>
                        current && { ...current, name: event.target.value },
                    )
                  }
                />
              </FormField>

              <FormField label={t('scopeLabel')}>
                <div
                  className={
                    draft.id ? 'pointer-events-none opacity-50' : undefined
                  }
                >
                  <FilterTabs
                    activeValue={draft.scope}
                    items={[
                      { label: t('scopeBranch'), value: 'branch' },
                      { label: t('scopePrivate'), value: 'private' },
                    ]}
                    onChange={
                      draft.id
                        ? undefined
                        : (value) =>
                            setDraft(
                              (current) =>
                                current && {
                                  ...current,
                                  scope: value as PackageDraft['scope'],
                                },
                            )
                    }
                  />
                </div>
              </FormField>

              {draft.scope === 'branch' && (
                <FormField label={t('branchLabel')}>
                  <select
                    value={draft.branchId}
                    onChange={(event) =>
                      setDraft(
                        (current) =>
                          current && {
                            ...current,
                            branchId: event.target.value,
                          },
                      )
                    }
                    className="h-12 w-full rounded-xl border border-transparent bg-[#F8F9FC] px-4 text-sm font-medium text-[#2E286C] outline-none focus:border-[#533089]/30"
                  >
                    <option value="" disabled>
                      {t('branchPlaceholder')}
                    </option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} — {branch.programName}
                      </option>
                    ))}
                  </select>
                </FormField>
              )}

              <FormField label={t('typeLabel')}>
                <FilterTabs
                  activeValue={draft.discountType}
                  items={[
                    { label: t('typePercentage'), value: 'percentage' },
                    { label: t('typeFixed'), value: 'fixed' },
                  ]}
                  onChange={(value) =>
                    setDraft(
                      (current) =>
                        current && {
                          ...current,
                          discountType:
                            value as PackageDraft['discountType'],
                          valueInput: '',
                        },
                    )
                  }
                />
              </FormField>

              <FormField
                label={
                  draft.discountType === 'percentage'
                    ? t('valuePercentLabel')
                    : t('valueFixedLabel')
                }
                error={valueErrorText || undefined}
              >
                <div className="relative">
                  <Input
                    value={draft.valueInput}
                    inputMode="decimal"
                    placeholder={
                      draft.discountType === 'percentage' ? '15' : '1.500,00'
                    }
                    onChange={(event) => {
                      setValueErrorText('');
                      setDraft(
                        (current) =>
                          current && {
                            ...current,
                            valueInput: event.target.value,
                          },
                      );
                    }}
                    className="pr-12"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs font-bold text-[#2E286C]/35">
                    {draft.discountType === 'percentage' ? '%' : '₺'}
                  </span>
                </div>
              </FormField>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label={t('startsAtLabel')}>
                  <ClearableDate
                    locale={locale}
                    placeholder={t('startsAtLabel')}
                    value={draft.startsAt}
                    onChange={(startsAt) =>
                      setDraft(
                        (current) => current && { ...current, startsAt },
                      )
                    }
                  />
                </FormField>
                <FormField label={t('endsAtLabel')}>
                  <ClearableDate
                    locale={locale}
                    placeholder={t('endsAtLabel')}
                    value={draft.endsAt}
                    disabledBefore={parseDraftDate(draft.startsAt)}
                    onChange={(endsAt) =>
                      setDraft((current) => current && { ...current, endsAt })
                    }
                  />
                </FormField>
              </div>

              <p className="rounded-xl bg-[#533089]/6 px-4 py-3 text-xs font-medium leading-5 text-[#533089]">
                {t('validityHint')}
              </p>

              <label className="flex items-center gap-3 rounded-xl bg-[#F8F9FC] p-4 text-sm font-semibold text-[#2E286C]/65">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(event) =>
                    setDraft(
                      (current) =>
                        current && {
                          ...current,
                          active: event.target.checked,
                        },
                    )
                  }
                  className="h-4 w-4 accent-[#533089]"
                />
                {t('activeLabel')}
              </label>

              <FormField label={t('noteLabel')}>
                <textarea
                  value={draft.note}
                  maxLength={300}
                  onChange={(event) =>
                    setDraft(
                      (current) =>
                        current && { ...current, note: event.target.value },
                    )
                  }
                  className="min-h-20 w-full resize-y rounded-xl border border-transparent bg-[#F8F9FC] px-4 py-3 text-sm text-[#2E286C] outline-none focus:border-[#533089]/30"
                />
              </FormField>

              {modalError && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
                  {modalError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="secondary" onClick={closeModal}>
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={saveDisabled}>
                  {t('save')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ClearableDate({
  disabledBefore,
  locale,
  onChange,
  placeholder,
  value,
}: {
  disabledBefore?: Date;
  locale: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <div className="relative">
      <DatePicker
        locale={locale}
        value={value}
        placeholder={placeholder}
        disabledBefore={disabledBefore}
        onChange={onChange}
      />
      {value && (
        <button
          type="button"
          aria-label={locale === 'en' ? 'Clear date' : 'Tarihi temizle'}
          onClick={() => onChange('')}
          className="absolute inset-y-0 right-10 z-10 flex items-center rounded-lg px-1 text-[#2E286C]/35 hover:text-[#2E286C]"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function packageStatus(pkg: DiscountPackageView): PackageStatus {
  const now = Date.now();
  if (!pkg.active) return 'inactive';
  if (pkg.endsAt && new Date(pkg.endsAt).getTime() < now) return 'expired';
  if (pkg.startsAt && new Date(pkg.startsAt).getTime() > now) {
    return 'upcoming';
  }
  return 'active';
}

function emptyDraft(): PackageDraft {
  return {
    active: true,
    branchId: '',
    discountType: 'percentage',
    endsAt: '',
    name: '',
    note: '',
    scope: 'branch',
    startsAt: '',
    valueInput: '',
  };
}

function draftFromPackage(pkg: DiscountPackageView): PackageDraft {
  return {
    active: pkg.active,
    branchId: pkg.branchId ?? '',
    discountType: pkg.discountType,
    endsAt: pkg.endsAt ? isoToIstanbulWallClock(pkg.endsAt).slice(0, 10) : '',
    id: pkg.id,
    name: pkg.name,
    note: pkg.note ?? '',
    scope: pkg.scope,
    startsAt: pkg.startsAt
      ? isoToIstanbulWallClock(pkg.startsAt).slice(0, 10)
      : '',
    valueInput:
      pkg.discountType === 'percentage'
        ? (pkg.discountValue / 100).toString().replace('.', ',')
        : centsToInput(pkg.discountValue),
  };
}

// "12,5" or "12.5" -> basis points (1250); null unless a valid 0-100 percent.
function parsePercentToBasisPoints(value: string): number | null {
  const normalized = value.trim().replace('%', '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const basisPoints = Math.round(Number.parseFloat(normalized) * 100);
  return basisPoints > 0 && basisPoints <= 10_000 ? basisPoints : null;
}

// Istanbul is fixed at UTC+3, so a literal offset pins the local day boundary
// before converting to the UTC instant the API schema accepts.
function istanbulDayStartISO(date: string) {
  return new Date(`${date}T00:00:00+03:00`).toISOString();
}

function istanbulDayEndISO(date: string) {
  return new Date(`${date}T23:59:59+03:00`).toISOString();
}

function parseDraftDate(value: string) {
  if (!value) return undefined;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
