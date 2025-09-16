import type { PresetModule } from "../../core/types";

const schema = {
  brightness: { type: 'number', min: 0, max: 2, step: 0.01, default: 1.0, description: 'Overall brightness' },
  tipSparkle: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.5, description: 'Sparkle amount at bar tips' },
} as const;

type Params = { [K in keyof typeof schema]: number };

const buildFragment = (_params: Params) => `
// 16 radial bars around center from bands; color shifts by dominant note
vec2 C=vec2(0.5); vec2 d=p-C; float r=length(d); float a=atan(d.y,d.x); if(a<0.0)a+=6.28318530718;
int seg = int(mod(floor(a/(6.28318530718/16.0)),16.0));
float e = clamp(band(seg),0.0,1.0);
float barLen = 0.18 + 0.55*pow(e,0.8);
float bar = 1.0 - smoothstep(barLen, barLen+0.02, r);
// Note tint
float domA=0.0; int domI=0; for(int i=0;i<4;i++){float m=noteAt(i); float aa=noteAmp(i); if(m<0.0)break; if(aa>domA){domA=aa; domI=int(mod(floor(m+0.5),12.0));}}
vec3 tint = toneColor(domI);
col = mix(vec3(0.05), tint, 0.3 + 0.7*bar);
// highs add sparkle at tips
float tip = smoothstep(0.86,0.88,r) * (0.2 + 0.8*u_high);
col += vec3(0.8,0.9,1.0)*tip*u_pm_tipSparkle;
col *= u_pm_brightness;
`;

export const PolarBarsPreset: PresetModule = {
  id: 'PolarBars',
  title: 'Polar Bars',
  schema: schema as any,
  defaults: { brightness: 1.0, tipSparkle: 0.5 },
  buildFragment: buildFragment as any,
};

export default PolarBarsPreset;

