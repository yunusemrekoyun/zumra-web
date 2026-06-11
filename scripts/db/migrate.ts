import 'dotenv/config';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

async function main() {
  const connectionString = process.env.MIGRATION_DATABASE_URL;

  if (!connectionString) {
    throw new Error('MIGRATION_DATABASE_URL is required.');
  }

  const pool = new Pool({
    application_name: 'zumra-migrator',
    connectionString,
  });

  try {
    await migrate(drizzle(pool), {
      migrationsFolder: './drizzle',
    });
    console.log('Database migrations completed.');
  } finally {
    await pool.end();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Migration failed.');
  process.exitCode = 1;
});
