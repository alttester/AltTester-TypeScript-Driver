import { describe, expect, it } from 'vitest';
import { isCommandAvailable, isUnavailable, normalizeEngine, UNAVAILABLE } from './engine';

describe('engine', () => {
  it('normalizes GameEngine tags case-insensitively', () => {
    expect(normalizeEngine('UNITY')).toBe('unity');
    expect(normalizeEngine('Unity')).toBe('unity');
    expect(normalizeEngine('UNREAL')).toBe('unreal');
    expect(normalizeEngine(' unreal ')).toBe('unreal');
    expect(normalizeEngine('UNKNOWN')).toBe('unknown');
    expect(normalizeEngine('unknown')).toBe('unknown');
    expect(normalizeEngine('')).toBe('unknown');
    expect(normalizeEngine(null)).toBe('unknown');
    expect(normalizeEngine(undefined)).toBe('unknown');
  });

  it('marks Unity-only commands unavailable on Unreal and unknown engines', () => {
    for (const cmd of ['getAllFields', 'getAllVisualElementProperty', 'findObjectsLight', 'getAllCameras']) {
      expect(isCommandAvailable('unity', cmd)).toBe(true);
      expect(isCommandAvailable('unreal', cmd)).toBe(false);
      expect(isCommandAvailable('unknown', cmd)).toBe(false);
    }
    expect(isCommandAvailable('unreal', 'getAllComponents')).toBe(true);
    expect(isCommandAvailable('unknown', 'getObjectComponentProperty')).toBe(true);
  });

  it('isUnavailable recognises the marker only', () => {
    expect(isUnavailable(UNAVAILABLE)).toBe(true);
    expect(isUnavailable({ unavailable: true })).toBe(true);
    expect(isUnavailable(null)).toBe(false);
    expect(isUnavailable([])).toBe(false);
    expect(isUnavailable('unavailable')).toBe(false);
  });
});
