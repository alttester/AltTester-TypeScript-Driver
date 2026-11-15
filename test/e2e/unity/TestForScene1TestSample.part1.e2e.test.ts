// Port of Testforscene1TestSample.cs (TestForScene1TestSample) from AltTester-Unity-SDK-Closed-Source sdk-package/Assets/Examples/Test/Editor/Driver
import { describe, expect, it } from 'vitest';
import {
  AssemblyNotFoundException,
  By,
  ComponentNotFoundException,
  FailedToParseArgumentsException,
  InvalidParameterTypeException,
  MethodNotFoundException,
  MethodWithGivenParametersNotFoundException,
  NotFoundException,
  PlayerPrefKeyType,
  PropertyNotFoundException,
  SceneNotFoundException,
  WaitTimeOutException,
} from '../../../src/binding';
import { appName, port, Scenes, sleep } from './setup';
import { useTestBase } from './testBase';

type ByName = keyof typeof By;

/** The C# try { ...; Assert.Fail(); } catch (XException e) { ... } pattern: returns the error after checking its class. */
async function expectError<E extends Error>(promise: Promise<unknown>, cls: abstract new (...args: never[]) => E): Promise<E> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(cls);
  return error as E;
}

describe('TestForScene1TestSample (part 1)', () => {
  const getDriver = useTestBase(Scenes.Scene01);

  it('TestLoadNonExistentScene', async () => {
    const altDriver = getDriver();
    await expect(altDriver.loadScene('Scene 0', true)).rejects.toThrow(SceneNotFoundException);
  });

  it('TestGetCurrentScene', async () => {
    const altDriver = getDriver();
    expect(await altDriver.getCurrentScene()).toBe('Scene 1 AltDriverTestScene');
  });

  it('TestGetApplicationScreenSize', async () => {
    const altDriver = getDriver();
    const screensize = await altDriver.getApplicationScreenSize();
    // We cannot set resolution on iOS so we don't know the exact resolution, we just want to see that it returns a
    // value and is different than 0
    expect(screensize.x).not.toBe(0);
    expect(screensize.y).not.toBe(0);
  });

  it('TestGetApplicationScreenSize2', async () => {
    const altDriver = getDriver();
    const screenSize = await altDriver.getApplicationScreenSize();

    const screenWidth = await altDriver.callStaticMethod<number>('UnityEngine.Screen', 'get_width', 'UnityEngine.CoreModule', []);
    const screenHeight = await altDriver.callStaticMethod<number>('UnityEngine.Screen', 'get_height', 'UnityEngine.CoreModule', []);

    expect(screenSize.x).toBe(screenWidth);
    expect(screenSize.y).toBe(screenHeight);
  });

  // UI disable elements are neede for this because at the moment, the test uses the AltDialog objects
  const findDisabledObjectCases: [string, string][] = [
    ['/AltTesterPrefab/AltDialog/Dialog', 'Dialog'],
    ['/AltTesterPrefab/AltDialog/Dialog/Title', 'Title'],
    ['/Cube', 'Cube'],
  ];
  for (const [path, name] of findDisabledObjectCases) {
    it(`TestFindDisabledObject("${path}", "${name}")`, async () => {
      const altDriver = getDriver();
      const altObject = await altDriver.findObject(By.PATH, path, By.NAME, '', false);
      expect(altObject).not.toBeNull();
      expect(altObject.name).toBe(name);
    });
  }

  const findObjectWhichContainsCases: [ByName, string, string][] = [
    ['COMPONENT', 'CapsuleColl', '//Capsule'],
    ['ID', 'd4728249-9bcd-48b8-82ad-b19b1e71b238', '//Capsule'],
    ['LAYER', 'Wat', '//Capsule'],
    ['NAME', 'Cap', '//Capsule'],
    ['TAG', 'pla', '//Plane'],
    ['TEXT', 'Change Camera', '/Canvas/Button/Text'],
  ];
  for (const [by, value, path] of findObjectWhichContainsCases) {
    it(`TestFindObjectWhichContains(By.${by}, "${value}", "${path}")`, async () => {
      const altDriver = getDriver();
      const expectedObject = await altDriver.findObject(By.PATH, path);
      const altObject = await altDriver.findObjectWhichContains(By[by], value);
      expect(altObject).not.toBeNull();
      expect(altObject.id).toBe(expectedObject.id);
    });
  }

  it('TestFindElementThatContainsText', async () => {
    const altDriver = getDriver();
    const text = 'Change Camera';
    const altElement = await altDriver.findObject(By.PATH, '//*[contains(@text,' + text + ')]');
    expect(altElement).not.toBeNull();
  });

  const nonExistentWhichContainsCases: [ByName, string][] = [
    ['COMPONENT', 'NonExistent'],
    ['ID', 'NonExistent'],
    ['LAYER', 'NonExistent'],
    ['NAME', 'NonExistent'],
    ['TAG', 'NonExistent'],
    ['TEXT', 'NonExistent'],
  ];
  for (const [by, value] of nonExistentWhichContainsCases) {
    it(`TestFindNonExistentObjectWhichContains(By.${by}, "${value}")`, async () => {
      const altDriver = getDriver();
      await expect(altDriver.findObjectWhichContains(By[by], value)).rejects.toThrow(NotFoundException);
    });
  }

  const findObjectsWhichContainCases: [ByName, string, string][] = [
    ['COMPONENT', 'CapsuleColl', '//Capsule'],
    ['ID', 'd4728249-9bcd-48b8-82ad-b19b1e71b238', '//Capsule'],
    ['LAYER', 'Wat', '//Capsule'],
    ['TEXT', 'Change Camera', '/Canvas/Button/Text'],
  ];
  for (const [by, value, path] of findObjectsWhichContainCases) {
    it(`TestFindObjectsWhichContain(By.${by}, "${value}", "${path}")`, async () => {
      const altDriver = getDriver();
      const expectedObject = await altDriver.findObject(By.PATH, path);
      const altObjects = await altDriver.findObjectsWhichContain(By[by], value);
      expect(altObjects.length).toBe(1);
      expect(altObjects[0].id).toBe(expectedObject.id);
    });
  }

  const findObjectsWhichContain2Cases: [ByName, string, string, string][] = [
    ['NAME', 'Cap', '//Capsule', '//CapsuleInfo'],
    ['TAG', 'pla', '//Plane', '/UIWithWorldSpace/Plane'],
  ];
  for (const [by, value, path1, path2] of findObjectsWhichContain2Cases) {
    it(`TestFindObjectsWhichContain2(By.${by}, "${value}", "${path1}", "${path2}")`, async () => {
      const altDriver = getDriver();
      const expectedObject1 = await altDriver.findObject(By.PATH, path1);
      const expectedObject2 = await altDriver.findObject(By.PATH, path2);
      const altObjects = await altDriver.findObjectsWhichContain(By[by], value);
      expect(altObjects.length).toBe(2);
      expect(altObjects[0].id).toBe(expectedObject1.id);
      expect(altObjects[1].id).toBe(expectedObject2.id);
    });
  }

  for (const [by, value] of nonExistentWhichContainsCases) {
    it(`TestFindNonExistentObjectsWhichContain(By.${by}, "${value}")`, async () => {
      const altDriver = getDriver();
      const altObjects = await altDriver.findObjectsWhichContain(By[by], value);
      expect(altObjects).toEqual([]);
    });
  }

  it('TestWaitForCurrentSceneToBe', async () => {
    const altDriver = getDriver();
    const name = 'Scene 1 AltDriverTestScene';
    const timeStart = Date.now();
    await altDriver.waitForCurrentSceneToBe(name);
    const timeEnd = Date.now();
    const time = (timeEnd - timeStart) / 1000;
    expect(time).toBeLessThan(20);
    const currentScene = await altDriver.getCurrentScene();
    expect(currentScene).toBe('Scene 1 AltDriverTestScene');
  });

  // UI input field, text mesh input field
  for (const fieldName of ['UnityUIInputField', 'TextMeshInputField']) {
    it(`TestSetTextForUnityUIInputField("${fieldName}")`, async () => {
      const altDriver = getDriver();
      const inputField = await (await altDriver.findObject(By.NAME, fieldName)).setText('exampleUnityUIInputField', true);
      const component = 'AltInputFieldRaisedEvents';
      const assembly = 'Assembly-CSharp';
      expect(await inputField.getText()).toBe('exampleUnityUIInputField');
      const onValueChanged = await inputField.getComponentProperty<boolean>(component, 'onValueChangedInvoked', assembly);
      expect(onValueChanged, 'onValueChangedInvoked was false').toBe(true);
      const onSubmit = await inputField.getComponentProperty<boolean>(component, 'onSubmitInvoked', assembly);
      expect(onSubmit, 'onSubmitInvoked was false').toBe(true);
      const onEndEdit = await inputField.getComponentProperty<boolean>(component, 'onEndEditInvoked', assembly);
      expect(onEndEdit, 'onEndEditInvoked was false').toBe(true);
    });
  }

  const findObjectCases: [ByName, string, string][] = [
    ['COMPONENT', 'AltRunner', '//AltTesterPrefab'],
    ['COMPONENT', 'CapsuleCollider', '//Capsule'], // Unity component
    ['COMPONENT', 'AltTester.AltDriver.AltRunner', '//AltTesterPrefab'], // namespace
    ['ID', 'd4728249-9bcd-48b8-82ad-b19b1e71b238', '//Capsule'],
    ['LAYER', 'Water', '//Capsule'],
    ['NAME', 'Capsule', '//Capsule'],
    ['PATH', '/Sphere', '//Sphere'],
    ['PATH', '//PlaneS/..', '//Sphere'],
    ['PATH', '//Sphere/*', '//PlaneS'],
    ['PATH', '//*[@tag=plane]', '//Plane'],
    ['PATH', '//*[@layer=Water]', '//Capsule'],
    ['PATH', '//*[@name=Capsule]', '//Capsule'],
    ['PATH', '//*[@component=CapsuleCollider]', '//Capsule'],
    ['PATH', '//*[@id=d4728249-9bcd-48b8-82ad-b19b1e71b238]', '//Capsule'],
    ['PATH', '//*[@text=Change Camera Mode]', '/Canvas/Button/Text'],
    ['PATH', '//*[@tag=plane][@layer=Default]', '//Plane'],
    ['PATH', '//*[@tag=plane][@layer=Default][@name=Plane]', '//Plane'],
    ['PATH', '//*[@tag=plane][@layer=Default][@name=Plane][@component=MeshCollider]', '//Plane'],
    [
      'PATH',
      '//*[@tag=plane][@layer=Default][@name=Plane][@component=MeshCollider][@id=718f6503-d461-4517-80c5-5453af779998]',
      '//Plane',
    ],
    [
      'PATH',
      '//*[@tag=Untagged][@layer=UI][@name=Text][@component=CanvasRenderer][@id=dde29fea-ec57-4541-986d-f0c279776dfb]' +
        '[@text=Change Camera Mode]',
      '/Canvas/Button/Text',
    ],
    ['PATH', '//*[contains(@tag,pla)]', '//Plane'],
    ['PATH', '//*[contains(@layer,Wat)]', '//Capsule'],
    ['PATH', '//*[contains(@name,Cap)]', '//Capsule'],
    ['PATH', '//*[contains(@component,CapsuleColl)]', '//Capsule'],
    ['PATH', '//*[contains(@id,d4728249-9bcd-48b8-82ad-b19b1e71b238)]', '//Capsule'],
    ['PATH', '//*[contains(@text,Change Camera)]', '/Canvas/Button/Text'],
    ['PATH', '//*[contains(@tag,pla)][contains(@layer,Def)]', '//Plane'],
    ['PATH', '//*[contains(@tag,pla)][contains(@layer,Def)][contains(@name,Pla)]', '//Plane'],
    ['PATH', '//*[contains(@tag,pla)][contains(@layer,Def)][contains(@name,Pla)][contains(@component,MeshColl)]', '//Plane'],
    [
      'PATH',
      '//*[contains(@tag,pla)][contains(@layer,Def)][contains(@name,Pla)][contains(@component,MeshColl)]' +
        '[contains(@id,718f6503-d461-4517-80c5-5453af779998)]',
      '//Plane',
    ],
    [
      'PATH',
      '//*[contains(@tag,Untag)][contains(@layer,U)][contains(@name,Tex)][contains(@component,CanvasRender)]' +
        '[contains(@id,dde29fea-ec57-4541-986d-f0c279776dfb)][contains(@text,Change Camera)]',
      '/Canvas/Button/Text',
    ],
    ['TAG', 'plane', '//Plane'],
    ['TEXT', 'Capsule Info', '//CapsuleInfo'], // text area
    ['TEXT', 'Change Camera Mode', '//Canvas/Button/Text'], // button with text
  ];
  for (const [by, value, path] of findObjectCases) {
    it(`TestFindObject(By.${by}, "${value}", "${path}")`, async () => {
      const altDriver = getDriver();
      const referenceId = (await altDriver.findObject(By.PATH, path)).id;
      const altObject = await altDriver.findObject(By[by], value);
      expect(altObject).not.toBeNull();
      expect(altObject.id).toBe(referenceId);
    });
  }

  it('TestGetComponentProperty', async () => {
    const altDriver = getDriver();
    const componentName = 'AltTester.AltTesterUnitySDK.Commands.AltRunner';
    const propertyName = 'InstrumentationSettings.AppName';
    const altElement = await altDriver.findObject(By.NAME, 'AltTesterPrefab');
    expect(altElement).not.toBeNull();
    const propertyValue = await altElement.getComponentProperty<string>(componentName, propertyName, 'AltTester.AltTesterUnitySDK');

    // C# hardcodes "__default__"; the app name is whatever the sample game was built with.
    expect(propertyValue).toBe(appName);
  });

  it('TestGetComponentPropertyDictionary', async () => {
    const altDriver = getDriver();
    const componentName = 'AltExampleScriptCapsule';
    const propertyName = 'dictionary.key1';
    const propertyValueExpected = 'value1';
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    expect(altElement).not.toBeNull();
    const propertyValue = await altElement.waitForComponentProperty(
      componentName,
      propertyName,
      propertyValueExpected,
      'Assembly-CSharp',
    );

    expect(propertyValue).toBe(propertyValueExpected);
  });

  // C# WaitForComponentProperty rethrows the server error at once; the TS driver (like Python) keeps polling and then
  // throws WaitTimeOutException carrying that error's message. The tests below pass a 2 second timeout instead of
  // waiting the 20 second default, and check the wrapped message.
  it('TestWaitForComponentPropertyComponentNotFound', async () => {
    const altDriver = getDriver();
    const componentName = 'AltTester.AltTesterUnitySDK.AltRunnerTest';
    const propertyName = 'InstrumentationSettings.AppName';
    const altElement = await altDriver.findObject(By.NAME, 'AltTesterPrefab');
    expect(altElement).not.toBeNull();
    const error = await expectError(
      altElement.waitForComponentProperty(componentName, propertyName, 'Test', 'AltTester.AltTesterUnitySDK', 2),
      WaitTimeOutException,
    );
    expect(error.message).toContain('Component not found');
  });

  it('TestWaitForComponentPropertyNotFound', async () => {
    const altDriver = getDriver();
    const componentName = 'AltTester.AltTesterUnitySDK.Commands.AltRunner';
    const propertyName = 'InstrumentationSettings.AltServerPortTest';
    const altElement = await altDriver.findObject(By.NAME, 'AltTesterPrefab');
    expect(altElement).not.toBeNull();
    const error = await expectError(
      altElement.waitForComponentProperty(componentName, propertyName, 'Test', 'AltTester.AltTesterUnitySDK', 2),
      WaitTimeOutException,
    );
    expect(error.message).toContain('Property AltServerPortTest not found');
  });

  it('TestWaitForComponentPropertyTimeOut', async () => {
    const altDriver = getDriver();
    const componentName = 'AltTester.AltTesterUnitySDK.Commands.AltRunner';
    const propertyName = 'InstrumentationSettings.AltServerPort';
    const assemblyName = 'AltTester.AltTesterUnitySDK';
    // C# hardcodes CI's 13005; the port is whatever the sample game was built with.
    const initialPropertyValue = String(port);
    const testPropertyValue = 'Test';
    const timeout = 2;

    const altElement = await altDriver.findObject(By.NAME, 'AltTesterPrefab');
    expect(altElement).not.toBeNull();
    const exception = await expectError(
      altElement.waitForComponentProperty<unknown>(componentName, propertyName, testPropertyValue, assemblyName, timeout),
      WaitTimeOutException,
    );
    // C# wording: "Property {propertyName} was {initial} and was not {test} after {timeout} seconds". The TS driver uses
    // the Python binding's wording.
    expect(exception.message).toBe(
      `Property ${propertyName} was ${initialPropertyValue}, not ${testPropertyValue} as expected, after ${timeout} seconds`,
    );
  });

  // Category: WebGLUnsupported. Fails on WebGL in pipeline, skip until issue #1465 is fixed:
  // https://github.com/alttester/AltTester-Unity-SDK/issues/1465
  it('TestWaitForComponentPropertyAssemblyNotFound', async () => {
    const altDriver = getDriver();
    const componentName = 'AltExampleScriptCapsule';
    const propertyName = 'InstrumentationSettings.AltServerPort';
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    expect(altElement).not.toBeNull();
    // Wrapped in WaitTimeOutException by the TS driver, see above.
    const error = await expectError(
      altElement.waitForComponentProperty(componentName, propertyName, '13000', 'Assembly-CSharpTest', 2),
      WaitTimeOutException,
    );
    expect(error.message).toContain('Assembly not found');
  });

  it('TestWaitForComponentProperty', async () => {
    const altDriver = getDriver();
    const componentName = 'AltTester.AltTesterUnitySDK.Commands.AltRunner';
    const propertyName = 'InstrumentationSettings.AppName';
    const altElement = await altDriver.findObject(By.NAME, 'AltTesterPrefab');

    expect(altElement).not.toBeNull();

    // C# hardcodes "__default__"; the app name is whatever the sample game was built with.
    const propertyValue = await altElement.waitForComponentProperty(componentName, propertyName, appName, 'AltTester.AltTesterUnitySDK');

    expect(propertyValue).toBe(appName);
  });

  // Ignored in C#: This test is failing because of https://github.com/alttester/AltTester-Unity-SDK/issues/1185
  it.skip('TestWaitForNonExistingComponentProperty', async () => {
    const altDriver = getDriver();
    const componentName = 'AltTester.AltTesterUnitySDK.Commands.AltRunner';
    const propertyName = 'InstrumentationSettings.AltServerPort';
    const altElement = await altDriver.findObject(By.NAME, 'AltTesterPrefab');
    expect(altElement).not.toBeNull();
    await expect(
      altElement.waitForComponentProperty<string>(componentName, propertyName, 'UNEXISTING', 'AltTester.AltTesterUnitySDK', 10),
    ).rejects.toThrow(NotFoundException);
  });

  // Category: WebGLUnsupported. Fails on WebGL in pipeline, skip until issue #1465 is fixed:
  // https://github.com/alttester/AltTester-Unity-SDK/issues/1465
  // The third C# case ("Assembly UNEXISTING not found") is commented out in C# because of issue #1185.
  const waitNonExistingParamsCases: [string, string, string, string][] = [
    ['UNEXISTING', 'InstrumentationSettings.AltServerPort', 'AltTester.AltTesterUnitySDK', 'Component not found'],
    ['AltTester.AltTesterUnitySDK.Commands.AltRunner', 'UNEXISTING', 'AltTester.AltTesterUnitySDK', 'Property UNEXISTING not found'],
  ];
  for (const [componentName, propertyName, assemblyName, message] of waitNonExistingParamsCases) {
    const testName = `TestWaitForComponentPropertyNonExistingParameters("${componentName}", "${propertyName}", "${assemblyName}", "${message}")`;
    it(testName, async () => {
      const altDriver = getDriver();
      const altElement = await altDriver.findObject(By.NAME, 'AltTesterPrefab');
      const error = await expectError(
        altElement.waitForComponentProperty<number>(componentName, propertyName, port, assemblyName, 10),
        Error,
      );
      // C# checks message equality; the TS driver wraps the server error in a WaitTimeOutException (see above).
      expect(error).toBeInstanceOf(WaitTimeOutException);
      expect(error.message).toContain(message);
    });
  }

  // TS driver has no ResponseFormatException: getComponentProperty<T> does not deserialize into a typed value.
  it.skip('TestGetComponentPropertyInvalidDeserialization', () => {});

  // Category: WebGLUnsupported. Fails on WebGL in pipeline, skip until issue #1465 is fixed:
  // https://github.com/alttester/AltTester-Unity-SDK/issues/1465
  const getNonExistingParamsCases: [string, string, string, string][] = [
    ['UnityEngine.UI.Text', 'InvalidProperty', 'UnityEngine.UI', 'Property InvalidProperty not found'],
    ['UNEXISTING', 'm_Text', 'UnityEngine.UI', 'Component not found'],
    ['UnityEngine.UI.Text', 'm_Text', 'UNEXISTING', 'Assembly not found'],
  ];
  for (const [component, property, assembly, message] of getNonExistingParamsCases) {
    it(`TestGetComponentPropertyNonExistingParams("${component}", "${property}", "${assembly}", "${message}")`, async () => {
      const altDriver = getDriver();
      await sleep(1);
      const altElement = await altDriver.findObject(By.PATH, '/Canvas/UIButton/Text');
      expect(altElement).not.toBeNull();
      const exception = await expectError(altElement.getComponentProperty<string>(component, property, assembly), Error);
      expect(exception.message.startsWith(message), exception.message).toBe(true);
    });
  }

  it('TestGetComponentPropertyArray', async () => {
    const altDriver = getDriver();
    const componentName = 'AltExampleScriptCapsule';
    const propertyName = 'arrayOfInts';
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    expect(altElement).not.toBeNull();
    const propertyValue = await altElement.getComponentProperty<number[]>(componentName, propertyName, 'Assembly-CSharp');

    expect(propertyValue.length).toBe(3);
    expect(propertyValue[0]).toBe(1);
    expect(propertyValue[1]).toBe(2);
    expect(propertyValue[2]).toBe(3);
  });

  it('TestGetComponentPropertyPrivate', async () => {
    const altDriver = getDriver();
    const componentName = 'AltExampleScriptCapsule';
    const propertyName = 'privateVariable';
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    expect(altElement).not.toBeNull();
    const propertyValue = await altElement.getComponentProperty<number>(componentName, propertyName, 'Assembly-CSharp');
    expect(propertyValue).toBe(0);
  });

  it('TestGetComponentPropertyStatic', async () => {
    const altDriver = getDriver();
    const componentName = 'AltExampleScriptCapsule';
    const propertyName = 'privateStaticVariable';
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    expect(altElement).not.toBeNull();
    const propertyValue = await altElement.getComponentProperty<number>(componentName, propertyName, 'Assembly-CSharp');
    expect(propertyValue).toBe(0);
  });

  it('TestGetComponentPropertyNullValue', async () => {
    const altDriver = getDriver();
    const componentName = 'AltExampleScriptCapsule';
    const propertyName = 'fieldNullValue';
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    expect(altElement).not.toBeNull();
    const propertyValue = await altElement.getComponentProperty<unknown>(componentName, propertyName, 'Assembly-CSharp');
    expect(propertyValue).toBeNull();
  });

  it('TestGetComponentPropertyStaticPublic', async () => {
    const altDriver = getDriver();
    const componentName = 'AltExampleScriptCapsule';
    const propertyName = 'PublicStaticVariable';
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    expect(altElement).not.toBeNull();
    const propertyValue = await altElement.getComponentProperty<number>(componentName, propertyName, 'Assembly-CSharp');
    expect(propertyValue).toBe(0);
  });

  // C#: #if !UNITY_IOS
  it('TestGetComponentPropertyUnityEngine', async () => {
    const altDriver = getDriver();
    const componentName = 'UnityEngine.CapsuleCollider';
    const propertyName = 'isTrigger';
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    expect(altElement).not.toBeNull();
    const propertyValue = await altElement.getComponentProperty<boolean>(componentName, propertyName, 'UnityEngine.PhysicsModule');
    expect(propertyValue).toBe(false);
  });

  it('TestSetComponentProperty', async () => {
    const altDriver = getDriver();
    const componentName = 'AltExampleScriptCapsule';
    const propertyName = 'stringToSetFromTests';
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    expect(altElement).not.toBeNull();
    await altElement.setComponentProperty(componentName, propertyName, 'Assembly-CSharp', '2');

    const propertyValue = await altElement.getComponentProperty<string>(componentName, propertyName, 'Assembly-CSharp');
    expect(propertyValue).toBe('2');
  });

  it('TestSetNonExistingComponentProperty', async () => {
    const altDriver = getDriver();
    const unexistingComponent = 'Capsulee';
    const propertyName = 'stringToSetFromTests';
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    expect(altElement).not.toBeNull();
    const exception = await expectError(
      altElement.setComponentProperty(unexistingComponent, propertyName, 'Assembly-CSharp', '2'),
      ComponentNotFoundException,
    );
    expect(exception.message.startsWith('Component not found'), exception.message).toBe(true);
  });

  it('TestSetNonExistingProperty', async () => {
    const altDriver = getDriver();
    const componentName = 'AltExampleScriptCapsule';
    const unexistingPropertyName = 'unexisting';
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    expect(altElement).not.toBeNull();
    const exception = await expectError(
      altElement.setComponentProperty(componentName, unexistingPropertyName, 'Assembly-CSharp', '2'),
      PropertyNotFoundException,
    );
    expect(exception.message.startsWith(`Property ${unexistingPropertyName} not found`), exception.message).toBe(true);
  });

  // Category: WebGLUnsupported. Fails on WebGL in pipeline, skip until issue #1465 is fixed:
  // https://github.com/alttester/AltTester-Unity-SDK/issues/1465
  it('TestSetComponentPropertyNonExistingAssembly', async () => {
    const altDriver = getDriver();
    const componentName = 'AltExampleScriptCapsule';
    const propertyName = 'stringToSetFromTests';
    const nonExistingAssembly = 'unexisting';
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    expect(altElement).not.toBeNull();
    const exception = await expectError(
      altElement.setComponentProperty(componentName, propertyName, nonExistingAssembly, '2'),
      AssemblyNotFoundException,
    );
    expect(exception.message.startsWith('Assembly not found'), exception.message).toBe(true);
  });

  // Ask if there should be a specific error for this case
  it('TestSetComponentPropertyBadValue', async () => {
    const altDriver = getDriver();
    const componentName = 'AltExampleScriptCapsule';
    const propertyName = 'stringToSetFromTests';
    const assembly = 'Assembly-CSharp';
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    expect(altElement).not.toBeNull();
    await altElement.setComponentProperty(componentName, propertyName, assembly, null);
    const propertyValue = await altElement.getComponentProperty<string>(componentName, propertyName, assembly);
    expect(propertyValue).toBeNull();
  });

  it('TestCallMethodWithNoParameters', async () => {
    const altDriver = getDriver();
    const componentName = 'AltExampleScriptCapsule';
    const methodName = 'UIButtonClicked';
    const assemblyName = 'Assembly-CSharp';
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    const data = await altElement.callComponentMethod<string>(componentName, methodName, assemblyName, []);
    expect(data).toBeNull();
  });

  it('TestCallMethodWithParameters', async () => {
    const altDriver = getDriver();
    const componentName = 'AltExampleScriptCapsule';
    const methodName = 'Jump';
    const assemblyName = 'Assembly-CSharp';
    const parameters = ['New Text'];
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    const data = await altElement.callComponentMethod<string>(componentName, methodName, assemblyName, parameters);
    expect(data).toBeNull();
  });

  it('TestGetTextCallMethodWithNoParameters', async () => {
    const altDriver = getDriver();
    const componentName = 'UnityEngine.UI.Text';
    const methodName = 'get_text';
    const assemblyName = 'UnityEngine.UI';
    const elementText = 'Change Camera Mode';
    const altElement = await altDriver.findObject(By.PATH, '/Canvas/Button/Text');
    const data = await altElement.callComponentMethod<string>(componentName, methodName, assemblyName, []);
    expect(data).toBe(elementText);
  });

  it('TestCallMethodSetFontSizeWithParameters', async () => {
    const altDriver = getDriver();
    const componentName = 'UnityEngine.UI.Text';
    const methodName = 'set_fontSize';
    const methodToVerifyName = 'get_fontSize';
    const assemblyName = 'UnityEngine.UI';
    const fontSizeExpected = 16;
    const parameters = ['16'];
    const altElement = await altDriver.findObject(By.PATH, '/Canvas/UnityUIInputField/Text');
    await altElement.callComponentMethod<string>(componentName, methodName, assemblyName, parameters);
    const fontSize = await altElement.callComponentMethod<number>(componentName, methodToVerifyName, assemblyName, []);
    expect(fontSize).toBe(fontSizeExpected);
  });

  it('TestCallMethodWithManyParameters', async () => {
    const altDriver = getDriver();
    const componentName = 'AltExampleScriptCapsule';
    const methodName = 'TestMethodWithManyParameters';
    const assemblyName = 'Assembly-CSharp';
    const parameters = [1, 'stringparam', 0.5, [1, 2, 3]];
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    const data = await altElement.callComponentMethod<string>(componentName, methodName, assemblyName, parameters);
    expect(data).toBeNull();
  });

  it('TestCallMethodWithOptionalParameters', async () => {
    const altDriver = getDriver();
    const componentName = 'AltExampleScriptCapsule';
    const methodName = 'TestMethodWithOptionalParameters';
    const assemblyName = 'Assembly-CSharp';
    const parameters = ['1', '2'];
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    const data = await altElement.callComponentMethod<string>(componentName, methodName, assemblyName, parameters);
    expect(data).toBe('3');
  });

  it('TestCallMethodWithOptionalParametersString', async () => {
    const altDriver = getDriver();
    const componentName = 'AltExampleScriptCapsule';
    const methodName = 'TestMethodWithOptionalParameters';
    const assemblyName = 'Assembly-CSharp';
    const parameters = ['FirstParameter', 'SecondParameter'];
    const typeOfParameters = ['System.String', 'System.String'];
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    const data = await altElement.callComponentMethod<string>(componentName, methodName, assemblyName, parameters, typeOfParameters);
    expect(data).toBe('FirstParameterSecondParameter');
  });

  it('TestCallMethodWithOptionalParametersString2', async () => {
    const altDriver = getDriver();
    const componentName = 'AltExampleScriptCapsule';
    const methodName = 'TestMethodWithOptionalParameters';
    const assemblyName = 'Assembly-CSharp';
    const parameters = ['FirstParameter', ''];
    const typeOfParameters = ['System.String', 'System.String'];
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    const data = await altElement.callComponentMethod<string>(componentName, methodName, assemblyName, parameters, typeOfParameters);
    expect(data).toBe('FirstParameter');
  });

  it('TestCallMethodWithIncorrectNumberOfParameters', async () => {
    const altDriver = getDriver();
    const componentName = 'AltExampleScriptCapsule';
    const methodName = 'TestMethodWithManyParameters';
    const assemblyName = 'Assembly-CSharp';
    const parameters = [1, 'stringparam', [1, 2, 3]];
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    const exception = await expectError(
      altElement.callComponentMethod<string>(componentName, methodName, assemblyName, parameters),
      MethodWithGivenParametersNotFoundException,
    );
    expect(
      exception.message.startsWith('No method found with 3 parameters matching signature: TestMethodWithManyParameters()'),
      exception.message,
    ).toBe(true);
  });

  it('TestCallMethodWithIncorrectNumberOfParameters2', async () => {
    const altDriver = getDriver();
    const componentName = 'AltExampleScriptCapsule';
    const methodName = 'TestMethodWithManyParameters';
    const assemblyName = 'Assembly-CSharp';
    const parameters = ['a', 'stringparam', [1, 2, 3]];
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    const exception = await expectError(
      altElement.callComponentMethod<string>(componentName, methodName, assemblyName, parameters),
      MethodWithGivenParametersNotFoundException,
    );
    expect(
      exception.message.startsWith('No method found with 3 parameters matching signature: TestMethodWithManyParameters()'),
      exception.message,
    ).toBe(true);
  });

  it('TestCallMethodAssemblyNotFound', async () => {
    const altDriver = getDriver();
    const componentName = 'RandomComponent';
    const methodName = 'TestMethodWithManyParameters';
    const parameters = ['a', 'stringparam', 0.5, [1, 2, 3]];
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    const exception = await expectError(
      altElement.callComponentMethod<string>(componentName, methodName, 'RandomAssembly', parameters, []),
      AssemblyNotFoundException,
    );
    expect(exception.message.startsWith('Assembly not found'), exception.message).toBe(true);
  });

  it('TestCallMethodInvalidMethodArgumentTypes', async () => {
    const altDriver = getDriver();
    const componentName = 'AltExampleScriptCapsule';
    const methodName = 'TestMethodWithManyParameters';
    const assemblyName = 'Assembly-CSharp';

    const parameters = ['stringnoint', 'stringparam', 0.5, [1, 2, 3]];
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    const exception = await expectError(
      altElement.callComponentMethod<string>(componentName, methodName, assemblyName, parameters),
      FailedToParseArgumentsException,
    );
    expect(exception.message.startsWith('Could not parse parameter'), exception.message).toBe(true);
  });

  it('TestCallMethodInvalidParameterType', async () => {
    const altDriver = getDriver();
    const componentName = 'AltExampleScriptCapsule';
    const methodName = 'TestMethodWithManyParameters';
    const assemblyName = 'Assembly-CSharp';

    const parameters = [1, 'stringparam', 0.5, [1, 2, 3]];
    const altElement = await altDriver.findObject(By.NAME, 'Capsule');
    const exception = await expectError(
      altElement.callComponentMethod<string>(componentName, methodName, assemblyName, parameters, ['System.Stringggggg']),
      InvalidParameterTypeException,
    );
    expect(
      exception.message.startsWith('Number of parameters different than number of types of parameters'),
      exception.message,
    ).toBe(true);
  });

  it('TestSetKeyInt', async () => {
    const altDriver = getDriver();
    await altDriver.deletePlayerPref();
    await altDriver.setKeyPlayerPref('test', 1);
    const val = await altDriver.getIntKeyPlayerPref('test');
    expect(val).toBe(1);
  });

  it('TestSetKeyFloat', async () => {
    const altDriver = getDriver();
    await altDriver.deletePlayerPref();
    // C# passes 1f; JS has no float literal, so the key type is given explicitly.
    await altDriver.setKeyPlayerPref('test', 1, PlayerPrefKeyType.Float);
    const val = await altDriver.getFloatKeyPlayerPref('test');
    expect(val).toBe(1);
  });

  it('TestSetKeyString', async () => {
    const altDriver = getDriver();
    await altDriver.deletePlayerPref();
    await altDriver.setKeyPlayerPref('test', 'test');
    const val = await altDriver.getStringKeyPlayerPref('test');
    expect(val).toBe('test');
  });

  it('TestDeleteKey', async () => {
    const altDriver = getDriver();
    await altDriver.deletePlayerPref();
    await altDriver.setKeyPlayerPref('test', 1);
    const val = await altDriver.getIntKeyPlayerPref('test');
    expect(val).toBe(1);
    await altDriver.deleteKeyPlayerPref('test');
    const exception = await expectError(altDriver.getIntKeyPlayerPref('test'), NotFoundException);
    expect(exception.message.startsWith('PlayerPrefs key test not found'), exception.message).toBe(true);
  });

  it('TestDifferentCamera', async () => {
    const altDriver = getDriver();
    const altButton = await altDriver.findObject(By.NAME, 'Button', By.NAME, 'Main Camera');
    await altButton.click();
    await altButton.click();
    const altElement = await altDriver.findObject(By.NAME, 'Capsule', By.NAME, 'Main Camera');
    const altElement2 = await altDriver.findObject(By.NAME, 'Capsule', By.NAME, 'Camera');
    const pozOnScreenFromMainCamera = { x: altElement.x, y: altElement.y };
    const pozOnScreenFromSecondaryCamera = { x: altElement2.x, y: altElement2.y };

    expect(pozOnScreenFromSecondaryCamera).not.toEqual(pozOnScreenFromMainCamera);
  });

  const findNonExistentObjectCases: [ByName, string][] = [
    ['COMPONENT', 'NonExistent'],
    ['ID', 'NonExistent'],
    ['LAYER', 'NonExistent'],
    ['NAME', 'NonExistent'],
    ['PATH', '/NonExistent'],
    ['PATH', '//NonExistent/..'],
    ['PATH', '//NonExistent/*'],
    ['PATH', '//*[@tag=NonExistent]'],
    ['PATH', '//*[@layer=NonExistent]'],
    ['PATH', '//*[@name=NonExistent]'],
    ['PATH', '//*[@component=NonExistent]'],
    ['PATH', '//*[@id=NonExistent]'],
    ['PATH', '//*[@text=NonExistent]'],
    ['PATH', '//*[@tag=plane][@layer=NonExistent]'],
    ['PATH', '//*[@tag=plane][@layer=Default][@name=NonExistent]'],
    ['PATH', '//*[@tag=plane][@layer=Default][@name=Plane][@component=NonExistent]'],
    ['PATH', '//*[@tag=plane][@layer=Default][@name=Plane][@component=MeshCollider][@id=NonExistent]'],
    [
      'PATH',
      '//*[@tag=Untagged][@layer=UI][@name=Text][@component=CanvasRenderer][@id=f9dc3b3c-2791-42dc-9c0f-87ef7ff5e11d]' +
        '[@text=NonExistent]',
    ],
    ['PATH', '//*[contains(@tag,NonExistent)]'],
    ['PATH', '//*[contains(@layer,NonExistent)]'],
    ['PATH', '//*[contains(@name,NonExistent)]'],
    ['PATH', '//*[contains(@component,NonExistent)]'],
    ['PATH', '//*[contains(@id,NonExistent)]'],
    ['PATH', '//*[contains(@text,NonExistent)]'],
    ['PATH', '//*[contains(@tag,pla)][contains(@layer,NonExistent)]'],
    ['PATH', '//*[contains(@tag,pla)][contains(@layer,Def)][contains(@name,NonExistent)]'],
    ['PATH', '//*[contains(@tag,pla)][contains(@layer,Def)][contains(@name,Pla)][contains(@component,NonExistent)]'],
    [
      'PATH',
      '//*[contains(@tag,pla)][contains(@layer,Def)][contains(@name,Pla)][contains(@component,MeshColl)]' +
        '[contains(@id,NonExistent)]',
    ],
    [
      'PATH',
      '//*[contains(@tag,Untag)][contains(@layer,U)][contains(@name,Tex)][contains(@component,CanvasRender)]' +
        '[contains(@id,f9dc3b3c-2791-42dc-9c0f-87ef7ff5e11d)][contains(@text,NonExistent)]',
    ],
    ['PATH', '//Canvas[100]'],
    ['PATH', '//Canvas[-100]'],
    ['TAG', 'NonExistent'],
    ['TEXT', 'NonExistent'],
    ['PATH', '//DisabledObject'],
    ['PATH', '//DisabledObject/DisabledChild'],
  ];
  for (const [by, value] of findNonExistentObjectCases) {
    it(`TestFindNonExistentObject(By.${by}, "${value}")`, async () => {
      const altDriver = getDriver();
      await expect(altDriver.findObject(By[by], value)).rejects.toThrow(NotFoundException);
    });
  }

  it('TestHoldButton', async () => {
    const altDriver = getDriver();
    const duration = 1;
    const button = await altDriver.findObject(By.NAME, 'UIButton');
    await altDriver.holdButton(button.getScreenPosition(), duration);
    const capsuleInfo = await altDriver.findObject(By.NAME, 'CapsuleInfo');
    const text = await capsuleInfo.getText();
    expect(text).toBe('UIButton clicked to jump capsule!');
    const time = parseFloat(await (await altDriver.findObject(By.NAME, 'ChineseLetters')).getText());
    expect(time).toBeGreaterThan(duration);
  });

  // Ignored in C#: Ignore PressKey method
  it.skip('TestPressKeyWaitTheDuration', () => {});

  // C#: [Obsolete]
  it('TestClickElement', async () => {
    const altDriver = getDriver();
    const name = 'Capsule';
    await (await altDriver.findObject(By.NAME, name)).tap();
    await altDriver.waitForObject(By.PATH, '//CapsuleInfo[@text=Capsule was clicked to jump!]');
    const capsuleInfo = await altDriver.waitForObject(By.PATH, '/Canvas/CapsuleInfo');
    const mText = String(await capsuleInfo.getComponentProperty<string>('UnityEngine.UI.Text', 'm_Text', 'UnityEngine.UI'));
    expect(mText).toBe('Capsule was clicked to jump!');
  });

  it('CapsuleJumpWhenHold', async () => {
    const altDriver = getDriver();
    const name = 'Capsule';
    const altElement = await altDriver.findObject(By.NAME, name);
    await altDriver.holdButton(altElement.getScreenPosition(), 1.5);
    await altDriver.waitForObject(By.PATH, '//CapsuleInfo[@text=Capsule was clicked to jump!]');
    const capsuleInfo = await altDriver.waitForObject(By.PATH, '/Canvas/CapsuleInfo');
    const mText = String(await capsuleInfo.getComponentProperty<string>('UnityEngine.UI.Text', 'm_Text', 'UnityEngine.UI'));
    expect(mText).toBe('Capsule was clicked to jump!');
  });

  it('TestWaitForObjectToNotExist', async () => {
    const altDriver = getDriver();
    await altDriver.waitForObjectToNotBePresent(By.NAME, 'ObjectDestroyedIn5Secs');
    await altDriver.waitForObjectToNotBePresent(By.NAME, 'Capsulee', By.NAME, '', 1, 0.5);
  });

  it('TestWaitForObjectToNotExistFail', async () => {
    const altDriver = getDriver();
    const exception = await expectError(
      altDriver.waitForObjectToNotBePresent(By.NAME, 'Capsule', By.NAME, '', 1, 0.5),
      WaitTimeOutException,
    );
    // C# expects "Element //Capsule ..."; the TS driver (like Python) names the element by its find value.
    expect(exception.message).toBe('Element Capsule still found after 1 seconds');
  });

  it('TestWaitForCurrentSceneToBeANonExistingScene', async () => {
    const altDriver = getDriver();
    const name = 'AltDriverTestScene';
    const exception = await expectError(altDriver.waitForCurrentSceneToBe(name, 1), WaitTimeOutException);
    expect(exception.message).toBe('Scene AltDriverTestScene not loaded after 1 seconds');
  });

  it('TestCallStaticMethod', async () => {
    const altDriver = getDriver();
    await altDriver.callStaticMethod<string>('UnityEngine.PlayerPrefs', 'SetInt', 'UnityEngine.CoreModule', ['Test', '1']);
    const a = await altDriver.callStaticMethod<number>('UnityEngine.PlayerPrefs', 'GetInt', 'UnityEngine.CoreModule', ['Test', '2']);
    expect(a).toBe(1);
  });

  it('TestCallStaticNonExistentMethod', async () => {
    const altDriver = getDriver();
    await expect(
      altDriver.callStaticMethod<number>('UnityEngine.PlayerPrefs', 'UNEXISTING', 'UnityEngine.CoreModule', ['Test', '2']),
    ).rejects.toThrow(MethodNotFoundException);
  });

  // Category: WebGLUnsupported. Fails on WebGL in pipeline, skip until issue #1465 is fixed:
  // https://github.com/alttester/AltTester-Unity-SDK/issues/1465
  it('TestCallStaticMethodNonExistingAssembly', async () => {
    const altDriver = getDriver();
    await expect(
      altDriver.callStaticMethod<number>('UnityEngine.PlayerPrefs', 'GetInt', 'UNEXISTING', ['Test', '2']),
    ).rejects.toThrow(AssemblyNotFoundException);
  });

  // Category: WebGLUnsupported. Fails on WebGL in pipeline, skip until issue #1465 is fixed:
  // https://github.com/alttester/AltTester-Unity-SDK/issues/1465
  // to check what error should be triggered
  it('TestCallStaticMethodNonExistingTypeName', async () => {
    const altDriver = getDriver();
    await expect(
      altDriver.callStaticMethod<number>('UNEXISTING', 'GetInt', 'UnityEngine.CoreModule', ['Test', '2']),
    ).rejects.toThrow(ComponentNotFoundException);
  });
});
