import { defineConfig } from 'tsup';

// Publishable build in dist/: the binding is the package's main entry, the protocol client is
// "@alttester/driver/protocol", Node-only helpers are "@alttester/driver/node".
export default defineConfig({
  entry: { index: 'src/binding/index.ts', protocol: 'src/index.ts', node: 'src/node/index.ts' },
  format: ['esm', 'cjs'],
  dts: { compilerOptions: { types: ['node'] } },
  sourcemap: true,
  clean: true,
  target: 'es2022',
  platform: 'neutral',
  external: ['ws', /^node:/],
});
