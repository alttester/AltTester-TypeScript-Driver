import { describe, expect, it } from 'vitest';
import { keyCodeFor } from './keyCodes';

describe('keyCodeFor', () => {
  it('maps letters, digits, Enter and named keys to Unity KeyCode ints', () => {
    expect(keyCodeFor('KeyA')).toBe(97);
    expect(keyCodeFor('KeyZ')).toBe(122);
    expect(keyCodeFor('Digit0')).toBe(48);
    expect(keyCodeFor('Digit9')).toBe(57);
    expect(keyCodeFor('Enter')).toBe(13);
    expect(keyCodeFor('NumpadEnter')).toBe(13);
    expect(keyCodeFor('Backspace')).toBe(8);
    expect(keyCodeFor('Tab')).toBe(9);
    expect(keyCodeFor('Escape')).toBe(27);
    expect(keyCodeFor('Space')).toBe(32);
    expect(keyCodeFor('Delete')).toBe(127);
    expect(keyCodeFor('ArrowUp')).toBe(273);
    expect(keyCodeFor('ArrowDown')).toBe(274);
    expect(keyCodeFor('ArrowRight')).toBe(275);
    expect(keyCodeFor('ArrowLeft')).toBe(276);
    expect(keyCodeFor('Home')).toBe(278);
    expect(keyCodeFor('End')).toBe(279);
    expect(keyCodeFor('PageUp')).toBe(280);
    expect(keyCodeFor('PageDown')).toBe(281);
    expect(keyCodeFor('F1')).toBe(282);
    expect(keyCodeFor('F12')).toBe(293);
    expect(keyCodeFor('ShiftRight')).toBe(303);
    expect(keyCodeFor('ShiftLeft')).toBe(304);
    expect(keyCodeFor('ControlRight')).toBe(305);
    expect(keyCodeFor('ControlLeft')).toBe(306);
    expect(keyCodeFor('AltRight')).toBe(307);
    expect(keyCodeFor('AltLeft')).toBe(308);
  });

  it('returns undefined for unmapped keys', () => {
    expect(keyCodeFor('MetaLeft')).toBeUndefined();
    expect(keyCodeFor('F13')).toBeUndefined();
    expect(keyCodeFor('')).toBeUndefined();
    expect(keyCodeFor('toString')).toBeUndefined();
  });
});
