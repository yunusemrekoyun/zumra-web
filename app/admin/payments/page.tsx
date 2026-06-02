import React from 'react';
import { Search, Filter, ArrowUpRight, Clock, CheckCircle2 } from 'lucide-react';

const statusStyles: Record<string, string> = {
  amber: 'border-amber-500/20 bg-amber-50 text-amber-700',
  emerald: 'border-emerald-500/20 bg-emerald-50 text-emerald-700',
  red: 'border-red-500/20 bg-red-50 text-red-700',
};

export default function PaymentsPage() {
  const transactions = [
    { name: 'Ayşe Demir', plan: 'İngilizce • 6 Aylık Paket', amount: '₺12,000', date: 'Bugün, 14:20', status: 'Ödendi', color: 'emerald' },
    { name: 'Fatma Kaya', plan: 'Arapça • Aylık Taksit (2/4)', amount: '₺2,500', date: 'Bugün, 10:15', status: 'Ödendi', color: 'emerald' },
    { name: 'Zeynep Yılmaz', plan: 'Almanca • Aylık Taksit (1/6)', amount: '₺3,000', date: 'Dün', status: 'Beklemede', color: 'amber' },
    { name: 'Elif Türkmen', plan: 'İngilizce • Özel Ders Pk.', amount: '₺8,500', date: '15 Mart', status: 'Başarısız', color: 'red' },
    { name: 'Nisa Çelik', plan: 'Fransızca • 3 Aylık Paket', amount: '₺6,500', date: '14 Mart', status: 'Ödendi', color: 'emerald' },
  ];

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="text-2xl lg:text-3xl font-rosmatika font-medium text-[#2E286C]">Ödemeler</h1>
        <button className="bg-[#533089] text-white px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider shadow-md hover:scale-105 transition-transform flex items-center gap-2">
          Manuel Ödeme Ekle
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-black/[0.02]">
          <p className="text-[#2E286C]/50 font-medium text-xs mb-1 uppercase tracking-widest">Bu Ayki Tahsilat</p>
          <div className="text-3xl font-rosmatika font-medium text-[#2E286C] mb-4">₺124.500</div>
          <div className="flex items-center gap-2 text-sm text-[#2E286C]/60">
            <span className="text-emerald-500 font-bold">↑ 8%</span>
            <span>geçen aya göre</span>
          </div>
        </div>
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-black/[0.02]">
          <p className="text-[#2E286C]/50 font-medium text-xs mb-1 uppercase tracking-widest">Bekleyen Ödemeler</p>
          <div className="text-3xl font-rosmatika font-medium text-[#2E286C] mb-4">₺12.400</div>
          <div className="flex items-center gap-2 text-sm text-[#2E286C]/60 border border-amber-200 bg-amber-50 px-2 py-1 rounded w-fit">
            <Clock className="w-3 h-3 text-amber-500" />
            <span className="text-amber-600 font-bold text-xs uppercase tracking-wider">7 vadesi geçen</span>
          </div>
        </div>
        <div className="sm:col-span-2 bg-gradient-to-r from-[#2E286C] to-[#533089] rounded-[2rem] p-6 shadow-lg text-white relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-5">
           <div>
             <h3 className="font-bold text-lg mb-1">Faturalandırma Dönemi</h3>
             <p className="text-white/70 text-sm font-medium">Mart 2026 dönemi faturaları kesilmeye hazır.</p>
           </div>
           <button className="px-5 py-2.5 bg-white text-[#2E286C] rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-white/90 transition-colors shadow-md">Toplu Fatura Kes</button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] lg:rounded-[2.5rem] shadow-sm border border-black/[0.02] overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 lg:p-6 border-b border-black/[0.03]">
          <h2 className="font-bold text-[#2E286C] text-lg">Son İşlemler</h2>
          <div className="flex items-center gap-3 w-full md:w-auto">
             <div className="relative flex-1 md:w-64">
               <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#2E286C]/40" />
               <input type="text" placeholder="İşlem numarası veya isim..." className="w-full h-9 bg-[#F8F9FC] rounded-xl pl-9 pr-4 text-sm font-medium text-[#2E286C] border border-transparent outline-none focus:border-[#533089]/30 transition-all" />
             </div>
             <button className="w-9 h-9 border border-black/5 rounded-xl flex items-center justify-center text-[#2E286C]/60 hover:bg-black/5"><Filter className="w-4 h-4"/></button>
          </div>
        </div>

        <div className="md:hidden p-4 space-y-3">
          {transactions.map((row, i) => (
            <div key={i} className="rounded-2xl bg-[#F8F9FC] border border-black/[0.03] p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-[#533089]/10 text-[#533089] border border-black/5 flex items-center justify-center text-xs shrink-0">
                    {row.name.split(' ').map(n=>n[0]).join('')}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-[#2E286C] truncate">{row.name}</div>
                    <div className="text-xs text-[#2E286C]/55 truncate">{row.plan}</div>
                  </div>
                </div>
                <button className="text-[#533089] p-2 hover:bg-[#533089]/5 rounded-lg transition-colors shrink-0"><ArrowUpRight className="w-4 h-4"/></button>
              </div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-[#2E286C]/40 font-bold">Tutar</div>
                  <div className="font-bold text-[#2E286C]">{row.amount}</div>
                  <div className="text-xs text-[#2E286C]/50">{row.date}</div>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${statusStyles[row.color] ?? statusStyles.emerald}`}>
                  {row.status === 'Ödendi' && <CheckCircle2 className="w-3 h-3" />}
                  {row.status}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden md:block admin-table-wrap">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8F9FC] text-[10px] uppercase tracking-widest text-[#2E286C]/50 font-bold border-b border-black/[0.03]">
                <th className="px-6 py-4 font-bold">Öğrenci</th>
                <th className="px-6 py-4 font-bold">Plan</th>
                <th className="px-6 py-4 font-bold">Tutar</th>
                <th className="px-6 py-4 font-bold">Tarih</th>
                <th className="px-6 py-4 font-bold">Durum</th>
                <th className="px-6 py-4 font-bold text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium text-[#2E286C]/80 divide-y divide-black/[0.02]">
              {transactions.map((row, i) => (
                <tr key={i} className="hover:bg-black/[0.01] transition-colors group cursor-pointer">
                  <td className="px-6 py-4 font-bold text-[#2E286C] flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#533089]/10 text-[#533089] border border-black/5 flex items-center justify-center text-xs">
                      {row.name.split(' ').map(n=>n[0]).join('')}
                    </div>
                    {row.name}
                  </td>
                  <td className="px-6 py-4 text-[#2E286C]/60">{row.plan}</td>
                  <td className="px-6 py-4 font-bold text-[#2E286C]">{row.amount}</td>
                  <td className="px-6 py-4 text-[#2E286C]/60">{row.date}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${statusStyles[row.color] ?? statusStyles.emerald}`}>
                      {row.status === 'Ödendi' && <CheckCircle2 className="w-3 h-3" />}
                      {row.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-[#533089] p-2 hover:bg-[#533089]/5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"><ArrowUpRight className="w-4 h-4"/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
