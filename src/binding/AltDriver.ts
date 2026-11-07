// The AltTester driver binding for TypeScript/JavaScript: same API as the Python, C# and Java bindings,
// in camelCase and async. Times and durations are in seconds, as in the other bindings and on the wire.
//
//   const driver = await AltDriver.connect({ host: '127.0.0.1', port: 13000, appName: 'MyGame' });
//   const button = await driver.waitForObject(By.NAME, 'StartButton');
//   await button.tap();
//   await driver.stop();
//
// Differences from the other bindings, on purpose:
// - Async everywhere; `AltDriver.connect()` replaces the constructor.
// - Commands an Unreal app does not implement throw InvalidCommandException at once instead of waiting
//   for a reply that never comes (the Unreal SDK ignores unknown commands).
// - getApplicationScreenSize uses the getApplicationScreenSize command (as C# does), so it works on Unreal.

import { AltSocket } from '../AltSocket';
import type { CloseInfo } from '../closeCodes';
import { isCommandAvailable, type GameEngine } from '../engine';
import {
  AltConnectionError,
  AltTesterInvalidServerResponse,
  ConnectionTimeoutException,
  createConnectionError,
  InvalidCommandException,
  InvalidParameterValueException,
  NotFoundException,
  WaitTimeOutException,
} from '../errors';
import { checkSdkVersion } from '../sdkVersions';
import type { WebSocketCtor } from '../socketTypes';
import {
  By,
  type AltColor,
  type AltObject as AltObjectData,
  type AltObjectLight,
  type AltVector2,
  type AltVector3,
  type ScreenshotPayload,
} from '../types';
import { AltObject } from './AltObject';
import { AltLogger, AltLogLevel, NotificationType, PlayerPrefKeyType } from './enums';
import { resolveLogger, type AltDriverLogger } from './logger';
import { pathContains, pathFor } from './paths';
import { base64ToBytes, chooseWebSocket, sleep, writeFileNode } from './runtime';
import { BINDING_VERSION } from './version';

export interface AltDriverOptions {
  /** Default "127.0.0.1". */
  host?: string;
  /** Default 13000. */
  port?: number;
  /** Default "__default__" (the server picks the only connected app). */
  appName?: string;
  /** wss:// instead of ws:// (default false). */
  secureMode?: boolean;
  /** Seconds to keep trying to connect (default 60). Retries while no app is connected yet. */
  connectTimeout?: number;
  platform?: string;
  platformVersion?: string;
  deviceInstanceId?: string;
  appId?: string;
  /** Sent to AltServer as driverType; the part before "_" is the driver kind (default "typescript_<version>"). */
  driverType?: string;
  /** true logs to the console; or pass a logger with debug/info/warn/error. Default off. */
  enableLogging?: boolean | AltDriverLogger;
  /**
   * The app's engine. "auto" (default) infers it from the SDK version: Unreal SDKs are 1.x, Unity SDKs 2.x.
   * On "unreal", Unity-only commands throw InvalidCommandException without being sent.
   */
  engine?: GameEngine | 'auto';
  /** Seconds to wait for each command's reply (default 60). */
  commandResponseTimeout?: number;
  /** Reconnect when the app disconnects (4002) or the socket drops (1006), as the Python binding does (default true). */
  autoReconnect?: boolean;
  /** Node only: accept a self-signed certificate in secure mode (default false). */
  allowSelfSigned?: boolean;
  /** Override the WebSocket implementation (default: `ws` in Node, the global WebSocket in browsers). */
  WebSocketImpl?: WebSocketCtor;
}

export interface LoadSceneNotificationResult {
  sceneName: string;
  loadSceneMode: number;
}

export interface LogNotificationResult {
  message: string;
  stackTrace: string;
  level: number;
}

export interface NotificationResults {
  [NotificationType.LOADSCENE]: LoadSceneNotificationResult;
  [NotificationType.UNLOADSCENE]: string;
  [NotificationType.LOG]: LogNotificationResult;
  [NotificationType.APPLICATION_PAUSED]: boolean;
}

export interface HighlightedScreenshotAt {
  /** The object under the point, or null when nothing was hit. */
  object: AltObject | null;
  screenshot: ScreenshotPayload;
}

/** @internal Options for one command. */
export interface SendOptions {
  /** Input commands are never retried. */
  input?: boolean;
  /** Response frames this command produces (default 1). */
  responses?: number;
  /** Expected string value per frame (undefined = anything). Mismatch throws AltTesterInvalidServerResponse. */
  expect?: readonly (string | undefined)[];
  /** Which frame is the result (default the last one). */
  resultIndex?: number;
}

const NOTIFICATION_NAMES: Record<NotificationType, string> = {
  [NotificationType.LOADSCENE]: 'loadSceneNotification',
  [NotificationType.UNLOADSCENE]: 'unloadSceneNotification',
  [NotificationType.LOG]: 'logNotification',
  [NotificationType.APPLICATION_PAUSED]: 'applicationPausedNotification',
};

/** Close codes worth retrying while connecting: unreachable, not registered, no app yet, app gone, busy. */
const RETRYABLE_KINDS = new Set(['unreachable', 'notRegistered', 'noAppConnected', 'appDisconnected', 'concurrentConnect', 'unknown']);
const RECONNECT_CODES = new Set([4002, 1006]);
const DEFAULT_WAIT_TIMEOUT = 20;
const ALL_PATH = '//*';

function unquote(v: unknown): unknown {
  return typeof v === 'string' ? v.replace(/^"+|"+$/g, '') : v;
}

function sdkMajor(version: string): number {
  const n = parseInt(String(unquote(version)).trim().split('.')[0] ?? '', 10);
  return Number.isNaN(n) ? -1 : n;
}

function toNumber(v: unknown, what: string): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (Number.isNaN(n)) throw new AltTesterInvalidServerResponse(`a number for ${what}`, v);
  return n;
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export class AltDriver {
  private socket!: AltSocket;
  private reconnecting: Promise<void> | null = null;
  private stopped = false;
  private _engine: GameEngine = 'unknown';
  private implicitTimeout = -1;
  private commandTimeoutMs: number;
  private delayAfterCommand = 0;
  private readonly logger: AltDriverLogger;
  private readonly listeners = new Map<NotificationType, ((result: never) => void)[]>();

  private constructor(
    private readonly options: AltDriverOptions,
    private readonly WebSocketImpl: WebSocketCtor,
  ) {
    this.logger = resolveLogger(options.enableLogging);
    this.commandTimeoutMs = (options.commandResponseTimeout ?? 60) * 1000;
  }

  /** Connects to AltServer and the app; retries until `connectTimeout` (default 60 s). */
  static async connect(options: AltDriverOptions = {}): Promise<AltDriver> {
    const Impl = options.WebSocketImpl ?? (await chooseWebSocket({ allowSelfSigned: options.allowSelfSigned }));
    const driver = new AltDriver(options, Impl);
    driver.socket = await driver.openWithRetry();
    driver.detectEngine();
    driver.checkVersion();
    return driver;
  }

  // ---- connection and settings ----

  /** The app's engine as configured or inferred at connect. */
  get engine(): GameEngine {
    return this._engine;
  }

  /** True while the app reports it is in the background (needs the APPLICATION_PAUSED listener). */
  get paused(): boolean {
    return this.socket.paused;
  }

  async getServerVersion(): Promise<string> {
    return String(unquote(await this._send<string>('getServerVersion')));
  }

  /** Closes the connection. The driver cannot be used afterwards. */
  async stop(): Promise<void> {
    this.stopped = true;
    this.socket.close();
  }

  /** Seconds to wait for each command's reply. */
  getCommandResponseTimeout(): number {
    return this.commandTimeoutMs / 1000;
  }

  setCommandResponseTimeout(seconds: number): void {
    this.commandTimeoutMs = seconds * 1000;
    this.socket.commandTimeoutMs = this.commandTimeoutMs;
  }

  /** Seconds to pause after each command. */
  getDelayAfterCommand(): number {
    return this.delayAfterCommand;
  }

  setDelayAfterCommand(seconds: number): void {
    this.delayAfterCommand = Math.max(0, seconds);
  }

  /** Timeout used by the wait* helpers when the caller passes none; -1 means their own default (20 s). */
  getImplicitTimeout(): number {
    return this.implicitTimeout;
  }

  setImplicitTimeout(seconds: number): void {
    if (seconds < 0) throw new InvalidParameterValueException('Timeout cannot be negative.');
    this.implicitTimeout = seconds;
  }

  /** Unity only. */
  async setServerLogging(logger: AltLogger, logLevel: AltLogLevel): Promise<void> {
    await this._send('setServerLogging', { logger, logLevel }, { input: true, expect: ['Ok'] });
  }

  // ---- find ----

  async findObject(by: By, value: string | number, cameraBy: By = By.NAME, cameraValue = '', enabled = true): Promise<AltObject> {
    return this._object(await this._send('findObject', this.findParams(pathFor(by, value), cameraBy, cameraValue, enabled)));
  }

  async findObjects(by: By, value: string | number, cameraBy: By = By.NAME, cameraValue = '', enabled = true): Promise<AltObject[]> {
    return this._objects(await this._send('findObjects', this.findParams(pathFor(by, value), cameraBy, cameraValue, enabled)));
  }

  async findObjectWhichContains(by: By, value: string | number, cameraBy: By = By.NAME, cameraValue = '', enabled = true): Promise<AltObject> {
    return this._object(await this._send('findObject', this.findParams(pathContains(by, value), cameraBy, cameraValue, enabled)));
  }

  async findObjectsWhichContain(by: By, value: string | number, cameraBy: By = By.NAME, cameraValue = '', enabled = true): Promise<AltObject[]> {
    return this._objects(await this._send('findObjects', this.findParams(pathContains(by, value), cameraBy, cameraValue, enabled)));
  }

  /** The object at screen coordinates, or null. */
  async findObjectAtCoordinates(coordinates: AltVector2): Promise<AltObject | null> {
    const data = await this._send<AltObjectData | null>('findObjectAtCoordinates', { coordinates });
    return data ? this._object(data) : null;
  }

  /** Every object in the loaded scenes, DontDestroyOnLoad included. */
  async getAllElements(cameraBy: By = By.NAME, cameraValue = '', enabled = true): Promise<AltObject[]> {
    return this.findObjects(By.PATH, ALL_PATH, cameraBy, cameraValue, enabled);
  }

  /** Like getAllElements with fewer fields per object. Unity only. */
  async getAllElementsLight(cameraBy: By = By.NAME, cameraValue = '', enabled = true): Promise<AltObjectLight[]> {
    return this._send('findObjectsLight', this.findParams(ALL_PATH, cameraBy, cameraValue, enabled));
  }

  /** Scene marker rows (`id 0`) followed by each scene's objects, depth first. */
  async getAllLoadedScenesAndObjects(enabled = true): Promise<AltObjectLight[]> {
    const rows = await this._send<(AltObjectLight & { iD?: number })[]>('getAllLoadedScenesAndObjects', this.findParams(ALL_PATH, By.NAME, '', enabled));
    return rows.map(({ iD, ...r }) => ({ ...r, id: r.id ?? iD ?? 0, type: r.type ?? '' }));
  }

  async waitForObject(by: By, value: string | number, cameraBy: By = By.NAME, cameraValue = '', timeout?: number, interval = 0.5, enabled = true): Promise<AltObject> {
    return this.pollFind(() => this.findObject(by, value, cameraBy, cameraValue, enabled), value, timeout, interval);
  }

  async waitForObjectWhichContains(
    by: By,
    value: string | number,
    cameraBy: By = By.NAME,
    cameraValue = '',
    timeout?: number,
    interval = 0.5,
    enabled = true,
  ): Promise<AltObject> {
    return this.pollFind(() => this.findObjectWhichContains(by, value, cameraBy, cameraValue, enabled), value, timeout, interval);
  }

  async waitForObjectToNotBePresent(
    by: By,
    value: string | number,
    cameraBy: By = By.NAME,
    cameraValue = '',
    timeout?: number,
    interval = 0.5,
    enabled = true,
  ): Promise<void> {
    const limit = this.waitTimeout(timeout);
    const deadline = Date.now() + limit * 1000;
    for (;;) {
      try {
        await this.findObject(by, value, cameraBy, cameraValue, enabled);
      } catch (e) {
        if (e instanceof NotFoundException) return;
        throw e;
      }
      if (Date.now() >= deadline) throw new WaitTimeOutException(`Element ${value} still found after ${limit} seconds`);
      this.logger.debug(`Waiting for element ${value} to not be present...`);
      await sleep(interval);
    }
  }

  // ---- scenes ----

  async getCurrentScene(): Promise<string> {
    const data = await this._send<{ name?: string } | string>('getCurrentScene');
    return typeof data === 'string' ? data : (data?.name ?? '');
  }

  /** Resolves when the app reports "Scene Loaded". */
  async loadScene(sceneName: string, loadSingle = true): Promise<void> {
    await this._send('loadScene', { sceneName, loadSingle }, { input: true, responses: 2, expect: ['Ok', 'Scene Loaded'] });
  }

  /** Unity only. */
  async unloadScene(sceneName: string): Promise<void> {
    await this._send('unloadScene', { sceneName }, { input: true, responses: 2, expect: ['Ok', 'Scene Unloaded'] });
  }

  async getAllLoadedScenes(): Promise<string[]> {
    return this._send('getAllLoadedScenes');
  }

  async getAllScenes(): Promise<string[]> {
    return this._send('getAllScenes');
  }

  async waitForCurrentSceneToBe(sceneName: string, timeout?: number, interval = 1): Promise<string> {
    const limit = this.waitTimeout(timeout);
    const deadline = Date.now() + limit * 1000;
    let current = '';
    for (;;) {
      current = await this.getCurrentScene();
      if (current === sceneName) return current;
      if (Date.now() >= deadline) throw new WaitTimeOutException(`Scene ${sceneName} not loaded after ${limit} seconds`);
      this.logger.debug(`Waiting for scene ${sceneName} (current: ${current})...`);
      await sleep(interval);
    }
  }

  // ---- cameras, screen, time ----

  /** Unity only. */
  async getAllCameras(): Promise<AltObject[]> {
    return this._objects(await this._send('getAllCameras'));
  }

  async getAllActiveCameras(): Promise<AltObject[]> {
    return this._objects(await this._send('getAllActiveCameras'));
  }

  async getApplicationScreenSize(): Promise<AltVector2> {
    return this._send('getApplicationScreenSize');
  }

  async getTimeScale(): Promise<number> {
    // The Unreal SDK sends the number as a string ("1.0").
    return toNumber(await this._send('getTimeScale'), 'getTimeScale');
  }

  async setTimeScale(timeScale: number): Promise<void> {
    await this._send('setTimeScale', { timeScale }, { input: true });
  }

  // ---- screenshots ----

  /** JPEG screenshot (base64 in `compressedImage`). `quality` 1-100. */
  async getScreenshot(quality = 100): Promise<ScreenshotPayload> {
    return this._send('getScreenshot', { size: { x: 0, y: 0 }, quality }, { responses: 2, expect: ['Ok'] });
  }

  /** Screenshot with the object outlined in `color`. */
  async getHighlightedScreenshot(
    object: AltObject | number,
    color: AltColor = { r: 1, g: 0, b: 0, a: 1 },
    width = 1,
    quality = 100,
  ): Promise<ScreenshotPayload> {
    const altObjectId = typeof object === 'number' ? object : object.id;
    return this._send('hightlightObjectScreenshot', { altObjectId, color, width, size: { x: 0, y: 0 }, quality }, { responses: 2, expect: ['Ok'] });
  }

  /** Screenshot with the object under `coordinates` outlined; also returns that object. */
  async getHighlightedScreenshotAt(
    coordinates: AltVector2,
    color: AltColor = { r: 1, g: 0, b: 0, a: 1 },
    width = 1,
    quality = 100,
  ): Promise<HighlightedScreenshotAt> {
    const frames = await this._sendFrames('hightlightObjectFromCoordinatesScreenshot', { coordinates, color, width, size: { x: 0, y: 0 }, quality }, {
      responses: 3,
      expect: [undefined, 'Ok'],
    });
    const hit = frames[0] as AltObjectData | null;
    const object = hit && !(hit.name === 'Null' && hit.id === 0) ? this._object(hit) : null;
    return { object, screenshot: frames[2] as ScreenshotPayload };
  }

  /**
   * Full-resolution screenshot. In Node, also writes it to `path` when given. Returns the image bytes:
   * PNG from Unity; the Unreal SDK (1.2.x) sends JPEG bytes here.
   */
  async getPNGScreenshot(path?: string): Promise<Uint8Array> {
    const data = await this._send<string>('getPNGScreenshot', {}, { responses: 2, expect: ['Ok'] });
    const bytes = base64ToBytes(String(data));
    if (path) await writeFileNode(path, bytes);
    return bytes;
  }

  // ---- input: mouse and touch ----

  async tap(coordinates: AltVector2, count = 1, interval = 0.1, wait = true): Promise<void> {
    await this.inputWithFinish('tapCoordinates', { coordinates, count, interval, wait }, wait);
  }

  async click(coordinates: AltVector2, count = 1, interval = 0.1, wait = true): Promise<void> {
    await this.inputWithFinish('clickCoordinates', { coordinates, count, interval, wait }, wait);
  }

  async moveMouse(coordinates: AltVector2, duration = 0.1, wait = true): Promise<void> {
    await this.inputWithFinish('moveMouse', { coordinates, duration, wait }, wait);
  }

  /** `speed` scrolls vertically; a vector scrolls x horizontally and y vertically. Unity only. */
  async scroll(speed: number | AltVector2 = 1, duration = 0.1, wait = true): Promise<void> {
    const [vertical, horizontal] = typeof speed === 'number' ? [speed, 0] : [speed.y, speed.x];
    await this.inputWithFinish('scroll', { speed: vertical, speedHorizontal: horizontal, duration, wait }, wait);
  }

  async swipe(start: AltVector2, end: AltVector2, duration = 0.1, wait = true): Promise<void> {
    await this.inputWithFinish('swipe', { start, end, duration, wait }, wait);
  }

  async multipointSwipe(positions: readonly AltVector2[], duration = 0.1, wait = true): Promise<void> {
    await this.inputWithFinish('multipointSwipe', { positions, duration, wait }, wait);
  }

  /** Holds the left button / a finger down at `coordinates` for `duration` seconds. */
  async holdButton(coordinates: AltVector2, duration = 0.1, wait = true): Promise<void> {
    await this.swipe(coordinates, coordinates, duration, wait);
  }

  /** Returns the finger id for moveTouch/endTouch. */
  async beginTouch(coordinates: AltVector2): Promise<number> {
    return toNumber(await this._send('beginTouch', { coordinates }, { input: true }), 'beginTouch');
  }

  async moveTouch(fingerId: number, coordinates: AltVector2): Promise<void> {
    await this._send('moveTouch', { fingerId, coordinates }, { input: true, expect: ['Ok'] });
  }

  async endTouch(fingerId: number): Promise<void> {
    await this._send('endTouch', { fingerId }, { input: true, expect: ['Ok'] });
  }

  /** Simulates device acceleration. Unity only. */
  async tilt(acceleration: AltVector3, duration = 0.1, wait = true): Promise<void> {
    await this.inputWithFinish('tilt', { acceleration, duration, wait }, wait);
  }

  /** Releases all simulated input. Unity only. */
  async resetInput(): Promise<void> {
    await this._send('resetInput', {}, { input: true, expect: ['Ok'] });
  }

  // ---- input: keyboard (AltKeyCode values) ----

  async pressKey(keyCode: number, power = 1, duration = 0.1, wait = true): Promise<void> {
    await this.pressKeys([keyCode], power, duration, wait);
  }

  async pressKeys(keyCodes: readonly number[], power = 1, duration = 0.1, wait = true): Promise<void> {
    await this._send(
      'pressKeyboardKeys',
      { keyCodes, power, duration, wait },
      { input: true, responses: wait ? 1 + keyCodes.length : 1, expect: ['Ok', ...keyCodes.map(() => 'Finished')] },
    );
  }

  async keyDown(keyCode: number, power = 1): Promise<void> {
    await this.keysDown([keyCode], power);
  }

  async keysDown(keyCodes: readonly number[], power = 1): Promise<void> {
    await this._send('keysDown', { keyCodes, power }, { input: true, expect: ['Ok'] });
  }

  async keyUp(keyCode: number): Promise<void> {
    await this.keysUp([keyCode]);
  }

  async keysUp(keyCodes: readonly number[]): Promise<void> {
    await this._send('keysUp', { keyCodes }, { input: true, expect: ['Ok'] });
  }

  // ---- static members ----

  /** Calls a static method. `typeName` may include a namespace ("namespace.typeName"). */
  async callStaticMethod<T = unknown>(
    typeName: string,
    methodName: string,
    assemblyName: string,
    parameters: readonly unknown[] = [],
    typeOfParameters: readonly string[] = [],
  ): Promise<T> {
    return this._callMethod<T>(null, typeName, methodName, assemblyName, parameters, typeOfParameters);
  }

  async getStaticProperty<T = unknown>(componentName: string, propertyName: string, assemblyName: string, maxDepth = 2): Promise<T> {
    return this._send<T>('getObjectComponentProperty', { altObject: null, component: componentName, property: propertyName, assembly: assemblyName, maxDepth });
  }

  async setStaticProperty(componentName: string, propertyName: string, assemblyName: string, updatedValue: unknown): Promise<void> {
    await this._send(
      'setObjectComponentProperty',
      { altObject: null, component: componentName, property: propertyName, assembly: assemblyName, value: JSON.stringify(updatedValue) },
      { input: true },
    );
  }

  // ---- PlayerPrefs (Unity only) ----

  async getPlayerPrefKey(keyName: string, keyType: PlayerPrefKeyType): Promise<number | string> {
    return this._send('getKeyPlayerPref', { keyName, keyType });
  }

  async getIntKeyPlayerPref(keyName: string): Promise<number> {
    return toNumber(await this.getPlayerPrefKey(keyName, PlayerPrefKeyType.Int), keyName);
  }

  async getFloatKeyPlayerPref(keyName: string): Promise<number> {
    return toNumber(await this.getPlayerPrefKey(keyName, PlayerPrefKeyType.Float), keyName);
  }

  async getStringKeyPlayerPref(keyName: string): Promise<string> {
    return String(await this.getPlayerPrefKey(keyName, PlayerPrefKeyType.String));
  }

  /** Without `keyType`: strings are String, integers Int, other numbers Float. */
  async setKeyPlayerPref(keyName: string, value: number | string, keyType?: PlayerPrefKeyType): Promise<void> {
    const type = keyType ?? (typeof value === 'string' ? PlayerPrefKeyType.String : Number.isInteger(value) ? PlayerPrefKeyType.Int : PlayerPrefKeyType.Float);
    const field = type === PlayerPrefKeyType.Int ? 'intValue' : type === PlayerPrefKeyType.Float ? 'floatValue' : 'stringValue';
    await this._send('setKeyPlayerPref', { keyName, keyType: type, [field]: type === PlayerPrefKeyType.String ? String(value) : Number(value) }, { input: true, expect: ['Ok'] });
  }

  async deleteKeyPlayerPref(keyName: string): Promise<void> {
    await this._send('deleteKeyPlayerPref', { keyName }, { input: true, expect: ['Ok'] });
  }

  async deletePlayerPref(): Promise<void> {
    await this._send('deletePlayerPref', {}, { input: true, expect: ['Ok'] });
  }

  // ---- notifications ----

  /**
   * Calls `callback` on each notification of `type`. The first listener of a type activates it in the
   * app. `overwrite` (default true, as in Python) replaces the existing listeners of that type.
   * The Unreal SDK accepts this but never sends notifications.
   */
  async addNotificationListener<K extends NotificationType>(
    type: K,
    callback: (result: NotificationResults[K]) => void,
    overwrite = true,
  ): Promise<void> {
    const existing = this.listeners.get(type) ?? [];
    const wasActive = existing.length > 0;
    this.listeners.set(type, overwrite ? [callback as (r: never) => void] : [...existing, callback as (r: never) => void]);
    if (!wasActive) await this._send('activateNotification', { notificationType: type }, { input: true, expect: ['Ok'] });
  }

  /** Removes every listener of `type` and deactivates it in the app. */
  async removeNotificationListener(type: NotificationType): Promise<void> {
    this.listeners.delete(type);
    await this._send('deactivateNotification', { notificationType: type }, { input: true, expect: ['Ok'] });
  }

  // ---- internals shared with AltObject (not public API) ----

  /** @internal */
  async _send<T = unknown>(commandName: string, params: Record<string, unknown> = {}, opts: SendOptions = {}): Promise<T> {
    const frames = await this._sendFrames(commandName, params, opts);
    return frames[opts.resultIndex ?? frames.length - 1] as T;
  }

  /** @internal */
  async _sendFrames(commandName: string, params: Record<string, unknown> = {}, opts: SendOptions = {}): Promise<unknown[]> {
    if (this.stopped) throw new AltConnectionError({ code: 1000, kind: 'normal', message: 'The driver was stopped.', serverReason: '' });
    if (this._engine === 'unreal' && !isCommandAvailable('unreal', commandName)) {
      throw new InvalidCommandException('invalidCommand', `${commandName} is not supported by the AltTester Unreal SDK.`);
    }
    if (this.reconnecting) await this.reconnecting;
    const expect = opts.expect ?? [];
    const frames = await this.socket.send<unknown[]>({
      commandName,
      params,
      kind: opts.input ? 'input' : 'read',
      responses: opts.responses ?? 1,
      select: (frames) => {
        frames.forEach((frame, i) => {
          const want = expect[i];
          if (want !== undefined && unquote(frame) !== want) throw new AltTesterInvalidServerResponse(want, frame);
        });
        return frames;
      },
    });
    if (this.delayAfterCommand > 0) await sleep(this.delayAfterCommand);
    return frames;
  }

  /** @internal */
  _object(data: AltObjectData | null | undefined): AltObject {
    if (!data) throw new NotFoundException('notFound', 'Object not found.');
    return new AltObject(this, data);
  }

  /** @internal */
  _objects(data: AltObjectData[] | null | undefined): AltObject[] {
    return (data ?? []).map((d) => new AltObject(this, d));
  }

  /** @internal */
  async _callMethod<T>(
    altObject: AltObject | null,
    componentName: string,
    methodName: string,
    assemblyName: string,
    parameters: readonly unknown[],
    typeOfParameters: readonly string[],
  ): Promise<T> {
    const params: Record<string, unknown> = {
      component: componentName,
      method: methodName,
      parameters: parameters.map((p) => JSON.stringify(p)),
      typeofparameters: [...typeOfParameters],
      assembly: assemblyName,
    };
    if (altObject) params.altObject = altObject.toJSON();
    return this._send<T>('callComponentMethodForObject', params, { input: true });
  }

  /** @internal Polls `fetch` until it equals `expected` (comparison rules of the Python binding). */
  async _waitForValue<T>(fetch: () => Promise<T>, expected: T, asString: boolean, timeout: number | undefined, interval: number, label: string): Promise<T> {
    const limit = this.waitTimeout(timeout);
    const deadline = Date.now() + limit * 1000;
    const squash = (v: unknown) => String(v).replace(/\s/g, '');
    let lastError: unknown = null;
    let found: unknown;
    for (;;) {
      try {
        found = await fetch();
        lastError = null;
        if (!asString && JSON.stringify(found) === JSON.stringify(expected)) return found as T;
        if (String(found) === '0.0' && String(expected) === '0') return found as T;
        if (asString && (squash(found) === squash(expected) || squash(JSON.stringify(found)) === squash(expected))) return found as T;
      } catch (e) {
        lastError = e;
      }
      if (Date.now() >= deadline) break;
      this.logger.debug(`Waiting for ${label}...`);
      await sleep(interval);
    }
    if (lastError) throw new WaitTimeOutException(`After ${limit} seconds, exception was: ${errorText(lastError)} for ${label}`);
    throw new WaitTimeOutException(`${label} was ${JSON.stringify(found)}, not ${JSON.stringify(expected)} as expected, after ${limit} seconds`);
  }

  // ---- private ----

  private findParams(path: string, cameraBy: By, cameraValue: string, enabled: boolean): Record<string, unknown> {
    // AltServer reads path, cameraBy and cameraPath outside its try/catch: never send them null.
    return { path, cameraBy, cameraPath: pathFor(cameraBy, cameraValue), enabled };
  }

  private waitTimeout(timeout: number | undefined): number {
    if (timeout !== undefined) return timeout;
    return this.implicitTimeout >= 0 ? this.implicitTimeout : DEFAULT_WAIT_TIMEOUT;
  }

  private async pollFind(find: () => Promise<AltObject>, value: string | number, timeout: number | undefined, interval: number): Promise<AltObject> {
    const limit = this.waitTimeout(timeout);
    const deadline = Date.now() + limit * 1000;
    for (;;) {
      try {
        return await find();
      } catch (e) {
        if (!(e instanceof NotFoundException)) throw e;
      }
      if (Date.now() >= deadline) throw new WaitTimeOutException(`Element ${value} not found after ${limit} seconds`);
      this.logger.debug(`Waiting for element ${value}...`);
      await sleep(interval);
    }
  }

  private async inputWithFinish(commandName: string, params: Record<string, unknown>, wait: boolean): Promise<void> {
    await this._send(commandName, params, { input: true, responses: wait ? 2 : 1, expect: ['Ok', 'Finished'] });
  }

  private async openWithRetry(): Promise<AltSocket> {
    const o = this.options;
    const host = o.host ?? '127.0.0.1';
    const port = o.port ?? 13000;
    const limitMs = (o.connectTimeout ?? 60) * 1000;
    const deadline = Date.now() + limitMs;
    let last: AltConnectionError | null = null;
    this.logger.info(`Connecting to AltTester(R) on ${host}:${port}, app "${o.appName ?? '__default__'}".`);
    for (let attempt = 1; ; attempt++) {
      try {
        const socket = await AltSocket.connect({
          host,
          port,
          secure: o.secureMode ?? false,
          appName: o.appName ?? '__default__',
          appId: o.appId,
          platform: o.platform,
          platformVersion: o.platformVersion,
          deviceInstanceId: o.deviceInstanceId,
          driverType: o.driverType ?? `typescript_${BINDING_VERSION}`,
          WebSocketImpl: this.WebSocketImpl,
          commandTimeoutMs: this.commandTimeoutMs,
          maxRetries: 0,
          collapseReads: false,
          startupNotifications: [],
        });
        this.attach(socket);
        this.logger.info(`Connected. AltTester(R) SDK version ${socket.serverVersion}.`);
        return socket;
      } catch (e) {
        if (!(e instanceof AltConnectionError)) throw e;
        last = e;
        if (!RETRYABLE_KINDS.has(e.info.kind)) throw e;
        if (Date.now() >= deadline) break;
        this.logger.debug(`Connect attempt ${attempt} failed (${e.message}); retrying.`);
        await sleep(Math.min(1, Math.max(0, (deadline - Date.now()) / 1000)));
      }
    }
    if (last && last.info.code >= 4000) throw createConnectionError(last.info);
    throw new ConnectionTimeoutException(
      last?.info ?? { code: 0, kind: 'unreachable', message: `Failed to connect to AltTester(R) Server on host: ${host} port: ${port}.`, serverReason: '' },
    );
  }

  private attach(socket: AltSocket): void {
    for (const [type, name] of Object.entries(NOTIFICATION_NAMES)) {
      socket.onNotification(name as never, (data) => this.dispatch(Number(type) as NotificationType, data));
    }
    socket.onClose((info) => this.onSocketClosed(info));
  }

  private onSocketClosed(info: CloseInfo): void {
    if (this.stopped || this.reconnecting || this.options.autoReconnect === false || !RECONNECT_CODES.has(info.code)) return;
    this.logger.warn(`Connection lost (${info.message}); reconnecting.`);
    this.reconnecting = (async () => {
      try {
        this.socket = await this.openWithRetry();
        for (const type of this.listeners.keys()) {
          await this.socket.send({ commandName: 'activateNotification', params: { notificationType: type }, kind: 'input' });
        }
      } catch (e) {
        this.logger.error(`Reconnect failed: ${errorText(e)}`);
      } finally {
        this.reconnecting = null;
      }
    })();
  }

  private dispatch(type: NotificationType, data: unknown): void {
    const callbacks = this.listeners.get(type);
    if (!callbacks?.length) return;
    let result: unknown = data;
    if (type === NotificationType.LOADSCENE) {
      const d = (data ?? {}) as { sceneName?: string; loadSceneMode?: number };
      result = { sceneName: d.sceneName ?? '', loadSceneMode: d.loadSceneMode ?? 0 } satisfies LoadSceneNotificationResult;
    } else if (type === NotificationType.LOG) {
      const d = (data ?? {}) as { message?: string; stack_trace?: string; stackTrace?: string; level?: number };
      result = { message: d.message ?? '', stackTrace: d.stack_trace ?? d.stackTrace ?? '', level: d.level ?? 0 } satisfies LogNotificationResult;
    } else if (type === NotificationType.APPLICATION_PAUSED) {
      result = Boolean(data);
    }
    for (const cb of callbacks) {
      try {
        (cb as (r: unknown) => void)(result);
      } catch (e) {
        this.logger.error(`Notification listener threw: ${errorText(e)}`);
      }
    }
  }

  private detectEngine(): void {
    const chosen = this.options.engine ?? 'auto';
    if (chosen !== 'auto') {
      this._engine = chosen;
      return;
    }
    const major = sdkMajor(this.socket.serverVersion);
    this._engine = major === 1 ? 'unreal' : major >= 2 ? 'unity' : 'unknown';
  }

  private checkVersion(): void {
    const version = String(unquote(this.socket.serverVersion));
    const check = checkSdkVersion(version, this._engine === 'unknown' ? null : this._engine.toUpperCase());
    if (!check.ok) this.logger.warn(check.message);
  }
}
