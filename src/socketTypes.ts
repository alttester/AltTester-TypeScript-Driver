// The slice of the standard WebSocket API the driver uses. Browsers and Node 22+ provide it as the
// global `WebSocket`; tests inject an in-memory fake with the same shape.

export interface WebSocketLike {
  readonly readyState: number;
  binaryType: string;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: { code: number; reason: string }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export type WebSocketCtor = new (url: string) => WebSocketLike;

export const WS_OPEN = 1;

export function defaultWebSocket(): WebSocketCtor {
  const ctor = (globalThis as { WebSocket?: unknown }).WebSocket;
  if (typeof ctor !== 'function') throw new Error('No global WebSocket; pass WebSocketImpl (Node 22+ has one).');
  return ctor as WebSocketCtor;
}
