'use client';

import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Landmark, Save } from 'lucide-react';
import {
  Button,
  FormField,
  Input,
  ModulePanel,
  StatusChip,
} from '@/components/ui';
import { isValidTurkishIban, normalizeIban } from '@/lib/domain/iban';

type BankAccount = {
  active: boolean;
  archivedAt: string | null;
  createdAt: string;
  holderName: string | null;
  iban: string;
  id: string;
};

export function InstructorBankPanel({
  instructorId,
}: {
  instructorId: string;
}) {
  const t = useTranslations('admin.instructors.bank');
  const locale = useLocale();
  const [accounts, setAccounts] = useState<BankAccount[] | null>(null);
  const [iban, setIban] = useState('');
  const [holder, setHolder] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');

  const loadAccounts = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/admin/instructor-bank-accounts?instructorId=${instructorId}`,
        { credentials: 'same-origin' },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error('load_failed');
      setAccounts(Array.isArray(body.accounts) ? body.accounts : []);
    } catch {
      setAccounts((current) => current ?? []);
      setError(t('errorGeneric'));
    }
  }, [instructorId, t]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  async function saveIban(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    setError('');
    if (!isValidTurkishIban(iban)) {
      setFieldError(t('invalid'));
      return;
    }
    setFieldError('');
    setBusy(true);
    try {
      const response = await fetch('/api/admin/instructor-bank-accounts', {
        body: JSON.stringify({
          holderName: holder.trim() || undefined,
          iban: normalizeIban(iban),
          instructorId,
        }),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      if (!response.ok) throw new Error('save_failed');
      setIban('');
      setHolder('');
      setMessage(t('saved'));
      await loadAccounts();
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  const activeAccount = accounts?.find((account) => account.active);
  const archivedAccounts =
    accounts?.filter((account) => !account.active) ?? [];

  return (
    <ModulePanel className="rounded-3xl">
      <div className="flex items-center gap-3">
        <Landmark className="h-5 w-5 text-[#533089]" />
        <h2 className="font-bold text-[#2E286C]">{t('title')}</h2>
      </div>

      {message && (
        <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {accounts === null ? (
        <div className="mt-5 h-16 animate-pulse rounded-2xl bg-[#F8F9FC]" />
      ) : activeAccount ? (
        <div className="mt-5 rounded-2xl bg-[#F8F9FC] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-mono text-sm font-bold tracking-wide text-[#2E286C]">
                {activeAccount.iban}
              </div>
              {activeAccount.holderName && (
                <div className="mt-1 text-xs font-medium text-[#2E286C]/55">
                  {activeAccount.holderName}
                </div>
              )}
              <div className="mt-1 text-xs text-[#2E286C]/40">
                {formatDate(activeAccount.createdAt, locale)}
              </div>
            </div>
            <StatusChip tone="emerald">{t('active')}</StatusChip>
          </div>
        </div>
      ) : (
        <p className="mt-5 text-sm font-semibold text-[#2E286C]/45">
          {t('empty')}
        </p>
      )}

      {archivedAccounts.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#2E286C]/45">
            {t('historyTitle')}
          </h3>
          <div className="mt-3 space-y-2 md:hidden">
            {archivedAccounts.map((account) => (
              <div key={account.id} className="rounded-xl bg-[#F8F9FC] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-bold text-[#2E286C]">
                      {account.iban}
                    </div>
                    {account.holderName && (
                      <div className="mt-1 text-xs text-[#2E286C]/55">
                        {account.holderName}
                      </div>
                    )}
                    <div className="mt-1 text-[11px] text-[#2E286C]/40">
                      {formatDate(account.createdAt, locale)}
                    </div>
                  </div>
                  <StatusChip tone="gray">{t('archived')}</StatusChip>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#F8F9FC] text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/50">
                  <th className="rounded-l-xl px-4 py-3 font-bold">
                    {t('colIban')}
                  </th>
                  <th className="px-4 py-3 font-bold">{t('colHolder')}</th>
                  <th className="px-4 py-3 font-bold">{t('colCreatedAt')}</th>
                  <th className="rounded-r-xl px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.03] text-sm font-medium text-[#2E286C]/80">
                {archivedAccounts.map((account) => (
                  <tr key={account.id}>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-bold text-[#2E286C]">
                      {account.iban}
                    </td>
                    <td className="px-4 py-3 text-[#2E286C]/60">
                      {account.holderName ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#2E286C]/60">
                      {formatDate(account.createdAt, locale)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <StatusChip tone="gray">{t('archived')}</StatusChip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <form className="mt-6 space-y-3" onSubmit={saveIban}>
        <FormField
          label={t('iban')}
          error={fieldError || undefined}
          required
        >
          <Input
            value={iban}
            onChange={(event) => {
              setIban(event.target.value.toUpperCase());
              if (fieldError) setFieldError('');
            }}
            placeholder="TR00 0000 0000 0000 0000 0000 00"
            autoComplete="off"
            spellCheck={false}
          />
        </FormField>
        <FormField label={t('holder')}>
          <Input
            value={holder}
            onChange={(event) => setHolder(event.target.value)}
            maxLength={120}
          />
        </FormField>
        <Button type="submit" disabled={busy || !iban.trim()}>
          <Save className="h-4 w-4" />
          {t('save')}
        </Button>
        <p className="text-xs leading-5 text-[#2E286C]/40">{t('hint')}</p>
      </form>
    </ModulePanel>
  );
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}
