'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, PlayCircle } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

/* ─── Types ───────────────────────────────────────────────────────── */

type LessonStatus = 'completed' | 'upcoming' | 'in-progress';

type LessonCardProps = {
  className?: string;
  dateTime: string;
  instructor: string;
  status: LessonStatus;
  title: string;
  topic?: string;
};

/* ─── Status config ───────────────────────────────────────────────── */

const statusConfig: Record<LessonStatus, { bg: string; icon: React.ReactNode; label: string; text: string }> = {
  completed: {
    bg: 'bg-emerald-50 border-emerald-100',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    label: 'Tamamlandı',
    text: 'text-emerald-700',
  },
  'in-progress': {
    bg: 'bg-[#533089]/5 border-[#533089]/10',
    icon: <PlayCircle className="w-4 h-4 text-[#533089]" />,
    label: 'Devam Ediyor',
    text: 'text-[#533089]',
  },
  upcoming: {
    bg: 'bg-blue-50 border-blue-100',
    icon: <Clock className="w-4 h-4 text-blue-500" />,
    label: 'Yaklaşan',
    text: 'text-blue-700',
  },
};

/* ─── Component ───────────────────────────────────────────────────── */

export function LessonCard({ className, dateTime, instructor, status, title, topic }: LessonCardProps) {
  const config = statusConfig[status];
  const shouldReduceMotion = useReducedMotion();

  const cardContent = (
    <>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <h4 className={cn('font-bold text-sm', config.text)}>{title}</h4>
          {topic && <p className="text-xs font-medium text-[#2E286C]/50 mt-0.5 truncate">{topic}</p>}
        </div>
        <div className="shrink-0">{config.icon}</div>
      </div>
      <div className="flex items-center justify-between gap-3 mt-3">
        <div className="text-xs font-medium text-[#2E286C]/50">{instructor} • {dateTime}</div>
        <span className={cn('text-[10px] font-bold uppercase tracking-wider', config.text)}>
          {config.label}
        </span>
      </div>
    </>
  );

  const baseClasses = cn(
    'rounded-2xl border p-4 lg:p-5 transition-colors cursor-pointer',
    config.bg,
    className,
  );

  if (shouldReduceMotion) {
    return <div className={baseClasses}>{cardContent}</div>;
  }

  return (
    <motion.div
      className={baseClasses}
      whileHover={{ y: -2, boxShadow: '0 8px 25px -5px rgba(83, 48, 137, 0.1)' }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {cardContent}
    </motion.div>
  );
}
