// In-memory stand-in for AltServer, used by driver and UI tests. It plugs into the driver through the
// `WebSocketImpl` option, so it needs no network, no Node APIs, and no DOM.

import type { WebSocketLike } from '../src/socketTypes';

export interface ReceivedCommand {
  messageId: string;
  commandName: string;
  [param: string]: unknown;
}

/** A reply frame: `data` is JSON-encoded once more by the fake, as the real server does. */
export type FakeReply =
  | { data: unknown; error?: undefined }
  | { error: { type: string; message: string; trace?: string }; data?: undefined };

export type CommandHandler = (cmd: ReceivedCommand, socket: FakeSocket) => FakeReply[] | 'silent' | void;

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 3;

export class FakeSocket implements WebSocketLike {
  readyState = CONNECTING;
  binaryType = 'blob';
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev: { code: number; reason: string }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  /** Every frame the client sent, raw. */
  readonly sent: string[] = [];
  readonly path: string;
  readonly query: URLSearchParams;

  constructor(
    readonly url: string,
    private readonly server: FakeAltServer,
  ) {
    const parsed = new URL(url);
    this.path = parsed.pathname;
    this.query = parsed.searchParams;
    server.sockets.push(this);
    setTimeout(() => server.accept(this), 0);
  }

  send(data: string): void {
    if (this.readyState !== OPEN) throw new Error('FakeSocket: send while not open');
    this.sent.push(data);
    this.server.receive(this, data);
  }

  close(code = 1000, reason = ''): void {
    if (this.readyState === CLOSED) return;
    this.readyState = CLOSED;
    this.server.closedByClient.push({ socket: this, code });
    setTimeout(() => this.onclose?.({ code, reason }), 0);
  }

  // ---- server-side helpers ----

  open(): void {
    this.readyState = OPEN;
    this.onopen?.({});
  }

  push(frame: unknown): void {
    if (this.readyState !== OPEN) return;
    this.onmessage?.({ data: typeof frame === 'string' || frame instanceof ArrayBuffer ? frame : JSON.stringify(frame) });
  }

  sendDriverRegistered(): void {
    this.push({ messageId: null, driverId: null, commandName: 'driverRegistered', isNotification: true });
  }

  notify(commandName: string, data: unknown): void {
    this.push({ messageId: null, driverId: 'd1', commandName, isNotification: true, data: JSON.stringify(data), error: null });
  }

  reply(cmd: ReceivedCommand, r: FakeReply): void {
    this.push({
      messageId: cmd.messageId,
      driverId: 'd1',
      commandName: cmd.commandName,
      isNotification: false,
      error: r.error ? { trace: '', ...r.error } : null,
      data: r.error ? null : JSON.stringify(r.data),
    });
  }

  serverClose(code: number, reason = ''): void {
    if (this.readyState === CLOSED) return;
    const wasOpen = this.readyState === OPEN;
    this.readyState = CLOSED;
    if (!wasOpen) this.onerror?.({});
    this.onclose?.({ code, reason });
  }

  /** Parsed JSON commands this socket sent (driver endpoint). */
  get commands(): ReceivedCommand[] {
    return this.sent.flatMap((s) => {
      try {
        const v = JSON.parse(s);
        return v && typeof v === 'object' && 'commandName' in v ? [v as ReceivedCommand] : [];
      } catch {
        return [];
      }
    });
  }
}

export interface FakeAltServerOptions {
  /** Send driverRegistered right after open (default true). */
  register?: boolean;
  /** Refuse every connection with this close code instead of opening. */
  refuseWith?: { code: number; reason?: string };
  serverVersion?: string;
  /** Paths this server does not serve (an older AltServer); the handshake fails as unreachable. */
  missingPaths?: string[];
}

/**
 * Answers the startup sequence by default (getServerVersion, activateNotification). Tests add handlers
 * per command with `on(commandName, handler)`. A handler returns the reply frames, 'silent' to never
 * reply, or nothing to fall through to the default (a single "Ok").
 */
export class FakeAltServer {
  readonly sockets: FakeSocket[] = [];
  readonly closedByClient: { socket: FakeSocket; code: number }[] = [];
  private readonly handlers = new Map<string, CommandHandler>();
  /** Text frames received on the app-list endpoints (/altws/connected-app-cli, /altws/connected-app) and /altws/live-update. */
  appListHandler: ((socket: FakeSocket, text: string) => void) | null = null;
  liveHandler: ((socket: FakeSocket, text: string) => void) | null = null;

  constructor(public options: FakeAltServerOptions = {}) {
    this.on('getServerVersion', () => [{ data: options.serverVersion ?? '2.3.3' }]);
    this.on('activateNotification', () => [{ data: 'Ok' }]);
  }

  /** Pass as `WebSocketImpl` to the driver. */
  get WebSocket(): new (url: string) => FakeSocket {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const server = this;
    return class extends FakeSocket {
      constructor(url: string) {
        super(url, server);
      }
    };
  }

  on(commandName: string, handler: CommandHandler): this {
    this.handlers.set(commandName, handler);
    return this;
  }

  /** Most recent socket for a path, e.g. '/altws'. */
  last(path = '/altws'): FakeSocket {
    const s = [...this.sockets].reverse().find((x) => x.path === path);
    if (!s) throw new Error(`no socket opened on ${path}`);
    return s;
  }

  /** Every driver command received, across sockets, excluding the startup sequence. */
  commandsNamed(name: string): ReceivedCommand[] {
    return this.sockets.flatMap((s) => s.commands).filter((c) => c.commandName === name);
  }

  accept(socket: FakeSocket): void {
    if (socket.readyState !== CONNECTING) return;
    if (this.options.missingPaths?.includes(socket.path)) {
      socket.serverClose(1006);
      return;
    }
    const refuse = this.options.refuseWith;
    if (refuse) {
      // A rejection after the upgrade still opens first, then closes with the code.
      socket.open();
      socket.serverClose(refuse.code, refuse.reason ?? '');
      return;
    }
    socket.open();
    if (this.options.register !== false) socket.sendDriverRegistered();
  }

  receive(socket: FakeSocket, text: string): void {
    if (socket.path === '/altws/connected-app-cli' || socket.path === '/altws/connected-app') return this.appListHandler?.(socket, text);
    if (socket.path === '/altws/live-update') return this.liveHandler?.(socket, text);
    const cmd = JSON.parse(text) as ReceivedCommand;
    const handler = this.handlers.get(cmd.commandName);
    const result = handler ? handler(cmd, socket) : undefined;
    if (result === 'silent') return;
    const replies = result ?? [{ data: 'Ok' }];
    // Reply asynchronously, like a real network round trip.
    setTimeout(() => replies.forEach((r) => socket.reply(cmd, r)), 0);
  }
}

/** Resolves after pending timers/microtasks of the fake have run. */
export function flush(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
