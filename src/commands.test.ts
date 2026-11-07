import { describe, expect, it } from 'vitest';
import { FakeAltServer, type ReceivedCommand } from '../test/fakeAltServer';
import { AltError, AltSocket, AltTimeoutError } from './AltSocket';
import { AltDriver } from './commands';
import { UNAVAILABLE, type GameEngine } from './engine';
import type { AltObject, ScreenshotPayload } from './types';

async function setup(engine: GameEngine = 'unity', commandTimeoutMs?: number) {
  const server = new FakeAltServer();
  const socket = await AltSocket.connect({
    host: 'localhost',
    port: 13000,
    secure: false,
    WebSocketImpl: server.WebSocket,
    commandTimeoutMs,
  });
  return { server, socket, driver: new AltDriver(socket, engine) };
}

const STARTUP = new Set(['getServerVersion', 'activateNotification']);
function sent(server: FakeAltServer): ReceivedCommand[] {
  return server.last().commands.filter((c) => !STARTUP.has(c.commandName));
}

const obj: AltObject = {
  name: 'Cube',
  id: 42,
  x: 1,
  y: 2,
  z: 3,
  mobileY: 4,
  type: 'GameObject',
  enabled: true,
  worldX: 0,
  worldY: 0,
  worldZ: 0,
  idCamera: 7,
  transformParentId: 10,
  transformId: 11,
};
const shot: ScreenshotPayload = { textureSize: { x: 800, y: 600, z: 0 }, scaleDifference: { x: 800, y: 600 }, compressedImage: 'AAAA' };
const component = { componentName: 'UnityEngine.Transform', assemblyName: 'UnityEngine.CoreModule' };

describe('AltDriver find-type commands', () => {
  it('getAllLoadedScenesAndObjects with no camera sends path/cameraBy/cameraPath, never null', async () => {
    const { server, socket, driver } = await setup();
    server.on('getAllLoadedScenesAndObjects', () => [{ data: [{ name: 'Main', id: 0, transformId: 0 }] }]);
    const rows = await driver.getAllLoadedScenesAndObjects();
    expect(rows).toEqual([{ name: 'Main', id: 0, transformId: 0 }]);
    const [cmd] = server.commandsNamed('getAllLoadedScenesAndObjects');
    expect(cmd).toMatchObject({ path: '//*', cameraBy: 2, cameraPath: '//*', enabled: true });
    socket.close();
  });

  it('choosing camera "UICamera" makes the next hierarchy request send cameraPath //UICamera', async () => {
    const { server, socket, driver } = await setup();
    server.on('getAllLoadedScenesAndObjects', () => [{ data: [] }]);
    driver.setCamera('UICamera');
    expect(driver.camera).toBe('UICamera');
    await driver.getAllLoadedScenesAndObjects(false);
    driver.setCamera(null);
    await driver.getAllLoadedScenesAndObjects(false);
    const cmds = server.commandsNamed('getAllLoadedScenesAndObjects');
    expect(cmds[0]).toMatchObject({ path: '//*', cameraBy: 2, cameraPath: '//UICamera', enabled: false });
    expect(cmds[1]).toMatchObject({ cameraBy: 2, cameraPath: '//*' });
    socket.close();
  });

  it('findObject looks up by id with the chosen camera', async () => {
    const { server, socket, driver } = await setup();
    server.on('findObject', () => [{ data: obj }]);
    driver.setCamera('Main Camera');
    expect(await driver.findObject(42)).toEqual(obj);
    expect(server.commandsNamed('findObject')[0]).toMatchObject({
      path: '//*[@id=42]',
      cameraBy: 2,
      cameraPath: '//Main Camera',
      enabled: true,
    });
    socket.close();
  });

  it('findObjectAtCoordinates resolves null when nothing is hit', async () => {
    const { server, socket, driver } = await setup();
    server.on('findObjectAtCoordinates', () => [{ data: null }]);
    expect(await driver.findObjectAtCoordinates({ x: 5, y: 6 })).toBeNull();
    expect(server.commandsNamed('findObjectAtCoordinates')[0]).toMatchObject({ coordinates: { x: 5, y: 6 } });
    socket.close();
  });
});

describe('AltDriver screenshots', () => {
  it('getScreenshot waits for "Ok" then the payload, with Desktop defaults', async () => {
    const { server, socket, driver } = await setup();
    server.on('getScreenshot', () => [{ data: 'Ok' }, { data: shot }]);
    expect(await driver.getScreenshot()).toEqual(shot);
    expect(server.commandsNamed('getScreenshot')[0]).toMatchObject({ size: { x: 0, y: 0 }, quality: 100 });
    socket.close();
  });

  it('hightlightObjectScreenshot sends altObjectId, red colour and width 1.05', async () => {
    const { server, socket, driver } = await setup();
    server.on('hightlightObjectScreenshot', () => [{ data: 'Ok' }, { data: shot }]);
    expect(await driver.hightlightObjectScreenshot(42)).toEqual(shot);
    expect(server.commandsNamed('hightlightObjectScreenshot')[0]).toMatchObject({
      altObjectId: 42,
      color: { r: 1, g: 0, b: 0, a: 1 },
      width: 1.05,
      size: { x: 0, y: 0 },
      quality: 100,
    });
    socket.close();
  });

  it('hightlightObjectFromCoordinatesScreenshot returns the object and the screenshot from 3 frames', async () => {
    const { server, socket, driver } = await setup();
    server.on('hightlightObjectFromCoordinatesScreenshot', () => [{ data: obj }, { data: 'Ok' }, { data: shot }]);
    expect(await driver.hightlightObjectFromCoordinatesScreenshot({ x: 1, y: 2 })).toEqual({ object: obj, screenshot: shot });
    expect(server.commandsNamed('hightlightObjectFromCoordinatesScreenshot')[0]).toMatchObject({
      coordinates: { x: 1, y: 2 },
      color: { r: 1, g: 0, b: 0, a: 1 },
      width: 1.05,
      quality: 100,
    });
    socket.close();
  });

  it('hightlightObjectFromCoordinatesScreenshot maps the {name:"Null",id:0} placeholder to null', async () => {
    const { server, socket, driver } = await setup();
    server.on('hightlightObjectFromCoordinatesScreenshot', () => [{ data: { name: 'Null', id: 0 } }, { data: 'Ok' }, { data: shot }]);
    expect(await driver.hightlightObjectFromCoordinatesScreenshot({ x: 1, y: 2 })).toEqual({ object: null, screenshot: shot });
    socket.close();
  });
});

describe('AltDriver object details', () => {
  it('sends the documented param names for components, properties, fields and methods', async () => {
    const { server, socket, driver } = await setup();
    server.on('getAllComponents', () => [{ data: [component] }]);
    server.on('getAllProperties', () => [{ data: [{ name: 'p', value: '1', type: 0 }] }]);
    server.on('getAllFields', () => [{ data: [] }]);
    server.on('getAllMethods', () => [{ data: ['Foo()'] }]);
    expect(await driver.getAllComponents(42)).toEqual([component]);
    expect(await driver.getAllProperties(42, component, 1)).toEqual([{ name: 'p', value: '1', type: 0 }]);
    expect(await driver.getAllFields(42, component)).toEqual([]);
    expect(await driver.getAllMethods(component, 0)).toEqual(['Foo()']);
    expect(server.commandsNamed('getAllComponents')[0]).toMatchObject({ altObjectId: 42 });
    expect(server.commandsNamed('getAllProperties')[0]).toMatchObject({ altObjectId: 42, altComponent: component, altPropertiesSelections: 1 });
    expect(server.commandsNamed('getAllFields')[0]).toMatchObject({ altObjectId: 42, altComponent: component, altFieldsSelections: 2 });
    expect(server.commandsNamed('getAllMethods')[0]).toMatchObject({ altComponent: component, methodSelection: 0 });
    socket.close();
  });

  it('getAllFields on Unreal and unknown engines is never written and resolves unavailable', async () => {
    for (const engine of ['unreal', 'unknown'] as const) {
      const { server, socket, driver } = await setup(engine);
      server.on('getAllFields', () => 'silent');
      expect(await driver.getAllFields(42, component)).toBe(UNAVAILABLE);
      expect(await driver.getAllVisualElementProperty(obj)).toBe(UNAVAILABLE);
      expect(server.commandsNamed('getAllFields')).toHaveLength(0);
      expect(server.commandsNamed('getAllVisualElementProperty')).toHaveLength(0);
      socket.close();
    }
  });

  it('getAllVisualElementProperty on a Unity app that answers invalidCommand resolves unavailable', async () => {
    const { server, socket, driver } = await setup('unity');
    server.on('getAllVisualElementProperty', () => [{ error: { type: 'invalidCommand', message: 'unknown command' } }]);
    expect(await driver.getAllVisualElementProperty(obj)).toBe(UNAVAILABLE);
    expect(server.commandsNamed('getAllVisualElementProperty')[0]).toMatchObject({ altObject: obj });
    socket.close();
  });

  it('getAllFields on Unity also maps invalidCommand to unavailable, but other errors reject', async () => {
    const { server, socket, driver } = await setup('unity');
    server.on('getAllFields', () => [{ error: { type: 'invalidCommand', message: 'x' } }]);
    expect(await driver.getAllFields(42, component)).toBe(UNAVAILABLE);
    server.on('getAllFields', () => [{ error: { type: 'componentNotFound', message: 'gone' } }]);
    const err = await driver.getAllFields(42, component, 0).catch((e) => e);
    expect(err).toBeInstanceOf(AltError);
    expect(err.type).toBe('componentNotFound');
    socket.close();
  });

  it('getAllVisualElementProperty returns the property map on Unity', async () => {
    const { server, socket, driver } = await setup('unity');
    server.on('getAllVisualElementProperty', () => [{ data: { text: 'Hi' } }]);
    expect(await driver.getAllVisualElementProperty(obj)).toEqual({ text: 'Hi' });
    socket.close();
  });

  it('getAltId sends the AltId component query with the full altObject', async () => {
    const { server, socket, driver } = await setup('unity');
    server.on('getObjectComponentProperty', () => [{ data: 'abc-123' }]);
    expect(await driver.getAltId(obj)).toBe('abc-123');
    expect(server.commandsNamed('getObjectComponentProperty')[0]).toMatchObject({
      altObject: obj,
      component: 'AltTester.AltTesterUnitySDK.AltId',
      property: 'altID',
      assembly: 'AltTester.AltTesterUnitySDK',
      maxDepth: 1,
    });
    socket.close();
  });

  it('getAltId resolves null when the object has no AltId (Unity componentNotFound, Unreal "-1")', async () => {
    const unity = await setup('unity');
    unity.server.on('getObjectComponentProperty', () => [{ error: { type: 'componentNotFound', message: 'no' } }]);
    expect(await unity.driver.getAltId(obj)).toBeNull();
    unity.socket.close();
    const unreal = await setup('unreal');
    unreal.server.on('getObjectComponentProperty', () => [{ data: '-1' }]);
    expect(await unreal.driver.getAltId(obj)).toBeNull();
    unreal.socket.close();
  });

  it('getAltId maps invalidCommand to unavailable', async () => {
    const { server, socket, driver } = await setup('unity');
    server.on('getObjectComponentProperty', () => [{ error: { type: 'invalidCommand', message: 'x' } }]);
    expect(await driver.getAltId(obj)).toBe(UNAVAILABLE);
    socket.close();
  });

  it('getText / setText take the full altObject; setText submits by default', async () => {
    const { server, socket, driver } = await setup();
    server.on('getText', () => [{ data: 'hello' }]);
    server.on('setText', () => [{ data: obj }]);
    expect(await driver.getText(obj)).toBe('hello');
    expect(await driver.setText(obj, 'bye')).toEqual(obj);
    expect(server.commandsNamed('getText')[0]).toMatchObject({ altObject: obj });
    expect(server.commandsNamed('setText')[0]).toMatchObject({ altObject: obj, value: 'bye', submit: true });
    socket.close();
  });
});

describe('AltDriver input and time', () => {
  it('tapCoordinates waits for "Ok" and "Finished" with Desktop defaults', async () => {
    const { server, socket, driver } = await setup();
    server.on('tapCoordinates', () => [{ data: 'Ok' }, { data: 'Finished' }]);
    await driver.tapCoordinates({ x: 3, y: 4 });
    expect(server.commandsNamed('tapCoordinates')[0]).toMatchObject({ coordinates: { x: 3, y: 4 }, count: 1, interval: 0.1, wait: true });
    socket.close();
  });

  it('beginTouch returns the finger id; moveTouch and endTouch use it', async () => {
    const { server, socket, driver } = await setup();
    server.on('beginTouch', () => [{ data: 3 }]);
    expect(await driver.beginTouch({ x: 1, y: 1 })).toBe(3);
    await driver.moveTouch(3, { x: 2, y: 2 });
    await driver.endTouch(3);
    expect(server.commandsNamed('beginTouch')[0]).toMatchObject({ coordinates: { x: 1, y: 1 } });
    expect(server.commandsNamed('moveTouch')[0]).toMatchObject({ fingerId: 3, coordinates: { x: 2, y: 2 } });
    expect(server.commandsNamed('endTouch')[0]).toMatchObject({ fingerId: 3 });
    socket.close();
  });

  it('pressKeyboardKeys expects one "Ok" plus one "Finished" per key', async () => {
    const { server, socket, driver } = await setup();
    server.on('pressKeyboardKeys', () => [{ data: 'Ok' }, { data: 'Finished' }, { data: 'Finished' }]);
    await driver.pressKeyboardKeys([97, 98]);
    expect(server.commandsNamed('pressKeyboardKeys')[0]).toMatchObject({ keyCodes: [97, 98], power: 1, duration: 0.1, wait: true });
    socket.close();
  });

  it('pressKeyboardKeys does not resolve after only the first "Finished" of two keys', async () => {
    const { server, socket, driver } = await setup('unity', 40);
    server.on('pressKeyboardKeys', () => [{ data: 'Ok' }, { data: 'Finished' }]);
    const err = await driver.pressKeyboardKeys([97, 98]).catch((e) => e);
    expect(err).toBeInstanceOf(AltTimeoutError);
    socket.close();
  });

  it('setTimeScale / getTimeScale', async () => {
    const { server, socket, driver } = await setup();
    server.on('getTimeScale', () => [{ data: 0.5 }]);
    await driver.setTimeScale(2);
    expect(await driver.getTimeScale()).toBe(0.5);
    expect(server.commandsNamed('setTimeScale')[0]).toMatchObject({ timeScale: 2 });
    socket.close();
  });

  it('getTimeScale parses the string the Unreal SDK sends ("1.0")', async () => {
    const { server, socket, driver } = await setup('unreal');
    server.on('getTimeScale', () => [{ data: '1.0' }]);
    expect(await driver.getTimeScale()).toBe(1);
    socket.close();
  });

  it('getTimeScale rejects a reply that is not a number', async () => {
    const { server, socket, driver } = await setup();
    server.on('getTimeScale', () => [{ data: 'fast' }]);
    await expect(driver.getTimeScale()).rejects.toBeInstanceOf(AltError);
    socket.close();
  });

  it('getAllActiveCameras returns AltObjects', async () => {
    const { server, socket, driver } = await setup();
    server.on('getAllActiveCameras', () => [{ data: [obj] }]);
    expect(await driver.getAllActiveCameras()).toEqual([obj]);
    socket.close();
  });
});

describe('AltDriver retries', () => {
  it('a timed-out tapCoordinates is not retried', async () => {
    const { server, socket, driver } = await setup('unity', 30);
    server.on('tapCoordinates', () => 'silent');
    const err = await driver.tapCoordinates({ x: 1, y: 1 }).catch((e) => e);
    expect(err).toBeInstanceOf(AltTimeoutError);
    expect(server.commandsNamed('tapCoordinates')).toHaveLength(1);
    socket.close();
  });

  it('a timed-out getAllComponents is retried twice', async () => {
    const { server, socket, driver } = await setup('unity', 30);
    server.on('getAllComponents', () => 'silent');
    const err = await driver.getAllComponents(42).catch((e) => e);
    expect(err).toBeInstanceOf(AltTimeoutError);
    expect(server.commandsNamed('getAllComponents')).toHaveLength(3);
    socket.close();
  });

  it('input commands are never collapsed: two identical taps are both sent', async () => {
    const { server, socket, driver } = await setup();
    server.on('tapCoordinates', () => [{ data: 'Ok' }, { data: 'Finished' }]);
    await Promise.all([driver.tapCoordinates({ x: 1, y: 1 }), driver.tapCoordinates({ x: 1, y: 1 })]);
    expect(server.commandsNamed('tapCoordinates')).toHaveLength(2);
    socket.close();
  });
});

describe('wire command names', () => {
  it('match the names in CommandParams.cs, including the hightlight typo', async () => {
    const { server, socket, driver } = await setup('unity');
    server.on('getScreenshot', () => [{ data: 'Ok' }, { data: shot }]);
    server.on('hightlightObjectScreenshot', () => [{ data: 'Ok' }, { data: shot }]);
    server.on('hightlightObjectFromCoordinatesScreenshot', () => [{ data: obj }, { data: 'Ok' }, { data: shot }]);
    server.on('tapCoordinates', () => [{ data: 'Ok' }, { data: 'Finished' }]);
    server.on('pressKeyboardKeys', () => [{ data: 'Ok' }, { data: 'Finished' }]);
    server.on('beginTouch', () => [{ data: 0 }]);
    server.on('getTimeScale', () => [{ data: 1 }]);

    const p = { x: 1, y: 1 };
    await driver.getAllLoadedScenesAndObjects();
    await driver.findObject(1);
    await driver.findObjectAtCoordinates(p);
    await driver.getAllActiveCameras();
    await driver.getScreenshot();
    await driver.hightlightObjectScreenshot(1);
    await driver.hightlightObjectFromCoordinatesScreenshot(p);
    await driver.getAllComponents(1);
    await driver.getAllProperties(1, component);
    await driver.getAllFields(1, component);
    await driver.getAllMethods(component);
    await driver.getAllVisualElementProperty(obj);
    await driver.getAltId(obj);
    await driver.getText(obj);
    await driver.setText(obj, 'x');
    await driver.tapCoordinates(p);
    await driver.beginTouch(p);
    await driver.moveTouch(0, p);
    await driver.endTouch(0);
    await driver.pressKeyboardKeys([97]);
    await driver.setTimeScale(1);
    await driver.getTimeScale();

    expect(sent(server).map((c) => c.commandName)).toEqual([
      'getAllLoadedScenesAndObjects',
      'findObject',
      'findObjectAtCoordinates',
      'getAllActiveCameras',
      'getScreenshot',
      'hightlightObjectScreenshot',
      'hightlightObjectFromCoordinatesScreenshot',
      'getAllComponents',
      'getAllProperties',
      'getAllFields',
      'getAllMethods',
      'getAllVisualElementProperty',
      'getObjectComponentProperty',
      'getText',
      'setText',
      'tapCoordinates',
      'beginTouch',
      'moveTouch',
      'endTouch',
      'pressKeyboardKeys',
      'setTimeScale',
      'getTimeScale',
    ]);
    socket.close();
  });
});
