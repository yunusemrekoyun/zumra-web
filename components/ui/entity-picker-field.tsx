'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronsUpDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from './avatar';
import { EntityGlyph } from './entity-glyph';
import { EntityPicker, type EntityPickerItem } from './entity-picker';

/**
 * Form-field trigger for the EntityPicker: looks like an input, shows the
 * current selection with its identity, opens the modal on click.
 */
export function EntityPickerField({
  busy,
  description,
  disabled = false,
  error,
  filters,
  icon,
  items,
  label,
  onSelect,
  placeholder,
  title,
  value,
}: {
  busy?: boolean;
  description?: string;
  disabled?: boolean;
  error?: string;
  filters?: Array<{ label: string; value: string }>;
  icon?: LucideIcon;
  items: EntityPickerItem[];
  label?: string;
  onSelect: (item: EntityPickerItem) => void;
  placeholder: string;
  title: string;
  value?: EntityPickerItem | null;
}) {
  const t = useTranslations('workspace.entityPicker');
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-1.5">
      {label && (
        <div className="text-xs font-semibold text-[#2E286C]/55">{label}</div>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          'flex min-h-12 w-full items-center gap-3 rounded-xl border bg-[#F8F9FC] px-3 py-2 text-left transition-colors',
          error
            ? 'border-red-400'
            : 'border-transparent hover:border-[#533089]/30',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        {value ? (
          <>
            {value.identity.kind === 'person' ? (
              <Avatar
                name={value.identity.name}
                size="sm"
                src={value.identity.photoUrl}
                className="bg-white shadow-sm"
              />
            ) : (
              <EntityGlyph
                name={value.identity.name}
                language={value.identity.language}
                kind={value.identity.programKind}
                tintSeed={value.identity.tintSeed}
                size="sm"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-[#2E286C]">
                {value.title}
              </div>
              {value.subtitle && (
                <div className="truncate text-xs font-medium text-[#2E286C]/45">
                  {value.subtitle}
                </div>
              )}
            </div>
          </>
        ) : (
          <span className="flex-1 truncate text-sm font-medium text-[#2E286C]/35">
            {placeholder}
          </span>
        )}
        <span className="flex-none text-[11px] font-bold uppercase tracking-wider text-[#533089]">
          {value ? t('change') : t('choose')}
        </span>
        <ChevronsUpDown className="h-4 w-4 flex-none text-[#2E286C]/30" />
      </button>
      {error && (
        <p className="text-xs font-semibold text-red-600">{error}</p>
      )}
      <EntityPicker
        busy={busy}
        description={description}
        filters={filters}
        icon={icon}
        items={items}
        onClose={() => setOpen(false)}
        onSelect={(item) => {
          onSelect(item);
          setOpen(false);
        }}
        open={open}
        title={title}
      />
    </div>
  );
}
