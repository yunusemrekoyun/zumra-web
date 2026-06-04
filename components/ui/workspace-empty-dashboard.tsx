import React from 'react';
import { useTranslations } from 'next-intl';
import type { LucideIcon } from 'lucide-react';
import { Card } from './card';
import { EmptyState } from './empty-state';
import { KpiCard } from './kpi-card';
import { PageHeader } from './page-header';

type WorkspaceMetric = {
  label: string;
  value: React.ReactNode;
};

type WorkspaceEmptyDashboardProps = {
  description: string;
  icon: LucideIcon;
  metrics: WorkspaceMetric[];
  moduleTitle: string;
  title: string;
};

export function WorkspaceEmptyDashboard({
  description,
  icon,
  metrics,
  moduleTitle,
  title,
}: WorkspaceEmptyDashboardProps) {
  const t = useTranslations('workspace.emptyDashboard');

  return (
    <div className="workspace-page">
      <PageHeader title={title} description={description} />

      <div className="workspace-kpi-grid">
        {metrics.map((metric) => (
          <KpiCard key={metric.label} label={metric.label} value={metric.value} />
        ))}
      </div>

      <Card padded={false} className="overflow-hidden">
        <EmptyState
          icon={icon}
          title={moduleTitle}
          description={t('description')}
          className="min-h-[22rem] border-0 rounded-none shadow-none"
        />
      </Card>
    </div>
  );
}
