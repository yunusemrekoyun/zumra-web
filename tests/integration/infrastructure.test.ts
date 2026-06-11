import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { Queue } from 'bullmq';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import Redis from 'ioredis';
import { Client } from 'pg';
import { afterEach, describe, expect, it } from 'vitest';
import { ensureJobScheduled } from '@/lib/server/queues/ensure-job';
import { tryAcquireAdvisoryLock } from '@/lib/server/db/advisory-lock';
import { waitForRedisReady } from '@/lib/server/redis/client';
import { auth } from '@/lib/server/auth';
import { getNotificationQueue } from '@/lib/server/queues/notifications';
import { notificationService } from '@/lib/server/services/notifications';

const integration = process.env.RUN_INTEGRATION_TESTS === 'true'
  ? describe
  : describe.skip;
const clients: Client[] = [];
const redisClients: Redis[] = [];

function databaseClient(connectionString: string | undefined) {
  if (!connectionString) {
    throw new Error('Integration database URL is missing.');
  }

  const client = new Client({ connectionString });
  clients.push(client);
  return client;
}

afterEach(async () => {
  await Promise.all(
    clients.splice(0).map((client) => client.end().catch(() => undefined)),
  );
  await Promise.all(
    redisClients.splice(0).map((client) => client.quit().catch(() => undefined)),
  );
});

integration('local infrastructure', () => {
  it('connects with separated PostgreSQL roles', async () => {
    const expectedRoles = [
      ['application', process.env.DATABASE_URL, process.env.APP_DB_USER],
      ['migration', process.env.MIGRATION_DATABASE_URL, process.env.POSTGRES_USER],
      ['backup', process.env.BACKUP_DATABASE_URL, process.env.BACKUP_DB_USER],
    ] as const;

    for (const [name, url, expectedRole] of expectedRoles) {
      const client = databaseClient(url);
      await client.connect();
      const result = await client.query<{ current_user: string }>(
        'select current_user',
      );
      expect(result.rows[0]?.current_user, name).toBe(expectedRole);
      await client.end();
      clients.splice(clients.indexOf(client), 1);
    }
  });

  it('revokes sessions after a sensitive identity change', async () => {
    const client = databaseClient(process.env.DATABASE_URL);
    const userId = `integration-${randomUUID()}`;
    const sessionId = `integration-${randomUUID()}`;
    await client.connect();
    await client.query('begin');

    try {
      await client.query(
        `insert into users
          (id, name, email, email_verified, role, account_status)
         values ($1, 'Integration User', $2, true, 'student', 'active')`,
        [userId, `${userId}@example.invalid`],
      );
      await client.query(
        `insert into sessions
          (id, expires_at, token, user_id, security_level)
         values ($1, now() + interval '1 hour', $2, $3, 'standard')`,
        [sessionId, randomUUID(), userId],
      );
      await client.query(
        "update users set account_status='suspended' where id=$1",
        [userId],
      );
      const result = await client.query<{ count: string }>(
        'select count(*) from sessions where user_id=$1',
        [userId],
      );
      expect(Number(result.rows[0]?.count)).toBe(0);
    } finally {
      await client.query('rollback');
    }
  });

  it('removes Google identity data when a student role changes', async () => {
    const client = databaseClient(process.env.DATABASE_URL);
    const userId = `integration-${randomUUID()}`;
    const googleAccountId = `google-${randomUUID()}`;
    await client.connect();
    await client.query('begin');

    try {
      await client.query(
        `insert into users
          (id, name, email, email_verified, role, account_status)
         values ($1, 'Google Integration User', $2, true, 'student', 'active')`,
        [userId, `${userId}@example.invalid`],
      );
      await client.query(
        `insert into accounts
          (id, account_id, provider_id, user_id)
         values ($1, $2, 'google', $3)`,
        [randomUUID(), googleAccountId, userId],
      );
      await client.query(
        `insert into external_identities
          (user_id, provider, provider_account_id, verified_email, display_name)
         values ($1, 'google', $2, $3, 'Google Integration User')`,
        [userId, googleAccountId, `${userId}@example.invalid`],
      );
      await client.query(
        `insert into sessions
          (id, expires_at, token, user_id, security_level)
         values ($1, now() + interval '1 hour', $2, $3, 'standard')`,
        [randomUUID(), randomUUID(), userId],
      );

      await client.query("update users set role='advisor' where id=$1", [
        userId,
      ]);

      const result = await client.query<{
        google_accounts: string;
        google_identities: string;
        sessions: string;
      }>(
        `select
          (select count(*) from accounts
           where user_id=$1 and provider_id='google') as google_accounts,
          (select count(*) from external_identities
           where user_id=$1 and provider='google') as google_identities,
          (select count(*) from sessions
           where user_id=$1) as sessions`,
        [userId],
      );

      expect(result.rows[0]).toEqual({
        google_accounts: '0',
        google_identities: '0',
        sessions: '0',
      });
    } finally {
      await client.query('rollback');
    }
  });

  it('revokes sessions when MFA or credential passwords change', async () => {
    const client = databaseClient(process.env.DATABASE_URL);
    const userId = `integration-${randomUUID()}`;
    await client.connect();
    await client.query('begin');

    try {
      await client.query(
        `insert into users
          (id, name, email, email_verified, role, account_status)
         values ($1, 'Integration MFA User', $2, true, 'admin', 'active')`,
        [userId, `${userId}@example.invalid`],
      );
      await client.query(
        `insert into accounts
          (id, account_id, provider_id, user_id, password)
         values ($1, $2, 'credential', $2, 'old-hash')`,
        [randomUUID(), userId],
      );
      await client.query(
        `insert into sessions
          (id, expires_at, token, user_id, security_level)
         values ($1, now() + interval '1 hour', $2, $3, 'mfa')`,
        [randomUUID(), randomUUID(), userId],
      );
      await client.query(
        'update users set two_factor_enabled=true where id=$1',
        [userId],
      );
      let result = await client.query<{ count: string }>(
        'select count(*) from sessions where user_id=$1',
        [userId],
      );
      expect(Number(result.rows[0]?.count)).toBe(0);

      await client.query(
        `insert into sessions
          (id, expires_at, token, user_id, security_level)
         values ($1, now() + interval '1 hour', $2, $3, 'mfa')`,
        [randomUUID(), randomUUID(), userId],
      );
      await client.query(
        "update accounts set password='new-hash' where user_id=$1 and provider_id='credential'",
        [userId],
      );
      result = await client.query<{ count: string }>(
        'select count(*) from sessions where user_id=$1',
        [userId],
      );
      expect(Number(result.rows[0]?.count)).toBe(0);
    } finally {
      await client.query('rollback');
    }
  });

  it('keeps the backup role narrowly writable', async () => {
    const client = databaseClient(process.env.BACKUP_DATABASE_URL);
    await client.connect();
    const result = await client.query<{
      can_insert_backup_run: boolean;
      can_update_media_verification: boolean;
      can_update_user: boolean;
    }>(
      `select
        has_table_privilege(current_user, 'backup_runs', 'INSERT')
          as can_insert_backup_run,
        has_column_privilege(
          current_user,
          'media_assets',
          'backup_verified_at',
          'UPDATE'
        ) as can_update_media_verification,
        has_table_privilege(current_user, 'users', 'UPDATE')
          as can_update_user`,
    );

    expect(result.rows[0]).toEqual({
      can_insert_backup_run: true,
      can_update_media_verification: true,
      can_update_user: false,
    });
  });

  it('connects to Redis with the scoped application user', async () => {
    if (!process.env.REDIS_URL) {
      throw new Error('REDIS_URL is missing.');
    }

    const client = new Redis(process.env.REDIS_URL, {
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    redisClients.push(client);
    await client.connect();
    await expect(client.ping()).resolves.toBe('PONG');

    const allowedKey = `zumra:integration-acl:${randomUUID()}`;
    await expect(client.set(allowedKey, 'ok')).resolves.toBe('OK');
    await expect(
      client.set(`outside:${randomUUID()}`, 'blocked'),
    ).rejects.toThrow(/NOPERM/);
    await client.del(allowedKey);

    const redisUrl = new URL(process.env.REDIS_URL);
    const unauthenticatedClient = new Redis({
      enableOfflineQueue: false,
      host: redisUrl.hostname,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      port: Number(redisUrl.port || 6379),
      retryStrategy: null,
    });
    redisClients.push(unauthenticatedClient);
    const authError = new Promise<Error>((resolve) => {
      unauthenticatedClient.once('error', resolve);
    });
    const connectionAttempt = unauthenticatedClient
      .connect()
      .catch(() => undefined);

    await expect(authError).resolves.toMatchObject({
      message: expect.stringMatching(/NOAUTH/),
    });
    await connectionAttempt;
  });

  it('waits for one lazy Redis connection across concurrent requests', async () => {
    if (!process.env.REDIS_URL) {
      throw new Error('REDIS_URL is missing.');
    }

    const client = new Redis(process.env.REDIS_URL, {
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    redisClients.push(client);

    await Promise.all(
      Array.from({ length: 10 }, () => waitForRedisReady(client)),
    );

    expect(client.status).toBe('ready');
    await expect(client.ping()).resolves.toBe('PONG');
  });

  it('reconnects a Redis client after it reaches the end state', async () => {
    if (!process.env.REDIS_URL) {
      throw new Error('REDIS_URL is missing.');
    }

    const client = new Redis(process.env.REDIS_URL, {
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    redisClients.push(client);

    await client.connect();
    const ended = new Promise<void>((resolve) => {
      client.once('end', resolve);
    });
    client.disconnect(false);
    await ended;
    expect(client.status).toBe('end');

    await waitForRedisReady(client);

    expect(client.status).toBe('ready');
    await expect(client.ping()).resolves.toBe('PONG');
  });

  it('releases media advisory locks when processing ownership ends', async () => {
    const key = `integration-media-${randomUUID()}`;
    const releaseFirst = await tryAcquireAdvisoryLock(key);

    expect(releaseFirst).toBeTypeOf('function');
    await expect(tryAcquireAdvisoryLock(key)).resolves.toBeNull();

    await releaseFirst?.();
    const releaseSecond = await tryAcquireAdvisoryLock(key);

    expect(releaseSecond).toBeTypeOf('function');
    await releaseSecond?.();
  });

  it('creates a database-backed session for username login', async () => {
    const client = databaseClient(process.env.DATABASE_URL);
    const userId = randomUUID();
    const username = `integration.${randomUUID().slice(0, 12)}`;
    const password = `Integration-${randomUUID()}`;

    await client.connect();
    await client.query(
      `insert into users
        (id, name, email, email_verified, username, display_username, role, account_status)
       values ($1, 'Integration Login', $2, true, $3, $3, 'student', 'active')`,
      [userId, `${userId}@example.invalid`, username],
    );
    await client.query(
      `insert into accounts
        (id, account_id, provider_id, user_id, password)
       values ($1, $2, 'credential', $2, $3)`,
      [randomUUID(), userId, await hashPassword(password)],
    );

    try {
      const signIn = () =>
        auth.handler(
        new Request(`${process.env.APP_URL}/api/auth/sign-in/username`, {
          body: JSON.stringify({ password, rememberMe: true, username }),
          headers: {
            'content-type': 'application/json',
            origin: process.env.APP_URL ?? 'http://localhost:3000',
            'user-agent': 'zumra-integration-test',
            'x-real-ip': '127.0.0.1',
          },
          method: 'POST',
        }),
      );

      const firstResponse = await signIn();
      const secondResponse = await signIn();

      expect(firstResponse.status).toBe(200);
      expect(secondResponse.status).toBe(200);

      const sessionResult = await client.query<{ id: string }>(
        'select id from sessions where user_id=$1',
        [userId],
      );
      expect(sessionResult.rowCount).toBe(1);
      expect(sessionResult.rows[0]?.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    } finally {
      await client.query('delete from users where id=$1', [userId]);
    }
  });

  it.skipIf(
    !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET,
  )('returns the signed OAuth state cookie for student Google linking', async () => {
    const client = databaseClient(process.env.DATABASE_URL);
    const userId = randomUUID();
    const username = `google.link.${randomUUID().slice(0, 10)}`;
    const password = `Google-Link-${randomUUID()}`;

    await client.connect();
    await client.query(
      `insert into users
        (id, name, email, email_verified, username, display_username, role, account_status)
       values ($1, 'Google Link Integration', $2, true, $3, $3, 'student', 'active')`,
      [userId, `${userId}@example.invalid`, username],
    );
    await client.query(
      `insert into accounts
        (id, account_id, provider_id, user_id, password)
       values ($1, $2, 'credential', $2, $3)`,
      [randomUUID(), userId, await hashPassword(password)],
    );

    try {
      const signInResponse = await auth.handler(
        new Request(`${process.env.APP_URL}/api/auth/sign-in/username`, {
          body: JSON.stringify({ password, rememberMe: true, username }),
          headers: {
            'content-type': 'application/json',
            origin: process.env.APP_URL ?? 'http://localhost:3000',
            'user-agent': 'zumra-google-link-integration-test',
            'x-real-ip': '127.0.0.1',
          },
          method: 'POST',
        }),
      );
      const sessionCookie = signInResponse.headers
        .get('set-cookie')
        ?.match(/(?:__Secure-)?zumra\.session_token=[^;]+/)?.[0];

      expect(signInResponse.status).toBe(200);
      expect(sessionCookie).toBeTruthy();

      const link = await auth.api.linkSocialAccount({
        body: {
          callbackURL: `${process.env.APP_URL}/tr/google-tamamla?mode=link`,
          disableRedirect: true,
          errorCallbackURL: `${process.env.APP_URL}/tr/ogrenci/profil?google=error`,
          provider: 'google',
        },
        headers: new Headers({
          cookie: sessionCookie ?? '',
          origin: process.env.APP_URL ?? 'http://localhost:3000',
          'x-real-ip': '127.0.0.1',
        }),
        returnHeaders: true,
      });

      const authorizationUrl = new URL(link.response.url);
      expect(authorizationUrl.origin).toBe('https://accounts.google.com');
      expect(authorizationUrl.pathname).toBe('/o/oauth2/v2/auth');
      expect(authorizationUrl.searchParams.get('scope')?.split(' ').sort()).toEqual(
        ['email', 'openid', 'profile'],
      );
      expect(link.headers.get('set-cookie')).toMatch(
        /(?:__Secure-)?zumra\.state=/,
      );
    } finally {
      await client.query(
        "delete from verifications where value like '%' || $1 || '%'",
        [userId],
      );
      await client.query('delete from users where id=$1', [userId]);
    }
  });

  it('rejects the current password during reset and revokes sessions after a real change', async () => {
    const client = databaseClient(process.env.DATABASE_URL);
    const userId = randomUUID();
    const token = randomUUID();
    const currentPassword = `Current-${randomUUID()}`;
    const nextPassword = `Next-${randomUUID()}`;

    await client.connect();
    await client.query(
      `insert into users
        (id, name, email, email_verified, username, display_username, role, account_status)
       values ($1, 'Reset Integration', $2, true, $3, $3, 'student', 'active')`,
      [userId, `${userId}@example.invalid`, `reset.${randomUUID().slice(0, 12)}`],
    );
    await client.query(
      `insert into accounts
        (id, account_id, provider_id, user_id, password)
       values ($1, $2, 'credential', $2, $3)`,
      [randomUUID(), userId, await hashPassword(currentPassword)],
    );
    await client.query(
      `insert into sessions
        (id, expires_at, token, user_id, security_level)
       values ($1, now() + interval '1 hour', $2, $3, 'standard')`,
      [randomUUID(), randomUUID(), userId],
    );
    await client.query(
      `insert into verifications
        (id, identifier, value, expires_at)
       values ($1, $2, $3, now() + interval '30 minutes')`,
      [randomUUID(), `reset-password:${token}`, userId],
    );

    const resetRequest = (newPassword: string) =>
      auth.handler(
        new Request(`${process.env.APP_URL}/api/auth/reset-password`, {
          body: JSON.stringify({ newPassword, token }),
          headers: {
            'content-type': 'application/json',
            origin: process.env.APP_URL ?? 'http://localhost:3000',
          },
          method: 'POST',
        }),
      );

    try {
      const samePasswordResponse = await resetRequest(currentPassword);
      expect(samePasswordResponse.status).toBe(400);
      await expect(samePasswordResponse.json()).resolves.toMatchObject({
        code: 'PASSWORD_SAME_AS_CURRENT',
      });

      let sessionResult = await client.query<{ count: string }>(
        'select count(*) from sessions where user_id=$1',
        [userId],
      );
      expect(Number(sessionResult.rows[0]?.count)).toBe(1);

      const changedPasswordResponse = await resetRequest(nextPassword);
      expect(changedPasswordResponse.status).toBe(200);

      const accountResult = await client.query<{ password: string }>(
        `select password from accounts
         where user_id=$1 and provider_id='credential'`,
        [userId],
      );
      expect(
        await verifyPassword({
          hash: accountResult.rows[0]?.password ?? '',
          password: nextPassword,
        }),
      ).toBe(true);

      sessionResult = await client.query<{ count: string }>(
        'select count(*) from sessions where user_id=$1',
        [userId],
      );
      expect(Number(sessionResult.rows[0]?.count)).toBe(0);
    } finally {
      await client.query(
        'delete from verifications where identifier=$1',
        [`reset-password:${token}`],
      );
      await client.query('delete from users where id=$1', [userId]);
    }
  });

  it('keeps duplicate deterministic dispatches as one live Redis job', async () => {
    if (!process.env.REDIS_URL) {
      throw new Error('REDIS_URL is missing.');
    }

    const redisUrl = new URL(process.env.REDIS_URL);
    const queue = new Queue(`integration-${randomUUID()}`, {
      connection: {
        host: redisUrl.hostname,
        maxRetriesPerRequest: null,
        password: decodeURIComponent(redisUrl.password),
        port: Number(redisUrl.port || 6379),
        username: decodeURIComponent(redisUrl.username),
      },
      prefix: 'zumra',
    });

    try {
      await queue.waitUntilReady();
      const input = {
        data: { outboxId: randomUUID() },
        jobId: `outbox-${randomUUID()}`,
        name: 'deliver-outbox',
      };
      const first = await ensureJobScheduled(queue, input);
      const second = await ensureJobScheduled(queue, input);

      expect(second.id).toBe(first.id);
      expect(await queue.getWaitingCount()).toBe(1);
    } finally {
      await queue.obliterate({ force: true });
      await queue.close();
    }
  });

  it('creates one durable outbox row under concurrent idempotent dispatch', async () => {
    const client = databaseClient(process.env.DATABASE_URL);
    const idempotencyKey = `integration-outbox-${randomUUID()}`;
    await client.connect();

    try {
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          notificationService.enqueue({
            channel: 'email',
            idempotencyKey,
            locale: 'tr',
            payload: { name: 'Integration' },
            recipient: 'integration@example.invalid',
            sensitivePayload: {
              activationUrl: 'http://localhost:3000/tr/aktivasyon?token=test',
            },
            templateKey: 'account-invitation',
          }),
        ),
      );
      const ids = new Set(results.map((result) => result.outboxId));
      const count = await client.query<{ count: string }>(
        'select count(*) from notification_outbox where idempotency_key=$1',
        [idempotencyKey],
      );

      expect(ids.size).toBe(1);
      expect(Number(count.rows[0]?.count)).toBe(1);
    } finally {
      const result = await client.query<{ id: string }>(
        'delete from notification_outbox where idempotency_key=$1 returning id',
        [idempotencyKey],
      );
      const queue = getNotificationQueue();

      for (const row of result.rows) {
        await queue
          .getJob(`outbox-${row.id}`)
          .then((job) => job?.remove())
          .catch(() => undefined);
      }
    }
  });
});
