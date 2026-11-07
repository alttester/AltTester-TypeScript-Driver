import { defineConfig } from 'tsup';

// Two entry points: the driver itself and the fake AltServer used by consumers' tests.
export default defineConfig({
  entry: { index: 'src/index.ts', testing: 'test/fakeAltServer.ts' },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2022',
});
