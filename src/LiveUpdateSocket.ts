// Live view over /altws/live-update. After driverRegistered the client sends plain text frames
// "Quality:N", "FrameRate:N", "Start"; the app then streams one binary JPEG per frame. Start/Stop is
// global per app (every live-update driver of the app sees the frames), so Stop is sent only when
// this client sent Start.

import { describeClose, type CloseInfo } from './closeCodes';
import { buildConnectionUrl, type AppSelector, type ServerAddress } from './connectionUrl';
import { defaultWebSocket, WS_OPEN, type WebSocketCtor, type WebSocketLike } from './socketTypes';

export interface LiveUpdateOptions extends ServerAddress, AppSelector {
  driverType?: string;
  WebSocketImpl?: WebSocketCtor;
  quality?: number;
  frameRate?: number;
  /** Called with each frame's JPEG bytes. */
  onFrame: (jpeg: ArrayBuffer) => void;
  onClose?: (info: CloseInfo) => void;
}

export class LiveUpdateSocket {
  private readonly ws: WebSocketLike;
  private started = false;
  private opened = false;
  private closed = false;

  constructor(private readonly opts: LiveUpdateOptions) {
    const Impl = opts.WebSocketImpl ?? defaultWebSocket();
    this.ws = new Impl(buildConnectionUrl(opts, '/altws/live-update', opts, opts.driverType));
    this.ws.binaryType = 'arraybuffer';
    this.ws.onopen = () => {
      this.opened = true;
    };
    this.ws.onmessage = (ev) => {
      const data = ev.data;
      if (typeof data === 'string') {
        if (!this.started && data.includes('driverRegistered')) this.begin();
        return;
      }
      if (data instanceof ArrayBuffer) opts.onFrame(data);
      else if (ArrayBuffer.isView(data)) opts.onFrame(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
    };
    this.ws.onerror = () => {
      if (!this.opened) this.finish(describeClose(1006, '', { opened: false }));
    };
    this.ws.onclose = (ev) => this.finish(describeClose(ev.code, ev.reason ?? '', { opened: this.opened }));
  }

  /** True once this client sent Start. */
  get isStarted(): boolean {
    return this.started;
  }

  setFrameRate(frameRate: number): void {
    this.sendText(`FrameRate:${Math.round(frameRate)}`);
  }

  /** Stops the stream (only if this client started it) and closes the socket. */
  stop(): void {
    if (this.closed) return;
    if (this.started) this.sendText('Stop');
    this.started = false;
    this.closed = true;
    try {
      this.ws.close(1000);
    } catch {
      // already closing
    }
  }

  private begin(): void {
    this.sendText(`Quality:${Math.round(this.opts.quality ?? 25)}`);
    this.sendText(`FrameRate:${Math.round(this.opts.frameRate ?? 10)}`);
    this.sendText('Start');
    this.started = true;
  }

  private sendText(text: string): void {
    if (this.ws.readyState !== WS_OPEN) return;
    try {
      this.ws.send(text);
    } catch {
      // the close handler reports it
    }
  }

  private finish(info: CloseInfo): void {
    if (this.closed) return;
    this.closed = true;
    this.started = false;
    this.opts.onClose?.(info);
  }
}

/** Turns frames into object URLs, revoking the previous one so frames do not pile up in memory. */
export class FrameUrls {
  private current: string | null = null;

  constructor(
    private readonly create: (blob: Blob) => string = (b) => URL.createObjectURL(b),
    private readonly revoke: (url: string) => void = (u) => URL.revokeObjectURL(u),
  ) {}

  next(jpeg: ArrayBuffer): string {
    const url = this.create(new Blob([jpeg], { type: 'image/jpeg' }));
    if (this.current) this.revoke(this.current);
    this.current = url;
    return url;
  }

  dispose(): void {
    if (this.current) this.revoke(this.current);
    this.current = null;
  }
}
