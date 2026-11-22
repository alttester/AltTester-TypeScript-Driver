// Port of Testforscene1TestSample.cs (TestForScene1TestSample) from AltTester-Unity-SDK-Closed-Source sdk-package/Assets/Examples/Test/Editor/Driver
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AltKeyCode,
  By,
  CameraNotFoundException,
  Selection,
  WaitTimeOutException,
} from '../../../src/binding';
import type { AltColor, AltComponent, AltVector3 } from '../../../src/binding';
import { Scenes, sleep } from './setup';
import { useTestBase } from './testBase';

// C# AltPropertyType / AltType.PRIMITIVE
const PRIMITIVE = 0;
const red: AltColor = { r: 1, g: 0, b: 0, a: 1 };

function fastApproximately(a: number, b: number, threshold: number): boolean {
  return Math.abs(a - b) <= threshold;
}

function first<T>(items: T[], predicate: (item: T) => boolean): T {
  const found = items.find(predicate);
  if (found === undefined) throw new Error('Sequence contains no matching element');
  return found;
}

const isCapsuleScript = (c: AltComponent) =>
  c.componentName === 'AltExampleScriptCapsule' && c.assemblyName === 'Assembly-CSharp';

describe('TestForScene1TestSample (part 2)', () => {
  const getDriver = useTestBase(Scenes.Scene01);

  it('TestCallMethodWithMultipleDefinitions', async () => {
    const altDriver = getDriver();
    const capsule = await altDriver.findObject(By.NAME, 'Capsule');
    await capsule.callComponentMethod<string>('AltExampleScriptCapsule', 'Test', 'Assembly-CSharp', ['2'], ['System.Int32']);
    const capsuleInfo = await altDriver.findObject(By.NAME, 'CapsuleInfo');
    expect(await capsuleInfo.getText()).toBe('6');
  });

  it('TestCallMethodWithAssembly', async () => {
    const altDriver = getDriver();
    type Quaternion = { x: number; y: number; z: number; w: number };
    const capsule = await altDriver.findObject(By.NAME, 'Capsule');
    const initialRotation = await capsule.getComponentProperty<Quaternion>(
      'UnityEngine.Transform', 'rotation', 'UnityEngine.CoreModule');
    await capsule.callComponentMethod<string>('UnityEngine.Transform', 'Rotate', 'UnityEngine.CoreModule', [10, 10, 10],
      ['System.Single', 'System.Single', 'System.Single']);
    const capsuleAfterRotation = await altDriver.findObject(By.NAME, 'Capsule');
    const finalRotation = await capsuleAfterRotation.getComponentProperty<Quaternion>(
      'UnityEngine.Transform', 'rotation', 'UnityEngine.CoreModule');
    expect(
      initialRotation.x !== finalRotation.x || initialRotation.y !== finalRotation.y ||
      initialRotation.z !== finalRotation.z || initialRotation.w !== finalRotation.w,
    ).toBe(true);
  });

  it('TestGetAllComponents', async () => {
    const altDriver = getDriver();
    const components = await (await altDriver.findObject(By.NAME, 'Canvas')).getAllComponents();
    expect(components.length).toBe(5);
    expect(components[0].componentName).toBe('UnityEngine.RectTransform');
    expect(components[0].assemblyName).toBe('UnityEngine.CoreModule');
  });

  it('TestGetAllMethodsFromClass', async () => {
    const altDriver = getDriver();
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    const component2 = first(await altElement.getAllComponents(), (c) => c.componentName === 'AltExampleScriptCapsule');
    const methods = await altElement.getAllMethods(component2, Selection.DECLARED);
    expect(methods).toContain('Void UIButtonClicked()');
    expect(methods).not.toContain('Void CancelInvoke(System.String)');
  });

  it('TestGetAllMethodsFromInherited', async () => {
    const altDriver = getDriver();
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    const component2 = first(await altElement.getAllComponents(), (c) => c.componentName === 'AltExampleScriptCapsule');
    const methods = await altElement.getAllMethods(component2, Selection.INHERITED);
    expect(methods).toContain('Void CancelInvoke(System.String)');
    expect(methods).not.toContain('Void UIButtonClicked()');
  });

  it('TestGetAllMethods', async () => {
    const altDriver = getDriver();
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    const component2 = first(await altElement.getAllComponents(), (c) => c.componentName === 'AltExampleScriptCapsule');
    const methods = await altElement.getAllMethods(component2, Selection.ALL);
    expect(methods).toContain('Void CancelInvoke(System.String)');
    expect(methods).toContain('Void UIButtonClicked()');
  });

  it('TestGetAllProperties', async () => {
    const altDriver = getDriver();
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    const component = first(await altElement.getAllComponents(), isCapsuleScript);
    const properties = await altElement.getAllProperties(component, Selection.ALL);
    if (properties.some((prop) => prop.name === 'runInEditMode')) {
      expect(properties.length).toBe(15); // runInEditMode and allowPrefabModeInPlayMode
    } else {
      // if run from editor then there are 12 properties, runInEditMode is only available in Editor
      expect(properties.length).toBeGreaterThanOrEqual(12);
    }
    const property = first(properties, (prop) => prop.name === 'TestProperty');
    expect(property).not.toBeNull();
    expect(property.value).toBe('False');
  });

  it('TestGetAllClassProperties', async () => {
    const altDriver = getDriver();
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    const component = first(await altElement.getAllComponents(), isCapsuleScript);
    const properties = await altElement.getAllProperties(component, Selection.DECLARED);
    expect(properties.length).toBe(5);
    const property = first(properties, (prop) => prop.name === 'TestProperty');
    expect(property).not.toBeNull();
    expect(property.value).toBe('False');
  });

  it('TestGetAllInheritedProperties', async () => {
    const altDriver = getDriver();
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    const component = first(await altElement.getAllComponents(), isCapsuleScript);
    const properties = await altElement.getAllProperties(component, Selection.INHERITED);
    if (properties.some((prop) => prop.name === 'runInEditMode')) {
      expect(properties.length).toBe(10); // runInEditMode and allowPrefabModeInPlayMode
    } else {
      // if ran from editor then there are 10 properties, runInEditMode is only available in Editor
      expect(properties.length).toBeGreaterThanOrEqual(7);
    }
  });

  it('TestGetAllClassFields', async () => {
    const altDriver = getDriver();
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    const component = first(await altElement.getAllComponents(), isCapsuleScript);
    const fields = await altElement.getAllFields(component, Selection.DECLARED);
    expect(fields.length).toBe(22);
  });

  it('TestGetAllInheritedFields', async () => {
    const altDriver = getDriver();
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    const component = first(await altElement.getAllComponents(), isCapsuleScript);
    const fields = await altElement.getAllFields(component, Selection.INHERITED);
    const field = first(fields, (fld) => fld.name === 'inheritedField');
    expect(field.value).toBe('False');
    expect(fields.length).toBe(1);
    expect(field.type).toBe(PRIMITIVE);
  });

  it('TestGetAllFields', async () => {
    const altDriver = getDriver();
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    const component = first(await altElement.getAllComponents(), isCapsuleScript);
    const fields = await altElement.getAllFields(component, Selection.ALL);
    expect(fields.length).toBe(23);
  });

  it('TestGetAllScenes', async () => {
    const altDriver = getDriver();
    const scenes = await altDriver.getAllScenes();
    expect(scenes.length).toBe(16);
    expect(scenes[0]).toBe('Scene 1 AltDriverTestScene');
  });

  it('TestSetTimeScale', async () => {
    const altDriver = getDriver();
    await altDriver.setTimeScale(0.1);
    await sleep(1);
    const timeScaleFromGame = await altDriver.getTimeScale();
    expect(timeScaleFromGame).toBeCloseTo(0.1, 5);
    await altDriver.setTimeScale(1);
  });

  it('TestGetAllCameras', async () => {
    const altDriver = getDriver();
    const cameras = await altDriver.getAllCameras();
    expect(cameras.length).toBe(2);
  });

  it('TestGetAllActiveCameras', async () => {
    const altDriver = getDriver();
    const cameras = await altDriver.getAllActiveCameras();
    expect(cameras.length).toBe(1);
  });

  it('TestGetAllElementsLight', async () => {
    const altDriver = getDriver();
    const altElements = await altDriver.getAllElementsLight();
    expect(altElements.length).toBeGreaterThan(0);
    for (const altElementLight of altElements) {
      expect(altElementLight.enabled).toBe(true);
      expect(altElementLight.id).not.toBe(0);
    }
  });

  it('TestGetScreenshot', async () => {
    const altDriver = getDriver();
    const path = 'testC.png';
    await altDriver.getPNGScreenshot(path);
    expect(existsSync(path)).toBe(true);
  });

  it.each([
    ['ChineseLetters', '哦伊娜哦'],
    ['NonEnglishText', "BJÖRN'S PASS"],
  ])('TestGetChineseLetters(%s, %s)', async (name, nonEnglishText) => {
    const altDriver = getDriver();
    const text = await (await altDriver.findObject(By.NAME, name)).getText();
    expect(text).toBe(nonEnglishText);
  });

  it('TestDoubleTap', async () => {
    const altDriver = getDriver();
    const counterButton = await altDriver.findObject(By.NAME, 'ButtonCounter');
    const counterButtonText = await altDriver.findObject(By.NAME, 'ButtonCounter/Text');
    await counterButton.tap(2);
    await sleep(0.5);
    expect(await counterButtonText.getText()).toBe('2');
  });

  it('TestSwipeWithDuration0', async () => {
    const altDriver = getDriver();
    await altDriver.findObject(By.NAME, 'ButtonCounter');
    const counterButtonText = await altDriver.findObject(By.NAME, 'ButtonCounter/Text');
    await altDriver.swipe(counterButtonText.getScreenPosition(), counterButtonText.getScreenPosition(), 0, false);
    await sleep(0.5);
    expect(await counterButtonText.getText()).toBe('1');
  });

  it('TestCustomTap', async () => {
    const altDriver = getDriver();
    const counterButton = await altDriver.findObject(By.NAME, 'ButtonCounter');
    const counterButtonText = await altDriver.findObject(By.NAME, 'ButtonCounter/Text');
    await altDriver.tap(counterButton.getScreenPosition(), 4);
    await sleep(1);
    expect(await counterButtonText.getText()).toBe('4');
  });

  // C# also passes a 1920x1080 screenshot size; the TS getHighlightedScreenshotAt always sends size 0,0.
  it('TestGet3DObjectFromScreenshot', async () => {
    const altDriver = getDriver();
    const capsule = await altDriver.findObject(By.NAME, 'Capsule');
    const { object: altObject } = await altDriver.getHighlightedScreenshotAt({ x: capsule.x, y: capsule.y }, red, 1);
    expect(altObject?.name).toBe('Capsule');
  });

  it('TestGetUIObjectFromScreenshot', async () => {
    const altDriver = getDriver();
    const capsuleInfo = await altDriver.findObject(By.NAME, 'CapsuleInfo');
    const { object: altObject } = await altDriver.getHighlightedScreenshotAt({ x: capsuleInfo.x, y: capsuleInfo.y }, red, 1);
    expect(altObject?.name).toBe('CapsuleInfo');
  });

  it('TestObjectFromScreenshot', async () => {
    const altDriver = getDriver();
    const icon = await altDriver.findObject(By.NAME, 'Icon');
    const offscreenCoordinates = { x: icon.x + 400, y: icon.y };
    const { object: altObject } = await altDriver.getHighlightedScreenshotAt(offscreenCoordinates, red, 1);
    expect(altObject).toBeNull();
  });

  it('TestPressNextSceneButton', async () => {
    const altDriver = getDriver();
    const initialScene = await altDriver.getCurrentScene();
    await (await altDriver.findObject(By.NAME, 'NextScene')).tap();
    const currentScene = await altDriver.getCurrentScene();
    expect(currentScene).not.toBe(initialScene);
  });

  it('TestForSetText', async () => {
    const altDriver = getDriver();
    const text = await altDriver.findObject(By.NAME, 'NonEnglishText');
    const originalText = await text.getText();
    const afterText = await (await text.setText('ModifiedText')).getText();
    expect(afterText).not.toBe(originalText);
  });

  it('TestFindObjectWithCameraId', async () => {
    const altDriver = getDriver();
    const altButton = await altDriver.findObject(By.PATH, '//Button');
    await altButton.click();
    await altButton.click();
    const camera = await altDriver.findObject(By.PATH, '//Camera');
    const altElement = await altDriver.findObject(By.COMPONENT, 'CapsuleCollider', By.ID, camera.id.toString());
    expect(altElement.name).toBe('Capsule');
    const camera2 = await altDriver.findObject(By.PATH, '//Main Camera');
    const altElement2 = await altDriver.findObject(By.COMPONENT, 'CapsuleCollider', By.ID, camera2.id.toString());
    expect(altElement.getScreenPosition()).not.toEqual(altElement2.getScreenPosition());
  });

  it('TestWaitForObjectWithCameraId', async () => {
    const altDriver = getDriver();
    const altButton = await altDriver.findObject(By.PATH, '//Button');
    await altButton.click();
    await altButton.click();
    const camera = await altDriver.findObject(By.PATH, '//Camera');
    const altElement = await altDriver.waitForObject(By.COMPONENT, 'CapsuleCollider', By.ID, camera.id.toString());
    expect(altElement.name).toBe('Capsule');
    const camera2 = await altDriver.findObject(By.PATH, '//Main Camera');
    const altElement2 = await altDriver.waitForObject(By.COMPONENT, 'CapsuleCollider', By.ID, camera2.id.toString());
    expect(altElement.getScreenPosition()).not.toEqual(altElement2.getScreenPosition());
  });

  it('TestFindObjectsWithCameraId', async () => {
    const altDriver = getDriver();
    const altButton = await altDriver.findObject(By.PATH, '//Button');
    await altButton.click();
    await altButton.click();
    const camera = await altDriver.findObject(By.PATH, '//Camera');
    const altElement = await altDriver.findObjects(By.NAME, 'Plane', By.ID, camera.id.toString());
    expect(altElement[0].name).toBe('Plane');
    const camera2 = await altDriver.findObject(By.PATH, '//Main Camera');
    const altElement2 = await altDriver.findObjects(By.NAME, 'Plane', By.ID, camera2.id.toString());
    expect(altElement[0].getScreenPosition()).not.toEqual(altElement2[0].getScreenPosition());
  });

  it('TestWaitForObjectNotBePresentWithCameraId', async () => {
    const altDriver = getDriver();
    const camera2 = await altDriver.findObject(By.PATH, '//Main Camera');
    await altDriver.waitForObjectToNotBePresent(By.NAME, 'ObjectDestroyedIn5Secs', By.ID, camera2.id.toString());

    const allObjectsInTheScene = await altDriver.getAllElements();
    expect(allObjectsInTheScene.some((obj) => obj.name === 'ObjectDestroyedIn5Secs')).toBe(false);
  });

  // [Obsolete]
  it('TestWaitForElementWithTextWithCameraId', async () => {
    const altDriver = getDriver();
    const name = 'CapsuleInfo';
    const text = await (await altDriver.findObject(By.NAME, name)).getText();
    const timeStart = Date.now();
    const camera2 = await altDriver.findObject(By.PATH, '//Main Camera');
    const altElement = await altDriver.waitForObject(By.PATH, '//' + name + '[@text=' + text + ']', By.ID, camera2.id.toString());
    const timeEnd = Date.now();
    const time = (timeEnd - timeStart) / 1000;
    expect(time).toBeLessThan(20);
    expect(altElement).not.toBeNull();
    expect(await altElement.getText()).toBe(text);
  });

  it('TestWaitForObjectWhichContainsWithCameraId', async () => {
    const altDriver = getDriver();
    const camera2 = await altDriver.findObject(By.PATH, '//Main Camera');
    const altElement = await altDriver.waitForObjectWhichContains(By.NAME, 'Canva', By.ID, camera2.id.toString());
    expect(altElement.name).toBe('Canvas');
  });

  it('TestWaitForObjectWhichContainsWithTag', async () => {
    const altDriver = getDriver();
    const altElement = await altDriver.waitForObjectWhichContains(By.NAME, 'Canva', By.TAG, 'MainCamera');
    expect(altElement.name).toBe('Canvas');
  });

  it('TestWaitForObjectWhichContainsNonExistingCriteria', async () => {
    const altDriver = getDriver();
    await expect(altDriver.waitForObjectWhichContains(By.NAME, 'Unexisting', By.TAG, 'MainCamera', 2))
      .rejects.toThrow(WaitTimeOutException);
  });

  it('TestWaitForObjectWhichContainsExistingCriteriaButNonExistingCamera', async () => {
    const altDriver = getDriver();
    // C# AltCameraNotFoundException
    await expect(altDriver.waitForObjectWhichContains(By.NAME, 'Canva', By.TAG, 'Unexisting', 2))
      .rejects.toThrow(CameraNotFoundException);
  });

  it('TestClickOnTextAndTheParentIsClicked', async () => {
    const altDriver = getDriver();
    const uiButton = await altDriver.findObject(By.NAME, 'UIButton/Text');
    await uiButton.click();
    const capsuleInfo = await altDriver.findObject(By.NAME, 'CapsuleInfo');
    const text = await capsuleInfo.getText();
    expect(text).toBe('UIButton clicked to jump capsule!');
  });

  it('TestAcceleration', async () => {
    const altDriver = getDriver();
    let capsule = await altDriver.findObject(By.NAME, 'Capsule');
    const initialWorldCoordinates = capsule.getWorldPosition();
    await altDriver.tilt({ x: 1, y: 1, z: 1 }, 1, false);
    await sleep(1);
    capsule = await altDriver.findObject(By.NAME, 'Capsule');
    const afterTiltCoordinates = capsule.getWorldPosition();
    expect(afterTiltCoordinates).not.toEqual(initialWorldCoordinates);
  });

  it('TestAccelerationAndWait', async () => {
    const altDriver = getDriver();
    let capsule = await altDriver.findObject(By.NAME, 'Capsule');
    const initialWorldCoordinates = capsule.getWorldPosition();
    await altDriver.tilt({ x: 1, y: 1, z: 1 }, 1);
    await sleep(0.1);
    capsule = await altDriver.findObject(By.NAME, 'Capsule');
    const afterTiltCoordinates = capsule.getWorldPosition();
    expect(afterTiltCoordinates).not.toEqual(initialWorldCoordinates);
  });

  const findObjectByCameraCases: [string, By, string][] = [
    ['By.NAME', By.NAME, 'Main Camera'],
    ['By.COMPONENT', By.COMPONENT, 'Camera'],
    ['By.TAG', By.TAG, 'MainCamera'],
    ['By.PATH', By.PATH, '/Main Camera'],
    ['By.LAYER', By.LAYER, 'Default'],
    ['By.ID', By.ID, '6cc4c8e2-0b4a-4634-9c98-2f585188ce3c'],
  ];
  for (const [label, cameraBy, cameraValue] of findObjectByCameraCases) {
    it(`TestFindObjectByCamera(${label}, ${cameraValue})`, async () => {
      const altDriver = getDriver();
      const referenceId = (await altDriver.findObject(By.PATH, '//Capsule')).id;
      const altObject = await altDriver.findObject(By.PATH, '//Capsule', cameraBy, cameraValue);
      expect(altObject).not.toBeNull();
      expect(altObject.id).toBe(referenceId);
    });
  }

  it('TestWaitForObjectByCamera', async () => {
    const altDriver = getDriver();
    const altButton = await altDriver.findObject(By.PATH, '//Button');
    await altButton.click();
    await altButton.click();
    const altElement = await altDriver.waitForObject(By.COMPONENT, 'CapsuleCollider', By.NAME, 'Camera');
    expect(altElement.name).toBe('Capsule');
    const altElement2 = await altDriver.waitForObject(By.COMPONENT, 'CapsuleCollider', By.NAME, 'Main Camera');
    expect(altElement.getScreenPosition()).not.toEqual(altElement2.getScreenPosition());
  });

  it('TestFindObjectsByCamera', async () => {
    const altDriver = getDriver();
    const altButton = await altDriver.findObject(By.PATH, '//Button');
    await altButton.click();
    await altButton.click();
    const altElement = await altDriver.findObjects(By.NAME, 'Plane', By.NAME, 'Camera');
    expect(altElement[0].name).toBe('Plane');
    const altElement2 = await altDriver.findObjects(By.NAME, 'Plane', By.NAME, 'Main Camera');
    expect(altElement[0].getScreenPosition()).not.toEqual(altElement2[0].getScreenPosition());
  });

  it('TestWaitForObjectNotBePresentByCamera', async () => {
    const altDriver = getDriver();
    await altDriver.waitForObjectToNotBePresent(By.NAME, 'ObjectDestroyedIn5Secs', By.NAME, 'Main Camera');

    const allObjectsInTheScene = await altDriver.getAllElements();
    expect(allObjectsInTheScene.some((obj) => obj.name === 'ObjectDestroyedIn5Secs')).toBe(false);
  });

  it('TestLoadAdditiveScenes', async () => {
    const altDriver = getDriver();
    const initialNumberOfElements = await altDriver.getAllElements();
    await altDriver.loadScene('Scene 2 Draggable Panel', false);
    const finalNumberOfElements = await altDriver.getAllElements();
    expect(initialNumberOfElements.length).toBeLessThan(finalNumberOfElements.length);
    const scenes = await altDriver.getAllLoadedScenes();
    expect(scenes.length).toBe(2);
    await altDriver.loadScene('Scene 2 Draggable Panel', true);
  });

  it('TestGetAltObjectWithCanvasParentButOnlyTransform', async () => {
    const altDriver = getDriver();
    const altObject = await altDriver.findObject(By.NAME, 'UIWithWorldSpace/Plane');
    expect(altObject).not.toBeNull();
  });

  it('TestGetScreensizeScreenshot', async () => {
    const altDriver = getDriver();
    const screenWidth = await altDriver.callStaticMethod<number>('UnityEngine.Screen', 'get_width', 'UnityEngine.CoreModule', [], []);
    const screenHeight = await altDriver.callStaticMethod<number>('UnityEngine.Screen', 'get_height', 'UnityEngine.CoreModule', [], []);
    let screenshot = await altDriver.getScreenshot();
    expect(screenshot.textureSize.x).toBe(screenWidth);
    expect(screenshot.textureSize.y).toBe(screenHeight);

    screenshot = await altDriver.getScreenshot(50);
    expect(screenshot.textureSize.x).toBe(screenWidth);
    expect(screenshot.textureSize.y).toBe(screenHeight);

    const capsule = await altDriver.findObject(By.NAME, 'Capsule');
    screenshot = await altDriver.getHighlightedScreenshot(capsule.id, red, 1.5);
    expect(screenshot.textureSize.x).toBe(screenWidth);
    expect(screenshot.textureSize.y).toBe(screenHeight);

    screenshot = await altDriver.getHighlightedScreenshot(capsule.id, red, 1.5, 50);
    expect(screenshot.textureSize.x).toBe(screenWidth);
    expect(screenshot.textureSize.y).toBe(screenHeight);
  });

  it('TestGetComponentPropertyComplexClass', async () => {
    const altDriver = getDriver();
    const componentName = 'AltExampleScriptCapsule';
    const propertyName = 'AltSampleClass.testInt';
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    expect(altElement).not.toBeNull();
    const propertyValue = await altElement.getComponentProperty<number>(componentName, propertyName, 'Assembly-CSharp');
    expect(propertyValue).toBe(1);
  });

  it('TestGetComponentPropertyComplexClass2', async () => {
    const altDriver = getDriver();
    const componentName = 'AltExampleScriptCapsule';
    const propertyName = 'listOfSampleClass[1].testString';
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    expect(altElement).not.toBeNull();
    const propertyValue = await altElement.getComponentProperty<string>(componentName, propertyName, 'Assembly-CSharp');
    expect(propertyValue).toBe('test2');
  });

  it('TestSetComponentPropertyComplexClass', async () => {
    const altDriver = getDriver();
    const componentName = 'AltExampleScriptCapsule';
    const propertyName = 'AltSampleClass.testInt';
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    expect(altElement).not.toBeNull();
    await altElement.setComponentProperty(componentName, propertyName, 'Assembly-CSharp', 2);
    const propertyValue = await altElement.getComponentProperty<number>(componentName, propertyName, 'Assembly-CSharp');
    expect(propertyValue).toBe(2);
  });

  it('TestSetComponentPropertyComplexClass2', async () => {
    const altDriver = getDriver();
    const componentName = 'AltExampleScriptCapsule';
    const propertyName = 'listOfSampleClass[1].testString';
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    expect(altElement).not.toBeNull();
    await altElement.setComponentProperty(componentName, propertyName, 'Assembly-CSharp', 'test3');
    const propertyValue = await altElement.getComponentProperty<string>(componentName, propertyName, 'Assembly-CSharp');
    expect(propertyValue).toBe('test3');
  });

  it('TestSetComponentPropertyComplexClass3', async () => {
    const altDriver = getDriver();
    const componentName = 'AltExampleScriptCapsule';
    const propertyName = 'arrayOfInts[0]';
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    expect(altElement).not.toBeNull();
    await altElement.setComponentProperty(componentName, propertyName, 'Assembly-CSharp', 11);
    const propertyValue = await altElement.getComponentProperty<number>(componentName, propertyName, 'Assembly-CSharp');
    expect(propertyValue).toBe(11);
  });

  it('TestClickWithMouse0Capsule', async () => {
    const altDriver = getDriver();
    let capsule = await altDriver.findObject(By.NAME, 'Capsule');
    const initialCapsulePosition = capsule.getWorldPosition();
    await altDriver.moveMouse(capsule.getScreenPosition(), 0.1);
    await sleep(0.4);
    await altDriver.pressKey(AltKeyCode.Mouse0, 1, 0.2);
    capsule = await altDriver.findObject(By.NAME, 'Capsule');
    const finalCapsulePosition = capsule.getWorldPosition();
    expect(finalCapsulePosition).not.toEqual(initialCapsulePosition);
  });

  const expectSamePosition = (initial: AltVector3, final: AltVector3) => {
    expect(fastApproximately(initial.x, final.x, 0.01)).toBe(true);
    expect(fastApproximately(initial.y, final.y, 0.01)).toBe(true);
    expect(fastApproximately(initial.z, final.z, 0.01)).toBe(true);
  };

  it('TestClickWithMouse1Capsule', async () => {
    const altDriver = getDriver();
    let capsule = await altDriver.findObject(By.NAME, 'Capsule');
    const initialCapsulePosition = capsule.getWorldPosition();
    await altDriver.moveMouse(capsule.getScreenPosition(), 0.1);
    await sleep(0.4);
    await altDriver.pressKey(AltKeyCode.Mouse1, 1, 0.2);

    capsule = await altDriver.findObject(By.NAME, 'Capsule');
    const finalCapsulePosition = capsule.getWorldPosition();
    expectSamePosition(initialCapsulePosition, finalCapsulePosition);
  });

  it('TestClickWithMouse2Capsule', async () => {
    const altDriver = getDriver();
    let capsule = await altDriver.findObject(By.NAME, 'Capsule');
    const initialCapsulePosition = capsule.getWorldPosition();
    await altDriver.moveMouse(capsule.getScreenPosition(), 0.1);
    await sleep(0.4);
    await altDriver.pressKey(AltKeyCode.Mouse2, 1, 0.2);
    capsule = await altDriver.findObject(By.NAME, 'Capsule');
    const finalCapsulePosition = capsule.getWorldPosition();
    expectSamePosition(initialCapsulePosition, finalCapsulePosition);
  });

  // TS driver has no AltDriver.VERSION (the SDK version the driver targets); BINDING_VERSION is the npm package
  // version, which does not match the server version. C#: Assert.AreEqual(AltDriver.VERSION, altDriver.GetServerVersion())
  it.skip('TestGetVersion', async () => {
    const altDriver = getDriver();
    expect(await altDriver.getServerVersion()).toBeTruthy();
  });

  it('TestStringIsMarkedAsPrimitive', async () => {
    const altDriver = getDriver();
    const altElement = await altDriver.findObject(By.NAME, 'ChineseLetters');
    const component = first(await altElement.getAllComponents(), (c) => c.componentName === 'UnityEngine.UI.Text');
    const properties = await altElement.getAllProperties(component, Selection.ALL);

    const property = first(properties, (prop) => prop.name === 'text');
    expect(property).not.toBeNull();
    expect(property.type).toBe(PRIMITIVE);
  });

  it('TestKeyPressNumberOfReads', async () => {
    const altDriver = getDriver();
    const counterElement = await altDriver.findObject(By.NAME, 'ButtonCounter');
    await altDriver.pressKey(AltKeyCode.LeftArrow);

    const pressDownCounter = await counterElement.getComponentProperty<number>(
      'AltExampleScriptIncrementOnClick', 'keyPressDownCounter', 'Assembly-CSharp');
    const pressUpCounter = await counterElement.getComponentProperty<number>(
      'AltExampleScriptIncrementOnClick', 'keyPressUpCounter', 'Assembly-CSharp');
    expect(pressDownCounter).toBe(1);
    expect(pressUpCounter).toBe(1);
  });

  it('TestKeyPressReadByUnityKeyName', async () => {
    const altDriver = getDriver();
    const counterElement = await altDriver.findObject(By.NAME, 'ButtonCounter');
    await altDriver.pressKey(AltKeyCode.LeftArrow);

    const pressDownCounter = await counterElement.getComponentProperty<number>(
      'AltExampleScriptIncrementOnClick', 'keyNamePressDownCounter', 'Assembly-CSharp');
    const pressUpCounter = await counterElement.getComponentProperty<number>(
      'AltExampleScriptIncrementOnClick', 'keyNamePressUpCounter', 'Assembly-CSharp');
    const pressedCounter = await counterElement.getComponentProperty<number>(
      'AltExampleScriptIncrementOnClick', 'keyNamePressedCounter', 'Assembly-CSharp');
    expect(pressDownCounter).toBe(1);
    expect(pressUpCounter).toBe(1);
    expect(pressedCounter).toBeGreaterThan(0);
  });
});
