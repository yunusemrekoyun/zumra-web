import React from 'react';
import { cn } from '@/lib/utils';

/* ─── Types ───────────────────────────────────────────────────────── */

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';
type AvatarVariant = 'default' | 'brand' | 'tinted';

type AvatarProps = {
  className?: string;
  name: string;
  online?: boolean;
  size?: AvatarSize;
  /** Profile photo URL; falls back to initials while loading / when absent. */
  src?: string | null;
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
  tinted: 'border border-black/5',
};

/* ─── Identity tints ──────────────────────────────────────────────────
   Deterministic per-name pastel so every person reads as themselves at a
   glance. Hues stay in the brand's cool-warm family and keep AA contrast. */

export const identityTints = [
  { bg: 'bg-[#533089]/10', text: 'text-[#533089]' }, // brand purple
  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  { bg: 'bg-sky-100', text: 'text-sky-700' },
  { bg: 'bg-teal-100', text: 'text-teal-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
  { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700' },
] as const;

export function identityTint(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return identityTints[hash % identityTints.length];
}

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

export function Avatar({
  className,
  name,
  online,
  size = 'md',
  src,
  variant = 'tinted',
}: AvatarProps) {
  const s = sizeStyles[size];
  const tint = identityTint(name);

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-bold shrink-0 relative overflow-hidden',
        s.container,
        s.text,
        variantStyles[variant],
        variant === 'tinted' && !src && `${tint.bg} ${tint.text}`,
        className,
      )}
      aria-label={name}
    >
      {src ? (
        /* auth-gated /api/media URL; the Next optimizer would fetch it
           without cookies, so a plain img is deliberate here. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        getInitials(name)
      )}

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
