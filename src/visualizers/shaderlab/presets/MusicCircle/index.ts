import type { PresetModule } from "../../core/types";

const schema = {
  brightness: { type: 'number', min: 0, max: 2, step: 0.01, default: 1.0, description: 'Overall brightness' },
  ringRadius: { type: 'number', min: 0.15, max: 0.6, step: 0.001, default: 0.36, description: 'Ring radius' },
  minOrbScale: { type: 'number', min: 0.05, max: 0.5, step: 0.001, default: 0.12, description: 'Idle orb size (as chord length fraction)' },
  maxOrbScale: { type: 'number', min: 0.2, max: 0.7, step: 0.001, default: 0.36, description: 'Max orb size (as chord length fraction)' },
} as const;

type Params = { [K in keyof typeof schema]: number };

const buildFragment = (_params: Params) => `
// 12-orb chromatic circle (clock layout) with toneColor mapping
float PI = 3.14159265;
float R = u_pm_ringRadius;                 // ring radius
float s = sin(PI/12.0);
float L = 2.0 * R * s;          // chord length between adjacent centers
float minR = L * u_pm_minOrbScale;          // minimum radius (dim idle dot)
float maxR = L * u_pm_maxOrbScale;          // cap radius so neighbors never overlap
float soft = minR * 0.6;        // edge softness scales with size
for (int i=0; i<12; i++){
  int pc = i; // chromatic order
  float theta = (float(i)/12.0) * (2.0*PI);
  vec2 ctr = vec2(0.5) + vec2(cos(theta), sin(theta)) * R;
  // amplitude for this pitch class from top notes
  float ampPC = 0.0;
  for (int k=0; k<4; k++){
    float m = noteAt(k); if (m < 0.0) break;
    int pcNote = int(mod(floor(m+0.5), 12.0)); if (pcNote < 0) pcNote += 12;
    float eq = (pcNote == pc) ? 1.0 : 0.0;
    ampPC = max(ampPC, noteAmp(k) * eq);
  }
  float r = mix(minR, maxR, clamp(ampPC, 0.0, 1.0));
  float d = distance(p, ctr);
  float fill = 1.0 - smoothstep(r, r + soft, d);
  float bright = 0.18 + 0.82 * clamp(ampPC, 0.0, 1.0);
  col += toneColor(pc) * fill * bright;
}
col *= u_pm_brightness;
`;

export const MusicCirclePreset: PresetModule = {
  id: 'MusicCircle',
  title: 'Music Circle',
  schema: schema as any,
  defaults: { brightness: 1.0, ringRadius: 0.36, minOrbScale: 0.12, maxOrbScale: 0.36 },
  buildFragment: buildFragment as any,
};

export default MusicCirclePreset;

