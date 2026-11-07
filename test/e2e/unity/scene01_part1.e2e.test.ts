// Port of Bindings~/python/tests/integration/test_scene01_part1.py.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  AssemblyNotFoundException,
  By,
  FailedToParseArgumentsException,
  InvalidParameterValueException,
  MethodWithGivenParametersNotFoundException,
  NotFoundException,
  PlayerPrefKeyType,
  WaitTimeOutException,
  type AltDriver,
} from '../../../src/binding';
import { closeAltTesterPopup, connectDriver, port, Scenes, sleep } from './setup';

/** pytest.raises(cls) + `assert str(execinfo.value) == message`. */
async function expectRejection(promise: Promise<unknown>, cls: abstract new (...args: never[]) => Error, message: string): Promise<void> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(cls);
  expect((error as Error).message).toBe(message);
}

describe('TestScene01Part1', () => {
  let d: AltDriver;
  beforeAll(async () => { d = await connectDriver(); });
  afterAll(async () => { await d?.stop(); });
  beforeEach(async () => {
    await closeAltTesterPopup(d);
    await d.resetInput();
    await d.loadScene(Scenes.Scene01);
  });

  it('test_tap_ui_object', async () => {
    const expectedText = 'UIButton clicked to jump capsule!';

    await (await d.findObject(By.NAME, 'UIButton')).tap();
    const capsuleInfo = await d.waitForObject(By.PATH, `//CapsuleInfo[@text=${expectedText}]`, By.NAME, '', 1);

    expect(await capsuleInfo.getText()).toBe(expectedText);
  });

  it('test_tap_object', async () => {
    const expectedText = 'Capsule was clicked to jump!';

    await (await d.findObject(By.NAME, 'Capsule')).tap();
    const capsuleInfo = await d.waitForObject(By.PATH, `//CapsuleInfo[@text=${expectedText}]`, By.NAME, '', 1);

    expect(await capsuleInfo.getText()).toBe(expectedText);
  });

  it('test_find_object_by_name', async () => {
    const plane = await d.findObject(By.NAME, 'Plane');
    const capsule = await d.findObject(By.NAME, 'Capsule');

    expect(plane.name).toBe('Plane');
    expect(capsule.name).toBe('Capsule');
  });

  it('test_find_object_by_name_and_parent', async () => {
    const capsuleElement = await d.findObject(By.NAME, 'Canvas/CapsuleInfo');

    expect(capsuleElement.name).toBe('CapsuleInfo');
  });

  it('test_find_object_child', async () => {
    const altObject = await d.findObject(By.PATH, '//UIButton/*');

    expect(altObject.name).toBe('Text');
  });

  it('test_find_object_by_tag', async () => {
    const altObject = await d.findObject(By.TAG, 'plane');
    expect(altObject.name).toBe('Plane');
  });

  it('test_find_object_by_layer', async () => {
    const altObject = await d.findObject(By.LAYER, 'Water');
    expect(altObject.name).toBe('Capsule');
  });

  it('test_find_object_by_text', async () => {
    const text = await (await d.findObject(By.NAME, 'CapsuleInfo')).getText();
    const element = await d.findObject(By.TEXT, text);

    expect(await element.getText()).toBe(text);
  });

  it.each([
    ['CapsuleCollider', 'Capsule'],
    ['AltExampleScriptCapsule', 'Capsule'],
    ['AltTesterExamples.Scripts.AltExampleScriptCapsule', 'Capsule'],
  ])('test_find_object_by_component[%s-%s]', async (component, name) => {
    const altObject = await d.findObject(By.COMPONENT, component);
    expect(altObject.name).toBe(name);
  });

  it.each(['Pla', 'EventSy'])('test_find_object_which_contains[%s]', async (partialName) => {
    const plane = await d.findObjectWhichContains(By.NAME, partialName);
    expect(plane.name).toContain(partialName);
  });

  it.each([
    ['Plane', 2],
    ['something that does not exist', 0],
  ] as const)('test_find_objects_by_name[%s-%s]', async (name, count) => {
    const altObjects = await d.findObjects(By.NAME, name);
    expect(altObjects.length).toBe(count);
  });

  it('test_find_objects_by_tag', async () => {
    const altObjects = await d.findObjects(By.TAG, 'plane');

    expect(altObjects.length).toBe(2);
    for (const altObject of altObjects) {
      expect(altObject.name).toBe('Plane');
    }
  });

  it('test_find_objects_by_layer', async () => {
    const altObjects = await d.findObjects(By.LAYER, 'Default');
    expect(altObjects.length).toBeGreaterThanOrEqual(10);
  });

  it('test_find_objects_by_component', async () => {
    const altObjects = await d.findObjects(By.COMPONENT, 'UnityEngine.MeshFilter');
    expect(altObjects.length).toBe(5);
  });

  it('test_find_parent_using_path', async () => {
    const parent = await d.findObject(By.PATH, '//CapsuleInfo/..');
    expect(parent.name).toBe('Canvas');
  });

  it('test_find_objects_which_contain_by_name', async () => {
    const altObjects = await d.findObjectsWhichContain(By.NAME, 'Capsule');

    expect(altObjects.length).toBe(2);
    for (const altObject of altObjects) {
      expect(altObject.name).toContain('Capsule');
    }
  });

  it('test_find_object_which_contains_with_not_existing_object', async () => {
    await expectRejection(d.findObjectWhichContains(By.NAME, 'EventNonExisting'), NotFoundException, 'Object not found');
  });

  it('test_get_all_components', async () => {
    const components = await (await d.findObject(By.NAME, 'Canvas')).getAllComponents();
    expect(components.length).toBe(5);
    expect(components[0]!.componentName).toBe('UnityEngine.RectTransform');
    expect(components[0]!.assemblyName).toBe('UnityEngine.CoreModule');
  });

  it('test_wait_for_object', async () => {
    const altObject = await d.waitForObject(By.NAME, 'Capsule');
    expect(altObject.name).toBe('Capsule');
  });

  it('test_wait_for_object_with_non_existing_object', async () => {
    const objectName = 'Non Existing Object';

    await expectRejection(
      d.waitForObject(By.NAME, objectName, By.NAME, '', 1),
      WaitTimeOutException,
      `Element ${objectName} not found after 1 seconds`,
    );
  });

  it('test_wait_for_object_by_name', async () => {
    const plane = await d.waitForObject(By.NAME, 'Plane');
    const capsule = await d.waitForObject(By.NAME, 'Capsule');

    expect(plane.name).toBe('Plane');
    expect(capsule.name).toBe('Capsule');
  });

  it('test_get_application_screen_size', async () => {
    const screensize = await d.getApplicationScreenSize();
    // We cannot set resolution on iOS so we don't know the exact resolution
    // we just want to see that it returns a value and is different than 0
    expect(screensize.x).not.toBe(0);
    expect(screensize.y).not.toBe(0);
  });

  it('test_get_command_timeout', async () => {
    d.setCommandResponseTimeout(5);
    const timeout = d.getCommandResponseTimeout();
    expect(timeout).toBe(5);

    d.setCommandResponseTimeout(60); // set back to default
  });

  it('test_wait_for_object_with_text', async () => {
    const textToWaitFor = await (await d.findObject(By.NAME, 'CapsuleInfo')).getText();
    const capsuleInfo = await d.waitForObject(By.PATH, `//CapsuleInfo[@text=${textToWaitFor}]`, By.NAME, '', 1);

    expect(capsuleInfo.name).toBe('CapsuleInfo');
    expect(await capsuleInfo.getText()).toBe(textToWaitFor);
  });

  it('test_wait_for_object_with_wrong_text', async () => {
    await expectRejection(
      d.waitForObject(By.PATH, '//CapsuleInfo[@text=aaaaa]', By.NAME, '', 1),
      WaitTimeOutException,
      'Element //CapsuleInfo[@text=aaaaa] not found after 1 seconds',
    );
  });

  it('test_wait_for_object_which_contains', async () => {
    const altObject = await d.waitForObjectWhichContains(By.NAME, 'Main');
    expect(altObject.name).toBe('Main Camera');
  });

  it('test_wait_for_object_to_not_be_present', async () => {
    await d.waitForObjectToNotBePresent(By.NAME, 'Capsuule');
  });

  it('test_wait_for_object_to_not_be_present_fail', async () => {
    await expectRejection(
      d.waitForObjectToNotBePresent(By.NAME, 'Capsule', By.NAME, '', 1),
      WaitTimeOutException,
      'Element Capsule still found after 1 seconds',
    );
  });

  it('test_get_text_with_non_english_text', async () => {
    const text = await (await d.findObject(By.NAME, 'NonEnglishText')).getText();
    expect(text).toBe("BJÖRN'S PASS");
  });

  it('test_get_text_with_chinese_letters', async () => {
    const text = await (await d.findObject(By.NAME, 'ChineseLetters')).getText();
    expect(text).toBe('哦伊娜哦');
  });

  it('test_set_text', async () => {
    const textObject = await d.findObject(By.NAME, 'NonEnglishText');
    const originalText = await textObject.getText();
    const afterText = await (await textObject.setText('ModifiedText')).getText();

    expect(originalText).not.toBe(afterText);
    expect(afterText).toBe('ModifiedText');
  });

  it('test_double_tap', async () => {
    const counterButton = await d.findObject(By.NAME, 'ButtonCounter');
    const counterButtonText = await d.findObject(By.NAME, 'ButtonCounter/Text');
    await counterButton.tap(2);

    // await sleep(0.5);

    expect(await counterButtonText.getText()).toBe('2');
  });

  it('test_tap_on_screen_where_there_are_no_objects', async () => {
    const counterButton = await d.findObject(By.NAME, 'ButtonCounter');
    await d.tap({ x: 1, y: counterButton.y + 100 });
  });

  it('test_hold_button', async () => {
    const button = await d.findObject(By.NAME, 'UIButton');
    await d.holdButton(button.getScreenPosition(), 1);

    const capsuleInfo = await d.findObject(By.NAME, 'CapsuleInfo');
    const text = await capsuleInfo.getText();
    expect(text).toBe('UIButton clicked to jump capsule!');
  });

  it('test_hold_button_without_wait', async () => {
    const button = await d.findObject(By.NAME, 'UIButton');
    await d.holdButton(button.getScreenPosition(), 1, false);

    await sleep(2);

    const capsuleInfo = await d.findObject(By.NAME, 'CapsuleInfo');
    const text = await capsuleInfo.getText();
    expect(text).toBe('UIButton clicked to jump capsule!');
  });

  it('test_wait_for_component_property', async () => {
    const altObject = await d.findObject(By.NAME, 'Capsule');
    const result = await altObject.waitForComponentProperty('AltExampleScriptCapsule', 'TestBool', true, 'Assembly-CSharp');

    expect(result).toBe(true);
  });

  // Python marks: iOSUnsupported, WebGLUnsupported, AndroidUnsupported.
  it('test_wait_for_component_property_get_property_as_string', async () => {
    const canvas = await d.waitForObject(By.PATH, '/Canvas');
    await canvas.waitForComponentProperty<unknown>('UnityEngine.RectTransform', 'childCount', '13', 'UnityEngine.CoreModule', 1, 0.5, true);

    await canvas.waitForComponentProperty<unknown>('UnityEngine.RectTransform', 'gameObject.activeSelf', true, 'UnityEngine.CoreModule', 1, 0.5, true);

    await canvas.waitForComponentProperty<unknown>('UnityEngine.RectTransform', 'name', 'Canvas', 'UnityEngine.CoreModule', 1, 0.5, true);
  });

  it('test_wait_for_component_property_component_not_found', async () => {
    const componentName = 'AltTester.AltTesterUnitySDK.Commands.AltRunnerTest';
    const propertyName = 'InstrumentationSettings.AltServerPort';
    const altObject = await d.findObject(By.NAME, 'AltTesterPrefab');
    await expectRejection(
      altObject.waitForComponentProperty(componentName, propertyName, 'Test', 'AltTester.AltTesterUnitySDK', 2),
      WaitTimeOutException,
      `After 2 seconds, exception was: Component not found for component: ${componentName} and property ${propertyName}`,
    );
  });

  it('test_wait_for_component_property_not_found', async () => {
    const componentName = 'AltTester.AltTesterUnitySDK.Commands.AltRunner';
    const propertyName = 'InstrumentationSettings.AltServerPortTest';
    const altObject = await d.findObject(By.NAME, 'AltTesterPrefab');
    await expectRejection(
      altObject.waitForComponentProperty(componentName, propertyName, 'Test', 'AltTester.AltTesterUnitySDK', 2),
      WaitTimeOutException,
      'After 2 seconds, exception was: Property AltServerPortTest not found ' +
        `for component: ${componentName} and property ${propertyName}`,
    );
  });

  it('test_wait_for_component_property_timeout', async () => {
    const componentName = 'AltTester.AltTesterUnitySDK.Commands.AltRunner';
    const propertyName = 'InstrumentationSettings.AltServerPort';
    const altObject = await d.findObject(By.NAME, 'AltTesterPrefab');
    await expectRejection(
      altObject.waitForComponentProperty<unknown>(componentName, propertyName, 'Test', 'AltTester.AltTesterUnitySDK', 2),
      WaitTimeOutException,
      // Python hardcodes CI's 13005; the port is whatever the sample game was built with.
      `Property InstrumentationSettings.AltServerPort was ${port}, not Test as expected, after 2 seconds`,
    );
  });

  // Python marks: iOSUnsupported, WebGLUnsupported.
  it('test_wait_for_component_property_assembly_not_found', async () => {
    const componentName = 'AltExampleScriptCapsule';
    const propertyName = 'InstrumentationSettings.AltServerPort';
    const altObject = await d.findObject(By.NAME, 'AltTesterPrefab');
    await expectRejection(
      altObject.waitForComponentProperty(componentName, propertyName, '13000', 'Assembly-CSharpTest', 2),
      WaitTimeOutException,
      `After 2 seconds, exception was: Assembly not found for component: ${componentName} and property ${propertyName}`,
    );
  });

  it('test_get_component_property', async () => {
    const altObject = await d.findObject(By.NAME, 'Capsule');
    const result = await altObject.getComponentProperty('AltExampleScriptCapsule', 'arrayOfInts', 'Assembly-CSharp');

    expect(result).toEqual([1, 2, 3]);
  });

  it('test_get_component_property_with_bool', async () => {
    const altObject = await d.findObject(By.NAME, 'Capsule');
    const result = await altObject.getComponentProperty('AltExampleScriptCapsule', 'TestBool', 'Assembly-CSharp');

    expect(result).toBe(true);
  });

  it('test_set_component_property', async () => {
    let altObject = await d.findObject(By.NAME, 'Capsule');
    await altObject.setComponentProperty('AltExampleScriptCapsule', 'arrayOfInts', 'Assembly-CSharp', [2, 3, 4]);

    altObject = await d.findObject(By.NAME, 'Capsule');
    const result = await altObject.getComponentProperty('AltExampleScriptCapsule', 'arrayOfInts', 'Assembly-CSharp');

    expect(result).toEqual([2, 3, 4]);
  });

  it('test_call_component_method', async () => {
    const altObject = await d.findObject(By.NAME, 'Capsule');
    const result = await altObject.callComponentMethod('AltExampleScriptCapsule', 'Jump', 'Assembly-CSharp', ['setFromMethod']);
    expect(result).toBeNull();

    await d.waitForObject(By.PATH, '//CapsuleInfo[@text=setFromMethod]', By.NAME, '', 1);
    expect(await (await d.findObject(By.NAME, 'CapsuleInfo')).getText()).toBe('setFromMethod');
  });

  it('test_call_component_method_with_no_parameters', async () => {
    const result = await d.findObject(By.PATH, '/Canvas/Button/Text');
    const text = await result.callComponentMethod('UnityEngine.UI.Text', 'get_text', 'UnityEngine.UI');
    expect(text).toBe('Change Camera Mode');
  });

  it('test_call_component_method_with_parameters', async () => {
    const assembly = 'UnityEngine.UI';
    const expectedFontSize = 16;
    const altObject = await d.findObject(By.PATH, '/Canvas/UnityUIInputField/Text');
    await altObject.callComponentMethod('UnityEngine.UI.Text', 'set_fontSize', assembly, ['16']);
    const fontSize = await altObject.callComponentMethod('UnityEngine.UI.Text', 'get_fontSize', assembly, []);

    expect(fontSize).toBe(expectedFontSize);
  });

  it('test_call_component_method_with_assembly', async () => {
    type Quaternion = { x: number; y: number; z: number; w: number };
    const capsule = await d.findObject(By.NAME, 'Capsule');
    const initialRotation = await capsule.getComponentProperty<Quaternion>('UnityEngine.Transform', 'rotation', 'UnityEngine.CoreModule');
    await capsule.callComponentMethod('UnityEngine.Transform', 'Rotate', 'UnityEngine.CoreModule', ['10', '10', '10'], [
      'System.Single',
      'System.Single',
      'System.Single',
    ]);

    const capsuleAfterRotation = await d.findObject(By.NAME, 'Capsule');
    const finalRotation = await capsuleAfterRotation.getComponentProperty<Quaternion>('UnityEngine.Transform', 'rotation', 'UnityEngine.CoreModule');

    expect(
      initialRotation.x !== finalRotation.x ||
        initialRotation.y !== finalRotation.y ||
        initialRotation.z !== finalRotation.z ||
        initialRotation.w !== finalRotation.w,
    ).toBe(true);
  });

  // Python parametrizes a list and a tuple; both are arrays in TypeScript.
  it.each([
    ['list', [1, 'stringparam', 0.5, [1, 2, 3]]],
    ['tuple', [1, 'stringparam', 0.5, [1, 2, 3]]],
  ] as const)('test_call_component_method_with_multiple_parameters[%s]', async (_kind, parameters) => {
    const altObject = await d.findObject(By.NAME, 'Capsule');
    const result = await altObject.callComponentMethod('AltExampleScriptCapsule', 'TestCallComponentMethod', 'Assembly-CSharp', parameters);

    expect(result).toBe('1,stringparam,0.5,[1,2,3]');
  });

  it('test_call_component_method_with_multiple_definitions', async () => {
    const capsule = await d.findObject(By.NAME, 'Capsule');
    await capsule.callComponentMethod('AltExampleScriptCapsule', 'Test', 'Assembly-CSharp', ['2'], ['System.Int32']);
    const capsuleInfo = await d.findObject(By.NAME, 'CapsuleInfo');

    expect(await capsuleInfo.getText()).toBe('6');
  });

  it('test_call_component_method_with_invalid_assembly', async () => {
    const altObject = await d.findObject(By.NAME, 'Capsule');

    await expectRejection(
      altObject.callComponentMethod('RandomComponent', 'TestMethodWithManyParameters', 'RandomAssembly', [1, 'stringparam', 0.5, [1, 2, 3]], []),
      AssemblyNotFoundException,
      'Assembly not found',
    );
  });

  it('test_call_component_method_with_incorrect_number_of_parameters', async () => {
    const altObject = await d.findObject(By.NAME, 'Capsule');

    await expectRejection(
      altObject.callComponentMethod('AltExampleScriptCapsule', 'TestMethodWithManyParameters', 'Assembly-CSharp', ['stringparam', 0.5, [1, 2, 3]], []),
      MethodWithGivenParametersNotFoundException,
      'No method found with 3 parameters matching signature: TestMethodWithManyParameters(System.String[])',
    );
  });

  it('test_call_component_method_with_invalid_method_argument_types', async () => {
    const altObject = await d.findObject(By.NAME, 'Capsule');

    await expectRejection(
      altObject.callComponentMethod(
        'AltExampleScriptCapsule',
        'TestMethodWithManyParameters',
        'Assembly-CSharp',
        ['stringnoint', 'stringparams', 0.5, [1, 2, 3]],
        [],
      ),
      FailedToParseArgumentsException,
      'Could not parse parameter \'"stringnoint"\' to type System.Int32',
    );
  });

  it('test_call_static_method', async () => {
    await d.callStaticMethod('UnityEngine.PlayerPrefs', 'SetInt', 'UnityEngine.CoreModule', ['Test', '1']);
    const value = await d.callStaticMethod('UnityEngine.PlayerPrefs', 'GetInt', 'UnityEngine.CoreModule', ['Test', '2']);

    expect(value).toBe(1);
  });

  it.each([
    [1, PlayerPrefKeyType.Int],
    [1.3, PlayerPrefKeyType.Float],
    ['string value', PlayerPrefKeyType.String],
  ] as const)('test_set_player_pref_keys[%s-%s]', async (keyValue, keyType) => {
    await d.deletePlayerPref();
    await d.setKeyPlayerPref('test', keyValue, keyType);
    const actualValue = await d.getPlayerPrefKey('test', keyType);

    expect(actualValue).toBe(keyValue);
  });

  it('test_press_next_scene', async () => {
    const initialScene = await d.getCurrentScene();
    await (await d.findObject(By.NAME, 'NextScene')).tap();

    const currentScene = await d.getCurrentScene();
    expect(initialScene).not.toBe(currentScene);
  });

  it('test_acceleration', async () => {
    let capsule = await d.findObject(By.NAME, 'Capsule');
    const initialPosition = [capsule.worldX, capsule.worldY, capsule.worldZ];
    await d.tilt({ x: 1, y: 1, z: 1 }, 0.1, false);

    await sleep(0.1);

    capsule = await d.findObject(By.NAME, 'Capsule');
    const finalPosition = [capsule.worldX, capsule.worldY, capsule.worldZ];

    expect(initialPosition).not.toEqual(finalPosition);
  });

  it('test_acceleration_and_wait', async () => {
    let capsule = await d.findObject(By.NAME, 'Capsule');
    const initialPosition = [capsule.worldX, capsule.worldY, capsule.worldZ];
    await d.tilt({ x: 1, y: 1, z: 1 }, 0.1);

    capsule = await d.findObject(By.NAME, 'Capsule');
    const finalPosition = [capsule.worldX, capsule.worldY, capsule.worldZ];
    expect(initialPosition).not.toEqual(finalPosition);
  });

  it('test_implicit_timeout', async () => {
    d.setImplicitTimeout(1);
    expect(d.getImplicitTimeout()).toBe(1);
    const startTime = Date.now();
    try {
      await d.waitForObject(By.NAME, 'Capsulee');
    } catch {
      // ignored, as in Python
    }
    const endTime = Date.now();
    const elapsedTime = (endTime - startTime) / 1000;
    expect(elapsedTime).toBeLessThanOrEqual(5);
    d.setImplicitTimeout(20);
  });

  it('test_implicit_timeout_out_of_range', () => {
    // Python raises ValueError; the TS driver throws InvalidParameterValueException synchronously.
    expect(() => d.setImplicitTimeout(-5)).toThrow(InvalidParameterValueException);
    expect(() => d.setImplicitTimeout(-5)).toThrow('Timeout cannot be negative');
  });
});
