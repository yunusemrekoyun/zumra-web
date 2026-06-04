import React from 'react';
import { cn } from '@/lib/utils';

type ModulePanelProps = React.HTMLAttributes<HTMLDivElement> & {
  padded?: boolean;
  variant?: 'default' | 'muted';
};

export function ModulePanel({
  children,
  className,
  padded = true,
  variant = 'default',
  ...props
}: ModulePanelProps) {
  return (
    <div
      className={cn(
        variant === 'default'
          ? 'bg-white border border-black/[0.02] shadow-sm'
          : 'bg-[#F8F9FC] border border-black/[0.03]',
        'rounded-[2rem]',
        padded && 'p-5 lg:p-6',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
