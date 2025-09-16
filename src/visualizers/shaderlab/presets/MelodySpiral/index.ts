import type { PresetModule } from "../../core/types";

const schema = {
  brightness: { type: 'number', min: 0, max: 2, step: 0.01, default: 1.0, description: 'Overall brightness' },
  spiralTightness: { type: 'number', min: 1.0, max: 12.0, step: 0.01, default: 3.0, description: 'Base spiral tightness' },
} as const;

type Params = { [K in keyof typeof schema]: number };

const buildFragment = (_params: Params) => `
// Spiral arms influenced by notes; bass tightens spiral; highs add speckle
vec2 C=vec2(0.5); vec2 u=p-C; float r=length(u); float a=atan(u.y,u.x);
float k = u_pm_spiralTightness + 6.0*clamp(u_low,0.0,1.0);
float arm = 0.5+0.5*cos(k*a - 8.0*log(1.0+r*6.0) - u_time*1.2);
vec3 base = mix(vec3(0.03), vec3(0.12,0.14,0.18), arm);
col = base;
for(int i=0;i<4;i++){
  float m=noteAt(i); float A=noteAmp(i); if(m<0.0)break;
  int pc=int(mod(floor(m+0.5),12.0)); float th=float(pc)/12.0*6.28318530718;
  float wave = 0.5+0.5*cos(6.0*(a-th) - u_time*2.0);
  float glow = smoothstep(0.68,0.98,wave) * (0.2+0.8*A);
  col += toneColor(pc) * glow * 0.8;
}
// highs speckle
float n = fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);
col += vec3(n*n*n) * clamp(u_high,0.0,1.0) * 0.25;
col *= u_pm_brightness;
`;

export const MelodySpiralPreset: PresetModule = {
  id: 'MelodySpiral',
  title: 'Melody Spiral',
  schema: schema as any,
  defaults: { brightness: 1.0, spiralTightness: 3.0 },
  buildFragment: buildFragment as any,
};

export default MelodySpiralPreset;

