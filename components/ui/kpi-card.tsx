import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from './card';
import type { LucideIcon } from 'lucide-react';

/* ─── Types ───────────────────────────────────────────────────────── */

type KpiTrend = {
  direction?: 'up' | 'down' | 'neutral';
  label: string;
};

type KpiCardProps = {
  className?: string;
  icon?: LucideIcon;
  label: string;
  trend?: KpiTrend;
  value: React.ReactNode;
  variant?: 'default' | 'gradient';
};

/* ─── Trend colors ────────────────────────────────────────────────── */

const trendColors: Record<string, string> = {
  down: 'text-red-500',
  neutral: 'text-[#2E286C]/50',
  up: 'text-emerald-500',
};

const trendArrows: Record<string, string> = {
  down: '↓',
  neutral: '',
  up: '↑',
};

/* ─── Component ───────────────────────────────────────────────────── */

export function KpiCard({ className, icon: Icon, label, trend, value, variant = 'default' }: KpiCardProps) {
  const isGradient = variant === 'gradient';

  return (
    <Card variant={isGradient ? 'gradient' : 'default'} className={cn('relative overflow-hidden group', className)}>
      {/* Background icon */}
      {Icon && (
        <div className={cn('absolute top-0 right-0 p-5 opacity-15', isGradient && 'opacity-20')}>
          <Icon className="w-20 h-20" />
        </div>
      )}

      <p
        className={cn(
          'font-medium text-sm mb-1 relative z-10',
          isGradient ? 'text-white/80' : 'text-[#2E286C]/50',
        )}
      >
        {label}
      </p>

      <div
        className={cn(
          'text-4xl font-rosmatika font-medium mb-4 relative z-10',
          !isGradient && 'text-[#2E286C]',
        )}
      >
        {value}
      </div>

      {trend && (
        <div
          className={cn(
            'flex items-center gap-2 text-sm relative z-10',
            isGradient
              ? 'bg-white/20 w-fit px-3 py-1 rounded-full backdrop-blur-md'
              : 'text-[#2E286C]/60',
          )}
        >
          {trend.direction && (
            <span className={cn('font-bold', isGradient ? 'text-white' : trendColors[trend.direction])}>
              {trendArrows[trend.direction]} {trend.label.split(' ')[0]}
            </span>
          )}
          {!trend.direction && <span className="font-bold">{trend.label}</span>}
          {trend.direction && trend.label.includes(' ') && (
            <span className={isGradient ? 'text-white/80' : ''}>
              {trend.label.substring(trend.label.indexOf(' ') + 1)}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
