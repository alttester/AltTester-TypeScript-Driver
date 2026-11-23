import { describe, expect, it } from 'vitest';
import { FakeAltServer, flush } from '../test/fakeAltServer';
import type { CloseInfo } from './closeCodes';
import { FrameUrls, LiveUpdateSocket } from './LiveUpdateSocket';

function setup(server = new FakeAltServer(), extra: { openTimeoutMs?: number } = {}) {
  const frames: ArrayBuffer[] = [];
  const closes: CloseInfo[] = [];
  const live = new LiveUpdateSocket({
    host: 'localhost',
    port: 13000,
    secure: false,
    appName: 'Game',
    WebSocketImpl: server.WebSocket,
    onFrame: (f) => frames.push(f),
    onClose: (i) => closes.push(i),
    ...extra,
  });
  return { server, live, frames, closes };
}

describe('LiveUpdateSocket', () => {
  it('reports unreachable when the socket never opens within openTimeoutMs', async () => {
    const { closes } = setup(new FakeAltServer({ scheme: 'wss', stallWrongScheme: true }), { openTimeoutMs: 20 });
    await new Promise((r) => setTimeout(r, 40));
    expect(closes.map((c) => c.kind)).toEqual(['unreachable']);
  });

  it('reports notRegistered when the socket opens but the server never registers it', async () => {
    const { server, closes } = setup(new FakeAltServer({ register: false }), { openTimeoutMs: 20 });
    await new Promise((r) => setTimeout(r, 40));
    expect(closes.map((c) => c.kind)).toEqual(['notRegistered']);
    expect(server.last('/altws/live-update').sent).toEqual([]);
  });

  it('does not time out once the stream has started', async () => {
    const { live, closes } = setup(new FakeAltServer(), { openTimeoutMs: 20 });
    await new Promise((r) => setTimeout(r, 40));
    expect(live.isStarted).toBe(true);
    expect(closes).toEqual([]);
    live.stop();
  });

  it('sends Quality:25, FrameRate:10, Start in that order after driverRegistered, with the app params', async () => {
    const { server, live } = setup();
    await flush(5);
    const ws = server.last('/altws/live-update');
    expect(ws.query.get('appName')).toBe('Game');
    expect(ws.query.get('driverType')).toBe('Desktop');
    expect(ws.sent).toEqual(['Quality:25', 'FrameRate:10', 'Start']);
    expect(live.isStarted).toBe(true);
    live.stop();
  });

  it('sends nothing before driverRegistered', async () => {
    const { server, live } = setup(new FakeAltServer({ register: false }));
    await flush(5);
    expect(server.last('/altws/live-update').sent).toEqual([]);
    live.stop();
    expect(server.last('/altws/live-update').sent).toEqual([]); // never started, so no Stop
  });

  it('delivers binary frames', async () => {
    const { server, live, frames } = setup();
    await flush(5);
    const ws = server.last('/altws/live-update');
    ws.push(new Uint8Array([0xff, 0xd8, 1]).buffer);
    ws.push(new Uint8Array([0xff, 0xd8, 2]).buffer);
    expect(frames.map((f) => new Uint8Array(f)[2])).toEqual([1, 2]);
    live.stop();
  });

  it('stop after starting sends Stop and closes; the server does not see a second Stop', async () => {
    const { server, live } = setup();
    await flush(5);
    live.stop();
    live.stop();
    const ws = server.last('/altws/live-update');
    expect(ws.sent.filter((s) => s === 'Stop')).toHaveLength(1);
    expect(server.closedByClient.map((c) => c.socket)).toContain(ws);
  });

  it('a 4005 close reports the licence limit', async () => {
    const { closes } = setup(new FakeAltServer({ refuseWith: { code: 4005, reason: 'Only one live update driver' } }));
    await flush(10);
    expect(closes[0]?.kind).toBe('multipleDrivers');
  });

  it('frame rate changes are sent as FrameRate:N', async () => {
    const { server, live } = setup();
    await flush(5);
    live.setFrameRate(24);
    expect(server.last('/altws/live-update').sent.at(-1)).toBe('FrameRate:24');
    live.stop();
  });
});

describe('FrameUrls', () => {
  it('three frames make three URLs and revoke the first two', () => {
    let n = 0;
    const revoked: string[] = [];
    const urls = new FrameUrls(
      () => `blob:${++n}`,
      (u) => revoked.push(u),
    );
    const made = [1, 2, 3].map(() => urls.next(new ArrayBuffer(2)));
    expect(made).toEqual(['blob:1', 'blob:2', 'blob:3']);
    expect(revoked).toEqual(['blob:1', 'blob:2']);
    urls.dispose();
    expect(revoked).toEqual(['blob:1', 'blob:2', 'blob:3']);
  });
});
