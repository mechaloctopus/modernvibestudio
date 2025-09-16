import type { PresetModule } from "../../core/types";

const schema = {
  brightness: { type: 'number', min: 0, max: 2, step: 0.01, default: 1.0, description: 'Overall brightness' },
  yOffset: { type: 'number', min: -1, max: 1, step: 0.01, default: -0.18, description: 'Vertical offset' },
} as const;

type Params = { [K in keyof typeof schema]: number };

const buildFragment = (_params: Params) => `
// Organic squid-like swimmer; audio drives color and motion

// aspect-corrected coords
vec2 qv = p - 0.5;
qv.x *= u_res.x / max(u_res.y, 1.0);
qv.y += u_pm_yOffset;

float t = u_time * (0.5 + 0.8*u_speed) + u_onset*0.08;

vec3 noteTint = vec3(0.0);
float domA=0.0; int domI=0; for(int i=0;i<4;i++){ float mn=noteAt(i); float A=noteAmp(i); if(mn<0.0)break; if(A>domA){domA=A; domI=wrap12(int(floor(mn+0.5)));} }
noteTint = toneColor(domI);

vec3 acc = vec3(0.0);
for (int j=0; j<6; j++){
  float phase = float(j)*1.0472; // ~PI/3 evenly spaced tentacles
  for (int k=0; k<24; k++){
    if (k > int(floor(mix(8.0, 24.0, u_quality)))) break;
    float s = 0.75 + 0.016*float(k);
    float ph = t*1.15 + s*7.3 + phase;
    vec2 c0 = vec2(0.18*sin(ph*0.75), -0.25 + s*0.95 + 0.06*sin(ph*0.4));
    vec2 d = qv - c0;
    float w = 0.06 + 0.02*sin(ph*1.8);
    float g = exp(-dot(d,d)/(w*w));
    vec3 c = mix(vec3(0.07,0.08,0.12), noteTint, 0.35 + 0.35*clamp(u_mid,0.0,1.0));
    acc += c * g * (0.8 + 0.6*u_amp);
  }
}
vec3 squid_outc = acc / (vec3(1.0) + abs(acc));
col = mix(squid_outc, squid_outc * noteTint, 0.35 + 0.35*clamp(domA,0.0,1.0));
col *= (0.6 + 0.6*clamp(u_amp,0.0,1.0));
col *= u_pm_brightness;
`;

export const SquidPreset: PresetModule = {
  id: 'Squid',
  title: 'Squid',
  schema: schema as any,
  defaults: { brightness: 1.0, yOffset: -0.18 },
  buildFragment: buildFragment as any,
};

export default SquidPreset;

