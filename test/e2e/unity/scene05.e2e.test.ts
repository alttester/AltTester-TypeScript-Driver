// Port of Bindings~/python/tests/integration/test_scene05.py
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AltKeyCode, By, type AltDriver } from '../../../src/binding';
import { closeAltTesterPopup, connectDriver, Scenes, sleep } from './setup';

describe('TestScene05', () => {
  let d: AltDriver;
  beforeAll(async () => { d = await connectDriver(); });
  afterAll(async () => { await d?.stop(); });
  beforeEach(async () => {
    await closeAltTesterPopup(d);
    await d.resetInput();
    await d.loadScene(Scenes.Scene05);
  });

  it('test_movement_cube', async () => {
    let cube = await d.findObject(By.NAME, 'Player1');
    const initialPosition = [cube.worldX, cube.worldY, cube.worldZ];

    await d.scroll(30, 0.1, false);
    await d.pressKey(AltKeyCode.K, 1, 0.1, false);

    await d.pressKey(AltKeyCode.O, 1, 0.1);
    cube = await d.findObject(By.NAME, 'Player1');
    const finalPosition = [cube.worldX, cube.worldY, cube.worldZ];

    expect(finalPosition).not.toEqual(initialPosition);
  });

  it('test_camera_movement', async () => {
    let cube = await d.findObject(By.NAME, 'Player1');
    const initialPosition = [cube.worldX, cube.worldY, cube.worldY];

    await d.pressKey(AltKeyCode.W, 1, 0.1, false);

    cube = await d.findObject(By.NAME, 'Player1');
    const finalPosition = [cube.worldX, cube.worldY, cube.worldY];

    expect(finalPosition).not.toEqual(initialPosition);
  });

  it('test_update_altObject', async () => {
    const cube = await d.findObject(By.NAME, 'Player1');
    const initialPositionZ = cube.worldZ;

    await d.pressKey(AltKeyCode.W, 1, 0.1, false);
    await sleep(5);

    expect((await cube.updateObject()).worldZ).not.toBe(initialPositionZ);
  });

  it('test_creating_stars', async () => {
    let stars = await d.findObjectsWhichContain(By.NAME, 'Star', By.NAME, 'Player2');
    expect(stars.length).toBe(1);

    await d.findObjectsWhichContain(By.NAME, 'Player', By.NAME, 'Player2');
    const pressingPoint1 = await d.findObject(By.NAME, 'PressingPoint1', By.NAME, 'Player2');

    await d.moveMouse(pressingPoint1.getScreenPosition(), 0.1, false);
    await sleep(0.1);

    await d.pressKey(AltKeyCode.Mouse0, 1, 0.1, false);
    const pressingPoint2 = await d.findObject(By.NAME, 'PressingPoint2', By.NAME, 'Player2');
    await d.moveMouse(pressingPoint2.getScreenPosition(), 0.1);
    await d.pressKey(AltKeyCode.Mouse0, 1, 0.1, false);
    await sleep(0.1);

    stars = await d.findObjectsWhichContain(By.NAME, 'Star');
    expect(stars.length).toBe(3);
  });

  it('test_power_joystick', async () => {
    const buttonNames = ['Horizontal', 'Vertical'];
    const keysToPress = [AltKeyCode.D, AltKeyCode.W];

    const axisName = await d.findObject(By.NAME, 'AxisName');
    const axisValue = await d.findObject(By.NAME, 'AxisValue');

    for (let i = 0; i < buttonNames.length; i++) {
      await d.pressKey(keysToPress[i], 0.5, 1);

      expect(await axisValue.getText()).toBe('0.5');
      expect(await axisName.getText()).toBe(buttonNames[i]);
    }
  });

  it('test_scroll', async () => {
    let player2 = await d.findObject(By.NAME, 'Player2');
    const cubeInitialPosition = [player2.worldX, player2.worldY, player2.worldY];
    await d.scroll(4, 1, false);
    await sleep(1);

    player2 = await d.findObject(By.NAME, 'Player2');
    const cubeFinalPosition = [player2.worldX, player2.worldY, player2.worldY];
    expect(cubeFinalPosition).not.toEqual(cubeInitialPosition);
  });

  it('test_scroll_and_wait', async () => {
    let player2 = await d.findObject(By.NAME, 'Player2');
    const cubeInitialPosition = [player2.worldX, player2.worldY, player2.worldY];
    await d.scroll(4, 0.3);

    player2 = await d.findObject(By.NAME, 'Player2');
    const cubeFinalPosition = [player2.worldX, player2.worldY, player2.worldY];
    expect(cubeFinalPosition).not.toEqual(cubeInitialPosition);
  });

  it('test_key_down_and_key_up', async () => {
    await d.keyDown(AltKeyCode.A);
    await sleep(0.1);
    await d.keyUp(AltKeyCode.A);
    await sleep(0.1);
    const lastKeyDown = await d.findObject(By.NAME, 'LastKeyDownValue');
    const lastKeyPress = await d.findObject(By.NAME, 'LastKeyPressedValue');

    expect(await lastKeyDown.getText()).toBe('97');
    expect(await lastKeyPress.getText()).toBe('97');

    const lastKeyUp = await d.findObject(By.NAME, 'LastKeyUpValue');

    expect(await lastKeyUp.getText()).toBe('97');
  });
});
