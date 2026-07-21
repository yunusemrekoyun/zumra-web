'use client';

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastVariant = 'success' | 'error' | 'info';

type ToastInput = {
  description: string;
  title?: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastItem = Required<Omit<ToastInput, 'duration'>> & { id: number };

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

/**
 * Access the toast pusher. Degrades to a no-op when no provider is mounted
 * (e.g. public pages) so callers never need to guard.
 */
export function useToast() {
  const push = useContext(ToastContext);
  return { toast: push ?? (() => {}) };
}

const VARIANT_STYLES: Record<
  ToastVariant,
  { icon: typeof Info; ring: string; iconColor: string }
> = {
  success: {
    icon: CheckCircle2,
    ring: 'ring-emerald-500/20',
    iconColor: 'text-emerald-500',
  },
  error: {
    icon: AlertCircle,
    ring: 'ring-[#B42318]/20',
    iconColor: 'text-[#B42318]',
  },
  info: { icon: Info, ring: 'ring-[#533089]/20', iconColor: 'text-[#533089]' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      const id = (idRef.current += 1);
      const variant = input.variant ?? 'info';
      setItems((prev) => [
        ...prev.slice(-3),
        { id, variant, title: input.title ?? '', description: input.description },
      ]);
      const duration = input.duration ?? (variant === 'error' ? 6000 : 4000);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[200] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:items-end">
        {items.map((item) => {
          const style = VARIANT_STYLES[item.variant];
          const Icon = style.icon;
          return (
            <div
              key={item.id}
              role="status"
              className={cn(
                'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_12px_40px_-12px_rgba(46,40,108,0.35)] ring-1',
                style.ring,
                'motion-safe:animate-[toastIn_0.18s_ease-out]',
              )}
            >
              <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', style.iconColor)} />
              <div className="min-w-0 flex-1">
                {item.title && (
                  <p className="text-sm font-bold text-[#2E286C]">{item.title}</p>
                )}
                <p className="text-sm font-medium leading-5 text-[#2E286C]/70">
                  {item.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="-mr-1 -mt-1 shrink-0 rounded-lg p-1 text-[#2E286C]/30 transition-colors hover:bg-black/5 hover:text-[#2E286C]/60"
                aria-label="Kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
