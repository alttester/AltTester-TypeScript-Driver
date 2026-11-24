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

```bash
npm install @alttester/driver
```

The driver shares its major and minor version with the AltTester® SDK, so any 2.4.x driver works with any 2.4.x
Unity SDK. It also connects to Unreal SDK 1.x apps. Patch versions are released independently.

## Before you start

The driver talks to your game through an AltTester® Server, so a test needs three things:

1. A build of your game with the AltTester® SDK in it: the
   [Unity SDK](https://alttester.com/docs/sdk/latest/) or the [Unreal SDK](https://alttester.com/docs/unreal-sdk/latest/).
2. A running AltTester® Server. [AltTester® Desktop](https://alttester.com/docs/desktop/latest/) starts one on port
   13000 by default, which is also the driver's default.
3. The game running and connected to that server. Pass its name as `appName` when several apps share one server.

The [Unity SDK get-started guide](https://alttester.com/docs/sdk/latest/pages/get-started.html) covers the first
two steps.

## A first test

Any test runner works, because the driver is a plain async API. This example uses [Vitest](https://vitest.dev):

```ts
import { afterAll, beforeAll, expect, test } from 'vitest';
import { AltDriver, By } from '@alttester/driver';

let driver: AltDriver;

beforeAll(async () => {
  // connectTimeout is in seconds; connect retries until an app is there.
  driver = await AltDriver.connect({ host: '127.0.0.1', port: 13000, appName: 'MyGame', connectTimeout: 60 });
});

afterAll(async () => {
  await driver?.stop();
});

test('the play button opens the game scene', async () => {
  const play = await driver.waitForObject(By.NAME, 'PlayButton');
  await play.tap();
  await driver.waitForCurrentSceneToBe('Game');
  expect(await driver.getCurrentScene()).toBe('Game');
});
```

Open one driver per test file and stop it at the end. Each open driver uses one connection of your AltTester®
licence.

## Entry points

| Import | What |
|---|---|
| `@alttester/driver` | The binding: `AltDriver`, `AltObject`, `By`, `AltKeyCode`, enums, typed exceptions |
| `@alttester/driver/protocol` | The low-level protocol client the web inspector uses (`AltSocket`, app list, live view) |
| `@alttester/driver/node` | Node-only helpers: `AltReversePortForwarding` (adb reverse, iproxy) |
| `@alttester/driver/allure` | Optional: puts AltTester screenshots and the driver log into an Allure report |
| `@alttester/driver/testing` | The in-memory fake AltServer, for consumers' own tests |

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

## Allure reports

`@alttester/driver/allure` attaches AltTester material to the test that is running, in any test runner that has an
Allure adapter (allure-vitest, allure-mocha, allure-jest, allure-playwright or @wdio/allure-reporter). It needs the
`allure-js-commons` package next to that adapter. Nothing else in the driver uses it, so the package is optional.

```ts
import { AltDriver } from '@alttester/driver';
import { attachFailureEvidence, createLogRecorder } from '@alttester/driver/allure';

const log = createLogRecorder(); // keeps the driver log in memory instead of printing it
const driver = await AltDriver.connect({ appName: 'MyGame', enableLogging: log });

// In your runner's after-test hook, when the test failed:
await attachFailureEvidence(driver, { log });
```

`attachFailureEvidence` attaches a game screenshot and the driver log. Pass `object` to add a screenshot with that
object outlined, and `hierarchy: true` to add every loaded object as JSON. It never throws: an item it can't collect
becomes a "not available" note. `attachScreenshot`, `attachHighlightedScreenshot`, `attachHierarchy` and `attachLog`
attach one item each, at any point in a test.

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
`npm run test:e2e` runs the sample-game suite (see `test/e2e/README.md`) and writes Allure results; `npm run report`
turns them into `allure-report/`, and `npm run report:open` opens it.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

## Releasing

1. Set `version` in `package.json` (and `package-lock.json`) to the new version, for example with
   `npm version 2.4.1 --no-git-tag-version`, and merge that change to `main`.
2. Tag the merge commit with the same version prefixed by `v`, and push the tag:
   `git tag v2.4.1 && git push origin v2.4.1`.
3. The `Release` workflow checks that the tag matches `package.json`, runs the checks, and publishes to npm
   through trusted publishing (OIDC), with provenance. No npm token is stored in the repository. A version with a
   pre-release suffix, such as `2.5.0-beta.1`, is published under the `next` dist-tag instead of `latest`.

## License

Proprietary, under the AltTester® SDK License Agreement. See [LICENSE](LICENSE). Using the driver requires a valid
AltTester® Lite or Pro subscription.
