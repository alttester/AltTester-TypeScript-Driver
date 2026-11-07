# @alttester/driver

A framework-free TypeScript client for the AltTester® driver protocol. It runs in the browser and in Node 22+
(both have a global `WebSocket`) and talks to AltServer directly: the AltTester® Desktop's embedded server or a
standalone AltServer.

It was split out of [alttester-web](../alttester-web), the browser-based AltTester inspector, which is its first
consumer. It covers what the inspector needs: connection and close codes, the app list, live update, the
inspector command catalog, the hierarchy builder, coordinate mapping, key codes and the SDK version gate. It is
not yet a full replacement for the C#, Python, Java or Robot bindings.

This repository is private and the package is not published to the public npm registry.

## Using it

The package builds to `dist/` on install (`prepare`), so it can be installed straight from this repository:

```bash
npm install "github:alttester/AltTester-TypeScript-Driver#v0.1.0"
```

That needs read access to this repository (an SSH key, or a token on CI).

```ts
import { AltSocket, buildHierarchy } from '@alttester/driver';
import { FakeAltServer } from '@alttester/driver/testing'; // for your own tests
```

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

`publishConfig` points at GitHub Packages, so an accidental `npm publish` cannot reach the public registry.
