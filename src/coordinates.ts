// Coordinate mapping (KTD9, KTD12). The shared space is device screen pixels, origin top-left.
// The game occupies `gameRect` inside the device screen. Unity input coordinates are bottom-left
// within the game; Unreal's are top-left. Unknown engines default to top-left (no flip).

import type { GameEngine } from './engine';
import type { AltVector2 } from './types';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

/** A point on the displayed (scaled) image -> device pixels of the screenshot texture. */
export function displayToDevice(point: AltVector2, displaySize: Size, textureSize: AltVector2): AltVector2 {
  return {
    x: (point.x * textureSize.x) / displaySize.width,
    y: (point.y * textureSize.y) / displaySize.height,
  };
}

const flipsY = (engine: GameEngine) => engine === 'unity';

/** Device pixels -> game input coordinates; null when the point is outside the game rect (edges inclusive). */
export function deviceToGame(point: AltVector2, gameRect: Rect, engine: GameEngine): AltVector2 | null {
  const x = point.x - gameRect.x;
  const yTop = point.y - gameRect.y;
  if (x < 0 || yTop < 0 || x > gameRect.width || yTop > gameRect.height) return null;
  return { x, y: flipsY(engine) ? gameRect.height - yTop : yTop };
}

/** Game coordinates (e.g. an AltObject's x/y) -> device pixels, for drawing. */
export function gameToDevice(point: AltVector2, gameRect: Rect, engine: GameEngine): AltVector2 {
  const yTop = flipsY(engine) ? gameRect.height - point.y : point.y;
  return { x: point.x + gameRect.x, y: yTop + gameRect.y };
}
