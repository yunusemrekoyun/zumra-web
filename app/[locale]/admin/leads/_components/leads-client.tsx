'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Phone, Mail, MoreHorizontal, MessageCircle, Clock, ChevronRight, FileText } from 'lucide-react';
import { Button, FilterTabs, IconButton, InfoField, Input, ListItemCard, ModulePanel, ResponsiveTabs, SearchInput } from '@/components/ui';
import { getDomainLanguageKey, getDomainRelativeKey, getDomainSourceKey } from '@/lib/domain/i18n';

const leadToneStyles = {
  amber: {
    chip: 'border-amber-500/30',
    dot: 'bg-amber-500',
  },
  blue: {
    chip: 'border-blue-500/30',
    dot: 'bg-blue-500',
  },
  emerald: {
    chip: 'border-emerald-500/30 bg-emerald-500/5',
    dot: 'bg-emerald-500',
  },
  gray: {
    chip: 'border-gray-300',
    dot: 'bg-gray-300',
  },
  purple: {
    chip: 'border-purple-500/30',
    dot: 'bg-purple-500',
  },
};

type LeadTone = keyof typeof leadToneStyles;

const leadStatusLabels = {
  contacted: { labelKey: 'contacted', tone: 'blue' as LeadTone },
  converted: { labelKey: 'converted', tone: 'emerald' as LeadTone },
  lost: { labelKey: 'lost', tone: 'gray' as LeadTone },
  meeting_scheduled: { labelKey: 'meeting_scheduled', tone: 'purple' as LeadTone },
  new: { labelKey: 'new', tone: 'emerald' as LeadTone },
  offer_pending: { labelKey: 'offer_pending', tone: 'amber' as LeadTone },
};

type LeadRecord = {
  advisorId: string;
  email: string;
  fullName: string;
  id: string;
  interestedProgram: string;
  lastActivityLabel: string;
  level?: string;
  phone: string;
  source: string;
  status: keyof typeof leadStatusLabels;
};

type UserRecord = {
  id: string;
  initials: string;
  name: string;
  title: string;
};

type LeadsDashboardViewModel = {
  currentUser: UserRecord;
  leads: LeadRecord[];
  users: UserRecord[];
};

type LeadsClientProps = {
  dashboard: LeadsDashboardViewModel;
};

export function LeadsClient({ dashboard }: LeadsClientProps) {
  const t = useTranslations('admin.leads');
  const actions = useTranslations('common.actions');
  const domain = useTranslations('domain');
  const status = useTranslations('domain.leadStatus');
  const leadRecords = dashboard.leads;
  const activeLead = leadRecords[0];
  const activeAdvisor = dashboard.users.find((user) => user.id === activeLead.advisorId) ?? dashboard.currentUser;
  const activeLanguageKey = getDomainLanguageKey(activeLead.interestedProgram);
  const activeSourceKey = getDomainSourceKey(activeLead.source);
  const activeLanguage = activeLanguageKey ? domain(`languages.${activeLanguageKey}`) : activeLead.interestedProgram;
  const activeSource = activeSourceKey ? domain(`sources.${activeSourceKey}`) : activeLead.source;
  const leads = leadRecords.map((lead, index) => {
    const languageKey = getDomainLanguageKey(lead.interestedProgram);
    const relativeKey = getDomainRelativeKey(lead.lastActivityLabel);
    const language = languageKey ? domain(`languages.${languageKey}`) : lead.interestedProgram;

    return {
      id: lead.id,
      name: lead.fullName,
      lang: `${language}${lead.level ? ` ${lead.level}` : ''}`,
      time: relativeKey ? domain(`relative.${relativeKey}`) : lead.lastActivityLabel,
      statusKey: leadStatusLabels[lead.status].labelKey,
      tone: leadStatusLabels[lead.status].tone,
      active: index === 0,
    };
  });

  const renderLeadList = (className = '') => (
    <ModulePanel padded={false} className={`w-full lg:w-80 rounded-3xl flex flex-col overflow-hidden shrink-0 ${className}`}>
      <div className="p-5 border-b border-black/[0.03] space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-rosmatika font-medium text-2xl text-[#2E286C]">{t('title')}</h2>
          <IconButton aria-label={t('addLead')} icon={<Plus className="w-5 h-5" />} size="sm" variant="primary" />
        </div>
        <SearchInput placeholder={t('search')} />
        <FilterTabs
          activeValue="all"
          className="pb-0"
          items={[
            { value: 'all', label: t('all') },
            { value: 'new', label: t('new') },
            { value: 'follow-up', label: t('followUp') },
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 max-h-[64dvh] lg:max-h-none">
        {leads.map((lead) => (
          <ListItemCard
            key={lead.id}
            active={lead.active}
            className="p-4 cursor-pointer"
          >
            <div className="flex justify-between items-start mb-2">
              <div className="font-bold text-[#2E286C] text-sm">{lead.name}</div>
              <div className="text-[10px] text-[#2E286C]/40 font-bold">{lead.time}</div>
            </div>
            <div className="text-xs text-[#2E286C]/60 font-medium mb-3">{lead.lang}</div>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${lead.active ? 'border-[#533089]/20' : leadToneStyles[lead.tone].chip} border`}>
              <div className={`w-1.5 h-1.5 rounded-full ${lead.active ? 'bg-[#533089]' : leadToneStyles[lead.tone].dot}`} />
              {status(lead.statusKey)}
            </div>
          </ListItemCard>
        ))}
      </div>
    </ModulePanel>
  );

  const renderConversation = (className = '') => (
    <ModulePanel padded={false} className={`flex-1 min-h-[70dvh] lg:min-h-0 rounded-3xl flex flex-col overflow-hidden relative ${className}`}>
      <div className="px-5 lg:px-6 py-5 border-b border-black/[0.03] flex justify-between items-center bg-white/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#533089]/10 text-[#533089] flex items-center justify-center font-bold text-lg">{getInitials(activeLead.fullName)}</div>
          <div>
            <h2 className="font-bold text-[#2E286C] text-lg">{activeLead.fullName}</h2>
            <div className="text-xs text-emerald-500 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 relative"><span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-50" /></span>
              {t('online')}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <IconButton aria-label={actions('call')} icon={<Phone className="w-4 h-4" />} className="rounded-full" />
          <IconButton aria-label={t('email')} icon={<Mail className="w-4 h-4" />} className="rounded-full" />
          <IconButton aria-label={actions('moreOptions')} icon={<MoreHorizontal className="w-4 h-4" />} className="hidden rounded-full sm:inline-flex" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6 custom-scrollbar bg-[#F4F5F8]/30">
        <div className="flex justify-center">
          <div className="bg-[#2E286C]/5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/40">{t('today')}</div>
        </div>

        <div className="flex gap-4">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 mt-1">
            <FileText className="w-4 h-4" />
          </div>
          <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-black/[0.02] max-w-[88%] lg:max-w-[80%]">
            <div className="text-xs text-[#2E286C]/40 font-bold uppercase tracking-wider mb-2">{t('applicationFilled')}</div>
            <p className="text-sm text-[#2E286C] font-medium leading-relaxed">{t('applicationText')}</p>
          </div>
        </div>

        <div className="flex gap-4 flex-row-reverse">
          <div className="w-8 h-8 rounded-full bg-[#533089] flex items-center justify-center text-white shrink-0 mt-1">
            {activeAdvisor.initials}
          </div>
          <div className="bg-[#533089] p-4 rounded-2xl rounded-tr-none shadow-md shadow-[#533089]/20 max-w-[88%] lg:max-w-[80%] text-white">
            <div className="text-[10px] text-white/50 font-bold uppercase tracking-wider mb-2 text-right">{t('advisorMessageMeta')}</div>
            <p className="text-sm font-medium leading-relaxed">{t('advisorMessage')}</p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="w-8 h-8 rounded-full bg-[#533089]/10 text-[#533089] flex items-center justify-center font-bold text-xs shrink-0 mt-1">
            {getInitials(activeLead.fullName)}
          </div>
          <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-black/[0.02] max-w-[88%] lg:max-w-[80%]">
            <div className="text-[10px] text-[#2E286C]/40 font-bold uppercase tracking-wider mb-2">{t('studentMessageMeta')}</div>
            <p className="text-sm text-[#2E286C] font-medium leading-relaxed">{t('studentMessage')}</p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0 mt-1">
            <Clock className="w-4 h-4" />
          </div>
          <div className="bg-amber-50/50 p-4 rounded-2xl rounded-tl-none border border-amber-200/50 max-w-[88%] lg:max-w-[80%]">
            <div className="flex justify-between items-center mb-2">
              <div className="text-xs text-amber-700 font-bold">{t('advisorNote')}</div>
            </div>
            <p className="text-sm text-amber-800 font-medium">{t('advisorNoteText')}</p>
          </div>
        </div>
      </div>

      <div className="p-3 lg:p-4 bg-white border-t border-black/[0.03]">
        <div className="bg-[#F8F9FC] rounded-2xl p-2 lg:pr-4 flex items-center gap-2 border border-black/[0.02] focus-within:border-[#533089]/30 focus-within:shadow-sm transition-all">
          <IconButton aria-label={t('addNote')} icon={<Plus className="w-5 h-5" />} variant="ghost" className="rounded-full" />
          <Input type="text" placeholder={t('messagePlaceholder')} className="h-auto flex-1 bg-transparent border-none px-0 focus:border-transparent" />
          <div className="hidden sm:flex bg-black/5 rounded-lg px-3 py-1.5 text-xs font-bold text-[#2E286C]/50 items-center gap-1 cursor-pointer hover:bg-black/10">
            {t('addNote')} <ChevronRight className="w-3 h-3"/>
          </div>
          <IconButton aria-label={t('messagePlaceholder')} icon={<MessageCircle className="w-4 h-4" />} variant="primary" />
        </div>
      </div>
    </ModulePanel>
  );

  const renderDetails = (className = '') => (
    <div className={`w-full lg:w-72 bg-transparent flex flex-col gap-4 overflow-y-auto custom-scrollbar shrink-0 ${className}`}>
      <ModulePanel className="rounded-3xl">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[#2E286C]/40 mb-4">{t('info')}</h3>

        <div className="space-y-4">
          <InfoField label={t('languageLevel')} value={`${activeLanguage} • ${activeLead.level ?? '-'}`} />
          <InfoField label={t('phone')} value={activeLead.phone} />
          <InfoField label={t('email')} value={activeLead.email} valueClassName="truncate" />
          <div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-[#2E286C]/40">{t('source')}</div>
            <div className="inline-flex py-1 px-2.5 bg-blue-50 text-blue-600 rounded text-xs font-bold mt-1 border border-blue-100">{activeSource}</div>
          </div>
        </div>
      </ModulePanel>

      <ModulePanel className="rounded-3xl">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[#2E286C]/40 mb-4">{t('actions')}</h3>

        <Button className="w-full mb-3 hover:scale-[1.02]">
          {t('createEnrollment')}
        </Button>
        <Button variant="secondary" className="w-full">
          {t('scheduleMeeting')}
        </Button>
      </ModulePanel>

      <ModulePanel className="rounded-3xl">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[#2E286C]/40 mb-4">{t('assignedAdvisor')}</h3>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#533089] text-white flex items-center justify-center font-bold text-xs shadow-sm">{activeAdvisor.initials}</div>
          <div>
            <div className="font-bold text-[#2E286C] text-sm">{activeAdvisor.name}</div>
            <div className="text-xs text-[#2E286C]/50 font-medium">{activeAdvisor.title || t('salesSpecialist')}</div>
          </div>
        </div>
      </ModulePanel>
    </div>
  );

  return (
    <>
      <div className="lg:hidden">
        <ResponsiveTabs
          defaultValue="list"
          items={[
            { value: 'list', label: t('title'), content: renderLeadList() },
            { value: 'conversation', label: t('scheduleMeeting'), content: renderConversation() },
            { value: 'details', label: t('info'), content: renderDetails() },
          ]}
        />
      </div>

      <div className="hidden h-[calc(100vh-10rem)] lg:flex gap-6">
        {renderLeadList()}
        {renderConversation()}
        {renderDetails()}
      </div>
    </>
  );
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
