import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { Client } from 'pg';

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim().toLowerCase();
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !username || !name || !password) {
    throw new Error(
      'BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_NAME and BOOTSTRAP_ADMIN_PASSWORD are required.',
    );
  }

  if (
    username.length < 5 ||
    username.length > 30 ||
    !/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/.test(username)
  ) {
    throw new Error('BOOTSTRAP_ADMIN_USERNAME is invalid.');
  }

  if (password.length < 12 || password.length > 128) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be 12-128 characters.');
  }

  const client = new Client({
    application_name: 'zumra-admin-bootstrap',
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();

  try {
    const existing = await client.query(
      'select id from users where email = $1 or username = $2 limit 1',
      [email, username],
    );

    if (existing.rowCount) {
      throw new Error('An account already exists for this email or username.');
    }

    const userId = randomUUID();
    const accountId = randomUUID();
    const passwordHash = await hashPassword(password);

    await client.query('begin');
    await client.query(
      `insert into users
        (id, name, email, email_verified, username, display_username, role, account_status, created_at, updated_at)
       values ($1, $2, $3, true, $4, $4, 'admin', 'active', now(), now())`,
      [userId, name, email, username],
    );
    await client.query(
      `insert into accounts
        (id, account_id, provider_id, user_id, password, created_at, updated_at)
       values ($1, $2, 'credential', $2, $3, now(), now())`,
      [accountId, userId, passwordHash],
    );
    await client.query('commit');
    console.log(`Admin account created: ${username}`);
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

void main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : 'Admin bootstrap failed.',
  );
  process.exitCode = 1;
});
