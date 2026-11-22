import { rmSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// End-to-end suites against AltTester's own sample games (see test/e2e/README.md). Never part of `npm test`.
// Files run one at a time: they all drive the same app.
//
// Every run writes Allure results to allure-results/ (`npm run report` turns them into allure-report/). Failed tests
// get the game screenshot and the driver log (test/e2e/allure.setup.ts). The folder is emptied first, because Allure
// adds to whatever is already in it.
const ALLURE_RESULTS = 'allure-results';
rmSync(ALLURE_RESULTS, { recursive: true, force: true });

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/e2e/**/*.e2e.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 200_000,
    fileParallelism: false,
    sequence: { concurrent: false },
    setupFiles: ['allure-vitest/setup', 'test/e2e/allure.setup.ts'],
    reporters: ['default', ['allure-vitest/reporter', { resultsDir: ALLURE_RESULTS }]],
  },
});
