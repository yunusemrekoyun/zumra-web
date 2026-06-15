'use client';

import { useMemo } from 'react';
import { getCountryOptions } from '@/lib/domain/locations';
import { cn } from '@/lib/utils';

export function CountrySelect({
  error,
  id,
  locale,
  onChange,
  placeholder,
  value,
}: {
  error?: boolean;
  id?: string;
  locale: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const options = useMemo(() => getCountryOptions(locale), [locale]);

  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        'h-12 w-full rounded-xl border bg-[#F8F9FC] px-4 text-sm font-medium text-[#2E286C] outline-none transition-colors focus:border-[#533089]/30',
        error ? 'border-red-400' : 'border-transparent',
      )}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.code} value={option.code}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

