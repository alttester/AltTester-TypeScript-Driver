// An object in the app, with methods that act on it (Python altobject.py, C# Common/AltObject.cs).
// All methods are async. `toJSON()` gives exactly the 14 wire fields, so an AltObject can be passed
// anywhere the protocol expects `altObject`.

import { By, Selection, type AltComponent, type AltObject as AltObjectData, type AltProperty, type AltVector2, type AltVector3 } from '../types';
import type { AltDriver } from './AltDriver';
import { pathFromObject } from './paths';

export class AltObject implements AltObjectData {
  readonly name: string;
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly mobileY: number;
  readonly type: string;
  readonly enabled: boolean;
  readonly worldX: number;
  readonly worldY: number;
  readonly worldZ: number;
  readonly idCamera: number;
  readonly transformParentId: number;
  readonly transformId: number;

  constructor(
    private readonly driver: AltDriver,
    data: Partial<AltObjectData> & { iD?: number },
  ) {
    this.name = data.name ?? '';
    // The Unreal SDK serialises some ids as "iD" (protocol.md correction 15).
    this.id = data.id ?? data.iD ?? 0;
    this.x = data.x ?? 0;
    this.y = data.y ?? 0;
    this.z = data.z ?? 0;
    this.mobileY = data.mobileY ?? 0;
    this.type = data.type ?? '';
    this.enabled = data.enabled ?? true;
    this.worldX = data.worldX ?? 0;
    this.worldY = data.worldY ?? 0;
    this.worldZ = data.worldZ ?? 0;
    this.idCamera = data.idCamera ?? 0;
    this.transformParentId = data.transformParentId ?? 0;
    this.transformId = data.transformId ?? 0;
  }

  toJSON(): AltObjectData {
    return {
      name: this.name,
      id: this.id,
      x: this.x,
      y: this.y,
      z: this.z,
      mobileY: this.mobileY,
      type: this.type,
      enabled: this.enabled,
      worldX: this.worldX,
      worldY: this.worldY,
      worldZ: this.worldZ,
      idCamera: this.idCamera,
      transformParentId: this.transformParentId,
      transformId: this.transformId,
    };
  }

  // ---- position and refresh ----

  getScreenPosition(): AltVector2 {
    return { x: this.x, y: this.y };
  }

  getWorldPosition(): AltVector3 {
    return { x: this.worldX, y: this.worldY, z: this.worldZ };
  }

  /** Fetches the object again by id (fresh position, enabled state, ...). */
  async updateObject(): Promise<AltObject> {
    return this.driver.findObject(By.ID, this.id);
  }

  async getParent(): Promise<AltObject> {
    return this.driver.findObject(By.PATH, `//*[@id=${this.id}]/..`);
  }

  /** Finds a descendant of this object. */
  async findObjectFromObject(by: By, value: string | number, cameraBy: By = By.NAME, cameraValue = '', enabled = true): Promise<AltObject> {
    return this.driver.findObject(By.PATH, pathFromObject(this.id, by, value), cameraBy, cameraValue, enabled);
  }

  // ---- components ----

  async getComponentProperty<T = unknown>(componentName: string, propertyName: string, assemblyName: string, maxDepth = 2): Promise<T> {
    return this.driver._send<T>('getObjectComponentProperty', {
      altObject: this.toJSON(),
      component: componentName,
      property: propertyName,
      assembly: assemblyName,
      maxDepth,
    });
  }

  /** `value` is sent JSON-encoded, as the bindings do. Returns the app's reply ("valueSet"). */
  async setComponentProperty(componentName: string, propertyName: string, assemblyName: string, value: unknown): Promise<string> {
    return this.driver._send<string>(
      'setObjectComponentProperty',
      { altObject: this.toJSON(), component: componentName, property: propertyName, assembly: assemblyName, value: JSON.stringify(value) },
      { input: true },
    );
  }

  async callComponentMethod<T = unknown>(
    componentName: string,
    methodName: string,
    assemblyName: string,
    parameters: readonly unknown[] = [],
    typeOfParameters: readonly string[] = [],
  ): Promise<T> {
    return this.driver._callMethod<T>(this, componentName, methodName, assemblyName, parameters, typeOfParameters);
  }

  /**
   * Polls a component property until it equals `propertyValue` (Python wait_for_component_property).
   * With `getPropertyAsString`, compares string forms with whitespace removed.
   */
  async waitForComponentProperty<T = unknown>(
    componentName: string,
    propertyName: string,
    propertyValue: T,
    assemblyName: string,
    timeout?: number,
    interval = 0.5,
    getPropertyAsString = false,
    maxDepth = 2,
  ): Promise<T> {
    return this.driver._waitForValue<T>(
      () => this.getComponentProperty<T>(componentName, propertyName, assemblyName, maxDepth),
      propertyValue,
      getPropertyAsString,
      timeout,
      interval,
      `component: ${componentName} and property ${propertyName}`,
      propertyName,
    );
  }

  async getAllComponents(): Promise<AltComponent[]> {
    return this.driver._send('getAllComponents', { altObjectId: this.id });
  }

  async getAllProperties(altComponent: AltComponent, selection: Selection = Selection.ALL): Promise<AltProperty[]> {
    return this.driver._send('getAllProperties', { altObjectId: this.id, altComponent, altPropertiesSelections: selection });
  }

  /** Unity only. */
  async getAllFields(altComponent: AltComponent, selection: Selection = Selection.ALL): Promise<AltProperty[]> {
    return this.driver._send('getAllFields', { altObjectId: this.id, altComponent, altFieldsSelections: selection });
  }

  async getAllMethods(altComponent: AltComponent, selection: Selection = Selection.ALL): Promise<string[]> {
    return this.driver._send('getAllMethods', { altComponent, methodSelection: selection });
  }

  // ---- text ----

  async getText(): Promise<string> {
    return this.driver._send('getText', { altObject: this.toJSON() });
  }

  async setText(text: string, submit = false): Promise<AltObject> {
    return this.driver._object(await this.driver._send('setText', { altObject: this.toJSON(), value: text, submit }, { input: true }));
  }

  // ---- input on the object ----

  async tap(count = 1, interval = 0.1, wait = true): Promise<AltObject> {
    return this.elementAction('tapElement', count, interval, wait);
  }

  async click(count = 1, interval = 0.1, wait = true): Promise<AltObject> {
    return this.elementAction('clickElement', count, interval, wait);
  }

  /** Unity only. */
  async pointerUp(): Promise<AltObject> {
    return this.pointer('pointerUpFromObject');
  }

  /** Unity only. */
  async pointerDown(): Promise<AltObject> {
    return this.pointer('pointerDownFromObject');
  }

  /** Unity only. */
  async pointerEnter(): Promise<AltObject> {
    return this.pointer('pointerEnterObject');
  }

  /** Unity only. */
  async pointerExit(): Promise<AltObject> {
    return this.pointer('pointerExitObject');
  }

  // ---- UI Toolkit (Unity only) ----

  async getVisualElementProperty<T = unknown>(propertyName: string): Promise<T> {
    return this.driver._send<T>('getVisualElementProperty', { altObject: this.toJSON(), property: propertyName });
  }

  async waitForVisualElementProperty<T = unknown>(
    propertyName: string,
    propertyValue: T,
    timeout?: number,
    interval = 0.5,
    getPropertyAsString = false,
  ): Promise<T> {
    return this.driver._waitForValue<T>(
      () => this.getVisualElementProperty<T>(propertyName),
      propertyValue,
      getPropertyAsString,
      timeout,
      interval,
      `visual element property ${propertyName}`,
      propertyName,
    );
  }

  async getAllVisualElementProperties(): Promise<Record<string, unknown>> {
    return this.driver._send('getAllVisualElementProperty', { altObject: this.toJSON() });
  }

  // ---- internals ----

  private async elementAction(commandName: 'tapElement' | 'clickElement', count: number, interval: number, wait: boolean): Promise<AltObject> {
    const data = await this.driver._send<AltObjectData>(
      commandName,
      { altObject: this.toJSON(), count, interval, wait },
      { input: true, responses: wait ? 2 : 1, expect: [undefined, 'Finished'], resultIndex: 0 },
    );
    return this.driver._object(data);
  }

  private async pointer(commandName: string): Promise<AltObject> {
    return this.driver._object(await this.driver._send(commandName, { altObject: this.toJSON() }, { input: true }));
  }
}
