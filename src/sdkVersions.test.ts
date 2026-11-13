import { describe, expect, it } from 'vitest';
import { checkSdkVersion, highestPattern, matchesPattern, patternsForEngine } from './sdkVersions';

describe('SDK version gate', () => {
  it('matches part by part with * wildcards and the same number of parts', () => {
    expect(matchesPattern('2.3.3', '2.3.*')).toBe(true);
    expect(matchesPattern('2.4.0', '2.3.*')).toBe(false);
    expect(matchesPattern('2.3', '2.3.*')).toBe(false);
    expect(matchesPattern('2.3.3.1', '2.3.*')).toBe(false);
  });

  it('accepts a Unity version in the Unity range and rejects one outside it', () => {
    expect(checkSdkVersion('2.2.1', 'UNITY')).toEqual({ ok: true });
    const bad = checkSdkVersion('2.0.4', 'UNITY');
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.expected).toBe('2.4.*');
      expect(bad.message).toContain('SDK v.2.4.*');
      expect(bad.message).toContain('2.0.4');
    }
  });

  it('accepts the current SDKs: Unity 2.4.1 and Unreal 1.3.0', () => {
    expect(checkSdkVersion('2.4.1', 'UNITY')).toEqual({ ok: true });
    expect(checkSdkVersion('1.3.0', 'UNREAL')).toEqual({ ok: true });
  });

  it('accepts an Unreal 1.x version in the Unreal range, but not in the Unity one', () => {
    expect(checkSdkVersion('1.2.0', 'UNREAL')).toEqual({ ok: true });
    expect(checkSdkVersion('1.2.0', 'unity').ok).toBe(false);
  });

  it('an unknown engine accepts either list (case-insensitive)', () => {
    expect(patternsForEngine('unknown')).toHaveLength(7);
    expect(checkSdkVersion('1.1.3', 'UNKNOWN')).toEqual({ ok: true });
    expect(checkSdkVersion('2.3.0', undefined)).toEqual({ ok: true });
  });

  it('a missing version is a mismatch', () => {
    expect(checkSdkVersion('', 'UNITY').ok).toBe(false);
  });

  it('highestPattern sorts numerically, not lexically', () => {
    expect(highestPattern(['2.10.*', '2.9.*', '2.1.*'])).toBe('2.10.*');
  });
});
