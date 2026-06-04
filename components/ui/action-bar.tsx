import React from 'react';
import { cn } from '@/lib/utils';

type ActionBarProps = React.HTMLAttributes<HTMLDivElement>;

export function ActionBar({ children, className, ...props }: ActionBarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)} {...props}>
      {children}
    </div>
  );
}
