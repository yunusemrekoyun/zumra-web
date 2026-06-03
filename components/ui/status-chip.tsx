import React from 'react';
import { cn } from '@/lib/utils';

/* ─── Types ───────────────────────────────────────────────────────── */

type StatusTone = 'emerald' | 'blue' | 'amber' | 'red' | 'purple' | 'gray';

type StatusChipProps = {
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
  tone?: StatusTone;
};

/* ─── Tone styles ─────────────────────────────────────────────────── */

const toneStyles: Record<StatusTone, string> = {
  amber: 'border-amber-500/20 bg-amber-50 text-amber-700',
  blue: 'border-blue-500/20 bg-blue-50 text-blue-700',
  emerald: 'border-emerald-500/20 bg-emerald-50 text-emerald-700',
  gray: 'border-gray-300 bg-gray-50 text-gray-600',
  purple: 'border-[#533089]/20 bg-[#533089]/5 text-[#533089]',
  red: 'border-red-500/20 bg-red-50 text-red-700',
};

/* ─── Component ───────────────────────────────────────────────────── */

export function StatusChip({ children, className, icon, tone = 'gray' }: StatusChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border',
        toneStyles[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
