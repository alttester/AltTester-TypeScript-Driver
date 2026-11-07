# Live binding tests

These drive real apps and are never part of `npm test`. Each suite skips unless its variable is set.

| Suite | App | Variable |
|---|---|---|
| `unity.live.test.ts` | AltTicTacToe (Unity SDK 2.3.x, Development build) | `ALT_LIVE_UNITY=1` |
| `unreal.live.test.ts` | Lyra (Unreal SDK 1.2.x) | `ALT_LIVE_UNREAL=1` |

Optional: `ALT_HOST` (default 127.0.0.1), `ALT_PORT` (13000), `ALT_UNITY_APP` (AltTicTacToe), `ALT_UNREAL_APP` (Lyra).

Start AltTester Desktop (serves both engines) or a standalone AltServer (a Pro licence is Unity only), start
the app(s), then from the repository root:

```bash
ALT_LIVE_UNITY=1 ALT_LIVE_UNREAL=1 npm run test:live
```

The Unity suite changes scenes, taps the board, sets and deletes a PlayerPrefs key (`ts-binding-live-test`)
and restores the time scale. The Unreal suite only reads and moves the mouse.
