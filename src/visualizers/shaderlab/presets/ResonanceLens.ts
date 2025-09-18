import type { PresetModule } from "../core/types";

const ResonanceLens: PresetModule = {
  id: "ResonanceLens",
  title: "Resonance Lens",
  description:
    "A crisp grid-and-rings field that sharpens with resonance and distorts with dissonance; subtly tinted by chromatic notes.",
  schema: {
    sharpnessGain: { type: "number", min: 0.0, max: 2.0, step: 0.01, default: 1.0, description: "Crispness scaling from resonance", group: "Response" },
    distortion: { type: "number", min: 0.0, max: 1.5, step: 0.01, default: 0.45, description: "Distortion from dissonance", group: "Response" },
    ringDensity: { type: "number", min: 2.0, max: 20.0, step: 0.5, default: 8.0, description: "Concentric ring density", group: "Layout" },
    gridDensity: { type: "number", min: 3.0, max: 30.0, step: 0.5, default: 12.0, description: "Grid line density", group: "Layout" },
    lineWeight: { type: "number", min: 0.3, max: 2.0, step: 0.01, default: 1.0, description: "Base line thickness", group: "Style" },
    speed: { type: "number", min: 0.0, max: 2.0, step: 0.01, default: 0.7, description: "Animation speed", group: "Motion" },
    noteTint: { type: "number", min: 0.0, max: 1.0, step: 0.01, default: 0.7, description: "Note tint mix", group: "Color" },
  },
  buildFragment: () => `
// Resonance lens: sharpens edges with resonance and bends with dissonance
// IMPORTANT: No function definitions here; this body is injected inside main()

vec2 uv = p - 0.5; uv.x *= u_res.x / max(u_res.y, 1.0);
float t = u_time * (0.5 + 1.2*u_pm_speed);

// Inline resonance (R) and dissonance (D)
float R = 0.0; float D = 0.0;
{
  // Find lowest note m0
  float m0=-1.0;
  for(int i=0;i<4;i++){ float m=noteAt(i); if(m<0.0) break; if(m0<0.0 || m<m0){ m0=m; } }
  if(m0>=0.0){
    float sum=0.0, wsum=0.0;
    for(int i=0;i<4;i++){ float m=noteAt(i); float a=noteAmp(i); if(m<0.0) break; float r=pow(2.0,(m-m0)/12.0); float best=1e9; for(int H=1;H<=6;H++){ best=min(best,abs(r-float(H))); } float match=exp(-best*35.0); sum+=match*a; wsum+=a; }
    R = (wsum>0.0)?(sum/wsum):0.0;
  }
  float cs=0.0, ws=0.0; for(int i=0;i<4;i++){ float ai=noteAmp(i); float mi=noteAt(i); if(mi<0.0) break; for(int j=0;j<4;j++){ if(j>i){ float aj=noteAmp(j); float mj=noteAt(j); if(mj<0.0) break; float w=ai*aj; int iv=int(mod(abs(floor(mi+0.5)-floor(mj+0.5)),12.0)); float cons=0.3; if(iv==0)cons=1.0; else if(iv==7)cons=0.9; else if(iv==5)cons=0.85; else if(iv==4||iv==3)cons=0.8; else if(iv==9)cons=0.7; else if(iv==2||iv==10)cons=0.5; else if(iv==8)cons=0.4; else if(iv==1||iv==11)cons=0.3; else if(iv==6)cons=0.1; cs+=cons*w; ws+=w; } } } float con=(ws>0.0)?(cs/ws):0.0; D = 1.0-con;
}

// base field: concentric rings + grid
float r = length(uv);
float rings = 0.0;
float freqR = u_pm_ringDensity * (1.0 + 0.4*u_mid);
float kR = abs(sin(r*6.2831*0.5*freqR - t));

// line thickness modulated by resonance
float lw = (0.006 + 0.012*u_pm_lineWeight) * mix(1.6, 0.7, R * u_pm_sharpnessGain);
rings = smoothstep(lw, 0.0, abs(kR-1.0));

float gD = u_pm_gridDensity; vec2 g = uv*vec2(gD, gD);
// dissonance bends coordinates
vec2 bend = vec2(sin(uv.y*8.0 + t*0.9), cos(uv.x*8.0 - t*0.7)) * (0.03 * u_pm_distortion * D);
float gridLines = smoothstep(lw*1.2, 0.0, min(abs(fract((g+bend).x)-0.5), abs(fract((g+bend).y)-0.5)));

// note tint
float sumA=0.0; vec3 tint=vec3(0.0);
for(int i=0;i<4;i++){ float m=noteAt(i); float a=noteAmp(i); if(m<0.0) break; tint += noteColor(m)*a; sumA+=a; }
if(sumA>0.0) tint/=sumA; tint = mix(vec3(u_low,u_mid,u_high), tint, u_pm_noteTint);

vec3 colR = vec3(0.9,0.95,1.0) * rings * (0.25 + 0.75*R);
vec3 colG = vec3(0.7,0.85,1.0) * gridLines * (0.2 + 0.8*(0.4+0.6*u_high));
vec3 base = vec3(0.03,0.04,0.06) + vec3(u_low,u_mid,u_high)*0.08;
vec3 chaosFog = vec3(0.5,0.3,0.7) * (0.08 * D * u_pm_distortion);

col = clamp(base + (colR + colG)*0.8 + tint*0.3 + chaosFog, 0.0, 1.0);
`,
};

export default ResonanceLens;

