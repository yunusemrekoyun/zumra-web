'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Download,
  FileText,
  HardDrive,
  Image as ImageIcon,
  Music,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, PageHeader, StatusChip } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type {
  StorageFile,
  StorageOverview,
  UserStorageDetail,
} from '@/lib/server/services/storage-admin';

const ROLE_FILTERS = ['all', 'student', 'teacher', 'advisor', 'admin'] as const;

const KIND_META: Record<string, { color: string; icon: LucideIcon }> = {
  audio: { color: '#F59E0B', icon: Music },
  document: { color: '#64748B', icon: FileText },
  image: { color: '#10B981', icon: ImageIcon },
  video: { color: '#533089', icon: Video },
};

function kindMeta(kind: string) {
  return KIND_META[kind] ?? { color: '#94A3B8', icon: FileText };
}

function formatBytes(value: number): string {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(value) / Math.log(1024)),
  );
  return `${(value / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function StorageClient({ overview }: { overview: StorageOverview }) {
  const t = useTranslations('admin.storage');
  const locale = useLocale();
  const router = useRouter();
  const [tab, setTab] = useState<'biggest' | 'oldest' | 'orphans'>('orphans');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('all');
  const [userDetail, setUserDetail] = useState<UserStorageDetail | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { disk } = overview;
  const otherBytes = Math.max(0, disk.usedBytes - overview.managedBytes);
  const pct = (n: number) =>
    disk.totalBytes ? (n / disk.totalBytes) * 100 : 0;

  async function deleteFile(id: string) {
    if (deleting || !window.confirm(t('deleteConfirm'))) return;
    setDeleting(id);
    try {
      const response = await fetch(`/api/admin/media/${id}`, {
        credentials: 'same-origin',
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('delete_failed');
      router.refresh();
    } finally {
      setDeleting(null);
    }
  }

  async function openUser(userId: string) {
    if (loadingUser) return;
    setLoadingUser(true);
    setCurrentUserId(userId);
    setSelected(new Set());
    try {
      const response = await fetch(`/api/admin/storage/users/${userId}`, {
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error('detail_failed');
      setUserDetail((await response.json()) as UserStorageDetail);
    } catch {
      setUserDetail(null);
    } finally {
      setLoadingUser(false);
    }
  }

  async function deleteInDetail(fileId: string) {
    if (!window.confirm(t('deleteConfirm'))) return;
    const response = await fetch(`/api/admin/media/${fileId}`, {
      credentials: 'same-origin',
      method: 'DELETE',
    });
    if (response.ok) {
      if (currentUserId) await openUser(currentUserId);
      router.refresh();
    }
  }

  function toggleSelect(fileId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }

  const visibleUsers = overview.byUser.filter(
    (row) => userRole === 'all' || row.role === userRole,
  );

  const files: Record<typeof tab, StorageFile[]> = {
    biggest: overview.biggest,
    oldest: overview.oldest,
    orphans: overview.orphans,
  };

  return (
    <div className="workspace-page space-y-4">
      <PageHeader title={t('title')} description={t('description')} />

      {/* Disk kullanımı */}
      <Card padded>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#533089]/8 text-[#533089]">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-[#2E286C]">{t('diskUsage')}</div>
              <div className="text-xs font-medium text-[#2E286C]/45">
                {t('usedOfTotal', {
                  used: formatBytes(disk.usedBytes),
                  total: formatBytes(disk.totalBytes),
                })}
              </div>
            </div>
          </div>
          <div className="text-2xl font-rosmatika font-medium text-[#2E286C]">
            %{disk.percent}
          </div>
        </div>

        <div className="mt-4 flex h-4 w-full overflow-hidden rounded-full bg-[#F1F0F7]">
          <div
            className="h-full bg-[#533089]"
            style={{ width: `${pct(overview.managedBytes)}%` }}
            title={t('zumraMedia')}
          />
          <div
            className="h-full bg-[#CBD5E1]"
            style={{ width: `${pct(otherBytes)}%` }}
            title={t('otherUsage')}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold">
          <Legend color="#533089" label={t('zumraMedia')} value={formatBytes(overview.managedBytes)} />
          <Legend color="#CBD5E1" label={t('otherUsage')} value={formatBytes(otherBytes)} />
          <Legend color="#F1F0F7" label={t('free')} value={formatBytes(disk.freeBytes)} border />
        </div>
      </Card>

      {/* KPI'lar */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label={t('totalFiles')} value={String(overview.fileCount)} />
        <Kpi label={t('managedSpace')} value={formatBytes(overview.managedBytes)} />
        <Kpi
          label={t('cleanable')}
          value={formatBytes(overview.orphanBytes)}
          hint={t('cleanableHint', { count: overview.orphans.length })}
          tone="amber"
        />
      </div>

      {/* Tür dağılımı */}
      <Card padded>
        <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[#2E286C]/40">
          {t('byKind')}
        </h3>
        <div className="mt-4 space-y-3">
          {overview.byKind.map((row) => {
            const meta = kindMeta(row.kind);
            const max = overview.byKind[0]?.bytes || 1;
            return (
              <div key={row.kind} className="flex items-center gap-3">
                <meta.icon className="h-4 w-4 shrink-0" style={{ color: meta.color }} />
                <div className="w-24 shrink-0 text-sm font-bold text-[#2E286C]">
                  {t(`kinds.${row.kind}`)}
                </div>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#F1F0F7]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: meta.color,
                      width: `${(row.bytes / max) * 100}%`,
                    }}
                  />
                </div>
                <div className="w-28 shrink-0 text-right text-xs font-semibold text-[#2E286C]/55">
                  {formatBytes(row.bytes)} · {row.count}
                </div>
              </div>
            );
          })}
          {!overview.byKind.length && (
            <p className="text-sm font-medium text-[#2E286C]/40">{t('empty')}</p>
          )}
        </div>
      </Card>

      {/* Kullanıcı bazında */}
      <Card padded>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[#2E286C]/40">
            {t('byUser')}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {ROLE_FILTERS.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setUserRole(role)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                  userRole === role
                    ? 'bg-[#533089] text-white'
                    : 'bg-[#F1F0F7] text-[#2E286C]/55 hover:text-[#2E286C]',
                )}
              >
                {t(`roles.${role}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 space-y-1.5">
          {visibleUsers.slice(0, 30).map((row, index) => {
            const max = visibleUsers[0]?.bytes || 1;
            return (
              <button
                key={row.userId ?? index}
                type="button"
                onClick={() => row.userId && openUser(row.userId)}
                disabled={!row.userId}
                className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-[#F8F7FB] disabled:cursor-default disabled:hover:bg-transparent"
              >
                <div className="w-44 shrink-0 truncate text-sm font-bold text-[#2E286C]">
                  {row.name ?? t('unknownUser')}
                  {row.role && (
                    <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#2E286C]/35">
                      {t(`roles.${row.role}`)}
                    </span>
                  )}
                </div>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#F1F0F7]">
                  <div
                    className="h-full rounded-full bg-[#533089]"
                    style={{ width: `${(row.bytes / max) * 100}%` }}
                  />
                </div>
                <div className="w-28 shrink-0 text-right text-xs font-semibold text-[#2E286C]/55">
                  {formatBytes(row.bytes)} · {row.count}
                </div>
              </button>
            );
          })}
          {!visibleUsers.length && (
            <p className="text-sm font-medium text-[#2E286C]/40">{t('empty')}</p>
          )}
        </div>
      </Card>

      {/* Dosya listeleri */}
      <Card padded>
        <div className="flex flex-wrap gap-2">
          {(['orphans', 'biggest', 'oldest'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                'rounded-full px-4 py-2 text-xs font-bold transition-colors',
                tab === key
                  ? 'bg-[#533089] text-white'
                  : 'bg-[#F1F0F7] text-[#2E286C]/60 hover:text-[#2E286C]',
              )}
            >
              {t(`tabs.${key}`)}
            </button>
          ))}
        </div>

        {tab === 'orphans' && (
          <p className="mt-4 text-xs font-medium text-amber-600">
            {t('orphansHint')}
          </p>
        )}

        <div className="mt-4 space-y-2">
          {files[tab].map((file) => {
            const meta = kindMeta(file.kind);
            return (
              <div
                key={file.id}
                className="flex items-center gap-3 rounded-2xl border border-black/[0.03] p-3"
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
                >
                  <meta.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-[#2E286C]">
                    {file.name}
                  </div>
                  <div className="mt-0.5 truncate text-xs font-medium text-[#2E286C]/40">
                    {(file.ownerName ?? t('unknownUser')) +
                      ' · ' +
                      new Intl.DateTimeFormat(locale, {
                        dateStyle: 'medium',
                        timeZone: 'Europe/Istanbul',
                      }).format(new Date(file.createdAt))}
                  </div>
                </div>
                <div className="shrink-0 text-sm font-bold text-[#2E286C]">
                  {formatBytes(file.sizeBytes)}
                </div>
                {tab === 'orphans' && (
                  <button
                    type="button"
                    onClick={() => deleteFile(file.id)}
                    disabled={deleting === file.id}
                    aria-label={t('delete')}
                    className="shrink-0 rounded-xl p-2 text-red-500/70 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
          {!files[tab].length && (
            <p className="py-4 text-center text-sm font-medium text-[#2E286C]/40">
              {tab === 'orphans' ? t('noOrphans') : t('empty')}
            </p>
          )}
        </div>
      </Card>

      {userDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setUserDetail(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-rosmatika text-xl font-medium text-[#2E286C]">
                  {userDetail.name ?? t('unknownUser')}
                </h3>
                <p className="mt-1 text-sm font-medium text-[#2E286C]/50">
                  {(userDetail.role
                    ? t(`roles.${userDetail.role}`) + ' · '
                    : '') +
                    formatBytes(userDetail.totalBytes) +
                    ' · ' +
                    t('userFileCount', { count: userDetail.files.length })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUserDetail(null)}
                aria-label={t('close')}
                className="rounded-full p-1.5 text-[#2E286C]/40 transition-colors hover:bg-black/5 hover:text-[#2E286C]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {userDetail.byKind.map((row) => (
                <span
                  key={row.kind}
                  className="rounded-full bg-[#F1F0F7] px-3 py-1 text-xs font-semibold text-[#2E286C]/60"
                >
                  {t(`kinds.${row.kind}`)}: {formatBytes(row.bytes)} · {row.count}
                </span>
              ))}
            </div>

            {userDetail.files.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSelected((current) =>
                      current.size === userDetail.files.length
                        ? new Set()
                        : new Set(userDetail.files.map((file) => file.id)),
                    )
                  }
                  className="text-xs font-bold text-[#533089]"
                >
                  {selected.size === userDetail.files.length
                    ? t('clearSelection')
                    : t('selectAll')}
                </button>
                <a
                  href={`/api/admin/storage/download?ids=${[...selected].join(',')}`}
                  onClick={(event) => {
                    if (!selected.size) event.preventDefault();
                  }}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors',
                    selected.size
                      ? 'bg-[#533089] text-white'
                      : 'cursor-not-allowed bg-[#F1F0F7] text-[#2E286C]/30',
                  )}
                >
                  <Download className="h-4 w-4" />
                  {t('downloadZip', { count: selected.size })}
                </a>
              </div>
            )}

            <div className="mt-3 space-y-2">
              {userDetail.files.map((file) => {
                const meta = kindMeta(file.kind);
                return (
                  <div
                    key={file.id}
                    className="flex items-center gap-2.5 rounded-2xl border border-black/[0.03] p-2.5"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(file.id)}
                      onChange={() => toggleSelect(file.id)}
                      className="h-4 w-4 shrink-0 accent-[#533089]"
                    />
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: `${meta.color}1a`,
                        color: meta.color,
                      }}
                    >
                      <meta.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-[#2E286C]">
                        {file.name}
                      </div>
                      <div className="text-[11px] font-semibold text-[#2E286C]/40">
                        {formatBytes(file.sizeBytes)}
                      </div>
                    </div>
                    <a
                      href={`/api/media/${file.id}`}
                      download={file.name}
                      aria-label={t('download')}
                      className="shrink-0 rounded-lg p-1.5 text-[#2E286C]/50 transition-colors hover:bg-[#F1F0F7] hover:text-[#533089]"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                    {file.referenced ? (
                      <span className="shrink-0 rounded-full bg-[#F1F0F7] px-2 py-1 text-[10px] font-bold text-[#2E286C]/40">
                        {t('inUse')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => deleteInDetail(file.id)}
                        aria-label={t('delete')}
                        className="shrink-0 rounded-lg p-1.5 text-red-500/70 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
              {!userDetail.files.length && (
                <p className="py-3 text-center text-sm font-medium text-[#2E286C]/40">
                  {t('empty')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Legend({
  border,
  color,
  label,
  value,
}: {
  border?: boolean;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <span className="flex items-center gap-1.5 text-[#2E286C]/60">
      <span
        className={cn('h-2.5 w-2.5 rounded-sm', border && 'border border-black/10')}
        style={{ backgroundColor: color }}
      />
      {label} <span className="text-[#2E286C]/40">{value}</span>
    </span>
  );
}

function Kpi({
  hint,
  label,
  tone,
  value,
}: {
  hint?: string;
  label: string;
  tone?: 'amber';
  value: string;
}) {
  return (
    <Card padded>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-[#2E286C]/50">{label}</p>
        {tone === 'amber' && <StatusChip tone="amber">●</StatusChip>}
      </div>
      <div
        className={cn(
          'mt-1 text-3xl font-rosmatika font-medium',
          tone === 'amber' ? 'text-amber-600' : 'text-[#2E286C]',
        )}
      >
        {value}
      </div>
      {hint && (
        <p className="mt-1 text-xs font-medium text-[#2E286C]/40">{hint}</p>
      )}
    </Card>
  );
}
