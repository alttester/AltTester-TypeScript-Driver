// Port of TestNotification.cs (TestNotification) from AltTester-Unity-SDK-Closed-Source sdk-package/Assets/Examples/Test/Editor/Driver
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  AltLogLevel,
  By,
  NotificationType,
  type AltDriver,
  type LoadSceneNotificationResult,
  type LogNotificationResult,
} from '../../../src/binding';
import { connectDriver, Scenes, sleep } from './setup';

/** Port of MockClasses/MockNotificationCallBacks.cs (static fields, shared by the whole class). */
const MockNotificationCallBacks = {
  lastSceneLoaded: '',
  lastSceneUnloaded: '',
  logMessage: '',
  logLevel: AltLogLevel.Error as number,
  stackTrace: '',
  applicationPaused: false,
  sceneLoadedCallback(result: LoadSceneNotificationResult): void {
    MockNotificationCallBacks.lastSceneLoaded = result.sceneName;
  },
  sceneUnloadedCallback(sceneName: string): void {
    MockNotificationCallBacks.lastSceneUnloaded = sceneName;
  },
  logCallback(result: LogNotificationResult): void {
    MockNotificationCallBacks.logMessage = result.message;
    MockNotificationCallBacks.logLevel = result.level;
    MockNotificationCallBacks.stackTrace = result.stackTrace;
  },
  applicationPausedCallback(applicationPaused: boolean): void {
    MockNotificationCallBacks.applicationPaused = applicationPaused;
  },
};

/**
 * C# waitForNotificationToBeSent receives the field's value (a string copy), so it can only time out or pass at once;
 * this polls the live value, which is what the C# helper means to do.
 */
async function waitForNotificationToBeSent(getValue: () => string, expectedValue: string, timeout: number): Promise<void> {
  while (getValue() !== expectedValue) {
    await sleep(0.2);
    timeout -= 0.2;
    if (timeout <= 0) throw new Error('Notification variable not set to the desired value in time');
  }
}

describe('TestNotification', () => {
  let altDriver: AltDriver;

  // [OneTimeSetUp]
  beforeAll(async () => {
    altDriver = await connectDriver();
    await altDriver.addNotificationListener(NotificationType.LOADSCENE, MockNotificationCallBacks.sceneLoadedCallback, true);
    await altDriver.addNotificationListener(
      NotificationType.UNLOADSCENE, MockNotificationCallBacks.sceneUnloadedCallback, true);
    await altDriver.addNotificationListener(NotificationType.LOG, MockNotificationCallBacks.logCallback, true);
    await altDriver.addNotificationListener(
      NotificationType.APPLICATION_PAUSED, MockNotificationCallBacks.applicationPausedCallback, true);
    // C# also sets DriverLogManager's Console and Unity loggers to Info; that is driver-side logging only.
  });

  // [OneTimeTearDown]
  afterAll(async () => {
    if (!altDriver) return;
    await altDriver.removeNotificationListener(NotificationType.LOADSCENE);
    await altDriver.removeNotificationListener(NotificationType.UNLOADSCENE);
    await altDriver.removeNotificationListener(NotificationType.LOG);
    await altDriver.removeNotificationListener(NotificationType.APPLICATION_PAUSED);
    await altDriver.stop();
  });

  // [SetUp] LoadLevel
  beforeEach(async () => {
    await altDriver.resetInput();
    await altDriver.loadScene(Scenes.Scene01, true);
  });

  it('TestLoadSceneNotification', async () => {
    await waitForNotificationToBeSent(() => MockNotificationCallBacks.lastSceneLoaded, 'Scene 1 AltDriverTestScene', 10);
    expect(MockNotificationCallBacks.lastSceneLoaded).toBe('Scene 1 AltDriverTestScene');
  });

  it('TestUnloadSceneNotification', async () => {
    await altDriver.loadScene('Scene 2 Draggable Panel', false);
    await altDriver.unloadScene('Scene 2 Draggable Panel');
    await waitForNotificationToBeSent(() => MockNotificationCallBacks.lastSceneUnloaded, 'Scene 2 Draggable Panel', 10);
    expect(MockNotificationCallBacks.lastSceneUnloaded).toBe('Scene 2 Draggable Panel');
  });

  it('TestLogNotification', async () => {
    // The SDK logs "response sent" for loadScene only after sending the response, so LoadScene can
    // return before that log's notification arrives. Until then the last log is from the scene load
    // (e.g. the dummy click's "Creating touch at" warning).
    let timeout = 10;
    while (!MockNotificationCallBacks.logMessage.includes('"commandName":"loadScene') && timeout > 0) {
      await sleep(0.2);
      timeout -= 0.2;
    }
    expect(MockNotificationCallBacks.logMessage).toContain('"commandName":"loadScene');
    expect(MockNotificationCallBacks.logLevel).toBe(AltLogLevel.Debug);
  });

  // [Ignore("Testing")]
  it.skip('TestApplicationPaused', async () => {
    const altElement = await altDriver.findObject(By.NAME, 'AltTesterPrefab');
    await altElement.callComponentMethod<string>(
      'AltTester.AltTesterUnitySDK.Commands.AltRunner',
      'OnApplicationPause',
      'Assembly-CSharp',
      [true],
      ['System.Boolean'],
    );
    expect(MockNotificationCallBacks.applicationPaused).toBe(true);
  });
});
