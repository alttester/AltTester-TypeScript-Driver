// Port of TestForScene12.cs (TestForScene12) from AltTester-Unity-SDK-Closed-Source sdk-package/Assets/Examples/Test/Editor/Driver
import { describe, expect, it } from 'vitest';
import { By } from '../../../src/binding';
import { useTestBase } from './testBase';

const shapes = ['Square', 'Circle', 'Triangle'];

describe('TestForScene12', () => {
  // The scene name is spelled "Sceme" in the sample game.
  const getDriver = useTestBase('Sceme 12 2D Objects');

  it.each(shapes)('TestClickOnObjets("%s")', async (name) => {
    const altDriver = getDriver();
    const altObject = await altDriver.findObject(By.NAME, name);
    await altObject.click();
    expect(await (await altDriver.findObject(By.NAME, 'Text')).getText()).toBe(`Clicked on ${name}`);
  });

  it.each(shapes)('TestTapOnObjets("%s")', async (name) => {
    const altDriver = getDriver();
    const altObject = await altDriver.findObject(By.NAME, name);
    await altObject.tap();
    expect(await (await altDriver.findObject(By.NAME, 'Text')).getText()).toBe(`Clicked on ${name}`);
  });

  it.each(shapes)('TestTapOnCoordinates("%s")', async (name) => {
    const altDriver = getDriver();
    const altObject = await altDriver.findObject(By.NAME, name);
    await altDriver.tap(altObject.getScreenPosition());
    expect(await (await altDriver.findObject(By.NAME, 'Text')).getText()).toBe(`Clicked on ${name}`);
  });

  it.each(shapes)('TestClickOnCoordinates("%s")', async (name) => {
    const altDriver = getDriver();
    const altObject = await altDriver.findObject(By.NAME, name);
    await altDriver.click(altObject.getScreenPosition());
    expect(await (await altDriver.findObject(By.NAME, 'Text')).getText()).toBe(`Clicked on ${name}`);
  });

  it.each(shapes)('TestSwipeOnCoordinates("%s")', async (name) => {
    const altDriver = getDriver();
    const altObject = await altDriver.findObject(By.NAME, name);
    await altDriver.holdButton(altObject.getScreenPosition(), 0.3);
    expect(await (await altDriver.findObject(By.NAME, 'Text')).getText()).toBe(`Clicked on ${name}`);
  });

  it.each(shapes)('TestTouchOnCoordinates("%s")', async (name) => {
    const altDriver = getDriver();
    const altObject = await altDriver.findObject(By.NAME, name);
    const id = await altDriver.beginTouch(altObject.getScreenPosition());
    await altDriver.endTouch(id);
    expect(await (await altDriver.findObject(By.NAME, 'Text')).getText()).toBe(`Clicked on ${name}`);
  });

  it('TestDragObjet', async () => {
    const altDriver = getDriver();
    let altObject = await altDriver.findObject(By.NAME, 'Hexagon Flat-Top');
    const currentPosition = altObject.getScreenPosition();
    await altDriver.swipe(currentPosition, { x: currentPosition.x * 1.1, y: currentPosition.y * 1.1 }, 0.5);
    altObject = await altDriver.findObject(By.NAME, 'Hexagon Flat-Top');
    const newPosition = altObject.getScreenPosition();
    expect(currentPosition.x < newPosition.x, `Expected x to be smaller: ${currentPosition.x} but was ${newPosition.x}`)
      .toBe(true);
    expect(currentPosition.y < newPosition.y, `Expected y to be smaller: ${currentPosition.y} but was ${newPosition.y}`)
      .toBe(true);
  });
});
