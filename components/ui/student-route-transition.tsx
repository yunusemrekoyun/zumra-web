'use client';

import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

/* ─── Types ───────────────────────────────────────────────────────── */

type StudentRouteTransitionProps = {
  children: React.ReactNode;
  routeKey: string;
};

/* ─── Variants ────────────────────────────────────────────────────── */

/**
 * Entrance is instant — StaggerContainer inside each page handles
 * the visual entrance animation. This wrapper only provides the
 * smooth EXIT (fade-out + slide-up) when leaving a page.
 */
const pageVariants = {
  enter: {
    opacity: 1,
    y: 0,
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2, ease: [0.55, 0.06, 0.68, 0.19] },
  },
  initial: {
    opacity: 1,
    y: 0,
  },
};

const reducedMotionVariants = {
  enter: {
    opacity: 1,
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.1 },
  },
  initial: {
    opacity: 1,
  },
};

/* ─── Component ───────────────────────────────────────────────────── */

export function StudentRouteTransition({ children, routeKey }: StudentRouteTransitionProps) {
  const shouldReduceMotion = useReducedMotion();
  const variants = shouldReduceMotion ? reducedMotionVariants : pageVariants;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={routeKey}
        variants={variants}
        initial="initial"
        animate="enter"
        exit="exit"
        className="h-full min-h-full"
        onAnimationStart={() => {
          // Scroll to top on new page
          const scrollContainer = document.querySelector('main');
          scrollContainer?.scrollTo({ top: 0, left: 0 });
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
