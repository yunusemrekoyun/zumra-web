import React from 'react';
import { cn } from '@/lib/utils';

type InfoFieldProps = {
  className?: string;
  label: React.ReactNode;
  labelClassName?: string;
  value: React.ReactNode;
  valueClassName?: string;
};

export function InfoField({ className, label, labelClassName, value, valueClassName }: InfoFieldProps) {
  return (
    <div className={className}>
      <div className={cn('text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/40', labelClassName)}>
        {label}
      </div>
      <div className={cn('text-sm font-bold text-[#2E286C]', valueClassName)}>
        {value}
      </div>
    </div>
  );
}
