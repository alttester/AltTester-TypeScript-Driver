// Port of TestInputActions.cs (TestInputActions) from AltTester-Unity-SDK-Closed-Source sdk-package/Assets/Examples/Test/Editor/Driver
import { describe, expect, it } from 'vitest';
import { By } from '../../../src/binding';
import { sleep } from './setup';
import { useTestBase } from './testBase';

/** Subset of the fields UnityEngine.Touch serializes; only the ones these tests assert on. */
interface InjectedTouch {
  fingerId: number;
  tapCount: number;
  deltaTime: number;
  phase: number;
}

// UnityEngine.TouchPhase, serialized as an int (Began = 0 is unused, as in C#).
const PhaseMoved = 1;
const PhaseStationary = 2;

describe('TestInputActions', () => {
  const getDriver = useTestBase('Scene6');

  /** Reads a touch straight out of the SDK's Input shim, which is what a polling game sees. */
  const getInjectedTouch = (index: number) =>
    getDriver().callStaticMethod<InjectedTouch>('Input', 'GetTouch', 'AltTester.AltTesterUnitySDK', [index], ['System.Int32']);

  const getInjectedTouchCount = () =>
    getDriver().callStaticMethod<number>('Input', 'get_touchCount', 'AltTester.AltTesterUnitySDK', []);

  /**
   * A held touch only decays to Stationary after AltInput.Update() has run on the frames following BeginTouch. The
   * driver's next command can arrive before those frames, so poll instead of asserting on the first sample.
   */
  async function waitForStationaryTouch(index: number, timeoutMs = 2000): Promise<InjectedTouch> {
    const start = Date.now();
    let touch = await getInjectedTouch(index);
    while (touch.phase !== PhaseStationary && Date.now() - start < timeoutMs) {
      await sleep(0.05);
      touch = await getInjectedTouch(index);
    }
    return touch;
  }

  it('TestScrollAndWait', async () => {
    const altDriver = getDriver();
    let scrollBar = await altDriver.waitForObject(By.PATH, '//ScrollCanvas//Handle');
    const scrollBarInitialPosition = scrollBar.getScreenPosition();
    await altDriver.moveMouse(scrollBarInitialPosition);
    await altDriver.scroll(-20, 0.3);
    scrollBar = await altDriver.findObject(By.PATH, '//ScrollCanvas//Handle');
    const scrollBarFinalPosition = scrollBar.getScreenPosition();
    expect(scrollBarFinalPosition.y).not.toEqual(scrollBarInitialPosition.y);
  });

  it('TestHeldTouchReportsCompleteTouchData', async () => {
    const altDriver = getDriver();
    const fingerId = await altDriver.beginTouch({ x: 100, y: 100 });
    try {
      const touch = await waitForStationaryTouch(0);
      // The driver hands out 1-based ids (InputController.BeginTouch returns oldFingerId + 1),
      // while the legacy Input shim reports Unity's 0-based Touch.fingerId.
      expect(touch.fingerId).toBe(fingerId - 1);
      expect(touch.tapCount, 'tapCount must be 1, matching a real device and the New Input System backend').toBe(1);
      expect(touch.phase, 'a held touch must decay from Began to Stationary instead of reporting Began forever')
        .toBe(PhaseStationary);
      expect(touch.deltaTime, 'deltaTime must advance once the touch has changed at least once').toBeGreaterThan(0);
    } finally {
      await altDriver.endTouch(fingerId);
    }
  });

  it('TestHeldTouchKeepsRefreshingDeltaTime', async () => {
    const altDriver = getDriver();
    const fingerId = await altDriver.beginTouch({ x: 100, y: 100 });
    try {
      // Both samples are taken while the touch is Stationary. deltaTime is the time since the touch last changed, so
      // it must be re-stamped every frame rather than frozen at the value it had when the phase last changed.
      const first = await waitForStationaryTouch(0);
      expect(first.phase).toBe(PhaseStationary);
      expect(first.deltaTime).toBeGreaterThan(0);

      await sleep(0.1);

      const second = await getInjectedTouch(0);
      expect(second.phase).toBe(PhaseStationary);
      expect(second.deltaTime).toBeGreaterThan(0);
    } finally {
      await altDriver.endTouch(fingerId);
    }
  });

  it('TestMovedTouchKeepsTapCount', async () => {
    const altDriver = getDriver();
    const fingerId = await altDriver.beginTouch({ x: 100, y: 100 });
    try {
      await altDriver.moveTouch(fingerId, { x: 200, y: 200 });
      const touch = await getInjectedTouch(0);
      expect(touch.tapCount, 'tapCount must survive a phase change').toBe(1);
      expect(touch.deltaTime).toBeGreaterThan(0);
      expect(
        [PhaseMoved, PhaseStationary],
        'after a move the touch is Moved, then decays to Stationary; Began would mean the phase never advanced',
      ).toContain(touch.phase);
    } finally {
      await altDriver.endTouch(fingerId);
    }
  });

  it('TestTouchIsRemovedAfterEndTouch', async () => {
    const altDriver = getDriver();
    const fingerId = await altDriver.beginTouch({ x: 100, y: 100 });
    expect(await getInjectedTouchCount()).toBe(1);
    await altDriver.endTouch(fingerId);
    expect(await getInjectedTouchCount(), 'the touch and its metadata must be dropped once the touch ends').toBe(0);
  });

  it('TestTapLeavesNoResidualTouch', async () => {
    const altDriver = getDriver();
    await altDriver.tap({ x: 100, y: 100 });
    expect(await getInjectedTouchCount(), 'a completed tap must not leave a touch behind').toBe(0);
  });
});
