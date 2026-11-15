// Port of TestForScene3DragAndDrop.cs (TestForScene3DragAndDrop) from AltTester-Unity-SDK-Closed-Source sdk-package/Assets/Examples/Test/Editor/Driver
import { describe, expect, it } from 'vitest';
import { By, type AltVector2 } from '../../../src/binding';
import { Scenes } from './setup';
import { useTestBase } from './testBase';

// [Timeout(10000)] on the C# fixture.
describe('TestForScene3DragAndDrop', { timeout: 10_000 }, () => {
  const getDriver = useTestBase(Scenes.Scene03);

  async function waitForSwipeToFinish(): Promise<void> {
    await getDriver().waitForObjectToNotBePresent(By.NAME, 'icon');
  }

  async function getSpriteName(sourceImageName: string, imageSourceDropZoneName: string): Promise<[string, string]> {
    const altDriver = getDriver();
    const imageSource = await (await altDriver.findObject(By.NAME, sourceImageName))
      .getComponentProperty<string>('UnityEngine.UI.Image', 'sprite.name', 'UnityEngine.UI');
    const imageSourceDropZone = await (await altDriver.findObject(By.NAME, imageSourceDropZoneName))
      .getComponentProperty<string>('UnityEngine.UI.Image', 'sprite.name', 'UnityEngine.UI');
    return [imageSource, imageSourceDropZone];
  }

  async function dropImage(dragLocationName: string, dropLocationName: string, duration = 1, wait = true): Promise<void> {
    const altDriver = getDriver();
    const dragLocation = await altDriver.findObject(By.NAME, dragLocationName);
    const dropLocation = await altDriver.findObject(By.NAME, dropLocationName);
    await altDriver.swipe({ x: dragLocation.x, y: dragLocation.y }, { x: dropLocation.x, y: dropLocation.y }, duration, wait);
  }

  async function dropImageWithMultipointSwipe(objectNames: string[], duration = 1, wait = true): Promise<void> {
    const altDriver = getDriver();
    const listPositions: AltVector2[] = [];
    for (const name of objectNames) {
      const obj = await altDriver.findObject(By.NAME, name);
      listPositions.push(obj.getScreenPosition());
    }
    await altDriver.multipointSwipe(listPositions, duration, wait);
  }

  it('MultipleDragAndDrop', async () => {
    await dropImage('Drag Image2', 'Drop Box1', 1, false);
    await dropImage('Drag Image2', 'Drop Box2', 1, false);
    await dropImage('Drag Image1', 'Drop Box1', 2, false);
    await waitForSwipeToFinish();
    let [imageSource, imageSourceDropZone] = await getSpriteName('Drag Image1', 'Drop Image');
    expect(imageSourceDropZone).toBe(imageSource);
    [imageSource, imageSourceDropZone] = await getSpriteName('Drag Image2', 'Drop');
    expect(imageSourceDropZone).toBe(imageSource);
  });

  it('MultipleDragAndDropWait', async () => {
    await dropImage('Drag Image2', 'Drop Box1');
    await dropImage('Drag Image2', 'Drop Box2');
    await dropImage('Drag Image1', 'Drop Box1');
    let [imageSource, imageSourceDropZone] = await getSpriteName('Drag Image1', 'Drop Image');
    expect(imageSourceDropZone).toBe(imageSource);
    [imageSource, imageSourceDropZone] = await getSpriteName('Drag Image2', 'Drop');
    expect(imageSourceDropZone).toBe(imageSource);
  });

  it('MultipleDragAndDropWaitWithMultipointSwipe', async () => {
    await dropImageWithMultipointSwipe(['Drag Image1', 'Drop Box1']);
    await dropImageWithMultipointSwipe(['Drag Image2', 'Drop Box1', 'Drop Box2']);
    let [imageSource, imageSourceDropZone] = await getSpriteName('Drag Image1', 'Drop Image');
    expect(imageSourceDropZone).toBe(imageSource);
    [imageSource, imageSourceDropZone] = await getSpriteName('Drag Image2', 'Drop');
    expect(imageSourceDropZone).toBe(imageSource);
  });

  it('TestPointerEnterAndExit', async () => {
    const altDriver = getDriver();
    const altElement = await altDriver.findObject(By.NAME, 'Drop Image');
    const color1 = await altElement.getComponentProperty('AltExampleScriptDropMe', 'highlightColor', 'Assembly-CSharp');
    await (await altDriver.findObject(By.NAME, 'Drop Image')).pointerEnter();
    const color2 = await altElement.getComponentProperty('AltExampleScriptDropMe', 'highlightColor', 'Assembly-CSharp');
    expect(color2).not.toEqual(color1);
    await (await altDriver.findObject(By.NAME, 'Drop Image')).pointerExit();
    const color3 = await altElement.getComponentProperty('AltExampleScriptDropMe', 'highlightColor', 'Assembly-CSharp');
    expect(color2).not.toEqual(color3);
    expect(color3).toEqual(color1);
  });

  it('TestDragAndDrop', async () => {
    const altDriver = getDriver();
    const altElement1 = await altDriver.findObject(By.NAME, 'Drag Image1');
    const altElement2 = await altDriver.findObject(By.NAME, 'Drop Box1');
    const fingerId = await altDriver.beginTouch(altElement1.getScreenPosition());
    await altDriver.moveTouch(fingerId, altElement2.getScreenPosition());
    await altDriver.endTouch(fingerId);
    const [imageSource, imageSourceDropZone] = await getSpriteName('Drag Image1', 'Drop Image');
    expect(imageSourceDropZone).toBe(imageSource);
  });
});
