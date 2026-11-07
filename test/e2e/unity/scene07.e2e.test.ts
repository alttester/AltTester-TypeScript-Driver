// Port of Bindings~/python/tests/integration/test_scene07.py
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { By, type AltDriver } from '../../../src/binding';
import { closeAltTesterPopup, connectDriver, Scenes } from './setup';

describe('TestScene07A', () => {
  let d: AltDriver;
  beforeAll(async () => { d = await connectDriver(); });
  afterAll(async () => { await d?.stop(); });
  beforeEach(async () => {
    await closeAltTesterPopup(d);
    await d.resetInput();
    await d.loadScene(Scenes.Scene07A);
  });

  it('test_tap_element_NIS', async () => {
    const capsule = await d.findObject(By.NAME, 'Capsule');
    await capsule.tap();

    const componentName = 'AltExampleNewInputSystem';
    const propertyName = 'jumpCounter';

    const propertyValue = await capsule.getComponentProperty(componentName, propertyName, 'Assembly-CSharp', 1);

    expect(propertyValue).toBe(1);
  });

  it('test_tap_coordinates_NIS', async () => {
    const capsule = await d.findObject(By.NAME, 'Capsule');
    await d.tap(capsule.getScreenPosition());

    const actionInfo = await d.waitForObject(By.PATH, '//ActionText[@text=Capsule was tapped!]', By.NAME, '', 1);

    expect(await actionInfo.getText()).toBe('Capsule was tapped!');
  });

  it('test_click_element_NIS', async () => {
    const capsule = await d.findObject(By.NAME, 'Capsule');
    await capsule.click();

    const componentName = 'AltExampleNewInputSystem';
    const propertyName = 'jumpCounter';
    const propertyValue = await capsule.getComponentProperty(componentName, propertyName, 'Assembly-CSharp', 1);

    expect(propertyValue).toBe(1);
  });

  it('test_click_coordinates_NIS', async () => {
    const capsule = await d.findObject(By.NAME, 'Capsule');
    await d.click(capsule.getScreenPosition());
    const actionInfo = await d.waitForObject(By.PATH, '//ActionText[@text=Capsule was clicked!]', By.NAME, '', 1);

    expect(await actionInfo.getText()).toBe('Capsule was clicked!');
  });

  // Skipped in Python too: "This test needs more investigation".
  it.skip('test_tilt', async () => {
    const cube = await d.findObject(By.NAME, 'Cube (1)');
    const initialPosition = cube.getWorldPosition();
    await d.tilt({ x: 1000, y: 10, z: 10 }, 1);
    expect((await d.findObject(By.NAME, 'Cube (1)')).getWorldPosition()).not.toEqual(initialPosition);

    const isMoved = await cube.getComponentProperty('AltCubeNIS', 'isMoved', 'Assembly-CSharp');
    expect(isMoved).toBeTruthy();
  });
});

describe('TestScene07B', () => {
  let d: AltDriver;
  beforeAll(async () => { d = await connectDriver(); });
  afterAll(async () => { await d?.stop(); });
  beforeEach(async () => {
    await d.loadScene(Scenes.Scene07B);
  });

  async function getSpriteName(sourceImageName: string, imageSourceDropZoneName: string): Promise<[unknown, unknown]> {
    const imageSource = await (await d.findObject(By.NAME, sourceImageName))
      .getComponentProperty('UnityEngine.UI.Image', 'sprite.name', 'UnityEngine.UI');
    const imageSourceDropZone = await (await d.findObject(By.NAME, imageSourceDropZoneName))
      .getComponentProperty('UnityEngine.UI.Image', 'sprite.name', 'UnityEngine.UI');
    return [imageSource, imageSourceDropZone];
  }

  async function dropImageWithMultipointSwipe(objectNames: string[], duration: number, wait: boolean): Promise<void> {
    const positions = [];
    for (const name of objectNames) {
      const altObject = await d.findObject(By.NAME, name);
      positions.push(altObject.getScreenPosition());
    }

    await d.multipointSwipe(positions, duration, wait);
  }

  it('test_multipoint_swipe_NIS', async () => {
    await dropImageWithMultipointSwipe(['Drag Image1', 'Drop Box1'], 1, false);
    await dropImageWithMultipointSwipe(['Drag Image2', 'Drop Box1', 'Drop Box2'], 1, true);

    let [imageSource, imageSourceDropZone] = await getSpriteName('Drag Image1', 'Drop Image');
    expect(imageSource).toEqual(imageSourceDropZone);

    [imageSource, imageSourceDropZone] = await getSpriteName('Drag Image2', 'Drop');
    expect(imageSource).toEqual(imageSourceDropZone);
  });
});
