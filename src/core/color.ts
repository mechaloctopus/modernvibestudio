export type RGB = { r: number; g: number; b: number };

export function clamp01(x: number): number { return Math.max(0, Math.min(1, x)); }

export function mix(a: RGB, b: RGB, t: number): RGB {
  const u = clamp01(t);
  return { r: a.r + (b.r - a.r) * u, g: a.g + (b.g - a.g) * u, b: a.b + (b.b - a.b) * u };
}

export function rgbToCss(c: RGB, alpha = 1): string {
  return `rgba(${Math.floor(c.r*255)},${Math.floor(c.g*255)},${Math.floor(c.b*255)},${alpha})`;
}

export function paletteFromSpectrum(spectrum: Float32Array | undefined): RGB[] {
  if (!spectrum || spectrum.length === 0) return defaultPalette();
  const n = spectrum.length;
  const low = avgBand(spectrum, 0, Math.floor(n * 0.15));
  const mid = avgBand(spectrum, Math.floor(n * 0.15), Math.floor(n * 0.5));
  const high = avgBand(spectrum, Math.floor(n * 0.5), n);
  const lowColor: RGB = { r: 0.9*low, g: 0.2, b: 0.1 };
  const midColor: RGB = { r: 0.2, g: 0.6*mid + 0.2, b: 0.3 };
  const highColor: RGB = { r: 0.2, g: 0.4, b: 0.9*high + 0.1 };
  return [lowColor, midColor, highColor];
}

export function pickColorFromPalette(palette: RGB[], t: number): RGB {
  if (palette.length === 0) return { r: 1, g: 1, b: 1 };
  const u = ((t % 1) + 1) % 1;
  const i = Math.floor(u * palette.length);
  const j = (i + 1) % palette.length;
  const f = u * palette.length - i;
  return mix(palette[i], palette[j], f);
}

function avgBand(arr: Float32Array, start: number, end: number): number {
  const s = Math.max(0, Math.min(arr.length, start));
  const e = Math.max(s, Math.min(arr.length, end));
  if (e - s <= 0) return 0;
  let sum = 0;
  for (let i = s; i < e; i++) sum += arr[i];
  return sum / (e - s);
}

export function defaultPalette(): RGB[] {
  return [
    { r: 0.2, g: 0.6, b: 1.0 },
    { r: 0.8, g: 0.2, b: 0.6 },
    { r: 1.0, g: 0.6, b: 0.2 },
  ];
}

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

export function midiToNoteName(midi: number): string {
  const n = Math.round(midi);
  const name = NOTE_NAMES[((n % 12) + 12) % 12];
  const octave = Math.floor(n / 12) - 1;
  return `${name}${octave}`;
}

export function noteToHueDegrees(midi: number, keyOffsetSemitones = 0): number {
  const n = midi + keyOffsetSemitones;
  const semitone = ((n % 12) + 12) % 12;
  return (semitone / 12) * 360;
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360; s = clamp01(s); l = clamp01(l);
  const c = (1 - Math.abs(2*l - 1)) * s;
  const x = c * (1 - Math.abs(((h/60) % 2) - 1));
  const m = l - c/2;
  let rp=0,gp=0,bp=0;
  if (h < 60) { rp=c; gp=x; bp=0; }
  else if (h < 120) { rp=x; gp=c; bp=0; }
  else if (h < 180) { rp=0; gp=c; bp=x; }
  else if (h < 240) { rp=0; gp=x; bp=c; }
  else if (h < 300) { rp=x; gp=0; bp=c; }
  else { rp=c; gp=0; bp=x; }
  return { r: rp + m, g: gp + m, b: bp + m };
}

export function colorFromMidi(midi: number | undefined, keyOffset=0, saturation=0.8, lightness=0.5): RGB {
  if (midi == null || Number.isNaN(midi)) return { r: 1, g: 1, b: 1 };
  const hue = noteToHueDegrees(midi, keyOffset);
  return hslToRgb(hue, saturation, lightness);
}

export type HarmonyScheme = 'analog' | 'complementary' | 'triad' | 'tetrad' | 'heptad' | 'even12';

export function generateHarmonyHues(baseHue: number, scheme: HarmonyScheme, count: number): number[] {
  const h = ((baseHue % 360) + 360) % 360;
  if (scheme === 'analog') {
    const spread = 60;
    const step = count > 1 ? spread / (count - 1) : 0;
    return Array.from({ length: count }, (_, i) => h - spread/2 + i * step);
  }
  if (scheme === 'complementary') {
    const hues = [h, h + 180];
    while (hues.length < count) hues.push(h + (360 / count) * hues.length);
    return hues;
  }
  if (scheme === 'triad') {
    const tri = [h, h + 120, h + 240];
    return tri.slice(0, count);
  }
  if (scheme === 'tetrad') {
    const tet = [h, h + 90, h + 180, h + 270];
    return tet.slice(0, count);
  }
  if (scheme === 'heptad') {
    const step = 360 / 7;
    return Array.from({ length: count }, (_, i) => h + i * step);
  }
  if (scheme === 'even12') {
    const step = 360 / 12;
    return Array.from({ length: Math.max(count,12) }, (_, i) => h + i * step);
  }
  return [h];
}

export function huesToRgbPalette(hues: number[], saturation: number, lightness: number): RGB[] {
  return hues.map(H => hslToRgb(H, saturation, lightness));
}

const MAJOR_DEGREES = [0, 2, 4, 5, 7, 9, 11];
const MINOR_DEGREES = [0, 2, 3, 5, 7, 8, 10];

export function mapNotesToPalette(
  basePalette: RGB[],
  keySemitone: number,
  mode: 'major' | 'minor'
): { r: number; g: number; b: number }[] {
  // Builds a 12-note mapping using 7-color palette across diatonic degrees; others use nearest degree
  const degrees = mode === 'major' ? MAJOR_DEGREES : MINOR_DEGREES;
  const palette = basePalette.slice(0, 7);
  const mapping: RGB[] = Array.from({ length: 12 }, () => ({ r: 1, g: 1, b: 1 }));
  for (let i = 0; i < degrees.length; i++) {
    const pc = (degrees[i] + keySemitone + 120) % 12;
    mapping[pc] = palette[i % palette.length];
  }
  // Fill remaining with nearest lower degree color
  for (let pc = 0; pc < 12; pc++) {
    if (!mapping[pc]) mapping[pc] = palette[0];
    if (mapping[pc].r === undefined) {
      let best = 0; let bestDist = 999;
      for (let i = 0; i < degrees.length; i++) {
        const d = (degrees[i] + keySemitone + 120) % 12;
        const dist = Math.min((pc - d + 12) % 12, (d - pc + 12) % 12);
        if (dist < bestDist) { bestDist = dist; best = i; }
      }
      mapping[pc] = palette[best % palette.length];
    }
  }
  return mapping;
}


