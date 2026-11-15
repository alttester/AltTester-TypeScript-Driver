// Port of TestForScene4NoCameras.cs (TestForScene4NoCameras) from AltTester-Unity-SDK-Closed-Source sdk-package/Assets/Examples/Test/Editor/Driver
import { describe, expect, it } from 'vitest';
import { By } from '../../../src/binding';
import { useTestBase } from './testBase';

describe('TestForScene4NoCameras', () => {
  const getDriver = useTestBase('Scene 4 No Cameras');

  it.each(['Plane', 'EventSystem', 'Cube'])('TestFindElementInASceneWithNoCameras("%s")', async (objectName) => {
    const altDriver = getDriver();
    expect((await altDriver.getAllCameras()).length).toBe(0);
    const altObject = await altDriver.findObject(By.NAME, objectName);
    expect(altObject.worldX, `WorldX was: ${altObject.worldX} when it should have been 0`).toBe(0);
    expect(altObject.worldY, `WorldY was: ${altObject.worldY} when it should have been 0`).toBe(0);
    expect(altObject.worldZ, `WorldZ was: ${altObject.worldZ} when it should have been 0`).toBe(0);
    expect(altObject.x).toBe(-1);
    expect(altObject.y).toBe(-1);
    expect(altObject.z).toBe(-1);
    expect(altObject.idCamera).toBe(-1);
  });

  it('TestFindUIElementInASceneWithNoCameras', async () => {
    const altDriver = getDriver();
    expect((await altDriver.getAllCameras()).length).toBe(0);
    const altObjects = await altDriver.findObjects(By.PATH, '//*[contains(@name,Button)]', By.NAME, '', false);

    for (const button of altObjects) {
      expect(button.x).not.toBe(-1);
      expect(button.y).not.toBe(-1);
    }
    expect(altObjects.length).toBe(10);
  });
});
