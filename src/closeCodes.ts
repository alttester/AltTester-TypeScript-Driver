// WebSocket close codes AltServer uses (AltServer/AltServer/Utils/Utils.cs) mapped to plain-language
// reasons for the user (R3). The server's own reason text is kept alongside, because for some codes
// (licence limits) it carries the numbers the user needs.

export type CloseKind =
  | 'unreachable'
  | 'notRegistered'
  | 'noAppConnected'
  | 'appDisconnected'
  | 'invalidAppName'
  | 'multipleApps'
  | 'multipleDrivers'
  | 'unsupportedPlatform'
  | 'concurrentConnect'
  | 'connectionLimit'
  | 'driverLimit'
  | 'unsupportedGameEngine'
  | 'unsupportedSdk'
  | 'mcpLimit'
  | 'cliLimit'
  | 'driverTypeNotAllowed'
  | 'handshakeFailed'
  | 'cryptoError'
  | 'disconnectedByDesktop'
  | 'normal'
  | 'unknown';

export interface CloseInfo {
  code: number;
  kind: CloseKind;
  /** Plain-language explanation for the user. */
  message: string;
  /** Reason text the server sent, if any. */
  serverReason: string;
}

const CLOSE_CODES: Record<number, { kind: CloseKind; message: string }> = {
  4001: { kind: 'noAppConnected', message: 'No app matching the selection is connected to this server.' },
  4002: { kind: 'appDisconnected', message: 'The app closed the connection or disconnected unexpectedly.' },
  4003: { kind: 'invalidAppName', message: 'The app name is not valid.' },
  4004: { kind: 'multipleApps', message: 'More than one app matches; pick a specific app.' },
  4005: {
    kind: 'multipleDrivers',
    message: 'Another driver is already connected to this app and your licence allows only one.',
  },
  4006: { kind: 'unsupportedPlatform', message: "This server's licence does not support the app's platform." },
  4007: {
    kind: 'concurrentConnect',
    message: 'Another driver is connecting to this app at the same moment. Try again in a few seconds.',
  },
  4008: { kind: 'connectionLimit', message: "The server's app connection limit for this licence is reached." },
  4009: { kind: 'driverLimit', message: "The server's driver limit for this licence is reached." },
  4010: { kind: 'unsupportedGameEngine', message: "This server's licence does not support the app's game engine." },
  4011: { kind: 'unsupportedSdk', message: 'The server does not support the SDK version this app uses.' },
  4012: { kind: 'mcpLimit', message: "The server's MCP driver limit for this licence is reached." },
  4013: { kind: 'cliLimit', message: "The server's CLI driver limit for this licence is reached." },
  4014: { kind: 'driverTypeNotAllowed', message: "This server's licence does not allow this kind of driver." },
  4015: { kind: 'handshakeFailed', message: 'The app failed the security handshake with the server.' },
  4016: { kind: 'cryptoError', message: 'The server hit an encryption error.' },
  4017: { kind: 'disconnectedByDesktop', message: 'The connection was closed from AltTester Desktop.' },
};

export function describeClose(code: number, serverReason = '', opts: { opened?: boolean } = {}): CloseInfo {
  const known = CLOSE_CODES[code];
  if (known) return { code, ...known, serverReason };
  if (code === 1000) return { code, kind: 'normal', message: 'The connection was closed.', serverReason };
  if (!opts.opened) {
    return {
      code,
      kind: 'unreachable',
      message: 'Could not reach the server. Check the address, port, and that AltServer is running.',
      serverReason,
    };
  }
  return { code, kind: 'unknown', message: `The connection closed unexpectedly (code ${code}).`, serverReason };
}

/** This client closed the socket itself. */
export const closedByClient = (): CloseInfo => describeClose(1000, '', { opened: true });

/**
 * The socket failed before opening. Browsers follow a failed handshake with a close event (1006), but
 * Node 22's WebSocket fires only `error`, so every socket maps a pre-open error to this.
 */
export const connectFailed = (): CloseInfo => describeClose(1006, '', { opened: false });

/** Message for the UI: the plain-language reason, plus the server's text when it adds something. */
export function formatClose(info: CloseInfo): string {
  const reason = info.serverReason.trim();
  return reason && !info.message.includes(reason) ? `${info.message} Server said: ${reason}` : info.message;
}
