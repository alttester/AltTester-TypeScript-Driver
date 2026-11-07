# End-to-end tests against AltTester's sample games

`test/e2e/unity` ports the Python integration suite from AltTester-Unity-SDK-Closed-Source
(`Bindings~/python/tests/integration`) to TypeScript, test for test: same names, same scenes, same
assertions. The Python tests skipped in Python are skipped here too. `test_reverse_port_forwarding` is not
ported: it needs a phone.

## Running it locally

1. Build the Unity sample game from `sdk-package` in AltTester-Unity-SDK-Closed-Source, pointed at your
   AltServer. The build reads the host and port from the environment:

   ```bash
   ALTSERVER_HOST=127.0.0.1 ALTSERVER_PORT=13000 \
     "<Unity editor>/Contents/MacOS/Unity" -batchmode -nographics -projectPath <checkout>/sdk-package \
     -executeMethod AltTesterTools.BuildAltTester.MacBuildFromCommandLine -logFile buildMac.log -quit
   ```

   The project is on Unity 2021.3; a scratch copy builds fine with 2022.3 too.
2. Start AltTester Desktop (or AltServer) on that port and open `sdk-package/sampleGame.app`. It connects as
   `__default__`.
3. Run:

   ```bash
   npm run test:e2e
   ```

Environment, the same as the Python conftest: `ALTSERVER_HOST` (127.0.0.1), `ALTSERVER_PORT` (13000),
`ALTSERVER_APP_NAME` (`__default__`), `ALTSERVER_PLATFORM_VERSION` (unknown). The files run one at a time
because they all drive the same app.

One difference from Python: `test_wait_for_component_property_timeout` expects the port the game was built
with (`ALTSERVER_PORT`), where Python hardcodes CI's 13005.
