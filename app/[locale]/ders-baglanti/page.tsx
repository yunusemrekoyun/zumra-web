import { getTranslations } from 'next-intl/server';
import { CalendarClock } from 'lucide-react';

const KNOWN_REASONS = new Set([
  'lesson_not_open_yet',
  'lesson_session_closed',
  'lesson_session_cancelled',
  'lesson_meeting_not_ready',
  'google_account_required',
]);

type JoinInfoPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ reason?: string }>;
};

export default async function JoinInfoPage({
  searchParams,
}: JoinInfoPageProps) {
  const { reason } = await searchParams;
  const t = await getTranslations('joinError');
  const key = reason && KNOWN_REASONS.has(reason) ? reason : 'generic';

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#F8F9FC] p-6">
      <div className="max-w-md rounded-3xl border border-black/[0.04] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#533089]/8">
          <CalendarClock className="h-7 w-7 text-[#533089]" />
        </div>
        <h1 className="font-rosmatika text-xl font-medium text-[#2E286C]">
          {t('title')}
        </h1>
        <p className="mt-3 text-sm font-medium leading-6 text-[#2E286C]/65">
          {t(`reasons.${key}`)}
        </p>
        <p className="mt-5 text-xs font-semibold text-[#2E286C]/40">
          {t('closeHint')}
        </p>
      </div>
    </div>
  );
}
