// Engine capability table. The Unreal SDK never replies to a command it does not know, which would
// stall the one-in-flight queue, so Unity-only commands are never sent unless the app is known Unity.

export type GameEngine = 'unity' | 'unreal' | 'unknown';

export interface Unavailable {
  unavailable: true;
}

export const UNAVAILABLE: Unavailable = Object.freeze({ unavailable: true as const });

export function isUnavailable(v: unknown): v is Unavailable {
  return typeof v === 'object' && v !== null && (v as { unavailable?: unknown }).unavailable === true;
}

/** Maps the app-list GameEngine tag ("UNITY", "UNREAL", "UNKNOWN", "unknown", ...) to a GameEngine. */
export function normalizeEngine(tag: string | null | undefined): GameEngine {
  const t = (tag ?? '').trim().toLowerCase();
  return t === 'unity' || t === 'unreal' ? t : 'unknown';
}

/** Commands the Unreal SDK does not implement (AltTesterRuntimeHandler.cpp). */
const UNITY_ONLY = new Set(['getAllFields', 'getAllVisualElementProperty', 'findObjectsLight', 'getAllCameras']);

/** Unknown engines are treated like Unreal: we cannot rule out an app that never replies. */
export function isCommandAvailable(engine: GameEngine, commandName: string): boolean {
  return engine === 'unity' || !UNITY_ONLY.has(commandName);
}
