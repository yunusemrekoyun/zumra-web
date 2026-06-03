import React from 'react';
import { Filter, ArrowUpRight, Clock, CheckCircle2 } from 'lucide-react';
import { KpiCard, SectionHeader, Avatar, StatusChip, SearchInput, Card, Button } from '@/components/ui';

/* ─── Data ────────────────────────────────────────────────────────── */

const transactions = [
  { name: 'Ayşe Demir', plan: 'İngilizce • 6 Aylık Paket', amount: '₺12,000', date: 'Bugün, 14:20', status: 'Ödendi', tone: 'emerald' as const },
  { name: 'Fatma Kaya', plan: 'Arapça • Aylık Taksit (2/4)', amount: '₺2,500', date: 'Bugün, 10:15', status: 'Ödendi', tone: 'emerald' as const },
  { name: 'Zeynep Yılmaz', plan: 'Almanca • Aylık Taksit (1/6)', amount: '₺3,000', date: 'Dün', status: 'Beklemede', tone: 'amber' as const },
  { name: 'Elif Türkmen', plan: 'İngilizce • Özel Ders Pk.', amount: '₺8,500', date: '15 Mart', status: 'Başarısız', tone: 'red' as const },
  { name: 'Nisa Çelik', plan: 'Fransızca • 3 Aylık Paket', amount: '₺6,500', date: '14 Mart', status: 'Ödendi', tone: 'emerald' as const },
];

/* ─── Component ───────────────────────────────────────────────────── */

export default function PaymentsPage() {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="text-2xl lg:text-3xl font-rosmatika font-medium text-[#2E286C]">Ödemeler</h1>
        <Button>Manuel Ödeme Ekle</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
        <KpiCard
          label="Bu Ayki Tahsilat"
          value="₺124.500"
          trend={{ direction: 'up', label: '8% geçen aya göre' }}
        />
        <KpiCard
          label="Bekleyen Ödemeler"
          value="₺12.400"
          trend={{
            label: '7 vadesi geçen',
            direction: 'neutral',
          }}
        />
        <Card variant="gradient" className="sm:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div>
            <h3 className="font-bold text-lg mb-1">Faturalandırma Dönemi</h3>
            <p className="text-white/70 text-sm font-medium">Mart 2026 dönemi faturaları kesilmeye hazır.</p>
          </div>
          <Button variant="secondary" className="bg-white text-[#2E286C] border-0 shadow-md">Toplu Fatura Kes</Button>
        </Card>
      </div>

      <Card padded={false} className="overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 lg:p-6 border-b border-black/[0.03]">
          <SectionHeader title="Son İşlemler" className="mb-0" />
          <div className="flex items-center gap-3 w-full md:w-auto">
            <SearchInput placeholder="İşlem numarası veya isim..." containerClassName="flex-1 md:w-64" />
            <button className="w-9 h-9 border border-black/5 rounded-xl flex items-center justify-center text-[#2E286C]/60 hover:bg-black/5 shrink-0">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden p-4 space-y-3">
          {transactions.map((row, i) => (
            <div key={i} className="rounded-2xl bg-[#F8F9FC] border border-black/[0.03] p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={row.name} size="sm" />
                  <div className="min-w-0">
                    <div className="font-bold text-[#2E286C] truncate">{row.name}</div>
                    <div className="text-xs text-[#2E286C]/55 truncate">{row.plan}</div>
                  </div>
                </div>
                <button className="text-[#533089] p-2 hover:bg-[#533089]/5 rounded-lg transition-colors shrink-0">
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-[#2E286C]/40 font-bold">Tutar</div>
                  <div className="font-bold text-[#2E286C]">{row.amount}</div>
                  <div className="text-xs text-[#2E286C]/50">{row.date}</div>
                </div>
                <StatusChip
                  tone={row.tone}
                  icon={row.status === 'Ödendi' ? <CheckCircle2 className="w-3 h-3" /> : undefined}
                >
                  {row.status}
                </StatusChip>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
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
                    <Avatar name={row.name} size="sm" />
                    {row.name}
                  </td>
                  <td className="px-6 py-4 text-[#2E286C]/60">{row.plan}</td>
                  <td className="px-6 py-4 font-bold text-[#2E286C]">{row.amount}</td>
                  <td className="px-6 py-4 text-[#2E286C]/60">{row.date}</td>
                  <td className="px-6 py-4">
                    <StatusChip
                      tone={row.tone}
                      icon={row.status === 'Ödendi' ? <CheckCircle2 className="w-3 h-3" /> : undefined}
                    >
                      {row.status}
                    </StatusChip>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-[#533089] p-2 hover:bg-[#533089]/5 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
