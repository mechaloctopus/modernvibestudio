import { applyRoutes } from '../core/mapping';
import type { ParamRoute } from '../core/types';

describe('applyRoutes', () => {
  test('maps band to param with linear scale', () => {
    const routes: ParamRoute[] = [{
      id: 'r1', visualizerId: 'mandala', paramKey: 'petals',
      source: { kind: 'band', index: 0 }, scale: { inMin: 0, inMax: 1, outMin: 4, outMax: 16 }, curve: 'linear', enabled: true,
    }];
    const base = { petals: 8 } as any;
    const ctx = { bands: new Float32Array([0.5]), low: 0, mid: 0, high: 0, rms: 0.3, onset: 0, centroid: 1000 } as any;
    const out = applyRoutes(routes, 'mandala', base, ctx);
    expect(out.petals).toBeCloseTo(10);
  });

  test('curve smoothstep and clamps', () => {
    const routes: ParamRoute[] = [{
      id: 'r', visualizerId: 'mandala', paramKey: 'rippleStrength',
      source: { kind: 'rms' }, scale: { inMin: 0, inMax: 1, outMin: 0, outMax: 1 }, curve: 'smoothstep', enabled: true,
    }];
    const base = { rippleStrength: 0 } as any;
    const ctx = { bands: new Float32Array([0]), low: 0, mid: 0, high: 0, rms: 0.5, onset: 0, centroid: 1000 } as any;
    const out = applyRoutes(routes, 'mandala', base, ctx);
    expect(out.rippleStrength).toBeGreaterThan(0.2);
    expect(out.rippleStrength).toBeLessThan(0.8);
  });
});


