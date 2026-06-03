import React from 'react';
import { BarChart3, TrendingUp, Users, Target, ArrowUpRight } from 'lucide-react';
import { KpiCard, SectionHeader, Card } from '@/components/ui';

export default function ReportsPage() {
  return (
    <div className="admin-page">
      <h1 className="text-2xl lg:text-3xl font-rosmatika font-medium text-[#2E286C] mb-4 lg:mb-8">Performans Raporları</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
        <KpiCard
          icon={TrendingUp}
          label="Büyüme"
          value="%24"
          trend={{ label: 'Son çeyrekteki öğrenci artışı' }}
        />
        <KpiCard
          icon={Target}
          label="Dönüşüm"
          value={<>68 <span className="text-lg text-[#2E286C]/30">/ 100</span></>}
          trend={{ label: 'Lead -> Kayıt oranı' }}
        />
        <KpiCard
          icon={Users}
          label="Elde Tutma"
          value="%92"
          trend={{ label: 'Programı tamamlayanlar' }}
        />

        <div className="bg-[#533089] rounded-3xl p-6 shadow-md text-white relative overflow-hidden group hover:shadow-lg transition-all cursor-pointer">
          <h3 className="font-bold mb-1 z-10 relative">Detaylı Rapor İndir</h3>
          <p className="text-white/70 text-xs font-medium mb-6 z-10 relative">Mart 2026 PDF Raporu</p>
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center z-10 relative group-hover:scale-110 transition-transform">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <BarChart3 className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10" />
        </div>
      </div>

      <Card padded className="lg:!p-8">
        <SectionHeader
          title="Dil Popülerliği & Kayıtlar"
          description="Hangi programlara talep artıyor?"
          action={
            <select className="bg-[#F8F9FC] border border-black/5 rounded-xl px-4 py-2 text-sm font-bold text-[#2E286C] outline-none">
              <option>Son 6 Ay</option>
              <option>Bu Yıl</option>
            </select>
          }
          className="border-b border-black/[0.03] pb-6 mb-8"
        />

        <div className="space-y-6">
          {[
            { lang: 'İngilizce', percentage: 75, count: '1,110 Öğrenci', color: 'from-[#8C6CE6] to-[#533089]' },
            { lang: 'Arapça', percentage: 45, count: '320 Öğrenci', color: 'from-blue-400 to-blue-600' },
            { lang: 'Almanca', percentage: 30, count: '180 Öğrenci', color: 'from-emerald-400 to-emerald-600' },
            { lang: 'Fransızca', percentage: 15, count: '90 Öğrenci', color: 'from-amber-400 to-amber-600' },
          ].map((item, i) => (
            <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
              <div className="sm:w-32 font-bold text-[#2E286C] text-sm">{item.lang}</div>
              <div className="flex-1 h-8 bg-[#F8F9FC] rounded-full overflow-hidden border border-black/[0.02]">
                <div className={`h-full bg-gradient-to-r ${item.color} rounded-full`} style={{ width: `${item.percentage}%` }} />
              </div>
              <div className="sm:w-24 sm:text-right text-xs font-bold text-[#2E286C]/50">{item.count}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
