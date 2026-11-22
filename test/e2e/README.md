# End-to-end tests against AltTester's sample games

`test/e2e/unity` ports the C# integration suite from AltTester-Unity-SDK-Closed-Source
(`sdk-package/Assets/Examples/Test/Editor/Driver`) to TypeScript, test for test: one file per C# class, the
C# method names as test names, one test per `[TestCase]` row, the same scenes and assertions.
`TestForScene1TestSample` is split into three files (`part1` to `part3`) in the order of the C# file.
`testBase.ts` is the port of `TestBase.cs`: one driver per class, and before each test `resetInput`, a 5 second
command response timeout and a fresh load of the class's scene.

The tests that C# marks `[Ignore]` are skipped here too, and so is `TestReversePortForwarding`, which needs a phone.
The `[Category]` marks (WebGLUnsupported and so on) are kept as comments; the suite runs on macOS standalone.

## Where the TypeScript driver differs from C#

- `TestGetVersion` is skipped: the driver has no constant for the SDK version it targets (`BINDING_VERSION` is
  the npm package version).
- `TestGetComponentPropertyInvalidDeserialization` is skipped: `getComponentProperty` doesn't deserialize into a
  typed value, so there is no `ResponseFormatException`.
- `waitForComponentProperty` keeps polling after a server error and then throws `WaitTimeOutException` with the
  server's message, where C# throws the server's exception at once. Those tests expect `WaitTimeOutException` and
  check the message.
- A few messages are worded like the Python binding rather than C# (for example `waitForObjectToNotBePresent`).
- `setComponentProperty` takes `(component, property, assembly, value)`, the Python order.
- `callComponentMethod` returns the parsed JSON value (a method returning the string "3" gives the number 3), where
  C# deserializes into the requested type.
- With no parameter types, the driver sends an empty array where C# sends null, so the server's "No method found"
  message ends in `(System.String[])` instead of `()`. The tests compare only the part before it.

## In CI

`.github/workflows/e2e.yml` runs the suite on the office macOS runners against the `sample-game-development`
release that the closed repo publishes, and uploads the Allure report (see below).

## Allure report

Every run writes Allure results to `allure-results/`, which is emptied at the start of the run. When a test fails,
`allure.setup.ts` attaches the game screenshot and the test file's driver log to it, using `@alttester/driver/allure`.
`npm run report` builds the report into `allure-report/`, and `npm run report:open` opens it. In CI the report is
built after every run, passed or failed, and uploaded as the `allure-report` artifact of the run (kept 7 days).

## Running it locally

1. Build the Unity sample game from `sdk-package` in AltTester-Unity-SDK-Closed-Source, pointed at your
   AltServer. The build reads the host and port from the environment:

   ```bash
   ALTSERVER_HOST=127.0.0.1 ALTSERVER_PORT=13000 \
     "<Unity editor>/Contents/MacOS/Unity" -batchmode -nographics -projectPath <checkout>/sdk-package \
     -executeMethod AltTesterTools.BuildAltTester.MacBuildFromCommandLine -logFile buildMac.log -quit
   ```

   The project is on Unity 2021.3; a scratch copy builds fine with 2022.3 too. You can also download the CI
   build from the `sample-game-development` release, but it connects to the office AltServer.
2. Start AltTester Desktop (or AltServer) on that port and open `sdk-package/sampleGame.app`. It connects as
   `__default__`.
3. Run:

   ```bash
   npm run test:e2e
   ```

Environment, the same as `TestsHelper.cs`: `ALTSERVER_HOST` (127.0.0.1), `ALTSERVER_PORT` (13000),
`ALTSERVER_PLATFORM_VERSION` (unknown), plus `ALTSERVER_APP_NAME` (`__default__`). The files run one at a time
because they all drive the same app. Tests that check the game's AltServer port use `ALTSERVER_PORT`, where C#
hardcodes CI's 13005.
