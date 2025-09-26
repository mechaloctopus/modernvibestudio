import { Platform } from 'react-native';
import type { FeatureFrame } from '../core/types';
import { useStore } from '../state/useStore';

type AudioEngineListener = (frame: FeatureFrame) => void;

export class AudioEngine {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private dataArray: Uint8Array | null = null;
  private freqArray: Uint8Array | null = null;
  private rmsArray: Float32Array | null = null;
  private rafId: number | null = null;
  private listeners: Set<AudioEngineListener> = new Set();
  private sensitivity: number = 1.0;
  private emaAlpha: number = 0.0; // 0 disables smoothing
  private emaValue: number | null = null;
  private inputMode: 'mic' | 'tab' = 'mic';
  private deviceId: string | undefined;
  private onsetTimes: number[] = [];

  async start(): Promise<void> {
    if (this.audioContext) return;

    if (Platform.OS === 'web') {
      let stream: MediaStream;
      if (this.inputMode === 'tab' && (navigator.mediaDevices as any).getDisplayMedia) {
        stream = await (navigator.mediaDevices as any).getDisplayMedia({
          video: true,
          audio: { echoCancellation: false, noiseSuppression: false, sampleRate: 44100 },
        });
      } else {
        const constraints: MediaStreamConstraints = {
          audio: {
            echoCancellation: false as any,
            noiseSuppression: false as any,
            sampleRate: 44100 as any,
            ...(this.deviceId ? { deviceId: { exact: this.deviceId } as any } : {}),
          } as any,
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      }
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      const src = ctx.createMediaStreamSource(stream);
      src.connect(analyser);

      this.mediaStream = stream;
      this.audioContext = ctx;
      this.analyser = analyser;
      this.source = src;
      this.dataArray = new Uint8Array(analyser.frequencyBinCount);
      this.freqArray = new Uint8Array(analyser.frequencyBinCount);
      this.rmsArray = new Float32Array(analyser.fftSize);
      this.loop();
      return;
    }

    // Mobile fallback handled later with expo-av; no-op for now
  }

  stop(): void {
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.source) this.source.disconnect();
    if (this.analyser) this.analyser.disconnect();
    if (this.audioContext) this.audioContext.close();
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null;
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
    this.rmsArray = null;
  }

  setSensitivity(multiplier: number): void {
    // Accept range roughly 0.1..5 and clamp
    const clamped = Math.max(0.1, Math.min(5, multiplier));
    this.sensitivity = clamped;
  }

  setRmsSmoothing(alpha: number): void {
    const clamped = Math.max(0, Math.min(1, alpha));
    this.emaAlpha = clamped;
    this.emaValue = null;
  }

  setInputMode(mode: 'mic' | 'tab'): void {
    if (this.inputMode !== mode) {
      this.inputMode = mode;
      // Will apply on next start(); caller should stop/start
    }
  }

  setDeviceId(id: string | undefined): void {
    this.deviceId = id;
  }

  onFrame(listener: AudioEngineListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async listInputDevices(): Promise<Array<{ deviceId: string; label: string }>> {
    if (Platform.OS !== 'web') return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label || 'Input ' + d.deviceId.slice(0,6) }));
    } catch {
      return [];
    }
  }

  private loop = () => {
    this.rafId = requestAnimationFrame(this.loop);
    if (!this.analyser || !this.dataArray) return;
    this.analyser.getByteTimeDomainData(this.dataArray);
    if (this.freqArray) this.analyser.getByteFrequencyData(this.freqArray);

    // RMS from time-domain
    let sum = 0;
    let zc = 0; // zero-crossing count
    let prevSign = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      const v = (this.dataArray[i] - 128) / 128; // -1..1
      sum += v * v;
      const sign = v > 0 ? 1 : v < 0 ? -1 : prevSign;
      if (i > 0 && sign !== 0 && prevSign !== 0 && sign !== prevSign) zc += 1;
      prevSign = sign;
    }
    const rms = Math.sqrt(sum / this.dataArray.length);
    let value = rms * this.sensitivity;
    if (this.emaAlpha > 0) {
      if (this.emaValue == null) this.emaValue = value;
      else this.emaValue = this.emaAlpha * value + (1 - this.emaAlpha) * this.emaValue;
      value = this.emaValue;
    }
    let spectrum: Float32Array | undefined;
    let centroidHz: number | undefined;
    let rolloffHz: number | undefined;
    let flatness: number | undefined;
    let dominantFreqHz: number | undefined;
    if (this.freqArray && this.audioContext) {
      const len = this.freqArray.length;
      spectrum = new Float32Array(len);
      let sumMag = 0;
      let weighted = 0;
      let maxMag = -1;
      let maxIndex = 0;
      const peaks: Array<{ idx: number; mag: number }> = [];
      for (let i = 0; i < len; i++) {
        const magRaw = this.freqArray[i] / 255;
        const mag = Math.max(0, Math.min(1, magRaw * this.sensitivity));
        spectrum[i] = mag; // apply sensitivity so downstream bands/graphs reflect UI
        sumMag += mag;
        const freq = (i * this.audioContext.sampleRate) / (2 * len);
        weighted += freq * mag;
        if (mag > maxMag) { maxMag = mag; maxIndex = i; }
        // simple local maxima
        const prevMag = Math.max(0, Math.min(1, (this.freqArray[i-1] / 255) * this.sensitivity));
        const nextMag = Math.max(0, Math.min(1, (this.freqArray[i+1] / 255) * this.sensitivity));
        if (i>0 && i<len-1 && mag > prevMag && mag > nextMag) {
          peaks.push({ idx: i, mag });
        }
      }
      centroidHz = sumMag > 0 ? weighted / sumMag : 0;
      dominantFreqHz = (maxIndex * this.audioContext.sampleRate) / (2 * len);
      // Spectral rolloff (85%)
      const target = sumMag * 0.85;
      let acc = 0;
      let rollIdx = 0;
      for (let i = 0; i < len; i++) { acc += spectrum[i]; if (acc >= target) { rollIdx = i; break; } }
      rolloffHz = (rollIdx * this.audioContext.sampleRate) / (2 * len);
      // Spectral flatness: geometric mean / arithmetic mean
      let geoSum = 0;
      for (let i = 0; i < len; i++) geoSum += Math.log(Math.max(1e-12, spectrum[i]));
      const gmean = Math.exp(geoSum / Math.max(1, len));
      const amean = sumMag / Math.max(1, len);
      flatness = amean > 0 ? Math.max(0, Math.min(1, gmean / amean)) : 0;
      // top-N peaks (sorted)
      peaks.sort((a,b)=> b.mag - a.mag);
      const N = 5;
      const adv = useStore.getState().advancedAnalysisEnabled;
      let notesMidi = new Float32Array(Math.min(N, peaks.length));
      let notesAmp = new Float32Array(Math.min(N, peaks.length));
      let notesConf = new Float32Array(Math.min(N, peaks.length));
      if (!adv) {
        for (let k = 0; k < notesMidi.length; k++) {
          const f = (peaks[k].idx * this.audioContext.sampleRate) / (2 * len);
          notesMidi[k] = 69 + 12 * Math.log2(Math.max(1e-6, f) / 440);
          notesAmp[k] = peaks[k].mag; // already scaled by sensitivity
          notesConf[k] = Math.max(0, Math.min(1, peaks[k].mag));
        }
      } else {
        // Lightweight polyphonic f0 voting and assignment
        const sr = this.audioContext.sampleRate;
        const ny = sr / 2;
        const maxPeaks = Math.min(40, peaks.length);
        const voteBins = new Float32Array(128); // MIDI ~0..127
        const freqs: number[] = new Array(maxPeaks);
        const mags: number[] = new Array(maxPeaks);

        for (let p = 0; p < maxPeaks; p++) {
          const i = peaks[p].idx; const m = peaks[p].mag;
          const f = (i * sr) / (2 * len);
          freqs[p] = f; mags[p] = m;
          const maxH = Math.max(1, Math.min(12, useStore.getState().signalLab?.harmonic?.maxHarmonics ?? 8));
          for (let h = 1; h <= maxH; h++) {
            const f0 = f / h; if (f0 < 40 || f0 > 4000) continue;
            const midi = 69 + 12 * Math.log2(f0 / 440);
            const bin = Math.max(0, Math.min(127, Math.round(midi)));
            voteBins[bin] += m / h;
          }
        }
        // pick up to N strongest bins separated by >= 2 semitones
        const chosen: number[] = [];
        for (let t = 0; t < 12; t++) {
          let bestV = 0, bestI = -1;
          for (let i = 0; i < voteBins.length; i++) {
            const v = voteBins[i];
            if (v > bestV && chosen.every(ci => Math.abs(ci - i) >= 2)) { bestV = v; bestI = i; }
          }
          if (bestI < 0 || chosen.length >= N) break;
          chosen.push(bestI);
          // zero neighborhood to avoid near-duplicates
          for (let j = Math.max(0, bestI-1); j <= Math.min(127, bestI+1); j++) voteBins[j] *= 0.2;
        }
        // Assign peaks to closest harmonic of chosen f0s
        const out: Array<{ midi:number; amp:number; conf:number }>= [];
        for (const mi of chosen) {
          const f0 = 440 * Math.pow(2, (mi - 69)/12);
          let energy = 0; let align = 0; let weight = 0;
          for (let p = 0; p < maxPeaks; p++) {
            const f = freqs[p]; const m = mags[p]; if (m <= 0) continue;
            const h = Math.max(1, Math.round(f / f0)); const maxH2 = Math.max(1, Math.min(12, useStore.getState().signalLab?.harmonic?.maxHarmonics ?? 8)); if (h > maxH2) continue;
            const fh = f0 * h; const rel = Math.abs((f - fh)/Math.max(1e-3, fh));
            const slope = Math.max(1, Math.min(200, useStore.getState().signalLab?.harmonic?.closenessSlope ?? 60));
            const closeness = Math.exp(-rel * slope); // ~1 when aligned within ~1-2%
            energy += m * closeness;
            align += closeness * m; weight += m;
          }
          if (energy > 0) out.push({ midi: mi, amp: energy, conf: weight>0 ? Math.max(0, Math.min(1, align/weight)) : 0 });
        }
        out.sort((a,b)=> b.amp - a.amp);
        const take = Math.min(N, out.length);
        notesMidi = new Float32Array(take);
        notesAmp = new Float32Array(take);
        notesConf = new Float32Array(take);
        for (let k = 0; k < take; k++) { notesMidi[k] = out[k].midi; notesAmp[k] = out[k].amp; notesConf[k] = out[k].conf; }
      }
      (this as any)._notesMidi = notesMidi;
      (this as any)._notesAmp = notesAmp;
      (this as any)._notesConf = notesConf;

      // Declarations hoisted to precede advanced metrics usage
      let bandEnergies: FeatureFrame['bandEnergies'] = undefined;
      let vocalBandEnergy: number | undefined;
      let percussiveScore: number | undefined;
      let harmonicScore: number | undefined;
      let chroma12: Float32Array | undefined;
      let keyIndex: number | undefined;
      let keyIsMajor: boolean | undefined;
      let keyConfidence: number | undefined;
      let chordName: string | undefined;
      let chordConfidence: number | undefined;
      let resonanceScore: number | undefined;
      let dissonanceScore: number | undefined;
      let harmonicToNoiseRatio: number | undefined;

	      // Advanced metrics (opt-in)
	      const adv2 = useStore.getState().advancedAnalysisEnabled;
	      if (adv2) {
	        // Advanced chord detection with extended templates
	        if (chroma12 && chroma12.length === 12) {
	          const SL = useStore.getState().signalLab;
          const allowed = new Set((SL?.chord?.types ?? ['maj','min','7','maj7','min7','dim','aug','sus2','sus4']).map(String));
          const allT: Array<{ name: string; iv: number[] }>= [
	            { name: 'maj', iv: [0,4,7] }, { name: 'min', iv: [0,3,7] },
	            { name: '7', iv: [0,4,7,10] }, { name: 'maj7', iv: [0,4,7,11] }, { name: 'min7', iv: [0,3,7,10] },
	            { name: 'dim', iv: [0,3,6] }, { name: 'aug', iv: [0,4,8] }, { name: 'sus2', iv: [0,2,7] }, { name: 'sus4', iv: [0,5,7] },
	          ];
          const T = allT.filter(t => allowed.has(t.name));
	          let best = -1, bestName = 'n/a';
	          for (let r = 0; r < 12; r++) {
	            for (const tpl of T) {
	              let s = 0;
	              for (const iv of tpl.iv) s += chroma12[(r + iv) % 12] || 0;
	              if (s > best) { best = s; bestName = `${r}:${tpl.name}`; }
	            }
	          }
	          const avg = T.length > 0 ? best / (T.length * 1.5) : 0;
	          chordName = bestName;
	          chordConfidence = Math.max(0, Math.min(1, best - avg));
          {
            const minC = useStore.getState().signalLab?.chord?.minConfidence ?? 0;
            if (chordConfidence < minC) { chordName = 'n/a'; }
          }

	          // simple temporal smoothing
	          const lastName = (this as any)._lastChordName as string | undefined;
	          const lastConf = (this as any)._lastChordConf as number | undefined;
	          if (lastName && lastName !== chordName && (lastConf ?? 0) > 0.7 && (performance.now() - ((this as any)._lastChordTime || 0)) < (useStore.getState().signalLab?.chord?.smoothingMs ?? 180)) {
	            chordName = lastName; chordConfidence = Math.max(0.6, (lastConf ?? 0.6) * 0.9);
	          }
	          (this as any)._lastChordName = chordName; (this as any)._lastChordConf = chordConfidence; (this as any)._lastChordTime = performance.now();
	        }
	        // Harmonic series alignment and HNR from detected notes
	        const nm: Float32Array | undefined = (this as any)._notesMidi;
	        const na: Float32Array | undefined = (this as any)._notesAmp;
	        if (nm && na && nm.length > 0) {
	          const sr = this.audioContext.sampleRate; const nBins = spectrum.length; const nyq = sr/2;
	          let H = 0, A = 0, alignSum = 0, wSum = 0;
	          for (let k = 0; k < nm.length; k++) {
	            const f0 = 440 * Math.pow(2, (nm[k] - 69)/12); const a0 = na[k] ?? 0;
	            for (let h = 1; h <= 8; h++) {
	              const fh = f0 * h; if (fh >= nyq) break;
	              const idx = Math.max(0, Math.min(nBins-1, Math.round((fh / nyq) * nBins)));
	              const nbh = Math.max(0, Math.min(2, useStore.getState().signalLab?.harmonic?.hnrNeighborBins ?? 1));
	              let win = (spectrum[idx] || 0);
	              for (let nb = 1; nb <= nbh; nb++) {
	                win += (spectrum[Math.max(0, idx-nb)] || 0) * 0.5 + (spectrum[Math.min(nBins-1, idx+nb)] || 0) * 0.5;
	              }
	              H += win;
	              // alignment measure reusing adjacent bins
	              const prev = spectrum[Math.max(0, idx-1)] || 0; const cur = spectrum[idx] || 0; const next = spectrum[Math.min(nBins-1, idx+1)] || 0;
	              const local = Math.max(0, cur - 0.5*(prev+next));
	              alignSum += local * a0; wSum += a0;
	            }
	            A += Math.max(0, a0);
	          }
	          const total = spectrum.reduce((s,v)=> s+v, 0);
	          harmonicToNoiseRatio = (H > 0 && total > 0) ? Math.max(0, Math.min(1, H / Math.max(1e-6, total))) : 0;
	          resonanceScore = (wSum > 0) ? Math.max(0, Math.min(1, alignSum / wSum * 2)) : 0;
	        }
	        // Dissonance (roughness) from detected notes pairs using Bark distance
	        const nm2: Float32Array | undefined = (this as any)._notesMidi;
	        const na2: Float32Array | undefined = (this as any)._notesAmp;
	        if (nm2 && na2 && nm2.length >= 2) {
	          const toHz = (m:number)=> 440 * Math.pow(2, (m - 69)/12);
	          const bark = (f:number)=> 13*Math.atan(0.00076*f)+3.5*Math.atan(Math.pow(f/7500,2));
	          let sum = 0, w = 0;
	          for (let i = 0; i < nm2.length; i++) for (let j = i+1; j < nm2.length; j++) {
	            const f1 = toHz(nm2[i]); const f2 = toHz(nm2[j]); const s = Math.abs(bark(f2)-bark(f1));
	            const a = (na2[i] ?? 0) * (na2[j] ?? 0);
	            const rough = Math.max(0, Math.exp(-3.5*s) - Math.exp(-5.75*s));
	            sum += rough * a; w += a;
	          }
	          { const strength = Math.max(0, useStore.getState().signalLab?.dissonance?.strength ?? 1); dissonanceScore = w>0 ? Math.max(0, Math.min(1, (sum / w * 3) * strength)) : 0; }
	        }
	      }

    }
    // Hoisted declarations for analysis outputs
    let bandEnergies: FeatureFrame['bandEnergies'] = undefined;
    let vocalBandEnergy: number | undefined;
    let percussiveScore: number | undefined;
    let harmonicScore: number | undefined;
    let chroma12: Float32Array | undefined;
    let keyIndex: number | undefined;
    let keyIsMajor: boolean | undefined;
    let keyConfidence: number | undefined;
    let chordName: string | undefined;
    let chordConfidence: number | undefined;
    let resonanceScore: number | undefined;
    let dissonanceScore: number | undefined;
    let harmonicToNoiseRatio: number | undefined;

    // crude band energies and onset (simple thresholded derivative of RMS)


    if (spectrum && this.audioContext) {
      const n = spectrum.length;
      const low = avg(spectrum, 0, Math.floor(n * 0.15));
      const mid = avg(spectrum, Math.floor(n * 0.15), Math.floor(n * 0.6));
      const high = avg(spectrum, Math.floor(n * 0.6), n);
      bandEnergies = { low, mid, high };
      // Vocal band 300..3400 Hz fraction
      const sr = this.audioContext.sampleRate;
      const binToHz = (i: number) => (i * sr) / (2 * n);
      let vSum = 0; let total = 0;
      for (let i = 0; i < n; i++) {
        const mag = spectrum[i];
        total += mag;
        const f = binToHz(i);
        if (f >= 300 && f <= 3400) vSum += mag;
      }
      vocalBandEnergy = total > 0 ? vSum / total : 0;
      // Chroma 12 from spectrum
      chroma12 = new Float32Array(12);
      for (let i = 1; i < n; i++) {
        const f = binToHz(i);
        if (f < 40) continue;
        const midi = 69 + 12 * Math.log2(f / 440);
        const pc = ((Math.round(midi) % 12) + 12) % 12;
        chroma12[pc] += spectrum[i];
      }
      let chromaSum = 0;
      for (let i = 0; i < 12; i++) chromaSum += chroma12[i];
      if (chromaSum > 0) for (let i = 0; i < 12; i++) chroma12[i] /= chromaSum;
      // Key detection via Krumhansl profiles
      const MAJOR_PROFILE = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
      const MINOR_PROFILE = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
      const corr = (shift: number, prof: number[]) => {
        let s = 0, a = 0, b = 0, aa = 0, bb = 0;
        for (let i = 0; i < 12; i++) {
          const x = chroma12![i];
          const y = prof[(i - shift + 1200) % 12];
          s += x * y; a += x; b += y; aa += x*x; bb += y*y;
        }
        const num = s - (a*b/12);
        const den = Math.sqrt(Math.max(1e-6, (aa - a*a/12) * (bb - b*b/12)));
        return den > 0 ? num/den : 0;
      };
      let best = -Infinity; let bestIdx = 0; let bestMaj = true;
      for (let k = 0; k < 12; k++) {
        const cMaj = corr(k, MAJOR_PROFILE);
        const cMin = corr(k, MINOR_PROFILE);
        if (cMaj > best) { best = cMaj; bestIdx = k; bestMaj = true; }
        if (cMin > best) { best = cMin; bestIdx = k; bestMaj = false; }
      }
      keyIndex = bestIdx; keyIsMajor = bestMaj; keyConfidence = Math.max(0, Math.min(1, (best + 1) / 2));
      // Percussive vs harmonic scores (heuristics)
      const zcrNorm = Math.max(0, Math.min(1, zc / this.dataArray.length * 2));
      const flat = flatness ?? 0;
      percussiveScore = Math.max(0, Math.min(1, 0.6*zcrNorm + 0.4*flat));
      harmonicScore = Math.max(0, Math.min(1, 1 - flat));
      // Advanced override using HNR (opt-in)
      if (useStore.getState().advancedAnalysisEnabled && harmonicToNoiseRatio != null) {
        percussiveScore = Math.max(0, Math.min(1, 0.5*zcrNorm + 0.25*flat + 0.25*(1 - harmonicToNoiseRatio)));
        harmonicScore = Math.max(0, Math.min(1, 0.7*harmonicToNoiseRatio + 0.3*(1 - flat)));
      }
    }
    const now = performance.now();
    const last = (this as any)._lastRmsTime ?? now;
    const lastRms = (this as any)._lastRmsVal ?? 0;
    (this as any)._lastRmsTime = now;
    (this as any)._lastRmsVal = value;
    const dt = Math.max(1e-3, (now - last) / 1000);
    const dr = (value - lastRms) / dt;
    // Normalize derivative by current level to make onset relative and robust to sensitivity
    const rel = dr / Math.max(1e-3, value + 1e-3);
    // Adjust threshold with smoothing: heavier smoothing => lower threshold
    const baseThresh = 2.5; // relative per-second rise
    const adj = baseThresh * (0.7 + 0.3 * (1 - this.emaAlpha));
    const onsetPercussive = rel > adj;
    if (onsetPercussive) {
      this.onsetTimes.push(now);
      // keep last ~3 seconds
      const cutoff = now - 3000;
      while (this.onsetTimes.length && this.onsetTimes[0] < cutoff) this.onsetTimes.shift();
    }
    const onsetRatePerSec = this.onsetTimes.length / 3;

    const frame: FeatureFrame = {
      timestampMs: performance.now(),
      amplitudeRms: Math.max(0, Math.min(1, value)),
      spectrum,
      spectralCentroidHz: centroidHz,
      spectralRolloffHz: rolloffHz,
      spectralFlatness: flatness,
      sampleRateHz: this.audioContext?.sampleRate,
      dominantFreqHz,
      midiNote: dominantFreqHz ? 69 + 12 * Math.log2(dominantFreqHz / 440) : undefined,
      bandEnergies,
      onsetPercussive,
      onsetRatePerSec,
      notesMidi: (this as any)._notesMidi,
      notesAmp: (this as any)._notesAmp,
      notesConfidence: (this as any)._notesConf,
      chordName,
      chordConfidence,
      resonanceScore,
      dissonanceScore,
      harmonicToNoiseRatio,

      zeroCrossingRate: Math.max(0, Math.min(1, zc / Math.max(1, this.dataArray.length-1))),
      chroma12,
      keyIndex,
      keyIsMajor,
      keyConfidence,
      vocalBandEnergy,
      percussiveScore,
      harmonicScore,
    };
    this.listeners.forEach((l) => l(frame));
  };
}

function avg(arr: Float32Array, start: number, end: number): number {
  const s = Math.max(0, Math.min(arr.length, start));
  const e = Math.max(s, Math.min(arr.length, end));
  if (e - s <= 0) return 0;
  let sum = 0;
  for (let i = s; i < e; i++) sum += arr[i];
  return sum / (e - s);
}

export const audioEngine = new AudioEngine();


