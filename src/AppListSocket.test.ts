import { describe, expect, it } from 'vitest';
import { FakeAltServer, flush, type FakeSocket } from '../test/fakeAltServer';
import {
  AppListSocket,
  DESKTOP_PATH,
  parseAppList,
  parseDesktopHandshake,
  parseDriverList,
  type AppListOpen,
  type AppListState,
} from './AppListSocket';

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

const driver = (driverId: string, appId: string, driverType = 'Python') => ({
  Name: null,
  Platform: null,
  PlatformVersion: null,
  DeviceInstanceId: null,
  AppId: appId,
  IsDriver: true,
  DriverType: driverType,
  DriverId: driverId,
});

function setup(pollMs = 5_000, server = new FakeAltServer()) {
  let apps: Record<string, unknown>[] = [tags('TicTacToe'), tags('Lyra', { GameEngine: 'UNREAL', SdkVersion: '1.2.0' })];
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
  return { server, list, states, gets, setApps: (a: Record<string, unknown>[]) => (apps = a) };
}

/** Polls until the condition holds (the fake replies through two timer hops, so fixed sleeps race under load). */
async function until(cond: () => unknown, timeoutMs = 1000): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (!cond()) {
    if (Date.now() > end) throw new Error('condition not met in time');
    await flush(2);
  }
}

const lastOpen = (states: AppListState[]): AppListOpen | undefined => {
  const s = states[states.length - 1];
  return s?.status === 'open' ? s : undefined;
};
const lastApps = (states: AppListState[]) => lastOpen(states)?.apps;
const lastClosed = (states: AppListState[]) => {
  const s = states[states.length - 1];
  return s?.status === 'closed' ? s.info : undefined;
};

describe('AppListSocket', () => {
  it('opens /altws/desktop, asks with getConnectedApps, and parses the Tags array', async () => {
    const { server, list, states } = setup();
    await until(() => lastApps(states));
    expect(server.last(DESKTOP_PATH).sent).toEqual([JSON.stringify({ commandName: 'getConnectedApps' })]);
    expect(lastOpen(states)?.control).toBe(true);
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
    server.last(DESKTOP_PATH).sendDriverRegistered();
    expect(states.length).toBe(before);
    expect(lastApps(states)).toHaveLength(2);
    list.close();
  });

  it('takes pushed updates: an app removed by the server disappears', async () => {
    const { server, list, states } = setup();
    await until(() => lastApps(states));
    server.last(DESKTOP_PATH).push([tags('TicTacToe')]);
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
    expect(server.sockets.filter((s) => s.path === DESKTOP_PATH)).toHaveLength(1);
    list.close();
  });

  it('reports an unreachable server and does not reconnect in a loop', async () => {
    const server = new FakeAltServer();
    const Broken = class extends server.WebSocket {
      constructor(url: string) {
        super(url);
        queueMicrotask(() => this.serverClose(1006));
      }
    };
    const states: AppListState[] = [];
    new AppListSocket({ host: 'localhost', port: 1, secure: false }, { WebSocketImpl: Broken, onChange: (s) => states.push(s) });
    await until(() => lastClosed(states));
    await flush(20);
    expect(lastClosed(states)?.kind).toBe('unreachable');
    // the desktop path, the two read-only fallbacks, then one probe on wss
    expect(server.sockets.map((s) => s.url.split('/altws')[0] + s.path)).toEqual([
      'ws://localhost:1/altws/desktop',
      'ws://localhost:1/altws/connected-app-cli',
      'ws://localhost:1/altws/connected-app',
      'wss://localhost:1/altws/connected-app',
    ]);
  });

  it('splits a Tags list into apps and drivers', () => {
    const frame = [tags('A'), driver('d1', 'A-id')];
    expect(parseAppList(frame)?.map((a) => a.name)).toEqual(['A']);
    expect(parseDriverList(frame)).toEqual([{ driverId: 'd1', driverType: 'Python', appId: 'A-id' }]);
    expect(parseAppList({ commandName: 'driverRegistered' })).toBeNull();
    expect(parseDriverList({ commandName: 'driverRegistered' })).toBeNull();
  });

  it('lists the drivers on /altws/desktop', async () => {
    const { list, states, setApps } = setup(20);
    setApps([tags('TicTacToe'), driver('d1', 'TicTacToe-id', 'CSharp'), driver('d2', 'TicTacToe-id')]);
    await until(() => lastOpen(states)?.drivers?.length === 2);
    expect(lastOpen(states)?.drivers?.map((d) => d.driverType)).toEqual(['CSharp', 'Python']);
    expect(lastApps(states)?.map((a) => a.name)).toEqual(['TicTacToe']);
    list.close();
  });

  it('takes the limits from the desktopHandshake, and the bare limit frame does not override them', async () => {
    const { server, list, states } = setup();
    await until(() => lastOpen(states)?.limits);
    expect(lastOpen(states)?.limits).toEqual({ licenseType: 'PREMIUM', gameEngine: 'ALL', maxApps: 5, maxDrivers: 3 });
    server.last(DESKTOP_PATH).push('3');
    expect(lastOpen(states)?.limits?.maxApps).toBe(5);
    list.close();
  });

  it('uses the bare limit frame when the server sends no handshake', async () => {
    const { server, list, states } = setup(5_000, new FakeAltServer({ desktopHandshake: null }));
    await until(() => lastApps(states));
    expect(lastOpen(states)?.limits).toBeNull();
    server.last(DESKTOP_PATH).push('2');
    expect(lastOpen(states)?.limits).toEqual({ licenseType: '', gameEngine: '', maxApps: 2, maxDrivers: 2 });
    list.close();
  });

  it('parses only desktopHandshake frames as limits', () => {
    expect(parseDesktopHandshake({ commandName: 'driverRegistered', data: {} })).toBeNull();
    expect(parseDesktopHandshake([tags('A')])).toBeNull();
  });

  it('sends disconnectApp and disconnectDriver, and nothing that can stop the server', async () => {
    const { server, list, states } = setup();
    const received: unknown[] = [];
    server.desktopHandler = (_ws, cmd) => received.push(cmd);
    await until(() => lastApps(states));
    expect(list.disconnectApp('TicTacToe-id')).toBe(true);
    expect(list.disconnectDriver('d1', 'TicTacToe-id')).toBe(true);
    expect(received).toEqual([
      { commandName: 'disconnectApp', data: { appId: 'TicTacToe-id' } },
      { commandName: 'disconnectDriver', data: { driverId: 'd1', appId: 'TicTacToe-id' } },
    ]);
    const names = server.last(DESKTOP_PATH).sent.map((t) => (JSON.parse(t) as { commandName: string }).commandName);
    expect(names.filter((n) => n === 'shutdown' || n === 'changePort')).toEqual([]);
    list.close();
  });

  it('a read-only fallback has no drivers and cannot disconnect', async () => {
    const server = new FakeAltServer({ missingPaths: [DESKTOP_PATH] });
    const { list, states } = setup(5_000, server);
    await until(() => lastApps(states));
    expect(server.last('/altws/connected-app-cli').sent).toEqual(['GetApps']);
    expect(lastOpen(states)).toMatchObject({ control: false, drivers: null, limits: null });
    expect(list.disconnectApp('TicTacToe-id')).toBe(false);
    list.close();
  });

  it('reports a server that stops answering the polls', async () => {
    const { server, list, states } = setup(10);
    await until(() => lastApps(states));
    server.appListHandler = null; // the socket stays open but nothing comes back
    await until(() => lastClosed(states), 2000);
    expect(lastClosed(states)?.kind).toBe('unresponsive');
    expect(server.closedByClient.some((c) => c.socket === server.last(DESKTOP_PATH))).toBe(true);
    list.close();
  });

  it('does not report a stopped server while polling is off (the inspector is open)', async () => {
    const { server, list, states } = setup(10);
    await until(() => lastApps(states));
    list.setPolling(false);
    server.appListHandler = null;
    await flush(60);
    expect(states[states.length - 1].status).toBe('open');
    list.close();
  });

  it('tells a server that only accepts wss apart from one that is down', async () => {
    const server = new FakeAltServer({ scheme: 'wss' });
    const states: AppListState[] = [];
    new AppListSocket({ host: 'localhost', port: 13000, secure: false }, { WebSocketImpl: server.WebSocket, onChange: (s) => states.push(s) });
    await until(() => lastClosed(states));
    expect(lastClosed(states)?.kind).toBe('requiresSecure');
    expect(lastClosed(states)?.message).toMatch(/only accepts secure \(WSS\).*Turn Secure on/);
    await flush(10);
    expect(server.closedByClient.some((c) => c.socket.url.startsWith('wss://'))).toBe(true);
  });

  it('tells a server that does not accept wss apart from one that is down', async () => {
    const server = new FakeAltServer({ scheme: 'ws' });
    const states: AppListState[] = [];
    new AppListSocket({ host: 'localhost', port: 13000, secure: true }, { WebSocketImpl: server.WebSocket, onChange: (s) => states.push(s) });
    await until(() => lastClosed(states));
    expect(lastClosed(states)?.kind).toBe('notSecure');
    expect(lastClosed(states)?.message).toMatch(/Turn Secure off/);
  });

  it('gives up on a stalled wss upgrade to a plain server and reports the Secure mix-up', async () => {
    const server = new FakeAltServer({ scheme: 'ws', stallWrongScheme: true });
    const states: AppListState[] = [];
    new AppListSocket(
      { host: 'localhost', port: 13000, secure: true },
      { WebSocketImpl: server.WebSocket, openTimeoutMs: 20, onChange: (s) => states.push(s) },
    );
    await until(() => lastClosed(states));
    expect(lastClosed(states)?.kind).toBe('notSecure');
    // one stalled attempt, no fallbacks, then the ws probe
    expect(server.sockets.map((s) => s.url.split(':')[0] + ' ' + s.path)).toEqual(['wss /altws/desktop', 'ws /altws/connected-app']);
  });

  it('falls back to /altws/connected-app on servers older than 2.4 that lack the desktop and CLI endpoints', async () => {
    const server = new FakeAltServer({ missingPaths: [DESKTOP_PATH, '/altws/connected-app-cli'] });
    server.appListHandler = (ws, text) => {
      if (text === 'GetApps') setTimeout(() => ws.push([tags('TicTacToe')]), 0);
    };
    const states: AppListState[] = [];
    const list = new AppListSocket({ host: 'localhost', port: 13000, secure: false }, { WebSocketImpl: server.WebSocket, onChange: (s) => states.push(s) });
    await until(() => lastApps(states));
    expect(server.sockets.map((s) => s.path)).toEqual([DESKTOP_PATH, '/altws/connected-app-cli', '/altws/connected-app']);
    expect(server.last('/altws/connected-app').sent).toEqual(['GetApps']);
    expect(lastApps(states)?.map((a) => a.name)).toEqual(['TicTacToe']);
    list.close();
  });

  it('an unreachable server tries each endpoint once and probes the other scheme once, then reports unreachable', async () => {
    const server = new FakeAltServer({ missingPaths: [DESKTOP_PATH, '/altws/connected-app-cli', '/altws/connected-app'] });
    const states: AppListState[] = [];
    new AppListSocket({ host: 'localhost', port: 13000, secure: false }, { WebSocketImpl: server.WebSocket, onChange: (s) => states.push(s) });
    await until(() => states.some((s) => s.status === 'closed'));
    await flush(20);
    expect(lastClosed(states)?.kind).toBe('unreachable');
    expect(server.sockets).toHaveLength(4);
  });

  it('strips the JSON quotes AltServer leaves around the SdkVersion tag', () => {
    expect(parseAppList([tags('A', { SdkVersion: '"2.3.3"' })])?.[0].sdkVersion).toBe('2.3.3');
    expect(parseAppList([tags('A', { SdkVersion: '2.3.3' })])?.[0].sdkVersion).toBe('2.3.3');
    expect(parseAppList([tags('A', { SdkVersion: '""' })])?.[0].sdkVersion).toBeNull();
  });
});
