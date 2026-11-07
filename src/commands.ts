// Typed wrappers for the commands the inspector uses. Method names are the wire commandNames
// (including the "hightlight" typo). Defaults follow AltTester Desktop; see docs/research/protocol.md.

import { AltError, type AltSocket, type CommandKind } from './AltSocket';
import { isCommandAvailable, isUnavailable, UNAVAILABLE, type GameEngine, type Unavailable } from './engine';
import {
  By,
  Selection,
  type AltColor,
  type AltComponent,
  type AltObject,
  type AltObjectLight,
  type AltProperty,
  type AltVector2,
  type ScreenshotPayload,
} from './types';

export const HIGHLIGHT_COLOR: AltColor = { r: 1, g: 0, b: 0, a: 1 };
export const HIGHLIGHT_WIDTH = 1.05;
export const SCREENSHOT_QUALITY = 100;
const SIZE_IGNORED: AltVector2 = { x: 0, y: 0 };
const ALL_PATH = '//*';

export const ALTID = {
  component: 'AltTester.AltTesterUnitySDK.AltId',
  property: 'altID',
  assembly: 'AltTester.AltTesterUnitySDK',
  maxDepth: 1,
} as const;

export interface HighlightAtResult {
  /** null when nothing was hit (the app sends {name:"Null", id:0}). */
  object: AltObject | null;
  screenshot: ScreenshotPayload;
}

export class AltDriver {
  private _camera: string | null = null;

  constructor(
    private readonly socket: AltSocket,
    readonly engine: GameEngine,
  ) {}

  /** Camera used by find-type commands; null means all cameras. */
  get camera(): string | null {
    return this._camera;
  }

  setCamera(name: string | null): void {
    this._camera = name || null;
  }

  // ---- hierarchy and objects ----

  /** Flat depth-first rows; `enabled: true` returns active objects only. */
  getAllLoadedScenesAndObjects(enabled = true): Promise<AltObjectLight[]> {
    return this.send('getAllLoadedScenesAndObjects', this.findParams(ALL_PATH, enabled));
  }

  /** Finds an object by id (pass transformId for UIToolkit elements, as Desktop does). */
  findObject(id: number, enabled = true): Promise<AltObject> {
    return this.send('findObject', this.findParams(`//*[@id=${id}]`, enabled));
  }

  async findObjectAtCoordinates(coordinates: AltVector2): Promise<AltObject | null> {
    return (await this.send<AltObject | null>('findObjectAtCoordinates', { coordinates })) ?? null;
  }

  getAllActiveCameras(): Promise<AltObject[]> {
    return this.send('getAllActiveCameras');
  }

  // ---- screenshots ----

  getScreenshot(quality = SCREENSHOT_QUALITY): Promise<ScreenshotPayload> {
    return this.send('getScreenshot', { size: SIZE_IGNORED, quality }, { responses: 2 });
  }

  hightlightObjectScreenshot(
    altObjectId: number,
    color: AltColor = HIGHLIGHT_COLOR,
    width = HIGHLIGHT_WIDTH,
    quality = SCREENSHOT_QUALITY,
  ): Promise<ScreenshotPayload> {
    return this.send('hightlightObjectScreenshot', { altObjectId, color, width, size: SIZE_IGNORED, quality }, { responses: 2 });
  }

  /** Repeated calls at the same point cycle through stacked hits (app-side state). */
  hightlightObjectFromCoordinatesScreenshot(
    coordinates: AltVector2,
    color: AltColor = HIGHLIGHT_COLOR,
    width = HIGHLIGHT_WIDTH,
    quality = SCREENSHOT_QUALITY,
  ): Promise<HighlightAtResult> {
    return this.send(
      'hightlightObjectFromCoordinatesScreenshot',
      { coordinates, color, width, size: SIZE_IGNORED, quality },
      {
        responses: 3,
        select: (frames) => {
          const hit = frames[0] as AltObject | null;
          const object = hit && !(hit.name === 'Null' && hit.id === 0) ? hit : null;
          return { object, screenshot: frames[2] as ScreenshotPayload };
        },
      },
    );
  }

  // ---- object details ----

  getAllComponents(altObjectId: number): Promise<AltComponent[]> {
    return this.send('getAllComponents', { altObjectId });
  }

  getAllProperties(altObjectId: number, altComponent: AltComponent, selection: Selection = Selection.ALL): Promise<AltProperty[]> {
    return this.send('getAllProperties', { altObjectId, altComponent, altPropertiesSelections: selection });
  }

  /** Unity only. */
  getAllFields(
    altObjectId: number,
    altComponent: AltComponent,
    selection: Selection = Selection.ALL,
  ): Promise<AltProperty[] | Unavailable> {
    return this.sendOptional('getAllFields', { altObjectId, altComponent, altFieldsSelections: selection });
  }

  getAllMethods(altComponent: AltComponent, selection: Selection = Selection.ALL): Promise<string[]> {
    return this.send('getAllMethods', { altComponent, methodSelection: selection });
  }

  /** UI Toolkit elements; Unity only. */
  getAllVisualElementProperty(altObject: AltObject): Promise<Record<string, unknown> | Unavailable> {
    return this.sendOptional('getAllVisualElementProperty', { altObject });
  }

  getObjectComponentProperty<T = unknown>(
    altObject: AltObject,
    component: string,
    property: string,
    assembly: string,
    maxDepth = 1,
  ): Promise<T | Unavailable> {
    return this.sendOptional('getObjectComponentProperty', { altObject, component, property, assembly, maxDepth });
  }

  /**
   * The object's AltId, or null when it has none (Unity: componentNotFound/propertyNotFound;
   * Unreal answers "-1"). Unreal supports the altID property through its own UAltIdComponent.
   */
  async getAltId(altObject: AltObject): Promise<string | null | Unavailable> {
    try {
      const v = await this.getObjectComponentProperty<unknown>(altObject, ALTID.component, ALTID.property, ALTID.assembly, ALTID.maxDepth);
      if (isUnavailable(v)) return UNAVAILABLE;
      if (v == null || typeof v === 'object' || v === '' || v === '-1') return null;
      return String(v);
    } catch (e) {
      if (e instanceof AltError && (e.type === 'componentNotFound' || e.type === 'propertyNotFound')) return null;
      throw e;
    }
  }

  getText(altObject: AltObject): Promise<string> {
    return this.send('getText', { altObject });
  }

  setText(altObject: AltObject, value: string, submit = true): Promise<AltObject> {
    return this.send('setText', { altObject, value, submit }, { kind: 'input' });
  }

  // ---- input ----

  async tapCoordinates(coordinates: AltVector2, count = 1, interval = 0.1, wait = true): Promise<void> {
    await this.send('tapCoordinates', { coordinates, count, interval, wait }, { kind: 'input', responses: wait ? 2 : 1 });
  }

  /** Returns the finger id. */
  beginTouch(coordinates: AltVector2): Promise<number> {
    return this.send('beginTouch', { coordinates }, { kind: 'input' });
  }

  async moveTouch(fingerId: number, coordinates: AltVector2): Promise<void> {
    await this.send('moveTouch', { fingerId, coordinates }, { kind: 'input' });
  }

  async endTouch(fingerId: number): Promise<void> {
    await this.send('endTouch', { fingerId }, { kind: 'input' });
  }

  async pressKeyboardKeys(keyCodes: number[], power = 1, duration = 0.1, wait = true): Promise<void> {
    await this.send(
      'pressKeyboardKeys',
      { keyCodes, power, duration, wait },
      { kind: 'input', responses: wait ? 1 + keyCodes.length : 1 },
    );
  }

  // ---- time ----

  async setTimeScale(timeScale: number): Promise<void> {
    await this.send('setTimeScale', { timeScale }, { kind: 'input' });
  }

  getTimeScale(): Promise<number> {
    return this.send('getTimeScale');
  }

  // ---- internals ----

  /** path, cameraBy and cameraPath are always non-null: AltServer reads them outside try/catch. */
  private findParams(path: string, enabled: boolean): Record<string, unknown> {
    return { path, cameraBy: By.NAME, cameraPath: this._camera ? `//${this._camera}` : ALL_PATH, enabled };
  }

  private send<T>(
    commandName: string,
    params?: Record<string, unknown>,
    opts: { kind?: CommandKind; responses?: number; select?: (frames: unknown[]) => T } = {},
  ): Promise<T> {
    return this.socket.send<T>({ commandName, params, ...opts });
  }

  /** Resolves UNAVAILABLE without sending when the engine lacks the command, or on invalidCommand. */
  private async sendOptional<T>(commandName: string, params: Record<string, unknown>): Promise<T | Unavailable> {
    if (!isCommandAvailable(this.engine, commandName)) return UNAVAILABLE;
    try {
      return await this.send<T>(commandName, params);
    } catch (e) {
      if (e instanceof AltError && e.type === 'invalidCommand') return UNAVAILABLE;
      throw e;
    }
  }
}
