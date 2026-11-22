// Shared setup for the Unity sample-scene suite: a port of the C# integration tests in
// AltTester-Unity-SDK-Closed-Source (sdk-package/Assets/Examples/Test/Editor/Driver), run against sampleGame built
// from sdk-package. Same environment variables as TestsHelper.cs.
import { createLogRecorder } from '../../../src/allure';
import { AltDriver } from '../../../src/binding';

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

/** The driver log of the current test file. The Allure report gets it for each failed test (test/e2e/allure.setup.ts). */
export const driverLog = createLogRecorder();

let lastDriver: AltDriver | undefined;

/** The driver connectDriver() opened last in this test file, for the failure attachments. */
export function currentDriver(): AltDriver | undefined {
  return lastDriver;
}

/** One driver per test class, like TestBase's OneTimeSetUp. */
export async function connectDriver(): Promise<AltDriver> {
  lastDriver = await AltDriver.connect({ host, port, appName, platformVersion, connectTimeout: 180, enableLogging: driverLog });
  return lastDriver;
}

export const sleep = (seconds: number) => new Promise<void>((r) => setTimeout(r, seconds * 1000));
