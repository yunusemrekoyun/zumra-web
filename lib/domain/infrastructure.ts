import type { UserRole } from './types';

export type AccountStatus = 'pending' | 'active' | 'suspended' | 'archived';
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
export type SessionSecurityLevel = 'pending' | 'standard' | 'fresh' | 'mfa';
export type MediaStatus =
  | 'uploading'
  | 'uploaded'
  | 'scanning'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'quarantined';
export type MediaKind = 'image' | 'video' | 'document' | 'audio';
export type MediaVisibility = 'private' | 'public';
export type BackupRunStatus = 'running' | 'succeeded' | 'failed';
export type ExternalIdentityProvider = 'google';
export type BackupKind =
  | 'logical'
  | 'physical_full'
  | 'physical_differential'
  | 'wal'
  | 'restic'
  | 'restic_check'
  | 'restic_forget'
  | 'restic_prune'
  | 'restore_drill';

export type WorkspacePrincipal = {
  accountStatus: AccountStatus;
  email: string;
  id: string;
  name: string;
  role: UserRole;
  sessionCreatedAt: string;
  sessionId: string;
  sessionLastVerifiedAt?: string;
  sessionSecurityLevel: SessionSecurityLevel;
  twoFactorEnabled: boolean;
};

export type CreateInvitationInput = {
  email: string;
  locale: 'tr' | 'en';
  name: string;
  role: Exclude<UserRole, 'admin'>;
  username: string;
};

export type CreatedInvitation = {
  expiresAt: string;
  id: string;
  status: InvitationStatus;
  username: string;
};

export interface InvitationService {
  activate(token: string, password: string): Promise<{ userId: string }>;
  create(
    actor: WorkspacePrincipal,
    input: CreateInvitationInput,
  ): Promise<CreatedInvitation>;
  revoke(actor: WorkspacePrincipal, invitationId: string): Promise<void>;
}

export interface AuthorizationService {
  authorize(
    principal: WorkspacePrincipal,
    action: string,
    resource?: { advisorId?: string; ownerUserId?: string; teacherId?: string },
  ): Promise<boolean>;
  requireRole(
    principal: WorkspacePrincipal,
    roles: UserRole | UserRole[],
  ): Promise<void>;
}

export type GoogleIdentitySummary = {
  avatarUrl?: string;
  displayName: string;
  provider: 'google';
  providerLocale?: string;
  verifiedEmail: string;
};

export type GoogleIdentityStatus = {
  configured: boolean;
  identity?: GoogleIdentitySummary;
  linked: boolean;
};

export interface GoogleIdentityService {
  beginLink(
    student: WorkspacePrincipal,
    password: string,
    locale: 'tr' | 'en',
    headers: Headers,
  ): Promise<{ setCookies: string[]; url: string }>;
  getStatus(studentId: string): Promise<GoogleIdentityStatus>;
  syncLinkedIdentity(
    studentId: string,
    headers: Headers,
    mode: 'link' | 'signin',
  ): Promise<GoogleIdentitySummary>;
  unlink(
    student: WorkspacePrincipal,
    password: string,
    headers: Headers,
  ): Promise<void>;
}

export type MediaAssetRecord = {
  id: string;
  kind: MediaKind;
  mimeType?: string;
  originalName: string;
  ownerUserId: string;
  sizeBytes?: number;
  status: MediaStatus;
  visibility: MediaVisibility;
};

export interface MediaService {
  getAuthorizedAsset(
    principal: WorkspacePrincipal,
    mediaId: string,
  ): Promise<MediaAssetRecord | null>;
  queueProcessing(mediaId: string): Promise<void>;
}

export interface MediaAuthorizationService {
  canRead(
    principal: WorkspacePrincipal | null,
    asset: Pick<MediaAssetRecord, 'ownerUserId' | 'visibility'>,
  ): Promise<boolean>;
  canUpload(
    principal: WorkspacePrincipal,
    visibility: MediaVisibility,
  ): Promise<boolean>;
}

export type NotificationMessage = {
  channel: 'email' | 'whatsapp';
  idempotencyKey: string;
  locale: 'tr' | 'en';
  payload: Record<string, unknown>;
  recipient: string;
  sensitivePayload?: Record<string, unknown>;
  templateKey: string;
};

export interface NotificationService {
  enqueue(message: NotificationMessage): Promise<{ outboxId: string }>;
}

export type AuditEvent = {
  action: string;
  actorUserId?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
  requestId: string;
  result: 'success' | 'denied' | 'failed';
  targetId?: string;
  targetType: string;
};

export interface AuditService {
  record(event: AuditEvent): Promise<void>;
}

export type BackupRunSummary = {
  completedAt?: string;
  errorSummary?: string;
  id: string;
  kind: BackupKind;
  sizeBytes?: number;
  snapshotId?: string;
  startedAt: string;
  status: BackupRunStatus;
};

export interface BackupStatusService {
  listRecent(limit?: number): Promise<BackupRunSummary[]>;
}
