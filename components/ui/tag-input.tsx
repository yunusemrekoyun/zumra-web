'use client';

import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { appendUniqueTag } from '@/lib/domain/tags';
import { Input } from './input';
import { cn } from '@/lib/utils';

export function TagInput({
  error,
  maxLength = 100,
  maxTags = 30,
  locale = 'tr',
  onChange,
  placeholder,
  value,
}: {
  error?: boolean;
  maxLength?: number;
  maxTags?: number;
  locale?: string;
  onChange: (value: string[]) => void;
  placeholder?: string;
  value: string[];
}) {
  const [draft, setDraft] = useState('');

  function addTag(rawValue: string) {
    onChange(appendUniqueTag(value, rawValue, { maxLength, maxTags }));
    setDraft('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTag(draft);
      return;
    }
    if (event.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div
      className={cn(
        'rounded-xl border bg-[#F8F9FC] p-2 transition-colors',
        error ? 'border-red-400' : 'border-transparent focus-within:border-[#533089]/30',
      )}
    >
      <div className="flex flex-wrap gap-2">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-[#533089]/8 px-2.5 text-xs font-bold text-[#533089]"
          >
            {tag}
            <button
              type="button"
              aria-label={
                locale === 'en' ? `Remove ${tag}` : `${tag} etiketini kaldır`
              }
              onClick={() => onChange(value.filter((item) => item !== tag))}
              className="rounded p-0.5 hover:bg-[#533089]/10"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <Input
          value={draft}
          onChange={(event) => {
            const next = event.target.value;
            if (next.includes(',')) {
              addTag(next.replaceAll(',', ''));
            } else {
              setDraft(next);
            }
          }}
          onBlur={() => addTag(draft)}
          onKeyDown={handleKeyDown}
          placeholder={value.length ? undefined : placeholder}
          className="h-8 min-w-40 flex-1 border-0 bg-transparent px-2 focus:border-0"
        />
      </div>
    </div>
  );
}
