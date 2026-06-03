'use client';

import React from 'react';
import { Flame } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

/* ─── Types ───────────────────────────────────────────────────────── */

type StreakBadgeProps = {
  className?: string;
  count: number;
  size?: 'sm' | 'md' | 'lg';
};

/* ─── Sizes ───────────────────────────────────────────────────────── */

const sizes = {
  lg: { container: 'px-4 py-2 gap-2', icon: 'w-6 h-6', text: 'text-lg' },
  md: { container: 'px-3 py-1.5 gap-1.5', icon: 'w-5 h-5', text: 'text-sm' },
  sm: { container: 'px-2.5 py-1 gap-1', icon: 'w-4 h-4', text: 'text-xs' },
};

/* ─── Component ───────────────────────────────────────────────────── */

export function StreakBadge({ className, count, size = 'md' }: StreakBadgeProps) {
  const s = sizes[size];
  const shouldReduceMotion = useReducedMotion();

  const content = (
    <>
      <Flame className={cn(s.icon, 'fill-white')} />
      <span className={s.text}>{count} Gün</span>
    </>
  );

  const baseClasses = cn(
    'inline-flex items-center rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold shadow-md shadow-orange-500/20',
    s.container,
    className,
  );

  if (shouldReduceMotion) {
    return <div className={baseClasses}>{content}</div>;
  }

  return (
    <motion.div
      className={baseClasses}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 15,
      }}
    >
      {content}
    </motion.div>
  );
}
