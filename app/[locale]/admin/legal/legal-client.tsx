'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  ExternalLink,
  Eye,
  EyeOff,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import type { AdminLegalPage } from '@/lib/server/services/legal-pages';
import { RichTextEditor } from './_components/rich-text-editor';

type FormState = {
  slug: string;
  titleTr: string;
  titleEn: string;
  bodyTr: string;
  bodyEn: string;
  published: boolean;
  showInFooter: boolean;
  sortOrder: number;
};

const NEW = 'new';

function toForm(page: AdminLegalPage): FormState {
  return {
    slug: page.slug,
    titleTr: page.titleTr,
    titleEn: page.titleEn,
    bodyTr: page.bodyTr,
    bodyEn: page.bodyEn,
    published: page.published,
    showInFooter: page.showInFooter,
    sortOrder: page.sortOrder,
  };
}

function emptyForm(nextOrder: number): FormState {
  return {
    slug: '',
    titleTr: '',
    titleEn: '',
    bodyTr: '',
    bodyEn: '',
    published: false,
    showInFooter: true,
    sortOrder: nextOrder,
  };
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-bold text-[#2E286C]">{label}</span>
        {hint ? (
          <span className="mt-0.5 block text-xs text-[#2E286C]/55">{hint}</span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 flex-none rounded-full transition-colors ${
          checked ? 'bg-[#533089]' : 'bg-[#2E286C]/20'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </label>
  );
}

export function LegalClient({
  initialPages,
  locale,
}: {
  initialPages: AdminLegalPage[];
  locale: string;
}) {
  const t = useTranslations('admin.legal');
  const [pages, setPages] = useState(initialPages);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialPages[0]?.id ?? null,
  );
  const [form, setForm] = useState<FormState>(
    initialPages[0] ? toForm(initialPages[0]) : emptyForm(0),
  );
  const [lang, setLang] = useState<'tr' | 'en'>('tr');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: 'ok' | 'error';
    text: string;
  } | null>(null);

  const isNew = selectedId === NEW;

  function selectPage(page: AdminLegalPage) {
    setSelectedId(page.id);
    setForm(toForm(page));
    setLang('tr');
    setFeedback(null);
  }

  function startNew() {
    const nextOrder =
      pages.reduce((max, p) => Math.max(max, p.sortOrder), 0) + 1;
    setSelectedId(NEW);
    setForm(emptyForm(nextOrder));
    setLang('tr');
    setFeedback(null);
  }

  function patch(next: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...next }));
  }

  async function save() {
    if (!form.titleTr.trim()) {
      setFeedback({ kind: 'error', text: t('error.titleRequired') });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const url = isNew
        ? '/api/admin/legal-pages'
        : `/api/admin/legal-pages/${selectedId}`;
      const response = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug: form.slug.trim() || undefined,
          titleTr: form.titleTr,
          titleEn: form.titleEn,
          bodyTr: form.bodyTr,
          bodyEn: form.bodyEn,
          published: form.published,
          showInFooter: form.showInFooter,
          sortOrder: form.sortOrder,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        page?: AdminLegalPage;
        error?: string;
      };
      if (!response.ok || !body.page) {
        const map: Record<string, string> = {
          slug_reserved: t('error.slugReserved'),
          slug_taken: t('error.slugTaken'),
        };
        setFeedback({
          kind: 'error',
          text: (body.error && map[body.error]) || t('error.generic'),
        });
        return;
      }
      const saved = body.page;
      setPages((prev) => {
        const without = prev.filter((p) => p.id !== saved.id);
        return [...without, saved].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.titleTr.localeCompare(b.titleTr),
        );
      });
      setSelectedId(saved.id);
      setForm(toForm(saved));
      setFeedback({ kind: 'ok', text: t('action.saved') });
    } catch {
      setFeedback({ kind: 'error', text: t('error.generic') });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (isNew || !selectedId) {
      setSelectedId(pages[0]?.id ?? null);
      if (pages[0]) setForm(toForm(pages[0]));
      return;
    }
    if (!window.confirm(t('action.deleteConfirm'))) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/legal-pages/${selectedId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!response.ok) {
        setFeedback({ kind: 'error', text: t('error.generic') });
        return;
      }
      const remaining = pages.filter((p) => p.id !== selectedId);
      setPages(remaining);
      if (remaining[0]) {
        selectPage(remaining[0]);
      } else {
        setSelectedId(null);
      }
    } catch {
      setFeedback({ kind: 'error', text: t('error.generic') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      {/* List */}
      <aside className="flex flex-col gap-3">
        <Button
          variant="secondary"
          onClick={startNew}
          className="justify-start"
        >
          <Plus className="h-4 w-4" />
          {t('list.new')}
        </Button>
        <ul className="flex flex-col gap-2">
          {pages.map((page) => {
            const active = page.id === selectedId;
            return (
              <li key={page.id}>
                <button
                  type="button"
                  onClick={() => selectPage(page)}
                  className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                    active
                      ? 'border-[#533089]/40 bg-[#533089]/[0.06]'
                      : 'border-black/10 bg-white hover:border-[#533089]/20'
                  }`}
                >
                  <span className="block text-sm font-bold text-[#2E286C]">
                    {page.titleTr}
                  </span>
                  <span className="mt-0.5 block font-mono text-[11px] text-[#2E286C]/45">
                    /{page.slug}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        page.published
                          ? 'bg-emerald-500/12 text-emerald-700'
                          : 'bg-amber-500/12 text-amber-700'
                      }`}
                    >
                      {page.published ? (
                        <Eye className="h-3 w-3" />
                      ) : (
                        <EyeOff className="h-3 w-3" />
                      )}
                      {page.published ? t('badge.published') : t('badge.draft')}
                    </span>
                    {page.showInFooter ? (
                      <span className="rounded-full bg-[#533089]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#533089]">
                        {t('badge.footer')}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Editor */}
      {selectedId === null ? (
        <div className="flex items-center justify-center rounded-3xl border border-dashed border-black/10 bg-white p-16 text-sm text-[#2E286C]/50">
          {t('list.empty')}
        </div>
      ) : (
        <section className="flex flex-col gap-5 rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
          {feedback ? (
            <div
              className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                feedback.kind === 'ok'
                  ? 'bg-emerald-500/10 text-emerald-700'
                  : 'bg-red-500/10 text-red-600'
              }`}
            >
              {feedback.text}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#2E286C]/60">
                {t('field.slug')}
              </span>
              <Input
                value={form.slug}
                onChange={(e) => patch({ slug: e.target.value })}
                placeholder={t('field.slugPlaceholder')}
                className="font-mono"
              />
              <span className="text-xs text-[#2E286C]/45">
                {t('field.slugHint')}
              </span>
            </label>
            <label className="flex w-full flex-col gap-1.5 sm:w-28">
              <span className="text-xs font-bold uppercase tracking-wider text-[#2E286C]/60">
                {t('field.sortOrder')}
              </span>
              <Input
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={(e) =>
                  patch({ sortOrder: Number(e.target.value) || 0 })
                }
              />
            </label>
          </div>

          {/* Language tabs */}
          <div className="flex gap-1 rounded-2xl bg-[#F8F9FC] p-1">
            {(['tr', 'en'] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                className={`flex-1 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                  lang === code
                    ? 'bg-white text-[#533089] shadow-sm'
                    : 'text-[#2E286C]/55 hover:text-[#2E286C]'
                }`}
              >
                {t(`lang.${code}`)}
              </button>
            ))}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-[#2E286C]/60">
              {t('field.title')}
            </span>
            <Input
              value={lang === 'tr' ? form.titleTr : form.titleEn}
              onChange={(e) =>
                patch(
                  lang === 'tr'
                    ? { titleTr: e.target.value }
                    : { titleEn: e.target.value },
                )
              }
              placeholder={
                lang === 'en' ? t('field.titleEnPlaceholder') : undefined
              }
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-[#2E286C]/60">
              {t('field.content')}
            </span>
            {lang === 'tr' ? (
              <RichTextEditor
                key={`${selectedId}-tr`}
                value={form.bodyTr}
                onChange={(html) => patch({ bodyTr: html })}
                ariaLabel={t('field.content')}
              />
            ) : (
              <RichTextEditor
                key={`${selectedId}-en`}
                value={form.bodyEn}
                onChange={(html) => patch({ bodyEn: html })}
                ariaLabel={t('field.content')}
              />
            )}
          </div>

          <div className="grid gap-4 rounded-2xl bg-[#F8F9FC] p-4 sm:grid-cols-2">
            <Toggle
              checked={form.published}
              onChange={(v) => patch({ published: v })}
              label={t('field.published')}
              hint={t('field.publishedHint')}
            />
            <Toggle
              checked={form.showInFooter}
              onChange={(v) => patch({ showInFooter: v })}
              label={t('field.footer')}
              hint={t('field.footerHint')}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={save} disabled={busy}>
              <Save className="h-4 w-4" />
              {busy ? t('action.saving') : isNew ? t('action.create') : t('action.save')}
            </Button>
            {!isNew && form.published ? (
              <a
                href={`/${locale}/${form.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-black/10 bg-white px-5 text-xs font-bold uppercase tracking-wider text-[#2E286C] transition-colors hover:bg-black/[0.03]"
              >
                <ExternalLink className="h-4 w-4" />
                {t('action.preview')}
              </a>
            ) : null}
            {!isNew ? (
              <Button
                variant="ghost"
                onClick={remove}
                disabled={busy}
                className="ml-auto text-red-500 hover:bg-red-500/10 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
                {t('action.delete')}
              </Button>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}
