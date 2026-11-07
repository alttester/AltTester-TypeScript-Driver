// App list from /altws/connected-app-cli (KTD7). That endpoint is read-only: any text frame gets the
// connected apps back as a JSON array of Tags, and the server pushes updates. Opening it makes the
// server activate the paused notification in every connected app, so the client keeps ONE socket
// open and polls on it; it never reconnects on its own.
//
// AltServer added the CLI endpoint in 2.4.0. Older servers (including Desktop 2.3.x's embedded one)
// serve the same read-only list on /altws/connected-app, so a CLI handshake that fails before
// opening falls back to that path once. /altws/desktop (which accepts shutdown etc.) is never used.

import { closedByClient, connectFailed, describeClose, type CloseInfo } from './closeCodes';
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

export type AppListState =
  | { status: 'connecting' }
  | { status: 'open'; apps: AppInfo[] | null }
  | { status: 'closed'; info: CloseInfo };

export interface AppListOptions {
  WebSocketImpl?: WebSocketCtor;
  /** Re-send GetApps this often while polling is on (default 5 s), since pushes are sometimes suppressed. */
  pollMs?: number;
  onChange: (state: AppListState) => void;
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

/** AltServer stores the raw getServerVersion reply, JSON quotes included (e.g. "\"2.3.3\""). */
function sdkVersionOf(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const clean = v.replace(/"/g, '').trim();
  return clean || null;
}

export function parseAppList(frame: unknown): AppInfo[] | null {
  if (!Array.isArray(frame)) return null;
  return frame
    .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object' && !t.IsDriver)
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

const APP_LIST_PATHS = ['/altws/connected-app-cli', '/altws/connected-app'] as const;

export class AppListSocket {
  private ws: WebSocketLike;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private polling = true;
  private opened = false;
  private _state: AppListState = { status: 'connecting' };

  constructor(
    private readonly addr: ServerAddress,
    private readonly opts: AppListOptions,
  ) {
    this.ws = this.open(0);
  }

  /** The endpoint path in use (the CLI one, or the pre-2.4 fallback). */
  get path(): string {
    return APP_LIST_PATHS[this.pathIndex];
  }

  private pathIndex = 0;

  private open(pathIndex: number): WebSocketLike {
    this.pathIndex = pathIndex;
    const Impl = this.opts.WebSocketImpl ?? defaultWebSocket();
    const ws = new Impl(`${serverOrigin(this.addr)}${APP_LIST_PATHS[pathIndex]}`);
    // A failed handshake on the CLI path may just mean an older server: try the next path once.
    const failedBeforeOpen = (info: CloseInfo) => {
      if (ws !== this.ws || this._state.status === 'closed') return;
      if (pathIndex + 1 < APP_LIST_PATHS.length) this.ws = this.open(pathIndex + 1);
      else this.finish(info);
    };
    ws.onopen = () => {
      if (ws !== this.ws) return;
      this.opened = true;
      this.set({ status: 'open', apps: null });
      this.refresh();
      this.syncPolling();
    };
    ws.onmessage = (ev) => {
      if (ws !== this.ws || typeof ev.data !== 'string') return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(ev.data);
      } catch {
        return;
      }
      const apps = parseAppList(parsed); // driverRegistered and other objects are ignored
      if (apps && this._state.status === 'open') this.set({ status: 'open', apps });
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

  get state(): AppListState {
    return this._state;
  }

  /** Asks the server for the list now. */
  refresh(): void {
    if (this.ws.readyState !== WS_OPEN) return;
    try {
      this.ws.send('GetApps');
    } catch {
      // the close handler reports it
    }
  }

  /** Polling runs only while the picker is shown. */
  setPolling(on: boolean): void {
    this.polling = on;
    this.syncPolling();
  }

  close(): void {
    if (this._state.status === 'closed') return;
    this.finish(closedByClient());
    try {
      this.ws.close(1000);
    } catch {
      // already closing
    }
  }

  private syncPolling(): void {
    const want = this.polling && this._state.status === 'open';
    if (want && !this.pollTimer) {
      this.pollTimer = setInterval(() => this.refresh(), this.opts.pollMs ?? 5_000);
    } else if (!want && this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private finish(info: CloseInfo): void {
    if (this._state.status === 'closed') return;
    this.set({ status: 'closed', info });
    this.syncPolling();
  }

  private set(state: AppListState): void {
    this._state = state;
    this.opts.onChange(state);
  }
}
