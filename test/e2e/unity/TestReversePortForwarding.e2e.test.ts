// Port of TestReversePortForwarding.cs (TestReversePortForwarding) from AltTester-Unity-SDK-Closed-Source sdk-package/Assets/Examples/Test/Editor/Driver
// The C# class is [Ignore("No Android pipeline is set up yet")] and needs a phone and adb (AltReversePortForwarding
// sets up `adb reverse` in its OneTimeSetUp); the TS driver has no AltReversePortForwarding, so the class is skipped.
import { describe, expect, it } from 'vitest';
import { By, type AltDriver } from '../../../src/binding';

describe.skip('TestReversePortForwarding', () => {
  let altDriver: AltDriver;

  // [Ignore("No Android pipeline is set up yet")]; needs an Android phone and adb.
  // TS driver has no AltReversePortForwarding.ReversePortForwardingAndroid
  it.skip('TestStartGame', async () => {
    await altDriver.loadScene('Scene 2 Draggable Panel');

    await (await altDriver.findObject(By.NAME, 'Close Button')).tap();
    await (await altDriver.findObject(By.NAME, 'Button')).tap();

    const panelElement = await altDriver.waitForObject(By.NAME, 'Panel');
    expect(panelElement.enabled).toBe(true);
  });
});
