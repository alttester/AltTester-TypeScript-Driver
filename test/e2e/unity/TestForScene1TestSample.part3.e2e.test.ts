// Port of Testforscene1TestSample.cs (TestForScene1TestSample) from AltTester-Unity-SDK-Closed-Source sdk-package/Assets/Examples/Test/Editor/Driver
import { describe, expect, it } from 'vitest';
import {
  AltDriver,
  AltKeyCode,
  AssemblyNotFoundException,
  By,
  CameraNotFoundException,
  CommandResponseTimeoutException,
  ComponentNotFoundException,
  CouldNotPerformOperationException,
  InvalidParameterValueException,
  InvalidPathException,
  PropertyNotFoundException,
  WaitTimeOutException,
} from '../../../src/binding';
import type { AltObject } from '../../../src/binding';
import { appName, host, port, Scenes, sleep } from './setup';
import { useTestBase } from './testBase';

describe('TestForScene1TestSample (part 3)', () => {
  const getDriver = useTestBase(Scenes.Scene01);

  it('TestSwipeClickWhenMovedButRemainsOnTheSameObject', async () => {
    const altDriver = getDriver();
    const counterElement = await altDriver.findObject(By.NAME, 'ButtonCounter');
    const counterButtonText = await altDriver.findObject(By.NAME, 'ButtonCounter/Text');
    await altDriver.swipe(
      { x: counterElement.x + 1, y: counterElement.y + 1 },
      { x: counterElement.x + 2, y: counterElement.y + 1 },
      1,
    );
    await sleep(0.5);
    expect(await counterButtonText.getText()).toBe('1');
  });

  it('TestCallMethodInsideASubObject', async () => {
    const altDriver = getDriver();
    const componentName = 'AltExampleScriptCapsule';
    const methodName = 'AltSampleClass.TestMethod';
    const assemblyName = 'Assembly-CSharp';
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    const data = await altElement.callComponentMethod<string>(componentName, methodName, assemblyName, []);
    expect(data).toBe('Test');
  });

  it('TestCallMethodInsideAListOfSubObject', async () => {
    const altDriver = getDriver();
    const componentName = 'AltExampleScriptCapsule';
    const methodName = 'listOfSampleClass[0].TestMethod';
    const assemblyName = 'Assembly-CSharp';
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    const data = await altElement.callComponentMethod<string>(componentName, methodName, assemblyName, []);
    expect(data).toBe('Test');
  });

  it('TestCallStaticMethodInsideASubObject', async () => {
    const altDriver = getDriver();
    const componentName = 'AltExampleScriptCapsule';
    const methodName = 'StaticSampleClass.TestMethod';
    const assemblyName = 'Assembly-CSharp';

    const data = await altDriver.callStaticMethod<string>(componentName, methodName, assemblyName, []);
    expect(data).toBe('Test');
  });

  it('TestCallGameObjectMethod', async () => {
    const altDriver = getDriver();
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    const data = await altElement.callComponentMethod<boolean>(
      'UnityEngine.GameObject',
      'CompareTag',
      'UnityEngine.CoreModule',
      ['Untagged'],
      ['System.String'],
    );
    expect(data).toBe(true);
  });

  it('TestCallMethodInsideSubObjectOfGameObject', async () => {
    const altDriver = getDriver();
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    const data = await altElement.callComponentMethod<boolean>('UnityEngine.GameObject', 'scene.IsValid', 'UnityEngine.CoreModule', [], []);
    expect(data).toBe(true);
  });

  it.each([
    ['//Dialog[0]', 'Dialog', false],
    ['//Text[-1]', 'Text', true],
  ] as const)('TestFindIndexer(%s, %s, %s)', async (path, expectedResult, enabled) => {
    const altDriver = getDriver();
    const altElement = await altDriver.findObject(By.PATH, path, By.NAME, '', enabled);
    expect(altElement.name).toBe(expectedResult);
  });

  it('TestUnloadScene', async () => {
    const altDriver = getDriver();
    await altDriver.loadScene('Scene 2 Draggable Panel', false);
    expect((await altDriver.getAllLoadedScenes()).length).toBe(2);
    await altDriver.unloadScene('Scene 2 Draggable Panel');
    expect((await altDriver.getAllLoadedScenes()).length).toBe(1);
    expect((await altDriver.getAllLoadedScenes())[0]).toBe('Scene 1 AltDriverTestScene');
  });

  it('TestUnloadOnlyScene', async () => {
    const altDriver = getDriver();
    await expect(altDriver.unloadScene('Scene 1 AltDriverTestScene')).rejects.toThrow(CouldNotPerformOperationException);
    await expect(altDriver.unloadScene('Scene 2 Draggable Panel')).rejects.toThrow(CouldNotPerformOperationException);
  });

  it('TestClickButtonInWolrdSpaceCanvas', async () => {
    const altDriver = getDriver();
    await altDriver.loadScene('Scene6');
    const screenPosition = (await altDriver.findObject(By.NAME, 'WorldSpaceButton')).getScreenPosition();
    await altDriver.tap(screenPosition, 1);
    const worldSpaceButton = await altDriver.findObject(By.NAME, 'WorldSpaceButton', By.NAME, '', false);
    expect(worldSpaceButton.enabled).toBe(false);
  });

  it('TestDifferentObjectSelectedClickingOnScreenshot', async () => {
    const altDriver = getDriver();
    const uiButton = await altDriver.findObject(By.NAME, 'UIButton');
    let selectedObject: AltObject | null;
    ({ object: selectedObject } = await altDriver.getHighlightedScreenshotAt(
      uiButton.getScreenPosition(),
      { r: 1, g: 1, b: 1, a: 1 },
      1,
    ));
    expect(selectedObject?.name).toBe('Text');
    ({ object: selectedObject } = await altDriver.getHighlightedScreenshotAt(
      uiButton.getScreenPosition(),
      { r: 1, g: 1, b: 1, a: 1 },
      1,
    ));
    expect(selectedObject?.name).toBe('UIButton');
  });

  it('TestGetAllScenesAndObjectDisableEnableOption', async () => {
    const altDriver = getDriver();
    const allEnableObjects = await altDriver.getAllLoadedScenesAndObjects(true);
    for (const enabledObject of allEnableObjects) {
      expect(enabledObject.enabled).toBe(true);
    }
    const allObjects = await altDriver.getAllLoadedScenesAndObjects(false);
    expect(allEnableObjects.length < allObjects.length).toBe(true);
    expect(allObjects.some((altObject) => altObject.name === 'Cube' && !altObject.enabled)).toBe(true);
  });

  it('TestGetObjectWithNumberAsName', async () => {
    const altDriver = getDriver();
    let numberObject = await altDriver.findObject(By.NAME, '1234', By.NAME, '', false);
    expect(numberObject).not.toBeNull();
    numberObject = await altDriver.findObject(By.PATH, '//1234', By.NAME, '', false);
    expect(numberObject).not.toBeNull();
  });

  it('TestInvalidPaths', async () => {
    const altDriver = getDriver();
    await expect(altDriver.findObject(By.PATH, '//[1]')).rejects.toThrow(InvalidPathException);
    await expect(altDriver.findObject(By.PATH, 'CapsuleInfo[@tag=UI]')).rejects.toThrow(InvalidPathException);
    await expect(altDriver.findObject(By.PATH, '//CapsuleInfo[@tag=UI/Text')).rejects.toThrow(InvalidPathException);
    await expect(altDriver.findObject(By.PATH, '//CapsuleInfo[0/Text')).rejects.toThrow(InvalidPathException);
  });

  it('TestTap', async () => {
    const altDriver = getDriver();
    const counterButton = await altDriver.findObject(By.NAME, 'ButtonCounter');
    await altDriver.findObject(By.NAME, 'ButtonCounter/Text');
    await counterButton.tap(1);
    await altDriver.waitForObject(By.PATH, '//ButtonCounter/Text[@text=1]');
  });

  it('TestTap_MultipleTaps', async () => {
    const altDriver = getDriver();
    const counterButton = await altDriver.findObject(By.NAME, 'ButtonCounter');
    await altDriver.findObject(By.NAME, 'ButtonCounter/Text');
    await counterButton.tap(2);
    await altDriver.waitForObject(By.PATH, '//ButtonCounter/Text[@text=2]');
  });

  it('TestClick', async () => {
    const altDriver = getDriver();
    const counterButton = await altDriver.findObject(By.NAME, 'ButtonCounter');
    await altDriver.findObject(By.NAME, 'ButtonCounter/Text');
    await counterButton.click(1);
    await altDriver.waitForObject(By.PATH, '//ButtonCounter/Text[@text=1]');
  });

  it('TestClick_MultipleClicks', async () => {
    const altDriver = getDriver();
    const counterButton = await altDriver.findObject(By.NAME, 'ButtonCounter');
    await altDriver.findObject(By.NAME, 'ButtonCounter/Text');
    await counterButton.click(2);
    await altDriver.waitForObject(By.PATH, '//ButtonCounter/Text[@text=2]');
  });

  // C# has a commented-out [Ignore("mousePressCounter remains stuck and is 13 when asserting instead of 1")]
  it('TestClick_MouseDownUp', async () => {
    const altDriver = getDriver();
    const component = 'AltExampleScriptIncrementOnClick';
    const counterElement = await altDriver.findObject(By.NAME, 'ButtonCounter');
    await counterElement.setComponentProperty(component, 'mouseDownCounter', 'Assembly-CSharp', 0);
    await counterElement.setComponentProperty(component, 'mouseUpCounter', 'Assembly-CSharp', 0);
    await counterElement.setComponentProperty(component, 'mousePressedCounter', 'Assembly-CSharp', 0);

    await altDriver.moveMouse({ x: 0, y: 0 });
    await counterElement.click();

    const mouseDownCounter = await counterElement.getComponentProperty<number>(component, 'mouseDownCounter', 'Assembly-CSharp');
    const mouseUpCounter = await counterElement.getComponentProperty<number>(component, 'mouseUpCounter', 'Assembly-CSharp');
    const mousePressedCounter = await counterElement.getComponentProperty<number>(component, 'mousePressedCounter', 'Assembly-CSharp');

    const eventsRaised = await counterElement.getComponentProperty<string[]>(component, 'eventsRaised', 'Assembly-CSharp');

    expect(mouseDownCounter).toBe(1);
    expect(mouseUpCounter).toBe(1);
    expect(mousePressedCounter).toBe(1);

    expect(eventsRaised).toContain('OnMouseDown');
    expect(eventsRaised).toContain('OnMouseUp');
    expect(eventsRaised).toContain('OnMouseUpAsButton');
  });

  // [Ignore("Failing in pipeline but passing in local, will fix it later")]
  it.skip('TestPointerEnter_PointerExit', async () => {
    const altDriver = getDriver();
    const component = 'AltExampleScriptIncrementOnClick';
    await altDriver.moveMouse({ x: 0, y: 0 }, 1);
    const counterElement = await altDriver.findObject(By.NAME, 'ButtonCounter');
    await counterElement.callComponentMethod<string>(component, 'eventsRaised.Clear', 'Assembly-CSharp', [], []);
    let eventsRaised = await counterElement.getComponentProperty<string[]>(component, 'eventsRaised', 'Assembly-CSharp');
    expect(eventsRaised).not.toContain('OnPointerEnter');
    expect(eventsRaised).not.toContain('OnPointerExit');
    const screenPosition = counterElement.getScreenPosition();
    const counterElementPosition = { x: screenPosition.x + 2, y: screenPosition.y + 4 };
    await altDriver.moveMouse(counterElementPosition, 1);

    eventsRaised = await counterElement.getComponentProperty<string[]>(component, 'eventsRaised', 'Assembly-CSharp');
    expect(eventsRaised).toContain('OnPointerEnter');
    expect(eventsRaised).not.toContain('OnPointerExit');
    await altDriver.moveMouse({ x: -50, y: -50 }, 1);

    eventsRaised = await counterElement.getComponentProperty<string[]>(component, 'eventsRaised', 'Assembly-CSharp');
    expect(eventsRaised).toContain('OnPointerEnter');
    expect(eventsRaised).toContain('OnPointerExit');
  });

  it('TestClickCoordinates', async () => {
    const altDriver = getDriver();
    const counterButton = await altDriver.findObject(By.NAME, 'ButtonCounter');
    await altDriver.findObject(By.NAME, 'ButtonCounter/Text');
    await altDriver.click({ x: 80 + counterButton.x, y: 15 + counterButton.y });
    await altDriver.waitForObject(By.PATH, '//ButtonCounter/Text[@text=1]');
  });

  it('TestClickCoordinates_MultipleClicks', async () => {
    const altDriver = getDriver();
    const counterButton = await altDriver.findObject(By.NAME, 'ButtonCounter');
    await altDriver.findObject(By.NAME, 'ButtonCounter/Text');
    await altDriver.click({ x: 80 + counterButton.x, y: 15 + counterButton.y }, 2);
    await altDriver.waitForObject(By.PATH, '//ButtonCounter/Text[@text=2]');
  });

  it('TestClickCoordinates_MouseDownUp', async () => {
    const altDriver = getDriver();
    const button2dCollider = await altDriver.findObject(By.NAME, 'TapClickEventsButtonCollider');

    await altDriver.click(button2dCollider.getScreenPosition());

    const monoBehaviourEventsRaised = await button2dCollider.getComponentProperty<string[]>(
      'AltTapClickEventsScript',
      'monoBehaviourEventsRaised',
      'Assembly-CSharp',
    );
    // OnMouseEnter is not asserted: does not work on mobile
    expect(monoBehaviourEventsRaised).toContain('OnMouseDown');
    expect(monoBehaviourEventsRaised).toContain('OnMouseUp');
    expect(monoBehaviourEventsRaised).toContain('OnMouseUpAsButton');
    // OnMouseExit is not asserted: does not work on mobile

    const eventSystemEventsRaised = await button2dCollider.getComponentProperty<string[]>(
      'AltTapClickEventsScript',
      'eventSystemEventsRaised',
      'Assembly-CSharp',
    );
    // OnPointerEnter is not asserted: does not work on mobile
    expect(eventSystemEventsRaised).toContain('OnPointerDown');
    expect(eventSystemEventsRaised).toContain('OnPointerUp');
    expect(eventSystemEventsRaised).toContain('OnPointerClick');
    // OnPointerExit is not asserted: does not work on mobile
  });

  it('TestClickCoordinates_ColliderNoParent', async () => {
    const altDriver = getDriver();
    const sphere = await altDriver.findObject(By.PATH, '/Sphere');
    await altDriver.click(sphere.getScreenPosition());

    const monoBehaviourEventsRaised = await sphere.getComponentProperty<string[]>(
      'AltSphereColliderScript',
      'monoBehaviourEventsRaised',
      'Assembly-CSharp',
    );
    expect(monoBehaviourEventsRaised).toContain('OnMouseOver');
    expect(monoBehaviourEventsRaised).toContain('OnMouseEnter');
    expect(monoBehaviourEventsRaised).toContain('OnMouseDown');
    expect(monoBehaviourEventsRaised).toContain('OnMouseUp');
    expect(monoBehaviourEventsRaised).toContain('OnMouseUpAsButton');
    expect(monoBehaviourEventsRaised).toContain('OnMouseExit');
  });

  it('TestClickCoordinates_ColliderParentCollider', async () => {
    const altDriver = getDriver();
    await altDriver.moveMouse({ x: 0, y: 0 });
    const sphere = await altDriver.findObject(By.PATH, '/Sphere');
    const plane = await altDriver.findObject(By.PATH, '/Sphere/PlaneS');
    await altDriver.click(plane.getScreenPosition());

    const planeEvents = await plane.getComponentProperty<string[]>('AltPlaneColliderScript', 'monoBehaviourEventsRaised', 'Assembly-CSharp');
    expect(planeEvents).toContain('OnMouseOver');
    expect(planeEvents).toContain('OnMouseEnter');
    expect(planeEvents).toContain('OnMouseDown');
    expect(planeEvents).toContain('OnMouseUp');
    expect(planeEvents).toContain('OnMouseUpAsButton');
    expect(planeEvents).toContain('OnMouseExit');

    const sphereevents = await sphere.getComponentProperty<string[]>('AltSphereColliderScript', 'monoBehaviourEventsRaised', 'Assembly-CSharp');
    expect(sphereevents).not.toContain('OnMouseEnter');
    expect(sphereevents).not.toContain('OnMouseDown');
    expect(sphereevents).not.toContain('OnMouseUp');
    expect(sphereevents).not.toContain('OnMouseUpAsButton');
  });

  it('TestClickCoordinatesCheckPressRaycastObject', async () => {
    const altDriver = getDriver();
    const incrementClick = await altDriver.findObject(By.NAME, 'ButtonCounter');
    await altDriver.click(incrementClick.getScreenPosition());
    expect(
      await incrementClick.getComponentProperty<string>('AltExampleScriptIncrementOnClick', 'eventDataPressRaycastObject', 'Assembly-CSharp'),
    ).toBe('Text');
  });

  it('TestPointerPressSet', async () => {
    const altDriver = getDriver();
    const incrementalClick = await altDriver.findObject(By.NAME, 'ButtonCounter');
    const swipeCoordinate = { x: incrementalClick.x + 10, y: incrementalClick.y + 10 };
    await altDriver.swipe(swipeCoordinate, swipeCoordinate, 0.2);
    const pointerPress = await incrementalClick.getComponentProperty<{ x: number; y: number }>(
      'AltExampleScriptIncrementOnClick',
      'pointerPress',
      'Assembly-CSharp',
    );
    expect(pointerPress.x).toBe(swipeCoordinate.x);
    expect(pointerPress.y).toBe(swipeCoordinate.y);
  });

  it('TestKeyDownAndKeyUpMouse0', async () => {
    const altDriver = getDriver();
    let capsule = await altDriver.findObject(By.NAME, 'Capsule');
    const initialCapsulePosition = capsule.getWorldPosition();
    await altDriver.moveMouse(capsule.getScreenPosition(), 0.1);
    await sleep(0.4);
    await altDriver.keyDown(AltKeyCode.Mouse0);
    await altDriver.keyUp(AltKeyCode.Mouse0);
    capsule = await altDriver.findObject(By.NAME, 'Capsule');
    const finalCapsulePosition = capsule.getWorldPosition();
    expect(finalCapsulePosition).not.toEqual(initialCapsulePosition);
  });

  it('TestTouchAreUpdatedWhenMoved', async () => {
    const altDriver = getDriver();
    const capsule = await altDriver.findObject(By.NAME, 'Capsule');
    const id = await altDriver.beginTouch(capsule.getScreenPosition());
    // BeginTouch returns before the touch is applied at the start of the next frame, so wait
    // for the capsule to see it; until then it still holds the phase from an earlier test.
    await sleep(0.1);
    // Like a real finger, Began and Moved are only reported for about a frame before the
    // touch decays to Stationary, so the capsule may already have observed Stationary.
    let phase = await capsule.getComponentProperty<number>('AltExampleScriptCapsule', 'TouchPhase', 'Assembly-CSharp');
    expect([0, 2]).toContain(phase); // Began or Stationary
    await altDriver.moveTouch(id, capsule.getScreenPosition());
    await sleep(0.1);
    phase = await capsule.getComponentProperty<number>('AltExampleScriptCapsule', 'TouchPhase', 'Assembly-CSharp');
    expect([1, 2]).toContain(phase); // Moved or Stationary
    await altDriver.endTouch(id);
  });

  it('TestTapReportsCompleteTouchDataToPollingScripts', async () => {
    const altDriver = getDriver();
    // A game that polls Input.GetTouch in Update() must see a tap the way a real device reports it (issue #315).
    const capsule = await altDriver.findObject(By.NAME, 'Capsule');
    // Tap waits for the tap to finish, so the capsule has already polled the Began and the Ended frame.
    await altDriver.tap(capsule.getScreenPosition());

    expect(
      await capsule.getComponentProperty<number>('AltExampleScriptCapsule', 'BeganTouchTapCount', 'Assembly-CSharp'),
      'tapCount on Began must be 1, as on a real device',
    ).toBe(1);
    expect(
      await capsule.getComponentProperty<number>('AltExampleScriptCapsule', 'EndedTouchTapCount', 'Assembly-CSharp'),
      'tapCount on Ended must be 1, as on a real device',
    ).toBe(1);
    expect(
      await capsule.getComponentProperty<number>('AltExampleScriptCapsule', 'EndedTouchDeltaTime', 'Assembly-CSharp'),
      'deltaTime on Ended must be the time since Began, not 0',
    ).toBeGreaterThan(0);
  });

  it('TestSetStructureProperty', async () => {
    const altDriver = getDriver();
    const capsule = await altDriver.findObject(By.NAME, 'Capsule');
    await capsule.setComponentProperty('AltExampleScriptCapsule', 'testStructure.text', 'Assembly-CSharp', 'changed');
    const value = await capsule.getComponentProperty<string>('AltExampleScriptCapsule', 'testStructure.text', 'Assembly-CSharp');
    expect(value).toBe('changed');
  });

  it('TestSetStructureProperty2', async () => {
    const altDriver = getDriver();
    const capsule = await altDriver.findObject(By.NAME, 'Capsule');
    await capsule.setComponentProperty('AltExampleScriptCapsule', 'testStructure.list[0]', 'Assembly-CSharp', 1);
    const value = await capsule.getComponentProperty<number>('AltExampleScriptCapsule', 'testStructure.list[0]', 'Assembly-CSharp');
    expect(value).toBe(1);
  });

  it('TestSetStructureProperty3', async () => {
    const altDriver = getDriver();
    const capsule = await altDriver.findObject(By.NAME, 'Capsule');
    await capsule.setComponentProperty('AltExampleScriptCapsule', 'testStructure.List[0]', 'Assembly-CSharp', 1);
    const value = await capsule.getComponentProperty<number>('AltExampleScriptCapsule', 'testStructure.list[0]', 'Assembly-CSharp');
    expect(value).toBe(1);
  });

  it('TestCameraNotFoundException', async () => {
    const altDriver = getDriver();
    await expect(altDriver.findObject(By.NAME, 'Capsule', By.NAME, 'Camera')).rejects.toThrow(CameraNotFoundException);
  });

  it('TestClickOnChangingSceneButton', async () => {
    const altDriver = getDriver();
    const initialScene = await altDriver.getCurrentScene();
    await (await altDriver.findObject(By.NAME, 'NextScene')).click();
    const currentScene = await altDriver.getCurrentScene();
    expect(currentScene).not.toBe(initialScene);
  });

  it('TestGetStaticProperty', async () => {
    const altDriver = getDriver();
    const screenOrientation = await altDriver.getStaticProperty<number>('UnityEngine.Screen', 'orientation', 'UnityEngine.CoreModule');
    expect(screenOrientation).toBeGreaterThanOrEqual(1);
    expect(screenOrientation).toBeLessThanOrEqual(4);
  });

  it('TestGetStaticNonExistingProperty', async () => {
    const altDriver = getDriver();
    await expect(altDriver.getStaticProperty<number>('UnityEngine.Screen', 'UNEXISTING', 'UnityEngine.CoreModule')).rejects.toThrow(
      PropertyNotFoundException,
    );
  });

  it('TestGetStaticpropertyNonExistingComponent', async () => {
    const altDriver = getDriver();
    await expect(altDriver.getStaticProperty<number>('UNEXISTING', 'orientation', 'UnityEngine.CoreModule')).rejects.toThrow(
      ComponentNotFoundException,
    );
  });

  // [Category("WebGLUnsupported")] Fails on WebGL in pipeline, skip until issue #1465 is fixed:
  // https://github.com/alttester/AltTester-Unity-SDK/issues/1465
  it('TestGetStaticpropertyNonExistingAssembly', async () => {
    const altDriver = getDriver();
    await expect(altDriver.getStaticProperty<number>('UnityEngine.Screen', 'orientation', 'UNEXISTING')).rejects.toThrow(
      AssemblyNotFoundException,
    );
  });

  it('TestGetStaticPropertyInstanceNull', async () => {
    const altDriver = getDriver();
    const screenWidth = await altDriver.callStaticMethod<number>('UnityEngine.Screen', 'get_width', 'UnityEngine.CoreModule', [], []);
    const width = await altDriver.getStaticProperty<number>('UnityEngine.Screen', 'width', 'UnityEngine.CoreModule');
    expect(Number(width)).toBe(Number(screenWidth));
  });

  it('TestSetCommandTimeout', async () => {
    const altDriver = getDriver();
    altDriver.setCommandResponseTimeout(1);
    await expect(altDriver.tilt({ x: 1, y: 1, z: 1 }, 3, true)).rejects.toThrow(CommandResponseTimeoutException);
    altDriver.setCommandResponseTimeout(60);
  });

  it('TestKeysDown', async () => {
    const altDriver = getDriver();
    const keys = [AltKeyCode.K, AltKeyCode.L];
    await altDriver.keysDown(keys);
    await altDriver.keysUp(keys);
    const altObject = await altDriver.findObject(By.NAME, 'Capsule');
    const finalPropertyValue = await altObject.getComponentProperty<string>('AltExampleScriptCapsule', 'stringToSetFromTests', 'Assembly-CSharp');
    expect(finalPropertyValue).toBe('multiple keys pressed');
  });

  it('TestPressKeys', async () => {
    const altDriver = getDriver();
    const keys = [AltKeyCode.K, AltKeyCode.L];
    await altDriver.pressKeys(keys);
    const altObject = await altDriver.findObject(By.NAME, 'Capsule');
    const finalPropertyValue = await altObject.getComponentProperty<string>('AltExampleScriptCapsule', 'stringToSetFromTests', 'Assembly-CSharp');
    expect(finalPropertyValue).toBe('multiple keys pressed');
  });

  // TestFindElementAtCoordinates is not ported: the C# method has no [Test] attribute, so NUnit never runs it.

  it('TestFindElementAtCoordinates_NoElement', async () => {
    const altDriver = getDriver();
    await altDriver.findObject(By.NAME, 'ButtonCounter');
    const element = await altDriver.findObjectAtCoordinates({ x: -1, y: -1 });
    expect(element).toBeNull();
  });

  it('TestFindElementAtCoordinates_3dElement', async () => {
    const altDriver = getDriver();
    const counterButton = await altDriver.findObject(By.NAME, 'Capsule');
    const element = await altDriver.findObjectAtCoordinates(counterButton.getScreenPosition());
    expect(element?.name).toBe('Capsule');
  });

  it('TestScrollViewSwipe', async () => {
    const altDriver = getDriver();
    await altDriver.loadScene('Scene 11 ScrollView Scene');
    const buttons = await altDriver.findObjects(By.PATH, '//Content/*');
    for (let i = 1; i <= buttons.length - 3; i++) {
      await altDriver.swipe(buttons[i].getScreenPosition(), buttons[i - 1].getScreenPosition(), 0.2);
    }
    expect(await buttons[0].getComponentProperty<number>('AltScrollViewButtonController', 'Counter', 'Assembly-CSharp')).toBe(0);
  });

  it('TestCallPrivateMethod', async () => {
    const altDriver = getDriver();
    const altObject = await altDriver.findObject(By.NAME, 'Capsule');
    await altObject.callComponentMethod<string>('AltExampleScriptCapsule', 'callJump', 'Assembly-CSharp', []);
    const capsuleInfo = await altDriver.findObject(By.NAME, 'CapsuleInfo');
    const text = await capsuleInfo.getText();
    expect(text).toBe('Capsule jumps!');
  });

  it('TestOpenDialogWithBeginEndTouch', async () => {
    const altDriver = getDriver();
    const icon = await altDriver.findObject(By.NAME, 'Icon');
    let id = await altDriver.beginTouch({ x: icon.x - 25, y: icon.y + 25 });
    await altDriver.endTouch(id);
    expect(await altDriver.waitForObject(By.NAME, 'Dialog')).not.toBeNull();

    id = await altDriver.beginTouch({ x: icon.x - 25, y: icon.y + 25 });
    await altDriver.endTouch(id);
    await expect(altDriver.waitForObject(By.NAME, 'Dialog', By.NAME, '', 0.5)).rejects.toThrow(WaitTimeOutException);
  });

  // [Ignore("Skip")]
  it.skip('TestResetInput', async () => {
    const altDriver = getDriver();
    const nis = 'AltTester.AltTesterUnitySDK.NewInputSystem';
    await altDriver.keyDown(AltKeyCode.P, 1);
    expect(
      await (await altDriver.findObject(By.NAME, 'AltTesterPrefab')).getComponentProperty<boolean>(
        nis,
        'Keyboard.pKey.isPressed',
        'AltTester.AltTesterUnitySDK',
      ),
    ).toBe(true);
    await altDriver.resetInput();
    expect(
      await (await altDriver.findObject(By.NAME, 'AltTesterPrefab')).getComponentProperty<boolean>(
        nis,
        'Keyboard.pKey.isPressed',
        'AltTester.AltTesterUnitySDK',
      ),
    ).toBe(false);

    const countKeyDown = await (await altDriver.findObject(By.NAME, 'AltTesterPrefab')).getComponentProperty<number>(
      'Input',
      '_keyCodesPressed.Count',
      'Assembly-CSharp',
    );
    expect(countKeyDown).toBe(0);
  });

  // [Category("WebGLUnsupported")]
  it('TestWaitForComponentPropertyMultipleTypes', async () => {
    const altDriver = getDriver();
    // C# passes JToken.Parse(...) values; the parsed JSON values are passed here, with getPropertyAsString true.
    const canvas = await altDriver.waitForObject(By.PATH, '/Canvas');
    await canvas.waitForComponentProperty('UnityEngine.RectTransform', 'rect.center.x', JSON.parse('0.0'), 'UnityEngine.CoreModule', 1, 0.5, true);
    await canvas.waitForComponentProperty('UnityEngine.RectTransform', 'parentInternal', JSON.parse('null'), 'UnityEngine.CoreModule', 1, 0.5, true);
    await canvas.waitForComponentProperty('UnityEngine.RectTransform', 'hasChanged', JSON.parse('true'), 'UnityEngine.CoreModule', 1, 0.5, true);
    await canvas.waitForComponentProperty('UnityEngine.RectTransform', 'name', JSON.parse('"Canvas"'), 'UnityEngine.CoreModule', 1, 0.5, true);
    await canvas.waitForComponentProperty('UnityEngine.RectTransform', 'hideFlags', JSON.parse('0'), 'UnityEngine.CoreModule', 1, 0.5, true);
    await canvas.waitForComponentProperty(
      'UnityEngine.Canvas',
      'transform',
      JSON.parse('[[], [[]], [[]], [[]], [[]], [[], [], []], [[[], [], []]], [], [], [[]], [[]], [[]], [[[], [], []]]]'),
      'UnityEngine.UIModule',
      1,
      0.5,
      true,
    );
  });

  it('TestSetStaticProperty', async () => {
    const altDriver = getDriver();
    const expectedValue = 5;
    await altDriver.setStaticProperty('AltExampleScriptCapsule', 'privateStaticVariable', 'Assembly-CSharp', expectedValue);
    const value = await altDriver.getStaticProperty<number>('AltExampleScriptCapsule', 'privateStaticVariable', 'Assembly-CSharp');
    expect(value).toBe(expectedValue);
  });

  it('TestSetStaticNonExistingProperty', async () => {
    const altDriver = getDriver();
    await expect(altDriver.setStaticProperty('AltExampleScriptCapsule', 'UNEXISTING', 'Assembly-CSharp', 5)).rejects.toThrow(
      PropertyNotFoundException,
    );
  });

  it('TestSetStaticPropertyNonExistingComponent', async () => {
    const altDriver = getDriver();
    await expect(altDriver.setStaticProperty('UNEXISTING', 'privateStaticVariable', 'Assembly-CSharp', 5)).rejects.toThrow(
      ComponentNotFoundException,
    );
  });

  // [Category("WebGLUnsupported")] Fails on WebGL in pipeline, skip until issue #1465 is fixed:
  // https://github.com/alttester/AltTester-Unity-SDK/issues/1465
  it('TestSetStaticPropertyNonExistingAssembly', async () => {
    const altDriver = getDriver();
    await expect(altDriver.setStaticProperty('AltExampleScriptCapsule', 'privateStaticVariable', 'UNEXISTING', 5)).rejects.toThrow(
      AssemblyNotFoundException,
    );
  });

  it('TestSetStaticProperty2', async () => {
    const altDriver = getDriver();
    const newValue = 5;
    const expectedArray = [1, 5, 3];
    await altDriver.setStaticProperty('AltExampleScriptCapsule', 'staticArrayOfInts[1]', 'Assembly-CSharp', newValue);
    const value = await altDriver.getStaticProperty<number[]>('AltExampleScriptCapsule', 'staticArrayOfInts', 'Assembly-CSharp');
    expect(value).toEqual(expectedArray);
  });

  it('TestInputToggleDoesntUntoggleWhenADriverDisconnects', async () => {
    const altDriver = getDriver();
    const toggle = await altDriver.findObject(By.PATH, '//Dialog/Toggle', By.NAME, '', false);
    expect(await toggle.getComponentProperty<boolean>('UnityEngine.UI.Toggle', 'isOn', 'UnityEngine.UI')).toBe(true);
    const secondDriver = await AltDriver.connect({ host, port, appName, driverType: 'Desktop' });
    expect(await toggle.getComponentProperty<boolean>('UnityEngine.UI.Toggle', 'isOn', 'UnityEngine.UI')).toBe(true);
    await secondDriver.stop();
    expect(await toggle.getComponentProperty<boolean>('UnityEngine.UI.Toggle', 'isOn', 'UnityEngine.UI')).toBe(true);
  });

  it.each([
    ['By.TAG', 'Finish', 'Button', By.TAG],
    ['By.LAYER', 'ButtonLayer', 'Button', By.LAYER],
    ['By.NAME', 'Button', 'Button', By.NAME],
    ['By.COMPONENT', 'Button', 'UIButton', By.COMPONENT],
    ['By.PATH', '/Button', 'Button', By.PATH],
    ['By.ID', '632dee97-3955-47d3-b760-0eb0aa763f75', 'Button', By.ID],
    ['By.TEXT', 'Change Camera Mode', 'Text', By.TEXT],
  ] as const)('TestFindObjectFromObject(%s, %s, %s)', async (_byName, value, nameOfChild, by) => {
    const altDriver = getDriver();
    const parent = await altDriver.findObject(By.NAME, 'Canvas');
    const child = await parent.findObjectFromObject(by, value);
    expect(child.name === nameOfChild).toBe(true);
  });

  it('TestImplicitTimeout', async () => {
    const altDriver = getDriver();
    const timeStart = Date.now();
    altDriver.setImplicitTimeout(1);
    expect(Math.abs(altDriver.getImplicitTimeout() - 1)).toBeLessThanOrEqual(0.1);
    try {
      await altDriver.waitForObject(By.NAME, 'Capsulee');
    } catch {
      // ignored, as in C#
    }
    const timeEnd = Date.now();
    const time = (timeEnd - timeStart) / 1000;
    expect(time).toBeLessThanOrEqual(5);
    altDriver.setImplicitTimeout(20);
  });

  it('TestImplicitTimeoutOutOfRange', () => {
    const altDriver = getDriver();
    // C# throws ArgumentOutOfRangeException; the TS driver throws InvalidParameterValueException synchronously.
    expect(() => altDriver.setImplicitTimeout(-5)).toThrow(InvalidParameterValueException);
    expect(() => altDriver.setImplicitTimeout(-5)).toThrow('Timeout cannot be negative');
  });
});
