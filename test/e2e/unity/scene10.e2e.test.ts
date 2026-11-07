// Port of Bindings~/python/tests/integration/test_scene10.py
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AltKeyCode, By, type AltDriver, type AltObject } from '../../../src/binding';
import { closeAltTesterPopup, connectDriver, Scenes } from './setup';

describe('TestScene10', () => {
  let d: AltDriver;
  beforeAll(async () => { d = await connectDriver(); });
  afterAll(async () => { await d?.stop(); });
  beforeEach(async () => {
    await closeAltTesterPopup(d);
    await d.resetInput();
    await d.loadScene(Scenes.Scene10);
  });

  const position = (player: AltObject) =>
    player.getComponentProperty('UnityEngine.Transform', 'position', 'UnityEngine.CoreModule');

  // Skipped in Python too: "This test needs more investigation".
  it.skip('test_scroll_NIS', async () => {
    const player = await d.findObject(By.NAME, 'Player');

    expect(await player.getComponentProperty('AltNIPDebugScript', 'wasScrolled', 'Assembly-CSharp')).toBeFalsy();

    await d.scroll(300, 1, true);

    expect(await player.getComponentProperty('AltNIPDebugScript', 'wasScrolled', 'Assembly-CSharp')).toBeTruthy();
  });

  it('test_key_down_and_key_up_NIS', async () => {
    const player = await d.findObject(By.NAME, 'Player');
    const initialPosition = await position(player);

    await d.keyDown(AltKeyCode.A);
    await d.keyUp(AltKeyCode.A);
    const lefPosition = await position(player);

    expect(lefPosition).not.toEqual(initialPosition);

    await d.keyDown(AltKeyCode.D);
    await d.keyUp(AltKeyCode.D);
    const rightPosition = await position(player);

    expect(rightPosition).not.toEqual(lefPosition);

    await d.keyDown(AltKeyCode.W);
    await d.keyUp(AltKeyCode.W);
    const upPosition = await position(player);

    expect(upPosition).not.toEqual(rightPosition);

    await d.keyDown(AltKeyCode.S);
    await d.keyUp(AltKeyCode.S);
    const downPosition = await position(player);

    expect(downPosition).not.toEqual(upPosition);
  });

  it('test_press_key_NIS', async () => {
    const player = await d.findObject(By.NAME, 'Player');
    const initialPosition = await position(player);

    await d.pressKey(AltKeyCode.A);
    const leftPosition = await position(player);

    expect(leftPosition).not.toEqual(initialPosition);

    await d.pressKey(AltKeyCode.D);
    const rightPosition = await position(player);

    expect(rightPosition).not.toEqual(leftPosition);

    await d.pressKey(AltKeyCode.W);
    const upPosition = await position(player);

    expect(upPosition).not.toEqual(rightPosition);

    await d.pressKey(AltKeyCode.S);
    const downPosition = await position(player);

    expect(downPosition).not.toEqual(upPosition);
  });

  it('test_press_keys_NIS', async () => {
    const player = await d.findObject(By.NAME, 'Player');
    const initialPosition = await position(player);

    const keys = [AltKeyCode.W, AltKeyCode.Mouse0];
    await d.pressKeys(keys);

    const finalPosition = await position(player);
    expect(finalPosition).not.toEqual(initialPosition);

    await d.waitForObject(By.NAME, 'SimpleProjectile(Clone)');
  });
});
