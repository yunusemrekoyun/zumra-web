import React from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-[#533089] text-white shadow-md shadow-[#533089]/20 hover:bg-[#462878]',
  secondary: 'bg-white text-[#2E286C] border border-black/10 hover:bg-black/[0.03]',
  ghost: 'bg-transparent text-[#2E286C]/60 hover:bg-black/[0.03] hover:text-[#2E286C]',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 text-[11px]',
  md: 'min-h-11 px-5 text-xs',
  lg: 'min-h-14 px-8 text-xs',
};

export function Button({
  className,
  size = 'md',
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-2xl font-bold uppercase tracking-wider transition-all disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
