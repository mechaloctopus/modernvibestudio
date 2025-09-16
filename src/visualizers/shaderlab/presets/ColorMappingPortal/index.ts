import type { PresetModule } from "../../core/types";

const schema = {
  brightness: { type: 'number', min: 0, max: 2, step: 0.01, default: 1.0, description: 'Overall brightness' },
  orbSize: { type: 'number', min: 0.01, max: 0.2, step: 0.001, default: 0.045, description: 'Base orb size' },
  ringRadius: { type: 'number', min: 0.1, max: 0.6, step: 0.001, default: 0.33, description: 'Ring radius' },
  showSecondary: { type: 'number', min: 0, max: 1, step: 1, default: 1, description: 'Blend in secondary note color (0/1)' },
} as const;

type Params = { [K in keyof typeof schema]: number };

const buildFragment = (_params: Params) => `
// Universal Color Mapping Portal: show 12-tone rainbow + detected notes (1-4) with smoothing
vec2 res = u_res; vec2 qv = p - 0.5; qv.x *= res.x / max(res.y, 1.0);
float t = u_time;
col = vec3(0.02,0.025,0.035);

// Draw 12 tone orbs around a ring using toneColor mapping
float R = u_pm_ringRadius;
float baseSize = u_pm_orbSize;
for (int i=0; i<12; i++){
  float th = (float(i)/12.0) * 6.28318530718;
  vec2 ctr = vec2(0.5) + vec2(cos(th), sin(th)) * R;
  float r = baseSize;
  float d = distance(p, ctr);
  float fill = 1.0 - smoothstep(r, r+0.01, d);
  vec3 c = toneColor(i);
  // subtle pulsing with bands
  float pulse = 0.06*(0.5+0.5*sin(t*2.0 + float(i)))*(0.2+0.8*clamp(u_mid,0.0,1.0));
  col += c * fill * (0.3 + pulse);
}

// Smoothed primary and secondary pitch-class colors
float pc = u_pcSmooth; float f = fract(pc); int i0 = int(floor(pc));
vec3 c0 = toneColor(i0);
vec3 c1 = toneColor(i0+1);
vec3 smCol = mix(c0, c1, f);
float w2 = clamp(u_pc2Weight, 0.0, 1.0);
if (u_pm_showSecondary > 0.5) {
  float pc2 = u_pc2Smooth; float f2 = fract(pc2); int j0 = int(floor(pc2));
  vec3 s0 = toneColor(j0);
  vec3 s1 = toneColor(j0+1);
  vec3 sm2 = mix(s0, s1, f2);
  smCol = mix(smCol, sm2, 0.45*w2);
}

// Central disc showing smoothed tone color
float rC = 0.10 + 0.05*clamp(u_amp,0.0,1.0);
float dC = length(qv);
float fillC = 1.0 - smoothstep(rC, rC+0.01, dC);
col += smCol * fillC * (0.6 + 0.6*clamp(u_amp,0.0,1.0));

// Display up to 4 detected notes as larger orbs on an outer ring; size and brightness by amp
for (int k=0; k<4; k++){
  float m = noteAt(k); if (m < 0.0) break; float a = noteAmp(k);
  if (a < u_noteThreshold) continue;
  int pcI = int(mod(floor(m+0.5), 12.0));
  float th = (float(pcI)/12.0) * 6.28318530718;
  float RR = R + 0.08 + 0.04*sin(t*0.7 + float(k));
  vec2 ctr = vec2(0.5) + vec2(cos(th), sin(th)) * RR;
  float r = baseSize * (1.2 + 1.6*clamp(a, 0.0, 1.0));
  float d = distance(p, ctr);
  float fill = 1.0 - smoothstep(r, r+0.01, d);
  vec3 c = noteColor(m);
  // glow ring
  float glow = smoothstep(r+0.02, r+0.0, d) * 0.25;
  col += c * (fill * (0.6 + 0.6*a) + glow * (0.3 + 0.7*clamp(u_high,0.0,1.0)));
}

// Thin ring guide
float ringLine = abs(length(qv) - R);
float ring = smoothstep(0.006, 0.0, ringLine);
col += vec3(0.25,0.3,0.35) * ring * 0.5;

col *= u_pm_brightness;
`;

export const ColorMappingPortalPreset: PresetModule = {
  id: 'ColorMappingPortal',
  title: 'Universal Color Mapping Portal',
  schema: schema as any,
  defaults: { brightness: 1.0, orbSize: 0.045, ringRadius: 0.33, showSecondary: 1 },
  buildFragment: buildFragment as any,
};

export default ColorMappingPortalPreset;

