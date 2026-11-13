// SDK version gate (R4), ported from Desktop's AltDriverController.IsVersionAllowed. Desktop downloads
// the patterns from https://alttester.com/app/uploads/AltTester/desktop/sdk_versions.json; the web
// inspector ships that file's `default` entry as a constant (no network fetch in v1).

import { normalizeEngine } from './engine';

export interface SupportedSdkPatterns {
  unity: string;
  unreal: string;
}

/**
 * Started from the `default` entry of sdk_versions.json (2026-11-07), then extended with the SDKs released since:
 * Unity SDK 2.4 and Unreal SDK 1.3 (2026-11-04). On 2026-11-13 the hosted file still stopped at 2.3.* / 1.2.*.
 * Add each new SDK minor version here when it ships.
 */
export const BUNDLED_SDK_PATTERNS: SupportedSdkPatterns = {
  unity: '2.1.*, 2.2.*,2.3.*,2.4.*',
  unreal: '1.1.*,1.2.*,1.3.*',
};

export type SdkCheck = { ok: true } | { ok: false; message: string; expected: string };

function splitPatterns(list: string): string[] {
  return list
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Patterns for an engine tag; UNKNOWN (or anything else) accepts either engine's list. */
export function patternsForEngine(engineTag: string | null | undefined, patterns = BUNDLED_SDK_PATTERNS): string[] {
  const engine = normalizeEngine(engineTag);
  if (engine === 'unity') return splitPatterns(patterns.unity);
  if (engine === 'unreal') return splitPatterns(patterns.unreal);
  return [...splitPatterns(patterns.unity), ...splitPatterns(patterns.unreal)];
}

export function matchesPattern(version: string, pattern: string): boolean {
  const v = version.trim().split('.');
  const p = pattern.trim().split('.');
  return v.length === p.length && p.every((part, i) => part === '*' || part === v[i]);
}

function patternRank(pattern: string): number[] {
  return pattern.split('.').map((x) => (x === '*' ? 0 : Number.parseInt(x, 10) || 0));
}

/** The highest pattern, which Desktop names in its mismatch message. */
export function highestPattern(patterns: string[]): string {
  return [...patterns].sort((a, b) => {
    const ra = patternRank(a);
    const rb = patternRank(b);
    for (let i = 0; i < Math.max(ra.length, rb.length); i++) {
      const d = (rb[i] ?? 0) - (ra[i] ?? 0);
      if (d) return d;
    }
    return 0;
  })[0];
}

export function checkSdkVersion(
  version: string | null | undefined,
  engineTag: string | null | undefined,
  patterns = BUNDLED_SDK_PATTERNS,
): SdkCheck {
  const allowed = patternsForEngine(engineTag, patterns);
  const v = (version ?? '').trim();
  if (v && allowed.some((p) => matchesPattern(v, p))) return { ok: true };
  const expected = highestPattern(allowed) ?? '';
  const current = v || 'unknown';
  return {
    ok: false,
    expected,
    message: `Version mismatch. Please instrument your game with AltTester® SDK v.${expected}. You are currently using AltTester® SDK v. ${current}.`,
  };
}
