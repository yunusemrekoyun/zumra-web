import 'dotenv/config';

import { defineConfig } from 'drizzle-kit';

const migrationUrl = process.env.MIGRATION_DATABASE_URL;

if (!migrationUrl) {
  throw new Error('MIGRATION_DATABASE_URL is required for Drizzle commands.');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/server/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: migrationUrl,
  },
  casing: 'snake_case',
  strict: true,
  verbose: true,
});
