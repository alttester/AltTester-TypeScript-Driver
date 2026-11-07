// Wire types for the inspector's commands (DRV/Common/*.cs). Enums travel as ints.

export interface AltVector2 {
  x: number;
  y: number;
}

export interface AltVector3 {
  x: number;
  y: number;
  z: number;
}

export interface AltColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface AltObject {
  name: string;
  id: number;
  x: number;
  y: number;
  z: number;
  mobileY: number;
  type: string;
  enabled: boolean;
  worldX: number;
  worldY: number;
  worldZ: number;
  idCamera: number;
  transformParentId: number;
  transformId: number;
}

export interface AltObjectLight {
  name: string;
  id: number;
  enabled: boolean;
  idCamera: number;
  transformParentId: number;
  transformId: number;
  type: string;
}

export interface AltComponent {
  componentName: string;
  assemblyName: string;
}

/** AltPropertyType: 0 PRIMITIVE, 1 OBJECT, 2 ARRAY. */
export type AltPropertyType = 0 | 1 | 2;

export interface AltProperty {
  name: string;
  value: string;
  type: AltPropertyType;
}

/** AltPropertiesSelections / AltFieldsSelections / AltMethodSelection share these values. */
export const Selection = { DECLARED: 0, INHERITED: 1, ALL: 2 } as const;
export type Selection = (typeof Selection)[keyof typeof Selection];

/** The By enum. */
export const By = { TAG: 0, LAYER: 1, NAME: 2, COMPONENT: 3, PATH: 4, ID: 5, TEXT: 6 } as const;
export type By = (typeof By)[keyof typeof By];

export interface ScreenshotPayload {
  textureSize: AltVector3;
  scaleDifference: AltVector2;
  /** Base64 JPEG. */
  compressedImage: string;
}
