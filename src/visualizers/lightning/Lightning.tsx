import React from 'react';
import { Dimensions } from 'react-native';
import Svg, { Polyline, G } from 'react-native-svg';
import type { FeatureFrame, VisualizerModule } from '../../core/types';
import { paletteFromSpectrum, pickColorFromPalette, rgbToCss, hslToRgb } from '../../core/color';
import { applySpectrumMapping } from '../../core/mapping';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type LightningParams = {
  intensity: number; // 0..1, mixes with amplitude
  color: { r: number; g: number; b: number };
  branches: number; // 0..5
  frequencyDrive: number; // 0..1 how much spectrum influences shape
  autoColor: boolean;
  useNoteColors?: boolean; // per-bolt tone palette mapping
  glow: number; // 0..1 extra neon halo
  reseedOnOnset: boolean;
  themeInfluence?: number; // 0..1 mix of global theme
};

function buildBoltPoints(seed: number, segments: number, amp: number): string {
  const rand = (n: number) => {
    const x = Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const cx = SCREEN_W / 2;
  const top = 0;
  const bottom = SCREEN_H;
  const wiggle = (20 + 80 * amp);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const y = top + (bottom - top) * t;
    const x = cx + (rand(i + seed) - 0.5) * 2 * wiggle;
    pts.push([x, y]);
  }
  return pts.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join(' ');
}

const LightningImpl: React.FC<{ params: LightningParams; frame: FeatureFrame | null }>= ({ params, frame }) => {
  const [tick, setTick] = React.useState(0);
  const lastOnset = React.useRef(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 90);
    return () => clearInterval(id);
  }, []);
  const amp = frame?.amplitudeRms ?? 0;
  const global = (params as any)._global;
  const mix = Math.max(0, Math.min(1, params.intensity));
  const power = Math.max(0, Math.min(1, amp * 0.8 + mix * 0.6));
  const bands = applySpectrumMapping(frame?.spectrum, frame?.sampleRateHz, global?.audioMapping);
  const low = bands[0] ?? 0;
  const mid = bands[Math.floor(bands.length/2)] ?? 0;
  const high = bands[bands.length-1] ?? 0;
  const energy = Math.max(0, Math.min(1, (low*0.4 + mid*0.4 + high*0.2)));
  const onset = frame?.onsetPercussive ? 1 : 0;
  if (onset && params.reseedOnOnset) lastOnset.current = tick + 1;
  const seedBase = tick + lastOnset.current * 17;
  const count = 1 + Math.floor(3 * Math.max(power, energy) + (onset ? 1 : 0));
  const strokeWidth = 1 + 5 * Math.max(power, mid);
  const palette = params.autoColor ? paletteFromSpectrum(frame?.spectrum) : undefined;
  const themeInfluence = Math.max(0, Math.min(1, params.themeInfluence ?? 1));
  const themeB = 1 + ((global?.themeBrightness ?? 1.0) - 1) * themeInfluence;
  const themeS = 1 + ((global?.themeSaturation ?? 1.0) - 1) * themeInfluence;

  const bolts = [] as JSX.Element[];
  // Ensure distinct note-driven colors per bolt when tone color enabled
  const noteCount = Math.max(0, Math.min(4, (frame?.notesMidi?.length || 0)));
  // If we have notes, prefer at least one bolt per top note (up to 4)
  const boltTotal = noteCount > 0 ? Math.max(count, noteCount) : count;
  for (let i = 0; i < boltTotal; i++) {
    // choose per-bolt color
    let c = params.color;
    const notes = frame?.notesMidi; const notesAmp = frame?.notesAmp;
    if ((params.useNoteColors ?? true) && notes && notes.length) {
      const idx = noteCount > 0 ? (i % noteCount) : 0;
      const off = (global?.toneColorKeyOffset ?? 0) | 0;
      const midi = notes[idx] ?? notes[0];
      const cls0 = ((Math.round(midi) % 12) + 12) % 12;
      const cls = ((cls0 + off) % 12 + 12) % 12;
      const entry = global.toneColorMap[cls];
      const sat = (global.toneColorSaturation ?? 0.8) * themeS;
      c = hslToRgb(entry.hueDeg, sat, entry.brightness);
      const bright = Math.max(0, Math.min(1, (midi - 36) / 60));
      c = { r: Math.min(1, c.r*(1+0.3*bright)), g: Math.min(1, c.g*(1+0.3*bright)), b: Math.min(1, c.b*(1+0.3*bright)) };
    } else if (params.autoColor && palette) {
      c = pickColorFromPalette(palette, (frame?.spectralCentroidHz || 0) / ((frame?.sampleRateHz || 44100)/2));
    }
    // Per-bolt amplitude from matching note (if present) to drive alpha/width/glow
    const noteAmp = (notesAmp && noteCount > 0) ? (notesAmp[i % noteCount] || 0) : 0;
    // Apply global theme brightness to final rgb
    c = { r: c.r * themeB, g: c.g * themeB, b: c.b * themeB };
    const alpha = 0.35 + 0.65 * Math.max(power, Math.max(energy, noteAmp));
    const color = rgbToCss(c, alpha);
    const pts = buildBoltPoints(seedBase + i + 1, 24, Math.max(power, energy) + (frame?.spectrum ? params.frequencyDrive * 0.3 : 0));
    const width = Math.max(1, strokeWidth * (0.8 + 0.8 * noteAmp));
    bolts.push(
      <Polyline key={`bolt-${i}`} points={pts} fill="none" stroke={color} strokeWidth={width} strokeLinejoin="round" strokeLinecap="round" />
    );
    // branches
    const bCount = Math.min(5, Math.floor(params.branches + 2 * noteAmp));
    for (let b = 0; b < bCount; b++) {
      const branchPts = buildBoltPoints(seedBase + i * 97 + b + 1, 12, power * 0.6);
      bolts.push(
        <Polyline key={`branch-${i}-${b}`} points={branchPts} fill="none" stroke={color} strokeWidth={Math.max(1, width * 0.6)} strokeLinejoin="round" strokeLinecap="round" />
      );
    }
    // neon glow halo
    if (params.glow > 0) {
      const glowAlpha = 0.12 * params.glow * (0.6 + 0.8 * noteAmp);
      const glowColor = rgbToCss({ r: Math.min(1, c.r*1.2), g: Math.min(1, c.g*1.1), b: Math.min(1, c.b*1.3) }, glowAlpha);
      bolts.push(
        <Polyline key={`glow-${i}`} points={pts} fill="none" stroke={glowColor} strokeWidth={width * (1.6 + params.glow)} strokeLinejoin="round" strokeLinecap="round" />
      );
    }
  }

  return (
    <Svg width={SCREEN_W} height={SCREEN_H}>
      <G>
        {bolts}
      </G>
    </Svg>
  );
};

export const LightningModule: VisualizerModule = {
  id: 'lightning',
  name: 'Lightning',
  schema: {
    intensity: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.6, description: 'Base bolt power', group: 'Lighting' },
    color: { type: 'color', default: { r: 0.6, g: 0.8, b: 1.0 }, description: 'Bolt color', group: 'Color' },
    branches: { type: 'number', min: 0, max: 5, step: 1, default: 3, description: 'Branch count' },
    frequencyDrive: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.6, description: 'Spectrum influence' },
    autoColor: { type: 'boolean', default: true, description: 'Palette from spectrum', group: 'Color' },
    useNoteColors: { type: 'boolean', default: true, description: 'Enable color→note from Tone palette (per bolt)', group: 'Color' },
    glow: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.6, description: 'Neon glow halo', group: 'Color' },
    reseedOnOnset: { type: 'boolean', default: true, description: 'Randomize on onset' },
    themeInfluence: { type: 'number', min: 0, max: 1, step: 0.01, default: 1.0, description: 'Apply global theme brightness/saturation', group: 'Color' },
  },
  defaultParams: {
    intensity: 0.65,
    color: { r: 0.6, g: 0.8, b: 1.0 },
    branches: 3,
    frequencyDrive: 0.6,
    autoColor: true,
    useNoteColors: true,
    glow: 0.6,
    reseedOnOnset: true,
    themeInfluence: 1.0,
  },
  Component: LightningImpl as any,
};


