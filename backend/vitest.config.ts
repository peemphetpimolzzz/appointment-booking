import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60_000,
    // Integration tests share one Postgres database; run files serially to keep
    // the overlap assertions deterministic.
    fileParallelism: false,
  },
});
