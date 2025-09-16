import type { PresetModule } from "../../core/types";

const schema = {
  brightness: { type: 'number', min: 0, max: 2, step: 0.01, default: 1.0, description: 'Overall brightness' },
  yOffset: { type: 'number', min: -1, max: 1, step: 0.01, default: -0.25, description: 'Vertical offset' },
} as const;

type Params = { [K in keyof typeof schema]: number };

const buildFragment = (_params: Params) => `
// Audio-reactive growing mountain ridges; ported from legacy preset.

vec2 res = u_res; vec2 xy = (p - 0.5);
xy.x *= res.x / max(res.y, 1.0);
xy.y += u_pm_yOffset;
float t = u_time * (0.5 + 1.2*u_speed) + u_onset*0.12;
float h = 0.45;
mat2 m = r2(0.5 + 0.6*u_mid);

// Dominant note tint
float domA=0.0; int domI=0;
for (int i=0;i<4;i++){ float mn=noteAt(i); float A=noteAmp(i); if(mn<0.0) break; if (A>domA){ domA=A; domI=wrap12(int(floor(mn+0.5))); } }
vec3 tint = mix(vec3(0.35,0.6,0.9), toneColor(domI), 0.8);

float g = 0.0; vec3 acc = vec3(0.0);
for (int ii=0; ii<57; ii++){
  float i = float(ii) + 1.0;
  vec3 pp = vec3(xy * g, g) + vec3(h); // base position grows with g
  float s = 4.0; float e = pp.y - g*h*1.3;
  // inner accumulation loop (fixed steps)
  for (int jj=0; jj<16; jj++){
    pp.zx = (m * pp.zx);
    e += cos(t*0.5 + s*pp.x) / max(s, 0.001) * 0.5;
    s *= 1.4;
  }
  g += e * h * (0.8 + 0.4*u_low);
  // map e to brightness; include highs to add shimmer
  float br = clamp(e*0.33 + 0.2*u_high, 0.0, 1.0);
  acc += tint * br;
}
// normalize and apply gentle tone/amp response
col = acc / 57.0;
col *= (0.6 + 0.6*clamp(u_amp,0.0,1.0));
col *= u_pm_brightness;
`;

export const GrowingMountainsPreset: PresetModule = {
  id: 'GrowingMountains',
  title: 'Growing Mountains',
  schema: schema as any,
  defaults: { brightness: 1.0, yOffset: -0.25 },
  buildFragment: buildFragment as any,
};

export default GrowingMountainsPreset;

