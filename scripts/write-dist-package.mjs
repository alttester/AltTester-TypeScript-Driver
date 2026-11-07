// Writes dist/package.json (+ README) so `npm publish ./dist` publishes the built package.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const src = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const entry = (name) => ({
  import: { types: `./${name}.d.ts`, default: `./${name}.js` },
  require: { types: `./${name}.d.cts`, default: `./${name}.cjs` },
});
const pkg = {
  name: src.name,
  version: src.version,
  description: src.description,
  type: 'module',
  main: './index.cjs',
  module: './index.js',
  types: './index.d.ts',
  exports: { '.': entry('index'), './protocol': entry('protocol'), './node': entry('node') },
  engines: { node: '>=22' },
  dependencies: src.dependencies,
  sideEffects: false,
  keywords: ['alttester', 'unity', 'unreal', 'test-automation', 'game-testing'],
};
writeFileSync(new URL('../dist/package.json', import.meta.url), `${JSON.stringify(pkg, null, 2)}\n`);
if (existsSync(new URL('../README.md', import.meta.url))) copyFileSync(new URL('../README.md', import.meta.url), new URL('../dist/README.md', import.meta.url));
console.log(`dist/package.json written for ${pkg.name}@${pkg.version}`);
