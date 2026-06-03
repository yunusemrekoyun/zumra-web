import React from 'react';
import { cn } from '@/lib/utils';

/* ─── Types ───────────────────────────────────────────────────────── */

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';
type AvatarVariant = 'default' | 'brand';

type AvatarProps = {
  className?: string;
  name: string;
  online?: boolean;
  size?: AvatarSize;
  variant?: AvatarVariant;
};

/* ─── Size styles ─────────────────────────────────────────────────── */

const sizeStyles: Record<AvatarSize, { container: string; text: string; dot: string }> = {
  sm: { container: 'w-8 h-8', text: 'text-[10px]', dot: 'w-2 h-2 -right-0.5 -bottom-0.5' },
  md: { container: 'w-10 h-10', text: 'text-xs', dot: 'w-2.5 h-2.5 right-0 bottom-0' },
  lg: { container: 'w-12 h-12', text: 'text-sm', dot: 'w-3 h-3 right-0 bottom-0' },
  xl: { container: 'w-24 h-24', text: 'text-3xl', dot: 'w-4 h-4 right-1 bottom-1' },
};

const variantStyles: Record<AvatarVariant, string> = {
  brand: 'bg-[#533089] text-white',
  default: 'bg-[#533089]/10 text-[#533089] border border-black/5',
};

/* ─── Helpers ─────────────────────────────────────────────────────── */

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/* ─── Component ───────────────────────────────────────────────────── */

export function Avatar({ className, name, online, size = 'md', variant = 'default' }: AvatarProps) {
  const s = sizeStyles[size];

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-bold shrink-0 relative',
        s.container,
        variantStyles[variant],
        className,
      )}
      aria-label={name}
    >
      {getInitials(name)}

      {online !== undefined && (
        <span
          className={cn(
            'absolute rounded-full border-2 border-white',
            s.dot,
            online ? 'bg-emerald-500' : 'bg-gray-300',
          )}
        />
      )}
    </div>
  );
}
