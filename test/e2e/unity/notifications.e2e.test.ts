// Port of Bindings~/python/tests/integration/test_notifications.py
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  AltLogLevel,
  By,
  NotificationType,
  type AltDriver,
  type LoadSceneNotificationResult,
  type LogNotificationResult,
} from '../../../src/binding';
import { connectDriver, Scenes } from './setup';

class MockNotificationCallbacks {
  lastSceneLoaded = '';
  lastSceneUnloaded = '';
  logMessage = '';
  logType: number = AltLogLevel.Error;
  logStackTrace = '';
  applicationPaused = false;

  sceneLoadedCallback = (result: LoadSceneNotificationResult): void => {
    this.lastSceneLoaded = result.sceneName;
  };

  sceneUnloadedCallback = (sceneName: string): void => {
    this.lastSceneUnloaded = sceneName;
  };

  logCallback = (result: LogNotificationResult): void => {
    this.logMessage = result.message;
    this.logStackTrace = result.stackTrace;
    this.logType = result.level;
  };

  applicationPausedCallback = (applicationPaused: boolean): void => {
    this.applicationPaused = applicationPaused;
  };
}

describe('TestNotifications', () => {
  let d: AltDriver;
  beforeAll(async () => { d = await connectDriver(); });
  afterAll(async () => { await d?.stop(); });
  beforeEach(async () => {
    await d.resetInput();
  });

  it('test_load_scene_notification', async () => {
    const cb = new MockNotificationCallbacks();
    await d.addNotificationListener(NotificationType.LOADSCENE, cb.sceneLoadedCallback);
    await d.loadScene(Scenes.Scene01);
    expect(cb.lastSceneLoaded).toBe(Scenes.Scene01);
    await d.removeNotificationListener(NotificationType.LOADSCENE);
  });

  it('test_unload_scene_notification', async () => {
    const cb = new MockNotificationCallbacks();
    await d.addNotificationListener(NotificationType.UNLOADSCENE, cb.sceneUnloadedCallback);
    await d.loadScene(Scenes.Scene01);
    await d.loadScene(Scenes.Scene02, false);
    await d.unloadScene(Scenes.Scene02);
    expect(cb.lastSceneUnloaded).toBe(Scenes.Scene02);
    await d.removeNotificationListener(NotificationType.UNLOADSCENE);
  });

  it('test_log_notification', async () => {
    const cb = new MockNotificationCallbacks();
    await d.addNotificationListener(NotificationType.LOG, cb.logCallback);
    await d.loadScene(Scenes.Scene01);
    expect(cb.logMessage).toContain('"commandName":"loadScene');
    expect(cb.logType).toBe(AltLogLevel.Debug);
    await d.removeNotificationListener(NotificationType.LOG);
  });

  it('test_application_paused_notification', async () => {
    const cb = new MockNotificationCallbacks();
    await d.addNotificationListener(NotificationType.APPLICATION_PAUSED, cb.applicationPausedCallback);
    await d.loadScene(Scenes.Scene01);
    const altObject = await d.findObject(By.NAME, 'AltTesterPrefab');
    await altObject.callComponentMethod(
      'AltTester.AltTesterUnitySDK.Commands.AltRunner',
      'OnApplicationPause',
      'AltTester.AltTesterUnitySDK',
      [true],
      ['System.Boolean'],
    );

    expect(cb.applicationPaused).toBe(true);
    await d.removeNotificationListener(NotificationType.APPLICATION_PAUSED);
  });
});
