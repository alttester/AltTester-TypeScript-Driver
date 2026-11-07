// Live: AltTicTacToe (Unity SDK 2.3.x). ALT_LIVE_UNITY=1 npm run test:live
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AltDriver,
  AltKeyCode,
  By,
  InvalidCommandException,
  NotFoundException,
  NotificationType,
  WaitTimeOutException,
  type LoadSceneNotificationResult,
} from '../../src/binding';

const run = process.env.ALT_LIVE_UNITY === '1';
const TMP = { component: 'TMPro.TextMeshProUGUI', assembly: 'Unity.TextMeshPro' };

describe.runIf(run)('live Unity binding (AltTicTacToe)', () => {
  let d: AltDriver;

  beforeAll(async () => {
    d = await AltDriver.connect({
      host: process.env.ALT_HOST ?? '127.0.0.1',
      port: Number(process.env.ALT_PORT ?? 13000),
      appName: process.env.ALT_UNITY_APP ?? 'AltTicTacToe',
      connectTimeout: 20,
    });
  });

  afterAll(async () => {
    await d?.stop();
  });

  it('connects to a Unity app', async () => {
    expect(d.engine).toBe('unity');
    expect(await d.getServerVersion()).toMatch(/^2\./);
  });

  it('scenes: load, current, list, wait, notifications', async () => {
    const loads: LoadSceneNotificationResult[] = [];
    await d.addNotificationListener(NotificationType.LOADSCENE, (r) => loads.push(r));
    await d.loadScene('StartScene');
    expect(await d.waitForCurrentSceneToBe('StartScene', 10)).toBe('StartScene');
    expect(await d.getAllScenes()).toEqual(expect.arrayContaining(['StartScene', 'PlayScene']));
    expect(await d.getAllLoadedScenes()).toEqual(['StartScene']);
    await new Promise((r) => setTimeout(r, 300));
    expect(loads.map((l) => l.sceneName)).toContain('StartScene');
    await d.removeNotificationListener(NotificationType.LOADSCENE);
  });

  it('additive load and unload', async () => {
    await d.loadScene('PlayScene', false);
    expect(await d.getAllLoadedScenes()).toEqual(['StartScene', 'PlayScene']);
    await d.unloadScene('PlayScene');
    expect(await d.getAllLoadedScenes()).toEqual(['StartScene']);
  });

  it('find, text, components and tap on an element', async () => {
    const play = await d.waitForObject(By.NAME, 'PlayButton', By.NAME, '', 10);
    const label = await play.findObjectFromObject(By.NAME, 'Text (TMP)');
    expect(await label.getText()).toBe('PLAY NOW');
    expect(await label.getComponentProperty(TMP.component, 'text', TMP.assembly)).toBe('PLAY NOW');
    expect((await play.getAllComponents()).map((c) => c.componentName)).toContain('UnityEngine.UI.Button');
    expect((await label.getParent()).id).toBe(play.id);
    expect((await play.updateObject()).id).toBe(play.id);
    expect((await d.findObjectsWhichContain(By.NAME, 'Button')).length).toBeGreaterThanOrEqual(2);
    expect((await d.findObjectWhichContains(By.TEXT, 'SHARE')).name).toBe('Text (TMP)');
    await play.tap();
    expect(await d.waitForCurrentSceneToBe('PlayScene', 10)).toBe('PlayScene');
  });

  it('plays a move and waits for a component property', async () => {
    // RestartButton reloads the scene asynchronously; loadScene resolves only after "Scene Loaded".
    await d.loadScene('PlayScene');
    const slot = await d.findObject(By.NAME, 'Slot1');
    const text = await slot.findObjectFromObject(By.NAME, 'Text (TMP)');
    await slot.click();
    const mark = await text.waitForComponentProperty<string>(TMP.component, 'text', 'X', TMP.assembly, 5, 0.2);
    expect(mark).toBe('X');
    await d.loadScene('PlayScene');
  });

  it('not-found and wait timeouts are typed', async () => {
    await expect(d.findObject(By.NAME, 'DoesNotExist')).rejects.toBeInstanceOf(NotFoundException);
    await expect(d.waitForObject(By.NAME, 'DoesNotExist', By.NAME, '', 0.5, 0.1)).rejects.toBeInstanceOf(WaitTimeOutException);
    await d.waitForObjectToNotBePresent(By.NAME, 'DoesNotExist', By.NAME, '', 2);
  });

  it('hierarchy, cameras, coordinates and screen', async () => {
    const size = await d.getApplicationScreenSize();
    expect(size.x).toBeGreaterThan(0);
    expect(await d.callStaticMethod('UnityEngine.Screen', 'get_width', 'UnityEngine.CoreModule')).toBe(size.x);
    expect((await d.getAllElements()).length).toBeGreaterThan(10);
    expect((await d.getAllElementsLight()).length).toBeGreaterThan(10);
    expect((await d.getAllLoadedScenesAndObjects())[0]).toMatchObject({ name: 'PlayScene', id: 0 });
    expect((await d.getAllCameras()).map((c) => c.name)).toContain('Main Camera');
    expect((await d.getAllActiveCameras()).length).toBeGreaterThan(0);
    const slot = await d.findObject(By.NAME, 'Slot5');
    const hit = await d.findObjectAtCoordinates(slot.getScreenPosition());
    expect(hit).not.toBeNull();
  });

  it('screenshots', async () => {
    const jpg = await d.getScreenshot(50);
    expect(jpg.compressedImage.length).toBeGreaterThan(100);
    const png = await d.getPNGScreenshot();
    expect(Array.from(png.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    const slot = await d.findObject(By.NAME, 'Slot5');
    expect((await d.getHighlightedScreenshot(slot)).compressedImage.length).toBeGreaterThan(100);
    const at = await d.getHighlightedScreenshotAt(slot.getScreenPosition());
    expect(at.object).not.toBeNull();
  });

  it('time scale, static property, PlayerPrefs', async () => {
    const before = await d.getTimeScale();
    await d.setTimeScale(0.5);
    expect(await d.getTimeScale()).toBe(0.5);
    await d.setTimeScale(before);
    expect(await d.getStaticProperty('UnityEngine.Screen', 'width', 'UnityEngine.CoreModule')).toBe((await d.getApplicationScreenSize()).x);
    await d.setKeyPlayerPref('ts-binding-live-test', 41);
    expect(await d.getIntKeyPlayerPref('ts-binding-live-test')).toBe(41);
    await d.setKeyPlayerPref('ts-binding-live-test', 'str');
    expect(await d.getStringKeyPlayerPref('ts-binding-live-test')).toBe('str');
    await d.deleteKeyPlayerPref('ts-binding-live-test');
  });

  it('input commands complete', async () => {
    const c = await d.getApplicationScreenSize();
    const corner = { x: 5, y: 5 };
    await d.moveMouse(corner, 0.1);
    await d.scroll(1, 0.1);
    await d.swipe(corner, { x: 10, y: 10 }, 0.1);
    await d.multipointSwipe([corner, { x: 10, y: 10 }, { x: 15, y: 5 }], 0.1);
    await d.holdButton(corner, 0.1);
    await d.click(corner);
    await d.tap(corner);
    await d.tilt({ x: 0, y: 0, z: 0 }, 0.1);
    await d.pressKey(AltKeyCode.LeftShift, 1, 0.05);
    await d.pressKeys([AltKeyCode.LeftShift, AltKeyCode.LeftControl], 1, 0.05);
    await d.keyDown(AltKeyCode.LeftShift);
    await d.keyUp(AltKeyCode.LeftShift);
    const finger = await d.beginTouch(corner);
    await d.moveTouch(finger, { x: 10, y: 10 });
    await d.endTouch(finger);
    await d.resetInput();
    expect(c.x).toBeGreaterThan(0);
  });

  it('pointer events on an object', async () => {
    const back = await d.findObject(By.NAME, 'BackButton');
    await back.pointerEnter();
    await back.pointerExit();
    await back.pointerDown();
    await back.pointerUp();
  });

  it('an Unreal-only refusal never applies to Unity', async () => {
    await expect(d.resetInput()).resolves.toBeUndefined();
    expect(InvalidCommandException).toBeDefined();
  });
});
