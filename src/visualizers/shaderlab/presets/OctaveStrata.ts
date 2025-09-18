import type { PresetModule } from "../core/types";

const OctaveStrata: PresetModule = {
  id: "OctaveStrata",
  title: "Octave Strata",
  description:
    "Multi-octave horizontal layers with note-colored pulses and gentle turbulence. Dissonance adds cross-layer distortion; resonance aligns flows.",
  schema: {
    strataStrength: { type: "number", min: 0.0, max: 1.5, step: 0.01, default: 0.9, description: "Layer brightness", group: "Layers" },
    octSpread: { type: "number", min: 0.3, max: 2.0, step: 0.01, default: 1.0, description: "Vertical spacing across octaves", group: "Layers" },
    flowSpeed: { type: "number", min: 0.0, max: 2.0, step: 0.01, default: 0.6, description: "Flow speed along strata", group: "Motion" },
    distort: { type: "number", min: 0.0, max: 1.2, step: 0.01, default: 0.35, description: "Cross-layer distortion from dissonance", group: "Motion" },
    pulseSize: { type: "number", min: 0.3, max: 2.0, step: 0.01, default: 0.9, description: "Note pulse size", group: "Style" },
    gridMix: { type: "number", min: 0.0, max: 1.0, step: 0.01, default: 0.35, description: "Background pitch-class grid mix", group: "Style" },
  },
  buildFragment: () => `
// Octave-based horizontal strata with chromatic pulses
// IMPORTANT: No function definitions here; this body is injected inside main()

vec2 uv = p; float t = u_time * (0.5 + 1.2*u_pm_flowSpeed);

// Inline resonance (R) and dissonance (D)
float R=0.0; float D=0.0;
{
  float m0=-1.0; for(int i=0;i<4;i++){ float m=noteAt(i); if(m<0.0) break; if(m0<0.0 || m<m0){ m0=m; } }
  if(m0>=0.0){ float sum=0.0, ws=0.0; for(int i=0;i<4;i++){ float m=noteAt(i); float a=noteAmp(i); if(m<0.0) break; float r=pow(2.0,(m-m0)/12.0); float best=1e9; for(int H=1;H<=6;H++){ best=min(best,abs(r-float(H))); } float match=exp(-best*35.0); sum+=match*a; ws+=a; } R=(ws>0.0)?(sum/ws):0.0; }
  float cs=0.0, w=0.0; for(int i=0;i<4;i++){ float ai=noteAmp(i); float mi=noteAt(i); if(mi<0.0) break; for(int j=0;j<4;j++){ if(j>i){ float aj=noteAmp(j); float mj=noteAt(j); if(mj<0.0) break; float ww=ai*aj; int iv=int(mod(abs(floor(mi+0.5)-floor(mj+0.5)),12.0)); float cons=0.3; if(iv==0)cons=1.0; else if(iv==7)cons=0.9; else if(iv==5)cons=0.85; else if(iv==4||iv==3)cons=0.8; else if(iv==9)cons=0.7; else if(iv==2||iv==10)cons=0.5; else if(iv==8)cons=0.4; else if(iv==1||iv==11)cons=0.3; else if(iv==6)cons=0.1; cs+=cons*ww; w+=ww; } } } float con=(w>0.0)?(cs/w):0.0; D=1.0-con;
}

// background pitch-class grid in X (12 columns)
float gx = abs(fract(uv.x*12.0) - 0.5);
float gy = abs(fract(uv.y*8.0) - 0.5);
float gl = smoothstep(0.015, 0.0, min(gx, gy));
vec3 gridCol = vec3(0.08,0.1,0.12) + vec3(u_low,u_mid,u_high)*0.05;

// strata lines across y for octaves
float sAcc = 0.0; vec3 cAcc = vec3(0.0);
for (int oc=0; oc<8; oc++){
  float yo = (float(oc)/7.0 - 0.5) * u_pm_octSpread + 0.5;
  float dist = abs(uv.y - yo);
  float line = smoothstep(0.012, 0.0, dist) * (0.4 + 0.6*R) * u_pm_strataStrength;
  sAcc += line;
}

// note pulses in their octave layers, colored by pitch class
for (int i=0;i<4;i++){
  float m = noteAt(i); float a = noteAmp(i); if(m<0.0) break;
  int pc = int(mod(floor(m+0.5),12.0));
  float oy = clamp((floor(m/12.0)-2.0)/6.0, 0.05, 0.95);
  // drift along X with mild flow; dissonance increases cross-layer wobble
  float x = fract(uv.x + 0.15*sin(t + float(pc))*(0.3 + 0.7*u_mid));
  float wob = (uv.y - oy) + (0.02 + 0.12*u_pm_distort*D) * sin(uv.x*30.0 + t*1.3 + float(pc));
  float sz = (0.012 + 0.05*u_pm_pulseSize) * (0.7 + 0.6*a);
  float pulse = smoothstep(sz, 0.0, sqrt((uv.x - x)*(uv.x - x) + wob*wob));
  vec3 nc = toneColor(pc);
  cAcc += nc * pulse * (0.5 + 0.5*a);
}

vec3 base = gridCol * (0.6 + 0.4*u_pm_gridMix*gl);
vec3 strata = vec3(0.6,0.7,0.9) * sAcc * (0.2 + 0.8*(0.5+0.5*u_low));
vec3 pulses = cAcc;
vec3 coh = (strata + pulses) * (0.85 + 0.3*R);
col = clamp(base + coh, 0.0, 1.0);
`,
};

export default OctaveStrata;

