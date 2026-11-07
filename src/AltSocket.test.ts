import { describe, expect, it } from 'vitest';
import { FakeAltServer, flush } from '../test/fakeAltServer';
import { AltConnectionError, AltError, AltSocket, AltTimeoutError, type ConnectOptions } from './AltSocket';

function opts(server: FakeAltServer, extra: Partial<ConnectOptions> = {}): ConnectOptions {
  return { host: 'localhost', port: 13000, secure: false, appName: 'Game', WebSocketImpl: server.WebSocket, ...extra };
}

describe('AltSocket connect', () => {
  it('builds the URL with driverType=Desktop and the app selection', async () => {
    const server = new FakeAltServer();
    const socket = await AltSocket.connect(opts(server, { appId: 'abc', platform: 'Android' }));
    const ws = server.last();
    expect(ws.path).toBe('/altws');
    expect(ws.query.get('driverType')).toBe('Desktop');
    expect(ws.query.get('appName')).toBe('Game');
    expect(ws.query.get('appId')).toBe('abc');
    expect(ws.query.get('platform')).toBe('Android');
    socket.close();
  });

  it('waits for driverRegistered, then getServerVersion, then activates notifications 0, 1, 3', async () => {
    const server = new FakeAltServer();
    const socket = await AltSocket.connect(opts(server));
    expect(socket.serverVersion).toBe('2.3.3');
    const cmds = server.last().commands;
    expect(cmds.map((c) => c.commandName)).toEqual([
      'getServerVersion',
      'activateNotification',
      'activateNotification',
      'activateNotification',
    ]);
    expect(cmds.slice(1).map((c) => c.NotificationType)).toEqual([0, 1, 3]);
    expect(cmds[0]).toMatchObject({ isNotification: false });
    expect(typeof cmds[0].messageId).toBe('string');
    socket.close();
  });

  it('learns its driver id from the first command reply', async () => {
    const server = new FakeAltServer();
    const socket = await AltSocket.connect(opts(server));
    expect(socket.driverId).toBe(server.last().driverId);
    socket.close();
  });

  it('double-parses the data string: "\\"2.3.3\\"" resolves "2.3.3"', async () => {
    const server = new FakeAltServer({ serverVersion: '2.3.3' });
    const socket = await AltSocket.connect(opts(server));
    expect(await socket.send<string>({ commandName: 'getServerVersion' })).toBe('2.3.3');
    socket.close();
  });

  it('rejects when driverRegistered does not arrive in time', async () => {
    const server = new FakeAltServer({ register: false });
    const err = await AltSocket.connect(opts(server, { registerTimeoutMs: 30 })).catch((e) => e);
    expect(err).toBeInstanceOf(AltConnectionError);
    expect(err.info.kind).toBe('notRegistered');
    expect(err.message).toMatch(/reachable but did not register/i);
  });

  it('close 4009 during connect rejects with the licence-limit message and the server reason', async () => {
    const reason = 'Limit exceeded, your license supports max. 1 drivers.';
    const server = new FakeAltServer({ refuseWith: { code: 4009, reason } });
    const err = await AltSocket.connect(opts(server)).catch((e) => e);
    expect(err).toBeInstanceOf(AltConnectionError);
    expect(err.info.kind).toBe('driverLimit');
    expect(err.message).toMatch(/driver limit/i);
    expect(err.message).toContain(reason);
  });

  it('close 4001 says no matching app is connected', async () => {
    const server = new FakeAltServer({ refuseWith: { code: 4001 } });
    const err = await AltSocket.connect(opts(server)).catch((e) => e);
    expect(err.info.kind).toBe('noAppConnected');
    expect(err.message).toMatch(/no app/i);
  });

  it('a socket that never opens is reported as unreachable', async () => {
    const server = new FakeAltServer();
    const Broken = class extends server.WebSocket {
      constructor(url: string) {
        super(url);
        queueMicrotask(() => this.serverClose(1006));
      }
    };
    const err = await AltSocket.connect(opts(server, { WebSocketImpl: Broken })).catch((e) => e);
    expect(err.info.kind).toBe('unreachable');
  });
});

describe('AltSocket commands', () => {
  it('two-response command resolves with the payload only', async () => {
    const server = new FakeAltServer();
    const payload = { textureSize: { x: 8, y: 6, z: 0 }, scaleDifference: { x: 1, y: 1 }, compressedImage: 'AAA' };
    server.on('getScreenshot', () => [{ data: 'Ok' }, { data: payload }]);
    const socket = await AltSocket.connect(opts(server));
    const res = await socket.send({ commandName: 'getScreenshot', params: { quality: 100 }, responses: 2 });
    expect(res).toEqual(payload);
    socket.close();
  });

  it('three-response command can select the first and last frames together', async () => {
    const server = new FakeAltServer();
    const obj = { name: 'Cell', id: 7 };
    const img = { compressedImage: 'BBB' };
    server.on('hightlightObjectFromCoordinatesScreenshot', () => [{ data: obj }, { data: 'Ok' }, { data: img }]);
    const socket = await AltSocket.connect(opts(server));
    const res = await socket.send({
      commandName: 'hightlightObjectFromCoordinatesScreenshot',
      responses: 3,
      select: (frames) => ({ object: frames[0], image: frames[2] }),
    });
    expect(res).toEqual({ object: obj, image: img });
    socket.close();
  });

  it('pressKeyboardKeys with two keys and wait:true resolves only after two "Finished" frames', async () => {
    const server = new FakeAltServer();
    let cmdRef: Parameters<Parameters<FakeAltServer['on']>[1]>[0] | undefined;
    server.on('pressKeyboardKeys', (cmd, ws) => {
      cmdRef = cmd;
      setTimeout(() => ws.reply(cmd, { data: 'Ok' }), 0);
      setTimeout(() => ws.reply(cmd, { data: 'Finished' }), 5);
      return 'silent';
    });
    const socket = await AltSocket.connect(opts(server));
    let done = false;
    const p = socket
      .send({ commandName: 'pressKeyboardKeys', params: { keyCodes: [97, 98], wait: true }, responses: 3, kind: 'input' })
      .then(() => (done = true));
    await flush(20);
    expect(done).toBe(false);
    server.last().reply(cmdRef!, { data: 'Finished' });
    await p;
    expect(done).toBe(true);
    socket.close();
  });

  it('serializes: the second command is not written until the first completes', async () => {
    const server = new FakeAltServer();
    let firstCmd: Parameters<Parameters<FakeAltServer['on']>[1]>[0] | undefined;
    server.on('getAllComponents', (cmd) => {
      firstCmd = cmd;
      return 'silent';
    });
    const socket = await AltSocket.connect(opts(server));
    const a = socket.send({ commandName: 'getAllComponents', params: { altObjectId: 1 } });
    const b = socket.send({ commandName: 'getTimeScale' });
    await flush(5);
    expect(server.commandsNamed('getTimeScale')).toHaveLength(0);
    server.last().reply(firstCmd!, { data: [] });
    await a;
    await b;
    expect(server.commandsNamed('getTimeScale')).toHaveLength(1);
    socket.close();
  });

  it('three synchronous identical reads: the first goes on the wire, the next two collapse into one more wire call', async () => {
    const server = new FakeAltServer();
    let n = 0;
    server.on('getAllLoadedScenesAndObjects', () => [{ data: [{ name: 'Main', id: ++n }] }]);
    const socket = await AltSocket.connect(opts(server));
    const req = { commandName: 'getAllLoadedScenesAndObjects', params: { path: '//*', cameraBy: 2, cameraPath: '//*', enabled: true } };
    const results = await Promise.all([socket.send(req), socket.send(req), socket.send(req)]);
    expect(server.commandsNamed('getAllLoadedScenesAndObjects')).toHaveLength(2);
    expect(results[0]).toEqual([{ name: 'Main', id: 1 }]);
    expect(results[1]).toEqual([{ name: 'Main', id: 2 }]);
    expect(results[1]).toEqual(results[2]);
    socket.close();
  });

  it('does not collapse a read onto an identical read already in flight', async () => {
    const server = new FakeAltServer();
    const cmds: Parameters<Parameters<FakeAltServer['on']>[1]>[0][] = [];
    server.on('getAllLoadedScenesAndObjects', (cmd) => {
      cmds.push(cmd);
      return 'silent';
    });
    const socket = await AltSocket.connect(opts(server));
    const req = { commandName: 'getAllLoadedScenesAndObjects', params: { path: '//*', cameraBy: 2, cameraPath: '//*', enabled: true } };
    const first = socket.send(req);
    await flush(5);
    expect(cmds).toHaveLength(1);
    const second = socket.send(req);
    await flush(5);
    server.last().reply(cmds[0], { data: [{ name: 'Before', id: 0 }] });
    expect(await first).toEqual([{ name: 'Before', id: 0 }]);
    await flush(5);
    expect(server.commandsNamed('getAllLoadedScenesAndObjects')).toHaveLength(2);
    server.last().reply(cmds[1], { data: [{ name: 'After', id: 1 }] });
    expect(await second).toEqual([{ name: 'After', id: 1 }]);
    socket.close();
  });

  it('does not collapse identical input commands', async () => {
    const server = new FakeAltServer();
    const socket = await AltSocket.connect(opts(server));
    const req = { commandName: 'setTimeScale', params: { timeScale: 1 }, kind: 'input' as const };
    await Promise.all([socket.send(req), socket.send(req)]);
    expect(server.commandsNamed('setTimeScale')).toHaveLength(2);
    socket.close();
  });

  it('an error response rejects with a typed AltError carrying the message', async () => {
    const server = new FakeAltServer();
    server.on('findObject', () => [{ error: { type: 'notFound', message: 'Object //Foo not found' } }]);
    const socket = await AltSocket.connect(opts(server));
    const err = (await socket.send({ commandName: 'findObject' }).catch((e) => e)) as AltError;
    expect(err).toBeInstanceOf(AltError);
    expect(err.type).toBe('notFound');
    expect(err.message).toBe('Object //Foo not found');
    socket.close();
  });

  it('accepts a reply whose commandName is the server-rewritten game* variant', async () => {
    const server = new FakeAltServer();
    server.on('findObject', (cmd, ws) => {
      setTimeout(() => ws.push({ messageId: cmd.messageId, commandName: 'gameFindObject', isNotification: false, error: null, data: '{"id":3}' }), 0);
      return 'silent';
    });
    const socket = await AltSocket.connect(opts(server));
    expect(await socket.send({ commandName: 'findObject' })).toEqual({ id: 3 });
    socket.close();
  });

  it('a timeout rejects and the next queued command still runs; late replies are ignored', async () => {
    const server = new FakeAltServer();
    let stalled: Parameters<Parameters<FakeAltServer['on']>[1]>[0] | undefined;
    server.on('tapCoordinates', (cmd) => {
      stalled = cmd;
      return 'silent';
    });
    server.on('getTimeScale', () => [{ data: 1 }]);
    const socket = await AltSocket.connect(opts(server, { commandTimeoutMs: 30 }));
    const tap = socket.send({ commandName: 'tapCoordinates', kind: 'input' }).catch((e) => e);
    const next = socket.send({ commandName: 'getTimeScale' });
    expect(await tap).toBeInstanceOf(AltTimeoutError);
    server.last().reply(stalled!, { data: 'Ok' }); // late reply must not resolve anything
    expect(await next).toBe(1);
    socket.close();
  });

  it('a timed-out read is retried twice; a timed-out input is never retried', async () => {
    const server = new FakeAltServer();
    server.on('getAllComponents', () => 'silent');
    server.on('tapCoordinates', () => 'silent');
    const socket = await AltSocket.connect(opts(server, { commandTimeoutMs: 20 }));
    await socket.send({ commandName: 'getAllComponents', params: { altObjectId: 1 } }).catch(() => undefined);
    await socket.send({ commandName: 'tapCoordinates', kind: 'input' }).catch(() => undefined);
    expect(server.commandsNamed('getAllComponents')).toHaveLength(3);
    expect(server.commandsNamed('tapCoordinates')).toHaveLength(1);
    const ids = server.commandsNamed('getAllComponents').map((c) => c.messageId);
    expect(new Set(ids).size).toBe(3);
    socket.close();
  });

  it('closing with commands pending rejects them with the close reason', async () => {
    const server = new FakeAltServer();
    server.on('getAllComponents', () => 'silent');
    const socket = await AltSocket.connect(opts(server));
    const a = socket.send({ commandName: 'getAllComponents' }).catch((e) => e as AltConnectionError);
    const b = socket.send({ commandName: 'getTimeScale' }).catch((e) => e as AltConnectionError);
    await flush(5);
    server.last().serverClose(4002, 'gone');
    const [ea, eb] = (await Promise.all([a, b])) as AltConnectionError[];
    expect(ea).toBeInstanceOf(AltConnectionError);
    expect(ea.info.kind).toBe('appDisconnected');
    expect(eb.info.kind).toBe('appDisconnected');
    expect(socket.closed).toBe(true);
    await expect(socket.send({ commandName: 'getTimeScale' })).rejects.toBeInstanceOf(AltConnectionError);
  });
});

describe('AltSocket notifications and close', () => {
  it('routes scene notifications to subscribers', async () => {
    const server = new FakeAltServer();
    const socket = await AltSocket.connect(opts(server));
    const loads: unknown[] = [];
    const off = socket.onNotification('loadSceneNotification', (d) => loads.push(d));
    server.last().notify('loadSceneNotification', { sceneName: 'Game', loadSceneMode: 0 });
    off();
    server.last().notify('loadSceneNotification', { sceneName: 'Other', loadSceneMode: 0 });
    expect(loads).toEqual([{ sceneName: 'Game', loadSceneMode: 0 }]);
    socket.close();
  });

  it('the application-paused notification surfaces as an "app in background" state', async () => {
    const server = new FakeAltServer();
    const socket = await AltSocket.connect(opts(server));
    const states: boolean[] = [];
    socket.onPausedChange((p) => states.push(p));
    server.last().notify('applicationPausedNotification', true);
    expect(socket.paused).toBe(true);
    server.last().notify('applicationPausedNotification', false);
    expect(socket.paused).toBe(false);
    expect(states).toEqual([true, false]);
    socket.close();
  });

  it('reports a server-side close after connect to onClose listeners', async () => {
    const server = new FakeAltServer();
    const socket = await AltSocket.connect(opts(server));
    const closes: string[] = [];
    socket.onClose((info) => closes.push(info.kind));
    server.last().serverClose(4002);
    expect(closes).toEqual(['appDisconnected']);
  });

  it('ignores malformed frames', async () => {
    const server = new FakeAltServer();
    const socket = await AltSocket.connect(opts(server));
    server.last().push('not json');
    server.last().push({ messageId: 'unknown-id', commandName: 'x', data: '1' });
    expect(await socket.send<string>({ commandName: 'getServerVersion' })).toBe('2.3.3');
    socket.close();
  });
});
