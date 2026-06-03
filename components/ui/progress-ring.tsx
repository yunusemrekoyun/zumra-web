'use client';

import React from 'react';
import { motion, useSpring, useMotionValue, useInView, useReducedMotion, useTransform } from 'motion/react';
import { cn } from '@/lib/utils';

/* ─── Types ───────────────────────────────────────────────────────── */

type ProgressRingProps = {
  className?: string;
  label?: string;
  size?: number;
  strokeWidth?: number;
  tone?: 'brand' | 'emerald' | 'blue' | 'amber';
  value: number; // 0–100
};

/* ─── Tone colors ─────────────────────────────────────────────────── */

const toneColors: Record<string, { gradient: [string, string]; track: string }> = {
  amber: { gradient: ['#F59E0B', '#D97706'], track: '#FEF3C7' },
  blue: { gradient: ['#3B82F6', '#2563EB'], track: '#DBEAFE' },
  brand: { gradient: ['#8C6CE6', '#533089'], track: '#EDE9F3' },
  emerald: { gradient: ['#34D399', '#059669'], track: '#D1FAE5' },
};

/* ─── Component ───────────────────────────────────────────────────── */

export function ProgressRing({
  className,
  label,
  size = 120,
  strokeWidth = 10,
  tone = 'brand',
  value,
}: ProgressRingProps) {
  const ref = React.useRef<SVGSVGElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });
  const shouldReduceMotion = useReducedMotion();

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const colors = toneColors[tone];
  const gradientId = `ring-gradient-${tone}`;

  // Animated progress value
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, {
    damping: 30,
    stiffness: 60,
  });
  const strokeDashoffset = useTransform(
    springValue,
    (v: number) => circumference - (Math.min(Math.max(v, 0), 100) / 100) * circumference,
  );

  // Animated display number
  const displayRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (isInView) {
      motionValue.set(shouldReduceMotion ? value : value);
    }
  }, [isInView, motionValue, shouldReduceMotion, value]);

  React.useEffect(() => {
    const unsubscribe = springValue.on('change', (latest) => {
      if (displayRef.current) {
        displayRef.current.textContent = `%${Math.round(latest)}`;
      }
    });
    return unsubscribe;
  }, [springValue]);

  const finalOffset = circumference - (Math.min(Math.max(value, 0), 100) / 100) * circumference;

  return (
    <div className={cn('inline-flex flex-col items-center gap-2 relative', className)}>
      <svg ref={ref} width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.gradient[0]} />
            <stop offset="100%" stopColor={colors.gradient[1]} />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.track}
          strokeWidth={strokeWidth}
        />
        {/* Progress — animated */}
        {shouldReduceMotion ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={finalOffset}
          />
        ) : (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            style={{ strokeDashoffset }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span ref={displayRef} className="text-2xl font-rosmatika font-medium text-[#2E286C]">
          {shouldReduceMotion ? `%${Math.round(value)}` : '%0'}
        </span>
      </div>
      {label && <span className="text-xs font-bold text-[#2E286C]/50 uppercase tracking-wider">{label}</span>}
    </div>
  );
}
