import { defineConfig } from 'tsup';

// dist/ entry points:
// - the binding is the package's main entry;
// - "@alttester/driver/protocol" is the protocol client the web inspector uses;
// - "@alttester/driver/node" holds the Node-only helpers;
// - "@alttester/driver/allure" holds the optional Allure helpers (allure-js-commons stays external, as an optional peer);
// - "@alttester/driver/testing" is the in-memory fake AltServer for consumers' own tests.
export default defineConfig({
  entry: {
    index: 'src/binding/index.ts',
    protocol: 'src/index.ts',
    node: 'src/node/index.ts',
    allure: 'src/allure/index.ts',
    testing: 'test/fakeAltServer.ts',
  },
  format: ['esm', 'cjs'],
  dts: { compilerOptions: { types: ['node'] } },
  sourcemap: true,
  clean: true,
  target: 'es2022',
  platform: 'neutral',
  external: ['ws', 'allure-js-commons', /^node:/],
});
