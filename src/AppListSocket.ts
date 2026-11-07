// App list from /altws/connected-app-cli (KTD7). That endpoint is read-only: any text frame gets the
// connected apps back as a JSON array of Tags, and the server pushes updates. Opening it makes the
// server activate the paused notification in every connected app, so the client keeps ONE socket
// open and polls on it; it never reconnects on its own.

import { describeClose, type CloseInfo } from './closeCodes';
import { serverOrigin, type ServerAddress } from './connectionUrl';
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
      sdkVersion: typeof t.SdkVersion === 'string' && t.SdkVersion ? t.SdkVersion : null,
      olderVersion: Boolean(t.OlderVersion),
      isInBackground: Boolean(t.IsInBackground),
    }));
}

export class AppListSocket {
  private readonly ws: WebSocketLike;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private polling = true;
  private opened = false;
  private _state: AppListState = { status: 'connecting' };

  constructor(
    addr: ServerAddress,
    private readonly opts: AppListOptions,
  ) {
    const Impl = opts.WebSocketImpl ?? defaultWebSocket();
    this.ws = new Impl(`${serverOrigin(addr)}/altws/connected-app-cli`);
    this.ws.onopen = () => {
      this.opened = true;
      this.set({ status: 'open', apps: null });
      this.refresh();
      this.syncPolling();
    };
    this.ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string') return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(ev.data);
      } catch {
        return;
      }
      const apps = parseAppList(parsed); // driverRegistered and other objects are ignored
      if (apps && this._state.status === 'open') this.set({ status: 'open', apps });
    };
    // Node's WebSocket fires only `error` when the connection is refused; browsers also fire close.
    this.ws.onerror = () => {
      if (!this.opened) this.finish(describeClose(1006, '', { opened: false }));
    };
    this.ws.onclose = (ev) => this.finish(describeClose(ev.code, ev.reason ?? '', { opened: this.opened }));
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
    this.finish(describeClose(1000, '', { opened: true }));
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
