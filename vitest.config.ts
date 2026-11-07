import { defineConfig } from 'vitest/config';

// Node environment on purpose: the driver must run outside the browser (KTD10).
// test/e2e needs a running sample game and has its own config (vitest.e2e.config.ts).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    exclude: ['test/e2e/**', 'node_modules/**'],
  },
});
