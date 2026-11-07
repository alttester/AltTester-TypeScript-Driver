import { defineConfig } from 'vitest/config';

// Live tests against real apps through a running AltServer / AltTester Desktop (see test/live/README.md).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/live/**/*.live.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
