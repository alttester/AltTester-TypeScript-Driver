// Port of TestForScene5KeyboardAndMouseInput.cs (TestForScene5KeyboardAndMouseInput) from AltTester-Unity-SDK-Closed-Source sdk-package/Assets/Examples/Test/Editor/Driver
import { describe, expect, it } from 'vitest';
import { AltKeyCode, By, type AltObject } from '../../../src/binding';
import { Scenes, sleep } from './setup';
import { useTestBase } from './testBase';

/** Like C# Enum.Parse(typeof(AltKeyCode), text, true): accepts a key name (any case) or its numeric value. */
function parseKeyCode(text: string): number {
  const trimmed = text.trim();
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  const entry = Object.entries(AltKeyCode).find(([name]) => name.toLowerCase() === trimmed.toLowerCase());
  if (!entry) throw new Error(`Not an AltKeyCode: ${text}`);
  return entry[1];
}

describe('TestForScene5KeyboardAndMouseInput', () => {
  const getDriver = useTestBase(Scenes.Scene05);

  async function pressKeyAndReturnPlayer1(keyCode: number): Promise<AltObject> {
    const altDriver = getDriver();
    await altDriver.pressKey(keyCode, 1, 2);
    return altDriver.findObject(By.NAME, 'Player1');
  }

  // Test input made with axis
  it('TestMovementCube', async () => {
    const altDriver = getDriver();
    let cube = await altDriver.findObject(By.NAME, 'Player1');
    const cubeInitialPostion = { x: cube.worldX, y: cube.worldY, z: cube.worldY };
    await altDriver.pressKey(AltKeyCode.K, 1, 2, false);
    await sleep(2);
    await altDriver.pressKey(AltKeyCode.O, 1, 1);

    cube = await altDriver.findObject(By.NAME, 'Player1');
    const cubeFinalPosition = { x: cube.worldX, y: cube.worldY, z: cube.worldY };

    expect(cubeFinalPosition).not.toEqual(cubeInitialPostion);
  });

  it('TestCameraMovementByWASD', async () => {
    const altDriver = getDriver();
    const cube = await altDriver.findObject(By.NAME, 'Player1');
    const cubeInitialPostion = cube.getWorldPosition();

    expect((await pressKeyAndReturnPlayer1(AltKeyCode.W)).getWorldPosition()).not.toEqual(cubeInitialPostion);
    expect((await pressKeyAndReturnPlayer1(AltKeyCode.W)).getWorldPosition())
      .not.toEqual((await pressKeyAndReturnPlayer1(AltKeyCode.A)).getWorldPosition());
    expect((await pressKeyAndReturnPlayer1(AltKeyCode.A)).getWorldPosition())
      .not.toEqual((await pressKeyAndReturnPlayer1(AltKeyCode.S)).getWorldPosition());
    expect((await pressKeyAndReturnPlayer1(AltKeyCode.S)).getWorldPosition())
      .not.toEqual((await pressKeyAndReturnPlayer1(AltKeyCode.D)).getWorldPosition());
  });

  it('TestCameraMovementByArrows', async () => {
    const altDriver = getDriver();
    const cube = await altDriver.findObject(By.NAME, 'Player1');
    const cubeInitialPostion = cube.getWorldPosition();

    expect((await pressKeyAndReturnPlayer1(AltKeyCode.UpArrow)).getWorldPosition()).not.toEqual(cubeInitialPostion);
    expect((await pressKeyAndReturnPlayer1(AltKeyCode.UpArrow)).getWorldPosition())
      .not.toEqual((await pressKeyAndReturnPlayer1(AltKeyCode.DownArrow)).getWorldPosition());
    expect((await pressKeyAndReturnPlayer1(AltKeyCode.DownArrow)).getWorldPosition())
      .not.toEqual((await pressKeyAndReturnPlayer1(AltKeyCode.RightArrow)).getWorldPosition());
    expect((await pressKeyAndReturnPlayer1(AltKeyCode.RightArrow)).getWorldPosition())
      .not.toEqual((await pressKeyAndReturnPlayer1(AltKeyCode.LeftArrow)).getWorldPosition());
  });

  it('TestUpdateAltObject', async () => {
    const altDriver = getDriver();
    const cube = await altDriver.findObject(By.NAME, 'Player1');
    const cubeInitialPostion = cube.getWorldPosition();

    await altDriver.pressKey(AltKeyCode.W, 1, 2);

    expect((await cube.updateObject()).getWorldPosition()).not.toEqual(cubeInitialPostion);
  });

  // Testing mouse movement and clicking
  it('TestCreatingStars', async () => {
    const altDriver = getDriver();
    let stars = await altDriver.findObjectsWhichContain(By.NAME, 'Star', By.NAME, 'Player2');
    const pressingpoint1 = await altDriver.findObjectWhichContains(By.NAME, 'PressingPoint1', By.NAME, 'Player2');
    expect(stars.length).toBe(1);

    await altDriver.moveMouse({ x: pressingpoint1.x, y: pressingpoint1.y }, 1, false);
    await sleep(1.5);

    await altDriver.pressKey(AltKeyCode.Mouse0, 0.1);

    const pressingpoint2 = await altDriver.findObjectWhichContains(By.NAME, 'PressingPoint2', By.NAME, 'Player2');
    await altDriver.moveMouse({ x: pressingpoint2.x, y: pressingpoint2.y }, 1);
    await altDriver.pressKey(AltKeyCode.Mouse0, 0.1);

    stars = await altDriver.findObjectsWhichContain(By.NAME, 'Star');
    expect(stars.length).toBe(3);
  });

  it('TestKeyboardPress', async () => {
    const altDriver = getDriver();
    const lastKeyDown = await altDriver.findObject(By.NAME, 'LastKeyDownValue');
    const lastKeyUp = await altDriver.findObject(By.NAME, 'LastKeyUpValue');
    const lastKeyPress = await altDriver.findObject(By.NAME, 'LastKeyPressedValue');
    for (const kcode of Object.values(AltKeyCode)) {
      if (kcode !== AltKeyCode.NoKey && kcode < AltKeyCode.Joystick1Button0) {
        await altDriver.pressKey(kcode, 1, 0.2);

        expect(Number.parseInt(await lastKeyDown.getText(), 10)).toBe(kcode);
        expect(Number.parseInt(await lastKeyUp.getText(), 10)).toBe(kcode);
        expect(Number.parseInt(await lastKeyPress.getText(), 10)).toBe(kcode);
      }
    }
  });

  it('TestKeyDownAndKeyUp', async () => {
    const altDriver = getDriver();
    const kcode = AltKeyCode.A;

    await altDriver.keyDown(kcode, 1);
    const lastKeyDown = await altDriver.findObject(By.NAME, 'LastKeyDownValue');
    const lastKeyPress = await altDriver.findObject(By.NAME, 'LastKeyPressedValue');

    expect(parseKeyCode(await lastKeyDown.getText())).toBe(kcode);
    expect(parseKeyCode(await lastKeyPress.getText())).toBe(kcode);

    await altDriver.keyUp(kcode);
    const lastKeyUp = await altDriver.findObject(By.NAME, 'LastKeyUpValue');
    await sleep(0.2);

    expect(parseKeyCode(await lastKeyUp.getText())).toBe(kcode);
  });

  it('TestButton', async () => {
    const altDriver = getDriver();
    const buttonNames = ['Horizontal', 'Vertical'];
    const keyToPressForButtons = [AltKeyCode.A, AltKeyCode.W];
    await altDriver.loadScene('Scene 5 Keyboard Input');
    const axisName = await altDriver.findObject(By.NAME, 'AxisName');
    let i = 0;
    for (const kcode of keyToPressForButtons) {
      await altDriver.pressKey(kcode, 1, 0.05);
      expect(await axisName.getText()).toBe(buttonNames[i]);
      i++;
    }
  });

  // [Ignore("This test is flaky, needs investigation")]
  it.skip('TestTabToCloseImage', async () => {
    const altDriver = getDriver();
    expect((await altDriver.findObject(By.PATH, '//Canvas/Image', By.NAME, '', false)).enabled).toBe(true);
    await altDriver.keyDown(AltKeyCode.Tab);
    await sleep(0.2);
    await altDriver.keyUp(AltKeyCode.Tab);
    await sleep(0.2);
    expect((await altDriver.findObject(By.PATH, '//Canvas/Image', By.NAME, '', false)).enabled).toBe(false);
    await altDriver.keyDown(AltKeyCode.Tab);
    await sleep(0.2);
    await altDriver.keyUp(AltKeyCode.Tab);
    await sleep(0.2);
    expect((await altDriver.findObject(By.PATH, '//Canvas/Image', By.NAME, '', false)).enabled).toBe(true);
  });

  it('TestPowerJoystick', async () => {
    const altDriver = getDriver();
    const buttonNames = ['Horizontal', 'Vertical'];
    const keyToPressForButtons = [AltKeyCode.D, AltKeyCode.W];
    await altDriver.loadScene('Scene 5 Keyboard Input');
    const axisName = await altDriver.findObject(By.NAME, 'AxisName');
    const axisValue = await altDriver.findObject(By.NAME, 'AxisValue');
    let i = 0;
    for (const kcode of keyToPressForButtons) {
      await altDriver.pressKey(kcode, 0.5, 0.1);
      expect(await axisValue.getText()).toBe('0.5');
      expect(await axisName.getText()).toBe(buttonNames[i]);
      i++;
    }
  });

  it('TestScroll', async () => {
    const altDriver = getDriver();
    let player2 = await altDriver.findObject(By.NAME, 'Player2');

    const cubeInitialPostion = { x: player2.worldX, y: player2.worldY, z: player2.worldY };
    await altDriver.scroll(4, 2, false);
    await sleep(4);
    player2 = await altDriver.findObject(By.NAME, 'Player2');
    const cubeFinalPosition = { x: player2.worldX, y: player2.worldY, z: player2.worldY };

    expect(cubeFinalPosition).not.toEqual(cubeInitialPostion);
  });

  it('TestScrollAndWait', async () => {
    const altDriver = getDriver();
    let player2 = await altDriver.findObject(By.NAME, 'Player2');
    const cubeInitialPostion = { x: player2.worldX, y: player2.worldY, z: player2.worldY };
    await altDriver.scroll(4, 2);

    player2 = await altDriver.findObject(By.NAME, 'Player2');
    const cubeFinalPosition = { x: player2.worldX, y: player2.worldY, z: player2.worldY };
    expect(cubeFinalPosition).not.toEqual(cubeInitialPostion);
  });

  it('TestCheckShadersSetCorrectlyAfterHighlight', async () => {
    const altDriver = getDriver();
    const cube = await altDriver.findObject(By.NAME, '2MaterialCube');
    const count = await cube.getComponentProperty<number>('UnityEngine.Renderer', 'materials.Length', 'UnityEngine.CoreModule');
    const shadersName: string[] = [];
    for (let i = 0; i < count; i++) {
      shadersName.push(
        await cube.getComponentProperty<string>('UnityEngine.Renderer', `materials[${i}].shader.name`, 'UnityEngine.CoreModule'),
      );
    }

    // C# GetScreenshot(id, color, width) is the highlighted screenshot; new AltColor(1, 1, 1) has alpha 1.
    await altDriver.getHighlightedScreenshot(cube.id, { r: 1, g: 1, b: 1, a: 1 }, 1.1);
    await sleep(1);
    const newShadersName: string[] = [];
    for (let i = 0; i < count; i++) {
      newShadersName.push(
        await cube.getComponentProperty<string>('UnityEngine.Renderer', `materials[${i}].shader.name`, 'UnityEngine.CoreModule'),
      );
    }
    expect(shadersName).toEqual(newShadersName);
  });

  it('TestClickDestroyButton', async () => {
    const altDriver = getDriver();
    await (await altDriver.findObject(By.NAME, 'Destroy')).click();
    await altDriver.waitForObjectToNotBePresent(By.NAME, 'Destroy');
  });
});
