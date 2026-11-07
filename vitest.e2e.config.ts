import { defineConfig } from 'vitest/config';

// End-to-end suites against AltTester's own sample games (see test/e2e/README.md). Never part of `npm test`.
// Files run one at a time: they all drive the same app.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/e2e/**/*.e2e.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 200_000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
