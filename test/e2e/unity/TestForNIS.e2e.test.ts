// Port of TestForNIS.cs (TestForNIS) from AltTester-Unity-SDK-Closed-Source sdk-package/Assets/Examples/Test/Editor/Driver
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AltKeyCode, By, type AltDriver, type AltObject, type AltVector2, type AltVector3 } from '../../../src/binding';
import { connectDriver } from './setup';

// Reverse lookup for Enum.IsDefined and AltKeyCode.ToString().
const keyCodeNames = new Map<number, string>();
for (const [name, value] of Object.entries(AltKeyCode)) {
  if (!keyCodeNames.has(value)) keyCodeNames.set(value, name);
}

// TestForNIS does not derive from TestBase: one driver per class, resetInput before each test, each test loads its
// own scene.
describe('TestForNIS', () => {
  let altDriver: AltDriver;

  const scene7 = 'Assets/Examples/Scenes/Scene 7 Drag And Drop NIS.unity';
  const scene8 = 'Assets/Examples/Scenes/Scene 8 Draggable Panel NIP.unity';
  const scene9 = 'Assets/Examples/Scenes/scene 9 NIS.unity';
  const scene10 = 'Assets/Examples/Scenes/Scene 10 Sample NIS.unity';
  const scene11 = 'Assets/Examples/Scenes/Scene 7 New Input System Actions.unity';

  beforeAll(async () => {
    altDriver = await connectDriver();
  });
  afterAll(async () => {
    await altDriver?.stop();
  });
  beforeEach(async () => {
    await altDriver.resetInput();
  });

  async function getSpriteName(sourceImageName: string, imageSourceDropZoneName: string): Promise<[string, string]> {
    const imageSource = await (await altDriver.findObject(By.NAME, sourceImageName))
      .getComponentProperty<string>('UnityEngine.UI.Image', 'sprite.name', 'UnityEngine.UI');
    const imageSourceDropZone = await (await altDriver.findObject(By.NAME, imageSourceDropZoneName))
      .getComponentProperty<string>('UnityEngine.UI.Image', 'sprite.name', 'UnityEngine.UI');
    return [imageSource, imageSourceDropZone];
  }

  async function dropImageWithMultipointSwipe(objectNames: string[], duration = 1, wait = true): Promise<void> {
    const listPositions: AltVector2[] = [];
    for (const name of objectNames) {
      const obj = await altDriver.findObject(By.NAME, name);
      listPositions.push(obj.getScreenPosition());
    }
    await altDriver.multipointSwipe(listPositions, duration, wait);
  }

  async function keyboardKeyPress(player: AltObject, altKeyCode: number): Promise<void> {
    if (keyCodeNames.has(altKeyCode)) {
      await altDriver.pressKey(altKeyCode);
      const keyPressed = await player.getComponentProperty<number[]>('AltNIPDebugScript', 'KeyPressed', 'Assembly-CSharp');
      const keyReleased = await player.getComponentProperty<number[]>('AltNIPDebugScript', 'KeyReleased', 'Assembly-CSharp');
      expect(keyPressed).toContain(altKeyCode);
      expect(keyReleased).toContain(altKeyCode);
    }
  }

  // The unused C# helpers keyboardKeyDownAndUp, joystickKeyDownAndUp and joystickKeyPress are not ported.

  const position = (player: AltObject) =>
    player.getComponentProperty<AltVector3>('UnityEngine.Transform', 'position', 'UnityEngine.CoreModule');

  // [Ignore("This needs more investigation")] is commented out in C#
  it('TestScroll', async () => {
    await altDriver.loadScene(scene10);
    const player = await altDriver.findObject(By.NAME, 'Player');
    expect(await player.getComponentProperty<boolean>('AltNIPDebugScript', 'wasScrolled', 'Assembly-CSharp')).toBe(false);
    await altDriver.scroll(300, 0.5, true);
    expect(await player.getComponentProperty<boolean>('AltNIPDebugScript', 'wasScrolled', 'Assembly-CSharp')).toBe(true);
  });

  it('TestTapElement', async () => {
    await altDriver.loadScene(scene8);
    const closeButton = await altDriver.findObject(By.PATH, '//Panel Drag Area/Panel/Close Button');
    await closeButton.tap();
    await altDriver.waitForObjectToNotBePresent(By.PATH, '//Panel Drag Area/Panel');
  });

  it('TestTapCoordinates', async () => {
    await altDriver.loadScene(scene8);
    const closeButton = await altDriver.findObject(By.PATH, '//Panel Drag Area/Panel/Close Button');
    await altDriver.tap(closeButton.getScreenPosition());
    await altDriver.waitForObjectToNotBePresent(By.PATH, '//Panel Drag Area/Panel');
  });

  it('TestScrollElement', async () => {
    await altDriver.loadScene(scene9);
    const scrollbar = await altDriver.findObject(By.NAME, 'Scrollbar Vertical');
    const scrollbarPosition = await scrollbar.getComponentProperty<number>('UnityEngine.UI.Scrollbar', 'value', 'UnityEngine.UI');
    await altDriver.moveMouse((await altDriver.findObject(By.NAME, 'Scroll View')).getScreenPosition(), 0.5);
    await altDriver.scroll({ x: -3000, y: -3000 }, 0.5, true);
    const scrollbarPositionFinal = await scrollbar.getComponentProperty<number>(
      'UnityEngine.UI.Scrollbar', 'value', 'UnityEngine.UI');
    expect(scrollbarPositionFinal).not.toEqual(scrollbarPosition);
  });

  it('TestClickElement', async () => {
    await altDriver.loadScene(scene11);
    const capsule = await altDriver.findObject(By.NAME, 'Capsule');
    await capsule.click();
    const counter = await capsule.getComponentProperty<number>('AltExampleNewInputSystem', 'jumpCounter', 'Assembly-CSharp');
    expect(counter).toBe(1);
  });

  it('TestPressKey', async () => {
    await altDriver.loadScene(scene10);
    const player = await altDriver.findObject(By.NAME, 'Player');
    const initialPos = await position(player);
    await altDriver.pressKey(AltKeyCode.A);
    const leftPos = await position(player);
    expect(leftPos).not.toEqual(initialPos);
    await altDriver.pressKey(AltKeyCode.D);
    const rightPos = await position(player);
    expect(rightPos).not.toEqual(leftPos);
    await altDriver.pressKey(AltKeyCode.W);
    const upPos = await position(player);
    expect(upPos).not.toEqual(rightPos);
    await altDriver.pressKey(AltKeyCode.S);
    const downPos = await position(player);
    expect(downPos).not.toEqual(upPos);
  });

  it('TestPressKeys', async () => {
    await altDriver.loadScene(scene10);
    const player = await altDriver.findObject(By.NAME, 'Player');
    const initialPos = await position(player);
    const keys = [AltKeyCode.W, AltKeyCode.Mouse0];
    await altDriver.pressKeys(keys, 1, 0.1);
    const finalPos = await position(player);
    await altDriver.waitForObject(By.NAME, 'SimpleProjectile(Clone)');
    expect(finalPos).not.toEqual(initialPos);
  });

  it('TestPressAllKeys', async () => {
    await altDriver.loadScene(scene10);
    const player = await altDriver.findObject(By.NAME, 'Player');
    // because F13->F15 is present in KeyCode but not in Key
    for (let altKeyCode: number = AltKeyCode.Backspace; altKeyCode <= AltKeyCode.F12; altKeyCode++)
      await keyboardKeyPress(player, altKeyCode);
    for (let altKeyCode: number = AltKeyCode.Numlock; altKeyCode <= AltKeyCode.Menu; altKeyCode++)
      await keyboardKeyPress(player, altKeyCode);
    for (let altKeyCode: number = AltKeyCode.Mouse0; altKeyCode <= AltKeyCode.Mouse4; altKeyCode++) {
      if (keyCodeNames.has(altKeyCode)) {
        await altDriver.pressKey(altKeyCode);
        const keyPressed = await player.getComponentProperty<string>('AltNIPDebugScript', 'MousePressed', 'Assembly-CSharp');
        const keyReleased = await player.getComponentProperty<string>(
          'AltNIPDebugScript', 'MouseReleased', 'Assembly-CSharp');
        expect(keyPressed).toBe(keyCodeNames.get(altKeyCode));
        expect(keyReleased).toBe(keyCodeNames.get(altKeyCode));
      }
    }
  });

  it('TestClickCoordinates', async () => {
    await altDriver.loadScene(scene11);
    const capsule = await altDriver.findObject(By.NAME, 'Capsule');
    await altDriver.click(capsule.getScreenPosition());
    await altDriver.waitForObject(By.PATH, '//ActionText[@text=Capsule was clicked!]', By.NAME, '', 1);
  });

  // [Category("Mobile")] [Ignore("Test made for mobile")]
  it.skip('TestTilt', async () => {
    await altDriver.loadScene(scene11);
    const cube = await altDriver.findObject(By.NAME, 'Cube (1)');
    const initialPosition = cube.getWorldPosition();
    await altDriver.tilt({ x: 5, y: 0, z: 5 }, 1);
    expect((await altDriver.findObject(By.NAME, 'Cube (1)')).getWorldPosition()).not.toEqual(initialPosition);
    expect(await cube.getComponentProperty<boolean>('AltCubeNIS', 'isMoved', 'Assembly-CSharp')).toBe(true);
  });

  it('TestSwipe', async () => {
    await altDriver.loadScene(scene9);
    const scrollbarPosition = (await altDriver.findObject(By.NAME, 'Handle')).getScreenPosition();
    const button = await altDriver.findObject(By.PATH, '//Scroll View/Viewport/Content/Button (4)');
    await altDriver.swipe({ x: button.x + 1, y: button.y + 1 }, { x: button.x + 1, y: button.y + 20 }, 1);
    const scrollbarPositionFinal = (await altDriver.findObject(By.NAME, 'Handle')).getScreenPosition();
    expect(scrollbarPositionFinal.y).not.toEqual(scrollbarPosition.y);
  });

  it('TestMultipointSwipe', async () => {
    await altDriver.loadScene(scene7);
    await dropImageWithMultipointSwipe(['Drag Image1', 'Drop Box1']);
    await dropImageWithMultipointSwipe(['Drag Image2', 'Drop Box1', 'Drop Box2']);
    let [imageSource, imageSourceDropZone] = await getSpriteName('Drag Image1', 'Drop Image');
    expect(imageSourceDropZone).toBe(imageSource);
    [imageSource, imageSourceDropZone] = await getSpriteName('Drag Image2', 'Drop');
    expect(imageSourceDropZone).toBe(imageSource);
  });

  it('TestKeyDownAndKeyUp', async () => {
    await altDriver.loadScene(scene8);
    const panelToDrag = await altDriver.findObject(By.PATH, '//Panel/Drag Zone');
    const initialPanelPos = panelToDrag.getScreenPosition();
    await altDriver.moveMouse(initialPanelPos, 0.1);
    await altDriver.keyDown(AltKeyCode.Mouse0);
    await altDriver.moveMouse({ x: initialPanelPos.x + 1, y: initialPanelPos.y + 1 }, 0.1);
    await altDriver.moveMouse({ x: initialPanelPos.x + 200, y: initialPanelPos.y + 20 }, 0.4);
    await altDriver.keyUp(AltKeyCode.Mouse0);
    const finalPanelPos = (await altDriver.findObject(By.PATH, '//Panel/Drag Zone')).getScreenPosition();
    expect(finalPanelPos).not.toEqual(initialPanelPos);
  });

  it('TestBeginMoveEndTouch', async () => {
    await altDriver.loadScene(scene8);
    const panelToDrag = await altDriver.findObject(By.PATH, '//Panel/Drag Zone');
    const initialPanelPos = panelToDrag.getScreenPosition();
    const fingerId = await altDriver.beginTouch(initialPanelPos);
    await altDriver.moveTouch(fingerId, { x: initialPanelPos.x + 1, y: initialPanelPos.y + 1 });
    await altDriver.moveTouch(fingerId, { x: initialPanelPos.x + 200, y: initialPanelPos.y + 20 });
    await altDriver.endTouch(fingerId);
    const finalPanelPos = (await altDriver.findObject(By.PATH, '//Panel/Drag Zone')).getScreenPosition();
    expect(finalPanelPos).not.toEqual(initialPanelPos);
  });

  it('TestCapsuleJumps', async () => {
    await altDriver.loadScene(scene11);
    const capsule = await altDriver.findObject(By.NAME, 'Capsule');
    const fingerId = await altDriver.beginTouch(capsule.getScreenPosition());
    await altDriver.endTouch(fingerId);
    const text = await capsule.getComponentProperty<string>('AltExampleNewInputSystem', 'actionText.text', 'Assembly-CSharp');
    expect(text).toBe('Capsule was tapped!');
  });

  // [Ignore("Flaky test, needs investigation")]
  it.skip.each([1, 2, 3])('TestCheckActionDoNotDoubleClick(%i)', async (numberOfClicks) => {
    await altDriver.loadScene(scene11);
    const interval = 0.3;
    altDriver.setDelayAfterCommand(0.1);
    const counterButton = await altDriver.findObject(By.NAME, 'Canvas/Button');
    const text = await altDriver.findObject(By.NAME, 'Canvas/Button/Text');
    await counterButton.click(numberOfClicks, interval);
    expect(parseInt(await text.getText(), 10)).toBe(numberOfClicks);
    await counterButton.tap(numberOfClicks, interval);
    expect(parseInt(await text.getText(), 10)).toBe(2 * numberOfClicks);
    await altDriver.click(counterButton.getScreenPosition(), numberOfClicks, interval);
    expect(parseInt(await text.getText(), 10)).toBe(3 * numberOfClicks);
    await altDriver.tap(counterButton.getScreenPosition(), numberOfClicks, interval);
    expect(parseInt(await text.getText(), 10)).toBe(4 * numberOfClicks);
    await altDriver.moveMouse(counterButton.getScreenPosition(), interval);
    for (let i = 0; i < numberOfClicks; i++) {
      await altDriver.keyDown(AltKeyCode.Mouse0);
      await altDriver.keyUp(AltKeyCode.Mouse0);
    }
    expect(parseInt(await text.getText(), 10)).toBe(5 * numberOfClicks);
    for (let i = 0; i < numberOfClicks; i++) {
      await altDriver.holdButton(counterButton.getScreenPosition(), 0.1);
    }
    expect(parseInt(await text.getText(), 10)).toBe(6 * numberOfClicks);
    altDriver.setDelayAfterCommand(0);
  });

  it('TestOnScreenInput', async () => {
    await altDriver.loadScene(scene10);
    const initialPlayerPos = (await altDriver.findObject(By.NAME, 'Player')).getWorldPosition();
    await (await altDriver.findObject(By.NAME, 'Button')).tap();
    const playerPos = (await altDriver.findObject(By.NAME, 'Player')).getWorldPosition();
    expect(playerPos).not.toEqual(initialPlayerPos);
    const stick = await altDriver.findObject(By.NAME, 'Stick');
    const stickPos = stick.getScreenPosition();
    await altDriver.swipe(stickPos, { x: stickPos.x * 2, y: stickPos.y * 2 }, 1);
    const finalPlayerPos = (await altDriver.findObject(By.NAME, 'Player')).getWorldPosition();
    expect(finalPlayerPos).not.toEqual(playerPos);
  });

  it('TestMoveMouseDelta', async () => {
    await altDriver.loadScene(scene11);
    await altDriver.pressKey(AltKeyCode.L);
    const eulerAngles = async () => (await altDriver.findObject(By.NAME, 'Main Camera'))
      .getComponentProperty<AltVector3>('UnityEngine.Transform', 'eulerAngles', 'UnityEngine.CoreModule');
    const initialRotation = await eulerAngles();
    await altDriver.moveMouse({ x: 100, y: 100 }, 1);
    const finalRotation = await eulerAngles();
    expect(finalRotation).not.toEqual(initialRotation);
    await altDriver.pressKey(AltKeyCode.L);
  });
});

