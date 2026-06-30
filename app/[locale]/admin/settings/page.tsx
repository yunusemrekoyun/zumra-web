import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui';
import { withWorkspacePage } from '@/lib/server/workspace-page';
import { BackgroundJobsCard } from './background-jobs-card';
import { DevResetCard } from './dev-reset-card';
import { MailModeCard } from './mail-mode-card';
import { RuntimeSettingsCard } from './runtime-settings-card';

function SettingsPage() {
  const t = useTranslations('admin.settings');

  return (
    <div className="admin-page">
      <PageHeader
        title={t('title')}
        description={t('description')}
      />
      <div className="grid gap-6">
        <RuntimeSettingsCard />
        <MailModeCard />
        <BackgroundJobsCard />
        <DevResetCard enabled />
      </div>
    </div>
  );
}

export default withWorkspacePage('admin', SettingsPage);
