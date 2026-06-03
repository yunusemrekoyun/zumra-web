'use client';

import React, { useEffect, useRef } from 'react';
import { useInView, useMotionValue, useSpring, useReducedMotion } from 'motion/react';

/* ─── Types ───────────────────────────────────────────────────────── */

type CountUpProps = {
  className?: string;
  duration?: number;
  from?: number;
  prefix?: string;
  suffix?: string;
  to: number;
};

/* ─── Component ───────────────────────────────────────────────────── */

export function CountUp({
  className,
  duration = 1.2,
  from = 0,
  prefix = '',
  suffix = '',
  to,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const isInView = useInView(ref, { once: true, margin: '-40px' });

  const motionValue = useMotionValue(from);
  const springValue = useSpring(motionValue, {
    damping: 30,
    stiffness: 80,
    duration: duration * 1000,
  });

  useEffect(() => {
    if (isInView) {
      motionValue.set(shouldReduceMotion ? to : to);
      if (!shouldReduceMotion) {
        motionValue.set(to);
      }
    }
  }, [isInView, motionValue, shouldReduceMotion, to]);

  useEffect(() => {
    const unsubscribe = springValue.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = `${prefix}${Math.round(latest)}${suffix}`;
      }
    });
    return unsubscribe;
  }, [springValue, prefix, suffix]);

  // Set initial display
  return (
    <span ref={ref} className={className}>
      {shouldReduceMotion ? `${prefix}${to}${suffix}` : `${prefix}${from}${suffix}`}
    </span>
  );
}
