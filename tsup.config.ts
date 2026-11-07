import { defineConfig } from 'tsup';

// dist/ entry points: the binding is the package's main entry, the protocol client the web inspector uses is
// "@alttester/driver/protocol", Node-only helpers are "@alttester/driver/node", and the in-memory fake
// AltServer for consumers' own tests is "@alttester/driver/testing".
export default defineConfig({
  entry: {
    index: 'src/binding/index.ts',
    protocol: 'src/index.ts',
    node: 'src/node/index.ts',
    testing: 'test/fakeAltServer.ts',
  },
  format: ['esm', 'cjs'],
  dts: { compilerOptions: { types: ['node'] } },
  sourcemap: true,
  clean: true,
  target: 'es2022',
  platform: 'neutral',
  external: ['ws', /^node:/],
});
