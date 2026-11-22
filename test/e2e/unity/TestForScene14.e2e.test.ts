// Port of TestForScene14.cs (TestForScene14) from AltTester-Unity-SDK-Closed-Source sdk-package/Assets/Examples/Test/Editor/Driver
import { describe, expect, it } from 'vitest';
import { By } from '../../../src/binding';
import { useTestBase } from './testBase';

describe('TestForScene14', () => {
  const getDriver = useTestBase('Scene 14');

  it('Test', async () => {
    const altDriver = getDriver();
    const nameOfTheObject = 'TopObject';
    const topObject = await altDriver.findObject(By.NAME, nameOfTheObject);
    const screenPosition = topObject.getScreenPosition();
    const foundObject = await altDriver.findObjectAtCoordinates(screenPosition);
    expect(foundObject?.name).toBe(nameOfTheObject);
  });
});
