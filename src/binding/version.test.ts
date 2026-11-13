import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BINDING_VERSION } from './version';

describe('BINDING_VERSION', () => {
  it('matches the version in package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };
    expect(BINDING_VERSION).toBe(pkg.version);
  });
});
