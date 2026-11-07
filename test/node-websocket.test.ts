// Runs the driver over a real network socket with Node's built-in global WebSocket (no DOM, no shim),
// against a minimal AltServer stand-in built on `ws`. Proves KTD10: the package works in Node 22+.

import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocketServer } from 'ws';
import { AltSocket } from '../src/AltSocket';

let wss: WebSocketServer | undefined;

afterEach(() => {
  wss?.close();
  wss = undefined;
});

function startServer(): Promise<{ port: number; urls: string[] }> {
  const urls: string[] = [];
  return new Promise((resolve) => {
    wss = new WebSocketServer({ port: 0 }, () => resolve({ port: (wss!.address() as AddressInfo).port, urls }));
    wss.on('connection', (ws, req) => {
      urls.push(req.url ?? '');
      ws.send(JSON.stringify({ messageId: null, driverId: null, commandName: 'driverRegistered', isNotification: true }));
      ws.on('message', (raw) => {
        const cmd = JSON.parse(String(raw));
        const data = cmd.commandName === 'getServerVersion' ? '2.3.3' : 'Ok';
        ws.send(JSON.stringify({ messageId: cmd.messageId, commandName: cmd.commandName, error: null, isNotification: false, data: JSON.stringify(data) }));
      });
    });
  });
}

describe('driver under Node 22 with the global WebSocket', () => {
  it('has a global WebSocket', () => {
    expect(typeof globalThis.WebSocket).toBe('function');
  });

  it('connects, registers, and runs a command over a real socket', async () => {
    const { port, urls } = await startServer();
    const socket = await AltSocket.connect({ host: '127.0.0.1', port, secure: false, appName: 'Game' });
    expect(socket.serverVersion).toBe('2.3.3');
    expect(await socket.send({ commandName: 'getTimeScale' })).toBe('Ok');
    expect(urls[0]).toMatch(/^\/altws\?.*driverType=Desktop/);
    socket.close();
  });

  it('reports an unreachable server', async () => {
    const err = await AltSocket.connect({ host: '127.0.0.1', port: 1, secure: false }).catch((e) => e);
    expect(err.info.kind).toBe('unreachable');
  });
});
