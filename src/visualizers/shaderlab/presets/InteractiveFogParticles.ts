import type { PresetModule } from "../core/types";

const InteractiveFogParticles: PresetModule = {
  id: "InteractiveFogParticles",
  title: "Interactive Fog Particles",
  description:
    "Floating fog-like particles that cluster with resonance, spread with dissonance, and layer by octave. Colors follow chromatic notes.",
  schema: {
    density: { type: "number", min: 0.2, max: 1.0, step: 0.01, default: 0.8, description: "Particle density", group: "Particles" },
    chaos: { type: "number", min: 0.0, max: 1.0, step: 0.01, default: 0.35, description: "Chaos from dissonance", group: "Particles" },
    cluster: { type: "number", min: 0.0, max: 1.0, step: 0.01, default: 0.65, description: "Attraction from resonance", group: "Particles" },
    particleSize: { type: "number", min: 0.2, max: 2.0, step: 0.01, default: 0.8, description: "Particle size", group: "Particles" },
    layerSpread: { type: "number", min: 0.2, max: 2.0, step: 0.01, default: 1.0, description: "Vertical spread between octave layers", group: "Layout" },
    flowSpeed: { type: "number", min: 0.0, max: 2.0, step: 0.01, default: 0.8, description: "Particle flow speed", group: "Motion" },
    noteTint: { type: "number", min: 0.0, max: 1.0, step: 0.01, default: 0.8, description: "Note tint mix", group: "Color" },
  },
  buildFragment: () => `
// Interactive fog-like particle field using resonance/dissonance from top notes
// IMPORTANT: No function definitions here; this body is injected inside main()

vec3 acc = vec3(0.0);
vec2 uv = p; // 0..1
float t = u_time * (0.2 + 1.2*u_pm_flowSpeed);

// Inline resonance (R) and dissonance (D)
float R = 0.0; float D = 0.0;
// Find lowest note m0
float m0 = -1.0;
for (int i=0;i<4;i++){ float m=noteAt(i); if(m<0.0) break; if(m0<0.0 || m<m0){ m0=m; } }
// Resonance by harmonic closeness to lowest note
if (m0 >= 0.0){
  float sum=0.0, wsum=0.0;
  for (int i=0;i<4;i++){
    float m=noteAt(i); float a=noteAmp(i); if(m<0.0) break;
    float r = pow(2.0, (m - m0)/12.0);
    float best = 1e9;
    for (int H=1; H<=6; H++){
      best = min(best, abs(r - float(H)));
    }
    float match = exp(-best*35.0);
    sum += match * a; wsum += a;
  }
  R = (wsum>0.0) ? (sum/wsum) : 0.0;
}
// Dissonance from interval consonance (pairwise)
float cs=0.0, ws=0.0;
for (int i=0;i<4;i++){
  float ai=noteAmp(i); float mi=noteAt(i); if(mi<0.0) break;
  for (int j=0;j<4;j++){
    if (j>i) {
      float aj=noteAmp(j); float mj=noteAt(j); if(mj<0.0) break; float w=ai*aj;
      int iv = int(mod(abs(floor(mi+0.5)-floor(mj+0.5)), 12.0));
      float cons=0.3;
      if(iv==0) cons=1.0; else if(iv==7) cons=0.9; else if(iv==5) cons=0.85; else if(iv==4||iv==3) cons=0.8; else if(iv==9) cons=0.7; else if(iv==2||iv==10) cons=0.5; else if(iv==8) cons=0.4; else if(iv==1||iv==11) cons=0.3; else if(iv==6) cons=0.1;
      cs += cons*w; ws += w;
    }
  }
}
float con = (ws>0.0) ? (cs/ws) : 0.0;
D = 1.0 - con;

// Establish a single target Y as amplitude-weighted octave center
float targetY = 0.5; float wsumY = 0.0;
for (int i=0;i<4;i++){
  float m=noteAt(i); float a=noteAmp(i); if(m<0.0) break;
  float oy = clamp((floor(m/12.0)-2.0)/6.0, 0.05, 0.95);
  targetY += oy * a; wsumY += a;
}
if (wsumY > 0.0) targetY /= (wsumY + 1e-6);

// Average note color tint
vec3 tint = vec3(0.0); float sumA = 0.0;
for (int i=0;i<4;i++){ float m=noteAt(i); float a=noteAmp(i); if(m<0.0) break; tint += noteColor(m)*a; sumA += a; }
if (sumA > 0.0) tint /= sumA; tint = mix(vec3(u_low,u_mid,u_high), tint, u_pm_noteTint);

// Particle seeds
int MAXP = 90; float dens = clamp(u_pm_density, 0.2, 1.0);
for (int si=0; si<90; si++){
  if (float(si) > float(MAXP)*dens) break;
  float id = float(si);
  // simple hash2 without defining a function
  float hx = fract(sin((id*13.37) + 0.123)*43758.5453);
  float hy = fract(sin((id*17.79) + 0.987)*22578.1459);
  vec2 rnd = vec2(hx, hy);
  // base path with mild curl noise
  vec2 pos = rnd;
  float n = fbm(rnd*3.0 + t*0.25);
  float jitter = (0.004 + 0.02*u_pm_chaos) * (0.3 + 0.7*D);
  pos += vec2(sin(t*0.6 + rnd.x*6.0 + n*3.0), cos(t*0.5 + rnd.y*6.0 - n*2.0)) * jitter;
  // attraction to target octave layer when resonance is high
  float attract = u_pm_cluster * (0.3 + 0.7*R);
  pos = mix(pos, vec2(pos.x, mix(pos.y, targetY, attract)), 0.8);
  // spread between layers by control
  pos.y = mix(pos.y, (pos.y-0.5)*u_pm_layerSpread + 0.5, 0.7);
  // soft particle
  float sz = (0.006 + 0.025*u_pm_particleSize) * (0.6 + 0.4*clamp(u_amp,0.0,1.0));
  float d = distance(uv, pos);
  float a = smoothstep(sz, 0.0, d);
  // slight size modulation by band energy and per-seed phase
  float pulse = 0.7 + 0.3*(u_low*0.4 + u_mid*0.35 + u_high*0.25) * (0.5 + 0.5*sin(t + id*1.7));
  acc += tint * a * pulse * 0.9;
}

// fog cohesion increases with resonance; chaos adds wobble
float baseFog = 0.15 + 0.35*R;
float chaosFog = 0.10 * D * u_pm_chaos;
vec3 bg = vec3(u_low,u_mid,u_high) * (baseFog + chaosFog);
col = clamp(bg + acc, 0.0, 1.0);
`,
};

export default InteractiveFogParticles;

