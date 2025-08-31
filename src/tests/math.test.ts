import { clamp, lerp, ExponentialMovingAverage } from '../core/math';

describe('math helpers', () => {
  test('clamp bounds', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  test('lerp', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
  });

  test('EMA smoothing', () => {
    const ema = new ExponentialMovingAverage(0.5);
    const seq = [0, 1, 1, 1];
    const out = seq.map((s) => ema.update(s));
    expect(out[0]).toBeCloseTo(0);
    expect(out[out.length - 1]).toBeGreaterThan(0.5);
  });
});


