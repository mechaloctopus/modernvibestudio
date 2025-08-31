# ModernVibeStudio

Real‑time, customizable, audio‑reactive visualizer. Plug in a mic, map sound to color/geometry, and render shader‑driven art that dances with your voice or music. Built with Expo + TypeScript so it runs on iOS/Android/Web and iterates fast.

## Why
- Bridge sound and color in a flexible playground for mandalas, spectra, and particles.
- Switch algorithms instantly; tweak parameters live; save/share presets.
- Perform with it: sing or play instruments and project visuals in real time.

## Highlights
- Live microphone input (Expo/React Native, Web Audio on web)
- Feature extraction (RMS, FFT bands, centroid, envelopes; later onset/pitch)
- GPU shaders via `gl-react` and `gl-react-expo`
- Modular visualizers with typed param schemas
- Low‑latency pipeline and smoothing for stable visuals
- Testable DSP: unit tests for mapping/math

## Tech Stack
- App: Expo (React Native) + TypeScript
- Audio: `expo-av` (mobile), Web Audio API (web)
- Rendering: `gl-react`, `gl-react-expo`, GLSL shaders
- State: `zustand` (+ immer)
- UI: React Native components; custom knobs/sliders
- Tests: Jest + jest-expo + @testing-library/react-native
- Lint/Format: ESLint + Prettier

## Architecture
```
mic → AudioEngine (buffers) → FeatureExtractors (fft, rms, envelopes)
      → Mapping (color scales, band splits, smoothing)
      → Visualizer Module (GLSL uniforms) → gl-react (WebGL) → screen
```

### Core Modules
- `src/audio/AudioEngine.ts`: mic start/stop, provides ring buffers and frame callbacks
- `src/audio/FeatureExtractors/*`: fft, rms, centroid, envelopes
- `src/core/types.ts`: FeatureFrame, VisualizerModule, VisualParamSchema
- `src/core/mapping.ts`: transforms FeatureFrame → visual params
- `src/core/color.ts`: note/frequency → hue/gradient utilities
- `src/visualizers/*`: independent visualizer modules (mandala, spectrum, particles)
- `src/state/useStore.ts`: global store (selected visualizer, params, presets)
- `src/ui/Menu.tsx`: schema‑driven controls

## Roadmap
- MVP
  - Mic capture + RMS/FFT feature stream
  - Visualizers: Radial Spectrum + Mandala v1
  - Menu to switch algorithms and tweak params
  - Preset save/load (JSON)
  - Unit tests for mapping and math
- Beta
  - Onset/pitch detection; particles visualizer
  - Randomizer + preset packs
  - Screen recording on native builds
  - External control (MIDI/OSC) [stretch]

## Getting Started
1. Prereqs: Node LTS, Expo Go app on your phone.
2. Install deps: `npm install` (already done by scaffold)
3. Start dev server: `npm run start`
4. Open on device: scan QR in Expo CLI → Expo Go. Or run `npm run web`.
5. Mic permission will be requested on first use.

## Development Workflow
- Edit code; Expo fast refresh updates instantly.
- Use the menu overlay to switch visualizers and tune parameters.
- Keep new math/mapping functions pure and add unit tests.

## Testing
- Run: `npm test`
- Scope: `src/core/*.test.ts`, `src/audio/FeatureExtractors/*.test.ts`
- Strategy: fixture audio (sine sweeps, impulses) → expected features and mappings.

## Performance Notes
- Aim for < 50ms mic→visual latency.
- Use exponential moving average for smoothing.
- Prefer constant‑time operations; reuse typed arrays.
- Avoid re‑creating GL nodes; pass uniforms as memoized props.

## iOS Projection Use‑Case
- Use a wired adapter (Lightning/USB‑C to HDMI) for lowest latency.
- Keep device in Do Not Disturb; disable auto‑lock.
- Use a simple full‑screen visualizer scene; hide UI during performance.

## Contributing
- Follow the rules in `.cursorrules`.
- Keep TypeScript strict; write tests for pure functions.

## License
TBD (choose once ready to share publicly).
