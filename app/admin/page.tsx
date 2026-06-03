import { Users } from 'lucide-react';
import { KpiCard, SectionHeader, Avatar, StatusChip, TimelineItem, Card } from '@/components/ui';

/* ─── Data ────────────────────────────────────────────────────────── */

const leads = [
  { name: 'Ayşe Demir', program: 'İngilizce • Genel', status: 'Yeni', time: '10 dk önce', tone: 'emerald' as const },
  { name: 'Zeynep Yılmaz', program: 'Arapça • Konuşma', status: 'Görüşüldü', time: '1 saat önce', tone: 'blue' as const },
  { name: 'Fatma Kaya', program: 'İngilizce • YDS', status: 'Teklif', time: '2 saat önce', tone: 'amber' as const },
  { name: 'Elif Şahin', program: 'Almanca • A1', status: 'Yeni', time: '3 saat önce', tone: 'emerald' as const },
];

const schedule = [
  { time: '10:00', title: 'Danışmanlık - Ayşe D.', tone: 'brand' as const },
  { time: '11:30', title: 'Seviye Tespiti - Zeynep', tone: 'emerald' as const },
  { time: '14:00', title: 'Ekip Toplantısı', tone: 'blue' as const },
  { time: '16:00', title: 'Kayıt - Fatma K.', tone: 'amber' as const },
];

/* ─── Component ───────────────────────────────────────────────────── */

export default function AdminPage() {
  return (
    <div className="admin-page">
      <h1 className="text-2xl lg:text-3xl font-rosmatika font-medium text-[#2E286C] mb-4 lg:mb-8">
        Günaydın, Yunus
      </h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
        <KpiCard
          variant="gradient"
          icon={Users}
          label="Toplam Öğrenci"
          value="3,542"
          trend={{ direction: 'up', label: '12% geçen aya göre' }}
        />
        <KpiCard
          label="Aktif Öğrenci"
          value="1,480"
          trend={{ direction: 'up', label: '4% geçen haftaya göre' }}
        />
        <KpiCard
          label="Yeni Başvuru (Bu Ay)"
          value="342"
          trend={{ label: 'Bekleyen 12', direction: 'neutral' }}
        />
        <KpiCard
          label="Dönüşüm Oranı"
          value="%68"
          trend={{ direction: 'up', label: 'İyi seviye' }}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">
        {/* Recent Leads */}
        <Card className="xl:col-span-2" padded>
          <SectionHeader
            title="Son Leadler"
            action={
              <button className="text-sm font-bold text-[#533089] hover:bg-[#533089]/5 px-4 py-2 rounded-xl transition-colors">
                Tümünü Gör
              </button>
            }
          />
          <div className="space-y-3">
            {leads.map((lead, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 rounded-2xl border border-black/[0.03] hover:shadow-md transition-shadow cursor-pointer bg-white group"
              >
                <div className="flex items-center gap-4">
                  <Avatar name={lead.name} />
                  <div>
                    <div className="font-bold text-[#2E286C] mb-0.5 group-hover:text-[#533089] transition-colors">
                      {lead.name}
                    </div>
                    <div className="text-xs text-[#2E286C]/50 font-medium">{lead.program}</div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusChip tone={lead.tone}>{lead.status}</StatusChip>
                  <div className="text-xs text-[#2E286C]/40 font-medium">{lead.time}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Schedule */}
        <Card padded>
          <SectionHeader
            title="Bugünkü Program"
            action={
              <button className="w-8 h-8 rounded-full bg-[#F8F9FC] flex items-center justify-center text-[#2E286C]/60 hover:bg-[#533089]/10 hover:text-[#533089] transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            }
          />
          <div className="relative">
            <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-black/[0.03]" />
            <div className="space-y-6 relative z-10">
              {schedule.map((item, i) => (
                <TimelineItem key={i} time={item.time} title={item.title} tone={item.tone} />
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
