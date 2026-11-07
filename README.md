# @alttester/driver

AltTester® driver for TypeScript and JavaScript. It runs in Node 22+ and in browsers, and has the same API
as the Python, C# and Java bindings: camelCase names, async methods, times in seconds.

```ts
import { AltDriver, By, AltKeyCode } from '@alttester/driver';

const driver = await AltDriver.connect({ host: '127.0.0.1', port: 13000, appName: 'MyGame' });
const play = await driver.waitForObject(By.NAME, 'PlayButton');
await play.tap();
await driver.waitForCurrentSceneToBe('Game');
await driver.pressKey(AltKeyCode.Space);
await driver.stop();
```

## Install

This repository is private and the package is not on the public npm registry. Install it from a tag:

```bash
npm install "github:alttester/AltTester-TypeScript-Driver#v0.2.1"
```

npm builds `dist/` on install (`prepare`). It needs read access to this repository: an SSH key locally, a
token on CI.

## Entry points

| Import | What |
|---|---|
| `@alttester/driver` | The binding: `AltDriver`, `AltObject`, `By`, `AltKeyCode`, enums, typed exceptions |
| `@alttester/driver/protocol` | The low-level protocol client the web inspector uses (`AltSocket`, app list, live view) |
| `@alttester/driver/node` | Node-only helpers: `AltReversePortForwarding` (adb reverse, iproxy) |
| `@alttester/driver/testing` | The in-memory fake AltServer, for consumers' own tests |

The package was split out of [alttester-web](https://github.com/alttester), the browser-based AltTester
inspector, with its history. `publishConfig` points at GitHub Packages, so an accidental `npm publish`
cannot reach the public registry.

## API

`AltDriver.connect(options)`: `host`, `port`, `appName`, `secureMode`, `connectTimeout` (s, retries until an
app is there), `platform`, `platformVersion`, `deviceInstanceId`, `appId`, `driverType`, `enableLogging`
(true or a logger), `engine` (`auto` | `unity` | `unreal` | `unknown`), `commandResponseTimeout`,
`autoReconnect` (after app disconnect 4002 or a dropped socket 1006, default true), `allowSelfSigned`
(Node, wss), `WebSocketImpl`.

Driver: `findObject(s)`, `findObject(s)WhichContain(s)`, `findObjectAtCoordinates`, `getAllElements`,
`getAllElementsLight`, `getAllLoadedScenesAndObjects`, `waitForObject`, `waitForObjectWhichContains`,
`waitForObjectToNotBePresent`, `getCurrentScene`, `loadScene`, `unloadScene`, `getAllScenes`,
`getAllLoadedScenes`, `waitForCurrentSceneToBe`, `getAllCameras`, `getAllActiveCameras`,
`getApplicationScreenSize`, `get/setTimeScale`, `getScreenshot`, `getHighlightedScreenshot(At)`,
`getPNGScreenshot`, `tap`, `click`, `moveMouse`, `scroll`, `swipe`, `multipointSwipe`, `holdButton`,
`begin/move/endTouch`, `tilt`, `resetInput`, `pressKey(s)`, `keyDown/keysDown`, `keyUp/keysUp`,
`callStaticMethod`, `get/setStaticProperty`, PlayerPrefs (`get{Int,Float,String}KeyPlayerPref`,
`getPlayerPrefKey`, `setKeyPlayerPref`, `deleteKeyPlayerPref`, `deletePlayerPref`), `add/removeNotificationListener`,
`setServerLogging`, `getServerVersion`, `get/setCommandResponseTimeout`, `get/setDelayAfterCommand`,
`get/setImplicitTimeout`, `stop`.

AltObject: `updateObject`, `getParent`, `findObjectFromObject`, `getScreenPosition`, `getWorldPosition`,
`get/setComponentProperty`, `callComponentMethod`, `waitForComponentProperty`, `getText`, `setText`, `tap`,
`click`, `pointerUp/Down/Enter/Exit`, `getAllComponents`, `getAllProperties`, `getAllFields`, `getAllMethods`,
`getVisualElementProperty`, `waitForVisualElementProperty`, `getAllVisualElementProperties`, `toJSON`.

Errors follow the other bindings: `NotFoundException` (and `ObjectNotFound`, `ComponentNotFound`, ...),
`WaitTimeOutException`, `CommandResponseTimeoutException`, `NoAppConnectedException`,
`AppDisconnectedException`, `InvalidCommandException`, `AltTesterInvalidServerResponse`, ...; all extend
`AltException`.

## Differences from the other bindings

- Async, and `AltDriver.connect()` instead of a constructor.
- In Node the `ws` package is used, not Node's built-in WebSocket: the built-in one (undici) receives empty
  messages from AltServer after the first one.
- Unity-only commands throw `InvalidCommandException` at once on Unreal apps (the Unreal SDK never replies
  to a command it does not know). The engine is inferred from the SDK version (Unreal SDKs are 1.x).
- `getApplicationScreenSize` sends the `getApplicationScreenSize` command (as C# does), so it works on Unreal.
- `getScreenshot`, `getHighlightedScreenshot` and `getHighlightedScreenshotAt` are named versions of C#'s
  three `GetScreenshot` overloads.
- `setComponentProperty(component, property, assembly, value)` uses the Python argument order.

## Tests

`npm test` runs the unit tests against an in-memory fake server. `npm run test:live` runs against real apps;
see `test/live/README.md`.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```
