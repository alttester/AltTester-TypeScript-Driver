// Port of TestDragDemo.cs (TestDragDemo) from AltTester-Unity-SDK-Closed-Source sdk-package/Assets/Examples/Test/Editor/Driver
import { describe, expect, it } from 'vitest';
import { AltKeyCode, By } from '../../../src/binding';
import { useTestBase } from './testBase';

describe('TestDragDemo', () => {
  const getDriver = useTestBase('DragDemo');

  it('TestMoveLettersWithSwipe', async () => {
    const altDriver = getDriver();
    const holderObject = await altDriver.findObject(By.NAME, 'Holder Object (0)');
    const dragObject = await altDriver.findObject(By.NAME, '0-Object');
    const initialPosition = dragObject.getScreenPosition();
    await altDriver.swipe(dragObject.getScreenPosition(), holderObject.getScreenPosition(), 0.3);
    const finalPosition = (await altDriver.findObject(By.NAME, '0-Object')).getScreenPosition();
    expect(finalPosition).not.toEqual(initialPosition);
  });

  it('TestMoveLettersWithKeyDownUp', async () => {
    const altDriver = getDriver();
    const holderObject = await altDriver.findObject(By.NAME, 'Holder Object (0)');
    const dragObject = await altDriver.findObject(By.NAME, '0-Object');
    const initialPosition = dragObject.getScreenPosition();
    await altDriver.moveMouse(initialPosition, 0.1);
    await altDriver.keyDown(AltKeyCode.Mouse0);
    await altDriver.moveMouse(holderObject.getScreenPosition(), 0.1);
    await altDriver.keyUp(AltKeyCode.Mouse0);
    const finalPosition = (await altDriver.findObject(By.NAME, '0-Object')).getScreenPosition();
    expect(finalPosition).not.toEqual(initialPosition);
  });

  it('TestMoveLettersWithTouch', async () => {
    const altDriver = getDriver();
    const holderObject = await altDriver.findObject(By.NAME, 'Holder Object (0)');
    const dragObject = await altDriver.findObject(By.NAME, '0-Object');
    const initialPosition = dragObject.getScreenPosition();
    const touch = await altDriver.beginTouch(initialPosition);
    await altDriver.moveTouch(touch, holderObject.getScreenPosition());
    await altDriver.endTouch(touch);
    const finalPosition = (await altDriver.findObject(By.NAME, '0-Object')).getScreenPosition();
    expect(finalPosition).not.toEqual(initialPosition);
  });
});
