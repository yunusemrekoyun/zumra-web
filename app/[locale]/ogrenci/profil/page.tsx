import { useTranslations } from 'next-intl';
import { Avatar, Card, InfoField, SectionHeader, StatusChip, StreakBadge, StaggerContainer, StaggerItem } from '@/components/ui';
import { BookOpen, Calendar, GraduationCap, Settings, HelpCircle, LogOut } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { getDashboardData, getDomainLanguageKey, getStudentProgressData } from '@/lib/domain';

export default function StudentProfilePage() {
  const t = useTranslations('student.profilePage');
  const workspace = useTranslations('workspace.more');
  const nav = useTranslations('workspace.nav');
  const domain = useTranslations('domain');
  const commonStatus = useTranslations('common.status');
  const dashboard = getDashboardData('student');
  const progress = getStudentProgressData('student');
  const currentStudent = dashboard.students[0];
  const languageKey = getDomainLanguageKey(currentStudent.language);
  const studentLanguage = languageKey ? domain(`languages.${languageKey}`) : currentStudent.language;
  const programLabel = domain(`programTypes.${currentStudent.programType}`);

  return (
    <StaggerContainer className="admin-page">
      {/* Profile header */}
      <StaggerItem>
        <Card padded className="flex flex-col items-center text-center">
          <Avatar name={currentStudent.fullName} size="xl" className="border-4 border-white shadow-lg mb-4" />
          <h1 className="text-xl font-bold text-[#2E286C]">{currentStudent.fullName}</h1>
          <div className="flex items-center gap-2 mt-2">
            <StatusChip tone={currentStudent.status === 'active' ? 'emerald' : 'amber'}>
              {commonStatus(currentStudent.status)}
            </StatusChip>
            <StreakBadge count={progress?.streak ?? 0} size="sm" />
          </div>

          <div className="w-full h-px bg-black/[0.03] my-6" />

          <div className="text-left w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#533089]/5 flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4 text-[#533089]" />
              </div>
              <InfoField label={t('program')} value={`${studentLanguage} • ${programLabel}`} />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#533089]/5 flex items-center justify-center shrink-0">
                <GraduationCap className="w-4 h-4 text-[#533089]" />
              </div>
              <InfoField label={t('level')} value={currentStudent.level} />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#533089]/5 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 text-[#533089]" />
              </div>
              <InfoField label={t('enrollmentDate')} value={t('enrollmentDateValue')} valueClassName="text-[#2E286C]/70" />
            </div>
          </div>
        </Card>
      </StaggerItem>

      {/* Account menu */}
      <StaggerItem>
        <Card padded={false}>
          <SectionHeader title={t('account')} className="px-5 pt-5 lg:px-6 lg:pt-6" />
          <div className="px-3 pb-4 lg:px-4 lg:pb-5 space-y-0.5">
            <Link
              href="/ogrenci/profil"
              className="flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[#2E286C] hover:bg-black/[0.02] transition-colors"
            >
              <Settings className="w-5 h-5 text-[#2E286C]/40" />
              <span className="text-[15px] font-medium flex-1">{nav('settings')}</span>
            </Link>
            <button className="flex w-full items-center gap-4 px-4 py-3.5 rounded-2xl text-[#2E286C] hover:bg-black/[0.02] transition-colors">
              <HelpCircle className="w-5 h-5 text-[#2E286C]/40" />
              <span className="text-[15px] font-medium flex-1 text-left">{workspace('support')}</span>
            </button>
            <button className="flex w-full items-center gap-4 px-4 py-3.5 rounded-2xl text-red-500/80 hover:bg-red-50/50 transition-colors">
              <LogOut className="w-5 h-5 text-red-400" />
              <span className="text-[15px] font-medium flex-1 text-left">{workspace('logout')}</span>
            </button>
          </div>
        </Card>
      </StaggerItem>
    </StaggerContainer>
  );
}
