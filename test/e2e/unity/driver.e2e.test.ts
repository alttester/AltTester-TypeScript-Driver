// Port of Bindings~/python/tests/integration/test_driver.py
import { existsSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  AltLogger,
  AltLogLevel,
  By,
  CouldNotPerformOperationException,
  InvalidPathException,
  SceneNotFoundException,
  WaitTimeOutException,
  type AltDriver,
} from '../../../src/binding';
import { connectDriver, Scenes } from './setup';

describe('TestDriver', () => {
  let d: AltDriver;
  beforeAll(async () => { d = await connectDriver(); });
  afterAll(async () => { await d?.stop(); });
  beforeEach(() => {
    // The Python setup fixture only stores the driver.
  });

  it('test_load_and_wait_for_scene', async () => {
    await d.loadScene(Scenes.Scene01);
    await d.waitForCurrentSceneToBe(Scenes.Scene01, 1);

    await d.loadScene(Scenes.Scene02);
    await d.waitForCurrentSceneToBe(Scenes.Scene02, 1);

    expect(await d.getCurrentScene()).toBe(Scenes.Scene02);
  });

  it('test_wait_for_current_scene_to_be_with_a_non_existing_scene', async () => {
    const sceneName = 'Scene 0';

    const p = d.waitForCurrentSceneToBe(sceneName, 1, 0.5);
    await expect(p).rejects.toBeInstanceOf(WaitTimeOutException);
    await expect(p).rejects.toThrow(new RegExp(`^Scene ${sceneName} not loaded after 1 seconds$`));
  });

  it('test_set_and_get_time_scale', async () => {
    await d.setTimeScale(0.1);

    expect(await d.getTimeScale()).toBe(0.1);

    await d.setTimeScale(1);
  });

  it('test_screenshot', async () => {
    const pngPath = 'testPython.png';
    await d.getPNGScreenshot(pngPath);
    expect(existsSync(pngPath)).toBe(true);
  });

  it('test_wait_for_object_which_contains_with_tag', async () => {
    const altObject = await d.waitForObjectWhichContains(By.NAME, 'Canva', By.TAG, 'MainCamera');
    expect(altObject.name).toBe('Canvas');
  });

  it('test_load_additive_scenes', async () => {
    await d.loadScene(Scenes.Scene01, true);

    const initialNumberOfElements = await d.getAllElements();
    await d.loadScene(Scenes.Scene02, false);
    const finalNumberOfElements = await d.getAllElements();

    expect(finalNumberOfElements.length).toBeGreaterThan(initialNumberOfElements.length);

    const scenes = await d.getAllLoadedScenes();
    expect(scenes.length).toBe(2);
  });

  it('test_load_scene_with_invalid_scene_name', async () => {
    await expect(d.loadScene('Scene 0')).rejects.toBeInstanceOf(SceneNotFoundException);
  });

  it('test_unload_scene', async () => {
    await d.loadScene(Scenes.Scene01, true);
    await d.loadScene(Scenes.Scene02, false);

    expect((await d.getAllLoadedScenes()).length).toBe(2);

    await d.unloadScene(Scenes.Scene02);
    expect((await d.getAllLoadedScenes()).length).toBe(1);
    expect((await d.getAllLoadedScenes())[0]).toBe(Scenes.Scene01);
  });

  it('test_unload_only_scene', async () => {
    await d.loadScene(Scenes.Scene01, true);

    await expect(d.unloadScene(Scenes.Scene01)).rejects.toBeInstanceOf(CouldNotPerformOperationException);
  });

  // Python: @pytest.mark.WebGLUnsupported
  it('test_set_server_logging', async () => {
    let rule = await d.callStaticMethod<{ Levels: unknown[] }>(
      'AltTester.AltTesterUnitySDK.Logging.AltTesterLogManager',
      'Instance.Configuration.FindRuleByName',
      'Assembly-CSharp',
      ['AltServerFileRule'],
    );

    // Default logging level in AltTester® is Debug level
    expect(rule.Levels.length).toBe(5);

    await d.setServerLogging(AltLogger.File, AltLogLevel.Off);
    rule = await d.callStaticMethod<{ Levels: unknown[] }>(
      'AltTester.AltTesterUnitySDK.Logging.AltTesterLogManager',
      'Instance.Configuration.FindRuleByName',
      'Assembly-CSharp',
      ['AltServerFileRule'],
    );

    expect(rule.Levels.length).toBe(0);

    // Reset logging level
    await d.setServerLogging(AltLogger.File, AltLogLevel.Debug);
  });

  it.each(['//[1]', 'CapsuleInfo[@tag=UI]', '//CapsuleInfo[@tag=UI/Text', '//CapsuleInfo[0/Text'])(
    'test_invalid_paths[%s]',
    async (path) => {
      await expect(d.findObject(By.PATH, path)).rejects.toBeInstanceOf(InvalidPathException);
    },
  );
});
