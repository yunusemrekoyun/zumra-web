'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

type NotificationType =
  | 'assignment_assigned'
  | 'assignment_submitted'
  | 'assignment_graded'
  | 'chat_message'
  | 'lead_received'
  | 'payment_reported'
  | 'payment_confirmed'
  | 'payment_rejected'
  | 'payment_review_stale'
  | 'installment_due'
  | 'settlement_recorded'
  | 'task_due';

type NotificationItem = {
  id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  href?: string;
  read: boolean;
  createdAt: string;
};

const POLL_INTERVAL_MS = 30000;

export function NotificationBell() {
  const t = useTranslations('notifications');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications', {
        credentials: 'same-origin',
      });
      if (!response.ok) return;
      const data = (await response.json()) as {
        items: NotificationItem[];
        unread: number;
      };
      setItems(data.items ?? []);
      setUnread(data.unread ?? 0);
    } catch {
      // transient
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      setItems((current) => current.map((item) => ({ ...item, read: true })));
      try {
        await fetch('/api/notifications/read', {
          method: 'POST',
          credentials: 'same-origin',
        });
      } catch {
        // optimistic; next load reconciles
      }
    }
  }

  function titleFor(item: NotificationItem): string {
    const p = item.payload ?? {};
    switch (item.type) {
      case 'assignment_assigned':
        return t('assignmentAssigned', { title: String(p.title ?? '') });
      case 'assignment_submitted':
        return t('assignmentSubmitted', {
          student: String(p.studentName ?? ''),
          title: String(p.assignmentTitle ?? ''),
        });
      case 'assignment_graded':
        return t('assignmentGraded', {
          title: String(p.assignmentTitle ?? ''),
          score: String(p.score ?? ''),
          max: String(p.max ?? ''),
        });
      case 'chat_message':
        return t('chatMessage', { from: String(p.fromName ?? '') });
      case 'lead_received':
        return t('leadReceived', { name: String(p.name ?? '') });
      case 'payment_reported':
        return t('paymentReported', {
          amount: String(p.amount ?? ''),
          student: String(p.studentName ?? ''),
        });
      case 'payment_confirmed':
        return t('paymentConfirmed', { amount: String(p.amount ?? '') });
      case 'payment_rejected':
        return t('paymentRejected', { reason: String(p.reason ?? '') });
      case 'payment_review_stale':
        return t('paymentReviewStale', { count: String(p.count ?? '') });
      case 'installment_due': {
        const rawDue = String(p.dueDate ?? '');
        const parsedDue = /^\d{4}-\d{2}-\d{2}$/.test(rawDue)
          ? new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }).format(new Date(`${rawDue}T00:00:00`))
          : rawDue;
        return t('installmentDue', {
          amount: String(p.amount ?? ''),
          due: parsedDue,
        });
      }
      case 'settlement_recorded':
        return t('settlementRecorded', { amount: String(p.amount ?? '') });
      case 'task_due':
        return t('taskDue', { title: String(p.title ?? '') });
      default:
        return '';
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => void toggle()}
        aria-label={t('title')}
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#2E286C]/40 shadow-sm transition-colors hover:text-[#533089] lg:h-10 lg:w-10"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-6rem)] rounded-2xl border border-black/[0.06] bg-white p-2 shadow-xl">
          <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#2E286C]/40">
            {t('title')}
          </p>
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm font-medium text-[#2E286C]/40">
              {t('empty')}
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {items.map((item) => {
                const inner = (
                  <div
                    className={cn(
                      'rounded-xl px-3 py-2.5 transition-colors',
                      item.read ? 'hover:bg-black/[0.02]' : 'bg-[#533089]/5',
                    )}
                  >
                    <p className="text-sm font-medium leading-snug text-[#2E286C]">
                      {titleFor(item)}
                    </p>
                  </div>
                );
                return item.href ? (
                  <a
                    key={item.id}
                    href={`/${locale}${item.href}`}
                    className="block"
                    onClick={() => setOpen(false)}
                  >
                    {inner}
                  </a>
                ) : (
                  <div key={item.id}>{inner}</div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
