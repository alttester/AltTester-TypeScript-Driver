import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// KTD10: the driver package is framework-free and never reaches into the app.
const SRC = fileURLToPath(new URL('../src', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? sourceFiles(full) : full.endsWith('.ts') ? [full] : [];
  });
}

describe('driver package boundary', () => {
  it('imports nothing from React or the inspector app', () => {
    const offenders = sourceFiles(SRC).filter((file) => {
      const text = readFileSync(file, 'utf8');
      return /from\s+['"](react|react-dom)(\/|['"])/.test(text) || /from\s+['"](\.\.\/)+(\.\.\/)?src\//.test(text) || /WebInspector\/src/.test(text);
    });
    expect(offenders).toEqual([]);
  });
});
