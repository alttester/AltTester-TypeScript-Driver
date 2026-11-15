// Port of TestBase.cs in AltTester-Unity-SDK-Closed-Source (sdk-package/Assets/Examples/Test/Editor/Driver), the base
// class of the C# integration tests: one driver per test class, and before each test resetInput, a 5 second command
// response timeout and a fresh load of the class's scene.
import { afterAll, beforeAll, beforeEach } from 'vitest';
import type { AltDriver } from '../../../src/binding';
import { connectDriver } from './setup';

const defaultCommandResponseTimeout = 5;

/**
 * Registers the TestBase hooks in the enclosing describe and returns a getter for its driver.
 * Pass `sceneName` null for a class that loads its own scenes, as TestBase does with a null sceneName.
 */
export function useTestBase(sceneName: string | null): () => AltDriver {
  let altDriver: AltDriver | undefined;
  beforeAll(async () => {
    altDriver = await connectDriver();
  });
  afterAll(async () => {
    await altDriver?.stop();
  });
  beforeEach(async () => {
    await altDriver!.resetInput();
    altDriver!.setCommandResponseTimeout(defaultCommandResponseTimeout);
    if (sceneName !== null) await altDriver!.loadScene(sceneName, true);
  });
  return () => altDriver!;
}
