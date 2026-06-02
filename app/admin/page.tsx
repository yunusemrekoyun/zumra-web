export default function AdminPage() {
  return (
    <div className="admin-page">
      <h1 className="text-2xl lg:text-3xl font-rosmatika font-medium text-[#2E286C] mb-4 lg:mb-8">Günaydın, Yunus</h1>
      
      {/* Top Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
        <div className="bg-gradient-to-br from-[#8C6CE6] to-[#533089] rounded-3xl p-6 text-white shadow-lg shadow-[#533089]/20 relative overflow-hidden group hover:shadow-xl transition-all">
          <div className="absolute top-0 right-0 p-6 opacity-20">
            <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
          </div>
          <p className="text-white/80 font-medium text-sm mb-1">Toplam Öğrenci</p>
          <div className="text-4xl font-rosmatika font-medium mb-4">3,542</div>
          <div className="flex items-center gap-2 text-sm bg-white/20 w-fit px-3 py-1 rounded-full backdrop-blur-md">
            <span className="font-bold">↑ 12%</span>
            <span className="text-white/80">geçen aya göre</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/[0.02]">
          <p className="text-[#2E286C]/50 font-medium text-sm mb-1">Aktif Öğrenci</p>
          <div className="text-4xl font-rosmatika font-medium text-[#2E286C] mb-4">1,480</div>
          <div className="flex items-center gap-2 text-sm text-[#2E286C]/60">
            <span className="text-emerald-500 font-bold">↑ 4%</span>
            <span>geçen haftaya göre</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/[0.02]">
          <p className="text-[#2E286C]/50 font-medium text-sm mb-1">Yeni Başvuru (Bu Ay)</p>
          <div className="text-4xl font-rosmatika font-medium text-[#2E286C] mb-4">342</div>
          <div className="flex items-center gap-2 text-sm text-[#2E286C]/60">
            <span className="text-amber-500 font-bold">Bekleyen 12</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/[0.02]">
          <p className="text-[#2E286C]/50 font-medium text-sm mb-1">Dönüşüm Oranı</p>
          <div className="text-4xl font-rosmatika font-medium text-[#2E286C] mb-4">%68</div>
          <div className="flex items-center gap-2 text-sm text-[#2E286C]/60">
            <span className="text-emerald-500 font-bold">İyi seviye</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">
        {/* Recent Leads */}
        <div className="xl:col-span-2 bg-white rounded-3xl p-5 lg:p-6 shadow-sm border border-black/[0.02] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-[#2E286C] text-lg">Son Leadler</h3>
            <button className="text-sm font-bold text-[#533089] hover:bg-[#533089]/5 px-4 py-2 rounded-xl transition-colors">Tümünü Gör</button>
          </div>
          
          <div className="space-y-3">
            {[
              { name: 'Ayşe Demir', program: 'İngilizce • Genel', status: 'Yeni', time: '10 dk önce', color: 'bg-emerald-100 text-emerald-700' },
              { name: 'Zeynep Yılmaz', program: 'Arapça • Konuşma', status: 'Görüşüldü', time: '1 saat önce', color: 'bg-blue-100 text-blue-700' },
              { name: 'Fatma Kaya', program: 'İngilizce • YDS', status: 'Teklif', time: '2 saat önce', color: 'bg-amber-100 text-amber-700' },
              { name: 'Elif Şahin', program: 'Almanca • A1', status: 'Yeni', time: '3 saat önce', color: 'bg-emerald-100 text-emerald-700' },
            ].map((lead, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-2xl border border-black/[0.03] hover:shadow-md transition-shadow cursor-pointer bg-white group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#F8F9FC] border border-black/5 flex items-center justify-center font-bold text-[#533089] text-sm">
                    {lead.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div className="font-bold text-[#2E286C] mb-0.5 group-hover:text-[#533089] transition-colors">{lead.name}</div>
                    <div className="text-xs text-[#2E286C]/50 font-medium">{lead.program}</div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className={`text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-full ${lead.color}`}>
                    {lead.status}
                  </div>
                  <div className="text-xs text-[#2E286C]/40 font-medium">{lead.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Schedule/Calendar widget */}
        <div className="bg-white rounded-3xl p-5 lg:p-6 shadow-sm border border-black/[0.02]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-[#2E286C] text-lg">Bugünkü Program</h3>
            <button className="w-8 h-8 rounded-full bg-[#F8F9FC] flex items-center justify-center text-[#2E286C]/60 hover:bg-[#533089]/10 hover:text-[#533089] transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            </button>
          </div>
          
          <div className="relative">
            <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-black/[0.03]" />
            <div className="space-y-6 relative z-10">
              {[
                { time: '10:00', title: 'Danışmanlık - Ayşe D.', type: 'Call', color: 'bg-[#533089]', bg: 'bg-[#533089]/10', text: 'text-[#533089]' },
                { time: '11:30', title: 'Seviye Tespiti - Zeynep', type: 'Test', color: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
                { time: '14:00', title: 'Ekip Toplantısı', type: 'Internal', color: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700' },
                { time: '16:00', title: 'Kayıt - Fatma K.', type: 'Payment', color: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700' },
              ].map((item, i) => (
                <div key={i} className="flex gap-4 group cursor-pointer">
                  <div className="w-6 flex flex-col items-center shrink-0">
                    <div className={`w-3 h-3 rounded-full border-2 border-white ring-2 ring-transparent group-hover:ring-${item.color.split('-')[1]}-200 ${item.color} mt-1 transition-all`} />
                  </div>
                  <div className={`flex-1 rounded-2xl p-4 ${item.bg} border border-white group-hover:shadow-sm transition-all`}>
                    <div className={`text-xs font-bold mb-1 opacity-70 ${item.text}`}>{item.time}</div>
                    <div className={`text-sm font-bold ${item.text}`}>{item.title}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
