import type { PresetModule } from "../../core/types";

const schema = {
  brightness: { type: 'number', min: 0, max: 2, step: 0.01, default: 1.0, description: 'Overall brightness' },
  ringRadius: { type: 'number', min: 0.18, max: 0.55, step: 0.001, default: 0.33, description: 'Ring radius' },
  orbSize: { type: 'number', min: 0.01, max: 0.2, step: 0.001, default: 0.05, description: 'Base orb size for bands' },
} as const;

type Params = { [K in keyof typeof schema]: number };

const buildFragment = (_params: Params) => `
// Central orb pulses with RMS; ring orbs respond to bands; notes add colored sparks
vec2 C = vec2(0.5);
vec2 d = p - C; float r = length(d);
// Base background
col = vec3(0.01) + vec3(0.02*u_low, 0.02*u_mid, 0.02*u_high);
// Central orb (loudness)
float R0 = 0.12 + 0.25*clamp(u_amp,0.0,1.0);
col += (1.0 - smoothstep(R0, R0+0.02, r)) * vec3(0.6,0.7,0.9);
// Ring of 12 band orbs (map bands 0..11)
float R = u_pm_ringRadius;
for (int i=0;i<12;i++){
  float theta = (float(i)/12.0)*6.28318530718;
  vec2 ctr = C + vec2(cos(theta), sin(theta)) * R;
  float b = band(i);
  float or = u_pm_orbSize + 0.15*pow(clamp(b,0.0,1.0), 0.8);
  float g = 1.0 - smoothstep(or, or+0.015, distance(p, ctr));
  vec3 c = vec3(0.2) + vec3(0.3,0.2,0.6)*b + vec3(0.2)*u_high;
  col += c*g;
}
// Notes as colored sparks at their pitch class angles
for (int k=0;k<4;k++){
  float m = noteAt(k); float a = noteAmp(k);
  if (m<0.0) break;
  int pc = int(mod(floor(m+0.5),12.0));
  float th = (float(pc)/12.0)*6.28318530718 + u_time*0.3;
  vec2 ctr = C + vec2(cos(th), sin(th)) * (R + 0.05*sin(u_time*1.3 + float(pc)));
  float or = 0.02 + 0.12*clamp(a,0.0,1.0);
  float g = 1.0 - smoothstep(or, or+0.01, distance(p, ctr));
  col += toneColor(pc) * g * (0.6 + 0.4*u_onset);
}
// Onset flash
col *= (1.0 + 0.25*u_onset) * u_pm_brightness;
`;

export const LayeredOrbitalsPreset: PresetModule = {
  id: 'LayeredOrbitals',
  title: 'Layered Orbitals',
  schema: schema as any,
  defaults: { brightness: 1.0, ringRadius: 0.33, orbSize: 0.05 },
  buildFragment: buildFragment as any,
};

export default LayeredOrbitalsPreset;

