import type { AudioMappingSettings } from './types';
import type { ParamRoute, RoutingCurve, RoutingSource } from './types';

export function applySpectrumMapping(
  rawSpectrum: Float32Array | undefined,
  sampleRateHz: number | undefined,
  settings: AudioMappingSettings
): Float32Array {
  if (!rawSpectrum || !sampleRateHz || rawSpectrum.length === 0) return new Float32Array(0);
  const n = rawSpectrum.length;
  const nyquist = sampleRateHz / 2;
  const toDb = (x: number) => 20 * Math.log10(Math.max(1e-6, x));

  const low = Math.max(0, settings.lowHz);
  const high = Math.max(low + 1, Math.min(nyquist, settings.highHz));

  const bands = settings.numBands;
  const out = new Float32Array(bands);

  for (let b = 0; b < bands; b++) {
    const t0 = b / bands;
    const t1 = (b + 1) / bands;
    const f0 = settings.scale === 'log'
      ? expInterp(low, high, t0)
      : low + (high - low) * t0;
    const f1 = settings.scale === 'log'
      ? expInterp(low, high, t1)
      : low + (high - low) * t1;
    const i0 = Math.max(0, Math.min(n - 1, Math.floor((f0 / nyquist) * n)));
    const i1 = Math.max(i0 + 1, Math.min(n, Math.floor((f1 / nyquist) * n)));
    let sum = 0;
    let count = 0;
    for (let i = i0; i < i1; i++) { sum += rawSpectrum[i]; count++; }
    let val = count > 0 ? sum / count : 0;
    if (settings.magnitudeMode === 'db') {
      val = toDb(val);
      val = (val - settings.dbFloor) / (0 - settings.dbFloor); // normalize floor..0 -> 0..1
    }
    out[b] = Math.max(0, Math.min(1, val));
  }
  if (settings.normalize) {
    let max = 1e-6;
    for (let i = 0; i < out.length; i++) max = Math.max(max, out[i]);
    for (let i = 0; i < out.length; i++) out[i] = out[i] / max;
  }
  return out;
}

function expInterp(a: number, b: number, t: number): number {
  const la = Math.log(a);
  const lb = Math.log(b);
  return Math.exp(la + (lb - la) * t);
}

export function applyRoutes(
  routes: ParamRoute[],
  visualizerId: string,
  baseParams: Record<string, any>,
  context: {
    bands: Float32Array;
    low: number; mid: number; high: number;
    rms: number; onset: number; centroid: number; note?: number;
  }
): Record<string, any> {
  const out = { ...baseParams };
  for (const r of routes) {
    if (!r.enabled || r.visualizerId !== visualizerId) continue;
    let x = 0;
    const src = r.source as RoutingSource;
    if (src.kind === 'band') x = context.bands[src.index] ?? 0;
    else if (src.kind === 'group') x = src.name === 'low' ? context.low : src.name === 'mid' ? context.mid : context.high;
    else if (src.kind === 'rms') x = context.rms;
    else if (src.kind === 'onset') x = context.onset;
    else if (src.kind === 'centroid') x = context.centroid / Math.max(1, context.centroid + 1);
    else if (src.kind === 'note') x = (context.note ?? 0) / 127;

    let t = (x - r.scale.inMin) / Math.max(1e-6, (r.scale.inMax - r.scale.inMin));
    t = Math.max(0, Math.min(1, t));
    const curve = r.curve as RoutingCurve;
    if (curve === 'exp') t = Math.pow(t, 2);
    else if (curve === 'log') t = Math.sqrt(t);
    else if (curve === 'smoothstep') t = t * t * (3 - 2 * t);
    const y = r.scale.outMin + (r.scale.outMax - r.scale.outMin) * t;
    out[r.paramKey] = y;
  }
  return out;
}


