import React from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

/* ─── Types ───────────────────────────────────────────────────────── */

type EmptyStateProps = {
  action?: React.ReactNode;
  className?: string;
  description?: string;
  icon?: LucideIcon;
  title?: string;
};

/* ─── Component ───────────────────────────────────────────────────── */

export function EmptyState({
  action,
  className,
  description = 'Bu modül yapım aşamasındadır.',
  icon: Icon = Inbox,
  title = 'Yakında Burada',
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'min-h-[calc(100dvh-9rem)] lg:h-full flex flex-col items-center justify-center',
        'bg-white rounded-3xl border border-black/[0.02] p-8 lg:p-12 text-center',
        className,
      )}
    >
      <div className="w-16 h-16 rounded-2xl bg-[#533089]/5 flex items-center justify-center mb-6">
        <Icon className="w-7 h-7 text-[#533089]/40" />
      </div>
      <h2 className="font-rosmatika text-xl font-medium text-[#2E286C] mb-2">{title}</h2>
      <p className="text-sm font-medium text-[#2E286C]/40 max-w-xs leading-relaxed">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
