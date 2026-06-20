'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, PlayCircle } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

/* ─── Types ───────────────────────────────────────────────────────── */

type LessonStatus = 'completed' | 'upcoming' | 'in-progress';

type AttendanceBadgeStatus = 'present' | 'late' | 'absent' | 'excused';

type LessonCardProps = {
  attendanceStatus?: AttendanceBadgeStatus;
  className?: string;
  dateTime: string;
  instructor: string;
  status: LessonStatus;
  title: string;
  topic?: string;
};

const attendanceBadgeStyles: Record<AttendanceBadgeStatus, string> = {
  absent: 'border-red-500/20 bg-red-50 text-red-700',
  excused: 'border-blue-500/20 bg-blue-50 text-blue-700',
  late: 'border-amber-500/20 bg-amber-50 text-amber-700',
  present: 'border-emerald-500/20 bg-emerald-50 text-emerald-700',
};

/* ─── Status config ───────────────────────────────────────────────── */

const statusConfig: Record<LessonStatus, { bg: string; icon: React.ReactNode; labelKey: string; text: string }> = {
  completed: {
    bg: 'bg-emerald-50 border-emerald-100',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    labelKey: 'completed',
    text: 'text-emerald-700',
  },
  'in-progress': {
    bg: 'bg-[#533089]/5 border-[#533089]/10',
    icon: <PlayCircle className="w-4 h-4 text-[#533089]" />,
    labelKey: 'inProgress',
    text: 'text-[#533089]',
  },
  upcoming: {
    bg: 'bg-blue-50 border-blue-100',
    icon: <Clock className="w-4 h-4 text-blue-500" />,
    labelKey: 'upcoming',
    text: 'text-blue-700',
  },
};

/* ─── Component ───────────────────────────────────────────────────── */

export function LessonCard({ attendanceStatus, className, dateTime, instructor, status, title, topic }: LessonCardProps) {
  const t = useTranslations('common.lessonStatus');
  const attendanceT = useTranslations('common.attendance');
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
        <div className="flex items-center gap-2">
          {attendanceStatus && (
            <span
              className={cn(
                'rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                attendanceBadgeStyles[attendanceStatus],
              )}
            >
              {attendanceT(attendanceStatus)}
            </span>
          )}
          <span className={cn('text-[10px] font-bold uppercase tracking-wider', config.text)}>
            {t(config.labelKey)}
          </span>
        </div>
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
