// Shared setup for the Unity sample-scene suite: a port of the Python integration tests in
// AltTester-Unity-SDK-Closed-Source (Bindings~/python/tests/integration), run against sampleGame built
// from sdk-package. Same environment variables as the Python conftest.
import { AltDriver, By } from '../../../src/binding';

export const Scenes = {
  Scene01: 'Scene 1 AltDriverTestScene',
  Scene02: 'Scene 2 Draggable Panel',
  Scene03: 'Scene 3 Drag And Drop',
  Scene05: 'Scene 5 Keyboard Input',
  Scene07A: 'Scene 7 New Input System Actions',
  Scene07B: 'Scene 7 Drag And Drop NIS',
  Scene09: 'scene 9 NIS',
  Scene10: 'Scene 10 Sample NIS',
} as const;

export const host = process.env.ALTSERVER_HOST ?? '127.0.0.1';
export const port = Number(process.env.ALTSERVER_PORT ?? 13000);
export const appName = process.env.ALTSERVER_APP_NAME ?? '__default__';
export const platformVersion = process.env.ALTSERVER_PLATFORM_VERSION ?? 'unknown';

/** One driver per test file, like the Python class-scoped fixture. */
export function connectDriver(): Promise<AltDriver> {
  return AltDriver.connect({ host, port, appName, platformVersion, connectTimeout: 180 });
}

/** Closes the AltTester popup in the sample game, as the Python setup does. */
export async function closeAltTesterPopup(driver: AltDriver): Promise<void> {
  await (await driver.findObject(By.PATH, '/AltTesterPrefab//CloseButton', By.NAME, '', false)).tap();
}

export const sleep = (seconds: number) => new Promise<void>((r) => setTimeout(r, seconds * 1000));
