import type { PresetModule } from "../../core/types";

const schema = {
  brightness: { type: 'number', min: 0, max: 2, step: 0.01, default: 1.0, description: 'Overall brightness' },
  symmetry: { type: 'number', min: 3, max: 12, step: 1, default: 6, description: 'Kaleidoscope symmetry' },
} as const;

type Params = { [K in keyof typeof schema]: number };

const buildFragment = (_params: Params) => `
// 6-way kaleidoscope bloom; bass expands, mids rotates, highs bloom; notes add colored blips
vec2 C=vec2(0.5); vec2 q=(p-C)*2.0; float r=length(q);
float rot = u_mid*2.0;
float ang = atan(q.y,q.x)+rot;
ang = mod(ang, 6.28318530718/max(1.0,u_pm_symmetry));
float sym = cos(ang*max(1.0,u_pm_symmetry));
float pat = 0.5+0.5*cos(8.0*r - u_time*2.0 - 2.0*sym);
col = mix(vec3(0.04), vec3(0.8,0.5,0.6), pow(pat, 3.0)) * (0.6 + 0.6*u_low);
// highs bloom
col += vec3(0.8,0.9,1.0) * pow(clamp(u_high,0.0,1.0), 1.5) * 0.3;
// notes blips
for(int i=0;i<4;i++){
  float m=noteAt(i); float A=noteAmp(i); if(m<0.0)break;
  int pc=int(mod(floor(m+0.5),12.0)); float th=float(pc)/12.0*6.28318530718;
  vec2 ctr=C+vec2(cos(th),sin(th))*0.25; float g=1.0-smoothstep(0.03+0.12*A, 0.045+0.12*A, distance(p,ctr));
  col += toneColor(pc)*g;
}
col *= u_pm_brightness;
`;

export const KaleidoBloomPreset: PresetModule = {
  id: 'KaleidoBloom',
  title: 'Kaleido Bloom',
  schema: schema as any,
  defaults: { brightness: 1.0, symmetry: 6 },
  buildFragment: buildFragment as any,
};

export default KaleidoBloomPreset;

