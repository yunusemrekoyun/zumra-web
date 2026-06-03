import React from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── Types ───────────────────────────────────────────────────────── */

type SearchInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  containerClassName?: string;
};

/* ─── Component ───────────────────────────────────────────────────── */

export function SearchInput({ className, containerClassName, ...props }: SearchInputProps) {
  return (
    <div className={cn('relative', containerClassName)}>
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#2E286C]/40 pointer-events-none" />
      <input
        type="text"
        className={cn(
          'h-10 w-full rounded-xl border border-transparent bg-[#F8F9FC] pl-9 pr-4 text-sm font-medium text-[#2E286C] outline-none transition-all',
          'placeholder:text-[#2E286C]/35 focus:border-[#533089]/30',
          className,
        )}
        {...props}
      />
    </div>
  );
}
