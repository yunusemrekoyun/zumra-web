'use client';

import { Input } from './input';
import { cn } from '@/lib/utils';

export function IdentityDocumentInput({
  error,
  id,
  maskedValue,
  onChange,
  placeholder,
  type,
  value,
}: {
  error?: boolean;
  id?: string;
  maskedValue?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type: 'national_id' | 'passport';
  value: string;
}) {
  const displayValue =
    type === 'national_id' ? formatNationalId(value) : value.toUpperCase();

  return (
    <Input
      id={id}
      inputMode={type === 'national_id' ? 'numeric' : 'text'}
      autoComplete="off"
      value={displayValue}
      maxLength={type === 'national_id' ? 14 : 20}
      placeholder={maskedValue ? `${maskedValue} · ${placeholder ?? ''}` : placeholder}
      onChange={(event) =>
        onChange(
          type === 'national_id'
            ? event.target.value.replace(/\D/g, '').slice(0, 11)
            : event.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 20),
        )
      }
      className={cn('h-12', error && 'border-red-400 focus:border-red-500')}
    />
  );
}

export function formatNationalId(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9), digits.slice(9, 11)]
    .filter(Boolean)
    .join(' ');
}

