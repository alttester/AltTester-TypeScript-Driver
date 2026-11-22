// Runs before each e2e test file (vitest.e2e.config.ts, setupFiles). When a test fails, it attaches the game screenshot
// and the file's driver log to that test in the Allure report. A screenshot that can't be taken, for example because the
// test stopped its driver, becomes a "not available" note instead.
import { beforeEach } from 'vitest';
import { attachFailureEvidence } from '../../src/allure';
import { currentDriver, driverLog } from './unity/setup';

beforeEach((context) => {
  context.onTestFailed(() => attachFailureEvidence(currentDriver(), { log: driverLog }));
});
