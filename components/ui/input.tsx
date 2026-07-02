import React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-xl border border-[#2E286C]/10 bg-[#F8F9FC] px-4 text-sm font-medium text-[#2E286C] outline-none transition-all placeholder:text-[#2E286C]/35 focus:border-[#533089]/30',
        className,
      )}
      {...props}
    />
  );
}
