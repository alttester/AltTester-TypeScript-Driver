import { describe, expect, it, vi } from 'vitest';
import { FakeAltServer, flush, type ReceivedCommand } from '../../test/fakeAltServer';
import {
  AltTesterInvalidServerResponse,
  ComponentNotFoundException,
  InvalidCommandException,
  MultipleDriversException,
  NoAppConnectedException,
  NotFoundException,
  WaitTimeOutException,
} from '../errors';
import { By, type AltObject as AltObjectData } from '../types';
import { AltDriver, type AltDriverOptions } from './AltDriver';
import { AltObject } from './AltObject';
import { NotificationType, PlayerPrefKeyType } from './enums';

const cube: AltObjectData = {
  name: 'Cube',
  id: 42,
  x: 1,
  y: 2,
  z: 3,
  mobileY: 4,
  type: 'GameObject',
  enabled: true,
  worldX: 5,
  worldY: 6,
  worldZ: 7,
  idCamera: 8,
  transformParentId: 9,
  transformId: 10,
};

async function setup(opts: Partial<AltDriverOptions> & { serverVersion?: string } = {}) {
  const server = new FakeAltServer({ serverVersion: opts.serverVersion });
  const driver = await AltDriver.connect({ WebSocketImpl: server.WebSocket, connectTimeout: 1, ...opts });
  return { server, driver };
}

function sent(server: FakeAltServer, name: string): ReceivedCommand[] {
  return server.commandsNamed(name);
}

const strip = ({ messageId: _m, commandName: _c, isNotification: _n, ...rest }: ReceivedCommand) => rest;

describe('binding AltDriver: connect', () => {
  it('connects with binding defaults: driverType typescript_<version>, no startup notifications', async () => {
    const { server, driver } = await setup({ appName: 'Game' });
    const url = new URL(server.last().url);
    expect(url.searchParams.get('appName')).toBe('Game');
    expect(url.searchParams.get('driverType')).toMatch(/^typescript_\d+\.\d+\.\d+$/);
    expect(sent(server, 'activateNotification')).toHaveLength(0);
    expect(driver.engine).toBe('unity');
  });

  it('infers Unreal from a 1.x SDK version and refuses Unity-only commands without sending them', async () => {
    const { server, driver } = await setup({ serverVersion: '1.2.1' });
    expect(driver.engine).toBe('unreal');
    await expect(driver.unloadScene('Menu')).rejects.toBeInstanceOf(InvalidCommandException);
    await expect(driver.resetInput()).rejects.toBeInstanceOf(InvalidCommandException);
    expect(sent(server, 'unloadScene')).toHaveLength(0);
  });

  it('lets the caller override the engine', async () => {
    const { driver } = await setup({ serverVersion: '1.2.1', engine: 'unity' });
    expect(driver.engine).toBe('unity');
  });

  it('retries while no app is connected, then throws the typed close error', async () => {
    const server = new FakeAltServer({ refuseWith: { code: 4001, reason: 'no app' } });
    const started = Date.now();
    await expect(AltDriver.connect({ WebSocketImpl: server.WebSocket, connectTimeout: 1.2 })).rejects.toBeInstanceOf(NoAppConnectedException);
    expect(server.sockets.length).toBeGreaterThan(1);
    expect(Date.now() - started).toBeGreaterThanOrEqual(1000);
  });

  it('fails fast on close codes that retrying cannot fix', async () => {
    const server = new FakeAltServer({ refuseWith: { code: 4005, reason: 'busy' } });
    await expect(AltDriver.connect({ WebSocketImpl: server.WebSocket, connectTimeout: 5 })).rejects.toBeInstanceOf(MultipleDriversException);
    expect(server.sockets).toHaveLength(1);
  });

  it('reconnects after the app disconnects (4002) and re-activates notification listeners', async () => {
    const { server, driver } = await setup();
    await driver.addNotificationListener(NotificationType.LOADSCENE, () => undefined);
    const first = server.last();
    first.serverClose(4002, 'app gone');
    await flush(10);
    server.on('getCurrentScene', () => [{ data: { name: 'Menu' } }]);
    expect(await driver.getCurrentScene()).toBe('Menu');
    expect(server.last()).not.toBe(first);
    expect(server.last().commands.map((c) => c.commandName)).toContain('activateNotification');
  });
});

describe('binding AltDriver: find and wait', () => {
  it('builds paths and camera paths like the other bindings', async () => {
    const { server, driver } = await setup();
    server.on('findObject', () => [{ data: cube }]);
    server.on('findObjects', () => [{ data: [cube, cube] }]);
    const found = await driver.findObject(By.NAME, 'Cube');
    expect(found).toBeInstanceOf(AltObject);
    expect(found.toJSON()).toEqual(cube);
    await driver.findObjects(By.TAG, 'Enemy', By.NAME, 'Main Camera', false);
    await driver.findObjectWhichContains(By.TEXT, 'Play');
    await driver.findObjectsWhichContain(By.COMPONENT, 'Button');
    expect(sent(server, 'findObject').map(strip)).toEqual([
      { path: '//Cube', cameraBy: By.NAME, cameraPath: '//', enabled: true },
      { path: '//*[contains(@text,Play)]', cameraBy: By.NAME, cameraPath: '//', enabled: true },
    ]);
    expect(sent(server, 'findObjects').map(strip)).toEqual([
      { path: '//*[@tag=Enemy]', cameraBy: By.NAME, cameraPath: '//Main Camera', enabled: false },
      { path: '//*[contains(@component,Button)]', cameraBy: By.NAME, cameraPath: '//', enabled: true },
    ]);
  });

  it('maps wire error types to typed exceptions', async () => {
    const { server, driver } = await setup();
    server.on('findObject', () => [{ error: { type: 'notFound', message: 'Object //Nope not found' } }]);
    const err = await driver.findObject(By.NAME, 'Nope').catch((e) => e);
    expect(err).toBeInstanceOf(NotFoundException);
    expect(err.type).toBe('notFound');
  });

  it('waitForObject polls until the object appears', async () => {
    const { server, driver } = await setup();
    let calls = 0;
    server.on('findObject', () => (++calls < 3 ? [{ error: { type: 'notFound', message: 'no' } }] : [{ data: cube }]));
    const o = await driver.waitForObject(By.NAME, 'Cube', By.NAME, '', 2, 0.01);
    expect(o.id).toBe(42);
    expect(calls).toBe(3);
  });

  it('waitForObject throws WaitTimeOutException; other errors propagate at once', async () => {
    const { server, driver } = await setup();
    server.on('findObject', () => [{ error: { type: 'notFound', message: 'no' } }]);
    await expect(driver.waitForObject(By.NAME, 'Cube', By.NAME, '', 0.05, 0.01)).rejects.toBeInstanceOf(WaitTimeOutException);
    server.on('findObject', () => [{ error: { type: 'invalidPath', message: 'bad' } }]);
    await expect(driver.waitForObject(By.PATH, '//[', By.NAME, '', 5, 0.01)).rejects.toThrow('bad');
  });

  it('the implicit timeout replaces the default wait timeout', async () => {
    const { server, driver } = await setup();
    server.on('findObject', () => [{ error: { type: 'notFound', message: 'no' } }]);
    driver.setImplicitTimeout(0.05);
    const started = Date.now();
    await expect(driver.waitForObject(By.NAME, 'Cube', By.NAME, '', undefined, 0.01)).rejects.toThrow('after 0.05 seconds');
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('waitForObjectToNotBePresent resolves on NotFound', async () => {
    const { server, driver } = await setup();
    let calls = 0;
    server.on('findObject', () => (++calls < 2 ? [{ data: cube }] : [{ error: { type: 'notFound', message: 'gone' } }]));
    await driver.waitForObjectToNotBePresent(By.NAME, 'Cube', By.NAME, '', 2, 0.01);
    expect(calls).toBe(2);
  });

  it('waitForCurrentSceneToBe polls getCurrentScene', async () => {
    const { server, driver } = await setup();
    let calls = 0;
    server.on('getCurrentScene', () => [{ data: { name: ++calls < 2 ? 'Menu' : 'Game' } }]);
    expect(await driver.waitForCurrentSceneToBe('Game', 2, 0.01)).toBe('Game');
  });

  it('normalizes Unreal "iD" rows from getAllLoadedScenesAndObjects', async () => {
    const { server, driver } = await setup();
    server.on('getAllLoadedScenesAndObjects', () => [{ data: [{ name: 'World', iD: 0, transformId: 0 }, { name: 'Btn', iD: 5, transformId: 5 }] }]);
    const rows = await driver.getAllLoadedScenesAndObjects();
    expect(rows.map((r) => [r.name, r.id, r.type])).toEqual([
      ['World', 0, ''],
      ['Btn', 5, ''],
    ]);
  });
});

describe('binding AltObject', () => {
  async function withCube() {
    const ctx = await setup();
    ctx.server.on('findObject', () => [{ data: cube }]);
    return { ...ctx, obj: await ctx.driver.findObject(By.NAME, 'Cube') };
  }

  it('gets, sets and calls component members with the bindings’ wire shapes', async () => {
    const { server, obj } = await withCube();
    server.on('getObjectComponentProperty', () => [{ data: { x: 1 } }]);
    server.on('setObjectComponentProperty', () => [{ data: 'valueSet' }]);
    server.on('callComponentMethodForObject', () => [{ data: 3 }]);
    expect(await obj.getComponentProperty('UnityEngine.Transform', 'position', 'UnityEngine.CoreModule')).toEqual({ x: 1 });
    expect(await obj.setComponentProperty('Comp', 'speed', 'Asm', 2.5)).toBe('valueSet');
    expect(await obj.callComponentMethod('Comp', 'Add', 'Asm', [1, 'a'], ['System.Int32', 'System.String'])).toBe(3);
    expect(strip(sent(server, 'getObjectComponentProperty')[0])).toEqual({
      altObject: cube,
      component: 'UnityEngine.Transform',
      property: 'position',
      assembly: 'UnityEngine.CoreModule',
      maxDepth: 2,
    });
    expect(strip(sent(server, 'setObjectComponentProperty')[0])).toMatchObject({ value: '2.5', assembly: 'Asm' });
    expect(strip(sent(server, 'callComponentMethodForObject')[0])).toEqual({
      altObject: cube,
      component: 'Comp',
      method: 'Add',
      parameters: ['1', '"a"'],
      typeofparameters: ['System.Int32', 'System.String'],
      assembly: 'Asm',
    });
  });

  it('typed errors from component calls', async () => {
    const { server, obj } = await withCube();
    server.on('getObjectComponentProperty', () => [{ error: { type: 'componentNotFound', message: 'no comp' } }]);
    await expect(obj.getComponentProperty('X', 'y', 'Z')).rejects.toBeInstanceOf(ComponentNotFoundException);
  });

  it('tap/click wait for "Finished" and return the object from the first frame', async () => {
    const { server, obj } = await withCube();
    server.on('tapElement', () => [{ data: { ...cube, x: 99 } }, { data: 'Finished' }]);
    const tapped = await obj.tap();
    expect(tapped.x).toBe(99);
    server.on('clickElement', () => [{ data: cube }, { data: 'Oops' }]);
    await expect(obj.click()).rejects.toBeInstanceOf(AltTesterInvalidServerResponse);
    server.on('tapElement', () => [{ data: cube }]);
    await expect(obj.tap(1, 0.1, false)).resolves.toBeInstanceOf(AltObject);
  });

  it('setText defaults submit to false (binding default)', async () => {
    const { server, obj } = await withCube();
    server.on('setText', () => [{ data: cube }]);
    await obj.setText('hi');
    expect(strip(sent(server, 'setText')[0])).toEqual({ altObject: cube, value: 'hi', submit: false });
  });

  it('getParent and findObjectFromObject use id-anchored paths', async () => {
    const { server, obj } = await withCube();
    await obj.getParent();
    await obj.findObjectFromObject(By.NAME, 'Child');
    const paths = sent(server, 'findObject').map((c) => c.path);
    expect(paths.slice(1)).toEqual(['//*[@id=42]/..', '//*[@id=42]//Child']);
  });

  it('waitForComponentProperty compares like the Python binding', async () => {
    const { server, obj } = await withCube();
    let v = 0;
    server.on('getObjectComponentProperty', () => [{ data: v++ < 1 ? 'off' : [1, 2] }]);
    expect(await obj.waitForComponentProperty('C', 'p', [1, 2], 'A', 2, 0.01)).toEqual([1, 2]);
    server.on('getObjectComponentProperty', () => [{ data: { a: 1 } }]);
    expect(await obj.waitForComponentProperty('C', 'p', '{"a": 1}', 'A', 1, 0.01, true)).toEqual({ a: 1 });
    await expect(obj.waitForComponentProperty('C', 'p', 'never', 'A', 0.03, 0.01)).rejects.toBeInstanceOf(WaitTimeOutException);
  });
});

describe('binding AltDriver: commands', () => {
  it('input commands send the documented params and check "Ok"/"Finished"', async () => {
    const { server, driver } = await setup();
    const finish = () => [{ data: 'Ok' }, { data: 'Finished' }];
    for (const c of ['tapCoordinates', 'clickCoordinates', 'moveMouse', 'scroll', 'swipe', 'multipointSwipe', 'tilt']) server.on(c, finish);
    server.on('pressKeyboardKeys', () => [{ data: 'Ok' }, { data: 'Finished' }, { data: 'Finished' }]);
    server.on('beginTouch', () => [{ data: 3 }]);
    await driver.tap({ x: 1, y: 2 });
    await driver.click({ x: 1, y: 2 }, 2, 0.2);
    await driver.moveMouse({ x: 3, y: 4 }, 0.5);
    await driver.scroll({ x: 1, y: -2 });
    await driver.swipe({ x: 0, y: 0 }, { x: 5, y: 5 }, 1);
    await driver.holdButton({ x: 7, y: 7 }, 2);
    await driver.multipointSwipe([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
    await driver.tilt({ x: 0, y: 1, z: 0 });
    await driver.pressKeys([97, 98]);
    expect(await driver.beginTouch({ x: 1, y: 1 })).toBe(3);
    await driver.keysDown([97]);
    await driver.keyUp(97);
    await driver.resetInput();
    expect(strip(sent(server, 'clickCoordinates')[0])).toEqual({ coordinates: { x: 1, y: 2 }, count: 2, interval: 0.2, wait: true });
    expect(strip(sent(server, 'scroll')[0])).toEqual({ speed: -2, speedHorizontal: 1, duration: 0.1, wait: true });
    expect(strip(sent(server, 'swipe')[1])).toEqual({ start: { x: 7, y: 7 }, end: { x: 7, y: 7 }, duration: 2, wait: true });
    expect(strip(sent(server, 'pressKeyboardKeys')[0])).toEqual({ keyCodes: [97, 98], power: 1, duration: 0.1, wait: true });
    expect(strip(sent(server, 'keysUp')[0])).toEqual({ keyCodes: [97] });
  });

  it('a wrong intermediate frame is a protocol error', async () => {
    const { server, driver } = await setup();
    server.on('swipe', () => [{ data: 'Nope' }, { data: 'Finished' }]);
    await expect(driver.swipe({ x: 0, y: 0 }, { x: 1, y: 1 })).rejects.toBeInstanceOf(AltTesterInvalidServerResponse);
  });

  it('scenes: loadScene waits for "Scene Loaded"; time scale parses Unreal strings', async () => {
    const { server, driver } = await setup();
    server.on('loadScene', () => [{ data: 'Ok' }, { data: 'Scene Loaded' }]);
    server.on('getTimeScale', () => [{ data: '0.5' }]);
    server.on('getAllScenes', () => [{ data: ['A', 'B'] }]);
    await driver.loadScene('B', false);
    expect(strip(sent(server, 'loadScene')[0])).toEqual({ sceneName: 'B', loadSingle: false });
    expect(await driver.getTimeScale()).toBe(0.5);
    expect(await driver.getAllScenes()).toEqual(['A', 'B']);
  });

  it('static members send altObject null or omit it', async () => {
    const { server, driver } = await setup();
    server.on('callComponentMethodForObject', () => [{ data: 1920 }]);
    server.on('getObjectComponentProperty', () => [{ data: 60 }]);
    expect(await driver.callStaticMethod('UnityEngine.Screen', 'get_width', 'UnityEngine.CoreModule')).toBe(1920);
    expect(await driver.getStaticProperty('UnityEngine.Application', 'targetFrameRate', 'UnityEngine.CoreModule')).toBe(60);
    await driver.setStaticProperty('C', 'p', 'A', { a: 1 });
    expect(sent(server, 'callComponentMethodForObject')[0]).not.toHaveProperty('altObject');
    expect(sent(server, 'getObjectComponentProperty')[0].altObject).toBeNull();
    expect(sent(server, 'setObjectComponentProperty')[0]).toMatchObject({ altObject: null, value: '{"a":1}' });
  });

  it('PlayerPrefs pick the value field from the key type', async () => {
    const { server, driver } = await setup();
    server.on('getKeyPlayerPref', (c) => [{ data: c.keyType === PlayerPrefKeyType.String ? 'x' : '7' }]);
    await driver.setKeyPlayerPref('a', 3);
    await driver.setKeyPlayerPref('b', 1.5);
    await driver.setKeyPlayerPref('c', 'txt');
    expect(sent(server, 'setKeyPlayerPref').map(strip)).toEqual([
      { keyName: 'a', keyType: 1, intValue: 3 },
      { keyName: 'b', keyType: 3, floatValue: 1.5 },
      { keyName: 'c', keyType: 2, stringValue: 'txt' },
    ]);
    expect(await driver.getIntKeyPlayerPref('a')).toBe(7);
    expect(await driver.getStringKeyPlayerPref('c')).toBe('x');
  });

  it('getPNGScreenshot decodes the second frame', async () => {
    const { server, driver } = await setup();
    server.on('getPNGScreenshot', () => [{ data: 'Ok' }, { data: btoa('\x89PNG') }]);
    const bytes = await driver.getPNGScreenshot();
    expect(Array.from(bytes.slice(1))).toEqual([0x50, 0x4e, 0x47]);
  });

  it('highlighted screenshot at coordinates returns the hit object or null', async () => {
    const { server, driver } = await setup();
    const shot = { textureSize: { x: 1, y: 1, z: 0 }, scaleDifference: { x: 1, y: 1 }, compressedImage: 'AA==' };
    server.on('hightlightObjectFromCoordinatesScreenshot', () => [{ data: cube }, { data: 'Ok' }, { data: shot }]);
    const r = await driver.getHighlightedScreenshotAt({ x: 1, y: 1 });
    expect(r.object?.id).toBe(42);
    expect(r.screenshot).toEqual(shot);
    server.on('hightlightObjectFromCoordinatesScreenshot', () => [{ data: { name: 'Null', id: 0 } }, { data: 'Ok' }, { data: shot }]);
    expect((await driver.getHighlightedScreenshotAt({ x: 1, y: 1 })).object).toBeNull();
  });

  it('delayAfterCommand pauses between commands', async () => {
    const { driver } = await setup();
    driver.setDelayAfterCommand(0.05);
    const started = Date.now();
    await driver.setTimeScale(1);
    await driver.setTimeScale(1);
    expect(Date.now() - started).toBeGreaterThanOrEqual(45);
  });
});

describe('binding AltDriver: notifications', () => {
  it('activates on the first listener, parses payloads, deactivates on remove', async () => {
    const { server, driver } = await setup();
    const loads = vi.fn();
    const logs = vi.fn();
    await driver.addNotificationListener(NotificationType.LOADSCENE, loads);
    await driver.addNotificationListener(NotificationType.LOG, logs);
    await driver.addNotificationListener(NotificationType.LOG, logs, false);
    expect(sent(server, 'activateNotification').map((c) => c.notificationType)).toEqual([0, 2]);
    server.last().notify('loadSceneNotification', { sceneName: 'Game', loadSceneMode: 1 });
    server.last().notify('logNotification', { message: 'hi', stack_trace: 'at x', level: 2 });
    await flush();
    expect(loads).toHaveBeenCalledWith({ sceneName: 'Game', loadSceneMode: 1 });
    expect(logs).toHaveBeenCalledTimes(2);
    expect(logs).toHaveBeenCalledWith({ message: 'hi', stackTrace: 'at x', level: 2 });
    await driver.removeNotificationListener(NotificationType.LOADSCENE);
    expect(sent(server, 'deactivateNotification').map((c) => c.notificationType)).toEqual([0]);
    server.last().notify('loadSceneNotification', { sceneName: 'Other', loadSceneMode: 0 });
    await flush();
    expect(loads).toHaveBeenCalledTimes(1);
  });
});
