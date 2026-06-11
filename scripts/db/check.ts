import 'dotenv/config';

import { Client } from 'pg';

async function main() {
  const urls = [
    ['application', process.env.DATABASE_URL],
    ['migration', process.env.MIGRATION_DATABASE_URL],
    ['backup', process.env.BACKUP_DATABASE_URL],
  ] as const;

  for (const [name, connectionString] of urls) {
    if (!connectionString) {
      throw new Error(`${name} database URL is missing.`);
    }

    const client = new Client({
      application_name: `zumra-${name}-check`,
      connectionString,
    });

    try {
      await client.connect();
      const result = await client.query<{ current_user: string }>(
        'select current_user',
      );
      console.log(`${name}: ${result.rows[0]?.current_user ?? 'unknown'}`);
    } finally {
      await client.end();
    }
  }
}

void main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : 'Database role check failed.',
  );
  process.exitCode = 1;
});
