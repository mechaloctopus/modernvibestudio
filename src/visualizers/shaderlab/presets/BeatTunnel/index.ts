import type { PresetModule } from "../../core/types";

const schema = {
  brightness: { type: 'number', min: 0, max: 2, step: 0.01, default: 1.0, description: 'Overall brightness' },
  ringBoost: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.4, description: 'Onset shock ring intensity' },
} as const;

type Params = { [K in keyof typeof schema]: number };

const buildFragment = (_params: Params) => `
// Radial tunnel; bass controls zoom, mids swirl, highs star specks; onset shock ring
vec2 C = vec2(0.5); vec2 q = (p-C);
float ang = atan(q.y,q.x);
float rad = length(q);
float zoom = 0.6 + 0.6*clamp(u_low,0.0,1.0);
float swirl = 0.7*u_mid;
float stripes = 0.5+0.5*sin(20.0*log(1.0+rad*6.0) - u_time*2.0*zoom + swirl*ang*4.0);
vec3 base = mix(vec3(0.05,0.06,0.08), vec3(0.1,0.12,0.16), stripes);
col = base;
// Highs add starry specks
float star = smoothstep(0.998,1.0, fract(sin(dot(p*vec2(123.34,456.21), vec2(12.9898,78.233)))*43758.5453));
col += vec3(0.8,0.9,1.0) * star * clamp(u_high,0.0,1.0) * 0.5;
// Onset shock ring
float ring = 1.0 - smoothstep(0.35 + 0.25*u_onset, 0.37 + 0.25*u_onset, rad);
col += vec3(1.0,0.8,0.6) * ring * u_pm_ringBoost;
// Notes tint
float tint=0.0; int idx=0; for(int i=0;i<4;i++){float m=noteAt(i); if(m<0.0)break; float aa=noteAmp(i); if(aa>tint){tint=aa; idx=int(mod(floor(m+0.5),12.0));}}
col = mix(col, col + toneColor(idx)*0.6, clamp(tint,0.0,1.0)*0.6);
col *= u_pm_brightness;
`;

export const BeatTunnelPreset: PresetModule = {
  id: 'BeatTunnel',
  title: 'Beat Tunnel',
  schema: schema as any,
  defaults: { brightness: 1.0, ringBoost: 0.4 },
  buildFragment: buildFragment as any,
};

export default BeatTunnelPreset;

