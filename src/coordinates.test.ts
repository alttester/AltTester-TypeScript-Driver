import { describe, expect, it } from 'vitest';
import { deviceToGame, displayToDevice, gameToDevice, type Rect } from './coordinates';

const full: Rect = { x: 0, y: 0, width: 800, height: 600 };

describe('coordinates', () => {
  it('maps a click on a 400x300 display of an 800x600 Unity texture to device (200,100) and Unity (200,500)', () => {
    const device = displayToDevice({ x: 100, y: 50 }, { width: 400, height: 300 }, { x: 800, y: 600 });
    expect(device).toEqual({ x: 200, y: 100 });
    expect(deviceToGame(device, full, 'unity')).toEqual({ x: 200, y: 500 });
  });

  it('maps the same click for Unreal to (200,100) in both spaces', () => {
    const device = displayToDevice({ x: 100, y: 50 }, { width: 400, height: 300 }, { x: 800, y: 600 });
    expect(device).toEqual({ x: 200, y: 100 });
    expect(deviceToGame(device, full, 'unreal')).toEqual({ x: 200, y: 100 });
  });

  it('an unknown engine uses top-left (no flip)', () => {
    expect(deviceToGame({ x: 200, y: 100 }, full, 'unknown')).toEqual({ x: 200, y: 100 });
  });

  it('with gameRect (0,40,800,520), device (200,140) is Unity (200,420); outside gameRect is null', () => {
    const rect: Rect = { x: 0, y: 40, width: 800, height: 520 };
    expect(deviceToGame({ x: 200, y: 140 }, rect, 'unity')).toEqual({ x: 200, y: 420 });
    expect(deviceToGame({ x: 200, y: 140 }, rect, 'unreal')).toEqual({ x: 200, y: 100 });
    expect(deviceToGame({ x: 200, y: 20 }, rect, 'unity')).toBeNull();
    expect(deviceToGame({ x: 200, y: 580 }, rect, 'unity')).toBeNull();
    expect(deviceToGame({ x: -1, y: 100 }, rect, 'unreal')).toBeNull();
    expect(deviceToGame({ x: 801, y: 100 }, rect, 'unreal')).toBeNull();
  });

  it('gameToDevice inverts deviceToGame for every engine', () => {
    const rect: Rect = { x: 10, y: 40, width: 780, height: 520 };
    for (const engine of ['unity', 'unreal', 'unknown'] as const) {
      const game = deviceToGame({ x: 210, y: 140 }, rect, engine)!;
      expect(gameToDevice(game, rect, engine)).toEqual({ x: 210, y: 140 });
    }
    expect(gameToDevice({ x: 200, y: 420 }, { x: 0, y: 40, width: 800, height: 520 }, 'unity')).toEqual({ x: 200, y: 140 });
  });
});
