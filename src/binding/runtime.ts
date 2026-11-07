// Environment helpers: the WebSocket to use, base64, sleeping, and file writes in Node.

import { defaultWebSocket, type WebSocketCtor } from '../socketTypes';

interface NodeProcess {
  versions?: { node?: string };
}

export function isNode(): boolean {
  const proc = (globalThis as { process?: NodeProcess }).process;
  return typeof proc?.versions?.node === 'string';
}

// A variable specifier keeps browser bundlers from trying to resolve these Node-only modules.
const WS_MODULE = 'ws';
const FS_MODULE = 'node:fs/promises';

interface WsModule {
  default: new (url: string, opts?: Record<string, unknown>) => unknown;
}

export interface WebSocketChoice {
  /** Accept self-signed certificates for wss:// (Node only; browsers decide this themselves). */
  allowSelfSigned?: boolean;
}

/**
 * Node's built-in WebSocket (undici) receives empty text frames from AltServer (websocket-sharp) after
 * the first one, so in Node the `ws` package is used instead. Browsers use their own WebSocket.
 */
export async function chooseWebSocket(choice: WebSocketChoice = {}): Promise<WebSocketCtor> {
  if (!isNode()) return defaultWebSocket();
  let mod: WsModule;
  try {
    mod = (await import(/* @vite-ignore */ WS_MODULE)) as WsModule;
  } catch {
    throw new Error(
      "The 'ws' package is required in Node: Node's built-in WebSocket loses AltServer messages. Install it with `npm install ws`.",
    );
  }
  const WS = mod.default;
  const opts = choice.allowSelfSigned ? { rejectUnauthorized: false } : {};
  return class extends (WS as unknown as new (url: string, opts?: Record<string, unknown>) => object) {
    constructor(url: string) {
      super(url, opts);
    }
  } as unknown as WebSocketCtor;
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, seconds) * 1000));
}

export async function writeFileNode(path: string, bytes: Uint8Array): Promise<void> {
  if (!isNode()) throw new Error('Writing a file needs Node; in the browser use the returned bytes.');
  const fs = (await import(/* @vite-ignore */ FS_MODULE)) as { writeFile(p: string, d: Uint8Array): Promise<void> };
  await fs.writeFile(path, bytes);
}
