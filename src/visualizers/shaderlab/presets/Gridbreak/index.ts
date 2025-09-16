import type { PresetModule } from "../../core/types";

// Minimal per-preset control: brightness multiplier
const schema = {
  brightness: { type: 'number', min: 0, max: 2, step: 0.01, default: 1.0, description: 'Overall brightness' },
} as const;

type Params = { [K in keyof typeof schema]: number };

const buildFragment = (_params: Params) => `
// Gridbreak: cosine lattice broken by phase; audio-driven pace and tint
vec2 qv = p - 0.5; qv.x *= u_res.x / max(u_res.y, 1.0);
float tt = u_time * (0.6 + 1.2*u_speed) + u_onset*0.05;

// graceful tone tint from smoothed pitch-class uniforms (primary + optional secondary)
float pc = u_pcSmooth; float f = fract(pc); int i0 = int(floor(pc));
vec3 t0 = toneColor(i0);
vec3 t1 = toneColor(i0+1);
vec3 tint = mix(t0, t1, f);
float pc2 = u_pc2Smooth; float f2 = fract(pc2); int j0 = int(floor(pc2));
vec3 s0 = toneColor(j0);
vec3 s1 = toneColor(j0+1);
vec3 tint2 = mix(s0, s1, f2);
float w2 = clamp(u_pc2Weight, 0.0, 1.0);
tint = mix(tint, tint2, 0.45*w2);

vec2 q = qv * (1.2 + 1.0*u_zoom);
vec2 q1 = q + 0.06*vec2(sin(tt*0.7), cos(tt*0.9));
float g = (0.5+0.5*cos(20.0*q1.x)) * (0.5+0.5*cos(20.0*q1.y));
float warp = 0.1 * (u_low*0.6 + u_mid*0.3 + u_high*0.1);
q += warp * vec2(noise2(q*2.0 + tt), noise2(q*2.0 - tt));
float gb = (0.5+0.5*cos(20.0*q.x)) * (0.5+0.5*cos(20.0*q.y));

float d = smoothstep(0.2, 0.8, mix(g, gb, 0.5));
vec3 base = mix(vec3(0.04,0.05,0.07), tint, 0.25 + 0.35*clamp(u_amp,0.0,1.0));
col = mix(base*0.3, base, d);
col *= (0.6 + 0.6*clamp(u_amp,0.0,1.0));
col *= u_pm_brightness; // preset brightness knob
`;

export const GridbreakPreset: PresetModule = {
  id: 'Gridbreak',
  title: 'Gridbreak',
  schema: schema as any,
  defaults: { brightness: 1.0 },
  buildFragment: buildFragment as any,
};

export default GridbreakPreset;

