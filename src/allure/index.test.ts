import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeAltServer } from '../../test/fakeAltServer';
import { AltDriver } from '../binding/AltDriver';
import { attachFailureEvidence, createLogRecorder } from './index';

const attachments: { name: string; content: unknown; options: unknown }[] = [];
vi.mock('allure-js-commons', () => ({
  attachment: vi.fn(async (name: string, content: unknown, options: unknown) => {
    attachments.push({ name, content, options });
  }),
}));

const PNG = 'iVBORw0KGgo='; // the PNG signature, base64
const JPEG = '/9j/4AAQ'; // the JPEG start, base64

async function connect(server: FakeAltServer, log = createLogRecorder()) {
  const driver = await AltDriver.connect({ WebSocketImpl: server.WebSocket, connectTimeout: 1, enableLogging: log });
  return { driver, log };
}

beforeEach(() => {
  attachments.length = 0;
});

describe('createLogRecorder', () => {
  it('keeps the last maxLines messages with their level', () => {
    const log = createLogRecorder(2);
    log.info('one');
    log.warn('two');
    log.error('three');
    const lines = log.text().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/ WARN {2}two$/);
    expect(lines[1]).toMatch(/ ERROR three$/);
    log.clear();
    expect(log.text()).toBe('');
  });
});

describe('attachFailureEvidence', () => {
  it('attaches the game screenshot and the driver log the driver wrote while connecting', async () => {
    const server = new FakeAltServer().on('getPNGScreenshot', () => [{ data: 'Ok' }, { data: PNG }]);
    const { driver, log } = await connect(server);

    await attachFailureEvidence(driver, { log });

    expect(attachments.map((a) => a.name)).toEqual(['Game screenshot (AltTester)', 'AltTester driver log']);
    expect(attachments[0]!.options).toBe('image/png');
    expect(attachments[0]!.content).toBeInstanceOf(Uint8Array);
    expect(String(attachments[1]!.content)).toContain('Connected. AltTester(R) SDK version');
  });

  it('labels the JPEG bytes the Unreal SDK sends as image/jpeg', async () => {
    const server = new FakeAltServer({ serverVersion: '1.2.1' }).on('getPNGScreenshot', () => [{ data: 'Ok' }, { data: JPEG }]);
    const { driver } = await connect(server);

    await attachFailureEvidence(driver);

    expect(attachments[0]!.options).toBe('image/jpeg');
  });

  it('adds the highlighted object and the hierarchy when asked', async () => {
    const server = new FakeAltServer()
      .on('getPNGScreenshot', () => [{ data: 'Ok' }, { data: PNG }])
      .on('hightlightObjectScreenshot', () => [{ data: 'Ok' }, { data: { compressedImage: JPEG } }])
      .on('getAllLoadedScenesAndObjects', () => [{ data: [{ name: 'Scene', id: 0 }] }]);
    const { driver } = await connect(server);

    await attachFailureEvidence(driver, { object: 42, hierarchy: true });

    expect(attachments.map((a) => a.name)).toEqual([
      'Game screenshot (AltTester)',
      'Highlighted object (AltTester)',
      'Loaded scenes and objects (AltTester)',
    ]);
    expect(attachments[1]!.options).toEqual({ contentType: 'image/jpeg', encoding: 'base64' });
    expect(JSON.parse(String(attachments[2]!.content))[0].name).toBe('Scene');
  });

  it('turns an item it cannot collect into a note and still attaches the rest', async () => {
    const server = new FakeAltServer().on('getPNGScreenshot', () => [{ error: { type: 'unknownError', message: 'boom', trace: '' } }]);
    const { driver, log } = await connect(server);

    await attachFailureEvidence(driver, { log });

    expect(attachments.map((a) => a.name)).toEqual(['Game screenshot (AltTester): not available', 'AltTester driver log']);
    expect(attachments[0]!.content).toContain('boom');
  });

  it('never throws, even without a driver', async () => {
    await expect(attachFailureEvidence(undefined)).resolves.toBeUndefined();
    expect(attachments[0]!.name).toBe('Game screenshot (AltTester): not available');
    expect(attachments[0]!.content).toContain('not connected');
  });
});
