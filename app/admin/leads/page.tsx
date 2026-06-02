'use client';

import React from 'react';
import { Search, Plus, Phone, Mail, MoreHorizontal, MessageCircle, Clock, ChevronRight, FileText } from 'lucide-react';
import { ResponsiveTabs } from '@/components/ui';

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

const leads = [
  { name: 'Ayşe Demir', lang: 'İngilizce A1', time: '10 dk', status: 'Yeni Başvuru', tone: 'emerald' as LeadTone, active: true },
  { name: 'Fatma Kaya', lang: 'Arapça B1', time: '2 saat', status: 'Görüşüldü', tone: 'blue' as LeadTone, active: false },
  { name: 'Zeynep Yılmaz', lang: 'İngilizce A2', time: 'Dün', status: 'Teklif Bekliyor', tone: 'amber' as LeadTone, active: false },
  { name: 'Selin Şahin', lang: 'Almanca A1', time: 'Dün', status: 'Görüşülecek', tone: 'purple' as LeadTone, active: false },
  { name: 'Elif Yıldız', lang: 'İngilizce C1', time: '2 gün', status: 'Kayıt Olumsuz', tone: 'gray' as LeadTone, active: false },
  { name: 'Merve Çelik', lang: 'Fransızca A2', time: '3 gün', status: 'Görüşme Bekliyor', tone: 'purple' as LeadTone, active: false },
];

export default function LeadsPage() {
  const renderLeadList = (className = '') => (
    <div className={`w-full lg:w-80 bg-white rounded-3xl shadow-sm border border-black/[0.02] flex flex-col overflow-hidden shrink-0 ${className}`}>
      <div className="p-5 border-b border-black/[0.03] space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-rosmatika font-medium text-2xl text-[#2E286C]">Leadler</h2>
          <button className="w-8 h-8 bg-[#533089] text-white rounded-xl flex items-center justify-center shadow-md shadow-[#533089]/20 hover:scale-105 transition-transform">
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#2E286C]/40" />
          <input
            type="text"
            placeholder="İsim veya tel no..."
            className="w-full h-10 bg-[#F8F9FC] rounded-xl pl-9 pr-4 outline-none text-sm placeholder:text-[#2E286C]/40 text-[#2E286C] font-medium"
          />
        </div>
        <div className="flex gap-2">
          <button className="flex-1 py-1.5 bg-[#533089]/5 text-[#533089] rounded-lg text-xs font-bold uppercase tracking-wider border border-[#533089]/10">Tümü</button>
          <button className="flex-1 py-1.5 bg-transparent text-[#2E286C]/50 hover:bg-black/5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors">Yeni</button>
          <button className="flex-1 py-1.5 bg-transparent text-[#2E286C]/50 hover:bg-black/5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors">Takip</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 max-h-[64dvh] lg:max-h-none">
        {leads.map((lead, i) => (
          <div
            key={i}
            className={`p-4 rounded-2xl cursor-pointer transition-all border ${lead.active ? 'bg-white shadow-md border-[#533089]/20' : 'bg-transparent border-transparent hover:bg-black/[0.02]'}`}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="font-bold text-[#2E286C] text-sm">{lead.name}</div>
              <div className="text-[10px] text-[#2E286C]/40 font-bold">{lead.time}</div>
            </div>
            <div className="text-xs text-[#2E286C]/60 font-medium mb-3">{lead.lang}</div>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${lead.active ? 'border-[#533089]/20' : leadToneStyles[lead.tone].chip} border`}>
              <div className={`w-1.5 h-1.5 rounded-full ${lead.active ? 'bg-[#533089]' : leadToneStyles[lead.tone].dot}`} />
              {lead.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderConversation = (className = '') => (
    <div className={`flex-1 min-h-[70dvh] lg:min-h-0 bg-white rounded-3xl shadow-sm border border-black/[0.02] flex flex-col overflow-hidden relative ${className}`}>
      <div className="px-5 lg:px-6 py-5 border-b border-black/[0.03] flex justify-between items-center bg-white/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#533089]/10 text-[#533089] flex items-center justify-center font-bold text-lg">AD</div>
          <div>
            <h2 className="font-bold text-[#2E286C] text-lg">Ayşe Demir</h2>
            <div className="text-xs text-emerald-500 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 relative"><span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-50" /></span>
              Çevrimiçi
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="w-10 h-10 rounded-full border border-black/5 flex items-center justify-center text-[#2E286C]/60 hover:bg-[#533089]/5 hover:text-[#533089] transition-colors"><Phone className="w-4 h-4" /></button>
          <button className="w-10 h-10 rounded-full border border-black/5 flex items-center justify-center text-[#2E286C]/60 hover:bg-[#533089]/5 hover:text-[#533089] transition-colors"><Mail className="w-4 h-4" /></button>
          <button className="w-10 h-10 rounded-full border border-black/5 hidden sm:flex items-center justify-center text-[#2E286C]/60 hover:bg-[#533089]/5 hover:text-[#533089] transition-colors"><MoreHorizontal className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6 custom-scrollbar bg-[#F4F5F8]/30">
        <div className="flex justify-center">
          <div className="bg-[#2E286C]/5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/40">Bugün</div>
        </div>

        <div className="flex gap-4">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 mt-1">
            <FileText className="w-4 h-4" />
          </div>
          <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-black/[0.02] max-w-[88%] lg:max-w-[80%]">
            <div className="text-xs text-[#2E286C]/40 font-bold uppercase tracking-wider mb-2">Başvuru Formu Dolduruldu • 10:45</div>
            <p className="text-sm text-[#2E286C] font-medium leading-relaxed">Öğrenci web sitesi üzerinden İngilizce A1 programı için form doldurdu. Kampanya ile ilgileniyor.</p>
          </div>
        </div>

        <div className="flex gap-4 flex-row-reverse">
          <div className="w-8 h-8 rounded-full bg-[#533089] flex items-center justify-center text-white shrink-0 mt-1">
            YE
          </div>
          <div className="bg-[#533089] p-4 rounded-2xl rounded-tr-none shadow-md shadow-[#533089]/20 max-w-[88%] lg:max-w-[80%] text-white">
            <div className="text-[10px] text-white/50 font-bold uppercase tracking-wider mb-2 text-right">Danışman (Siz) • 11:00</div>
            <p className="text-sm font-medium leading-relaxed">Merhaba Ayşe Hanım, Zümra Akademi&apos;den ulaşıyorum. Başvurunuzu aldık, müsaitseniz süreç hakkında bilgi vermek için 14:00&apos;da arayabilir miyim?</p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="w-8 h-8 rounded-full bg-[#533089]/10 text-[#533089] flex items-center justify-center font-bold text-xs shrink-0 mt-1">
            AD
          </div>
          <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-black/[0.02] max-w-[88%] lg:max-w-[80%]">
            <div className="text-[10px] text-[#2E286C]/40 font-bold uppercase tracking-wider mb-2">Ayşe Demir • 11:15</div>
            <p className="text-sm text-[#2E286C] font-medium leading-relaxed">Merhaba Yunus Bey, tabii 14:00 uygundur. Özellikle speaking ağırlıklı bir eğitim almak istiyorum.</p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0 mt-1">
            <Clock className="w-4 h-4" />
          </div>
          <div className="bg-amber-50/50 p-4 rounded-2xl rounded-tl-none border border-amber-200/50 max-w-[88%] lg:max-w-[80%]">
            <div className="flex justify-between items-center mb-2">
              <div className="text-xs text-amber-700 font-bold">Danışman Notu • 11:20</div>
            </div>
            <p className="text-sm text-amber-800 font-medium">Öğrenci 14:00&apos;da aranacak. Konuşma ağırlıklı eğitim istiyor, Native eğitmen paketi önerilecek.</p>
          </div>
        </div>
      </div>

      <div className="p-3 lg:p-4 bg-white border-t border-black/[0.03]">
        <div className="bg-[#F8F9FC] rounded-2xl p-2 lg:pr-4 flex items-center gap-2 border border-black/[0.02] focus-within:border-[#533089]/30 focus-within:shadow-sm transition-all">
          <button className="w-10 h-10 rounded-full text-[#2E286C]/40 hover:bg-black/5 flex items-center justify-center"><Plus className="w-5 h-5"/></button>
          <input type="text" placeholder="Mesaj yaz veya not ekle..." className="flex-1 bg-transparent border-none outline-none text-sm text-[#2E286C] font-medium placeholder:text-[#2E286C]/30" />
          <div className="hidden sm:flex bg-black/5 rounded-lg px-3 py-1.5 text-xs font-bold text-[#2E286C]/50 items-center gap-1 cursor-pointer hover:bg-black/10">
            Not Ekle <ChevronRight className="w-3 h-3"/>
          </div>
          <button className="w-10 h-10 rounded-xl bg-[#533089] text-white flex items-center justify-center shadow-md shadow-[#533089]/20 hover:scale-105 transition-transform"><MessageCircle className="w-4 h-4"/></button>
        </div>
      </div>
    </div>
  );

  const renderDetails = (className = '') => (
    <div className={`w-full lg:w-72 bg-transparent flex flex-col gap-4 overflow-y-auto custom-scrollbar shrink-0 ${className}`}>
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/[0.02]">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[#2E286C]/40 mb-4">Lead Bilgileri</h3>

        <div className="space-y-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-[#2E286C]/40">Dil & Seviye</div>
            <div className="font-bold text-[#2E286C] text-sm">İngilizce • A1</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-[#2E286C]/40">Telefon</div>
            <div className="font-bold text-[#2E286C] text-sm">+90 555 123 45 67</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-[#2E286C]/40">E-posta</div>
            <div className="font-bold text-[#2E286C] text-sm truncate">ayse.demir@gmail.com</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-[#2E286C]/40">Kaynak</div>
            <div className="inline-flex py-1 px-2.5 bg-blue-50 text-blue-600 rounded text-xs font-bold mt-1 border border-blue-100">Instagram Form</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/[0.02]">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[#2E286C]/40 mb-4">Aksiyonlar</h3>

        <button className="w-full py-3 bg-[#533089] text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md shadow-[#533089]/20 mb-3 hover:scale-[1.02] transition-transform">
          Kayıt Oluştur
        </button>
        <button className="w-full py-3 bg-white border border-black/10 text-[#2E286C] rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-black/5 transition-colors">
          Görüşme Planla
        </button>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/[0.02]">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[#2E286C]/40 mb-4">Atanan Danışman</h3>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#533089] text-white flex items-center justify-center font-bold text-xs shadow-sm">YE</div>
          <div>
            <div className="font-bold text-[#2E286C] text-sm">Yunus Emre</div>
            <div className="text-xs text-[#2E286C]/50 font-medium">Satış Uzmanı</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="lg:hidden">
        <ResponsiveTabs
          defaultValue="list"
          items={[
            { value: 'list', label: 'Liste', content: renderLeadList() },
            { value: 'conversation', label: 'Görüşme', content: renderConversation() },
            { value: 'details', label: 'Detay', content: renderDetails() },
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
