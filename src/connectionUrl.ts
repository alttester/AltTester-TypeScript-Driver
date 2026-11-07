// Builds AltServer WebSocket URLs (mirrors DRV/Communication/Utils.cs CreateURI).

export interface ServerAddress {
  host: string;
  port: number;
  secure: boolean;
}

export interface AppSelector {
  appName?: string;
  appId?: string;
  platform?: string;
  platformVersion?: string;
  deviceInstanceId?: string;
}

export type AltEndpoint = '/altws' | '/altws/live-update' | '/altws/connected-app-cli';

/** KTD6: the web inspector connects as a Desktop driver so it can attach next to a running test. */
export const DEFAULT_DRIVER_TYPE = 'Desktop';

export function serverOrigin(addr: ServerAddress): string {
  const host = addr.host.trim();
  // Bare IPv6 literals need brackets in a URL.
  const hostPart = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
  return `${addr.secure ? 'wss' : 'ws'}://${hostPart}:${addr.port}`;
}

export function buildConnectionUrl(
  addr: ServerAddress,
  endpoint: AltEndpoint,
  app: AppSelector = {},
  driverType: string = DEFAULT_DRIVER_TYPE,
): string {
  const params = new URLSearchParams();
  params.set('appName', app.appName ?? '__default__');
  params.set('platform', app.platform ?? 'unknown');
  params.set('platformVersion', app.platformVersion ?? 'unknown');
  params.set('deviceInstanceId', app.deviceInstanceId ?? 'unknown');
  if (app.appId) params.set('appId', app.appId);
  params.set('driverType', driverType);
  return `${serverOrigin(addr)}${endpoint}?${params.toString()}`;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function isLocalHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  return LOCAL_HOSTS.has(h) || h.endsWith('.localhost');
}

/**
 * KTD5: an HTTPS page may open wss:// anywhere and ws:// only to localhost. Returns true when the
 * browser will block the connection as mixed content.
 */
export function isMixedContentBlocked(pageProtocol: string, addr: ServerAddress): boolean {
  return pageProtocol === 'https:' && !addr.secure && !isLocalHost(addr.host);
}
