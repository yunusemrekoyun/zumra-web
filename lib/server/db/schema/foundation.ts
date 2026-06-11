import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth';

export const invitationStatusEnum = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'expired',
  'revoked',
]);

export const mediaStatusEnum = pgEnum('media_status', [
  'uploading',
  'uploaded',
  'scanning',
  'processing',
  'ready',
  'failed',
  'quarantined',
]);

export const mediaKindEnum = pgEnum('media_kind', ['image', 'video', 'document', 'audio']);
export const mediaVisibilityEnum = pgEnum('media_visibility', ['private', 'public']);
export const externalIdentityProviderEnum = pgEnum(
  'external_identity_provider',
  ['google'],
);
export const outboxStatusEnum = pgEnum('outbox_status', [
  'pending',
  'queued',
  'processing',
  'sent',
  'failed',
  'dead',
]);
export const backupRunStatusEnum = pgEnum('backup_run_status', [
  'running',
  'succeeded',
  'failed',
]);
export const backupKindEnum = pgEnum('backup_kind', [
  'logical',
  'physical_full',
  'physical_differential',
  'wal',
  'restic',
  'restic_check',
  'restic_forget',
  'restic_prune',
  'restore_drill',
]);

export const userInvitations = pgTable(
  'user_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    username: text('username').notNull(),
    name: text('name').notNull(),
    role: text('role').notNull(),
    status: invitationStatusEnum('status').notNull().default('pending'),
    tokenHash: text('token_hash').notNull(),
    invitedByUserId: text('invited_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('user_invitations_token_hash_unique').on(table.tokenHash),
    index('user_invitations_email_idx').on(table.email),
    index('user_invitations_status_expires_idx').on(table.status, table.expiresAt),
  ],
);

export const trustedDevices = pgTable(
  'trusted_devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deviceIdHash: text('device_id_hash').notNull(),
    label: text('label'),
    userAgentHash: text('user_agent_hash'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('trusted_devices_user_device_unique').on(table.userId, table.deviceIdHash),
    index('trusted_devices_expires_idx').on(table.expiresAt),
  ],
);

export const externalIdentities = pgTable(
  'external_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: externalIdentityProviderEnum('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    verifiedEmail: text('verified_email').notNull(),
    displayName: text('display_name').notNull(),
    givenName: text('given_name'),
    familyName: text('family_name'),
    avatarUrl: text('avatar_url'),
    providerLocale: text('provider_locale'),
    linkedAt: timestamp('linked_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSignInAt: timestamp('last_sign_in_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('external_identities_user_provider_unique').on(
      table.userId,
      table.provider,
    ),
    uniqueIndex('external_identities_provider_account_unique').on(
      table.provider,
      table.providerAccountId,
    ),
    index('external_identities_verified_email_idx').on(table.verifiedEmail),
  ],
);

export const securityChallenges = pgTable(
  'security_challenges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionId: text('session_id'),
    purpose: text('purpose').notNull(),
    secretHash: text('secret_hash').notNull(),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('security_challenges_user_purpose_idx').on(table.userId, table.purpose),
    index('security_challenges_expires_idx').on(table.expiresAt),
  ],
);

export const securityEvents = pgTable(
  'security_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    type: text('type').notNull(),
    severity: text('severity').notNull(),
    result: text('result').notNull(),
    requestId: text('request_id'),
    maskedIp: text('masked_ip'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('security_events_user_created_idx').on(table.userId, table.createdAt),
    index('security_events_type_created_idx').on(table.type, table.createdAt),
  ],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id'),
    result: text('result').notNull(),
    requestId: text('request_id').notNull(),
    maskedIp: text('masked_ip'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_logs_actor_created_idx').on(table.actorUserId, table.createdAt),
    index('audit_logs_target_idx').on(table.targetType, table.targetId),
  ],
);

export const mediaAssets = pgTable(
  'media_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    kind: mediaKindEnum('kind').notNull(),
    visibility: mediaVisibilityEnum('visibility').notNull().default('private'),
    status: mediaStatusEnum('status').notNull().default('uploading'),
    originalName: text('original_name').notNull(),
    sourcePath: text('source_path'),
    outputPath: text('output_path'),
    thumbnailPath: text('thumbnail_path'),
    mimeType: text('mime_type'),
    sizeBytes: bigint('size_bytes', { mode: 'number' }),
    checksumSha256: text('checksum_sha256'),
    durationSeconds: numeric('duration_seconds', { precision: 10, scale: 3 }),
    width: integer('width'),
    height: integer('height'),
    processingAttempts: integer('processing_attempts').notNull().default(0),
    processingGeneration: integer('processing_generation').notNull().default(0),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lockedBy: text('locked_by'),
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
    errorCode: text('error_code'),
    sourceDeleteAfter: timestamp('source_delete_after', { withTimezone: true }),
    quarantineDeleteAfter: timestamp('quarantine_delete_after', { withTimezone: true }),
    backupVerifiedAt: timestamp('backup_verified_at', { withTimezone: true }),
    backupSnapshotId: text('backup_snapshot_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('media_assets_owner_created_idx').on(table.ownerUserId, table.createdAt),
    index('media_assets_status_idx').on(table.status),
    index('media_assets_status_lease_idx').on(table.status, table.leaseExpiresAt),
  ],
);

export const notificationOutbox = pgTable(
  'notification_outbox',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    idempotencyKey: text('idempotency_key').notNull(),
    channel: text('channel').notNull(),
    templateKey: text('template_key').notNull(),
    recipient: text('recipient').notNull(),
    locale: text('locale').notNull().default('tr'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    encryptedPayload: text('encrypted_payload'),
    status: outboxStatusEnum('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    availableAt: timestamp('available_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    providerMessageId: text('provider_message_id'),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lockedBy: text('locked_by'),
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('notification_outbox_idempotency_unique').on(table.idempotencyKey),
    index('notification_outbox_status_available_idx').on(table.status, table.availableAt),
    index('notification_outbox_status_lease_idx').on(table.status, table.leaseExpiresAt),
  ],
);

export const backupRuns = pgTable(
  'backup_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: backupKindEnum('kind').notNull(),
    status: backupRunStatusEnum('status').notNull().default('running'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    sizeBytes: bigint('size_bytes', { mode: 'number' }),
    snapshotId: text('snapshot_id'),
    errorSummary: text('error_summary'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => [
    index('backup_runs_kind_started_idx').on(table.kind, table.startedAt),
    index('backup_runs_status_idx').on(table.status),
  ],
);

export const workerHeartbeats = pgTable(
  'worker_heartbeats',
  {
    workerId: text('worker_id').primaryKey(),
    workerType: text('worker_type').notNull(),
    hostname: text('hostname').notNull(),
    processId: integer('process_id').notNull(),
    version: text('version').notNull(),
    releaseId: text('release_id').notNull().default('development'),
    healthy: boolean('healthy').notNull().default(true),
    activeJobs: integer('active_jobs').notNull().default(0),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('worker_heartbeats_type_seen_idx').on(table.workerType, table.lastSeenAt),
  ],
);
