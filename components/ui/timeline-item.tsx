import React from 'react';
import { cn } from '@/lib/utils';

/* ─── Types ───────────────────────────────────────────────────────── */

type TimelineTone = 'brand' | 'emerald' | 'blue' | 'amber' | 'red';

type TimelineItemProps = {
  children?: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  time: string;
  title: string;
  tone?: TimelineTone;
};

/* ─── Tone styles ─────────────────────────────────────────────────── */

const dotStyles: Record<TimelineTone, string> = {
  amber: 'bg-amber-500',
  blue: 'bg-blue-500',
  brand: 'bg-[#533089]',
  emerald: 'bg-emerald-500',
  red: 'bg-red-500',
};

const bgStyles: Record<TimelineTone, string> = {
  amber: 'bg-amber-50 border-white',
  blue: 'bg-blue-50 border-white',
  brand: 'bg-[#533089]/10 border-white',
  emerald: 'bg-emerald-50 border-white',
  red: 'bg-red-50 border-white',
};

const textStyles: Record<TimelineTone, string> = {
  amber: 'text-amber-700',
  blue: 'text-blue-700',
  brand: 'text-[#533089]',
  emerald: 'text-emerald-700',
  red: 'text-red-700',
};

/* ─── Component ───────────────────────────────────────────────────── */

export function TimelineItem({
  children,
  className,
  description,
  time,
  title,
  tone = 'brand',
}: TimelineItemProps) {
  return (
    <div className={cn('flex gap-4 group cursor-pointer', className)}>
      <div className="w-6 flex flex-col items-center shrink-0">
        <div
          className={cn(
            'w-3 h-3 rounded-full border-2 border-white mt-1 transition-all',
            dotStyles[tone],
          )}
        />
      </div>
      <div
        className={cn(
          'flex-1 rounded-2xl p-4 border group-hover:shadow-sm transition-all',
          bgStyles[tone],
        )}
      >
        <div className={cn('text-xs font-bold mb-1 opacity-70', textStyles[tone])}>{time}</div>
        <div className={cn('text-sm font-bold', textStyles[tone])}>{title}</div>
        {description && (
          <p className={cn('text-xs font-medium mt-1 opacity-60', textStyles[tone])}>{description}</p>
        )}
        {children}
      </div>
    </div>
  );
}
