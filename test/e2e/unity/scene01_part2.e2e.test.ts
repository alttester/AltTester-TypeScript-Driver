// Port of Bindings~/python/tests/integration/test_scene01_part2.py
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AltKeyCode, By, CameraNotFoundException, CommandResponseTimeoutException } from '../../../src/binding';
import type { AltDriver } from '../../../src/binding';
import { closeAltTesterPopup, connectDriver, Scenes } from './setup';

describe('TestScene01Part2', () => {
  let d: AltDriver;
  beforeAll(async () => { d = await connectDriver(); });
  afterAll(async () => { await d?.stop(); });
  beforeEach(async () => {
    await closeAltTesterPopup(d);
    await d.resetInput();
    await d.loadScene(Scenes.Scene01);
  });

  const tapButtonTwice = async () => {
    const altButton = await d.findObject(By.PATH, '//Button');
    await altButton.tap();
    await altButton.tap();
  };

  it('test_find_object_with_camera_id', async () => {
    await tapButtonTwice();

    const camera = await d.findObject(By.PATH, '//Camera');
    const altObject = await d.findObject(By.COMPONENT, 'CapsuleCollider', By.ID, String(camera.id));
    expect(altObject.name).toBe('Capsule');

    const camera2 = await d.findObject(By.PATH, '//Main Camera');
    const altObject2 = await d.findObject(By.COMPONENT, 'CapsuleCollider', By.ID, String(camera2.id));

    expect(altObject.x).not.toBe(altObject2.x);
    expect(altObject.y).not.toBe(altObject2.y);
  });

  it('test_wait_for_object_with_camera_id', async () => {
    await tapButtonTwice();

    const camera = await d.findObject(By.PATH, '//Camera');
    const altObject = await d.waitForObject(By.COMPONENT, 'CapsuleCollider', By.ID, String(camera.id));
    expect(altObject.name).toBe('Capsule');

    const camera2 = await d.findObject(By.PATH, '//Main Camera');
    const altObject2 = await d.waitForObject(By.COMPONENT, 'CapsuleCollider', By.ID, String(camera2.id));

    expect(altObject.x).not.toBe(altObject2.x);
    expect(altObject.y).not.toBe(altObject2.y);
  });

  it('test_find_objects_with_camera_id', async () => {
    await tapButtonTwice();

    const camera = await d.findObject(By.PATH, '//Camera');
    const altObjects = await d.findObjects(By.NAME, 'Plane', By.ID, String(camera.id));
    expect(altObjects[0].name).toBe('Plane');

    const camera2 = await d.findObject(By.PATH, '//Main Camera');
    const altObjects2 = await d.findObjects(By.NAME, 'Plane', By.ID, String(camera2.id));

    expect(altObjects[0].x).not.toBe(altObjects2[0].x);
    expect(altObjects[0].y).not.toBe(altObjects2[0].y);
  });

  it('test_wait_for_object_not_be_present_with_camera_id', async () => {
    const camera = await d.findObject(By.PATH, '//Main Camera');
    await d.waitForObjectToNotBePresent(By.NAME, 'ObjectDestroyedIn5Secs', By.ID, String(camera.id));

    const elements = await d.getAllElements();
    const names = elements.map((e) => e.name);
    expect(names).not.toContain('ObjectDestroyedIn5Secs');
  });

  it('test_wait_for_object_with_text_with_camera_id', async () => {
    const name = 'CapsuleInfo';
    const text = await (await d.findObject(By.NAME, name)).getText();
    const camera = await d.findObject(By.PATH, '//Main Camera');

    const altObject = await d.waitForObject(By.PATH, `//${name}[@text=${text}]`, By.ID, String(camera.id), 1);

    expect(altObject).not.toBeNull();
    expect(await altObject.getText()).toBe(text);
  });

  it('test_wait_for_object_which_contains_with_camera_id', async () => {
    const camera = await d.findObject(By.PATH, '//Main Camera');
    const altObject = await d.waitForObjectWhichContains(By.NAME, 'Canva', By.ID, String(camera.id));
    expect(altObject.name).toBe('Canvas');
  });

  it('test_find_object_with_tag', async () => {
    await tapButtonTwice();

    const altObject = await d.findObject(By.COMPONENT, 'CapsuleCollider', By.TAG, 'MainCamera');
    expect(altObject.name).toBe('Capsule');

    const altObject2 = await d.findObject(By.COMPONENT, 'CapsuleCollider', By.TAG, 'Untagged');
    expect(altObject.x).not.toBe(altObject2.x);
    expect(altObject.y).not.toBe(altObject2.y);
  });

  it('test_wait_for_object_with_tag', async () => {
    await tapButtonTwice();

    const altObject = await d.waitForObject(By.COMPONENT, 'CapsuleCollider', By.TAG, 'MainCamera');
    expect(altObject.name).toBe('Capsule');

    const altObject2 = await d.waitForObject(By.COMPONENT, 'CapsuleCollider', By.TAG, 'Untagged');
    expect(altObject.x).not.toBe(altObject2.x);
    expect(altObject.y).not.toBe(altObject2.y);
  });

  it('test_find_objects_with_tag', async () => {
    await tapButtonTwice();

    const altObject = await d.findObjects(By.NAME, 'Plane', By.TAG, 'MainCamera');
    expect(altObject[0].name).toBe('Plane');

    const altObject2 = await d.findObjects(By.NAME, 'Plane', By.TAG, 'Untagged');
    expect(altObject[0].x).not.toBe(altObject2[0].x);
    expect(altObject[0].y).not.toBe(altObject2[0].y);
  });

  it('test_wait_for_object_not_be_present_with_tag', async () => {
    await d.waitForObjectToNotBePresent(By.NAME, 'ObjectDestroyedIn5Secs', By.TAG, 'MainCamera');

    const elements = await d.getAllElements();
    const names = elements.map((e) => e.name);
    expect(names).not.toContain('ObjectDestroyedIn5Secs');
  });

  it('test_wait_for_object_with_text_with_tag', async () => {
    const name = 'CapsuleInfo';
    const text = await (await d.findObject(By.NAME, name)).getText();

    const altObject = await d.waitForObject(By.PATH, `//${name}[@text=${text}]`, By.TAG, 'MainCamera', 1);
    expect(altObject).not.toBeNull();
    expect(await altObject.getText()).toBe(text);
  });

  it('test_find_object_by_camera', async () => {
    await tapButtonTwice();

    const altObject = await d.findObject(By.COMPONENT, 'CapsuleCollider', By.NAME, 'Camera');

    expect(altObject.name).toBe('Capsule');
    const altObject2 = await d.findObject(By.COMPONENT, 'CapsuleCollider', By.NAME, 'Main Camera');

    expect(altObject.x).not.toBe(altObject2.x);
    expect(altObject.y).not.toBe(altObject2.y);
  });

  it('test_wait_for_object_by_camera', async () => {
    await tapButtonTwice();

    const altObject = await d.waitForObject(By.COMPONENT, 'CapsuleCollider', By.NAME, 'Camera');
    expect(altObject.name).toBe('Capsule');

    const altObject2 = await d.waitForObject(By.COMPONENT, 'CapsuleCollider', By.NAME, 'Main Camera');
    expect(altObject.x).not.toBe(altObject2.x);
    expect(altObject.y).not.toBe(altObject2.y);
  });

  it('test_find_objects_by_camera', async () => {
    await tapButtonTwice();

    const altObject = await d.findObjects(By.NAME, 'Plane', By.NAME, 'Camera');
    expect(altObject[0].name).toBe('Plane');

    const altObject2 = await d.findObjects(By.NAME, 'Plane', By.NAME, 'Main Camera');
    expect(altObject[0].x).not.toBe(altObject2[0].x);
    expect(altObject[0].y).not.toBe(altObject2[0].y);
  });

  it('test_wait_for_object_not_be_present_by_camera', async () => {
    await d.waitForObjectToNotBePresent(By.NAME, 'ObjectDestroyedIn5Secs', By.NAME, 'Main Camera');

    const elements = await d.getAllElements();
    const names = elements.map((e) => e.name);
    expect(names).not.toContain('ObjectDestroyedIn5Secs');
  });

  it('test_wait_for_object_by_camera_2', async () => {
    const name = 'CapsuleInfo';
    const text = await (await d.findObject(By.NAME, name)).getText();

    const altObject = await d.waitForObject(By.PATH, `//${name}[@text=${text}]`, By.NAME, 'Main Camera', 1);

    expect(altObject).not.toBeNull();
    expect(await altObject.getText()).toBe(text);
  });

  it('test_wait_for_object_which_contains_by_camera', async () => {
    const altObject = await d.waitForObjectWhichContains(By.NAME, 'Canva', By.NAME, 'Main Camera');
    expect(altObject.name).toBe('Canvas');
  });

  it('test_get_component_property_complex_class', async () => {
    const componentName = 'AltExampleScriptCapsule';
    const propertyName = 'AltSampleClass.testInt';

    const altObject = await d.findObject(By.NAME, 'Capsule');
    expect(altObject).not.toBeNull();

    const propertyValue = await altObject.getComponentProperty(componentName, propertyName, 'Assembly-CSharp', 1);
    expect(propertyValue).toBe(1);
  });

  it('test_get_component_property_complex_class2', async () => {
    const componentName = 'AltExampleScriptCapsule';
    const propertyName = 'listOfSampleClass[1].testString';
    const altObject = await d.findObject(By.NAME, 'Capsule');
    expect(altObject).not.toBeNull();

    const propertyValue = await altObject.getComponentProperty(componentName, propertyName, 'Assembly-CSharp', 1);
    expect(propertyValue).toBe('test2');
  });

  it('test_set_component_property_complex_class', async () => {
    const componentName = 'AltExampleScriptCapsule';
    const propertyName = 'AltSampleClass.testInt';

    const altObject = await d.findObject(By.NAME, 'Capsule');
    expect(altObject).not.toBeNull();

    await altObject.setComponentProperty(componentName, propertyName, 'Assembly-CSharp', 2);
    const propertyValue = await altObject.getComponentProperty(componentName, propertyName, 'Assembly-CSharp', 1);
    expect(propertyValue).toBe(2);
  });

  it('test_set_component_property_complex_class2', async () => {
    const componentName = 'AltExampleScriptCapsule';
    const propertyName = 'listOfSampleClass[1].testString';
    const altObject = await d.findObject(By.NAME, 'Capsule');
    expect(altObject).not.toBeNull();

    await altObject.setComponentProperty(componentName, propertyName, 'Assembly-CSharp', 'test3');
    const propertyValue = await altObject.getComponentProperty(componentName, propertyName, 'Assembly-CSharp', 1);
    expect(propertyValue).toBe('test3');
  });

  it('test_get_parent', async () => {
    const element = await d.findObject(By.NAME, 'Canvas/CapsuleInfo');
    const elementParent = await element.getParent();
    expect(elementParent.name).toBe('Canvas');
  });

  it('test_tap_coordinates', async () => {
    const capsuleElement = await d.findObject(By.NAME, 'Capsule');
    await d.tap(capsuleElement.getScreenPosition());
    await d.waitForObject(By.PATH, '//CapsuleInfo[@text=Capsule was clicked to jump!]', By.NAME, '', 1);
  });

  it('test_click_coordinates', async () => {
    const capsuleElement = await d.findObject(By.NAME, 'Capsule');
    await d.click(capsuleElement.getScreenPosition());
    await d.waitForObject(By.PATH, '//CapsuleInfo[@text=Capsule was clicked to jump!]', By.NAME, '', 1);
  });

  it('test_tap_element', async () => {
    const capsuleElement = await d.findObject(By.NAME, 'Capsule');
    await capsuleElement.tap(1);
    await d.waitForObject(By.PATH, '//CapsuleInfo[@text=Capsule was clicked to jump!]', By.NAME, '', 1);
  });

  it('test_click_element', async () => {
    const capsuleElement = await d.findObject(By.NAME, 'Capsule');
    await capsuleElement.click();
    await d.waitForObject(By.PATH, '//CapsuleInfo[@text=Capsule was clicked to jump!]', By.NAME, '', 1);
  });

  it('test_key_down_and_key_up_mouse0', async () => {
    const button = await d.findObject(By.NAME, 'UIButton');
    await d.moveMouse(button.getScreenPosition(), 0.1, true);

    await d.keyDown(AltKeyCode.Mouse0);
    await d.keyUp(AltKeyCode.Mouse0);
    const text = await (await d.findObject(By.NAME, 'ChineseLetters')).getText();
    expect(text).not.toBe('????');
  });

  it('test_camera_not_found_exception', async () => {
    await expect(d.findObject(By.NAME, 'Capsule', By.NAME, 'Camera')).rejects.toBeInstanceOf(CameraNotFoundException);
  });

  it('test_input_field_events', async () => {
    const inputField = await (await d.findObject(By.NAME, 'UnityUIInputField')).setText('example', true);

    expect(await inputField.getText()).toBe('example');
    expect(await inputField.getComponentProperty('AltInputFieldRaisedEvents', 'onValueChangedInvoked', 'Assembly-CSharp')).toBeTruthy();
    expect(await inputField.getComponentProperty('AltInputFieldRaisedEvents', 'onSubmitInvoked', 'Assembly-CSharp')).toBeTruthy();
  });

  // Python marks: WebGLUnsupported, iOSUnsupported
  it('test_get_static_property', async () => {
    await d.callStaticMethod(
      'UnityEngine.Screen', 'SetResolution', 'UnityEngine.CoreModule',
      ['1920', '1080', 'True'],
      ['System.Int32', 'System.Int32', 'System.Boolean'],
    );
    const width = await d.getStaticProperty('UnityEngine.Screen', 'currentResolution.width', 'UnityEngine.CoreModule');

    expect(Number.parseInt(String(width), 10)).toBe(1920);
  });

  it('test_set_static_property', async () => {
    const expectedValue = 5;
    await d.setStaticProperty('AltExampleScriptCapsule', 'privateStaticVariable', 'Assembly-CSharp', expectedValue);
    const value = await d.getStaticProperty('AltExampleScriptCapsule', 'privateStaticVariable', 'Assembly-CSharp');
    expect(value).toBe(expectedValue);
  });

  it('test_set_static_property2', async () => {
    const newValue = 5;
    const expectedArray = [1, 5, 3];
    await d.setStaticProperty('AltExampleScriptCapsule', 'staticArrayOfInts[1]', 'Assembly-CSharp', newValue);
    const value = await d.getStaticProperty('AltExampleScriptCapsule', 'staticArrayOfInts', 'Assembly-CSharp');
    expect(value).toEqual(expectedArray);
  });

  it('test_get_static_property_instance_null', async () => {
    const screenWidth = await d.callStaticMethod('UnityEngine.Screen', 'get_width', 'UnityEngine.CoreModule');
    const width = await d.getStaticProperty('UnityEngine.Screen', 'width', 'UnityEngine.CoreModule');

    expect(Number.parseInt(String(width), 10)).toBe(screenWidth);
  });

  it('test_float_world_coordinates', async () => {
    const plane = await d.findObject(By.NAME, 'Plane');

    // Python checks `type(...) is float`; JS has a single number type.
    expect(typeof plane.worldX).toBe('number');
    expect(typeof plane.worldY).toBe('number');
    expect(typeof plane.worldZ).toBe('number');
  });

  // Skipped in Python too: "Flaky: tilt's server-side duration isn't reliably honored in CI"
  it.skip('test_set_command_response_timeout', async () => {
    d.setCommandResponseTimeout(1);
    let error: unknown;
    try {
      await d.tilt({ x: 1, y: 1, z: 1 }, 2, true);
    } catch (e) {
      error = e;
    }
    d.setCommandResponseTimeout(60);
    expect(error).toBeInstanceOf(CommandResponseTimeoutException);
    expect((error as Error).message).toBe('');
  });

  it('test_keys_down', async () => {
    const keys = [AltKeyCode.K, AltKeyCode.L];
    await d.keysDown(keys);
    await d.keysUp(keys);

    const altObject = await d.findObject(By.NAME, 'Capsule');
    const propertyValue = await altObject.getComponentProperty('AltExampleScriptCapsule', 'stringToSetFromTests', 'Assembly-CSharp');
    expect(propertyValue).toBe('multiple keys pressed');
  });

  it('test_press_keys', async () => {
    const keys = [AltKeyCode.K, AltKeyCode.L];
    await d.pressKeys(keys);

    const altObject = await d.findObject(By.NAME, 'Capsule');
    const propertyValue = await altObject.getComponentProperty('AltExampleScriptCapsule', 'stringToSetFromTests', 'Assembly-CSharp');
    expect(propertyValue).toBe('multiple keys pressed');
  });

  it('test_find_object_by_coordinates', async () => {
    const counterButton = await d.findObject(By.NAME, 'ButtonCounter');

    const element = await d.findObjectAtCoordinates({ x: 80 + counterButton.x, y: 15 + counterButton.y });
    expect(element?.name).toBe('ButtonCounter');
  });

  it('test_find_object_by_coordinates_no_element', async () => {
    const element = await d.findObjectAtCoordinates({ x: -1, y: -1 });
    expect(element).toBeNull();
  });

  it('test_call_private_method', async () => {
    const capsuleElement = await d.findObject(By.NAME, 'Capsule');
    await capsuleElement.callComponentMethod('AltExampleScriptCapsule', 'callJump', 'Assembly-CSharp', []);
    const capsuleInfo = await d.findObject(By.NAME, 'CapsuleInfo');
    expect(await capsuleInfo.getText()).toBe('Capsule jumps!');
  });

  it('test_reset_input', async () => {
    await d.keyDown(AltKeyCode.P, 1);
    expect(await (await d.findObject(By.NAME, 'AltTesterPrefab')).getComponentProperty(
      'AltTester.AltTesterUnitySDK.InputModule.NewInputSystem',
      'Keyboard.pKey.isPressed', 'AltTester.AltTesterUnitySDK.InputModule')).toBe(true);
    await d.resetInput();
    expect(await (await d.findObject(By.NAME, 'AltTesterPrefab')).getComponentProperty(
      'AltTester.AltTesterUnitySDK.InputModule.NewInputSystem',
      'Keyboard.pKey.isPressed', 'AltTester.AltTesterUnitySDK.InputModule')).toBe(false);

    const countKeyDown = await (await d.findObject(By.NAME, 'AltTesterPrefab')).getComponentProperty(
      'AltTester.AltTesterUnitySDK.InputModule.AltInput',
      'KeyCodesPressed.Count', 'AltTester.AltTesterUnitySDK.InputModule');
    expect(countKeyDown).toBe(0);
  });

  it('test_find_object_in_object_by_tag', async () => {
    const parent = await d.findObject(By.NAME, 'Canvas');
    const child = await parent.findObjectFromObject(By.TAG, 'Finish');
    expect(child.name).toBe('Button');
  });

  it('test_find_object_in_object_by_layer', async () => {
    const parent = await d.findObject(By.NAME, 'Canvas');
    const child = await parent.findObjectFromObject(By.LAYER, 'ButtonLayer');
    expect(child.name).toBe('Button');
  });

  it('test_find_object_in_object_by_name', async () => {
    const parent = await d.findObject(By.NAME, 'Canvas');
    const child = await parent.findObjectFromObject(By.NAME, 'Button');
    expect(child.name).toBe('Button');
  });

  it('test_find_object_in_object_by_component', async () => {
    const parent = await d.findObject(By.NAME, 'Canvas');
    const child = await parent.findObjectFromObject(By.COMPONENT, 'Button');
    expect(child.name).toBe('UIButton');
  });

  it('test_find_object_in_object_by_path', async () => {
    const parent = await d.findObject(By.NAME, 'Canvas');
    const child = await parent.findObjectFromObject(By.PATH, '/Button');
    expect(child.name).toBe('Button');
  });

  it('test_find_object_in_object_by_id', async () => {
    const parent = await d.findObject(By.NAME, 'Canvas');
    const child = await parent.findObjectFromObject(By.ID, '632dee97-3955-47d3-b760-0eb0aa763f75');
    expect(child.name).toBe('Button');
  });

  it('test_find_object_in_object_by_text', async () => {
    const parent = await d.findObject(By.NAME, 'Canvas');
    const child = await parent.findObjectFromObject(By.TEXT, 'Change Camera Mode');
    expect(child.name).toBe('Text');
  });
});
