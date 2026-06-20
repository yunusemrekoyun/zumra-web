'use client';

import Image from 'next/image';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft,
  Archive,
  ArchiveRestore,
  BookOpenCheck,
  FileCheck2,
  Link2,
  Mail,
  Save,
  Upload,
} from 'lucide-react';
import {
  Button,
  InfoField,
  Input,
  ModulePanel,
  PageHeader,
  StatusChip,
} from '@/components/ui';
import { Link, useRouter } from '@/i18n/navigation';
import type { InstructorProfileView } from '@/lib/server/services/instructors';
import {
  editorPayload,
  InstructorFields,
  type InstructorEditorValue,
} from '../instructor-fields';

export function InstructorProfileClient({
  initial,
  locale,
}: {
  initial: InstructorProfileView;
  locale: string;
}) {
  const t = useTranslations('admin.instructors');
  const router = useRouter();
  const [profile, setProfile] = useState(initial);
  const [draft, setDraft] = useState<InstructorEditorValue>({
    biography: initial.biography ?? '',
    competencies: initial.competencies,
    email: initial.email,
    firstName: initial.firstName,
    internalNotes: initial.internalNotes ?? '',
    lastName: initial.lastName,
    phone: initial.phone,
    specialties: initial.specialties,
    status: initial.status,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [documentKind, setDocumentKind] =
    useState<'certificate' | 'identity' | 'contract' | 'other'>(
      'certificate',
    );
  const [documentLabel, setDocumentLabel] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [username, setUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  useEffect(() => {
    setProfile(initial);
  }, [initial]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/admin/instructors/${profile.id}`, {
        body: JSON.stringify(editorPayload(draft)),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'PATCH',
      });
      if (!response.ok) throw new Error('save_failed');
      setProfile((current) => ({
        ...current,
        ...editorPayload(draft),
        fullName: `${draft.firstName.trim()} ${draft.lastName.trim()}`,
      }));
      setMessage(t('saved'));
      router.refresh();
    } catch {
      setMessage(t('saveError'));
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhoto(file: File) {
    setBusy(true);
    setMessage('');
    try {
      const mediaAssetId = await uploadMedia(file, 'image');
      const response = await fetch(
        `/api/admin/instructors/${profile.id}/photo`,
        {
          body: JSON.stringify({ mediaAssetId }),
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        },
      );
      if (!response.ok) throw new Error('photo_failed');
      setProfile((current) => ({ ...current, photoMediaAssetId: mediaAssetId }));
      setMessage(t('photoSaved'));
    } catch {
      setMessage(t('uploadError'));
    } finally {
      setBusy(false);
    }
  }

  async function uploadDocument(event: FormEvent) {
    event.preventDefault();
    if (!documentFile || !documentLabel.trim()) return;
    setBusy(true);
    setMessage('');
    try {
      const mediaAssetId = await uploadMedia(
        documentFile,
        documentFile.type.startsWith('image/') ? 'image' : 'document',
      );
      const response = await fetch(
        `/api/admin/instructors/${profile.id}/documents`,
        {
          body: JSON.stringify({
            kind: documentKind,
            label: documentLabel,
            mediaAssetId,
          }),
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        },
      );
      if (!response.ok) throw new Error('document_failed');
      setDocumentFile(null);
      setDocumentLabel('');
      setMessage(t('documentSaved'));
      router.refresh();
    } catch {
      setMessage(t('uploadError'));
    } finally {
      setBusy(false);
    }
  }

  async function inviteInstructor(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(
        `/api/admin/instructors/${profile.id}/invitation`,
        {
          body: JSON.stringify({
            locale,
            password: adminPassword,
            username,
          }),
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(body.error ?? 'invite_failed'));
      setProfile((current) => ({
        ...current,
        invitation: {
          expiresAt: body.expiresAt,
          status: body.status,
          username: body.username,
        },
      }));
      setAdminPassword('');
      setMessage(t('invitationSent'));
    } catch (error) {
      setMessage(invitationErrorMessage(error, t));
    } finally {
      setBusy(false);
    }
  }

  async function resendInvitation() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(
        `/api/admin/instructors/${profile.id}/invitation`,
        {
          body: JSON.stringify({ locale, password: adminPassword }),
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          method: 'PUT',
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(body.error ?? 'invite_failed'));
      setProfile((current) => ({
        ...current,
        invitation: {
          expiresAt: body.expiresAt,
          status: body.status,
          username: body.username,
        },
      }));
      setAdminPassword('');
      setMessage(t('invitationResent'));
    } catch (error) {
      setMessage(invitationErrorMessage(error, t));
    } finally {
      setBusy(false);
    }
  }

  async function cancelInvitation() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(
        `/api/admin/instructors/${profile.id}/invitation`,
        {
          body: JSON.stringify({ password: adminPassword }),
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          method: 'DELETE',
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(body.error ?? 'invite_failed'));
      setProfile((current) => ({ ...current, invitation: undefined }));
      setAdminPassword('');
      setMessage(t('invitationCancelled'));
    } catch (error) {
      setMessage(invitationErrorMessage(error, t));
    } finally {
      setBusy(false);
    }
  }

  async function changeArchiveState(action: 'archive' | 'restore') {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(
        `/api/admin/instructors/${profile.id}/${action}`,
        {
          credentials: 'same-origin',
          method: 'POST',
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(body.error ?? 'archive_failed'));
      const nextStatus = action === 'archive' ? 'archived' : 'active';
      setProfile((current) => ({
        ...current,
        accountStatus:
          action === 'archive' ? 'suspended' : current.accountStatus,
        status: nextStatus,
      }));
      setDraft((current) => ({ ...current, status: nextStatus }));
      setMessage(action === 'archive' ? t('archived') : t('restored'));
      router.refresh();
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      setMessage(
        code === 'instructor_identity_conflict'
          ? t('restoreIdentityConflict')
          : t('archiveError'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-page">
      <PageHeader
        title={profile.fullName}
        description={t('profileDescription')}
        action={
          <Link
            href="/admin/instructors"
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-black/10 bg-white px-5 text-xs font-bold uppercase tracking-wider text-[#2E286C]"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('back')}
          </Link>
        }
      />

      {message && (
        <div className="mb-5 rounded-2xl bg-[#533089]/7 px-5 py-3 text-sm font-semibold text-[#533089]">
          {message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="space-y-6">
          <ModulePanel className="rounded-3xl text-center">
            <div className="relative mx-auto h-28 w-28 overflow-hidden rounded-full bg-[#533089]/10">
              {profile.photoMediaAssetId ? (
                <Image
                  src={`/api/media/${profile.photoMediaAssetId}`}
                  alt={profile.fullName}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-3xl font-bold text-[#533089]">
                  {initials(profile.fullName)}
                </div>
              )}
            </div>
            <h2 className="mt-4 text-lg font-bold text-[#2E286C]">
              {profile.fullName}
            </h2>
            <StatusChip
              className="mt-2"
              tone={statusTone(profile.status)}
            >
              {t(`statuses.${profile.status}`)}
            </StatusChip>
            <label className="mt-5 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-[11px] font-bold uppercase text-[#2E286C]">
              <Upload className="h-4 w-4" />
              {t('uploadPhoto')}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadPhoto(file);
                }}
              />
            </label>
            <div className="mt-3 flex justify-center">
              {profile.status === 'archived' ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void changeArchiveState('restore')}
                >
                  <ArchiveRestore className="h-4 w-4" />
                  {t('restoreInstructor')}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void changeArchiveState('archive')}
                >
                  <Archive className="h-4 w-4" />
                  {t('archiveInstructor')}
                </Button>
              )}
            </div>
            <div className="mt-6 space-y-4 border-t border-black/[0.04] pt-5 text-left">
              <InfoField label={t('fields.email')} value={profile.email} />
              <InfoField label={t('fields.phone')} value={profile.phone} />
              <InfoField
                label={t('panelAccount')}
                value={
                  profile.userId
                    ? profile.username ?? t('accountLinked')
                    : profile.invitation?.status === 'pending'
                      ? t('invitationPending')
                      : t('accountNotLinked')
                }
              />
            </div>
          </ModulePanel>

          <ModulePanel className="rounded-3xl">
            <div className="flex items-center gap-3">
              <BookOpenCheck className="h-5 w-5 text-[#533089]" />
              <h2 className="font-bold text-[#2E286C]">{t('branches')}</h2>
            </div>
            <div className="mt-4 space-y-3">
              {profile.branches.map((branch) => (
                <div key={branch.id} className="rounded-xl bg-[#F8F9FC] p-3">
                  <div className="text-sm font-bold text-[#2E286C]">
                    {branch.name}
                  </div>
                  <div className="mt-1 text-xs text-[#2E286C]/45">
                    {branch.programName}
                  </div>
                </div>
              ))}
              {!profile.branches.length && (
                <p className="text-xs font-medium text-[#2E286C]/40">
                  {t('noBranches')}
                </p>
              )}
            </div>
          </ModulePanel>
        </div>

        <div className="space-y-6">
          <ModulePanel className="rounded-3xl">
            <h2 className="text-lg font-bold text-[#2E286C]">
              {t('profileInformation')}
            </h2>
            <form className="mt-6" onSubmit={saveProfile}>
              <InstructorFields
                labels={fieldLabels(t)}
                value={draft}
                onChange={setDraft}
              />
              <Button type="submit" className="mt-5" disabled={busy}>
                <Save className="h-4 w-4" />
                {busy ? t('saving') : t('save')}
              </Button>
            </form>
          </ModulePanel>

          <div className="grid gap-6 lg:grid-cols-2">
            <ModulePanel className="rounded-3xl">
              <div className="flex items-center gap-3">
                <FileCheck2 className="h-5 w-5 text-[#533089]" />
                <h2 className="font-bold text-[#2E286C]">
                  {t('documents')}
                </h2>
              </div>
              <div className="mt-4 space-y-3">
                {profile.documents.map((document) => (
                  <a
                    key={document.id}
                    href={`/api/media/${document.mediaAssetId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl bg-[#F8F9FC] p-3"
                  >
                    <div className="text-sm font-bold text-[#2E286C]">
                      {document.label}
                    </div>
                    <div className="mt-1 text-xs text-[#2E286C]/45">
                      {document.originalName}
                    </div>
                  </a>
                ))}
              </div>
              <form className="mt-5 space-y-3" onSubmit={uploadDocument}>
                <Input
                  value={documentLabel}
                  onChange={(event) => setDocumentLabel(event.target.value)}
                  placeholder={t('documentLabel')}
                />
                <select
                  value={documentKind}
                  onChange={(event) =>
                    setDocumentKind(
                      event.target.value as typeof documentKind,
                    )
                  }
                  className="h-11 w-full rounded-xl bg-[#F8F9FC] px-4 text-sm text-[#2E286C]"
                >
                  {(
                    ['certificate', 'identity', 'contract', 'other'] as const
                  ).map((kind) => (
                    <option key={kind} value={kind}>
                      {t(`documentKinds.${kind}`)}
                    </option>
                  ))}
                </select>
                <Input
                  type="file"
                  accept=".pdf,image/jpeg,image/png"
                  onChange={(event) =>
                    setDocumentFile(event.target.files?.[0] ?? null)
                  }
                />
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={busy || !documentFile || !documentLabel.trim()}
                >
                  <Upload className="h-4 w-4" />
                  {t('uploadDocument')}
                </Button>
              </form>
            </ModulePanel>

            <ModulePanel className="rounded-3xl">
              <div className="flex items-center gap-3">
                <Link2 className="h-5 w-5 text-[#533089]" />
                <h2 className="font-bold text-[#2E286C]">
                  {t('panelAccount')}
                </h2>
              </div>
              {profile.userId ? (
                <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
                  {t('accountLinkedDescription')}
                </div>
              ) : profile.invitation?.status === 'pending' ? (
                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-700">
                    {t('invitationPendingDescription', {
                      username: profile.invitation.username,
                    })}
                  </div>
                  <p className="text-sm leading-6 text-[#2E286C]/55">
                    {t('invitationManageHint')}
                  </p>
                  <Input
                    type="password"
                    value={adminPassword}
                    onChange={(event) => setAdminPassword(event.target.value)}
                    placeholder={t('adminPassword')}
                    minLength={12}
                  />
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      disabled={busy || adminPassword.length < 12}
                      onClick={resendInvitation}
                    >
                      <Mail className="h-4 w-4" />
                      {t('resendInvitation')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy || adminPassword.length < 12}
                      onClick={cancelInvitation}
                    >
                      {t('cancelInvitation')}
                    </Button>
                  </div>
                </div>
              ) : (
                <form className="mt-5 space-y-3" onSubmit={inviteInstructor}>
                  <p className="text-sm leading-6 text-[#2E286C]/55">
                    {t('invitationDescription')}
                  </p>
                  <Input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder={t('username')}
                    minLength={5}
                  />
                  <Input
                    type="password"
                    value={adminPassword}
                    onChange={(event) => setAdminPassword(event.target.value)}
                    placeholder={t('adminPassword')}
                    minLength={12}
                  />
                  <Button
                    type="submit"
                    disabled={
                      busy || username.length < 5 || adminPassword.length < 12
                    }
                  >
                    <Mail className="h-4 w-4" />
                    {t('sendInvitation')}
                  </Button>
                </form>
              )}
            </ModulePanel>
          </div>
        </div>
      </div>
    </div>
  );
}

function invitationErrorMessage(
  error: unknown,
  t: ReturnType<typeof useTranslations>,
) {
  const code = error instanceof Error ? error.message : '';
  if (code === 'invitation_email_already_registered') {
    return t('invitationEmailRegistered');
  }
  if (code === 'invitation_already_pending') {
    return t('invitationAlreadyPending');
  }
  if (code === 'username_already_registered') {
    return t('invitationUsernameTaken');
  }
  if (code === 'invitation_username_already_pending') {
    return t('invitationUsernamePending');
  }
  if (code === 'invitation_not_pending') {
    return t('invitationNotPending');
  }
  if (code === 'invalid_username') {
    return t('invitationUsernameInvalid');
  }
  if (code === 'admin_session_required') {
    return t('invitationAdminSession');
  }
  if (code === 'forbidden') {
    return t('invitationForbidden');
  }
  if (
    code === 'instructor_account_unavailable' ||
    code === 'instructor_invitation_unavailable'
  ) {
    return t('invitationAccountUnavailable');
  }
  if (code === 'invalid_request' || code === 'invalid_invitation_target') {
    return t('invitationInvalid');
  }
  return t('invitationError');
}

async function uploadMedia(
  file: File,
  kind: 'document' | 'image',
): Promise<string> {
  const response = await fetch('/api/media', {
    body: file,
    credentials: 'same-origin',
    headers: {
      'x-file-name': file.name,
      'x-media-kind': kind,
      'x-media-visibility': 'private',
    },
    method: 'POST',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.id) throw new Error('upload_failed');
  return body.id;
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function statusTone(status: InstructorProfileView['status']) {
  if (status === 'active') return 'emerald' as const;
  if (status === 'on_leave') return 'amber' as const;
  if (status === 'archived') return 'red' as const;
  return 'gray' as const;
}

function fieldLabels(t: ReturnType<typeof useTranslations>) {
  return {
    biography: t('fields.biography'),
    email: t('fields.email'),
    firstName: t('fields.firstName'),
    internalNotes: t('fields.internalNotes'),
    languageLevels: t('fields.languageLevels'),
    languages: {
      arabic: t('languages.arabic'),
      english: t('languages.english'),
      french: t('languages.french'),
      german: t('languages.german'),
    },
    lastName: t('fields.lastName'),
    noLanguage: t('noLanguage'),
    phone: t('fields.phone'),
    specialties: t('fields.specialties'),
    specialtiesPlaceholder: t('fields.specialtiesPlaceholder'),
    status: t('fields.status'),
    statuses: {
      active: t('statuses.active'),
      archived: t('statuses.archived'),
      draft: t('statuses.draft'),
      inactive: t('statuses.inactive'),
      on_leave: t('statuses.on_leave'),
    },
  };
}
