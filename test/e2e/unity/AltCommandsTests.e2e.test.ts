// Port of AltCommandsTests.cs (AltCommandsTests) from AltTester-Unity-SDK-Closed-Source sdk-package/Assets/Examples/Test/Editor/Driver
// (Commands/ subfolder). Despite the folder name this class needs no mocks: it runs against the game.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AltLogger, AltLogLevel, type AltDriver } from '../../../src/binding';
import { connectDriver } from './setup';

describe('AltCommandsTests', () => {
  let altDriver: AltDriver;

  // [OneTimeSetUp]; C# also sets the driver's Console logger to Debug, which is driver-side logging only.
  beforeAll(async () => {
    altDriver = await connectDriver();
  });

  // [OneTimeTearDown]
  afterAll(async () => {
    if (!altDriver) return;
    await altDriver.setServerLogging(AltLogger.File, AltLogLevel.Debug);
    await altDriver.stop();
  });

  // [Category("WebGLUnsupported")] in WebGL we do not save logs to file but in the console
  it('TestSetServerLogging', async () => {
    let rule = await altDriver.callStaticMethod<{ Levels: unknown[] }>(
      'AltTester.AltTesterUnitySDK.Logging.AltTesterLogManager',
      'Instance.Configuration.FindRuleByName',
      'Assembly-CSharp',
      ['AltServerFileRule'],
    );

    let levels = rule.Levels;
    expect(levels.length, JSON.stringify(levels)).toBe(5);

    await altDriver.setServerLogging(AltLogger.File, AltLogLevel.Off);
    rule = await altDriver.callStaticMethod<{ Levels: unknown[] }>(
      'AltTester.AltTesterUnitySDK.Logging.AltTesterLogManager',
      'Instance.Configuration.FindRuleByName',
      'Assembly-CSharp',
      ['AltServerFileRule'],
    );
    levels = rule.Levels;
    expect(levels.length, JSON.stringify(levels)).toBe(0);
  });
});
