import { defineConfig } from 'vitest/config';

// Node environment on purpose: the driver must run outside the browser (KTD10).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
});
