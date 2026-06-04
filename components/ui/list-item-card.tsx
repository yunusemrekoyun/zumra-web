import React from 'react';
import { cn } from '@/lib/utils';

type ListItemCardProps = React.HTMLAttributes<HTMLDivElement> & {
  active?: boolean;
};

export function ListItemCard({ active, children, className, ...props }: ListItemCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border transition-all',
        active
          ? 'bg-white shadow-md border-[#533089]/20'
          : 'bg-transparent border-transparent hover:bg-black/[0.02]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
