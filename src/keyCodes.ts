// Browser KeyboardEvent.code -> Unity KeyCode int (UnityEngine.KeyCode / AltKeyCode).

const MAP = new Map<string, number>([
  ['Backspace', 8],
  ['Tab', 9],
  ['Enter', 13],
  ['NumpadEnter', 13],
  ['Escape', 27],
  ['Space', 32],
  ['Delete', 127],
  ['ArrowUp', 273],
  ['ArrowDown', 274],
  ['ArrowRight', 275],
  ['ArrowLeft', 276],
  ['Home', 278],
  ['End', 279],
  ['PageUp', 280],
  ['PageDown', 281],
  ['ShiftRight', 303],
  ['ShiftLeft', 304],
  ['ControlRight', 305],
  ['ControlLeft', 306],
  ['AltRight', 307],
  ['AltLeft', 308],
]);
for (let i = 0; i <= 9; i++) MAP.set(`Digit${i}`, 48 + i);
for (let i = 0; i < 26; i++) MAP.set(`Key${String.fromCharCode(65 + i)}`, 97 + i);
for (let i = 1; i <= 12; i++) MAP.set(`F${i}`, 281 + i);

/** Returns undefined for keys the inspector does not forward. */
export function keyCodeFor(code: string): number | undefined {
  return MAP.get(code);
}
