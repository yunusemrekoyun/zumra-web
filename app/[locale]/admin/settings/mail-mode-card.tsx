'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Mailbox, Send, TestTube } from 'lucide-react';
import { ModulePanel } from '@/components/ui';

type MailMode = 'live' | 'test';

const MODES: ReadonlyArray<{ key: MailMode; icon: typeof Send }> = [
  { key: 'live', icon: Send },
  { key: 'test', icon: TestTube },
];

export function MailModeCard() {
  const t = useTranslations('admin.settings.mailMode');
  const [mode, setMode] = useState<MailMode>('live');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: 'error' | 'success';
  }>();

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch('/api/admin/settings', {
          credentials: 'same-origin',
        });
        const body = await response.json().catch(() => ({}));
        if (active && response.ok && body.settings?.mailMode) {
          setMode(body.settings.mailMode === 'test' ? 'test' : 'live');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function selectMode(next: MailMode) {
    if (next === mode || busy || loading) {
      return;
    }
    const previous = mode;
    setMode(next);
    setBusy(true);
    setMessage(undefined);
    try {
      const response = await fetch('/api/admin/settings', {
        body: JSON.stringify({ mailMode: next }),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'PATCH',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(body.error ?? 'update_failed'));
      if (body.settings?.mailMode) {
        setMode(body.settings.mailMode === 'test' ? 'test' : 'live');
      }
      setMessage({ text: t('success'), type: 'success' });
    } catch {
      setMode(previous);
      setMessage({ text: t('error'), type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModulePanel>
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#533089]/8 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#533089]">
        <Mailbox className="h-4 w-4" />
        {t('badge')}
      </div>
      <h2 className="font-rosmatika text-2xl font-medium text-[#2E286C]">
        {t('title')}
      </h2>
      <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#2E286C]/65">
        {t('description')}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
        {MODES.map(({ key, icon: Icon }) => {
          const selected = mode === key;
          return (
            <button
              key={key}
              type="button"
              disabled={loading || busy}
              onClick={() => void selectMode(key)}
              aria-pressed={selected}
              className={`group relative flex flex-col gap-1 rounded-2xl border-2 p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                selected
                  ? 'border-[#533089] bg-[#533089]/6'
                  : 'border-[#2E286C]/10 bg-white hover:border-[#533089]/40'
              }`}
            >
              <span className="inline-flex items-center gap-2 text-sm font-bold text-[#2E286C]">
                <Icon className="h-4 w-4 text-[#533089]" />
                {t(`${key}.label`)}
                {selected && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#533089] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    <Check className="h-3 w-3" />
                    {t('active')}
                  </span>
                )}
              </span>
              <span className="text-[12px] font-semibold leading-5 text-[#2E286C]/55">
                {t(`${key}.hint`)}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 max-w-2xl rounded-2xl bg-[#2E286C]/4 px-4 py-3 text-[12px] font-semibold leading-5 text-[#2E286C]/60">
        {t('note')}
      </p>

      {message && (
        <div
          className={
            message.type === 'success'
              ? 'mt-4 rounded-2xl bg-[#0F9F6E]/10 px-4 py-3 text-sm font-semibold text-[#0B7F58]'
              : 'mt-4 rounded-2xl bg-[#B42318]/10 px-4 py-3 text-sm font-semibold text-[#B42318]'
          }
        >
          {message.text}
        </div>
      )}
    </ModulePanel>
  );
}
