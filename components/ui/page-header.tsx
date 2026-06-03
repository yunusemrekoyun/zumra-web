import React from 'react';
import { cn } from '@/lib/utils';

type PageHeaderProps = {
  action?: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  title: React.ReactNode;
};

export function PageHeader({ action, className, description, title }: PageHeaderProps) {
  return (
    <div className={cn('workspace-page-header', className)}>
      <div>
        <h1 className="text-2xl lg:text-3xl font-rosmatika font-medium text-[#2E286C] mb-2">
          {title}
        </h1>
        {description && (
          <p className="text-sm font-medium text-[#2E286C]/60">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-3">{action}</div>}
    </div>
  );
}
