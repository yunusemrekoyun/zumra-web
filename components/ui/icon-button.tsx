import React from 'react';
import { cn } from '@/lib/utils';

type IconButtonVariant = 'default' | 'ghost' | 'primary' | 'danger';
type IconButtonSize = 'sm' | 'md' | 'lg';

type IconButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  'aria-label': string;
  icon: React.ReactNode;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
};

const variants: Record<IconButtonVariant, string> = {
  danger: 'bg-white text-red-500/70 hover:bg-red-50 hover:text-red-600',
  default: 'bg-white text-[#2E286C]/60 border border-black/5 hover:bg-black/5 hover:text-[#533089]',
  ghost: 'bg-transparent text-[#2E286C]/50 hover:bg-black/5 hover:text-[#533089]',
  primary: 'bg-[#533089] text-white shadow-md shadow-[#533089]/20 hover:scale-105',
};

const sizes: Record<IconButtonSize, string> = {
  lg: 'h-11 w-11',
  md: 'h-10 w-10',
  sm: 'h-9 w-9',
};

export function IconButton({
  className,
  icon,
  size = 'md',
  type = 'button',
  variant = 'default',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-xl transition-all disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
}
