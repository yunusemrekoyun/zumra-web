'use client';

import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

type ResponsiveTabItem = {
  content: React.ReactNode;
  label: string;
  value: string;
};

type ResponsiveTabsProps = {
  className?: string;
  defaultValue?: string;
  items: ResponsiveTabItem[];
};

export function ResponsiveTabs({ className, defaultValue, items }: ResponsiveTabsProps) {
  const initialValue = useMemo(() => defaultValue ?? items[0]?.value ?? '', [defaultValue, items]);
  const [activeValue, setActiveValue] = useState(initialValue);
  const activeItem = items.find((item) => item.value === activeValue) ?? items[0];

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex overflow-x-auto rounded-2xl border border-black/[0.03] bg-white p-1 shadow-sm custom-scrollbar">
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setActiveValue(item.value)}
            className={cn(
              'touch-button flex-1 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all',
              activeItem?.value === item.value
                ? 'bg-[#533089] text-white shadow-md shadow-[#533089]/20'
                : 'text-[#2E286C]/50 hover:bg-black/[0.03] hover:text-[#2E286C]',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div>{activeItem?.content}</div>
    </div>
  );
}
