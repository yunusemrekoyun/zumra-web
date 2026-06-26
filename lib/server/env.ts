import 'server-only';

import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

const nodeEnv = z
  .enum(['development', 'test', 'production'])
  .default('development');

const runtimeEnvSchema = z.object({
  NODE_ENV: nodeEnv,
  DATABASE_URL: z.string().url(),
  DATABASE_SSL_MODE: z
    .enum(['disable', 'require', 'verify-full'])
    .default('disable'),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(30).default(5),
  REDIS_URL: z.string().url(),
  MEDIA_ROOT: z.string().min(1).default('.data/media'),
  MEDIA_MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(100 * 1024 * 1024),
  MEDIA_MAX_IMAGE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 1024 * 1024),
  MEDIA_MAX_DOCUMENT_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(25 * 1024 * 1024),
  MEDIA_MAX_AUDIO_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(16 * 1024 * 1024),
  MEDIA_PER_USER_QUOTA_BYTES: z.coerce
    .number()
    .int()
    .min(0)
    .default(1024 * 1024 * 1024),
  MEDIA_DISK_WARN_PERCENT: z.coerce.number().int().min(1).max(99).default(70),
  MEDIA_DISK_BLOCK_PERCENT: z.coerce.number().int().min(2).max(100).default(85),
  CLAMAV_HOST: z.string().min(1).default('127.0.0.1'),
  CLAMAV_PORT: z.coerce.number().int().positive().default(3310),
  FFMPEG_PATH: z.string().min(1).default('ffmpeg'),
  FFPROBE_PATH: z.string().min(1).default('ffprobe'),
  FFMPEG_JOB_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
  FFMPEG_SANDBOX_MODE: z.enum(['direct', 'filesystem']).default('direct'),
  MEDIA_JOB_ROOT: z.string().min(1).default('.data/media-jobs'),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(1),
  RELEASE_ID: z.string().min(1).default('development'),
});

const authEnvSchema = z
  .object({
    NODE_ENV: nodeEnv,
    APP_URL: z.string().url(),
    BETTER_AUTH_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(48),
    AUTH_ENFORCEMENT_ENABLED: booleanString.default(false),
    // Demo-only: when true, non-admin sign-ins skip device verification (email
    // OTP) so seeded accounts with placeholder emails can reach their panels
    // directly. MUST stay false (unset) in real production — it disables a
    // security layer for every non-admin user.
    DEMO_TRUST_DEVICES: booleanString.default(false),
    DEVICE_COOKIE_SECRET: z.string().min(48),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    READINESS_TOKEN: z.string().min(32),
  })
  .superRefine((value, context) => {
    if (Boolean(value.GOOGLE_CLIENT_ID) !== Boolean(value.GOOGLE_CLIENT_SECRET)) {
      context.addIssue({
        code: 'custom',
        message:
          'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured together.',
        path: [
          value.GOOGLE_CLIENT_ID
            ? 'GOOGLE_CLIENT_SECRET'
            : 'GOOGLE_CLIENT_ID',
        ],
      });
    }
  });

const googleMeetEnvSchema = z
  .object({
    GOOGLE_MEET_ENABLED: booleanString.default(false),
    GOOGLE_MEET_IMPERSONATED_USER: z.string().email().optional(),
    GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL: z.string().email().optional(),
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().min(1).optional(),
    GOOGLE_SERVICE_ACCOUNT_PROJECT_ID: z.string().min(1).optional(),
  })
  .superRefine((value, context) => {
    if (!value.GOOGLE_MEET_ENABLED) {
      return;
    }

    for (const key of [
      'GOOGLE_MEET_IMPERSONATED_USER',
      'GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL',
      'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
      'GOOGLE_SERVICE_ACCOUNT_PROJECT_ID',
    ] as const) {
      if (!value[key]) {
        context.addIssue({
          code: 'custom',
          message: `${key} is required when GOOGLE_MEET_ENABLED is true.`,
          path: [key],
        });
      }
    }
  });

const mailEnvSchema = z.object({
  NODE_ENV: nodeEnv,
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_REQUIRE_TLS: booleanString.default(false),
  SMTP_SECURE: booleanString.default(false),
  SMTP_FROM: z.string().min(3),
  SMTP_RELAY_USER: z.string().optional(),
  SMTP_RELAY_PASSWORD: z.string().optional(),
});

const outboxEnvSchema = z.object({
  OUTBOX_ENCRYPTION_SECRET: z.string().min(48).optional(),
});

const identityEnvSchema = z.object({
  IDENTITY_ENCRYPTION_SECRET: z.string().min(48).optional(),
});

export type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;
export type AuthEnv = z.infer<typeof authEnvSchema>;
export type GoogleMeetEnv = z.infer<typeof googleMeetEnvSchema>;
export type MailEnv = z.infer<typeof mailEnvSchema>;
export type OutboxEnv = {
  OUTBOX_ENCRYPTION_SECRET: string;
};
export type IdentityEnv = {
  IDENTITY_ENCRYPTION_SECRET: string;
};
export type ServerEnv = RuntimeEnv & AuthEnv & OutboxEnv;

let cachedRuntimeEnv: RuntimeEnv | undefined;
let cachedAuthEnv: AuthEnv | undefined;
let cachedGoogleMeetEnv: GoogleMeetEnv | undefined;
let cachedMailEnv: MailEnv | undefined;
let cachedOutboxEnv: OutboxEnv | undefined;
let cachedIdentityEnv: IdentityEnv | undefined;

export function getRuntimeEnv(): RuntimeEnv {
  cachedRuntimeEnv ??= parseEnv(
    runtimeEnvSchema,
    'runtime',
    productionBuildDefaults,
  );

  if (
    cachedRuntimeEnv.MEDIA_DISK_WARN_PERCENT >=
    cachedRuntimeEnv.MEDIA_DISK_BLOCK_PERCENT
  ) {
    throw new Error(
      'MEDIA_DISK_WARN_PERCENT must be lower than MEDIA_DISK_BLOCK_PERCENT.',
    );
  }

  return cachedRuntimeEnv;
}

export function getAuthEnv(): AuthEnv {
  cachedAuthEnv ??= parseEnv(authEnvSchema, 'auth', productionBuildDefaults);

  if (
    cachedAuthEnv.NODE_ENV === 'production' &&
    !cachedAuthEnv.AUTH_ENFORCEMENT_ENABLED &&
    process.env.NEXT_PHASE !== 'phase-production-build'
  ) {
    throw new Error('AUTH_ENFORCEMENT_ENABLED must be true in production.');
  }

  return cachedAuthEnv;
}

/**
 * Whether auth/session cookies must use the Secure attribute (and the
 * __Host-/__Secure- name prefixes). Tied to the actual transport scheme rather
 * than NODE_ENV so a production build served over http://localhost (local smoke
 * test) still works, while real https deployments stay fully secure.
 */
export function cookiesAreSecure(): boolean {
  return getAuthEnv().BETTER_AUTH_URL.startsWith('https://');
}

export function isGoogleAuthConfigured() {
  const env = getAuthEnv();
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function getGoogleMeetEnv(): GoogleMeetEnv {
  cachedGoogleMeetEnv ??= parseEnv(
    googleMeetEnvSchema,
    'google meet',
    productionBuildDefaults,
  );
  return cachedGoogleMeetEnv;
}

export function isGoogleMeetConfigured() {
  return getGoogleMeetEnv().GOOGLE_MEET_ENABLED;
}

export function getMailEnv(): MailEnv {
  cachedMailEnv ??= parseEnv(mailEnvSchema, 'mail');
  return cachedMailEnv;
}

export function getOutboxEnv(): OutboxEnv {
  if (cachedOutboxEnv) {
    return cachedOutboxEnv;
  }

  const parsed = parseEnv(
    outboxEnvSchema,
    'outbox',
    productionBuildDefaults,
  );
  const fallback =
    process.env.NODE_ENV === 'production'
      ? undefined
      : process.env.BETTER_AUTH_SECRET;
  const secret = parsed.OUTBOX_ENCRYPTION_SECRET ?? fallback;

  if (!secret || secret.length < 48) {
    throw new Error(
      'OUTBOX_ENCRYPTION_SECRET must be at least 48 characters.',
    );
  }

  cachedOutboxEnv = { OUTBOX_ENCRYPTION_SECRET: secret };
  return cachedOutboxEnv;
}

export function getIdentityEnv(): IdentityEnv {
  if (cachedIdentityEnv) {
    return cachedIdentityEnv;
  }

  const parsed = parseEnv(
    identityEnvSchema,
    'identity',
    productionBuildDefaults,
  );
  const fallback =
    process.env.NODE_ENV === 'production'
      ? undefined
      : process.env.BETTER_AUTH_SECRET;
  const secret = parsed.IDENTITY_ENCRYPTION_SECRET ?? fallback;

  if (!secret || secret.length < 48) {
    throw new Error(
      'IDENTITY_ENCRYPTION_SECRET must be at least 48 characters.',
    );
  }

  cachedIdentityEnv = { IDENTITY_ENCRYPTION_SECRET: secret };
  return cachedIdentityEnv;
}

export function getServerEnv(): ServerEnv {
  return {
    ...getRuntimeEnv(),
    ...getAuthEnv(),
    ...getOutboxEnv(),
  };
}

export function resetServerEnvForTests() {
  cachedRuntimeEnv = undefined;
  cachedAuthEnv = undefined;
  cachedGoogleMeetEnv = undefined;
  cachedMailEnv = undefined;
  cachedOutboxEnv = undefined;
  cachedIdentityEnv = undefined;
}

function parseEnv<T extends z.ZodType>(
  schema: T,
  label: string,
  defaults?: Record<string, string>,
): z.infer<T> {
  const result = schema.safeParse({
    ...defaults,
    ...process.env,
  });

  if (!result.success) {
    const fields = result.error.issues
      .map((issue) => issue.path.join('.'))
      .join(', ');
    throw new Error(`Invalid ${label} environment variables: ${fields}`);
  }

  return result.data;
}

const productionBuildDefaults =
  process.env.NEXT_PHASE === 'phase-production-build'
    ? {
        APP_URL: 'http://build.invalid',
        AUTH_ENFORCEMENT_ENABLED: 'true',
        BETTER_AUTH_SECRET:
          'build-placeholder-build-placeholder-build-placeholder',
        BETTER_AUTH_URL: 'http://build.invalid',
        DATABASE_SSL_MODE: 'disable',
        DATABASE_URL: 'postgresql://build:build@127.0.0.1:5432/build',
        DEVICE_COOKIE_SECRET:
          'build-device-placeholder-build-device-placeholder',
        IDENTITY_ENCRYPTION_SECRET:
          'build-identity-placeholder-build-identity-placeholder',
        OUTBOX_ENCRYPTION_SECRET:
          'build-outbox-placeholder-build-outbox-placeholder',
        READINESS_TOKEN: 'build-readiness-placeholder-token',
        REDIS_URL: 'redis://build:build@127.0.0.1:6379',
      }
    : undefined;
