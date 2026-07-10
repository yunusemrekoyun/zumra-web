import { getTranslations } from 'next-intl/server';
import { ModulePanel } from '@/components/ui';
import { ProfilePhotoUploader } from '@/components/profile-photo-uploader';
import { getSessionPrincipal } from '@/lib/server/authorization';
import { getProfilePhotoUrl } from '@/lib/server/services/profile-photo';

export async function MyProfileCard() {
  const principal = await getSessionPrincipal();
  if (!principal) return null;
  const [t, photoUrl] = await Promise.all([
    getTranslations('workspace.profileSettings'),
    getProfilePhotoUrl(principal.id),
  ]);

  return (
    <ModulePanel className="rounded-3xl">
      <div className="flex flex-wrap items-center gap-5">
        <ProfilePhotoUploader
          name={principal.name}
          photoUrl={photoUrl}
          size="lg"
        />
        <div>
          <h3 className="text-lg font-bold text-[#2E286C]">{t('title')}</h3>
          <p className="text-sm text-[#2E286C]/50">{t('description')}</p>
          <p className="mt-1 text-sm font-semibold text-[#2E286C]/70">
            {principal.name} · {principal.email}
          </p>
        </div>
      </div>
    </ModulePanel>
  );
}
