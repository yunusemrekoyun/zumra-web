import React from 'react';
import { Search, Filter, MoreHorizontal, GraduationCap, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { workspaceStudents } from '@/lib/domain';

export default function StudentsPage() {
  const students = workspaceStudents.map((student) => ({
    id: student.id,
    name: student.fullName,
    lang: student.language,
    level: student.level,
    instructor: student.teacherIds.length ? 'Sarah Lee' : 'Atanacak',
    progress: student.progress,
    active: student.status === 'active',
    next: student.nextSessionAt
      ? new Intl.DateTimeFormat('tr-TR', {
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          month: 'short',
        }).format(new Date(student.nextSessionAt))
      : '-',
  }));

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="text-2xl lg:text-3xl font-rosmatika font-medium text-[#2E286C] mb-2">Öğrenciler</h1>
          <p className="text-[#2E286C]/60 text-sm font-medium">Toplam {students.length} öğrenci mock sistemde yönetiliyor.</p>
        </div>
        <button className="bg-[#2E286C] text-white px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider shadow-md hover:scale-105 transition-transform flex items-center justify-center gap-2">
          Öğrenci Ekle
        </button>
      </div>

      <div className="bg-white rounded-[2rem] lg:rounded-[2.5rem] p-2 shadow-sm border border-black/[0.02]">
        
        {/* Filters Bar */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-4 lg:px-6 border-b border-black/[0.03]">
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
             <button className="px-4 py-1.5 bg-[#533089]/5 text-[#533089] text-xs font-bold uppercase tracking-wider rounded-lg border border-[#533089]/20">Tümü</button>
             <button className="px-4 py-1.5 bg-transparent text-[#2E286C]/50 hover:bg-black/5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors">Aktif</button>
             <button className="px-4 py-1.5 bg-transparent text-[#2E286C]/50 hover:bg-black/5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors">Dondurulmuş</button>
             <button className="px-4 py-1.5 bg-transparent text-[#2E286C]/50 hover:bg-black/5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors">Mezun</button>
          </div>
          <div className="flex items-center gap-3 w-full xl:w-auto">
             <div className="relative flex-1 xl:w-64">
               <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#2E286C]/40" />
               <input type="text" placeholder="İsimle ara..." className="w-full h-9 bg-[#F8F9FC] rounded-xl pl-9 pr-4 text-sm font-medium text-[#2E286C] outline-none focus:border-[#533089]/30 border border-transparent transition-all" />
             </div>
             <button className="w-9 h-9 border border-black/5 rounded-xl flex items-center justify-center text-[#2E286C]/60 hover:bg-black/5"><Filter className="w-4 h-4"/></button>
          </div>
        </div>

        {/* Grid List */}
        <div className="p-4 lg:p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
          {students.map((student) => (
            <Link href={`/admin/students/1`} key={student.id}>
              <div className="bg-[#F8F9FC] rounded-[2rem] p-6 border border-black/[0.03] hover:shadow-lg hover:border-[#533089]/20 transition-all cursor-pointer group flex flex-col h-full">
                
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white rounded-full border border-black/5 shadow-sm flex items-center justify-center font-bold text-[#533089] text-sm">
                      {student.name.split(' ').map(n=>n[0]).join('')}
                    </div>
                    <div>
                      <h3 className="font-bold text-[#2E286C] group-hover:text-[#533089] transition-colors">{student.name}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${student.active ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <span className="text-xs text-[#2E286C]/50 font-medium">{student.active ? 'Aktif' : 'Dondurdu'}</span>
                      </div>
                    </div>
                  </div>
                  <button className="w-8 h-8 rounded-full border border-black/5 flex items-center justify-center bg-white text-[#2E286C]/40 group-hover:block transition-all"><MoreHorizontal className="w-4 h-4"/></button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4 mb-6 relative z-10">
                  <div className="bg-white rounded-2xl p-3 border border-black/[0.02]">
                    <div className="text-[10px] uppercase font-bold tracking-widest text-[#2E286C]/40 mb-1">Eğitim</div>
                    <div className="text-sm font-bold text-[#2E286C] truncate">{student.lang}</div>
                    <div className="text-xs text-[#2E286C]/60 font-medium truncate">{student.level}</div>
                  </div>
                  <div className="bg-white rounded-2xl p-3 border border-black/[0.02]">
                    <div className="text-[10px] uppercase font-bold tracking-widest text-[#2E286C]/40 mb-1">Sonraki Ders</div>
                    <div className="text-sm font-bold text-[#2E286C] truncate">{student.next}</div>
                    <div className="text-xs text-[#2E286C]/60 font-medium truncate">Eğt: {student.instructor}</div>
                  </div>
                </div>

                <div className="mt-auto pt-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/60">İlerleme</span>
                    <span className="text-xs font-bold text-[#533089]">%{student.progress}</span>
                  </div>
                  <div className="h-2.5 bg-black/5 rounded-full overflow-hidden w-full">
                    <div 
                      className="h-full bg-gradient-to-r from-[#8C6CE6] to-[#533089] rounded-full"
                      style={{ width: `${student.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
