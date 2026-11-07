import { describe, expect, it } from 'vitest';
import { describeClose, formatClose } from './closeCodes';
import { buildConnectionUrl, isMixedContentBlocked } from './connectionUrl';

describe('describeClose', () => {
  it.each([
    [4001, 'noAppConnected'],
    [4002, 'appDisconnected'],
    [4004, 'multipleApps'],
    [4005, 'multipleDrivers'],
    [4006, 'unsupportedPlatform'],
    [4007, 'concurrentConnect'],
    [4008, 'connectionLimit'],
    [4009, 'driverLimit'],
    [4010, 'unsupportedGameEngine'],
    [4011, 'unsupportedSdk'],
    [4014, 'driverTypeNotAllowed'],
    [4015, 'handshakeFailed'],
    [4017, 'disconnectedByDesktop'],
  ])('maps %i to %s', (code, kind) => {
    expect(describeClose(code).kind).toBe(kind);
  });

  it('an abnormal close before open means the server is unreachable', () => {
    expect(describeClose(1006, '', { opened: false }).kind).toBe('unreachable');
  });

  it('an abnormal close after open is unknown, with the code in the message', () => {
    const info = describeClose(1006, '', { opened: true });
    expect(info.kind).toBe('unknown');
    expect(info.message).toContain('1006');
  });

  it('formatClose appends the server reason for licence limits', () => {
    const text = formatClose(describeClose(4009, 'Your license supports max. 1 drivers'));
    expect(text).toMatch(/driver limit/);
    expect(text).toContain('max. 1 drivers');
  });
});

describe('connection URL', () => {
  it('uses wss for secure servers and escapes params', () => {
    const url = buildConnectionUrl({ host: 'example.com', port: 443, secure: true }, '/altws', { appName: 'My Game' });
    expect(url.startsWith('wss://example.com:443/altws?')).toBe(true);
    expect(new URL(url).searchParams.get('appName')).toBe('My Game');
    expect(new URL(url).searchParams.has('appId')).toBe(false);
  });

  it('brackets IPv6 hosts', () => {
    expect(buildConnectionUrl({ host: '::1', port: 13000, secure: false }, '/altws')).toMatch(/^ws:\/\/\[::1\]:13000\//);
  });

  it('flags ws:// to a LAN host from an https page as mixed content, but not localhost', () => {
    expect(isMixedContentBlocked('https:', { host: '192.168.1.5', port: 13000, secure: false })).toBe(true);
    expect(isMixedContentBlocked('https:', { host: 'localhost', port: 13000, secure: false })).toBe(false);
    expect(isMixedContentBlocked('https:', { host: '192.168.1.5', port: 13000, secure: true })).toBe(false);
    expect(isMixedContentBlocked('http:', { host: '192.168.1.5', port: 13000, secure: false })).toBe(false);
  });
});
