import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'admin',
  'advisor',
  'teacher',
  'student',
]);

export const accountStatusEnum = pgEnum('account_status', [
  'pending',
  'active',
  'suspended',
  'archived',
]);

export const sessionSecurityLevelEnum = pgEnum('session_security_level', [
  'pending',
  'standard',
  'fresh',
  'mfa',
]);

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    username: text('username'),
    displayUsername: text('display_username'),
    role: userRoleEnum('role').notNull().default('student'),
    accountStatus: accountStatusEnum('account_status').notNull().default('pending'),
    banned: boolean('banned').notNull().default(false),
    banReason: text('ban_reason'),
    banExpires: timestamp('ban_expires', { withTimezone: true }),
    twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
  },
  (table) => [
    uniqueIndex('users_email_unique').on(table.email),
    uniqueIndex('users_username_unique').on(table.username),
    index('users_role_idx').on(table.role),
    index('users_account_status_idx').on(table.accountStatus),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    impersonatedBy: text('impersonated_by'),
    securityLevel: sessionSecurityLevelEnum('security_level').notNull().default('pending'),
    lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
    deviceId: text('device_id'),
  },
  (table) => [
    uniqueIndex('sessions_token_unique').on(table.token),
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_expires_at_idx').on(table.expiresAt),
  ],
);

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('accounts_user_id_idx').on(table.userId),
    uniqueIndex('accounts_provider_account_unique').on(table.providerId, table.accountId),
  ],
);

export const verifications = pgTable(
  'verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('verifications_identifier_idx').on(table.identifier),
    index('verifications_expires_at_idx').on(table.expiresAt),
  ],
);

export const twoFactors = pgTable(
  'two_factors',
  {
    id: text('id').primaryKey(),
    secret: text('secret').notNull(),
    backupCodes: text('backup_codes').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    verified: boolean('verified').notNull().default(true),
  },
  (table) => [
    index('two_factors_secret_idx').on(table.secret),
    index('two_factors_user_id_idx').on(table.userId),
  ],
);
