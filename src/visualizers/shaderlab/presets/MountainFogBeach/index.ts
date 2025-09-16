import type { PresetModule } from "../../core/types";

const schema = {
  brightness: { type: 'number', min: 0, max: 2, step: 0.01, default: 1.0, description: 'Overall brightness' },
  fog: { type: 'number', min: 0, max: 2, step: 0.01, default: 1.0, description: 'Fog glow strength' },
} as const;

type Params = { [K in keyof typeof schema]: number };

const buildFragment = (_params: Params) => `
// Mountain silhouette with glowing fog and water ripples; ported from legacy version.

// Aspect-corrected coordinates centered at horizon
vec2 res = u_res;
vec2 qv = (p - 0.5);
qv.x *= res.x / max(res.y, 1.0);

float t = u_time * (0.6 + 1.4*u_speed) + u_onset*0.15;

// Fractal ridge field for mountains
vec2 q = qv * (1.6 + 0.6*u_detail);
float field = 0.0;
vec2 pq = q;
for (int i=0; i<6; i++){
  pq = r2(1.7) * pq * 1.6 + vec2(0.11, -0.13);
  float rid = abs(sin(pq.x + sin(pq.y) + t*0.4));
  field += rid * pow(0.6, float(i));
}
field /= 1.0;

// Mountain mask (higher field -> mountain), horizon slightly below center
float horizon = -0.05;
float mountain = smoothstep(0.0, 0.18, field - (qv.y - horizon));

// Water ripples below horizon
float water = smoothstep(0.02, 0.0, (qv.y - horizon));
float rip = 0.0;
if (water > 0.0){
  float freq = 34.0 + 26.0*u_mid;
  rip = 0.5 + 0.5*sin(qv.x*freq + t*2.6*(1.0+0.6*u_low));
  rip *= 0.6 + 0.6*u_high;
}

// Note tint from dominant note
float domA = 0.0; int domI = 0;
for (int i=0;i<4;i++){ float m=noteAt(i); float a=noteAmp(i); if (m<0.0) break; if (a>domA){ domA=a; domI=wrap12(int(floor(m+0.5))); } }
vec3 noteTint = toneColor(domI);

// Base night color
vec3 base = mix(vec3(0.05,0.06,0.08), noteTint, 0.15 + 0.35*domA);
col = base;

// Fog glow near horizon (scaled by u_pm_fog)
float fog = exp(-abs((qv.y - horizon))*8.0) * (0.35 + 1.2*clamp(u_amp,0.0,1.0));
col += noteTint * fog * (0.6 + 0.8*u_low) * u_pm_fog;

// Water contribution and soft reflection of mountains
float refl = mountain * water * (0.4 + 0.6*u_high) * (0.5 + 0.5*rip);
col += vec3(0.65,0.82,1.0) * refl;
col += vec3(0.7,0.85,1.0) * rip * water * 0.35;

// Darken mountain silhouette (preserve form)
col = mix(col, col * (0.35 + 0.65*(1.0 - mountain)), 0.9);

// Add fine sparkle with highs
float n = fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453);
col += vec3(n*n*n) * clamp(u_high,0.0,1.0) * 0.12;

// Preset brightness knob
col *= u_pm_brightness;
`;

export const MountainFogBeachPreset: PresetModule = {
  id: 'MountainFogBeach',
  title: 'Mountain Fog Beach',
  schema: schema as any,
  defaults: { brightness: 1.0, fog: 1.0 },
  buildFragment: buildFragment as any,
};

export default MountainFogBeachPreset;

