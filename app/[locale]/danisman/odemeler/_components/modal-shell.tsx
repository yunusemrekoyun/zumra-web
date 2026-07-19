'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ModalShell({
  children,
  closeLabel,
  onClose,
  title,
  wide = false,
}: {
  children: ReactNode;
  closeLabel: string;
  onClose: () => void;
  title: string;
  wide?: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1646]/35 p-4"
    >
      <div
        className={cn(
          'max-h-[85dvh] w-full overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-6',
          wide ? 'max-w-2xl' : 'max-w-lg',
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-[#2E286C] sm:text-xl">
            {title}
          </h2>
          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#2E286C]/40 transition-colors hover:bg-black/[0.04] hover:text-[#2E286C]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
