// @alttester/driver/allure: puts AltTester material into an Allure report.
//
// Optional. It needs the `allure-js-commons` package (version 3) and an Allure adapter for your test runner, such as
// allure-vitest, allure-mocha, allure-jest, allure-playwright or @wdio/allure-reporter. The attachments go to
// whichever test is running when they are called. The rest of the driver never imports this file, so users who do not
// use Allure need neither package.
//
//   const log = createLogRecorder();
//   const driver = await AltDriver.connect({ ..., enableLogging: log });
//   // when a test fails:
//   await attachFailureEvidence(driver, { log });

import { attachment } from 'allure-js-commons';
import type { AltDriver } from '../binding/AltDriver';
import type { AltObject } from '../binding/AltObject';
import type { AltDriverLogger } from '../binding/logger';

/** A logger that keeps the driver's log in memory, so it can be attached to a report instead of printed. */
export interface AltLogRecorder extends AltDriverLogger {
  /** The recorded lines, oldest first, one line per message. */
  text(): string;
  clear(): void;
}

/**
 * Pass the result to `AltDriver.connect({ enableLogging })`. Keeps the last `maxLines` messages (default 500), each
 * with its time and level. The driver logs connection events, the SDK version check, reconnects and wait retries, but
 * not every command.
 */
export function createLogRecorder(maxLines = 500): AltLogRecorder {
  const lines: string[] = [];
  const record = (level: string) => (message: string) => {
    lines.push(`${new Date().toISOString()} ${level.padEnd(5)} ${message}`);
    if (lines.length > maxLines) lines.splice(0, lines.length - maxLines);
  };
  return {
    debug: record('DEBUG'),
    info: record('INFO'),
    warn: record('WARN'),
    error: record('ERROR'),
    text: () => lines.join('\n'),
    clear: () => {
      lines.length = 0;
    },
  };
}

function imageType(bytes: Uint8Array): string {
  // getPNGScreenshot returns PNG from Unity, but the Unreal SDK (1.2.x) sends JPEG bytes.
  return bytes[0] === 0xff && bytes[1] === 0xd8 ? 'image/jpeg' : 'image/png';
}

/** Attaches a full-resolution screenshot of the game, as the game renders it. */
export async function attachScreenshot(driver: AltDriver, name = 'Game screenshot (AltTester)'): Promise<void> {
  const bytes = await driver.getPNGScreenshot();
  await attachment(name, bytes, imageType(bytes));
}

/** Attaches a screenshot with `object` outlined in red. */
export async function attachHighlightedScreenshot(
  driver: AltDriver,
  object: AltObject | number,
  name = 'Highlighted object (AltTester)',
): Promise<void> {
  const shot = await driver.getHighlightedScreenshot(object);
  await attachment(name, shot.compressedImage, { contentType: 'image/jpeg', encoding: 'base64' });
}

/** Attaches every object in the loaded scenes as JSON (getAllLoadedScenesAndObjects). It can be large in big scenes. */
export async function attachHierarchy(driver: AltDriver, name = 'Loaded scenes and objects (AltTester)'): Promise<void> {
  const rows = await driver.getAllLoadedScenesAndObjects();
  await attachment(name, JSON.stringify(rows, null, 2), 'application/json');
}

/** Attaches the log kept by a recorder from createLogRecorder(). */
export async function attachLog(log: AltLogRecorder, name = 'AltTester driver log'): Promise<void> {
  await attachment(name, log.text() || '(empty)', 'text/plain');
}

export interface FailureEvidenceOptions {
  /** The recorder passed to `AltDriver.connect({ enableLogging })`; its log is attached. */
  log?: AltLogRecorder;
  /** An object to outline in an extra screenshot, for example the one the test was acting on. */
  object?: AltObject | number;
  /** Also attach every loaded object as JSON (default false, because it can be large). */
  hierarchy?: boolean;
}

/**
 * Attaches what helps explain a failed test: a game screenshot and, when asked for, the driver log, a screenshot with
 * `object` outlined, and the hierarchy. Each item is collected on its own. One that can't be collected, for example
 * because the app has crashed or the driver is not connected, becomes a short "not available" note and does not stop
 * the others. It never throws, so it is safe in an after-test hook.
 */
export async function attachFailureEvidence(driver: AltDriver | undefined, options: FailureEvidenceOptions = {}): Promise<void> {
  const connected = (): AltDriver => {
    if (!driver) throw new Error('The AltDriver is not connected.');
    return driver;
  };
  await collect('Game screenshot (AltTester)', () => attachScreenshot(connected()));
  const { object, hierarchy, log } = options;
  if (object !== undefined) await collect('Highlighted object (AltTester)', () => attachHighlightedScreenshot(connected(), object));
  if (hierarchy) await collect('Loaded scenes and objects (AltTester)', () => attachHierarchy(connected()));
  if (log) await collect('AltTester driver log', () => attachLog(log));
}

async function collect(name: string, attach: () => Promise<void>): Promise<void> {
  try {
    await attach();
  } catch (error) {
    try {
      await attachment(`${name}: not available`, error instanceof Error ? error.message : String(error), 'text/plain');
    } catch {
      // No Allure runtime is active (the test runner has no Allure adapter), so there is nothing to attach to.
    }
  }
}
