'use client';

import { useMemo, useState } from 'react';
import { UsersRound } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import {
  Avatar,
  EmptyState,
  FilterTabs,
  InfoField,
  ModulePanel,
  SearchInput,
} from '@/components/ui';

export type AdminStudentCard = {
  enrollmentId: string;
  fullName: string;
  instructorLabel: string;
  levelLabel: string;
  nextLessonLabel: string;
  programLabel: string;
  progress: number;
  status: 'active' | 'cancelled' | 'graduated' | 'paused';
  statusLabel: string;
  studentId: string;
};

type AdminStudentsClientProps = {
  labels: {
    all: string;
    active: string;
    paused: string;
    graduated: string;
    education: string;
    nextLesson: string;
    teacher: string;
    progress: string;
    search: string;
    emptyTitle: string;
    emptyDescription: string;
    noMatches: string;
  };
  linkToDetail?: boolean;
  students: AdminStudentCard[];
};

type StatusFilter = 'all' | 'active' | 'paused' | 'graduated';

export function AdminStudentsClient({
  labels,
  linkToDetail = true,
  students,
}: AdminStudentsClientProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    return students.filter((student) => {
      if (statusFilter !== 'all' && student.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return [student.fullName, student.programLabel, student.instructorLabel]
        .join(' ')
        .toLocaleLowerCase('tr-TR')
        .includes(q);
    });
  }, [students, statusFilter, query]);

  return (
    <ModulePanel padded={false} className="p-2 lg:rounded-[2.5rem]">
      <div className="flex flex-col justify-between gap-4 border-b border-black/[0.03] p-4 lg:px-6 xl:flex-row xl:items-center">
        <FilterTabs
          activeValue={statusFilter}
          onChange={(value) => setStatusFilter(value as StatusFilter)}
          items={[
            { value: 'all', label: labels.all },
            { value: 'active', label: labels.active },
            { value: 'paused', label: labels.paused },
            { value: 'graduated', label: labels.graduated },
          ]}
        />
        <SearchInput
          placeholder={labels.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          containerClassName="w-full xl:w-64"
          className="h-9"
        />
      </div>

      {filtered.length ? (
        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:p-6 xl:grid-cols-3 lg:gap-6">
          {filtered.map((student) => {
            const card = (
              <ModulePanel
                variant="muted"
                className={`group flex h-full flex-col transition-all ${
                  linkToDetail
                    ? 'cursor-pointer hover:border-[#533089]/20 hover:shadow-lg'
                    : ''
                }`}
              >
                <div className="mb-6 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={student.fullName}
                      size="lg"
                      className="bg-white shadow-sm"
                    />
                    <div>
                      <h3 className="font-bold text-[#2E286C] transition-colors group-hover:text-[#533089]">
                        {student.fullName}
                      </h3>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${statusDotClass(student.status)}`}
                        />
                        <span className="text-xs font-medium text-[#2E286C]/50">
                          {student.statusLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative z-10 mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4">
                  <ModulePanel className="rounded-2xl p-3">
                    <InfoField
                      label={labels.education}
                      value={student.programLabel}
                      valueClassName="truncate"
                    />
                    <div className="truncate text-xs font-medium text-[#2E286C]/60">
                      {student.levelLabel}
                    </div>
                  </ModulePanel>
                  <ModulePanel className="rounded-2xl p-3">
                    <InfoField
                      label={labels.nextLesson}
                      value={student.nextLessonLabel}
                      valueClassName="truncate"
                    />
                    <div className="truncate text-xs font-medium text-[#2E286C]/60">
                      {labels.teacher}: {student.instructorLabel}
                    </div>
                  </ModulePanel>
                </div>

                <div className="mt-auto pt-2">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/60">
                      {labels.progress}
                    </span>
                    <span className="text-xs font-bold text-[#533089]">
                      %{student.progress}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#8C6CE6] to-[#533089]"
                      style={{ width: `${student.progress}%` }}
                    />
                  </div>
                </div>
              </ModulePanel>
            );
            return linkToDetail ? (
              <Link
                href={`/admin/students/${student.studentId}`}
                key={student.enrollmentId}
              >
                {card}
              </Link>
            ) : (
              <div key={student.enrollmentId}>{card}</div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={UsersRound}
          title={students.length ? labels.noMatches : labels.emptyTitle}
          description={students.length ? '' : labels.emptyDescription}
          className="m-4 min-h-[24rem] lg:m-6"
        />
      )}
    </ModulePanel>
  );
}

function statusDotClass(status: AdminStudentCard['status']) {
  if (status === 'active') return 'bg-emerald-500';
  if (status === 'graduated') return 'bg-blue-500';
  if (status === 'cancelled') return 'bg-red-500';
  return 'bg-amber-500';
}
