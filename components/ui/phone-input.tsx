'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';
import { getCountryOptions } from '@/lib/domain/locations';
import { cn } from '@/lib/utils';
import { Input } from './input';

export function PhoneInput({
  defaultCountry = 'TR',
  error,
  id,
  locale,
  onChange,
  value,
}: {
  defaultCountry?: CountryCode;
  error?: boolean;
  id?: string;
  locale: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const initial = parsePhoneNumberFromString(value);
  const [country, setCountry] = useState<CountryCode>(
    initial?.country ?? defaultCountry,
  );
  const [displayValue, setDisplayValue] = useState(
    initial ? initial.formatNational() : value,
  );
  const options = useMemo(() => {
    const supported = new Set(getCountries());
    return getCountryOptions(locale).filter((option) =>
      supported.has(option.code as CountryCode),
    );
  }, [locale]);

  useEffect(() => {
    const parsed = parsePhoneNumberFromString(value);
    if (parsed?.country) {
      setCountry(parsed.country);
      setDisplayValue(parsed.formatNational());
      if (parsed.number !== value) {
        onChange(parsed.number);
      }
    } else if (!value) {
      setDisplayValue('');
    }
  }, [onChange, value]);

  function updatePhone(rawValue: string, nextCountry = country) {
    const formatter = new AsYouType(nextCountry);
    const formatted = formatter.input(rawValue);
    const number = formatter.getNumber();
    const digits = rawValue.replace(/\D/g, '').replace(/^0+/, '');
    setDisplayValue(formatted);
    onChange(
      number?.number ??
        (digits
          ? `+${getCountryCallingCode(nextCountry)}${digits}`
          : ''),
    );
  }

  return (
    <div
      className={cn(
        'flex h-12 overflow-hidden rounded-xl border bg-[#F8F9FC] transition-colors focus-within:border-[#533089]/30',
        error ? 'border-red-400 focus-within:border-red-500' : 'border-transparent',
      )}
    >
      <select
        aria-label={locale === 'en' ? 'Country code' : 'Ülke kodu'}
        value={country}
        onChange={(event) => {
          const nextCountry = event.target.value as CountryCode;
          setCountry(nextCountry);
          updatePhone(displayValue, nextCountry);
        }}
        className="w-[7.75rem] border-0 border-r border-black/[0.05] bg-transparent px-3 text-xs font-bold text-[#2E286C] outline-none"
      >
        {options.map((option) => (
          <option key={option.code} value={option.code}>
            {option.code} +{getCountryCallingCode(option.code as CountryCode)}
          </option>
        ))}
      </select>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={displayValue}
        onChange={(event) => updatePhone(event.target.value)}
        className="h-full rounded-none border-0 bg-transparent focus:border-0"
      />
    </div>
  );
}
