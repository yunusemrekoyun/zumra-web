import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: 'server-only',
        replacement: path.resolve(__dirname, 'tests/server-only.ts'),
      },
      {
        find: '@',
        replacement: path.resolve(__dirname),
      },
    ],
    conditions: ['react-server', 'node'],
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
