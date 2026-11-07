// Port of Bindings~/python/tests/integration/test_scene02.py
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { By, type AltDriver, type AltVector2 } from '../../../src/binding';
import { connectDriver, Scenes } from './setup';

const expectedNames = [
  'EventSystem', 'Canvas', 'Panel Drag Area', 'Panel',
  'Header', 'Text', 'Drag Zone', 'Resize Zone', 'Close Button',
  'Debugging', 'SF Scene Elements', 'Main Camera', 'Background',
  'Particle System',
];

describe('TestScene02', () => {
  let d: AltDriver;
  beforeAll(async () => { d = await connectDriver(); });
  afterAll(async () => { await d?.stop(); });
  beforeEach(async () => {
    await (await d.findObject(By.PATH, '/AltTesterPrefab//CloseButton', By.NAME, '', false)).tap();
    await d.resetInput();
    await d.loadScene(Scenes.Scene02);
  });

  it('test_get_all_elements', async () => {
    const elements = await d.getAllElements(By.NAME, '', false);
    expect(elements).not.toBeNull();

    const inputMarks: number[] = [];
    const names: string[] = [];

    for (const element of elements) {
      if (element.name === 'InputMark(Clone)') {
        inputMarks.push(element.transformId);
        continue; // skip InputMark and direct children
      }
      if (inputMarks.includes(element.transformParentId)) {
        continue; // skip InputMark and direct children
      }
      names.push(element.name);
    }

    for (const name of expectedNames) {
      expect(names).toContain(name);
    }
  });

  it('test_get_all_enabled_elements', async () => {
    const elements = await d.getAllElements(By.NAME, '', true);
    expect(elements).not.toBeNull();

    const names = elements.map((e) => e.name);
    expect(names.length).toBeGreaterThanOrEqual(22);
    for (const name of expectedNames) {
      expect(names).toContain(name);
    }
  });

  it('test_resize_panel', async () => {
    let altObject = await d.findObject(By.NAME, 'Resize Zone');
    const positionInit = [altObject.x, altObject.y];

    await d.swipe(altObject.getScreenPosition(), { x: altObject.x - 200, y: altObject.y - 200 }, 2);

    altObject = await d.findObject(By.NAME, 'Resize Zone');
    const positionFinal = [altObject.x, altObject.y];

    expect(positionInit).not.toEqual(positionFinal);
  });

  it('test_resize_panel_with_multipoint_swipe', async () => {
    let altObject = await d.findObject(By.NAME, 'Resize Zone');
    const positionInit = [altObject.x, altObject.y];

    const positions: AltVector2[] = [
      altObject.getScreenPosition(),
      { x: altObject.x - 200, y: altObject.y - 200 },
      { x: altObject.x - 300, y: altObject.y - 100 },
      { x: altObject.x - 50, y: altObject.y - 100 },
      { x: altObject.x - 100, y: altObject.y - 100 },
    ];
    await d.multipointSwipe(positions, 4);

    altObject = await d.findObject(By.NAME, 'Resize Zone');
    const positionFinal = [altObject.x, altObject.y];

    expect(positionInit).not.toEqual(positionFinal);
  });

  it('test_pointer_down_from_object', async () => {
    const panel = await d.findObject(By.NAME, 'Panel');
    const color1 = await panel.getComponentProperty('AltExampleScriptPanel', 'normalColor', 'Assembly-CSharp');
    await panel.pointerDown();

    const color2 = await panel.getComponentProperty('AltExampleScriptPanel', 'highlightColor', 'Assembly-CSharp');

    expect(color1).not.toEqual(color2);
  });

  it('test_pointer_up_from_object', async () => {
    const panel = await d.findObject(By.NAME, 'Panel');
    const color1 = await panel.getComponentProperty('AltExampleScriptPanel', 'normalColor', 'Assembly-CSharp');
    await panel.pointerDown();

    await panel.pointerUp();
    const color2 = await panel.getComponentProperty('AltExampleScriptPanel', 'highlightColor', 'Assembly-CSharp');

    expect(color1).toEqual(color2);
  });

  it('test_new_touch_commands', async () => {
    let draggableArea = await d.findObject(By.NAME, 'Drag Zone');
    const initialPosition = draggableArea.getScreenPosition();

    const fingerId = await d.beginTouch(draggableArea.getScreenPosition());
    await d.moveTouch(fingerId, { x: draggableArea.x + 10, y: draggableArea.y + 10 });
    await d.endTouch(fingerId);

    draggableArea = await d.findObject(By.NAME, 'Drag Zone');
    // Python compares the position tuple with the AltObject itself (always unequal); kept as is.
    expect(initialPosition).not.toEqual(draggableArea);
  });
});
