"use client";

import React from 'react';
import { cn } from '@/lib/utils';

type FilterTabItem = {
  label: React.ReactNode;
  value: string;
};

type FilterTabsProps = {
  activeValue: string;
  className?: string;
  items: FilterTabItem[];
  onChange?: (value: string) => void;
};

export function FilterTabs({ activeValue, className, items, onChange }: FilterTabsProps) {
  return (
    <div className={cn('flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1', className)}>
      {items.map((item) => {
        const isActive = item.value === activeValue;

        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange?.(item.value)}
            aria-pressed={isActive}
            className={cn(
              'shrink-0 whitespace-nowrap px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors',
              isActive
                ? 'bg-[#533089]/5 text-[#533089] border border-[#533089]/20'
                : 'bg-transparent text-[#2E286C]/50 hover:bg-black/5',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
