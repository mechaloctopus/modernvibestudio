import type React from 'react';

export type FeatureFrame = {
  timestampMs: number;
  amplitudeRms: number; // 0..1
  spectrum?: Float32Array; // normalized magnitudes 0..1
  spectralCentroidHz?: number;
  spectralRolloffHz?: number; // e.g., 85% rolloff frequency
  spectralFlatness?: number; // 0..1 (0 tonal, 1 noise-like)
  sampleRateHz?: number;
  dominantFreqHz?: number;
  midiNote?: number; // fractional MIDI note (e.g., 60.1)
  bandEnergies?: { low: number; mid: number; high: number }; // 0..1 per band
  onsetPercussive?: boolean;
  onsetRatePerSec?: number; // approximate recent onsets per second
  notesMidi?: Float32Array; // up to N top notes
  notesAmp?: Float32Array; // corresponding amplitudes (0..1)
  zeroCrossingRate?: number; // 0..1 normalized ZCR
  chroma12?: Float32Array; // length 12 pitch-class energies (normalized)
  keyIndex?: number; // 0..11 (C..B)
  keyIsMajor?: boolean;
  keyConfidence?: number; // 0..1
  vocalBandEnergy?: number; // fraction of energy 300..3400Hz
  percussiveScore?: number; // 0..1 heuristic percussiveness
  harmonicScore?: number; // 0..1 tonal/harmonic emphasis
};

export type VisualParamSchema = Record<string, {
  type: 'number' | 'boolean' | 'color' | 'select' | 'string';
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  default: any;
  description?: string;
  multiline?: boolean;
  // Optional: limit visibility to specific presets (used by ShaderLab)
  presets?: string[];
  // Optional: UI grouping label (used by Menu to section controls)
  group?: string;
}>;

export type VisualizerModule = {
  id: string;
  name: string;
  schema: VisualParamSchema;
  defaultParams: Record<string, any>;
  Component: React.FC<{ params: Record<string, any>; frame: FeatureFrame | null }>;
};

export type AudioMappingSettings = {
  scale: 'linear' | 'log';
  magnitudeMode: 'linear' | 'db';
  dbFloor: number; // -80..0 dB
  lowHz: number;
  highHz: number;
  numBands: number; // 4..64
  normalize: boolean;
};

export type RoutingSource =
  | { kind: 'band'; index: number }
  | { kind: 'group'; name: 'low' | 'mid' | 'high' }
  | { kind: 'rms' }
  | { kind: 'onset' }
  | { kind: 'centroid' }
  | { kind: 'note' };

export type RoutingCurve = 'linear' | 'exp' | 'log' | 'smoothstep';

export type ParamRoute = {
  id: string;
  visualizerId: string;
  paramKey: string;
  source: RoutingSource;
  scale: { inMin: number; inMax: number; outMin: number; outMax: number };
  curve: RoutingCurve;
  enabled: boolean;
};


