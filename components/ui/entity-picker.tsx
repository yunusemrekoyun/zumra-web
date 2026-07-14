'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from './avatar';
import { EntityGlyph } from './entity-glyph';
import { FilterTabs } from './filter-tabs';
import { SearchInput } from './search-input';

/* ─── Types ───────────────────────────────────────────────────────── */

export type EntityPickerItem = {
  id: string;
  title: string;
  subtitle?: string;
  /** Person → round avatar (photo/initials); thing → square glyph. */
  identity:
    | { kind: 'person'; name: string; photoUrl?: string | null }
    | {
        kind: 'entity';
        name: string;
        language?: string | null;
        programKind?: 'group' | 'private';
        tintSeed?: string;
      };
  /** Right-aligned chip, e.g. capacity or price. */
  meta?: { label: string; tone?: 'amber' | 'default' | 'emerald' | 'red' };
  disabled?: boolean;
  disabledReason?: string;
  /** Optional filter-tab group this item belongs to. */
  group?: string;
};

type EntityPickerProps = {
  busy?: boolean;
  description?: string;
  filters?: Array<{ label: string; value: string }>;
  icon?: LucideIcon;
  items: EntityPickerItem[];
  onClose: () => void;
  onSelect: (item: EntityPickerItem) => void;
  open: boolean;
  title: string;
};

const metaTones = {
  amber: 'bg-amber-50 text-amber-700',
  default: 'bg-[#F8F9FC] text-[#2E286C]/60',
  emerald: 'bg-emerald-50 text-emerald-700',
  red: 'bg-red-50 text-red-700',
} as const;

/* ─── Component ───────────────────────────────────────────────────── */

/**
 * The app-wide "pick one" surface: a searchable modal of identity cards.
 * Every list-based choice (person, program, branch, lesson…) goes through
 * this so selection looks and behaves the same everywhere.
 */
export function EntityPicker({
  busy = false,
  description,
  filters,
  icon: Icon,
  items,
  onClose,
  onSelect,
  open,
  title,
}: EntityPickerProps) {
  const t = useTranslations('workspace.entityPicker');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Reset only when the modal (re)opens. A parent re-render hands us a new
  // onClose identity, and tying the reset to it would wipe the query mid-type.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setGroup('all');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('tr-TR');
    return items.filter((item) => {
      if (group !== 'all' && item.group !== group) return false;
      if (!normalized) return true;
      return `${item.title} ${item.subtitle ?? ''}`
        .toLocaleLowerCase('tr-TR')
        .includes(normalized);
    });
  }, [group, items, query]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="zumra-modal-overlay fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto bg-[#221B4B]/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="zumra-modal-panel flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start gap-3 border-b border-black/[0.04] p-5 sm:p-6">
          {Icon && (
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-[#533089]/10 text-[#533089]">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-[#2E286C]">{title}</h2>
            {description && (
              <p className="text-sm text-[#2E286C]/50">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-xl text-[#2E286C]/45 transition-colors hover:bg-black/[0.04]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 border-b border-black/[0.04] px-5 py-4 sm:px-6">
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('search')}
            autoFocus
          />
          {filters && filters.length > 0 && (
            <FilterTabs
              activeValue={group}
              onChange={setGroup}
              items={[{ label: t('all'), value: 'all' }, ...filters]}
            />
          )}
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto p-4 sm:p-5">
          {visible.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {visible.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={busy || item.disabled}
                  onClick={() => onSelect(item)}
                  title={item.disabled ? item.disabledReason : undefined}
                  className={cn(
                    'group flex items-center gap-3 rounded-2xl bg-[#F8F9FC] p-3 text-left ring-1 ring-black/[0.04] transition-all',
                    item.disabled
                      ? 'opacity-50'
                      : 'hover:ring-[#533089]/40 active:scale-[0.99]',
                    busy && 'opacity-60',
                  )}
                >
                  {item.identity.kind === 'person' ? (
                    <Avatar
                      name={item.identity.name}
                      size="md"
                      src={item.identity.photoUrl}
                      className="bg-white shadow-sm"
                    />
                  ) : (
                    <EntityGlyph
                      name={item.identity.name}
                      language={item.identity.language}
                      kind={item.identity.programKind}
                      tintSeed={item.identity.tintSeed}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        'truncate text-sm font-bold text-[#2E286C] transition-colors',
                        !item.disabled && 'group-hover:text-[#533089]',
                      )}
                    >
                      {item.title}
                    </div>
                    {(item.subtitle || (item.disabled && item.disabledReason)) && (
                      <div className="truncate text-xs font-medium text-[#2E286C]/45">
                        {item.disabled && item.disabledReason
                          ? item.disabledReason
                          : item.subtitle}
                      </div>
                    )}
                  </div>
                  {item.meta && (
                    <span
                      className={cn(
                        'flex-none rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider',
                        metaTones[item.meta.tone ?? 'default'],
                      )}
                    >
                      {item.meta.label}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-[#2E286C]/45">
              {t('empty')}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
