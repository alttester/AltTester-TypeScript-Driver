// Driver socket for AltServer's /altws endpoint (KTD4). Ported from the Python binding's queueing
// (Bindings~/python/alttester/_websocket.py) with Desktop's timeout and retry rules
// (AltDriverController.cs): one command in flight, FIFO, consecutive duplicate reads collapse,
// 60 s timeout, reads retried up to twice on timeout, inputs never retried.

import { closedByClient, connectFailed, describeClose, formatClose, type CloseInfo } from './closeCodes';
import { buildConnectionUrl, type AppSelector, type ServerAddress } from './connectionUrl';
import { defaultWebSocket, WS_OPEN, type WebSocketCtor, type WebSocketLike } from './socketTypes';

export interface ConnectOptions extends ServerAddress, AppSelector {
  driverType?: string;
  WebSocketImpl?: WebSocketCtor;
  /** How long to wait for `driverRegistered` after open (default 5 s). */
  registerTimeoutMs?: number;
  /** Per-command response timeout (default 60 s). */
  commandTimeoutMs?: number;
  /** Retries for read commands that time out (default 2). */
  maxRetries?: number;
  /** Interval for a liveness `getServerVersion` while idle; 0 disables (default). */
  heartbeatMs?: number;
}

export type CommandKind = 'read' | 'input';

export interface CommandRequest<T = unknown> {
  commandName: string;
  params?: Record<string, unknown>;
  /** Number of response frames this command produces for its messageId (default 1). */
  responses?: number;
  /** 'input' commands are never retried or collapsed (default 'read'). */
  kind?: CommandKind;
  /** Builds the result from all parsed frames (default: the last frame). */
  select?: (frames: unknown[]) => T;
  timeoutMs?: number;
}

export type NotificationName =
  | 'loadSceneNotification'
  | 'unloadSceneNotification'
  | 'applicationPausedNotification'
  | 'logNotification';

/** NotificationType values for activateNotification (LOADSCENE, UNLOADSCENE, APPLICATION_PAUSED). */
const STARTUP_NOTIFICATIONS = [0, 1, 3];

export class AltError extends Error {
  constructor(
    readonly type: string,
    message: string,
    readonly trace = '',
  ) {
    super(message);
    this.name = 'AltError';
  }
}

export class AltTimeoutError extends Error {
  constructor(readonly commandName: string, timeoutMs: number) {
    super(`${commandName} got no reply within ${Math.round(timeoutMs / 1000)} s.`);
    this.name = 'AltTimeoutError';
  }
}

export class AltConnectionError extends Error {
  constructor(readonly info: CloseInfo) {
    super(formatClose(info));
    this.name = 'AltConnectionError';
  }
}

interface QueueItem {
  req: CommandRequest<unknown>;
  key: string | null;
  attempt: number;
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
  /** Extra waiters that collapsed onto this item. */
  shared: { resolve: (v: unknown) => void; reject: (e: unknown) => void }[];
}

interface InFlight {
  item: QueueItem;
  messageId: string;
  frames: unknown[];
  timer: ReturnType<typeof setTimeout>;
}

interface Frame {
  messageId?: string | null;
  /** The id the server gave this driver connection; set on command replies, null on driverRegistered. */
  driverId?: string | null;
  commandName?: string;
  isNotification?: boolean;
  data?: string | null;
  error?: { type: string; message: string; trace?: string } | null;
}

let idCounter = 0;
function newMessageId(): string {
  idCounter = (idCounter + 1) % Number.MAX_SAFE_INTEGER;
  return `${Date.now()}-${idCounter}`;
}

function parseData(data: string | null | undefined): unknown {
  if (data == null) return null;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

function sameCommand(sent: string, received: string | undefined): boolean {
  if (!received || received === sent) return true;
  // AltServer renames find-type commands for older SDKs, e.g. findObject -> gameFindObject.
  return received === `game${sent[0].toUpperCase()}${sent.slice(1)}`;
}

export class AltSocket {
  private readonly queue: QueueItem[] = [];
  private inFlight: InFlight | null = null;
  private readonly notificationListeners = new Map<string, Set<(data: unknown) => void>>();
  private readonly closeListeners = new Set<(info: CloseInfo) => void>();
  private readonly pausedListeners = new Set<(paused: boolean) => void>();
  private closeInfo: CloseInfo | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private _paused = false;
  private _serverVersion = '';
  private _driverId: string | null = null;

  private constructor(
    private readonly ws: WebSocketLike,
    private readonly options: Required<Pick<ConnectOptions, 'commandTimeoutMs' | 'maxRetries'>>,
  ) {}

  /** Opens the socket, waits for registration, and runs the startup sequence. */
  static connect(opts: ConnectOptions): Promise<AltSocket> {
    const Impl = opts.WebSocketImpl ?? defaultWebSocket();
    const url = buildConnectionUrl(opts, '/altws', opts, opts.driverType);
    const ws = new Impl(url);
    const socket = new AltSocket(ws, {
      commandTimeoutMs: opts.commandTimeoutMs ?? 60_000,
      maxRetries: opts.maxRetries ?? 2,
    });
    return socket.start(opts.registerTimeoutMs ?? 5_000, opts.heartbeatMs ?? 0);
  }

  get serverVersion(): string {
    return this._serverVersion;
  }

  /**
   * The server's id for this driver connection, the same id the server lists it under (a Tags entry's
   * DriverId). Known once the first command reply arrives, so always set after `connect` resolves.
   */
  get driverId(): string | null {
    return this._driverId;
  }

  /** True while the app reports it is in the background. */
  get paused(): boolean {
    return this._paused;
  }

  get closed(): boolean {
    return this.closeInfo !== null;
  }

  send<T = unknown>(req: CommandRequest<T>): Promise<T> {
    if (this.closeInfo) return Promise.reject(new AltConnectionError(this.closeInfo));
    const kind = req.kind ?? 'read';
    const key = kind === 'read' ? `${req.commandName}|${JSON.stringify(req.params ?? {})}|${req.responses ?? 1}` : null;
    return new Promise<T>((resolve, reject) => {
      // Collapse only onto the last *queued* command, never the one already on the wire:
      // its response may predate a change (e.g. a scene load) that triggered this read.
      const tail = this.queue[this.queue.length - 1];
      if (key && tail && tail.key === key && !req.select && !tail.req.select) {
        tail.shared.push({ resolve: resolve as (v: unknown) => void, reject });
        return;
      }
      this.queue.push({ req: req as CommandRequest<unknown>, key, attempt: 0, resolve: resolve as (v: unknown) => void, reject, shared: [] });
      this.pump();
    });
  }

  onNotification(name: NotificationName, cb: (data: unknown) => void): () => void {
    let set = this.notificationListeners.get(name);
    if (!set) this.notificationListeners.set(name, (set = new Set()));
    set.add(cb);
    return () => set!.delete(cb);
  }

  onPausedChange(cb: (paused: boolean) => void): () => void {
    this.pausedListeners.add(cb);
    return () => this.pausedListeners.delete(cb);
  }

  onClose(cb: (info: CloseInfo) => void): () => void {
    this.closeListeners.add(cb);
    return () => this.closeListeners.delete(cb);
  }

  close(): void {
    if (this.closeInfo) return;
    this.handleClose(closedByClient());
    try {
      this.ws.close(1000);
    } catch {
      // already closing
    }
  }

  // ---- internals ----

  private start(registerTimeoutMs: number, heartbeatMs: number): Promise<AltSocket> {
    return new Promise<AltSocket>((resolve, reject) => {
      let opened = false;
      let registered = false;
      let registerTimer: ReturnType<typeof setTimeout> | null = null;
      const fail = (info: CloseInfo) => {
        if (registerTimer) clearTimeout(registerTimer);
        reject(new AltConnectionError(info));
      };

      this.ws.binaryType = 'arraybuffer';
      this.ws.onopen = () => {
        opened = true;
        registerTimer = setTimeout(() => {
          const info: CloseInfo = {
            code: 0,
            kind: 'notRegistered',
            message: 'The server is reachable but did not register this driver in time.',
            serverReason: '',
          };
          this.closeInfo = info;
          this.rejectAll(info);
          try {
            this.ws.close(1000);
          } catch {
            // ignore
          }
          fail(info);
        }, registerTimeoutMs);
      };
      this.ws.onerror = () => {
        // See connectFailed(); after open, the close event that follows carries the code.
        if (opened || registered) return;
        const info = connectFailed();
        this.closeInfo = info;
        fail(info);
      };
      this.ws.onclose = (ev) => {
        const info = describeClose(ev.code, ev.reason ?? '', { opened });
        if (!registered) {
          this.closeInfo = info;
          fail(info);
          return;
        }
        this.handleClose(info);
      };
      this.ws.onmessage = (ev) => {
        if (typeof ev.data !== 'string') return;
        let frame: Frame;
        try {
          frame = JSON.parse(ev.data) as Frame;
        } catch {
          return;
        }
        if (!frame || typeof frame !== 'object') return;
        if (frame.commandName === 'driverRegistered') {
          if (registered || this.closeInfo) return;
          registered = true;
          if (registerTimer) clearTimeout(registerTimer);
          this.runStartup().then(
            () => {
              if (heartbeatMs > 0) this.startHeartbeat(heartbeatMs);
              resolve(this);
            },
            (e) => {
              this.close();
              reject(e);
            },
          );
          return;
        }
        this.handleFrame(frame);
      };
    });
  }

  private async runStartup(): Promise<void> {
    this._serverVersion = String(await this.send<string>({ commandName: 'getServerVersion' }));
    for (const type of STARTUP_NOTIFICATIONS) {
      await this.send({ commandName: 'activateNotification', params: { NotificationType: type }, kind: 'input' });
    }
  }

  private startHeartbeat(ms: number): void {
    this.heartbeat = setInterval(() => {
      if (this.inFlight || this.queue.length) return;
      this.send({ commandName: 'getServerVersion', kind: 'input' }).catch(() => undefined);
    }, ms);
  }

  private handleFrame(frame: Frame): void {
    if (!this._driverId && typeof frame.driverId === 'string' && frame.driverId) this._driverId = frame.driverId;
    if (frame.isNotification) {
      const name = frame.commandName ?? '';
      const data = parseData(frame.data);
      if (name === 'applicationPausedNotification') {
        const paused = Boolean(data);
        if (paused !== this._paused) {
          this._paused = paused;
          this.pausedListeners.forEach((cb) => cb(paused));
        }
      }
      this.notificationListeners.get(name)?.forEach((cb) => cb(data));
      return;
    }
    const id = frame.messageId ?? '';
    const current = this.inFlight;
    if (!current || id !== current.messageId) return; // timed out, retried, or unknown: drop
    if (!sameCommand(current.item.req.commandName, frame.commandName)) return;

    if (frame.error) {
      this.finish(current, () => {
        const err = new AltError(frame.error!.type, frame.error!.message, frame.error!.trace ?? '');
        this.settle(current.item, err, true);
      });
      return;
    }
    current.frames.push(parseData(frame.data));
    if (current.frames.length < (current.item.req.responses ?? 1)) return;
    this.finish(current, () => {
      const select = current.item.req.select ?? ((f: unknown[]) => f[f.length - 1]);
      let value: unknown;
      try {
        value = select(current.frames);
      } catch (e) {
        this.settle(current.item, e, true);
        return;
      }
      this.settle(current.item, value, false);
    });
  }

  private finish(current: InFlight, then: () => void): void {
    clearTimeout(current.timer);
    this.inFlight = null;
    then();
    this.pump();
  }

  private settle(item: QueueItem, value: unknown, isError: boolean): void {
    const all = [{ resolve: item.resolve, reject: item.reject }, ...item.shared];
    for (const w of all) (isError ? w.reject : w.resolve)(value);
  }

  private pump(): void {
    if (this.inFlight || this.closeInfo || this.ws.readyState !== WS_OPEN) return;
    const item = this.queue.shift();
    if (!item) return;
    const messageId = newMessageId();
    const timeoutMs = item.req.timeoutMs ?? this.options.commandTimeoutMs;
    const timer = setTimeout(() => this.onTimeout(messageId, timeoutMs), timeoutMs);
    this.inFlight = { item, messageId, frames: [], timer };
    const message = { ...(item.req.params ?? {}), messageId, commandName: item.req.commandName, isNotification: false };
    try {
      this.ws.send(JSON.stringify(message));
    } catch (e) {
      clearTimeout(timer);
      this.inFlight = null;
      this.settle(item, e, true);
      this.pump();
    }
  }

  private onTimeout(messageId: string, timeoutMs: number): void {
    const current = this.inFlight;
    if (!current || current.messageId !== messageId) return;
    this.inFlight = null;
    const { item } = current;
    const canRetry = (item.req.kind ?? 'read') === 'read' && item.attempt < this.options.maxRetries;
    if (canRetry) {
      item.attempt += 1;
      this.queue.unshift(item); // retry before anything queued after it
    } else {
      this.settle(item, new AltTimeoutError(item.req.commandName, timeoutMs), true);
    }
    this.pump();
  }

  private rejectAll(info: CloseInfo): void {
    const err = new AltConnectionError(info);
    if (this.inFlight) {
      clearTimeout(this.inFlight.timer);
      this.settle(this.inFlight.item, err, true);
      this.inFlight = null;
    }
    for (const item of this.queue.splice(0)) this.settle(item, err, true);
  }

  private handleClose(info: CloseInfo): void {
    if (this.closeInfo) return;
    this.closeInfo = info;
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.rejectAll(info);
    this.closeListeners.forEach((cb) => cb(info));
  }
}
