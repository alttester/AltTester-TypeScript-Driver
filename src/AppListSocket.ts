// Apps and drivers connected to an AltServer, read the way AltTester Desktop reads them.
//
// The first choice is /altws/desktop (KTD7, revised): it is the only endpoint whose list includes the
// connected drivers, it opens with a `desktopHandshake` frame carrying the licence and the app/driver
// limits, and it accepts `disconnectApp` / `disconnectDriver`. It also accepts `shutdown` and
// `changePort`; this class never sends those and exposes no way to.
//
// Servers that lack /altws/desktop fall back to the read-only list endpoints: /altws/connected-app-cli
// (AltServer 2.4+), then /altws/connected-app (older servers, including Desktop 2.3.x's embedded one).
// Those give apps only: no drivers, no limits, no disconnect.
//
// Opening any of these makes the server activate the paused notification in every connected app, so
// the client keeps ONE socket open and polls on it (pushes are suppressed in some server states); it
// never reconnects on its own. A server that stops answering the polls is reported as lost.

import {
  closedByClient,
  connectFailed,
  describeClose,
  secureMismatch,
  serverStoppedAnswering,
  type CloseInfo,
} from './closeCodes';
import { serverOrigin, type AppSelector, type ServerAddress } from './connectionUrl';
import { defaultWebSocket, WS_OPEN, type WebSocketCtor, type WebSocketLike } from './socketTypes';

/** Tags of one connected app (AltServer/AltServer/Tags/Tags.cs), camelCased. */
export interface AppInfo {
  name: string;
  platform: string;
  platformVersion: string;
  deviceInstanceId: string;
  gameEngine: string;
  appId: string;
  sdkVersion: string | null;
  olderVersion: boolean;
  isInBackground: boolean;
}

/** The query parameters that address this app on the driver and live-update endpoints. */
export function appSelectorFor(app: AppInfo): AppSelector {
  return {
    appName: app.name,
    appId: app.appId || undefined,
    platform: app.platform,
    platformVersion: app.platformVersion,
    deviceInstanceId: app.deviceInstanceId,
  };
}

/** A driver connected to one of the server's apps (a Tags entry with IsDriver set). */
export interface DriverInfo {
  driverId: string;
  driverType: string;
  /** The app the driver is connected to. */
  appId: string;
}

/** What the server's licence allows, from the desktopHandshake frame (or the bare limit frame). */
export interface ServerLimits {
  /** e.g. FREEMIUM, PREMIUM, ENTERPRISE; empty when only the bare limit frame arrived. */
  licenseType: string;
  /** UNITY, UNREAL, ALL; empty when unknown. */
  gameEngine: string;
  maxApps: number;
  maxDrivers: number;
}

export interface AppListOpen {
  status: 'open';
  /** Null until the first list arrives. */
  apps: AppInfo[] | null;
  /** Null until the first list arrives, and always null on the read-only endpoints. */
  drivers: DriverInfo[] | null;
  limits: ServerLimits | null;
  /** True on /altws/desktop: disconnectApp / disconnectDriver are available. */
  control: boolean;
}

export type AppListState = { status: 'connecting' } | AppListOpen | { status: 'closed'; info: CloseInfo };

export interface AppListOptions {
  WebSocketImpl?: WebSocketCtor;
  /** Re-send the list request this often while polling is on (default 5 s), since pushes are sometimes suppressed. */
  pollMs?: number;
  /** Report the server as lost when nothing arrives for this long while polling (default 3 polls). 0 turns it off. */
  staleMs?: number;
  /** When the server can't be reached, try the other scheme to tell a ws/wss mix-up apart (default true). */
  probeScheme?: boolean;
  /** How long the ws/wss probe waits (default 3 s). */
  probeTimeoutMs?: number;
  /**
   * Give up on an endpoint whose upgrade has not finished after this long (default 5 s). A wss:// socket
   * to a plain ws server stalls in the TLS handshake instead of failing, so without this it never ends.
   */
  openTimeoutMs?: number;
  onChange: (state: AppListState) => void;
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

/** AltServer stores the raw getServerVersion reply, JSON quotes included (e.g. "\"2.3.3\""). */
function sdkVersionOf(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const clean = v.replace(/"/g, '').trim();
  return clean || null;
}

const isTags = (t: unknown): t is Record<string, unknown> => !!t && typeof t === 'object';

/** The apps in a Tags[] frame (driver entries are left out); null if the frame is not a list. */
export function parseAppList(frame: unknown): AppInfo[] | null {
  if (!Array.isArray(frame)) return null;
  return frame
    .filter((t): t is Record<string, unknown> => isTags(t) && !t.IsDriver)
    .map((t) => ({
      name: str(t.Name),
      platform: str(t.Platform, 'unknown'),
      platformVersion: str(t.PlatformVersion, 'unknown'),
      deviceInstanceId: str(t.DeviceInstanceId, 'unknown'),
      gameEngine: str(t.GameEngine, 'unknown'),
      appId: str(t.AppId),
      sdkVersion: sdkVersionOf(t.SdkVersion),
      olderVersion: Boolean(t.OlderVersion),
      isInBackground: Boolean(t.IsInBackground),
    }));
}

/** The drivers in a Tags[] frame; null if the frame is not a list. */
export function parseDriverList(frame: unknown): DriverInfo[] | null {
  if (!Array.isArray(frame)) return null;
  return frame
    .filter((t): t is Record<string, unknown> => isTags(t) && Boolean(t.IsDriver))
    .map((t) => ({ driverId: str(t.DriverId), driverType: str(t.DriverType, 'unknown'), appId: str(t.AppId) }));
}

/** The limits in a desktopHandshake frame, or null if the frame is something else. */
export function parseDesktopHandshake(frame: unknown): ServerLimits | null {
  if (!isTags(frame) || frame.commandName !== 'desktopHandshake' || !isTags(frame.data)) return null;
  const d = frame.data;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    licenseType: str(d.licenseType),
    gameEngine: str(d.gameEngine),
    maxApps: num(d.noOfAppConnection),
    maxDrivers: num(d.noOfDriverConnection),
  };
}

export const DESKTOP_PATH = '/altws/desktop';
const APP_LIST_PATHS = [DESKTOP_PATH, '/altws/connected-app-cli', '/altws/connected-app'] as const;
/** Served by every AltServer version; the ws/wss probe only needs the upgrade to succeed. */
const PROBE_PATH = '/altws/connected-app';

export class AppListSocket {
  private ws: WebSocketLike;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private polling = true;
  private opened = false;
  private lastFrameAt = 0;
  private probe: WebSocketLike | null = null;
  private probeTimer: ReturnType<typeof setTimeout> | null = null;
  private openTimer: ReturnType<typeof setTimeout> | null = null;
  private _state: AppListState = { status: 'connecting' };

  constructor(
    private readonly addr: ServerAddress,
    private readonly opts: AppListOptions,
  ) {
    this.ws = this.open(0);
  }

  /** The endpoint path in use (the desktop one, or a read-only fallback). */
  get path(): string {
    return APP_LIST_PATHS[this.pathIndex];
  }

  private pathIndex = 0;

  private get control(): boolean {
    return this.path === DESKTOP_PATH;
  }

  private open(pathIndex: number): WebSocketLike {
    this.pathIndex = pathIndex;
    const Impl = this.opts.WebSocketImpl ?? defaultWebSocket();
    const ws = new Impl(`${serverOrigin(this.addr)}${APP_LIST_PATHS[pathIndex]}`);
    // A failed handshake may just mean an older server without this endpoint: try the next path once.
    const failedBeforeOpen = (info: CloseInfo) => {
      if (ws !== this.ws || this._state.status === 'closed') return;
      this.clearOpenTimer();
      if (pathIndex + 1 < APP_LIST_PATHS.length) this.ws = this.open(pathIndex + 1);
      else this.unreachable(info);
    };
    // A stalled upgrade is not a missing endpoint (that fails fast), so skip the fallbacks and go
    // straight to the scheme probe.
    this.clearOpenTimer();
    this.openTimer = setTimeout(() => {
      if (ws !== this.ws || this.opened || this._state.status === 'closed') return;
      this.openTimer = null;
      ws.onopen = null;
      ws.onerror = null;
      ws.onclose = null;
      try {
        ws.close();
      } catch {
        // still connecting
      }
      this.unreachable(connectFailed());
    }, this.opts.openTimeoutMs ?? 5_000);
    ws.onopen = () => {
      if (ws !== this.ws) return;
      this.clearOpenTimer();
      this.opened = true;
      this.lastFrameAt = Date.now();
      this.set({ status: 'open', apps: null, drivers: null, limits: null, control: this.control });
      this.refresh();
      this.syncPolling();
    };
    ws.onmessage = (ev) => {
      if (ws !== this.ws || typeof ev.data !== 'string') return;
      this.lastFrameAt = Date.now();
      this.handleFrame(ev.data);
    };
    // Node's WebSocket fires only `error` when refused; browsers fire `error` then `close`.
    ws.onerror = () => {
      if (!this.opened) failedBeforeOpen(connectFailed());
    };
    ws.onclose = (ev) => {
      if (ws !== this.ws) return;
      const info = describeClose(ev.code, ev.reason ?? '', { opened: this.opened });
      if (this.opened) this.finish(info);
      else failedBeforeOpen(info);
    };
    return ws;
  }

  private handleFrame(text: string): void {
    const state = this._state;
    if (state.status !== 'open') return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return;
    }
    const handshake = parseDesktopHandshake(parsed);
    if (handshake) {
      this.set({ ...state, limits: handshake });
      return;
    }
    // The bare number frame is the older limit signal; the handshake, when present, is more precise.
    if (typeof parsed === 'number') {
      if (!state.limits) this.set({ ...state, limits: { licenseType: '', gameEngine: '', maxApps: parsed, maxDrivers: parsed } });
      return;
    }
    const apps = parseAppList(parsed); // driverRegistered and other objects are ignored
    if (!apps) return;
    this.set({ ...state, apps, drivers: this.control ? parseDriverList(parsed) : null });
  }

  get state(): AppListState {
    return this._state;
  }

  /** Asks the server for the list now. */
  refresh(): void {
    this.sendText(this.control ? JSON.stringify({ commandName: 'getConnectedApps' }) : 'GetApps');
  }

  /** Closes an app's connection to the server. False when this endpoint can't (a read-only fallback). */
  disconnectApp(appId: string): boolean {
    if (!this.control || this._state.status !== 'open') return false;
    return this.sendText(JSON.stringify({ commandName: 'disconnectApp', data: { appId } }));
  }

  /** Closes one driver's connection to an app. False when this endpoint can't (a read-only fallback). */
  disconnectDriver(driverId: string, appId: string): boolean {
    if (!this.control || this._state.status !== 'open') return false;
    return this.sendText(JSON.stringify({ commandName: 'disconnectDriver', data: { driverId, appId } }));
  }

  /** Polling (and the stopped-answering check) runs only while the picker is shown. */
  setPolling(on: boolean): void {
    this.polling = on;
    if (on) this.lastFrameAt = Date.now();
    this.syncPolling();
  }

  close(): void {
    this.clearOpenTimer();
    this.stopProbe();
    if (this._state.status === 'closed') return;
    this.finish(closedByClient());
    this.closeSocket();
  }

  private sendText(text: string): boolean {
    if (this.ws.readyState !== WS_OPEN) return false;
    try {
      this.ws.send(text);
      return true;
    } catch {
      return false; // the close handler reports it
    }
  }

  private closeSocket(): void {
    try {
      this.ws.close(1000);
    } catch {
      // already closing
    }
  }

  private syncPolling(): void {
    const want = this.polling && this._state.status === 'open';
    const pollMs = this.opts.pollMs ?? 5_000;
    if (want && !this.pollTimer) {
      this.pollTimer = setInterval(() => this.tick(pollMs), pollMs);
    } else if (!want && this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private tick(pollMs: number): void {
    const staleMs = this.opts.staleMs ?? pollMs * 3;
    if (staleMs > 0 && Date.now() - this.lastFrameAt > staleMs) {
      this.finish(serverStoppedAnswering());
      this.closeSocket();
      return;
    }
    this.refresh();
  }

  /**
   * Every endpoint failed before opening. Browsers give no detail on a failed upgrade, so try the other
   * scheme once: if it opens, the server is up and the Secure setting is the problem.
   */
  private unreachable(info: CloseInfo): void {
    if (this.probe) return; // browsers report one failure as error, then close
    if (this.opts.probeScheme === false || this._state.status === 'closed') {
      this.finish(info);
      return;
    }
    const other: ServerAddress = { ...this.addr, secure: !this.addr.secure };
    let probe: WebSocketLike;
    try {
      const Impl = this.opts.WebSocketImpl ?? defaultWebSocket();
      probe = new Impl(`${serverOrigin(other)}${PROBE_PATH}`);
    } catch {
      this.finish(info); // e.g. ws:// from an HTTPS page is refused outright
      return;
    }
    this.probe = probe;
    const settle = (result: CloseInfo) => {
      if (this.probe !== probe) return;
      this.stopProbe();
      this.finish(result);
    };
    probe.onopen = () => settle(secureMismatch(this.addr.secure));
    probe.onerror = () => settle(info);
    probe.onclose = () => settle(info);
    this.probeTimer = setTimeout(() => settle(info), this.opts.probeTimeoutMs ?? 3_000);
  }

  private clearOpenTimer(): void {
    if (this.openTimer) clearTimeout(this.openTimer);
    this.openTimer = null;
  }

  private stopProbe(): void {
    if (this.probeTimer) clearTimeout(this.probeTimer);
    this.probeTimer = null;
    const probe = this.probe;
    this.probe = null;
    if (!probe) return;
    probe.onopen = null;
    probe.onerror = null;
    probe.onclose = null;
    try {
      probe.close(1000);
    } catch {
      // never opened
    }
  }

  private finish(info: CloseInfo): void {
    this.clearOpenTimer();
    if (this._state.status === 'closed') return;
    this.set({ status: 'closed', info });
    this.syncPolling();
  }

  private set(state: AppListState): void {
    this._state = state;
    this.opts.onChange(state);
  }
}
