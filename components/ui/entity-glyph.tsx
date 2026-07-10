import React from 'react';
import { cn } from '@/lib/utils';
import { identityTint } from './avatar';

/* ─── Types ───────────────────────────────────────────────────────── */

type GlyphSize = 'sm' | 'md' | 'lg';

type EntityGlyphProps = {
  className?: string;
  /** Language slug drives the glyph; anything unknown falls back to name. */
  language?: string | null;
  /** 'private' renders the 1:1 mark instead of a language letter. */
  kind?: 'group' | 'private';
  name: string;
  size?: GlyphSize;
  /** Tint seed; defaults to name — pass the program name for branches so a
      branch visibly belongs to its program family but keeps its own shade. */
  tintSeed?: string;
};

/* ─── Language glyphs (same family as the public landing) ───────────── */

const LANGUAGE_GLYPHS: Record<string, string> = {
  arabic: 'ع',
  english: 'A',
  french: 'Fr',
  german: 'De',
  japanese: 'あ',
  korean: '가',
  persian: 'ف',
  russian: 'Ж',
};

const sizeStyles: Record<GlyphSize, string> = {
  sm: 'h-8 w-8 rounded-lg text-xs',
  md: 'h-10 w-10 rounded-xl text-sm',
  lg: 'h-12 w-12 rounded-2xl text-base',
};

/* ─── Component ───────────────────────────────────────────────────── */

/**
 * Visual identity for non-person entities (programs, branches, lessons):
 * a language glyph — or the 1:1 mark for private programs — on the entity's
 * own deterministic tint. The square shape separates "things" from the
 * round person avatars at a glance.
 */
export function EntityGlyph({
  className,
  kind,
  language,
  name,
  size = 'md',
  tintSeed,
}: EntityGlyphProps) {
  const tint = identityTint(tintSeed ?? name);
  const glyph =
    kind === 'private'
      ? '1:1'
      : (LANGUAGE_GLYPHS[language ?? ''] ??
        name.trim().charAt(0).toLocaleUpperCase('tr-TR'));

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center border border-black/5 font-bold',
        sizeStyles[size],
        tint.bg,
        tint.text,
        className,
      )}
      aria-hidden
    >
      {glyph}
    </div>
  );
}
