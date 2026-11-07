// Port of Bindings~/python/tests/integration/test_scene03.py
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { By, type AltDriver, type AltVector2 } from '../../../src/binding';
import { connectDriver, Scenes } from './setup';

type Color = { r: number; g: number; b: number; a: number };

describe('TestScene03', () => {
  let d: AltDriver;
  beforeAll(async () => { d = await connectDriver(); });
  afterAll(async () => { await d?.stop(); });
  beforeEach(async () => {
    await (await d.findObject(By.PATH, '/AltTesterPrefab//CloseButton', By.NAME, '', false)).tap();
    await d.resetInput();
    await d.loadScene(Scenes.Scene03);
  });

  async function waitForSwipeToFinish(): Promise<void> {
    await d.waitForObjectToNotBePresent(By.NAME, 'icon');
  }

  async function getSpriteName(sourceImageName: string, imageSourceDropZoneName: string): Promise<[unknown, unknown]> {
    const imageSource = await (await d.findObject(By.NAME, sourceImageName))
      .getComponentProperty('UnityEngine.UI.Image', 'sprite.name', 'UnityEngine.UI');
    const imageSourceDropZone = await (await d.findObject(By.NAME, imageSourceDropZoneName))
      .getComponentProperty('UnityEngine.UI.Image', 'sprite.name', 'UnityEngine.UI');
    return [imageSource, imageSourceDropZone];
  }

  async function dropImageWithMultipointSwipe(objectNames: string[], duration: number, wait: boolean): Promise<void> {
    const positions: AltVector2[] = [];
    for (const name of objectNames) {
      const altObject = await d.findObject(By.NAME, name);
      positions.push(altObject.getScreenPosition());
    }
    await d.multipointSwipe(positions, duration, wait);
  }

  async function dropImage(dragLocationName: string, dropLocationName: string, duration: number, wait: boolean): Promise<void> {
    const dragLocation = await d.findObject(By.NAME, dragLocationName);
    const dropLocation = await d.findObject(By.NAME, dropLocationName);
    await d.swipe(dragLocation.getScreenPosition(), dropLocation.getScreenPosition(), duration, wait);
  }

  it('test_pointer_enter_and_exit', async () => {
    const altObject = await d.findObject(By.NAME, 'Drop Image');
    const color1 = await altObject.getComponentProperty<Color>('AltExampleScriptDropMe', 'highlightColor', 'Assembly-CSharp');
    await altObject.pointerEnter();
    const color2 = await altObject.getComponentProperty<Color>('AltExampleScriptDropMe', 'highlightColor', 'Assembly-CSharp');

    expect(color1.r !== color2.r || color1.g !== color2.g || color1.b !== color2.b || color1.a !== color2.a).toBe(true);

    await altObject.pointerExit();
    const color3 = await altObject.getComponentProperty<Color>('AltExampleScriptDropMe', 'highlightColor', 'Assembly-CSharp');

    expect(color3.r !== color2.r || color3.g !== color2.g || color3.b !== color2.b || color3.a !== color2.a).toBe(true);

    expect(color3.r === color1.r && color3.g === color1.g && color3.b === color1.b && color3.a === color1.a).toBe(true);
  });

  it('test_multiple_swipes', async () => {
    await dropImage('Drag Image2', 'Drop Box2', 1, false);
    await dropImage('Drag Image2', 'Drop Box1', 1, false);
    await dropImage('Drag Image1', 'Drop Box1', 2, false);
    await waitForSwipeToFinish();
    let [imageSource, imageSourceDropZone] = await getSpriteName('Drag Image1', 'Drop Image');
    expect(imageSource).toEqual(imageSourceDropZone);

    [imageSource, imageSourceDropZone] = await getSpriteName('Drag Image2', 'Drop');
    expect(imageSource).toEqual(imageSourceDropZone);
  });

  it('test_multiple_swipe_and_waits', async () => {
    await dropImage('Drag Image2', 'Drop Box2', 1, true);
    await dropImage('Drag Image2', 'Drop Box1', 1, true);
    await dropImage('Drag Image1', 'Drop Box1', 1, true);
    let [imageSource, imageSourceDropZone] = await getSpriteName('Drag Image1', 'Drop Image');
    expect(imageSource).toEqual(imageSourceDropZone);

    [imageSource, imageSourceDropZone] = await getSpriteName('Drag Image2', 'Drop');
    expect(imageSource).toEqual(imageSourceDropZone);
  });

  it('test_multiple_swipe_with_multipoint_swipe', async () => {
    await dropImageWithMultipointSwipe(['Drag Image1', 'Drop Box1'], 1, false);
    await dropImageWithMultipointSwipe(['Drag Image2', 'Drop Box1', 'Drop Box2'], 1, true);

    let [imageSource, imageSourceDropZone] = await getSpriteName('Drag Image1', 'Drop Image');
    expect(imageSource).toEqual(imageSourceDropZone);

    [imageSource, imageSourceDropZone] = await getSpriteName('Drag Image2', 'Drop');
    expect(imageSource).toEqual(imageSourceDropZone);
  });

  it('test_multiple_swipe_and_waits_with_multipoint_swipe', async () => {
    await dropImageWithMultipointSwipe(['Drag Image1', 'Drop Box1'], 1, true);
    await dropImageWithMultipointSwipe(['Drag Image2', 'Drop Box1', 'Drop Box2'], 1, true);

    let [imageSource, imageSourceDropZone] = await getSpriteName('Drag Image1', 'Drop Image');
    expect(imageSource).toEqual(imageSourceDropZone);

    [imageSource, imageSourceDropZone] = await getSpriteName('Drag Image2', 'Drop');
    expect(imageSource).toEqual(imageSourceDropZone);
  });

  it('test_begin_move_end_touch', async () => {
    const greenPopUp = await d.findObject(By.PATH, '/AltTesterPrefab//CloseButton', By.NAME, '', false);
    if (greenPopUp.enabled) {
      await greenPopUp.click();
    }
    const altObject1 = await d.findObject(By.NAME, 'Drag Image1');
    const altObject2 = await d.findObject(By.NAME, 'Drop Box1');

    const id = await d.beginTouch(altObject1.getScreenPosition());
    await d.moveTouch(id, altObject2.getScreenPosition());
    await d.endTouch(id);

    const imageSource = await altObject1.getComponentProperty('UnityEngine.UI.Image', 'sprite.name', 'UnityEngine.UI');
    const imageSourceDropZone = await (await d.findObject(By.NAME, 'Drop Image'))
      .getComponentProperty('UnityEngine.UI.Image', 'sprite.name', 'UnityEngine.UI');

    expect(imageSource).toEqual(imageSourceDropZone);
  });
});
