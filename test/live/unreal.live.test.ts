// Live: Lyra (Unreal SDK 1.2.x) through AltTester Desktop. ALT_LIVE_UNREAL=1 npm run test:live
// Read-only apart from mouse moves, so it does not change the game's state.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AltDriver, By, InvalidCommandException, NotFoundException } from '../../src/binding';

const run = process.env.ALT_LIVE_UNREAL === '1';

describe.runIf(run)('live Unreal binding (Lyra)', () => {
  let d: AltDriver;

  beforeAll(async () => {
    d = await AltDriver.connect({
      host: process.env.ALT_HOST ?? '127.0.0.1',
      port: Number(process.env.ALT_PORT ?? 13000),
      appName: process.env.ALT_UNREAL_APP ?? 'Lyra',
      connectTimeout: 20,
    });
  });

  afterAll(async () => {
    await d?.stop();
  });

  it('connects and infers Unreal from the SDK version', async () => {
    expect(d.engine).toBe('unreal');
    expect(await d.getServerVersion()).toMatch(/^1\./);
  });

  it('scenes, screen, time scale', async () => {
    const current = await d.getCurrentScene();
    expect(current).toBeTruthy();
    expect(await d.getAllLoadedScenes()).toContain(current);
    expect((await d.getAllScenes()).length).toBeGreaterThan(0);
    expect((await d.getApplicationScreenSize()).x).toBeGreaterThan(0);
    const ts = await d.getTimeScale();
    expect(typeof ts).toBe('number');
    await d.setTimeScale(ts);
  });

  it('find (server rewrites to game* commands), text, components', async () => {
    const info = await d.waitForObject(By.NAME, 'BuildInfoText', By.NAME, '', 10);
    expect(info.id).not.toBe(0);
    expect(typeof (await info.getText())).toBe('string');
    expect((await info.getAllComponents()).length).toBeGreaterThan(0);
    expect((await d.findObjects(By.NAME, 'ButtonTextBlock')).length).toBeGreaterThan(0);
    expect((await d.findObjectsWhichContain(By.NAME, 'Button')).length).toBeGreaterThan(0);
    await expect(d.findObject(By.NAME, 'DoesNotExist')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('hierarchy, cameras, coordinates', async () => {
    const rows = await d.getAllLoadedScenesAndObjects();
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.every((r) => typeof r.id === 'number')).toBe(true);
    expect(Array.isArray(await d.getAllActiveCameras())).toBe(true);
    const size = await d.getApplicationScreenSize();
    await d.findObjectAtCoordinates({ x: size.x / 2, y: size.y / 2 });
  });

  it('screenshots', async () => {
    expect((await d.getScreenshot(50)).compressedImage.length).toBeGreaterThan(100);
    // The Unreal SDK (1.2.1) answers getPNGScreenshot with JPEG bytes, not PNG.
    const image = await d.getPNGScreenshot();
    expect([[0x89, 0x50], [0xff, 0xd8]]).toContainEqual(Array.from(image.slice(0, 2)));
  });

  it('mouse move completes', async () => {
    await d.moveMouse({ x: 2, y: 2 }, 0.1);
  });

  it('Unity-only commands throw at once instead of stalling', async () => {
    const started = Date.now();
    await expect(d.scroll(1)).rejects.toBeInstanceOf(InvalidCommandException);
    await expect(d.getAllCameras()).rejects.toBeInstanceOf(InvalidCommandException);
    await expect(d.deletePlayerPref()).rejects.toBeInstanceOf(InvalidCommandException);
    expect(Date.now() - started).toBeLessThan(500);
  });
});
