import React from 'react';
import { cn } from '@/lib/utils';

/* ─── Types ───────────────────────────────────────────────────────── */

type SectionHeaderProps = {
  action?: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  title: React.ReactNode;
};

/* ─── Component ───────────────────────────────────────────────────── */

export function SectionHeader({ action, className, description, title }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-4 mb-6', className)}>
      <div>
        <h3 className="font-bold text-[#2E286C] text-lg">{title}</h3>
        {description && (
          <p className="text-sm font-medium text-[#2E286C]/50 mt-0.5">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
