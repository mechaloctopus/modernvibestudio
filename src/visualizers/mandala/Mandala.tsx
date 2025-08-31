import React from 'react';
import { Dimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle, G } from 'react-native-svg';
import type { FeatureFrame, VisualizerModule } from '../../core/types';
import { hslToRgb } from '../../core/color';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export type MandalaParams = {
  petals: number;
  baseColor: { r: number; g: number; b: number };
  layers?: number;
  rippleStrength?: number;
  blips?: number;
  shapeCount?: number;
  shapeSize?: number;
  useNoteColors?: boolean;
  darkenShapes?: number; // 0..1
  rotateBase?: number; // base angular speed
  rotateDamp?: number; // damping 0..1
  onsetPush?: number; // push added on onset
  bandPush?: number; // push scaled by mid energy
  themeInfluence?: number; // 0..1 mix of global theme
};

const MandalaImpl: React.FC<{ params: MandalaParams; frame: FeatureFrame | null }>
  = ({ params, frame }) => {
  const t = React.useRef(Date.now());
  const [, setTick] = React.useState(0);
  const angle = React.useRef(0);
  const vel = React.useRef(0);
  const lastTime = React.useRef<number | null>(null);
  React.useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 16);
    return () => clearInterval(id);
  }, []);
  React.useEffect(() => {
    // simple rotation physics driven by audio
    const now = frame?.timestampMs ?? performance.now();
    const prev = lastTime.current ?? now;
    const dt = Math.max(0, (now - prev) / 1000);
    lastTime.current = now;
    const base = (params.rotateBase ?? 0.2) * 0.5; // gentler base spin
    const damp = Math.max(0, Math.min(1, params.rotateDamp ?? 0.1));
    const push = (frame?.onsetPercussive ? (params.onsetPush ?? 1.5) : 0) + (frame?.bandEnergies?.mid ?? 0) * (params.bandPush ?? 1.0);
    const maxVel = 0.6; // clamp angular velocity
    vel.current = Math.max(-maxVel, Math.min(maxVel, vel.current + push * dt + base * dt));
    vel.current *= Math.max(0, 1 - damp * dt);
    angle.current += vel.current * dt;
  }, [frame]);
  const amp = frame?.amplitudeRms ?? 0;
  // Smooth base color transitions to avoid flicker when notes change
  const prevBaseRef = React.useRef<{ r: number; g: number; b: number } | null>(null);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const lerpRgb = (a: {r:number;g:number;b:number}, b: {r:number;g:number;b:number}, t: number) => ({ r: lerp(a.r,b.r,t), g: lerp(a.g,b.g,t), b: lerp(a.b,b.b,t) });
  const petals = Math.max(3, Math.floor(params.petals));
  let base = params.baseColor;
  const global = (params as any)._global;
  if (global?.toneColorEnabled && frame?.midiNote != null) {
    const cls = ((Math.round(frame.midiNote) % 12) + 12) % 12;
    const off = (global?.toneColorKeyOffset ?? 0) | 0;
    const idx = ((cls + off) % 12 + 12) % 12;
    const entry = global.toneColorMap[idx];
    const rgb = hslToRgb(entry.hueDeg, global.toneColorSaturation, entry.brightness);
    const prev = prevBaseRef.current || base;
    base = lerpRgb(prev, rgb, 0.15);
    prevBaseRef.current = base;
  }
  const themeB = Math.max(0, (global?.themeBrightness ?? 1.0));
  const themeS = Math.max(0, (global?.themeSaturation ?? 1.0));
  const themeInfluence = Math.max(0, Math.min(1, params.themeInfluence ?? 1));
  const effB = 1 + (themeB - 1) * themeInfluence;
  const effS = 1 + (themeS - 1) * themeInfluence;
  base = { r: base.r * effB, g: base.g * effB, b: base.b * effB };
  const cx = SCREEN_W / 2;
  const cy = SCREEN_H / 2;
  const maxR = Math.min(cx, cy);
  const layers = Math.max(1, Math.floor(params.layers ?? 3));
  const rings = 24 * layers;
  const nodes = [] as JSX.Element[];
  const ripple = Math.max(0, Math.min(1, params.rippleStrength ?? 0.3));
  for (let i = 0; i < rings; i++) {
    const f = i / rings;
    const band = frame?.bandEnergies;
    const scale = i < rings*0.3 ? (band?.low ?? 1) : i > rings*0.7 ? (band?.high ?? 1) : (band?.mid ?? 1);
    const wave = ripple * Math.sin((t.current/4000) + f * 40) * (0.05 + 0.2 * amp);
    const r = maxR * f * (0.9 + 0.3 * scale + wave);
    const opacity = Math.max(0, 1 - f);
    nodes.push(
      <Circle key={`ring-${i}`} cx={cx} cy={cy} r={r}
        fill={`rgba(${Math.floor(base.r*255)},${Math.floor(base.g*255)},${Math.floor(base.b*255)},${(0.15+0.35*amp)*opacity})`} />
    );
  }
  const petalsGroup = [] as JSX.Element[];
  const bands = (params as any)._global?.mappedBands as number[] | undefined;
  const notes = frame?.notesMidi; const notesAmp = frame?.notesAmp;
  // Smooth top-note amplitudes to reduce color blinking
  const smoothNotesRef = React.useRef<Float32Array>(new Float32Array(4));
  React.useEffect(() => {
    const alpha = 0.25;
    const dst = smoothNotesRef.current;
    for (let i = 0; i < dst.length; i++) {
      const src = notesAmp?.[i] ?? 0;
      dst[i] = (1 - alpha) * (dst[i] || 0) + alpha * src;
    }
  }, [notesAmp, frame?.timestampMs]);
  for (let p = 0; p < petals; p++) {
    const ang = (p / petals) * 360 + (angle.current * 57.2958);
    // Map petals across available bands to form low→high coverage
    const numBands = bands?.length || 0;
    const bIdxStart = numBands ? Math.floor((p / Math.max(1, petals)) * numBands) : 0;
    const bIdxEnd = numBands ? Math.floor(((p + 1) / Math.max(1, petals)) * numBands) : 0;
    let bandAmp = 0;
    if (bands && numBands) {
      const s = Math.max(0, Math.min(numBands, bIdxStart));
      const e = Math.max(s, Math.min(numBands, Math.max(bIdxStart + 1, bIdxEnd)));
      for (let i = s; i < e; i++) bandAmp += bands[i];
      bandAmp /= Math.max(1, e - s);
    }
    // Note influence: assign each petal a midi range 36..96
    let bestIdx = -1; let bestAmp = 0; let bestMidi = 0;
    if (notes && notesAmp && notes.length) {
      const minMidi = 36, maxMidi = 96;
      const lo = minMidi + (maxMidi - minMidi) * (p / Math.max(1, petals));
      const hi = minMidi + (maxMidi - minMidi) * ((p + 1) / Math.max(1, petals));
      const n = Math.min(notes.length, notesAmp.length);
      for (let i = 0; i < n; i++) {
        const m = notes[i]; const aamp = smoothNotesRef.current[i] || notesAmp[i] || 0;
        if (m >= lo && m < hi && aamp > bestAmp) { bestAmp = aamp; bestMidi = m; bestIdx = i; }
      }
    }
    const effAmp = Math.max(bandAmp, bestAmp, amp * 0.05);
    let fillColor = `rgba(255,255,255,${0.15 + 0.7*effAmp})`;
    if ((params.useNoteColors ?? true) && (params as any)._global?.toneColorMap) {
      if (bestIdx >= 0) {
        const off = (((params as any)._global?.toneColorKeyOffset ?? 0) | 0);
        const idx0 = ((Math.round(bestMidi) % 12) + 12) % 12;
        const idx = ((idx0 + off) % 12 + 12) % 12;
        const entry = (params as any)._global.toneColorMap[idx];
        const sat = (params as any)._global.toneColorSaturation * effS;
        const rgb = hslToRgb(entry.hueDeg, sat, entry.brightness);
        const a = 0.2 + 0.6 * bestAmp;
        const darken = 1 - Math.max(0, Math.min(1, params.darkenShapes ?? 0));
        fillColor = `rgba(${Math.floor(rgb.r*255*darken)},${Math.floor(rgb.g*255*darken)},${Math.floor(rgb.b*255*darken)},${a})`;
      } else if (notes && notes.length) {
        const idx = notes.length > 1 ? p % notes.length : 0;
        const midi = notes[idx];
        const off = (((params as any)._global?.toneColorKeyOffset ?? 0) | 0);
        const idx0 = ((Math.round(midi) % 12) + 12) % 12;
        const entry = (params as any)._global.toneColorMap[((idx0 + off) % 12 + 12) % 12];
        const sat = (params as any)._global.toneColorSaturation * effS;
        const rgb = hslToRgb(entry.hueDeg, sat, entry.brightness);
        const a = 0.2 + 0.6 * (notesAmp?.[idx] ?? effAmp);
        const darken = 1 - Math.max(0, Math.min(1, params.darkenShapes ?? 0));
        fillColor = `rgba(${Math.floor(rgb.r*255*darken)},${Math.floor(rgb.g*255*darken)},${Math.floor(rgb.b*255*darken)},${a})`;
      }
    }
    petalsGroup.push(
      <G key={`petal-${p}`} origin={`${cx}, ${cy}`} rotation={ang}>
        <Circle cx={cx} cy={cy - maxR * 0.6} r={maxR * (0.16 + 0.24 * Math.max(amp, effAmp))} fill={fillColor} />
      </G>
    );
  }

  // Group orbs: dedicated low/mid/high/onset pulses (stable positions), smoothed to avoid glitching
  const smoothRef = React.useRef({ low: 0, mid: 0, high: 0, onset: 0 });
  React.useEffect(() => {
    const k = 0.25; // EMA smoothing
    const cur = smoothRef.current;
    const lo = frame?.bandEnergies?.low ?? 0;
    const mi = frame?.bandEnergies?.mid ?? 0;
    const hi = frame?.bandEnergies?.high ?? 0;
    const on = (frame?.onsetPercussive ? 1 : 0);
    cur.low = (1 - k) * cur.low + k * lo;
    cur.mid = (1 - k) * cur.mid + k * mi;
    cur.high = (1 - k) * cur.high + k * hi;
    // onset with decay
    cur.onset = Math.max((1 - 0.12) * cur.onset, on);
  }, [frame]);

  const groupOrbs: JSX.Element[] = [];
  const loAmp = smoothRef.current.low;
  const miAmp = smoothRef.current.mid;
  const hiAmp = smoothRef.current.high;
  const onAmp = smoothRef.current.onset;
  // positions relative to center
  const rOrb = maxR * 0.18;
  const orb = (dx: number, dy: number, r: number, col: string, a: number, key: string) => (
    <Circle key={key} cx={cx + dx} cy={cy + dy} r={r} fill={`rgba(${col},${a})`} />
  );
  // colors (RGB) for groups
  const loCol = '255,120,60';
  const miCol = '80,200,160';
  const hiCol = '140,150,255';
  const onCol = '255,255,255';
  groupOrbs.push(
    orb(-rOrb*2.2, 0, rOrb * (0.4 + 0.9 * loAmp), loCol, 0.28 + 0.5 * loAmp, 'orb-low'),
    orb(rOrb*2.2, 0, rOrb * (0.35 + 0.8 * hiAmp), hiCol, 0.22 + 0.5 * hiAmp, 'orb-high'),
    orb(0, -rOrb*2.0, rOrb * (0.35 + 0.8 * miAmp), miCol, 0.22 + 0.5 * miAmp, 'orb-mid'),
    orb(0, 0, rOrb * (0.25 + 0.9 * onAmp), onCol, 0.2 + 0.6 * onAmp, 'orb-onset'),
  );
  // Extra shapes: rotating small circles forming cymatic-like nodes
  const extraShapes = [] as JSX.Element[];
  const shapeCount = Math.max(0, Math.floor(params.shapeCount ?? 12));
  const shapeSize = Math.max(0.002, params.shapeSize ?? 0.06);
  // Smooth bands (mapped) for stable glow
  const mb = (params as any)._global?.mappedBands as number[] | undefined;
  const numBands = mb?.length || 0;
  const smoothBandsRef = React.useRef<Float32Array>(new Float32Array(Math.max(1, numBands)));
  React.useEffect(() => {
    if (!mb || !numBands) return;
    const alphaB = 0.25;
    const dst = smoothBandsRef.current.length === numBands ? smoothBandsRef.current : new Float32Array(numBands);
    for (let i = 0; i < numBands; i++) {
      const src = mb[i] ?? 0;
      dst[i] = (1 - alphaB) * (dst[i] || 0) + alphaB * src;
    }
    smoothBandsRef.current = dst;
  }, [mb, numBands, frame?.timestampMs]);
  const audioMapping = (params as any)._global?.audioMapping as { lowHz: number; highHz: number; numBands: number; scale: 'linear'|'log' } | undefined;
  const centerFreq = (i: number): number => {
    const low = audioMapping?.lowHz ?? 40;
    const high = audioMapping?.highHz ?? 16000;
    const n = audioMapping?.numBands ?? Math.max(1, numBands);
    const t = (i + 0.5) / Math.max(1, n);
    if ((audioMapping?.scale ?? 'log') === 'log') {
      const ratio = high / Math.max(1, low);
      return low * Math.pow(ratio, t);
    }
    return low + t * (high - low);
  };
  for (let i = 0; i < shapeCount; i++) {
    const f = i / Math.max(1, shapeCount);
    const r = maxR * (0.2 + 0.7 * f);
    const theta = angle.current * (1 + f) + f * Math.PI * 2;
    const x = cx + Math.cos(theta) * r;
    const y = cy + Math.sin(theta) * r;
    const bIdx = numBands ? (i % numBands) : 0;
    const bandAmp = numBands ? smoothBandsRef.current[bIdx] || 0 : (frame?.bandEnergies?.mid ?? 0);
    let rr = shapeSize * maxR * (0.4 + 0.6 * bandAmp);
    // Prefer note-based colors for extra shapes; fallback to band→midi mapping
    let colrgb = base;
    let alpha = 0.15 + 0.75 * bandAmp;
    if ((params.useNoteColors ?? true) && (params as any)._global?.toneColorMap) {
      const off = (((params as any)._global?.toneColorKeyOffset ?? 0) | 0);
      const satBase = (params as any)._global?.toneColorSaturation ?? 0.8;
      if (notes && notes.length) {
        const idxNote = notes.length > 1 ? (i % notes.length) : 0;
        const midi = notes[idxNote];
        const idx0 = ((Math.round(midi) % 12) + 12) % 12;
        const entry = (params as any)._global.toneColorMap[((idx0 + off) % 12 + 12) % 12];
        const sat = satBase * effS;
        const target = hslToRgb(entry.hueDeg, sat, entry.brightness);
        colrgb = { r: target.r * effB, g: target.g * effB, b: target.b * effB };
        const aNote = notesAmp?.[idxNote] ?? 0;
        alpha = 0.15 + 0.75 * Math.max(bandAmp, aNote);
      } else {
        const fHz = centerFreq(bIdx);
        const midi = 69 + 12 * Math.log2(Math.max(1e-6, fHz) / 440);
        const idx0 = ((Math.round(midi) % 12) + 12) % 12;
        const entry = (params as any)._global.toneColorMap[((idx0 + off) % 12 + 12) % 12];
        const sat = satBase * effS;
        const target = hslToRgb(entry.hueDeg, sat, entry.brightness);
        colrgb = { r: target.r * effB, g: target.g * effB, b: target.b * effB };
      }
    }
    extraShapes.push(
      <Circle key={`shape-${i}`} cx={x} cy={y} r={rr}
        fill={`rgba(${Math.floor(colrgb.r*255)},${Math.floor(colrgb.g*255)},${Math.floor(colrgb.b*255)},${alpha})`} />
    );
  }
  const blips: JSX.Element[] = [];
  const numBlips = Math.max(0, Math.min(100, Math.floor(params.blips ?? 12)));
  for (let i = 0; i < numBlips; i++) {
    const seed = (t.current/1000 + i * 13.37);
    const rr = (Math.sin(seed * 1.7 + i) * 0.5 + 0.5) * maxR;
    const aa = (Math.cos(seed * 1.3 + i) * 0.5 + 0.5) * Math.PI * 2;
    const x = cx + Math.cos(aa) * rr;
    const y = cy + Math.sin(aa) * rr;
    const a = 0.2 + 0.8 * Math.random() * (frame?.onsetPercussive ? 1 : amp);
    blips.push(<Circle key={`blip-${i}`} cx={x} cy={y} r={2 + 4 * a} fill={`rgba(255,255,255,${0.15 + 0.25 * a})`} />);
  }
  return (
    <Svg width={SCREEN_W} height={SCREEN_H}>
      <Defs>
        <RadialGradient id="bg" cx="50%" cy="50%" r="60%">
          <Stop offset="0%" stopColor={`rgba(${Math.floor(base.r*255)},${Math.floor(base.g*255)},${Math.floor(base.b*255)},0.6)`} />
          <Stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </RadialGradient>
      </Defs>
      <Circle cx={cx} cy={cy} r={maxR} fill="url(#bg)" />
      {nodes}
      {petalsGroup}
      {extraShapes}
      {blips}
    </Svg>
  );
};

export const MandalaModule: VisualizerModule = {
  id: 'mandala',
  name: 'Mandala',
  schema: {
    petals: { type: 'number', min: 3, max: 24, step: 1, default: 8, description: 'Kaleidoscope folds' },
    baseColor: { type: 'color', default: { r: 0.2, g: 0.6, b: 1.0 }, description: 'Base RGB color' },
    layers: { type: 'number', min: 1, max: 6, step: 1, default: 3, description: 'Ring density multiplier' },
    rippleStrength: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.3, description: 'Water ripple amount' },
    blips: { type: 'number', min: 0, max: 100, step: 1, default: 12, description: 'Random blip count' },
    shapeCount: { type: 'number', min: 0, max: 64, step: 1, default: 12, description: 'Extra rotating shapes' },
    shapeSize: { type: 'number', min: 0.01, max: 0.2, step: 0.005, default: 0.06, description: 'Extra shape size' },
    useNoteColors: { type: 'boolean', default: true, description: 'Color shapes by notes' },
    darkenShapes: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.2, description: 'Darken shape colors' },
    rotateBase: { type: 'number', min: 0, max: 2, step: 0.01, default: 0.2, description: 'Base rotation speed' },
    rotateDamp: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.1, description: 'Rotation damping' },
    onsetPush: { type: 'number', min: 0, max: 5, step: 0.1, default: 1.5, description: 'Onset rotation push' },
    bandPush: { type: 'number', min: 0, max: 5, step: 0.1, default: 1.0, description: 'Band-driven push' },
    themeInfluence: { type: 'number', min: 0, max: 1, step: 0.01, default: 1.0, description: 'Apply global theme brightness/saturation' },
  },
  defaultParams: {
    petals: 8,
    baseColor: { r: 0.2, g: 0.6, b: 1.0 },
    layers: 3,
    rippleStrength: 0.19,
    blips: 12,
    shapeCount: 63,
    shapeSize: 0.155,
    useNoteColors: true,
    darkenShapes: 0.2,
    rotateBase: 0.2,
    rotateDamp: 0.43,
    onsetPush: 1.5,
    bandPush: 1.0,
    themeInfluence: 1.0,
  },
  Component: MandalaImpl as any,
};


