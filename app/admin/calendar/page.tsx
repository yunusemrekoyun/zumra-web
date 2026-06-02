import React from 'react';
import { Search, Filter, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Video, FileText, CheckCircle2 } from 'lucide-react';

export default function CalendarPage() {
  const days = ['Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz', 'Pzt'];
  const dates = [17, 18, 19, 20, 21, 22, 23];

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="text-2xl lg:text-3xl font-rosmatika font-medium text-[#2E286C]">Takvim</h1>
        <div className="flex flex-wrap items-center gap-3 lg:gap-4">
          <div className="bg-white rounded-2xl flex p-1 border border-black/[0.03] shadow-sm">
             <button className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl bg-[#533089] text-white shadow-md">Haftalık</button>
             <button className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl text-[#2E286C]/50 hover:bg-black/5">Aylık</button>
          </div>
          <button className="bg-[#2E286C] text-white px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider shadow-md hover:scale-105 transition-transform flex items-center gap-2">
            <span className="text-lg leading-none">+</span> Yeni Etkinlik
          </button>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-4 lg:gap-6">
        {/* Main Calendar View */}
        <div className="flex-1 bg-white rounded-[2rem] lg:rounded-[2.5rem] p-4 lg:p-8 shadow-sm border border-black/[0.02]">
          
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
             <div className="flex items-center gap-3 lg:gap-4">
               <button className="w-10 h-10 rounded-full border border-black/5 flex items-center justify-center hover:bg-black/5"><ChevronLeft className="w-5 h-5 text-[#2E286C]"/></button>
               <h2 className="text-2xl font-bold text-[#2E286C]">Mart 2026</h2>
               <button className="w-10 h-10 rounded-full border border-black/5 flex items-center justify-center hover:bg-black/5"><ChevronRight className="w-5 h-5 text-[#2E286C]"/></button>
             </div>
             
             <button className="flex items-center gap-2 px-4 py-2 border border-black/5 rounded-xl text-sm font-bold text-[#2E286C]/70 hover:bg-black/5">
                <Filter className="w-4 h-4"/> Filtrele
             </button>
          </div>

          {/* Week Graph */}
          <div className="admin-table-wrap">
            <div className="grid grid-cols-7 gap-2 lg:gap-4 mb-4 min-w-[520px] lg:min-w-0">
               {days.map((day, i) => (
                 <div key={i} className="text-center font-bold text-[11px] uppercase tracking-widest text-[#2E286C]/40">{day}</div>
               ))}
            </div>
            <div className="grid grid-cols-7 gap-2 lg:gap-4 min-w-[520px] lg:min-w-0">
               {dates.map((date, i) => (
                 <div key={i} className={`h-20 lg:h-24 rounded-2xl border flex flex-col p-2 relative ${date === 19 ? 'border-[#533089]/20 bg-[#533089]/5' : 'border-black/[0.03] hover:border-black/10'}`}>
                    <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${date === 19 ? 'bg-[#533089] text-white' : 'text-[#2E286C]'}`}>{date}</span>
                    
                    {/* Events dots */}
                    <div className="mt-auto flex gap-1 px-1">
                      {date === 17 && <div className="w-2 h-2 rounded-full bg-emerald-500"/>}
                      {date === 19 && (
                        <>
                         <div className="w-2 h-2 rounded-full bg-[#533089]"/>
                         <div className="w-2 h-2 rounded-full bg-amber-500"/>
                        </>
                      )}
                      {date === 21 && <div className="w-2 h-2 rounded-full bg-blue-500"/>}
                    </div>
                 </div>
               ))}
            </div>
          </div>

          {/* Daily Schedule (Time blocked) */}
          <div className="mt-10 relative">
             <div className="absolute top-0 bottom-0 left-16 w-px bg-black/[0.03]" />
             
             <div className="space-y-8">
               <div className="flex gap-4 lg:gap-8 group">
                 <div className="w-10 lg:w-12 text-right text-xs font-bold text-[#2E286C]/40 pt-2">10:00</div>
                 <div className="flex-1">
                   <div className="bg-[#533089]/10 border border-[#533089]/20 p-5 rounded-3xl relative overflow-hidden group-hover:shadow-md transition-shadow cursor-pointer">
                     <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#533089]" />
                     <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
                       <h4 className="font-bold text-[#2E286C] text-lg">Seviye Tespit Sınavı</h4>
                       <span className="px-3 py-1 bg-white rounded-full text-[10px] font-bold uppercase text-[#533089] shadow-sm tracking-wider">Online Test</span>
                     </div>
                     <div className="flex flex-wrap items-center gap-3 lg:gap-4 text-sm font-medium text-[#2E286C]/70">
                       <div className="flex items-center gap-2"><Video className="w-4 h-4"/> Zoom Linki Gönderildi</div>
                       <div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-xs font-bold text-[#533089]">AD</div> Ayşe Demir</div>
                     </div>
                   </div>
                 </div>
               </div>

               <div className="flex gap-4 lg:gap-8 group">
                 <div className="w-10 lg:w-12 text-right text-xs font-bold text-[#2E286C]/40 pt-2">13:30</div>
                 <div className="flex-1">
                   <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-3xl relative overflow-hidden group-hover:shadow-md transition-shadow cursor-pointer">
                     <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500" />
                     <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
                       <h4 className="font-bold text-[#2E286C] text-lg">Demo Ders • İngilizce A1</h4>
                       <span className="px-3 py-1 bg-white rounded-full text-[10px] font-bold uppercase text-emerald-600 shadow-sm tracking-wider">Planlandı</span>
                     </div>
                     <div className="flex flex-wrap items-center gap-3 lg:gap-4 text-sm font-medium text-[#2E286C]/70">
                       <div className="flex items-center gap-2"><CalendarIcon className="w-4 h-4"/> 13:30 - 14:15</div>
                       <div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">ZK</div> Zeynep Kaya</div>
                     </div>
                   </div>
                 </div>
               </div>

               <div className="flex gap-4 lg:gap-8 group">
                 <div className="w-10 lg:w-12 text-right text-xs font-bold text-[#2E286C]/40 pt-2">15:00</div>
                 <div className="flex-1">
                   <div className="bg-amber-50 border border-amber-100 p-5 rounded-3xl relative overflow-hidden group-hover:shadow-md transition-shadow cursor-pointer">
                     <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500" />
                     <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
                       <h4 className="font-bold text-[#2E286C] text-lg">Danışman Görüşmesi</h4>
                       <span className="px-3 py-1 bg-white rounded-full text-[10px] font-bold uppercase text-amber-600 shadow-sm tracking-wider">Telefon</span>
                     </div>
                     <div className="flex items-center gap-4 text-sm font-medium text-[#2E286C]/70">
                       <div className="flex items-center gap-2">Fatma Şahin • Almanca Programı İçin Bilgi</div>
                     </div>
                   </div>
                 </div>
               </div>

             </div>
          </div>
        </div>
        
        {/* RIGHT: Quick Details / Alerts */}
        <div className="w-full xl:w-80 space-y-4 lg:space-y-6 flex-shrink-0">
          <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-black/[0.02]">
            <h3 className="font-bold text-[#2E286C] mb-6 text-lg">Yaklaşan Etkinlikler</h3>
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#F8F9FC] border border-black/[0.03]">
                <div className="text-[10px] uppercase font-bold tracking-widest text-[#533089] mb-1">15 Dk. Sonra</div>
                <div className="font-bold text-[#2E286C] mb-2">Seviye Tespit Sınavı</div>
                <div className="text-xs text-[#2E286C]/60 flex items-center gap-1 font-medium"><CheckCircle2 className="w-3 h-3 text-emerald-500"/> Ayşe Demir hazır.</div>
                <button className="w-full mt-3 py-2 bg-white rounded-xl shadow-sm border border-black/5 text-xs font-bold text-[#2E286C] hover:bg-black/5">Katıl</button>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-black/[0.05]">
                <div className="text-[10px] uppercase font-bold tracking-widest text-[#2E286C]/40 mb-1">13:30</div>
                <div className="font-bold text-[#2E286C] mb-1">Demo Ders</div>
                <div className="text-xs text-[#2E286C]/60 font-medium">Zeynep Kaya / Eğitmen: Selin</div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#8C6CE6] to-[#533089] rounded-[2.5rem] p-6 shadow-lg shadow-[#533089]/20 text-white relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
               <CalendarIcon className="w-24 h-24" />
             </div>
             <h3 className="font-bold mb-2 text-lg relative z-10">Eğitmen Müsaitlikleri</h3>
             <p className="text-white/80 text-sm font-medium mb-6 relative z-10">Bu hafta 4 eğitmen yeni öğrenci kabulüne uygun.</p>
             <button className="w-full py-3 bg-white/20 backdrop-blur-md rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-white/30 transition-colors relative z-10">Takvimleri İncele</button>
          </div>
        </div>
      </div>
    </div>
  );
}
