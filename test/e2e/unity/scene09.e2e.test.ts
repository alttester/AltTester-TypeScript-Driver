// Port of Bindings~/python/tests/integration/test_scene09.py
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { By, type AltDriver } from '../../../src/binding';
import { closeAltTesterPopup, connectDriver, Scenes } from './setup';

describe('TestScene09', () => {
  let d: AltDriver;
  beforeAll(async () => { d = await connectDriver(); });
  afterAll(async () => { await d?.stop(); });
  beforeEach(async () => {
    await closeAltTesterPopup(d);
    await d.resetInput();
    await d.loadScene(Scenes.Scene09);
  });

  it('test_scroll_element_NIS', async () => {
    const scrollbarInitial = await d.findObject(By.NAME, 'Scrollbar Vertical');
    const scrollbarInitialValue = await scrollbarInitial.getComponentProperty('UnityEngine.UI.Scrollbar', 'value', 'UnityEngine.UI');
    await d.moveMouse((await d.findObject(By.NAME, 'Scroll View')).getScreenPosition(), 0.3, true);
    await d.scroll(-3000, 0.5, true);

    const scrollbarFinal = await d.findObject(By.NAME, 'Scrollbar Vertical');
    const scrollbarFinalValue = await scrollbarFinal.getComponentProperty('UnityEngine.UI.Scrollbar', 'value', 'UnityEngine.UI');

    expect(scrollbarFinalValue).not.toEqual(scrollbarInitialValue);
  });

  it('test_swipe_NIS', async () => {
    const scrollbar = await d.findObject(By.NAME, 'Handle');
    const scrollbarPosition = scrollbar.getScreenPosition();
    const button = await d.findObject(By.PATH, '//Scroll View/Viewport/Content/Button (4)');
    await d.swipe(button.getScreenPosition(), { x: button.x, y: button.y + 20 }, 0.5);

    const scrollbarFinal = await d.findObject(By.NAME, 'Handle');
    const scrollbarFinalPosition = scrollbarFinal.getScreenPosition();
    expect(scrollbarFinalPosition).not.toEqual(scrollbarPosition);
  });
});
