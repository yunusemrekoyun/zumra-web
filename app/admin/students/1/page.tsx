import React from 'react';
import { ChevronLeft, MoreHorizontal, MessageSquare, Mail, Calendar as CalendarIcon, Download, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import Link from 'next/link';

export default function StudentDetailPage() {
  return (
    <div className="admin-page">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/[0.03]">
        <div className="flex items-center gap-4">
          <Link href="/admin/students" className="w-10 h-10 bg-white rounded-full border border-black/5 flex items-center justify-center hover:bg-black/5 transition-colors">
            <ChevronLeft className="w-5 h-5 text-[#2E286C]" />
          </Link>
          <div>
            <h1 className="text-2xl font-rosmatika font-medium text-[#2E286C]">Zeynep Kaya</h1>
            <div className="text-xs text-[#2E286C]/50 font-medium">Öğrenci ID: #ZKA-10294</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-black/10 rounded-xl text-xs font-bold text-[#2E286C] hover:bg-black/5 transition-colors">
            <Mail className="w-4 h-4"/> E-posta
          </button>
          <button className="flex items-center justify-center gap-2 px-4 py-2 bg-[#533089] text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md hover:scale-105 transition-transform">
            <MessageSquare className="w-4 h-4"/> Mesaj Gönder
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* LEFT PROFILE & QUICK STATS */}
        <div className="w-full lg:w-80 flex flex-col gap-6 shrink-0">
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-black/[0.02] flex flex-col items-center text-center">
             <div className="w-24 h-24 rounded-full bg-[#533089]/10 text-[#533089] border-4 border-white shadow-md flex items-center justify-center font-bold text-3xl mx-auto mb-4">
               ZK
             </div>
             <h2 className="text-xl font-bold text-[#2E286C] text-center">Zeynep Kaya</h2>
             <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-wider border border-emerald-100 mx-auto mt-2">
               <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Aktif Öğrenci
             </div>

             <div className="w-full h-px bg-black/[0.03] my-6" />

             <div className="text-left w-full space-y-4">
               <div>
                 <div className="text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/40">Kayıtlı Program</div>
                 <div className="text-sm font-bold text-[#2E286C]">İngilizce • Genel Eğitim</div>
               </div>
               <div>
                 <div className="text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/40">Güncel Seviye</div>
                 <div className="text-sm font-bold text-[#2E286C]">B1 Intermediate</div>
               </div>
               <div>
                 <div className="text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/40">Eğitmen</div>
                 <div className="text-sm font-bold text-[#533089]">Sarah Lee</div>
               </div>
               <div>
                 <div className="text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/40">Kayıt Tarihi</div>
                 <div className="text-sm font-bold text-[#2E286C]/70">12 Ocak 2026</div>
               </div>
             </div>
          </div>
        </div>

        {/* CENTER MAIN CONTENT */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Progress Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
             <div className="bg-gradient-to-br from-[#8C6CE6] to-[#533089] rounded-[2rem] p-6 shadow-lg shadow-[#533089]/20 text-white relative overflow-hidden group">
               <div className="relative z-10">
                 <div className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">Tamamlanan Ders</div>
                 <div className="text-3xl font-rosmatika font-medium mb-1">12 <span className="text-lg opacity-50">/ 24</span></div>
                 <div className="text-sm text-emerald-300 font-bold">%100 Devamlılık</div>
               </div>
               <div className="absolute right-0 bottom-0 opacity-10 scale-150 translate-x-4 translate-y-4 group-hover:scale-110 transition-transform duration-700">
                 <CheckCircle2 className="w-24 h-24" />
               </div>
             </div>
             
             <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-black/[0.02]">
               <div className="text-[#2E286C]/50 text-xs font-bold uppercase tracking-widest mb-1">Gelişim Puanı</div>
               <div className="text-3xl font-rosmatika font-medium text-[#2E286C] mb-1">85</div>
               <div className="flex items-center gap-1.5 text-sm text-emerald-600 font-bold">
                 ↑ 12 Puan artış (son 1 ay)
               </div>
             </div>

             <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-black/[0.02]">
               <div className="text-[#2E286C]/50 text-xs font-bold uppercase tracking-widest mb-1">Ödev Teslimi</div>
               <div className="text-3xl font-rosmatika font-medium text-[#2E286C] mb-1">9 <span className="text-lg text-[#2E286C]/30">/ 10</span></div>
               <div className="flex items-center gap-1.5 text-sm text-amber-500 font-bold">
                 <AlertCircle className="w-4 h-4"/> 1 Gecikmeli Teslim
               </div>
             </div>
          </div>

          {/* Timeline / Course History */}
          <div className="bg-white rounded-[2rem] lg:rounded-[2.5rem] p-5 lg:p-8 shadow-sm border border-black/[0.02] flex-1">
             <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-8">
               <h3 className="text-xl font-bold text-[#2E286C]">Ders Geçmişi & Notlar</h3>
               <button className="text-[#533089] text-xs font-bold uppercase tracking-wider hover:bg-[#533089]/5 px-4 py-2 rounded-xl transition-colors">Tümünü Gör</button>
             </div>

             <div className="relative">
                <div className="absolute left-[11px] top-4 bottom-0 w-0.5 bg-[#533089]/10" />
                
                <div className="space-y-8 relative z-10">
                  <div className="flex gap-4 lg:gap-6">
                    <div className="w-6 h-6 rounded-full bg-[#533089] text-white flex items-center justify-center shrink-0 shadow-md ring-4 ring-white"><CheckCircle2 className="w-3 h-3" /></div>
                    <div className="bg-[#F8F9FC] p-5 rounded-2xl border border-black/[0.03] flex-1">
                       <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                         <div className="font-bold text-[#2E286C]">Ders 12: Speaking Practice - Everyday Scenarios</div>
                         <div className="text-xs font-medium text-[#2E286C]/50">17 Mart, 14:00</div>
                       </div>
                       <p className="text-sm text-[#2E286C]/70 leading-relaxed mb-4">Öğrenci günlük konuşma pratiklerinde oldukça başarılıydı. Özellikle kelime çeşitliliği konusunda ilerleme var. Sadece past tense kullanımlarında küçük hatalar yapılıyor, üzerine gidilecek.</p>
                       <div className="flex flex-wrap items-center gap-3">
                         <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-black/5 text-xs font-bold text-[#2E286C]/60 hover:border-[#533089]/30 cursor-pointer transition-colors"><FileText className="w-3 h-3"/> Unit_12_Notes.pdf</div>
                         <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded">Ödev Verildi</div>
                       </div>
                    </div>
                  </div>

                  <div className="flex gap-4 lg:gap-6">
                    <div className="w-6 h-6 rounded-full bg-[#533089]/20 flex items-center justify-center shrink-0 ring-4 ring-white"><div className="w-2 h-2 rounded-full bg-[#533089]"/></div>
                    <div className="bg-white p-5 rounded-2xl border border-black/[0.03] flex-1">
                       <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                         <div className="font-bold text-[#2E286C]">Ders 11: Grammar Focus - Perfect Tenses</div>
                         <div className="text-xs font-medium text-[#2E286C]/50">15 Mart, 14:00</div>
                       </div>
                       <p className="text-sm text-[#2E286C]/70 leading-relaxed">Gramer yapısını anladı ancak konuşmaya dökmekte biraz zorlandı. Ekstra okuma parçası gönderildi.</p>
                       <div className="flex items-center gap-3 mt-3">
                         <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded border border-emerald-100 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Ödev Tamamlandı</div>
                       </div>
                    </div>
                  </div>
                </div>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
