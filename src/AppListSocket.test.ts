import { describe, expect, it } from 'vitest';
import { FakeAltServer, flush, type FakeSocket } from '../test/fakeAltServer';
import { AppListSocket, parseAppList, type AppListState } from './AppListSocket';

const tags = (name: string, extra: Record<string, unknown> = {}) => ({
  Name: name,
  Platform: 'Editor',
  PlatformVersion: 'unknown',
  DeviceInstanceId: 'dev1',
  GameEngine: 'UNITY',
  AppId: `${name}-id`,
  SdkVersion: '2.3.3',
  OlderVersion: false,
  IsInBackground: false,
  IsDriver: false,
  ...extra,
});

function setup(pollMs = 5_000) {
  const server = new FakeAltServer();
  let apps = [tags('TicTacToe'), tags('Lyra', { GameEngine: 'UNREAL', SdkVersion: '1.2.0' })];
  const gets: FakeSocket[] = [];
  server.appListHandler = (ws, text) => {
    if (text !== 'GetApps') return;
    gets.push(ws);
    setTimeout(() => ws.push(apps), 0);
  };
  const states: AppListState[] = [];
  const list = new AppListSocket(
    { host: 'localhost', port: 13000, secure: false },
    { WebSocketImpl: server.WebSocket, pollMs, onChange: (s) => states.push(s) },
  );
  return { server, list, states, gets, setApps: (a: ReturnType<typeof tags>[]) => (apps = a) };
}

/** Polls until the condition holds (the fake replies through two timer hops, so fixed sleeps race under load). */
async function until(cond: () => unknown, timeoutMs = 1000): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (!cond()) {
    if (Date.now() > end) throw new Error('condition not met in time');
    await flush(2);
  }
}

const lastApps = (states: AppListState[]) => {
  const s = states[states.length - 1];
  return s?.status === 'open' ? s.apps : undefined;
};

describe('AppListSocket', () => {
  it('opens /altws/connected-app-cli, sends GetApps, and parses the Tags array', async () => {
    const { server, list, states } = setup();
    await until(() => lastApps(states));
    expect(server.last('/altws/connected-app-cli').sent).toEqual(['GetApps']);
    expect(lastApps(states)?.map((a) => [a.name, a.platform, a.gameEngine, a.sdkVersion])).toEqual([
      ['TicTacToe', 'Editor', 'UNITY', '2.3.3'],
      ['Lyra', 'Editor', 'UNREAL', '1.2.0'],
    ]);
    list.close();
  });

  it('ignores driverRegistered text frames', async () => {
    const { server, list, states } = setup();
    await until(() => lastApps(states));
    const before = states.length;
    server.last('/altws/connected-app-cli').sendDriverRegistered();
    expect(states.length).toBe(before);
    expect(lastApps(states)).toHaveLength(2);
    list.close();
  });

  it('takes pushed updates: an app removed by the server disappears', async () => {
    const { server, list, states } = setup();
    await until(() => lastApps(states));
    server.last('/altws/connected-app-cli').push([tags('TicTacToe')]);
    expect(lastApps(states)?.map((a) => a.name)).toEqual(['TicTacToe']);
    list.close();
  });

  it('polls GetApps so an app shows up even when pushes are suppressed', async () => {
    const { list, states, gets, setApps } = setup(20);
    await until(() => lastApps(states));
    setApps([tags('TicTacToe'), tags('Lyra'), tags('NewGame')]);
    await until(() => lastApps(states)?.some((a) => a.name === 'NewGame'));
    expect(gets.length).toBeGreaterThanOrEqual(2);
    list.close();
  });

  it('stops polling while the picker is hidden and uses one socket throughout', async () => {
    const { server, list, gets } = setup(10);
    await until(() => gets.length);
    list.setPolling(false);
    const n = gets.length;
    await flush(40);
    expect(gets.length).toBe(n);
    list.setPolling(true);
    await flush(25);
    expect(gets.length).toBeGreaterThan(n);
    expect(server.sockets.filter((s) => s.path === '/altws/connected-app-cli')).toHaveLength(1);
    list.close();
  });

  it('reports an unreachable server and does not reconnect', async () => {
    const server = new FakeAltServer();
    const Broken = class extends server.WebSocket {
      constructor(url: string) {
        super(url);
        queueMicrotask(() => this.serverClose(1006));
      }
    };
    const states: AppListState[] = [];
    new AppListSocket({ host: 'localhost', port: 1, secure: false }, { WebSocketImpl: Broken, onChange: (s) => states.push(s) });
    await flush(20);
    const last = states[states.length - 1];
    expect(last.status).toBe('closed');
    if (last.status === 'closed') expect(last.info.kind).toBe('unreachable');
    expect(server.sockets).toHaveLength(1);
  });

  it('drops driver entries if a server sends them', () => {
    expect(parseAppList([tags('A'), tags('drv', { IsDriver: true })])?.map((a) => a.name)).toEqual(['A']);
    expect(parseAppList({ commandName: 'driverRegistered' })).toBeNull();
  });
});
