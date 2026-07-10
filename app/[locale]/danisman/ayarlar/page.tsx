import { getTranslations } from 'next-intl/server';
import { Card, InfoField, PageHeader } from '@/components/ui';
import { LogoutButton } from '@/components/auth/logout-button';
import { ProfilePhotoUploader } from '@/components/profile-photo-uploader';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { getProfilePhotoUrl } from '@/lib/server/services/profile-photo';

type AdvisorSettingsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdvisorSettingsPage({
  params,
}: AdvisorSettingsPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('advisor', locale);
  const [t, roles, photoUrl] = await Promise.all([
    getTranslations('workspace.profileSettings'),
    getTranslations('workspace.roles'),
    getProfilePhotoUrl(principal.id),
  ]);

  return (
    <div className="workspace-page">
      <PageHeader title={t('title')} description={t('description')} />

      <Card padded className="flex flex-col items-center text-center">
        <ProfilePhotoUploader name={principal.name} photoUrl={photoUrl} />
        <h1 className="mt-4 text-xl font-bold text-[#2E286C]">
          {principal.name}
        </h1>
        <p className="text-sm font-semibold text-[#2E286C]/50">
          {roles('advisor')}
        </p>

        <div className="my-6 h-px w-full max-w-sm bg-black/[0.04]" />

        <div className="w-full max-w-sm space-y-4 text-left">
          <InfoField label={t('email')} value={principal.email} />
        </div>

        <div className="mt-6">
          <LogoutButton className="inline-flex min-h-10 items-center gap-2 rounded-2xl px-4 text-sm font-bold text-red-500/80 transition-colors hover:bg-red-50">
            {t('logout')}
          </LogoutButton>
        </div>
      </Card>
    </div>
  );
}
