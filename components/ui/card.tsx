import React from 'react';
import { cn } from '@/lib/utils';

type CardVariant = 'default' | 'muted' | 'gradient';

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  padded?: boolean;
  variant?: CardVariant;
};

const variants: Record<CardVariant, string> = {
  default: 'bg-white text-[#2E286C] border border-black/[0.02] shadow-sm',
  muted: 'bg-[#F8F9FC] text-[#2E286C] border border-black/[0.03]',
  gradient: 'bg-gradient-to-br from-[#8C6CE6] to-[#533089] text-white shadow-lg shadow-[#533089]/20',
};

export function Card({
  children,
  className,
  padded = true,
  variant = 'default',
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[1.5rem] lg:rounded-[2rem]',
        variants[variant],
        padded && 'p-5 lg:p-6',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
