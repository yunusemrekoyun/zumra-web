import React from 'react';
import { cn } from '@/lib/utils';

type StaggerContainerProps = {
  children: React.ReactNode;
  className?: string;
};

type StaggerItemProps = {
  bubble?: boolean;
  children: React.ReactNode;
  className?: string;
};

export function StaggerContainer({ children, className }: StaggerContainerProps) {
  return <div className={className}>{children}</div>;
}

export function StaggerItem({ bubble = true, children, className }: StaggerItemProps) {
  return (
    <div className={cn(className)} data-route-bubble={bubble ? 'true' : 'false'}>
      {children}
    </div>
  );
}
