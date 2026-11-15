// Port of TestForscene2DraggablePanel.cs (TestForScene2DraggablePanel) from AltTester-Unity-SDK-Closed-Source sdk-package/Assets/Examples/Test/Editor/Driver
import { describe, expect, it } from 'vitest';
import { By, NotFoundException, type AltColor } from '../../../src/binding';
import { Scenes, sleep } from './setup';
import { useTestBase } from './testBase';

// [Timeout(10000)] on the C# class
describe('TestForScene2DraggablePanel', { timeout: 10_000 }, () => {
  const getDriver = useTestBase(Scenes.Scene02);

  it('TestResizePanel', async () => {
    const altDriver = getDriver();
    let altElement = await altDriver.findObject(By.NAME, 'Resize Zone');
    const position = { x: altElement.x, y: altElement.y };
    await altDriver.swipe(altElement.getScreenPosition(), { x: altElement.x - 200, y: altElement.y - 200 }, 2);

    altElement = await altDriver.findObject(By.NAME, 'Resize Zone');
    const position2 = { x: altElement.x, y: altElement.y };
    expect(position2).not.toEqual(position);
  });

  it('TestResizePanelWithMultipointSwipe', async () => {
    const altDriver = getDriver();
    let altElement = await altDriver.findObject(By.NAME, 'Resize Zone');
    const position = { x: altElement.x, y: altElement.y };
    const pos = [
      altElement.getScreenPosition(),
      { x: altElement.x - 200, y: altElement.y - 200 },
      { x: altElement.x - 300, y: altElement.y - 100 },
      { x: altElement.x - 50, y: altElement.y - 100 },
      { x: altElement.x - 100, y: altElement.y - 100 },
    ];
    await altDriver.multipointSwipe(pos, 4);

    altElement = await altDriver.findObject(By.NAME, 'Resize Zone');
    const position2 = { x: altElement.x, y: altElement.y };
    expect(position2).not.toEqual(position);
  });

  it('TestMovePanel', async () => {
    const altDriver = getDriver();
    let altElement = await altDriver.findObject(By.NAME, 'Drag Zone');
    const position = { x: altElement.x, y: altElement.y };
    await altDriver.swipe({ x: altElement.x, y: altElement.y }, { x: altElement.x + 200, y: altElement.y + 200 }, 2, false);
    await sleep(2);
    altElement = await altDriver.findObject(By.NAME, 'Drag Zone');
    const position2 = { x: altElement.x, y: altElement.y };

    expect(position2).not.toEqual(position);
  });

  it('TestClosePanel', async () => {
    const altDriver = getDriver();
    await altDriver.waitForObject(By.NAME, 'Panel Drag Area', By.NAME, '', 2);
    expect((await altDriver.findObject(By.NAME, 'Panel')).enabled).toBe(true);
    let altElement = await altDriver.findObject(By.NAME, 'Close Button');
    await altElement.click();

    altElement = await altDriver.findObject(By.NAME, 'Button');
    await altElement.click();
    expect((await altDriver.findObject(By.NAME, 'Panel')).enabled).toBe(true);
  });

  it('TestGetAllEnabledElements', async () => {
    const altDriver = getDriver();
    await sleep(2);

    const altElements = await altDriver.getAllElements(By.NAME, '', true);
    expect(altElements).not.toHaveLength(0);

    expect(altElements.length >= 22).toBe(true);
    // C# Assert.IsNotNull(altElements.Where(...)) never fails (Where returns a non-null sequence); kept as is.
    for (const name of [
      'EventSystem', 'Canvas', 'Panel Drag Area', 'Panel', 'Header', 'Text', 'Drag Zone', 'Resize Zone',
      'Close Button', 'Debugging', 'SF Scene Elements', 'Main Camera', 'Background', 'Particle System',
    ]) {
      expect(altElements.filter((p) => p.name === name)).not.toBeNull();
    }
  });

  it('TestGetAllElements', async () => {
    const altDriver = getDriver();
    await altDriver.waitForObject(By.NAME, 'EventSystem', By.NAME, '', 2);

    const altElements = await altDriver.getAllElements(By.NAME, '', false);
    expect(altElements).not.toHaveLength(0);

    expect(altElements.length >= 45, `Number of elements returned: ${altElements.length}`).toBe(true);

    // C# Assert.IsNotNull(altElements.Where(...)) never fails (Where returns a non-null sequence); kept as is.
    for (const name of [
      'EventSystem', 'Canvas', 'Panel Drag Area', 'Panel', 'Header', 'Text', 'Drag Zone', 'Resize Zone',
      'Close Button', 'Debugging', 'SF Scene Elements', 'Main Camera', 'Background', 'Particle System', 'PopUp',
    ]) {
      expect(altElements.filter((p) => p.name === name)).not.toBeNull();
    }
  });

  it('TestPointerDown', async () => {
    const altDriver = getDriver();
    const panel = await altDriver.findObject(By.NAME, 'Panel');
    const color1 = await panel.getComponentProperty<AltColor>('AltExampleScriptPanel', 'normalColor', 'Assembly-CSharp');
    await panel.pointerDown();
    await sleep(1);
    const color2 = await panel.getComponentProperty<AltColor>('AltExampleScriptPanel', 'highlightColor', 'Assembly-CSharp');
    expect(color2).not.toEqual(color1);
  });

  it('TestPointerUp', async () => {
    const altDriver = getDriver();
    const panel = await altDriver.findObject(By.NAME, 'Panel');
    const color1 = await panel.getComponentProperty<AltColor>('AltExampleScriptPanel', 'normalColor', 'Assembly-CSharp');
    await panel.pointerDown();
    await sleep(1);
    await panel.pointerUp();
    const color2 = await panel.getComponentProperty<AltColor>('AltExampleScriptPanel', 'highlightColor', 'Assembly-CSharp');
    expect(color2).toEqual(color1);
  });

  it.each([
    ['Main Camera', 'SF Scene Elements'],
    ['Background', 'SF Scene Elements'],
    ['Particle System', 'SF Scene Elements'],
    ['Panel Drag Area', 'Canvas'],
    ['Panel', 'Panel Drag Area'],
    ['Drag Zone', 'Panel'],
    ['Close Button/Text', 'Close Button'],
    ['Button/Text', 'Button'],
    ['Debugging', 'Canvas'],
  ])('TestGetParent("%s", "%s")', async (nameValue, parentValue) => {
    const altDriver = getDriver();
    const altElement = await altDriver.findObject(By.NAME, nameValue);
    const altElementParent = await altElement.getParent();
    expect(altElementParent.name).toBe(parentValue);
  });

  it.each(['EventSystem', 'Canvas', 'SF Scene Elements'])('TestGetNonExistingParent("%s")', async (nameValue) => {
    const altDriver = getDriver();
    const altElement = await altDriver.findObject(By.NAME, nameValue);
    await expect(altElement.getParent()).rejects.toThrow(NotFoundException);
  });

  it('TestGetAllScenesAndElements', async () => {
    const altDriver = getDriver();
    let altElements = await altDriver.getAllLoadedScenesAndObjects();

    expect(altElements.findIndex((e) => e.name === 'DontDestroyOnLoad')).toBe(20);
    altElements = await altDriver.getAllLoadedScenesAndObjects(false);
    expect(altElements.findIndex((e) => e.name === 'DontDestroyOnLoad')).toBe(20);
  });

  it('TestNewTouchCommands', async () => {
    const altDriver = getDriver();
    let draggableArea = await altDriver.findObject(By.NAME, 'Drag Zone');
    const initialPosition = draggableArea.getScreenPosition();
    const fingerId = await altDriver.beginTouch(draggableArea.getScreenPosition());
    const newPosition = { x: draggableArea.x + 20, y: draggableArea.y + 10 };
    await altDriver.moveTouch(fingerId, newPosition);
    await altDriver.endTouch(fingerId);
    draggableArea = await altDriver.findObject(By.NAME, 'Drag Zone');
    expect(draggableArea.getScreenPosition()).not.toEqual(initialPosition);
  });

  it('TestCreateTouchTwice', async () => {
    const altDriver = getDriver();
    let draggableArea = await altDriver.findObject(By.NAME, 'Drag Zone');
    const initialPosition = draggableArea.getScreenPosition();
    let fingerId = await altDriver.beginTouch(draggableArea.getScreenPosition());
    let newPosition = { x: draggableArea.x + 20, y: draggableArea.y + 10 };
    await altDriver.moveTouch(fingerId, newPosition);
    await altDriver.endTouch(fingerId);
    draggableArea = await altDriver.findObject(By.NAME, 'Drag Zone');
    const secondPosition = draggableArea.getScreenPosition();
    expect(secondPosition).not.toEqual(initialPosition);

    fingerId = await altDriver.beginTouch(draggableArea.getScreenPosition());
    newPosition = { x: draggableArea.x + 20, y: draggableArea.y + 10 };
    await altDriver.moveTouch(fingerId, newPosition);
    await altDriver.endTouch(fingerId);
    draggableArea = await altDriver.findObject(By.NAME, 'Drag Zone');
    expect(draggableArea.getScreenPosition()).not.toEqual(secondPosition);
  });
});
