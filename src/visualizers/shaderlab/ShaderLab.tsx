import React from 'react';
import { Dimensions, View, Text, Button, Platform } from 'react-native';
// @ts-ignore - legacy library lacks types
import { Shaders, Node, GLSL } from 'gl-react';
import type { FeatureFrame, VisualizerModule } from '../../core/types';
import { applySpectrumMapping } from '../../core/mapping';
import { GLSurface } from '../../ui/GLSurface';
import { hslToRgb } from '../../core/color';
import type { ParamRoute } from '../../core/types';
import { WebGLFragment } from '../../ui/WebGLFragment';
import Registry from './core/registry';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Helper to pack vec4 uniforms conveniently
const vec = (x: number, y: number, z: number, w: number): [number, number, number, number] => [x, y, z, w];

type ShaderLabParams = {
  fragment: string; // user fragment body that sets vec3 col
  preset?: string;
  petals?: number;
  ripple?: number; // 0..1
  noteAmpInfluence?: number; // 0..1
  octaveBrightness?: number; // 0..1
  noteThreshold?: number; // 0..1
  blipSize?: number; // 0..1
  plasmaFocus?: number; // 0..1 radial focus (event horizon)
  plasmaSwirl?: number; // 0..1 swirl amount
  plasmaBandLow?: number; // 0..2 how much lows drive plasma
  plasmaBandMid?: number; // 0..2 how much mids drive plasma
  plasmaBandHigh?: number; // 0..2 how much highs drive plasma
  plasmaToneBlend?: number; // 0..1 blend toward tone/note colors
  plasmaNoteDrive?: number; // 0..1 pattern drive from notes
  plasmaContrast?: number; // 0..1 extra contrast
  plasmaScaleX?: number; // 0.5..2
  plasmaScaleY?: number; // 0.5..2
  plasmaGlow?: number; // 0..1
  plasmaWarp?: number; // 0..1
  density?: number; // 0..2 cymatics spacing multiplier
  nodeSharpness?: number; // 0..1 controls node edge steepness
  bandBalance?: number; // -1..1 tilt toward low(−) or high(+)
  harmonicFog?: boolean; // enable high-frequency fog
};

const DEFAULT_FRAGMENT = `
// Write GLSL here. You have access to:
// uniform float u_time, u_amp, u_centroid, u_note;
// uniform float u_low, u_mid, u_high, u_onset; // from audio
// uniform vec2 u_res; // resolution in pixels
// float band(int i); // 0..15 mapped bands from Audio Mapping panel
// Input: vec2 uv (0..1). Set 'col' to your color.
col = vec3(0.2+0.8*u_amp) * vec3(uv.x, uv.y, 1.0);
`;

export const PRESET_SOURCES: Record<string, string> = {
  "Color Test": `
vec2 q = (p-0.5)*2.0;
float r = length(q);
vec3 c = (u_note >= 0.0) ? noteColor(u_note) : vec3(0.0);
float circle = 1.0 - smoothstep(0.45, 0.48, r);
col = c * circle;
`,
  "Music Circle": `
// 12-orb chromatic circle (clock layout).
// Orbs are always present but dim when not sounded; size and brightness scale with amplitude.
float PI = 3.14159265;
float R = 0.36;                 // ring radius
float s = sin(PI/12.0);
float L = 2.0 * R * s;          // chord length between adjacent centers
float minR = L * 0.12;          // minimum radius (dim idle dot)
float maxR = L * 0.36;          // cap radius so neighbors never overlap
float soft = minR * 0.6;        // edge softness scales with size
for (int i=0; i<12; i++){
  int pc = i; // chromatic order
  float theta = (float(i)/12.0) * (2.0*PI);
  vec2 ctr = vec2(0.5) + vec2(cos(theta), sin(theta)) * R;
  // amplitude for this pitch class from top notes
  float ampPC = 0.0;
  for (int k=0; k<4; k++){
    float m = noteAt(k); if (m < 0.0) break;
    int pcNote = int(mod(floor(m+0.5), 12.0)); if (pcNote < 0) pcNote += 12;
    ampPC = max(ampPC, noteAmp(k) * float(pcNote == pc));
  }
  float r = mix(minR, maxR, clamp(ampPC, 0.0, 1.0));
  float d = distance(p, ctr);
  float fill = 1.0 - smoothstep(r, r + soft, d);
  float bright = 0.18 + 0.82 * clamp(ampPC, 0.0, 1.0);
  col += toneColor(pc) * fill * bright;
}
`,
  "Layered Orbitals": `
// Central orb pulses with RMS; ring orbs respond to bands; notes add colored sparks
vec2 C = vec2(0.5);
vec2 d = p - C; float r = length(d);
// Base background
col = vec3(0.01) + vec3(0.02*u_low, 0.02*u_mid, 0.02*u_high);
// Central orb (loudness)
float R0 = 0.12 + 0.25*clamp(u_amp,0.0,1.0);
col += (1.0 - smoothstep(R0, R0+0.02, r)) * vec3(0.6,0.7,0.9);
// Ring of 12 band orbs (map bands 0..11)
for (int i=0;i<12;i++){
  float theta = (float(i)/12.0)*6.28318530718;
  vec2 ctr = C + vec2(cos(theta), sin(theta)) * 0.33;
  float b = band(i);
  float or = 0.035 + 0.15*pow(clamp(b,0.0,1.0), 0.8);
  float g = 1.0 - smoothstep(or, or+0.015, distance(p, ctr));
  vec3 c = vec3(0.2) + vec3(0.3,0.2,0.6)*b + vec3(0.2)*u_high;
  col += c*g;
}
// Notes as colored sparks at their pitch class angles
for (int k=0;k<4;k++){
  float m = noteAt(k); float a = noteAmp(k);
  if (m<0.0) break;
  int pc = int(mod(floor(m+0.5),12.0));
  float th = (float(pc)/12.0)*6.28318530718 + u_time*0.3;
  vec2 ctr = C + vec2(cos(th), sin(th)) * (0.33 + 0.05*sin(u_time*1.3 + float(pc)));
  float or = 0.02 + 0.12*clamp(a,0.0,1.0);
  float g = 1.0 - smoothstep(or, or+0.01, distance(p, ctr));
  col += toneColor(pc) * g * (0.6 + 0.4*u_onset);
}
// Onset flash
col *= 1.0 + 0.25*u_onset;
`,
  "Beat Tunnel": `
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
col += vec3(1.0,0.8,0.6) * ring * 0.4;
// Notes tint
float tint=0.0; int idx=0; for(int i=0;i<4;i++){float m=noteAt(i); if(m<0.0)break; idx = int(mod(floor(m+0.5),12.0)); tint += noteAmp(i);} tint=clamp(tint,0.0,1.0);
col = mix(col, col + toneColor(idx)*0.6, tint*0.6);
`,
  "Polar Bars": `
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
col += vec3(0.8,0.9,1.0)*tip*0.5;
`,
  "Melody Spiral": `
// Spiral arms influenced by notes; bass tightens spiral; highs add speckle
vec2 C=vec2(0.5); vec2 u=p-C; float r=length(u); float a=atan(u.y,u.x);
float k = 3.0 + 6.0*clamp(u_low,0.0,1.0);
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
`,
  "Kaleido Bloom": `
// 6-way kaleidoscope bloom; bass expands, mids rotates, highs bloom; notes add colored blips
vec2 C=vec2(0.5); vec2 q=(p-C)*2.0; float r=length(q);
float rot = u_mid*2.0;
float ang = atan(q.y,q.x)+rot;
ang = mod(ang, 6.28318530718/6.0);
float sym = cos(ang*6.0);
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
`,
  "Mountain Fog Beach": `
// Mountain silhouette with glowing fog and water ripples; audio-reactive but form-preserving.


// Aspect-corrected coordinates centered at horizon
vec2 res = u_res;
vec2 uv = (p - 0.5);
uv.x *= res.x / max(res.y, 1.0);

float t = u_time * (0.6 + 1.4*u_speed) + u_onset*0.15;

// Fractal ridge field for mountains
vec2 q = uv * (1.6 + 0.6*u_detail);
float field = 0.0;
vec2 pq = q;
for (int i=0; i<6; i++){
  pq = r2(1.7) * pq * 1.6 + vec2(0.11, -0.13);
  float rid = abs(sin(pq.x + sin(pq.y) + t*0.4));
  field += rid * pow(0.6, float(i));
}
field /= 1.0 + 0.0;

// Mountain mask (higher field -> mountain), horizon slightly below center
float horizon = -0.05;
float mountain = smoothstep(0.0, 0.18, field - (uv.y - horizon));

// Water ripples below horizon
float water = smoothstep(0.02, 0.0, (uv.y - horizon));
float rip = 0.0;
if (water > 0.0){
  float wv = uv.y - horizon;
  float freq = 34.0 + 26.0*u_mid;
  rip = 0.5 + 0.5*sin(uv.x*freq + t*2.6*(1.0+0.6*u_low));
  rip *= 0.6 + 0.6*u_high;
}

// Note tint from dominant note
float domA = 0.0; int domI = 0;
for (int i=0;i<4;i++){ float m=noteAt(i); float a=noteAmp(i); if (m<0.0) break; if (a>domA){ domA=a; domI=int(mod(floor(m+0.5),12.0)); } }
vec3 noteTint = toneColor(domI);

// Base night color
vec3 base = mix(vec3(0.05,0.06,0.08), noteTint, 0.15 + 0.35*domA);
col = base;

// Fog glow near horizon, driven by loudness and bass
float fog = exp(-abs((uv.y - horizon))*8.0) * (0.35 + 1.2*clamp(u_amp,0.0,1.0));
col += noteTint * fog * (0.6 + 0.8*u_low);

// Water contribution and soft reflection of mountains
float refl = mountain * water * (0.4 + 0.6*u_high) * (0.5 + 0.5*rip);
col += vec3(0.65,0.82,1.0) * refl;
col += vec3(0.7,0.85,1.0) * rip * water * 0.35;

// Darken mountain silhouette (preserve form)
col = mix(col, col * (0.35 + 0.65*(1.0 - mountain)), 0.9);

// Add fine sparkle with highs
float n = fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453);
col += vec3(n*n*n) * clamp(u_high,0.0,1.0) * 0.12;
`,
  "Growing Mountains": `
// Audio-reactive growing mountain ridges; color tinted by dominant note, rhythm by onset & bands.

vec2 res = u_res; vec2 xy = (p - 0.5);
xy.x *= res.x / max(res.y, 1.0);
float t = u_time * (0.5 + 1.2*u_speed) + u_onset*0.12;
float h = 0.45;
mat2 m = r2(0.5 + 0.6*u_mid);

// Dominant note tint
float domA=0.0; int domI=0;
for (int i=0;i<4;i++){ float mn=noteAt(i); float A=noteAmp(i); if(mn<0.0) break; if (A>domA){ domA=A; domI=int(mod(floor(mn+0.5),12.0)); } }
vec3 tint = mix(vec3(0.35,0.6,0.9), toneColor(domI), 0.8);

float g = 0.0; vec3 acc = vec3(0.0);
for (int ii=0; ii<57; ii++){
  float i = float(ii+1);
  vec3 pp = vec3(xy * (g) + h*0.0, g) + h; // base position grows with g
  float s = 4.0; float e = pp.y - g*h*1.3;
  // inner accumulation loop (fixed steps to keep stable on WebGL1)
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
`,
  "Squid": `
// Organic squid-like swimmer; audio drives color and motion


// aspect-corrected coords
vec2 uv = p - 0.5;
uv.x *= u_res.x / max(u_res.y, 1.0);

float t = u_time * (0.6 + 1.2*u_mid);

// dominant note tint
float domA=0.0; int domI=0;
for (int i=0;i<4;i++){ float mn=noteAt(i); float A=noteAmp(i); if(mn<0.0) break; if (A>domA){ domA=A; domI=int(mod(floor(mn+0.5),12.0)); } }
vec3 tint = mix(vec3(0.2,0.4,0.8), toneColor(domI), 0.8);

// background (bass lifts, highs add sparkle later)
col = mix(vec3(0.03,0.04,0.06), tint, 0.08 + 0.25*clamp(u_low,0.0,1.0));

// parametric backbone curve
float body = 0.0;
for (int i=0; i<64; i++){
  float s = float(i)/63.0; // 0..1 head->tail
  float ph = t*0.9 + s*6.0;
  vec2 ctr = vec2(0.18*sin(ph), -0.25 + s*0.95 + 0.06*sin(ph*0.5));
  float rad = 0.08*(1.0 - s)*(0.85 + 0.6*clamp(u_amp,0.0,1.0)) + 0.012;
  float d = distance(uv, ctr);
  float seg = 1.0 - smoothstep(rad, rad + 0.006, d);
  body = max(body, seg);
}

// simple tentacles near tail using perpendicular offsets
for (int j=0; j<6; j++){
  float phase = float(j)*1.0472; // ~PI/3 evenly spaced tentacles
  for (int k=0; k<24; k++){
    if (k > int(floor(mix(8.0, 24.0, u_quality)))) break;
    float s = 0.75 + 0.016*float(k);
    float ph = t*1.15 + s*7.3 + phase;
    vec2 c0 = vec2(0.18*sin(ph*0.75), -0.25 + s*0.95 + 0.06*sin(ph*0.4));
    float eps = 0.005;
    vec2 c1 = vec2(0.18*sin((t*1.15 + (s+eps)*7.3 + phase)*0.75), -0.25 + (s+eps)*0.95 + 0.06*sin((t*1.15 + (s+eps)*7.3 + phase)*0.4));
    vec2 dir = normalize(c1 - c0); vec2 n = vec2(-dir.y, dir.x);
    float wob = (0.02 + 0.06*u_high) * sin(t*2.0 + s*10.0 + phase*1.7) + 0.015*sin(t*1.1 + s*6.0 + phase);
    vec2 ctr = c0 + n * wob;
    float tr = 0.007 + 0.011*u_high;
    float seg = 1.0 - smoothstep(tr, tr+0.004, distance(uv, ctr));
    body = max(body, seg*0.9);
  }
}

// composite color
col += tint * body * (0.6 + 0.6*clamp(u_amp,0.0,1.0));
// highs sparkle
float sp = fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453);
col += vec3(sp*sp*sp) * clamp(u_high,0.0,1.0) * 0.15;
`,
  "Spinning Fractal": `
// Spinning fractal; audio-reactive rotation, scale, color tint, and brightness


// aspect-corrected coords
vec2 uv = p - 0.5; uv.x *= u_res.x / max(u_res.y, 1.0);

// dominant note tint
float domA=0.0; int domI=0; for(int i=0;i<4;i++){ float mn=noteAt(i); float A=noteAmp(i); if(mn<0.0)break; if(A>domA){domA=A; domI=int(mod(floor(mn+0.5),12.0));} }
vec3 noteTint = toneColor(domI);

// background subtle tint with bass
col = mix(vec3(0.02,0.03,0.05), noteTint, 0.08 + 0.22*clamp(domA + u_low*0.6, 0.0, 1.0));

float t = u_time * (0.5 + 1.0*u_speed) + u_onset*0.05;
float rot = t*0.4*(1.0 + 0.8*u_mid);
float scale = 2.0 + 1.2*u_low;

float G = 0.0; vec3 acc = vec3(0.0);
for (int ii=0; ii<64; ii++){
  float gi = float(ii+1);
  vec3 P = vec3(uv*scale + vec2(0.0, 1.45), G - 1.0);
  P.xz *= r2(rot);
  float S = 1.0; float E = 1.0;
  for (int jj=0; jj<20; jj++){
    P = vec3(0.0, 3.94, -0.7) - abs(abs(P)*E - vec3(2.0, 3.96 + E*0.07, 3.7));
    float denom = max(dot(P, P*0.41), 1e-3);
    E = 5.0 / denom; S *= E;
  }
  G += P.y / max(S, 1e-3);
  float shade = log(S) - G*0.1;
  float val = clamp(shade / 900.0, 0.0, 1.0);
  float sat = clamp(P.y * 0.4 + 0.1, 0.0, 1.0);
  vec3 c = mix(vec3(val), noteTint, sat);
  acc += c * (0.006 + 0.004*u_high);
}
col += acc * (0.7 + 0.6*clamp(u_amp,0.0,1.0));
`,
  "Spinning Fractal 2": `
// Variant spinning fractal; audio drives rotation, stability, tint, and brightness

vec2 uv = p - 0.5; uv.x *= u_res.x / max(u_res.y, 1.0);
float t = u_time * (0.5 + 1.0*u_speed) + u_onset*0.04;
float rot = t*0.3*(1.0 + 0.6*u_mid);
float jitter = cos(t*0.6) * 0.1;

// dominant note tint
float domA=0.0; int domI=0; for(int i=0;i<4;i++){ float mn=noteAt(i); float A=noteAmp(i); if(mn<0.0)break; if(A>domA){domA=A; domI=int(mod(floor(mn+0.5),12.0));}}
vec3 noteTint = toneColor(domI);
col = mix(vec3(0.02,0.03,0.05), noteTint, 0.08 + 0.22*clamp(domA + u_low*0.5, 0.0, 1.0));

float G=0.0; vec3 acc=vec3(0.0);
for (int ii=0; ii<72; ii++){
  float gi=float(ii+1);
  vec3 P=vec3(uv*2.0, G - 0.8);
  P.xz *= r2(rot);
  float S=1.0, E=1.01;
  for (int jj=0; jj<13; jj++){
    P = vec3(0.0, 3.5, 3.0) - abs(abs(P)*E - vec3(3.0, 1.8 + 0.2*cos(t*0.6), 3.0));
    float denom = max(dot(P, P + jitter) - 0.1, 1e-3);
    E = max(1.01, 9.5 / denom);
    S *= E;
  }
  float lenY = length(P.yy);
  G += mod(lenY, P.y) / max(S, 1e-3) * 0.5;
  float sat = clamp(P.x*0.6, -1.0, 1.0) * 0.5 + 0.5;
  vec3 c = mix(vec3(0.0), noteTint, sat);
  acc += c * (S/12000.0) * (0.8 + 0.6*u_high);
}
col += acc * (0.7 + 0.6*clamp(u_amp,0.0,1.0));
`,
  "Celestial Tunnel": `
// Celestial tunnel: spinning depth field; audio drives motion, brightness, and tint

vec2 xy = p - 0.5; xy.x *= u_res.x / max(u_res.y, 1.0);
float t2 = u_time * (0.6 + 1.2*u_speed) + u_onset*0.05;
vec3 d = vec3(xy*0.6 + vec2(0.0, 0.6), 1.0);
d.xz *= r2(t2*0.4*(1.0+0.8*u_mid));

// dominant note tint
float dA=0.0; int dI=0; for(int i=0;i<4;i++){ float mn=noteAt(i); float A=noteAmp(i); if(mn<0.0)break; if(A>dA){dA=A; dI=int(mod(floor(mn+0.5),12.0));} }
vec3 tint = toneColor(dI);
col = mix(vec3(0.02,0.03,0.05), tint, 0.08 + 0.25*clamp(u_low + dA*0.6, 0.0, 1.0));

float q = clamp(u_quality, 0.3, 1.0);
float iterLim = mix(22.0, 60.0, q);
float innerLimF = mix(4.0, 12.0, q);
float E=0.0, G=0.0; float RV=1.0; vec3 Q=vec3(0.0); vec3 acc2=vec3(0.0);
for (int ii=0; ii<60; ii++){
  if (float(ii) > iterLim) break;
  float fi=float(ii+1);
  E += fi * 1e-9;
  Q += d * E * RV * mix(0.45, 0.25, q); // march faster at low quality
  vec3 P = Q; float s=3.0;
  G += P.y/s;
  RV = max(length(P), 1e-3);
  P = vec3(log2(RV) + t2*0.2, exp2(mod(-P.z, s)/RV) - 0.3, P.y);
  // inner accumulation
  float e=0.0; float ss=s;
  for (int jj=0; jj<12; jj++){
    if (float(jj) > innerLimF) break;
    e += -abs(dot(sin(P.xz*ss), cos(P.zy*ss)) / max(ss,1e-3) * 0.4);
    ss += ss;
  }
  float shade = e - G*0.1;
  float val = clamp(shade / 200.0, 0.0, 1.0); // visibility boost
  vec3 c = mix(vec3(val), tint, 0.35 + 0.35*clamp(u_amp,0.0,1.0));
  acc2 += c * (0.02 + 0.014*u_high);
}
col += acc2 * (0.75 + 0.6*clamp(u_amp,0.0,1.0));
`,
  "Vortex": `
// Vortex field; audio drives twist, pace, and musical tint


vec2 uv = p - 0.5; uv.x *= u_res.x / max(u_res.y, 1.0);
float t = u_time * (0.7 + 0.8*u_speed) + u_onset*0.07;

// dominant note tint and music tint
float domA=0.0; int domI=0; for(int i=0;i<4;i++){ float mn=noteAt(i); float A=noteAmp(i); if(mn<0.0)break; if(A>domA){domA=A; domI=int(mod(floor(mn+0.5),12.0));} }
vec3 noteTint = toneColor(domI);
vec3 musicTint = vec3(u_low, u_mid, u_high);

// init pseudo-random z from uv
float z = fract(sin(dot(uv, vec2(12.9898,78.233))) * 43758.5453);
vec3 acc = vec3(0.0);
float qv = clamp(u_quality, 0.3, 1.0);
float iterLimV = mix(25.0, 100.0, qv);
float innerLimV = mix(2.0, 9.0, qv);
for (int ii=0; ii<100; ii++){
  if (float(ii) > iterLimV) break;
  // ray dir based on z and uv; push forward in z
  vec3 dir = normalize(vec3(uv*2.0, 1.0));
  vec3 p3 = z * dir; p3.z += 6.0;
  // swirl via mids
  p3.xz *= r2(t*0.4*(1.0+0.8*u_mid));
  // inner path accumulation
  float d = 1.0; vec3 q = p3;
  for (int jj=0; jj<9; jj++){
    if (float(jj) > innerLimV) break;
    q += cos(q.yzx * d - t) / d;
    d /= 0.8;
  }
  float stepLen = (0.002 + abs(length(q) - 0.5) / 40.0) * mix(1.8, 1.0, qv);
  z += stepLen * (0.8 + 0.6*u_low);
  vec3 c = (sin(vec3(z - t + vec3(6.0,2.0,4.0))) + 1.5) / max(stepLen, 1e-3);
  acc += c * (0.7 + 0.7*u_high);
}
// compress and tint
vec3 outc = acc / (vec3(1.0) + abs(acc));
vec3 tint = mix(noteTint, musicTint, 0.35 + 0.35*clamp(domA,0.0,1.0));
col = mix(outc*0.6, outc, 0.5) * (0.6 + 0.6*clamp(u_amp,0.0,1.0));
col = mix(col, col * tint, 0.6);
`,
  "Nebulae": `
// Nebulae: layered cosmic tunnel; audio drives pace, detail, and musical tint
vec2 uv = p - 0.5; uv.x *= u_res.x / max(u_res.y, 1.0);
float tt = u_time * (0.6 + 1.2*u_speed) + u_onset*0.05;

// dominant note tint
float domA=0.0; int domI=0; for(int i=0;i<4;i++){ float mn=noteAt(i); float A=noteAmp(i); if(mn<0.0)break; if(A>domA){domA=A; domI=int(mod(floor(mn+0.5),12.0));} }
vec3 noteTint = toneColor(domI);

float z=0.0; vec3 acc=vec3(0.0);
for (int ii=0; ii<100; ii++){
  vec3 p = z * normalize(vec3(uv*2.0, 1.0));
  p.z += 9.0;
  vec3 v = p;
  float d = 1.0;
  for (int jj=0; jj<9; jj++){
    p += 0.5 * sin(p.yzx * d + tt) / d;
    d += d;
  }
  float dlen = 6.0 - length(v);
  float s = cos(dlen + tt) + 0.4 * dot(cos(p), sin(p/0.7).yzx);
  float stepD = 0.2 * (abs(s) - min(dlen, -dlen*0.1));
  z += stepD * (0.8 + 0.6*u_low);
  vec3 c = (cos(vec3(s*10.0 + z + vec3(0.0,2.0,9.0))) + 1.3) / max(stepD, 1e-3);
  acc += c * (0.9 + 0.6*u_high);
}
vec3 outc = acc / (vec3(1.0) + abs(acc));
col = mix(outc, outc * noteTint, 0.35 + 0.35*clamp(domA,0.0,1.0));
col *= (0.6 + 0.6*clamp(u_amp,0.0,1.0));
`,
  "Gridbreak": `
// Gridbreak: cosine lattice broken by phase; audio-driven pace and tint
vec2 uv = p - 0.5; uv.x *= u_res.x / max(u_res.y, 1.0);
float tt = u_time * (0.6 + 1.2*u_speed) + u_onset*0.05;

// dominant note tint
float domA=0.0; int domI=0; for(int i=0;i<4;i++){ float mn=noteAt(i); float A=noteAmp(i); if(mn<0.0)break; if(A>domA){domA=A; domI=int(mod(floor(mn+0.5),12.0));} }
vec3 tint = toneColor(domI);

float z = 0.0; vec3 acc = vec3(0.0);
vec3 dirBase = normalize(vec3(uv*2.0, 1.0));
for (int ii=0; ii<50; ii++){
  vec3 p3 = z * dirBase; p3.z -= tt;
  vec3 v = cos(p3) - sin(p3).yzx;
  vec3 w = max(v, v.yzx*0.2);
  float d = 0.5 * length(w);
  z += d * (0.8 + 0.6*u_low);
  vec3 c = (cos(p3) + 1.2) / max(d, 1e-3);
  acc += c * (0.8 + 0.6*u_high);
}
vec3 outc = acc / (acc + vec3(1000.0));
col = mix(outc, outc * tint, 0.35 + 0.35*clamp(domA,0.0,1.0));
col *= (0.6 + 0.6*clamp(u_amp,0.0,1.0));
`,
  "Astral Travel": `
// Astral Travel: iterative astral tunnel; audio drives pace, rotation, and tint

vec2 uv = p - 0.5; uv.x *= u_res.x / max(u_res.y, 1.0);
float tt = u_time * (0.6 + 1.2*u_speed) + u_onset*0.05;

// Dominant note tint
float domA=0.0; int domI=0;
for (int i=0;i<4;i++){ float mn=noteAt(i); float A=noteAmp(i); if(mn<0.0) break; if(A>domA){ domA=A; domI=int(mod(floor(mn+0.5),12.0)); } }
vec3 tint = toneColor(domI);

vec3 q = vec3(uv*0.8, 0.1);
q.zx -= 1.0;
vec3 d = vec3(uv, 0.1);
float R=1.0;
vec3 acc = vec3(0.0);
float ql = clamp(u_quality, 0.3, 1.0);
float iterLimAT = mix(30.0, 99.0, ql);
float innerLimAT = mix(3.0, 9.0, ql);
for (int ii=0; ii<99; ii++){
  if (float(ii) > iterLimAT) break;
  float s = 2.0;
  // advance along direction with audio-coupled pace (bigger steps at low quality)
  q += d * max(1e-4, R) * (0.7 * (0.8 + 0.6*u_low)) * mix(1.25, 1.0, ql);
  vec3 p3 = q;
  R = length(p3);
  // remap into feature space
  vec3 pp = vec3(
    log2(max(R,1e-3)) - tt*0.5*(1.0+0.6*u_mid),
    exp2(0.9 - p3.z/max(R,1e-3)),
    atan(p3.y, p3.x) + cos(tt*0.5)*(0.1 + 0.08*u_low)
  );
  float eLoc = pp.y - 1.0;
  // inner accumulation (bounded doublings)
  float ss = s;
  for (int jj=0; jj<9; jj++){
    if (float(jj) > innerLimAT) break;
    vec3 a = cos(pp.yzy*ss) - 0.5;
    vec3 b = vec3(1.0) - cos(pp*ss);
    eLoc += dot(a, b) / max(ss,1e-3) * 0.3;
    ss += ss;
  }
  float val = clamp(min(eLoc*ss, 0.4 - eLoc) / 12.0, 0.0, 1.0);
  vec3 c = mix(vec3(val), tint, 0.35 + 0.35*clamp(domA,0.0,1.0));
  acc += c * (0.7 + 0.6*u_high);
}
vec3 outc = acc / (vec3(1.0) + abs(acc));
col = outc * (0.6 + 0.6*clamp(u_amp,0.0,1.0));
`,
  "Spinning Fractal 3": `
// Spinning Fractal 3: audio-reactive rotation, depth and note tint

vec2 uv = p - 0.5; uv.x *= u_res.x / max(u_res.y, 1.0);

// dominant note tint
float domA=0.0; int domI=0; for(int i=0;i<4;i++){ float mn=noteAt(i); float A=noteAmp(i); if(mn<0.0)break; if(A>domA){domA=A; domI=int(mod(floor(mn+0.5),12.0));} }
vec3 noteTint = toneColor(domI);

// background tint by bass
col = mix(vec3(0.02,0.03,0.05), noteTint, 0.08 + 0.22*clamp(u_low + domA*0.5, 0.0, 1.0));

float t = u_time * (0.5 + 1.0*u_speed) + u_onset*0.05;
float rot = t*0.4*(1.0 + 0.8*u_mid);

float G=0.0; vec3 acc=vec3(0.0);
for (int ii=0; ii<72; ii++){
  vec3 P = vec3(uv + vec2(0.0, 1.0), G - 1.0);
  P.zx *= r2(rot);
  float S = 1.3; float E = 1.0;
  for (int jj=0; jj<20; jj++){
    P = vec3(0.0, 3.95, -0.7) - abs(abs(P)*E - vec3(2.7, 3.95 + E*0.104, 3.82));
    float denom = max(dot(P, P*0.5), 1e-3);
    E = 5.0 / denom; S *= E;
  }
  G += P.y / max(S, 1e-3);
  float shade = log(S) - G*0.5;
  float val = clamp(shade / 900.0, 0.0, 1.0);
  float sat = clamp(P.y - 0.4, 0.0, 1.0);
  vec3 c = mix(vec3(val), noteTint, sat);
  acc += c * (0.006 + 0.004*u_high);
}
col += acc * (0.7 + 0.6*clamp(u_amp,0.0,1.0));
`,
  "Black Hole": `
// Black Hole: fog spiraling into a singularity; audio drives swirl, flow, and tint


vec2 uv = p - 0.5; uv.x *= u_res.x / max(u_res.y, 1.0);
float t = u_time * (0.6 + 1.2*u_speed) + u_onset*0.05;

// dominant note tint & band tint
float domA=0.0; int domI=0; for(int i=0;i<4;i++){ float mn=noteAt(i); float A=noteAmp(i); if(mn<0.0)break; if(A>domA){domA=A; domI=int(mod(floor(mn+0.5),12.0));} }
vec3 noteTint = toneColor(domI);
vec3 bandTint = vec3(u_low, u_mid, u_high);
vec3 tint = mix(noteTint, bandTint, 0.35 + 0.35*clamp(domA,0.0,1.0));

// Base coordinate per original idea
vec2 d = vec2(-1.0, 1.0);
vec2 pp = uv / 0.7; // slightly zoomed like original
vec2 t5 = 5.0*pp - d;
float den = max(0.1 + 5.0/dot(t5, t5), 1e-3);
mat2 M = mat2(1.0, 1.0, d.x*den, d.y*den);
vec2 c = (pp * M);
vec2 v = c;

// Swirl rotation depends on mids
float ang = log(max(length(v), 1e-3)) + t*0.2*(1.0+0.8*u_mid);
v *= r2(ang) * 5.0;

vec3 acc = vec3(0.0);
float qb = clamp(u_quality, 0.3, 1.0);
float maxIB = floor(mix(4.0, 9.0, qb));
for (int i=0; i<9; i++){
  if (float(i) > maxIB) break;
  v += 0.7 * sin(vec2(v.y, v.x) * float(i+1) + t) / float(i+1) + 0.5;
  vec4 samp = sin(vec4(v.x, v.y, v.y, v.x)) + 1.0;
  acc += samp.rgb * (0.7 + 0.5*u_high);
}

// Fog density and black hole falloff
float r = length(uv);
float hole = 1.0 / (0.03 + abs(r - 0.7));
float flare = exp(0.3*c.y - dot(c,c));
vec3 outc = 1.0 - exp(-exp(c.x*vec3(0.6,-0.4,-1.0)) / (acc + vec3(1e-3)) / (0.1 + 0.1*pow(length(sin(v/0.3)*0.2 + c*vec2(1.0,2.0)) - 1.0, 2.0)) / (1.0 + 7.0*flare)) * 0.2;
// accretion disk/ring around the singularity (coherent ring)
float r0 = 0.55;
float w = 0.08 + 0.06*(1.0 - qb);
float ring = exp(-pow((r - r0)/w, 2.0));
vec3 diskCol = mix(vec3(1.0), tint, 0.5);
outc += diskCol * ring * (0.25 + 0.35*clamp(u_low + u_mid, 0.0, 1.0));

// Apply tint and loudness
col = mix(outc*0.6, outc, 0.6) * (0.8 + 0.8*clamp(u_amp,0.0,1.0));
col = mix(col, col * tint, 0.6);
`,
  "Hyperspace": `
// Hyperspace: modular corridor with quantized rotations; audio drives pace, swirl, and tint

vec2 uv = p - 0.5; uv.x *= u_res.x / max(u_res.y, 1.0);
float T = u_time * (0.6 + 1.2*u_speed) + u_onset*0.05;

// dominant note tint and bands tint
float domA=0.0; int domI=0; for(int ii=0; ii<4; ii++){ float mn=noteAt(ii); float A=noteAmp(ii); if(mn<0.0) break; if(A>domA){ domA=A; domI=int(mod(floor(mn+0.5),12.0)); } }
vec3 noteTint = toneColor(domI);
vec3 bandTint = vec3(u_low, u_mid, u_high);
vec3 tint = mix(noteTint, bandTint, 0.35 + 0.35*clamp(domA,0.0,1.0));

vec3 rd = normalize(vec3(uv*1.2, 1.0));
float t = 0.0; vec3 acc = vec3(0.0);
float qh = clamp(u_quality, 0.3, 1.0);
float iterLimH = mix(24.0, 60.0, qh);
for (int i=0; i<60; i++){
  if (float(i) > iterLimH) break;
  vec3 p3 = t*0.5*rd; p3.z -= T; // forward march
  // wrap into modular tiles
  vec2 zx = p3.zx; zx = mod(zx + 9.0, 18.0) - 9.0; p3.zx = zx;
  // quantized rotation around y
  float ang = atan(p3.z, p3.x);
  float angQ = round(ang*7.0)/7.0; // ~7 sectors
  float ca = cos(angQ), sa = sin(angQ);
  p3.zx = mat2(ca,-sa,sa,ca) * p3.zx;
  vec3 R = abs(p3);
  p3.x -= pow(R.y*0.5, 2.5) + sin(p3.y*4.0 + T*8.0) * sin(T) * 0.4; // corridor shape
  p3.y = mod(p3.y + T, 0.2) - 0.1; // slicing
  float d = abs(length(p3) - 0.1) + 0.01;
  t += d * ((0.85 + 0.6*u_low) * mix(1.6, 1.0, qh));
  vec3 add = (1.0 + cos(R.y + 4.0 + vec3(0.0,1.0,2.0))) * (0.05 / (d + 1.0));
  acc += add * (0.8 + 0.6*u_high);
}
// tone + loudness finishing
vec3 outc = acc / (vec3(1.0) + abs(acc));
col = mix(outc, outc * tint, 0.35 + 0.35*clamp(domA,0.0,1.0));
col *= (0.6 + 0.6*clamp(u_amp,0.0,1.0));
`,
  "Infinite Clouds": `
// Infinite Clouds: drifting layered clouds; audio drives pace, rotation, brightness, and note tint

vec2 uv = p - 0.5; uv.x *= u_res.x / max(u_res.y, 1.0);
float tt = u_time * (0.6 + 1.2*u_speed) + u_onset*0.05;

// Dominant note tint
float domA=0.0; int domI=0;
for (int ii=0; ii<4; ii++){ float mn=noteAt(ii); float A=noteAmp(ii); if(mn<0.0) break; if (A>domA){ domA=A; domI=int(mod(floor(mn+0.5),12.0)); } }
vec3 tint = toneColor(domI);

vec3 q = vec3(uv - vec2(0.2, 0.0), 0.4);
q.yz -= 1.0;
vec3 dir = vec3(uv, 0.4);
float R = 1.0;
vec3 acc = vec3(0.0);
float qi = clamp(u_quality, 0.3, 1.0);
float iterLimIC = mix(30.0, 99.0, qi);
float innerLimIC = mix(3.0, 10.0, qi);
for (int ii=0; ii<99; ii++){
  if (float(ii) > iterLimIC) break;
  float s = 1.0;
  // advance with bass-coupled pace (larger step at lower quality)
  q += dir * max(R, 1e-4) * 0.3 * (0.8 + 0.6*u_low) * mix(1.25, 1.0, qi);
  vec3 p3 = q;
  R = length(p3);
  // feature remap with mid-driven rotation/time
  vec3 pp = vec3(
    log2(max(R,1e-3)) - tt*0.6*(1.0+0.6*u_mid),
    exp(-p3.z/max(R,1e-3) + 0.5),
    atan(p3.x, p3.y) - tt*0.3
  );
  float eVal = pp.y - 1.0;
  float ss = s;
  for (int jj=0; jj<10; jj++){
    if (float(jj) > innerLimIC) break;
    vec3 a = cos(pp.zxy*ss);
    vec3 b = (vec3(0.2) - sin(tt*0.3 - pp*ss));
    eVal += -abs(dot(a, b)) / max(ss,1e-3) * 0.24;
    ss += ss;
  }
  // color value from original min(e*s*e/.01, .4-e)/9 term
  float val = clamp(min(eVal*ss*eVal/0.01, 0.4 - eVal) / 6.0, 0.0, 1.0);
  vec3 c = mix(vec3(val), tint, 0.35 + 0.35*clamp(domA,0.0,1.0));
  acc += c * (0.7 + 0.6*u_high);
}
vec3 outc = acc / (vec3(1.0) + abs(acc));
col = outc * (0.6 + 0.6*clamp(u_amp,0.0,1.0));
`,
  "Space-Time Fabric": `
// Space-Time Fabric: wavy triangular mesh; audio drives warp, line brightness, and tint

vec2 uv = p; // base uv 0..1
float t = u_time * (0.6 + 1.2*u_speed);
float dy = uv.y - 0.5;
// displacement field (influenced by bass and mids)
float d = 0.12*fbm(uv*vec2(6.0,3.0) + vec2(0.0, -t*3.0*(1.0+0.4*u_mid)))
        + 0.12*fbm(uv*vec2(2.0,5.0) + vec2(t*(1.0+0.5*u_low), 0.0))
        + dy * 0.15;
vec2 w = uv; w.y += d; // warp fabric vertically

// Triangular mesh from three stripe families
float freq = 18.0;
float thick = mix(0.018, 0.008, clamp(u_amp,0.0,1.0));
float l1 = smoothstep(thick, 0.0, abs(fract(w.x*freq) - 0.5));
vec2 w2 = (r2(3.14159265/3.0) * (w-0.5)) + 0.5;
float l2 = smoothstep(thick, 0.0, abs(fract(w2.x*freq) - 0.5));
vec2 w3 = (r2(-3.14159265/3.0) * (w-0.5)) + 0.5;
float l3 = smoothstep(thick, 0.0, abs(fract(w3.x*freq) - 0.5));
float lines = clamp(l1 + l2 + l3, 0.0, 1.0);

// dominant note tint
float domA=0.0; int domI=0; for(int i=0;i<4;i++){ float mn=noteAt(i); float A=noteAmp(i); if(mn<0.0)break; if(A>domA){domA=A; domI=int(mod(floor(mn+0.5),12.0));} }
vec3 tint = toneColor(domI);

// line brightness driven by highs; background subtle by bass
vec3 bg = mix(vec3(0.02,0.03,0.05), tint, 0.08 + 0.2*clamp(u_low,0.0,1.0));
vec3 lineCol = mix(vec3(0.8,0.9,1.0), tint, 0.6) * (0.5 + 0.6*u_high);
col = bg + lineCol * lines;
// RMS lifts
col *= (0.7 + 0.6*clamp(u_amp,0.0,1.0));
`,
  "Flying Over Mountains": `
// Flying Over Mountains: layered ridges from log/exp/atan remap; audio drives pace, rotation, brightness, and tint

vec2 uv = p - 0.5; uv.x *= u_res.x / max(u_res.y, 1.0);
float tt = u_time * (0.6 + 1.2*u_speed) + u_onset*0.05;

// Dominant note tint
float domA=0.0; int domI=0; for (int ii=0; ii<4; ii++){ float mn=noteAt(ii); float A=noteAmp(ii); if(mn<0.0) break; if (A>domA){ domA=A; domI=int(mod(floor(mn+0.5),12.0)); } }
vec3 tint = toneColor(domI);

vec3 q = vec3(uv + vec2(-0.5, 0.4), 1.0);
q.yz -= 1.0;
vec3 d = vec3(uv + vec2(-0.5, 0.4), 1.0);
float R = 1.0;
vec3 acc = vec3(0.0);
for (int ii=0; ii<99; ii++){
  float s = 1.0;
  // march forward with bass-coupled pace
  q += d * max(R, 1e-4) * 0.3 * (0.85 + 0.6*u_low);
  vec3 p3 = q;
  R = length(p3);
  // feature remap (time and mid influence rotation)
  vec3 pp = vec3(
    log2(max(R,1e-3)) - tt*0.5,
    exp2(-p3.z/max(R,1e-3) - 0.01),
    atan(p3.y, p3.x) * s + cos(tt) * (0.03 + 0.02*u_mid)
  );
  float eLoc = pp.y - 1.0;
  float ss = s;
  for (int jj=0; jj<10; jj++){
    vec3 A = sin(vec3(pp.z, pp.z, pp.y) * ss) - vec3(0.53);
    vec3 B = vec3(0.5) - sin(vec3(pp.y, pp.z, pp.x) * ss);
    eLoc += dot(A, B) / max(ss,1e-3) * 0.2;
    ss += ss;
  }
  float val = clamp((eLoc * R) / 12.0, 0.0, 1.0);
  vec3 c = mix(vec3(val), tint, 0.35 + 0.35*clamp(domA,0.0,1.0));
  acc += c * (0.7 + 0.6*u_high);
}
vec3 outc = acc / (vec3(1.0) + abs(acc));
col = outc * (0.6 + 0.6*clamp(u_amp,0.0,1.0));
`,
  "Strange Entities": `
// Strange Entities: swarm of noise-driven points; audio drives flow, size, and tint
mat2 r2(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
float hash12(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise2(vec2 p){ vec2 i=floor(p), f=fract(p); float a=hash12(i), b=hash12(i+vec2(1,0)); float c=hash12(i+vec2(0,1)), d=hash12(i+vec2(1,1)); vec2 u=f*f*(3.0-2.0*f); return mix(mix(a,b,u.x), mix(c,d,u.x), u.y); }

vec2 uv = p - 0.5; uv.x *= u_res.x / max(u_res.y, 1.0);
float tt = u_time * (0.5 + 1.0*u_speed);

// dominant note tint
float domA=0.0; int domI=0; for(int ii=0; ii<4; ii++){ float mn=noteAt(ii); float A=noteAmp(ii); if(mn<0.0) break; if(A>domA){ domA=A; domI=int(mod(floor(mn+0.5),12.0)); } }
vec3 tint = toneColor(domI);

// background lift by bass
col = mix(vec3(0.02,0.03,0.05), tint, 0.08 + 0.25*clamp(u_low,0.0,1.0));

float aspect = u_res.x / max(u_res.y, 1.0);
for (int i=0; i<140; i++){
  float s = float(i) + 1.0;
  vec2 h = vec2(hash12(vec2(s, s*1.37)), hash12(vec2(s*2.13, s*0.91)));
  vec2 pos0 = (h - 0.5) * vec2(1.6*aspect, 1.6);
  float sp = 0.35 + 0.9*u_mid + 0.3*u_low;
  float ang = 6.2831853 * noise2(pos0*3.0 + vec2(tt*0.4*sp, -tt*0.2*sp));
  vec2 flow = vec2(cos(ang), sin(ang));
  vec2 pos = pos0 + flow * (0.18*sin(tt*0.7 + s) + 0.22*cos(tt*0.35 + s*1.7));
  float r = mix(0.0025, 0.012, clamp(u_amp, 0.0, 1.0));
  float d = distance(uv, pos);
  float alpha = smoothstep(r, 0.0, d);
  vec3 ptCol = mix(vec3(0.85,0.9,1.0), tint, 0.6) * (0.35 + 0.65*clamp(u_high,0.0,1.0));
  col += ptCol * alpha * 0.6;
}
`,
  "Vibrant Tunnel": `
// Vibrant tunnel inspired by @kishimisu; audio-reactive tint and motion using toneColor mapping

vec2 V = u_res, i = (p*2.0 - 1.0);
i.x *= V.x / max(V.y, 1.0);
float b = u_time * 0.8;
float r = sin(b*0.5)*0.2 + 0.7;
float a = 0.0, n = 0.0, t = 0.0;

// dominant note tint blended with bands
float domA=0.0; int domI=0; for(int k=0;k<4;k++){ float mn=noteAt(k); float A=noteAmp(k); if(mn<0.0)break; if(A>domA){domA=A; domI=int(mod(floor(mn+0.5),12.0));} }
vec3 noteTint = toneColor(domI);
vec3 bandTint = vec3(u_low, u_mid, u_high);
vec3 tint = mix(noteTint, bandTint, 0.35 + 0.35*clamp(domA,0.0,1.0));

vec3 Oacc = vec3(0.0);
for (a=0.0; a<60.0; a+=1.0){
  vec4 add = vec4(0.0);
  vec3 p3 = t * normalize(vec3((Rm(b/4.0) * i), 1.0));
  p3.xz *= Rm(t*0.03 * (1.0 + 0.8*u_mid));
  p3.z += b;
  vec3 q = p3;
  p3.xy *= Rm(floor(p3.z/0.07)*0.2 + b*0.5);
  p3.x = abs(p3.x) - 0.5;
  p3.z = mod(p3.z, 0.07) - 0.035;
  float nloc = length(p3) - 0.02;
  float t2 = abs(length(vec2(length(mod(q.xy+r,r+r)-r)-0.5, p3.z)) - 0.02) + 0.003;
  float stepv = min(nloc, t2);
  t += stepv * (0.85 + 0.6*u_low);
  add = 0.06 * (1.0 + cos(t*0.7 + b + length(i) + vec4(0.0,1.0,2.0,0.0))) * (0.53 + sin(t+t + b*4.0)*0.5) / (0.2 + max(n,1e-3)/0.1);
  vec3 add3 = add.rgb * (0.7 + 0.6*u_high);
  Oacc += add3;
}
vec3 Oc = tanh(Oacc);
col = mix(Oc, Oc * tint, 0.5) * (0.6 + 0.6*clamp(u_amp,0.0,1.0));
`,
  "Fractal Pyramid": `
// Fractal Pyramid: ray-marched rotating pyramid fractal; audio drives color palette and motion
mat2 r2(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

vec3 palette(float d, vec3 tc){
  // blend between cool and tint color
  return mix(vec3(0.2,0.7,0.9), tc, clamp(d,0.0,1.0));
}

float mapF(vec3 p, float t){
  for (int i=0; i<8; ++i){
    p.xz = (r2(t) * p.xz);
    p.xy = (r2(t*1.89) * p.xy);
    p.xz = abs(p.xz);
    p.xz -= 0.5;
  }
  return dot(sign(p), p) / 5.0;
}

vec4 rmPyr(vec3 ro, vec3 rd, float t, vec3 tc){
  float tt = 0.0; vec3 col = vec3(0.0); float d=1.0;
  for (int i=0; i<64; i++){
    vec3 p = ro + rd * tt;
    d = mapF(p, t) * 0.5;
    if (d < 0.02) break;
    if (d > 100.0) break;
    col += palette(length(p)*0.1, tc) / (400.0 * max(d, 1e-3));
    tt += d;
  }
  return vec4(col, 1.0/(d*100.0));
}

vec2 uv = (p - 0.5);
uv.x *= u_res.x / max(u_res.y, 1.0);
vec3 ro = vec3(0.0, 0.0, -50.0);
float t = u_time * (0.7 + 1.0*u_speed);
ro.xz = (r2(t) * ro.xz);
vec3 cf = normalize(-ro);
vec3 cs = normalize(cross(cf, vec3(0.0,1.0,0.0)));
vec3 cu = normalize(cross(cf, cs));
vec3 uuv = ro + cf*3.0 + uv.x*cs + uv.y*cu;
vec3 rd = normalize(uuv - ro);

// dominant note tint blended with band tint
float domA=0.0; int domI=0; for(int k=0;k<4;k++){ float mn=noteAt(k); float A=noteAmp(k); if(mn<0.0)break; if(A>domA){domA=A; domI=int(mod(floor(mn+0.5),12.0));} }
vec3 noteTint = toneColor(domI);
vec3 bandTint = vec3(u_low, u_mid, u_high);
vec3 tint = mix(noteTint, bandTint, 0.35 + 0.35*clamp(domA,0.0,1.0));

vec4 col4 = rmPyr(ro, rd, t*(1.0 + 0.7*u_mid), tint);
vec3 col3 = col4.rgb * (0.6 + 0.6*clamp(u_amp,0.0,1.0));
col = col3;
`,
  Plasma: `
float t = u_time * (0.12 + 1.2*u_speed);
vec2 c = p - 0.5;
// radial focus (event horizon) and swirl
float focus = mix(0.2, 1.2, u_plasmaFocus);
float ang = u_plasmaSwirl * (0.6 + 0.6*u_mid);
float ca = cos(ang), sa = sin(ang);
vec2 q = (mat2(ca,-sa,sa,ca) * (c*2.0));
q.x *= max(0.5, u_plasmaScaleX);
q.y *= max(0.5, u_plasmaScaleY);
// subtle growth with notes and onsets (does not alter core pattern)
float notesSum = 0.0; for (int i=0;i<4;i++){ float mn = noteAt(i); if (mn<0.0) break; notesSum += noteAmp(i); }
notesSum = clamp(notesSum, 0.0, 1.0);
// music-driven breathing: notes + onset + rms
float grow = 1.0 - 0.06*notesSum - 0.04*u_onset - 0.05*clamp(u_amp, 0.0, 1.0);
q /= max(0.2, u_zoom*focus*grow);
// audio-driven weighting
float wLow = u_plasmaBandLow * u_low;
float wMid = u_plasmaBandMid * u_mid;
float wHigh = u_plasmaBandHigh * u_high;
// note-driven warp
float noteW = 0.0; for (int i=0;i<4;i++){ float mn = noteAt(i); if (mn<0.0) break; float a = noteAmp(i); noteW += a; }
noteW = clamp(noteW, 0.0, 1.0) * u_plasmaNoteDrive;
q += vec2( sin(t*0.7+q.y*2.0), cos(t*0.6+q.x*2.0) ) * (0.05 + 0.1*noteW*u_plasmaWarp);
float v = 0.0;
v += sin((q.x+t*(0.8+0.6*wLow))*3.0 + wLow*8.0);
v += sin((q.y+t*(1.0+0.6*wMid))*4.0 + wMid*7.0);
v += sin((q.x+q.y+t*(0.6+0.6*wHigh))*2.2 + wHigh*9.0);
// base palette and tone blend
vec3 base = 0.5 + 0.5*cos(6.2831*(vec3(0.2,0.4,0.8)*v + t*0.1 + u_hueShift));
vec3 musicTint = vec3(u_low, u_mid, u_high);
vec3 toneMix = mix(base, musicTint, clamp(u_plasmaToneBlend,0.0,1.0));
// vignette toward center for focal feel
float r = length(c);
float vign = smoothstep(1.0, 0.2, r*focus);
vec3 col0 = mix(toneMix*(0.7+0.6*u_intensity), toneMix*1.2, vign);
// subtle global surge with notes and rms
col0 *= (1.0 + 0.08*notesSum + 0.06*clamp(u_amp,0.0,1.0));
// per-note glow that brightens/dims colors by note amplitude
vec3 noteAcc = vec3(0.0);
for (int i=0;i<4;i++){
  float mn = noteAt(i); if (mn < 0.0) break; float a = noteAmp(i);
  float gate = step(u_noteThreshold, a);
  vec3 nc = noteColor(mn);
  // spatial mask: follow plasma field and central focus
  float mask = 0.5 + 0.5*cos(v*3.0 + float(i) + t*1.3);
  float center = 1.0 - vign;
  float glow = (0.2 + 0.8*mask) * a * gate * (0.4 + 0.6*center);
  noteAcc += nc * glow;
}
// contrast and glow
col0 = mix(col0, col0*1.5, clamp(u_plasmaContrast,0.0,1.0));
// amplify note glow by user glow and notes amount
noteAcc *= (0.7 + 0.6*u_plasmaGlow + 0.2*notesSum);
col = clamp(col0 + noteAcc * (0.4 + 0.6*u_plasmaGlow), 0.0, 1.0);
`,
  MultiNoteScribbles: `
vec2 q = (p-0.5)*2.0; float t = u_time * (0.01 + 0.30*u_speed); vec3 acc = vec3(0.0);
for (int i=0;i<4;i++){
  float m = noteAt(i); if (m < 0.0) break; float a = noteAmp(i);
  vec3 nc = noteColor(m);
  float ampScale = mix(1.0, a, u_noteAmpInfluence);
  // slow, meandering control points for scribbles
  vec2 c = vec2(sin(t*(0.15+u_speed*0.15)+float(i)), cos(t*(0.12+u_speed*0.12)+float(i)*1.3))*0.55;
  // lower line frequency for calmer scribbles; detail adds complexity
  float freq = (4.0 + u_detail*6.0);
  float d = abs(sin(freq*dot(normalize(c+0.001), q-c)));
  // gate by note threshold and soften stroke
  float gate = step(u_noteThreshold, a);
  float s = smoothstep(0.35, 0.0, d) * ampScale * gate;
  acc += nc * s * (0.6 + 0.5*u_intensity);
}
col = clamp(acc, 0.0, 1.0);
`,

  /* Removed: CymaticsRadialModes */
  /*CymaticsRadialModes: `
vec2 q = (p-0.5)*2.0; float t = u_time * (0.05 + 0.8*u_speed);
float r = length(q); float a = atan(q.y,q.x);
// Responsive mode counts from audio groups
float kr = mix(6.0, 30.0 + 30.0*u_detail, clamp(u_low, 0.0, 1.0)) * max(0.2, u_density);
float ka = (3.0 + floor((4.0 + 8.0*u_detail) * clamp(u_mid, 0.0, 1.0))) * max(0.2, u_density);
// Smooth ring and spoke fields
float rings = 0.5 + 0.5*cos(r*kr - t*(1.2+u_speed));
float spokes = 0.5 + 0.5*cos(a*ka);
float field = rings * spokes;
float nodes = smoothstep(0.5+0.1*u_nodeSharpness, 0.9+0.05*u_nodeSharpness, field);
// Base hue from band groups
vec3 base = vec3(u_low, u_mid, u_high) * (0.2 + 0.8*nodes);
// Multi-note color cells
vec3 notesAcc = vec3(0.0);
for (int i=0;i<4;i++){
  float mn = noteAt(i); if (mn < 0.0) break; float amp = noteAmp(i);
  vec3 nc = noteColor(mn);
  float ampScale = mix(1.0, amp, u_noteAmpInfluence);
  float cell = 0.5 + 0.5*cos(r*( (8.0 + u_detail*10.0)*u_density + float(i)*1.7) + a*(float(i)+2.0) - t*(0.8+u_speed));
  cell = smoothstep(0.6, 0.95, cell);
  notesAcc += nc * (cell * ampScale * 0.7);
}
vec3 colMix = mix(base, base + notesAcc, 0.8);
vec3 fog = vec3(u_high)*smoothstep(0.2,0.8,(band(12)+band(13)+band(14)+band(15))*0.25)*0.12*u_harmonicFog;
col = clamp(colMix + fog, 0.0, 1.0);
`,*/
  CymaticsNoteModes: `
vec2 q = (p-0.5)*2.0; float t = u_time; vec3 acc = vec3(0.0);
for (int i=0;i<4;i++){
  float mn = noteAt(i); if (mn < 0.0) break; float amp = noteAmp(i);
  vec3 nc = noteColor(mn);
  float k = 6.0 + float(i)*2.0 + band(i*3)*6.0;
  float v = abs(sin(q.x*3.1415*k + t*0.6) * sin(q.y*3.1415*(k*0.7) - t*0.5));
  float nodes = smoothstep(0.7+0.2*u_nodeSharpness, 0.9+0.05*u_nodeSharpness, pow(v, mix(2.0, 4.0, u_nodeSharpness)));
  acc += nc * nodes * (0.3 + 0.7*amp);
}
acc += vec3(u_low, u_mid, u_high) * 0.1;
vec3 fogNM = vec3(u_high)*smoothstep(0.2,0.8,(band(12)+band(13)+band(14)+band(15))*0.25)*0.1*u_harmonicFog;
col = clamp(acc + fogNM, 0.0, 1.0);
`,
  /* Removed: CymaticsHarmonicGrid */
  /*CymaticsHarmonicGrid: `
vec2 q = (p-0.5)*2.0; float t = u_time*(0.2+2.0*u_speed);
float r = length(q); float a = atan(q.y,q.x);
float kx = 3.0 + floor((4.0+8.0*u_detail)*clamp(u_low,0.0,1.0));
float ky = 3.0 + floor((4.0+8.0*u_detail)*clamp(u_mid,0.0,1.0));
float f = 0.5 + 0.5*cos(q.x*3.1415*kx + t*(0.6+u_speed));
float g = 0.5 + 0.5*cos(q.y*3.1415*ky - t*(0.4+u_speed));
float field = f*g;
vec3 base = vec3(u_low,u_mid,u_high) * (0.2 + 0.8*smoothstep(0.5,0.9,field));
vec3 notesAcc = vec3(0.0);
for (int i=0;i<4;i++){
  float mn = noteAt(i); if (mn < 0.0) break; float amp = noteAmp(i);
  vec3 nc = noteColor(mn);
  float ampScale = mix(1.0, amp, u_noteAmpInfluence);
  float cell = 0.5 + 0.5*cos(q.x*3.1415*(kx+float(i)) + q.y*3.1415*(ky+float(i)*0.7) - t*(0.5+u_speed));
  cell = smoothstep(0.6,0.95,cell);
  notesAcc += nc * (cell * ampScale * 0.7);
}
col = clamp(base + notesAcc, 0.0, 1.0);
`,*/
  /* Removed: CymaticsPolarLissajous */
  /*CymaticsPolarLissajous: `
vec2 q = (p-0.5)*2.0; float t = u_time*(0.2+2.0*u_speed);
float r = length(q); float a = atan(q.y,q.x);
float mr = 10.0 + u_detail*18.0;
float ma = 3.0 + u_detail*6.0;
float field = 0.5 + 0.5*cos(r*mr + sin(a*ma + t*(0.8+u_speed))*2.0);
float nodes = smoothstep(0.55,0.9,field);
vec3 base = vec3(u_low,u_mid,u_high) * nodes;
vec3 notesAcc = vec3(0.0);
for (int i=0;i<4;i++){
  float mn = noteAt(i); if (mn < 0.0) break; float amp = noteAmp(i);
  vec3 nc = noteColor(mn);
  float ampScale = mix(1.0, amp, u_noteAmpInfluence);
  float cell = 0.5 + 0.5*cos(r*(8.0+float(i)*2.0) + a*(float(i)+2.0) - t*(0.7+u_speed));
  cell = smoothstep(0.6,0.95,cell);
  notesAcc += nc * (cell * ampScale * 0.7);
}
col = clamp(base + notesAcc, 0.0, 1.0);
`,*/
  CymaticsSpiralNodes: `
vec2 q = (p-0.5)*2.0; float t = u_time*(0.06+0.9*u_speed);
float r = length(q); float a = atan(q.y,q.x);
float spiral = a*3.0 + r*((20.0+u_detail*30.0)*u_density);
float field = 0.5 + 0.5*cos(spiral - t*(0.8+u_speed));
float nodes = smoothstep(0.6+0.1*u_nodeSharpness, 0.92, field);
vec3 base = vec3(u_low,u_mid,u_high) * nodes;
vec3 notesAcc = vec3(0.0);
for (int i=0;i<4;i++){
  float mn = noteAt(i); if (mn < 0.0) break; float amp = noteAmp(i);
  vec3 nc = noteColor(mn);
  float ampScale = mix(1.0, amp, u_noteAmpInfluence);
  float cell = 0.5 + 0.5*cos(spiral + float(i)*1.7 - t*(0.6+u_speed));
  cell = smoothstep(0.6,0.95,cell);
  notesAcc += nc * (cell * ampScale * 0.7);
}
vec3 fogSP = vec3(u_high)*smoothstep(0.2,0.8,(band(12)+band(13)+band(14)+band(15))*0.25)*0.12*u_harmonicFog;
col = clamp(base + notesAcc + fogSP, 0.0, 1.0);
`,
  /* Removed: CymaticsCentroidPlate */
  /*CymaticsCentroidPlate: `
// Modes guided by spectral centroid; more realistic plate look
vec2 q = (p-0.5)*2.0; float t = u_time*(0.2+2.0*u_speed);
float c = clamp(u_centroid/12000.0, 0.0, 1.0);
float m = 2.0 + floor(10.0*c);
float n = 2.0 + floor(10.0*(1.0-c));
float field = abs(sin(3.1415*q.x*m)*sin(3.1415*q.y*n));
float node = pow(1.0 - field, 3.0);
float grains = smoothstep(0.8, 0.98, node);
vec3 base = vec3(u_low,u_mid,u_high)*0.1;
vec3 acc = vec3(0.0);
for (int i=0;i<4;i++){
  float mn = noteAt(i); if (mn < 0.0) break; float amp = noteAmp(i);
  vec3 nc = noteColor(mn);
  float ampScale = mix(1.0, amp, u_noteAmpInfluence);
  float cell = 0.5 + 0.5*cos(q.x*(m+float(i)) + q.y*(n+float(i)*0.8) - t*(0.5+u_speed));
  cell = smoothstep(0.6,0.95,cell);
  acc += nc * (grains * cell * ampScale);
}
col = clamp(base + acc*(0.7+0.6*u_intensity), 0.0, 1.0);
`,*/

  CymaticsDualSource: `
// Two-wave interference pattern (moving sources)
vec2 q = (p-0.5)*2.0; float t = u_time*(0.2+1.8*u_speed);
vec2 s0 = vec2(0.4*cos(t*0.3), 0.3*sin(t*0.27));
vec2 s1 = vec2(0.3*cos(t*0.23+1.7), 0.35*sin(t*0.21+0.9));
float r0 = length(q - s0);
float r1 = length(q - s1);
float waves = 0.5 + 0.5*cos((r0*((10.0+u_detail*20.0)*u_density) - r1*((10.0+u_detail*20.0)*u_density)));
float nodes = smoothstep(0.55+0.1*u_nodeSharpness, 0.9, waves);
vec3 base = vec3(u_low,u_mid,u_high) * nodes;
vec3 notesAcc = vec3(0.0);
for (int i=0;i<4;i++){
  float mn = noteAt(i); if (mn < 0.0) break; float amp = noteAmp(i);
  vec3 nc = noteColor(mn);
  float ampScale = mix(1.0, amp, u_noteAmpInfluence);
  float cell = 0.5 + 0.5*cos(r0*(6.0+float(i)*1.2) + r1*(5.0+float(i)*1.0) - t*(0.5+u_speed));
  cell = smoothstep(0.6,0.95,cell);
  notesAcc += nc * (cell * ampScale * 0.7);
}
vec3 fogDS = vec3(u_high)*smoothstep(0.2,0.8,(band(12)+band(13)+band(14)+band(15))*0.25)*0.12*u_harmonicFog;
col = clamp(base + notesAcc + fogDS, 0.0, 1.0);
`,
  /* Removed: FisheyeDistort */
  /*FisheyeDistort: `
// Barrel/fish-eye style distortion driven by audio
vec2 q = (p-0.5)*2.0; float r = length(q);
float k = (0.1 + 0.6*u_fisheyeStrength) * (0.5 + 0.5*u_mid); // distortion strength
float f = 1.0 + k*r*r;
vec2 uv2 = (q / f) * 0.5 + 0.5;
// Render simple color field modulated by bands
float v = 0.0; v += sin((uv2.x+u_time)*4.0 + band(2)*8.0); v += sin((uv2.y+u_time)*5.0 + band(7)*7.0);
vec3 pal = 0.5 + 0.5*cos(6.2831*(vec3(0.3,0.6,0.9)*v + u_hueShift));
vec3 tint = vec3(u_low,u_mid,u_high);
// Note-color overlay from tone palette
vec3 notesAcc = vec3(0.0);
for (int i=0;i<4;i++){ float mn = noteAt(i); if(mn<0.0) break; notesAcc += noteColor(mn) * noteAmp(i); }
col = clamp(mix(pal, pal*tint, 0.35) + notesAcc*0.3, 0.0, 1.0);
`,*/

  BumpySphereAudio: `
// Fake bumpy sphere shading in 2D with audio bumps
vec2 q = (p-0.5)*2.0; float r = length(q);
float mask = smoothstep(1.0, 0.0, r);
// normal from sphere
vec3 N = normalize(vec3(q, sqrt(max(0.0, 1.0 - dot(q,q)))));
// bumps using bands
float bumps = 0.0; for(int i=0;i<8;i++){ bumps += band(i*2) * sin((N.x+N.y)*float(i+2)*6.0 + u_time); }
bumps /= 8.0; N = normalize(N + vec3(bumps*(0.05 + 0.35*u_bumpAmount)));
vec3 L = normalize(vec3(0.6,0.7,0.5)); float diff = max(0.0, dot(N,L));
vec3 base = vec3(u_low,u_mid,u_high) * (0.15 + 0.85*diff*u_light);
// note tint
vec3 notesAcc = vec3(0.0); for(int i=0;i<4;i++){ float mn = noteAt(i); if(mn<0.0) break; notesAcc += noteColor(mn)*noteAmp(i); }
col = clamp(mix(base, notesAcc, 0.4) * mask, 0.0, 1.0);
`,

  PlotNotesScatter: `
// Plot top notes as dots; size and brightness follow amplitude, fade as amp drops
// Slightly zoomed out to reveal full plot area on various aspect ratios
vec2 uv2 = (p - 0.5) / 1.15 + 0.5; vec3 acc = vec3(0.0);
for (int i=0;i<4;i++){
  float mn = noteAt(i); if (mn < 0.0) break; float amp = noteAmp(i);
  float pc = mod(mn, 12.0)/12.0; // x by pitch class
  float yy = clamp((mn - 36.0)/60.0, 0.0, 1.0); // y by pitch height
  vec2 pos = vec2(pc, yy);
  float sz = mix(0.01, 0.12, u_blipSize) * (0.6 + 0.8*amp);
  float d = distance(uv2, pos);
  float alpha = smoothstep(sz, 0.0, d) * smoothstep(0.0, 0.6, 1.0 - d) * amp;
  vec3 nc = noteColor(mn);
  acc += nc * alpha;
}
// faint axes/grid
float gx = 1.0 - smoothstep(0.0, 0.002, abs(fract(uv2.x*12.0)-0.5));
float gy = 1.0 - smoothstep(0.0, 0.002, abs(fract(uv2.y*6.0)-0.5));
vec3 grid = vec3(0.05) * max(gx, gy) * u_gridOpacity;
col = clamp(acc + grid, 0.0, 1.0);
`,
  PlotBandsDots: `
// Plot 16 bands as dots; dot height and size follow band energy
vec2 uv2 = p; vec3 acc = vec3(0.0);
// Average note palette to tint dots when notes present
float sumA = 0.0; vec3 ncAvg = vec3(0.0);
for (int j=0;j<4;j++){ float mn = noteAt(j); if (mn<0.0) break; float a = noteAmp(j); ncAvg += noteColor(mn) * a; sumA += a; }
if (sumA > 0.0) ncAvg /= sumA;
for (int i=0;i<16;i++){
  float a = band(i);
  float x = (float(i) + 0.5) / 16.0;
  float y = clamp(pow(a, 0.85), 0.0, 1.0);
  vec2 pos = vec2(x, y);
  float sz = mix(0.006, 0.06, u_blipSize) * (0.5 + a);
  float d = distance(uv2, pos);
  float alpha = smoothstep(sz, 0.0, d) * a;
  // tint by low/mid/high grouping
  vec3 tint = i < 5 ? vec3(1.0,0.6,0.3) : (i < 11 ? vec3(0.3,1.0,0.6) : vec3(0.6,0.7,1.0));
  vec3 dotCol = sumA > 0.0 ? mix(tint, ncAvg, 0.7) : tint;
  acc += dotCol * alpha * 0.8;
}
// baseline
col = clamp(acc, 0.0, 1.0);
`,
  PlotNotesSmear: `
// Notes smear horizontally across their frequency area with a dripping fade
vec2 uv2 = p; vec3 acc = vec3(0.0);
float t = u_time;
for (int i=0;i<4;i++){
  float mn = noteAt(i); if (mn < 0.0) break; float amp = noteAmp(i);
  // map midi to frequency (approx) and then to x range
  float f = 440.0 * pow(2.0, (mn - 69.0)/12.0);
  float x = clamp((log(f+1.0) - log(50.0)) / (log(12000.0) - log(50.0)), 0.0, 1.0);
  // smear as a horizontal gaussian centered at x, width grows with amp
  float w = 0.01 + u_smearWidth * (0.05 + 0.25 * amp);
  float gx = exp(-pow((uv2.x - x), 2.0) / (2.0*w*w));
  // vertical drip over time; scroll slowly downward with slight waviness
  float y = fract(uv2.y + u_dripSpeed*t + (0.03 + 0.12*u_smearJitter)*sin(uv2.x*20.0 + t*0.6));
  float drip = smoothstep(0.35, 0.0, y);
  // fade tail with time by modulating brightness by y position
  float tail = mix(0.2, 1.0, pow(1.0 - y, mix(0.4, 1.6, u_smearDecay)));
  vec3 nc = noteColor(mn);
  acc += nc * (gx * drip * tail * (0.4 + 0.6*amp));
}
// subtle background
acc += vec3(u_low,u_mid,u_high) * 0.05;
col = clamp(acc, 0.0, 1.0);
`,
  AudioSnakes3D: `
// Snake-like trails that turn with amplitude and note; faux 3D parallax
vec2 uv2 = p - 0.5; uv2.y *= u_zParallax;
vec3 acc = vec3(0.0);
for (int i=0;i<4;i++){
  float mn = noteAt(i); if (mn<0.0) break; float a = noteAmp(i);
  vec3 colN = noteColor(mn);
  float L = mix(0.25, 1.1, u_trailLength);
  float stepLen = 0.006 + 0.018*u_snakeSpeed; // per-step movement
  float seed = float(i)*3.173;
  vec2 pos = vec2(0.0);
  // turn frequency influenced by randomness
  float turnFreq = 0.8 + 3.5*u_randomness;
  for (int k=0;k<48;k++){
    float t0 = float(k)/48.0;
    float s = t0 * L;
    // segment index moving forward with time
    float idx = floor((u_time*turnFreq + s*2.0 + seed));
    // hash in [0,1)
    float h = fract(sin((seed + idx)*12.9898)*43758.5453);
    // audio-influenced direction pick in {0,1,2,3} → multiples of 90°
    float ai = clamp(a * (0.2 + 1.8*u_turnRate) + band(i*3)*0.25, 0.0, 1.0);
    float pick = floor(mod((h + ai)*4.0, 4.0));
    float angle = pick * 1.57079632679; // 90° steps
    pos += stepLen * vec2(cos(angle), sin(angle));
    vec2 p2 = pos;
    float thickness = mix(0.0012, 0.026, u_trailThickness) * (0.25 + 0.75*(1.0 - t0));
    float d = distance(uv2, p2);
    float stroke = smoothstep(thickness, 0.0, d);
    acc += colN * stroke * (0.35 + 0.65*a) * (0.15 + 0.85*(1.0 - t0)) * (0.4 + 0.6*u_trailGlow);
  }
}
// subtle background only (no flashing)
acc += vec3(u_low,u_mid,u_high)*0.05;
col = clamp(acc, 0.0, 1.0);
`,
};

// Parameter defaults per preset for quicker auditioning and mobile-friendly performance
export const PRESET_DEFAULTS: Record<string, any> = {
  "Color Test": {
    noteAmpInfluence: 1.0,
    octaveBrightness: 0.9,
    noteThreshold: 0.0,
    blipSize: 0.2,
    speed: 0.0,
    zoom: 1.0,
    detail: 0.0,
    intensity: 1.0,
    hueShift: 0.0,
  },
  "Music Circle": {
    noteAmpInfluence: 1.0,
    octaveBrightness: 0.8,
    noteThreshold: 0.0,
    blipSize: 0.2,
    speed: 0.0,
    zoom: 1.0,
    detail: 0.0,
    intensity: 1.0,
    hueShift: 0.0,
  },
  Plasma: {
    noteAmpInfluence: 0.1,
    octaveBrightness: 0.45,
    noteThreshold: 0.6,
    blipSize: 0.55,
    petals: 14,
    ripple: 0.25,
    speed: 0.23,
    zoom: 0.5,
    detail: 0.83,
    intensity: 1.47,
    angle: 1.087,
    hueShift: 0.14,
    density: 1.42,
    nodeSharpness: 0.09,
    bandBalance: 0.0,
    harmonicFog: true,
    plasmaFocus: 0.0,
    plasmaSwirl: 0.39,
    plasmaBandLow: 0.01,
    plasmaBandMid: 0.02,
    plasmaBandHigh: 0.14,
    plasmaToneBlend: 0.4,
    plasmaNoteDrive: 0.5,
    plasmaContrast: 0.42,
    plasmaScaleX: 1.06,
    plasmaScaleY: 0.5,
    plasmaGlow: 0.15,
    plasmaWarp: 1.0,
  },
  MultiNoteScribbles: {
    // User-provided defaults
    noteAmpInfluence: 0.93,
    octaveBrightness: 0.94,
    noteThreshold: 0.11,
    blipSize: 0.2,
    petals: 15,
    ripple: 0.62,
    speed: 0.06,
    zoom: 0.68,
    detail: 0.0,
    intensity: 1.0,
    angle: -4.143,
    hueShift: 0.14,
    density: 1.42,
    nodeSharpness: 0.09,
    bandBalance: 0.0,
    harmonicFog: true,
    plasmaFocus: 0.44,
    plasmaSwirl: 0.39,
    plasmaBandLow: 0.93,
    plasmaBandMid: 0.02,
    plasmaBandHigh: 0.01,
    plasmaToneBlend: 0.42,
    plasmaNoteDrive: 0.14,
    plasmaContrast: 0.2,
    plasmaScaleX: 1.0,
    plasmaScaleY: 0.78,
    plasmaGlow: 0.7,
    plasmaWarp: 0.63,
  },
  CymaticsRadialModes: { density: 1.0, nodeSharpness: 0.5, harmonicFog: true, speed: 1.0, detail: 1.0 },
  CymaticsNoteModes: { nodeSharpness: 0.65, harmonicFog: false, speed: 1.0, detail: 1.1 },
  CymaticsSpiralNodes: {
    // User-provided defaults
    noteAmpInfluence: 0.09,
    octaveBrightness: 0.73,
    noteThreshold: 0.06,
    blipSize: 0.53,
    petals: 18,
    ripple: 0.37,
    speed: 0.5,
    zoom: 2.25,
    detail: 0.0,
    intensity: 0.37,
    angle: 0.147,
    hueShift: 0.93,
    density: 0.58,
    nodeSharpness: 0.89,
    bandBalance: -0.29,
    harmonicFog: true,
    plasmaFocus: 0.16,
    plasmaSwirl: 0.52,
    plasmaBandLow: 0.13,
    plasmaBandMid: 0.18,
    plasmaBandHigh: 0.52,
    plasmaToneBlend: 0.42,
    plasmaNoteDrive: 0.14,
    plasmaContrast: 0.2,
    plasmaScaleX: 1,
    plasmaScaleY: 0.78,
    plasmaGlow: 0.64,
    plasmaWarp: 0.63,
  },
  CymaticsDualSource: { density: 1.0, nodeSharpness: 0.5, harmonicFog: true, speed: 0.9, detail: 0.9 },
  CymaticsPolarLissajous: {
    // User-provided defaults
    noteAmpInfluence: 0.09,
    octaveBrightness: 0.73,
    noteThreshold: 0.06,
    blipSize: 0.53,
    petals: 18,
    ripple: 0.93,
    speed: 0.22,
    zoom: 1.99,
    detail: 0.4,
    intensity: 0.49,
    angle: -4.073,
    hueShift: 0.604,
    density: 1.49,
    nodeSharpness: 0.23,
    bandBalance: -0.82,
    harmonicFog: true,
    plasmaFocus: 0.1,
    plasmaSwirl: 0.07,
    plasmaBandLow: 0.13,
    plasmaBandMid: 0.18,
    plasmaBandHigh: 0.52,
    plasmaToneBlend: 0.42,
    plasmaNoteDrive: 0.14,
    plasmaContrast: 0.2,
    plasmaScaleX: 1,
    plasmaScaleY: 0.78,
    plasmaGlow: 0.2,
    plasmaWarp: 0.34,
  },
};

export const PRESET_HELP: Record<string, string> = {
  Plasma: 'speed, zoom, detail, intensity, plasmaFocus, plasmaSwirl, hueShift',
  MultiNoteScribbles: 'speed, detail, intensity, noteThreshold',
  CymaticsChladni: 'density, nodeSharpness, bandBalance, speed, detail, harmonicFog',
  CymaticsRadialModes: 'density, nodeSharpness, speed, detail, harmonicFog',
  CymaticsNoteModes: 'nodeSharpness, speed, detail',
  CymaticsSpiralNodes: 'density, nodeSharpness, speed, harmonicFog',
  CymaticsHexCells: 'density, nodeSharpness, speed',
  CymaticsDualSource: 'density, nodeSharpness, speed, detail, harmonicFog',
  CymaticsPolarLissajous: 'density, nodeSharpness, speed, detail',
  PlotNotesScatter: 'noteThreshold, blipSize; dots sized by note amp',
  PlotBandsDots: 'blipSize; dots placed by band index and energy',
  AudioSnakes3D: 'trailThickness, trailLength, turnRate, snakeSpeed, randomness, zParallax, trailGlow',
};

const USER_DEFAULTS_KEY = 'mvs:shaderlab:presetDefaults:v1';
function loadUserDefaults(): Record<string, any> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(USER_DEFAULTS_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch {}
  return {};
}
function saveUserDefaults(map: Record<string, any>) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(USER_DEFAULTS_KEY, JSON.stringify(map));
    }
  } catch {}
}

function buildShaderSource(userBody: string, extraUniformDecl: string = ""): string {
  return `#ifdef GL_ES\nprecision highp float;\nprecision highp int;\n#endif\n\nvarying vec2 uv;\nuniform vec2 u_res;\nuniform float u_time, u_amp, u_centroid, u_note;\nuniform float u_low, u_mid, u_high, u_onset;\nuniform float u_themeB, u_themeS;\nuniform vec4 u_bands0, u_bands1, u_bands2, u_bands3;\nuniform vec4 u_pitchR0, u_pitchR1, u_pitchR2;\nuniform vec4 u_pitchG0, u_pitchG1, u_pitchG2;\nuniform vec4 u_pitchB0, u_pitchB1, u_pitchB2;\nuniform vec4 u_notesA;\nuniform vec4 u_notesAmpA;\nuniform float u_petals;\nuniform float u_ripple;\nuniform float u_speed;\nuniform float u_zoom;\nuniform float u_detail;\nuniform float u_intensity;\nuniform float u_angle;\nuniform float u_hueShift;\nuniform float u_noteAmpInfluence;\nuniform float u_octaveBrightness;\nuniform float u_noteThreshold;\nuniform float u_blipSize;\nuniform float u_plasmaFocus;\nuniform float u_plasmaSwirl;\nuniform float u_plasmaBandLow;\nuniform float u_plasmaBandMid;\nuniform float u_plasmaBandHigh;\nuniform float u_density;\nuniform float u_nodeSharpness;\nuniform float u_bandBalance;\nuniform float u_harmonicFog;\nuniform float u_plasmaToneBlend;\nuniform float u_plasmaNoteDrive;\nuniform float u_plasmaContrast;\nuniform float u_plasmaScaleX;\nuniform float u_plasmaScaleY;\nuniform float u_plasmaGlow;\nuniform float u_plasmaWarp;\nuniform float u_smearWidth;\nuniform float u_dripSpeed;\nuniform float u_smearDecay;\nuniform float u_smearJitter;\nuniform float u_fisheyeStrength;\nuniform float u_shockWidth;\nuniform float u_shockSpeed;\nuniform float u_shockMix;\nuniform float u_bumpAmount;\nuniform float u_light;\nuniform float u_surfaceA;\nuniform float u_surfaceB;\nuniform float u_surfaceMix;\nuniform float u_gridOpacity;\nuniform float u_groupTintMix;\nuniform float u_trailThickness;\nuniform float u_trailLength;\nuniform float u_turnRate;\nuniform float u_zParallax;\nuniform float u_randomness;\nuniform float u_snakeSpeed;\nuniform float u_trailGlow;\nuniform float u_quality;\nfloat pick4(vec4 v, int i){\n  if(i==0) return v.x;\n  if(i==1) return v.y;\n  if(i==2) return v.z;\n  return v.w;\n}\nfloat band(int i){\n  if(i<4) return pick4(u_bands0, i);\n  else if(i<8) return pick4(u_bands1, i-4);\n  else if(i<12) return pick4(u_bands2, i-8);\n  else return pick4(u_bands3, i-12);\n}\nfloat samplePitch(in vec4 a0,in vec4 a1,in vec4 a2, int i){\n  if(i<4) return pick4(a0, i);\n  else if(i<8) return pick4(a1, i-4);\n  else return pick4(a2, i-8);\n}\nint wrap12(int k){\n  return int(mod(float(k), 12.0));\n}\nvec3 toneColor(int idx){\n  int i = wrap12(idx);\n  float r = samplePitch(u_pitchR0,u_pitchR1,u_pitchR2,i);\n  float g = samplePitch(u_pitchG0,u_pitchG1,u_pitchG2,i);\n  float b = samplePitch(u_pitchB0,u_pitchB1,u_pitchB2,i);\n  vec3 c = vec3(r,g,b);\n  c = mix(vec3(0.0), c, u_themeS);\n  c *= u_themeB;\n  return c;\n}\nvec3 noteColor(float midi){\n  int idx = int(floor(midi+0.5));\n  vec3 nc = toneColor(idx);\n  float bright = clamp((midi - 36.0)/60.0, 0.0, 1.0) * u_octaveBrightness;\n  return mix(nc, vec3(1.0), bright*0.35);\n}\nfloat noteAt(int i){ return pick4(u_notesA, i); }\nfloat noteAmp(int i){ return pick4(u_notesAmpA, i); }
// Sanity uniforms
uniform float u_sanityBrightness;
uniform float u_sanityTintStrength;
uniform float u_sanityFloor;\n\n${extraUniformDecl}\n// Shared helpers available to all presets (global scope)\nmat2 r2(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }\nmat2 Rm(float a){ return r2(a); }\nfloat hash12(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }\nfloat noise(vec2 p){ vec2 i=floor(p), f=fract(p); float a=hash12(i), b=hash12(i+vec2(1.0,0.0)); float c=hash12(i+vec2(0.0,1.0)), d=hash12(i+vec2(1.0,1.0)); vec2 u=f*f*(3.0-2.0*f); return mix(mix(a,b,u.x), mix(c,d,u.x), u.y); }\nfloat noise2(vec2 p){ return noise(p); }\nfloat fbm(vec2 p){ float v=0.0; float a=0.5; mat2 m=r2(0.5); for(int i=0;i<4;i++){ v+=a*noise(p); p=m*p*2.0; a*=0.5; } return v; }\nvec3 palette(float d, vec3 tc){ return mix(vec3(0.2,0.7,0.9), tc, clamp(d,0.0,1.0)); }\nfloat mapF(vec3 p, float t){ for (int i=0;i<8;i++){ p.xz = r2(t) * p.xz; p.xy = r2(t*1.89) * p.xy; p.xz = abs(p.xz); p.xz -= 0.5; } return dot(sign(p), p)/5.0; }\nvec4 rmPyr(vec3 ro, vec3 rd, float t, vec3 tc){ float tt=0.0; vec3 col=vec3(0.0); float d=1.0; for(int i=0;i<64;i++){ vec3 p=ro+rd*tt; d = mapF(p, t)*0.5; if (d<0.02) break; if (d>100.0) break; col += palette(length(p)*0.1, tc) / (400.0 * max(d, 1e-3)); tt += d; } return vec4(col, 1.0/(d*100.0)); }\n\nvoid main(){\n  vec3 col = vec3(0.0);\n  vec2 p = uv;\n  ${userBody}\n  vec3 finalCol = max(col, vec3(u_sanityFloor)) * (0.5 + 0.5*u_sanityBrightness);
  gl_FragColor = vec4(clamp(finalCol,0.0,1.0), 1.0);\n}`;
}

// Minimal safe fallback shader if user/preset compilation fails
const SAFE_FALLBACK_SOURCE = `
vec2 q = (p-0.5)*2.0; float r = length(q);
vec3 base = vec3(0.2) + vec3(u_low, u_mid, u_high)*0.6;
float vign = smoothstep(1.2, 0.2, r);
col = base * vign;
`;

const ShaderLabImpl: React.FC<{ params: ShaderLabParams; frame: FeatureFrame | null }>= ({ params, frame }) => {
  const [time, setTime] = React.useState(0);
  const start = React.useRef<number | null>(null);
  // Smoothed pitch-class vectors for graceful color flow (primary and secondary)
  const pcVec = React.useRef<{x:number,y:number}>({ x: 1, y: 0 });
  const pc2Vec = React.useRef<{x:number,y:number}>({ x: 1, y: 0 });
  const pc2WeightRef = React.useRef<number>(0);
  const framesRef = React.useRef<number>(0);
  const [fps, setFps] = React.useState(0);

  React.useEffect(() => {
    let raf: number;
    const loop = (t: number) => {
      if (start.current == null) start.current = t;
      setTime((t - start.current) / 1000);
      framesRef.current++;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  React.useEffect(() => {
    const id = setInterval(() => {
      setFps((prev) => {
        const f = framesRef.current; framesRef.current = 0; return f * 2; // approx fps per 0.5s window
      });
    }, 500);
    return () => clearInterval(id);
  }, []);

  const storeState = require('../../state/useStore').useStore.getState();
  const audioMapping = storeState.audioMapping as any;
  const mappedBandsProp = (params as any)?._global?.mappedBands as number[] | undefined;
  const bandsRaw = mappedBandsProp && mappedBandsProp.length >= 16
    ? mappedBandsProp
    : applySpectrumMapping(frame?.spectrum, frame?.sampleRateHz, audioMapping);
  const b0 = bandsRaw[0] || 0,  b1 = bandsRaw[1] || 0,  b2 = bandsRaw[2] || 0,  b3 = bandsRaw[3] || 0;
  const b4 = bandsRaw[4] || 0,  b5 = bandsRaw[5] || 0,  b6 = bandsRaw[6] || 0,  b7 = bandsRaw[7] || 0;
  const b8 = bandsRaw[8] || 0,  b9 = bandsRaw[9] || 0, b10 = bandsRaw[10] || 0, b11 = bandsRaw[11] || 0;
  const b12 = bandsRaw[12] || 0, b13 = bandsRaw[13] || 0, b14 = bandsRaw[14] || 0, b15 = bandsRaw[15] || 0;
  const vec = (a: number, b: number, c: number, d: number) => [a, b, c, d];
  const low = frame?.bandEnergies?.low ?? b0;
  const mid = frame?.bandEnergies?.mid ?? b8;
  const high = frame?.bandEnergies?.high ?? b15;
  const onset = frame?.onsetPercussive ? 1 : 0;
  // Build tone color uniform arrays (memoized) from store toneColorMap and saturation
  const { pitchR, pitchG, pitchB } = React.useMemo(() => {
    const tc = storeState.toneColorMap as Array<{ hueDeg: number; brightness: number }>;
    const sat = storeState.toneColorSaturation as number;
    const r: number[] = new Array(12);
    const g: number[] = new Array(12);
    const b: number[] = new Array(12);
    for (let i = 0; i < 12; i++) {
      const entry = tc?.[i] || { hueDeg: (i/12)*360, brightness: 0.8 };
      const rgb = hslToRgb(entry.hueDeg, sat, entry.brightness);
      r[i] = rgb.r; g[i] = rgb.g; b[i] = rgb.b;
    }
    return { pitchR: r, pitchG: g, pitchB: b };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeState.toneColorMap, storeState.toneColorSaturation]);
  const notesA = frame?.notesMidi || new Float32Array(0);
  const notesAmpA = frame?.notesAmp || new Float32Array(0);
  // Compute smoothed pitch classes (primary/secondary) from notes
  const noteThresh = Math.max(0, Math.min(1, ((params as any).noteThreshold ?? 0.08)));
  const alpha = Math.max(0.01, Math.min(1.0, ((params as any).toneSmoothness ?? 0.22))); // smoothing factor; higher = faster changes
  const toAngle = (pc: number) => (pc/12) * Math.PI * 2;
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const norm = (x: number, y: number) => { const m = Math.hypot(x, y) || 1; return { x: x/m, y: y/m }; };
  const candidates: Array<{pc:number, amp:number}> = [];
  for (let i = 0; i < 4; i++) {
    const mn = notesA[i] ?? -1;
    const amp = notesAmpA[i] ?? 0;
    if (mn >= 0 && amp > noteThresh) {
      let pc = mn % 12; if (pc < 0) pc += 12;
      candidates.push({ pc, amp });
    }
  }
  if (candidates.length === 0 && (frame?.midiNote ?? -1) >= 0) {
    let pc = (frame!.midiNote! % 12); if (pc < 0) pc += 12;
    candidates.push({ pc, amp: 1 });
  }
  candidates.sort((a,b) => b.amp - a.amp);
  const primary = candidates[0];
  const secondary = candidates[1];
  if (primary) {
    const ang = toAngle(primary.pc);
    const tx = Math.cos(ang), ty = Math.sin(ang);
    const nx = lerp(pcVec.current.x, tx, alpha);
    const ny = lerp(pcVec.current.y, ty, alpha);
    pcVec.current = norm(nx, ny);
  }
  if (secondary) {
    const ang2 = toAngle(secondary.pc);
    const tx2 = Math.cos(ang2), ty2 = Math.sin(ang2);
    const nx2 = lerp(pc2Vec.current.x, tx2, alpha);
    const ny2 = lerp(pc2Vec.current.y, ty2, alpha);
    pc2Vec.current = norm(nx2, ny2);
    pc2WeightRef.current = lerp(pc2WeightRef.current, Math.max(0, Math.min(1, secondary.amp)), 0.1);
  } else {
    pc2WeightRef.current = lerp(pc2WeightRef.current, 0, 0.1);
  }
  const pcSmooth = ((Math.atan2(pcVec.current.y, pcVec.current.x) + Math.PI*2) % (Math.PI*2)) * (12/(Math.PI*2));
  const pc2Smooth = ((Math.atan2(pc2Vec.current.y, pc2Vec.current.x) + Math.PI*2) % (Math.PI*2)) * (12/(Math.PI*2));

  const uniforms: any = {
    u_res: [SCREEN_W, SCREEN_H],
    u_time: time,
    u_amp: frame?.amplitudeRms ?? 0,
    u_centroid: frame?.spectralCentroidHz ?? 0,
    u_note: frame?.midiNote ?? -1,
    u_low: low,
    u_mid: mid,
    u_high: high,
    u_themeB: storeState.themeBrightness ?? 1.0,
    u_themeS: storeState.themeSaturation ?? 1.0,
    u_onset: onset,
    u_bands0: vec(b0, b1, b2, b3),
    u_bands1: vec(b4, b5, b6, b7),
    u_bands2: vec(b8, b9, b10, b11),
    u_bands3: vec(b12, b13, b14, b15),
    u_notesA: vec(notesA[0]||-1, notesA[1]||-1, notesA[2]||-1, notesA[3]||-1),
    u_notesAmpA: vec(notesAmpA[0]||0, notesAmpA[1]||0, notesAmpA[2]||0, notesAmpA[3]||0),
    u_pitchR0: vec(pitchR[0]||0, pitchR[1]||0, pitchR[2]||0, pitchR[3]||0),
    u_pitchR1: vec(pitchR[4]||0, pitchR[5]||0, pitchR[6]||0, pitchR[7]||0),
    u_pitchR2: vec(pitchR[8]||0, pitchR[9]||0, pitchR[10]||0, pitchR[11]||0),
    u_pitchG0: vec(pitchG[0]||0, pitchG[1]||0, pitchG[2]||0, pitchG[3]||0),
    u_pitchG1: vec(pitchG[4]||0, pitchG[5]||0, pitchG[6]||0, pitchG[7]||0),
    u_pitchG2: vec(pitchG[8]||0, pitchG[9]||0, pitchG[10]||0, pitchG[11]||0),
    u_pitchB0: vec(pitchB[0]||0, pitchB[1]||0, pitchB[2]||0, pitchB[3]||0),
    u_pitchB1: vec(pitchB[4]||0, pitchB[5]||0, pitchB[6]||0, pitchB[7]||0),
    u_pitchB2: vec(pitchB[8]||0, pitchB[9]||0, pitchB[10]||0, pitchB[11]||0),
    // Smoothed pitch class uniforms for graceful tone color mapping
    u_pcSmooth: pcSmooth,
    u_pc2Smooth: pc2Smooth,
    u_pc2Weight: pc2WeightRef.current,
    u_petals: Math.max(3, Math.floor(((params as any).petals ?? 8))),
    u_ripple: Math.max(0, Math.min(1, ((params as any).ripple ?? 0.3))),
    u_speed: Math.max(0, Math.min(3, ((params as any).speed ?? 1.0))),
    u_zoom: Math.max(0.5, Math.min(3, ((params as any).zoom ?? 1.0))),
    u_detail: Math.max(0, Math.min(2, ((params as any).detail ?? 1.0))),
    u_intensity: Math.max(0, Math.min(2, ((params as any).intensity ?? 1.0))),
    u_angle: ((params as any).angle ?? 0.0),
    u_hueShift: Math.max(0, Math.min(1, ((params as any).hueShift ?? 0.0))),
    u_noteAmpInfluence: Math.max(0, Math.min(1, ((params as any).noteAmpInfluence ?? 1.0))),
    u_octaveBrightness: Math.max(0, Math.min(1, ((params as any).octaveBrightness ?? 1.0))),
    u_noteThreshold: Math.max(0, Math.min(1, ((params as any).noteThreshold ?? 0.08))),
    u_blipSize: Math.max(0, Math.min(1, ((params as any).blipSize ?? 0.2))),
    u_plasmaFocus: Math.max(0, Math.min(1, ((params as any).plasmaFocus ?? 0.5))),
    u_plasmaSwirl: Math.max(0, Math.min(1, ((params as any).plasmaSwirl ?? 0.2))),
    u_plasmaBandLow: Math.max(0, Math.min(2, ((params as any).plasmaBandLow ?? 1.0))),
    u_plasmaBandMid: Math.max(0, Math.min(2, ((params as any).plasmaBandMid ?? 1.0))),
    u_plasmaBandHigh: Math.max(0, Math.min(2, ((params as any).plasmaBandHigh ?? 1.0))),
    u_density: Math.max(0, Math.min(2, ((params as any).density ?? 1.0))),
    u_nodeSharpness: Math.max(0, Math.min(1, ((params as any).nodeSharpness ?? 0.5))),
    u_bandBalance: Math.max(-1, Math.min(1, ((params as any).bandBalance ?? 0.0))),
    u_harmonicFog: ((params as any).harmonicFog ? 1.0 : 0.0),
    u_plasmaToneBlend: Math.max(0, Math.min(1, ((params as any).plasmaToneBlend ?? 0.2))),
    u_plasmaNoteDrive: Math.max(0, Math.min(1, ((params as any).plasmaNoteDrive ?? 0.6))),
    u_plasmaContrast: Math.max(0, Math.min(1, ((params as any).plasmaContrast ?? 0.2))),
    u_plasmaScaleX: Math.max(0.5, Math.min(2, ((params as any).plasmaScaleX ?? 1.0))),
    u_plasmaScaleY: Math.max(0.5, Math.min(2, ((params as any).plasmaScaleY ?? 1.0))),
    u_plasmaGlow: Math.max(0, Math.min(1, ((params as any).plasmaGlow ?? 0.2))),
    u_plasmaWarp: Math.max(0, Math.min(1, ((params as any).plasmaWarp ?? 0.5))),
    u_smearWidth: Math.max(0.0, Math.min(1.0, ((params as any).smearWidth ?? 0.5))),
    u_dripSpeed: Math.max(0.0, Math.min(2.0, ((params as any).dripSpeed ?? 0.15))),
    u_smearDecay: Math.max(0.0, Math.min(1.0, ((params as any).smearDecay ?? 0.7))),
    u_smearJitter: Math.max(0.0, Math.min(1.0, ((params as any).smearJitter ?? 0.05))),
    u_fisheyeStrength: Math.max(0.0, Math.min(1.0, ((params as any).fisheyeStrength ?? 0.25))),
    u_shockWidth: Math.max(0.01, Math.min(0.5, ((params as any).shockWidth ?? 0.12))),
    u_shockSpeed: Math.max(0.0, Math.min(2.0, ((params as any).shockSpeed ?? 0.6))),
    u_shockMix: Math.max(0.0, Math.min(1.0, ((params as any).shockMix ?? 0.5))),
    u_bumpAmount: Math.max(0.0, Math.min(1.0, ((params as any).bumpAmount ?? 0.2))),
    u_light: Math.max(0.0, Math.min(2.0, ((params as any).light ?? 1.0))),
    u_surfaceA: Math.max(0.0, Math.min(20.0, ((params as any).surfaceA ?? 6.0))),
    u_surfaceB: Math.max(0.0, Math.min(20.0, ((params as any).surfaceB ?? 7.0))),
    u_surfaceMix: Math.max(0.0, Math.min(1.0, ((params as any).surfaceMix ?? 0.4))),
    u_gridOpacity: Math.max(0.0, Math.min(1.0, ((params as any).gridOpacity ?? 0.2))),
    u_groupTintMix: Math.max(0.0, Math.min(1.0, ((params as any).groupTintMix ?? 0.7))),
    u_trailThickness: Math.max(0.0, Math.min(1.0, ((params as any).trailThickness ?? 0.4))),
    u_trailLength: Math.max(0.0, Math.min(1.0, ((params as any).trailLength ?? 0.7))),
    u_turnRate: Math.max(0.0, Math.min(1.0, ((params as any).turnRate ?? 0.5))),
    u_zParallax: Math.max(0.5, Math.min(2.0, ((params as any).zParallax ?? 1.0))),
    u_randomness: Math.max(0.0, Math.min(1.0, ((params as any).randomness ?? 0.2))),
    u_snakeSpeed: Math.max(0.0, Math.min(1.0, ((params as any).snakeSpeed ?? 0.4))),
    u_trailGlow: Math.max(0.0, Math.min(1.0, ((params as any).trailGlow ?? 0.5))),
    // sanity uniforms
    u_sanityBrightness: Math.max(0.0, Math.min(2.0, ((params as any).sanityBrightness ?? 0.7))),
    u_sanityTintStrength: Math.max(0.0, Math.min(1.0, ((params as any).sanityTintStrength ?? 0.5))),
    u_sanityFloor: Math.max(0.0, Math.min(1.0, ((params as any).sanityFloor ?? 0.08))),
    // quality uniform for shader-side LOD choices
    u_quality: Math.max(0.3, Math.min(1.0, ((params as any).quality ?? 1.0))),
  };

  // Modular preset feature flag and assembly (Phase 1)
  let activeUserBody: string = (params as any).fragment || DEFAULT_FRAGMENT;
  let activeExtraDecl: string = "\nuniform float u_pcSmooth;\nuniform float u_pc2Smooth;\nuniform float u_pc2Weight;";
  const modularMode = !!(params as any).modularMode;
  let currentPresetId: string | undefined = undefined;
  let currentPreset: any = null;
  if (modularMode) {
    const presetId: string = (params as any).modularPresetId || (Registry.firstId() || 'Gridbreak');
    currentPresetId = presetId;
    const pm = Registry.byId(presetId);
    currentPreset = pm;
    if (pm) {
      try {
        const override = (params as any).modularFragmentOverride as string | undefined;
        if (override && override.length > 0) {
          activeUserBody = override;
        } else {
          activeUserBody = pm.buildFragment({});
        }
      } catch {}
      // Add per-preset uniforms and values
      const schema: any = pm.schema || {};
      Object.keys(schema).forEach((k) => {
        activeExtraDecl += `\nuniform float u_pm_${k};`;
        const paramKey = `pm_${pm.id}_${k}`;
        const defv = typeof schema[k]?.default === 'number' ? schema[k].default : 0.0;
        const val = (params as any)[paramKey] ?? defv;
        uniforms[`u_pm_${k}`] = val;
      });
    }
  }

  const [shader, setShader] = React.useState<any>(() => {
    if (Platform.OS === 'web') return null; // avoid gl-react on web (React 19 legacy context)
    try {
      return Shaders.create({ user: { frag: GLSL`${buildShaderSource(activeUserBody, activeExtraDecl)}` } });
    } catch (e) {
      try {
        return Shaders.create({ user: { frag: GLSL`${buildShaderSource(SAFE_FALLBACK_SOURCE)}` } });
      } catch {}
      return null;
    }
  });
  const [shaderWarning, setShaderWarning] = React.useState<string | null>(null);
  const [webCompileError, setWebCompileError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (Platform.OS === 'web') return; // skip gl-react updates on web
    const userSource = activeUserBody;
    try {
      const s = Shaders.create({ user: { frag: GLSL`${buildShaderSource(userSource, activeExtraDecl)}` } });
      setShader(s);
      setShaderWarning(null);
      return;
    } catch (e) {
      try {
        const fs = Shaders.create({ user: { frag: GLSL`${buildShaderSource(SAFE_FALLBACK_SOURCE)}` } });
        setShader(fs);
        setShaderWarning('Custom fragment failed to compile. Showing safe fallback.');
        return;
      } catch {}
    }
  }, [params.fragment, (params as any).modularMode, (params as any).modularPresetId]);
  const [dashOpen, setDashOpen] = React.useState(false);
  React.useEffect(()=>{ try { const v = window.localStorage.getItem('mvs:shaderlab:dashOpen'); if (v) setDashOpen(v==='1'); } catch {} },[]);


  // Build and apply routing presets when a ShaderLab preset is selected
  const applyRoutingPreset = React.useCallback((presetKey: string) => {
    try {
      const { useStore } = require('../../state/useStore');
      const s = useStore.getState();
      const { routes, removeRoute, addRoute } = s;
      // remove existing routes for ShaderLab
      (routes || []).filter((r: any) => r.visualizerId === 'shaderlab').forEach((r: any) => removeRoute(r.id));
      const mkId = () => 'route-' + Math.random().toString(36).slice(2, 10);
      const schema: any = (ShaderLabModule as any).schema || {};
      const range = (k: string, fallback: [number, number]): [number, number] => {
        const meta = schema[k];
        if (meta && typeof meta.min === 'number' && typeof meta.max === 'number') return [meta.min, meta.max];
        return fallback;
      };
      const add = (paramKey: string, source: any, out: [number, number], inRange?: [number, number]) => {
        const [outMin, outMax] = out;
        const [inMin, inMax] = inRange || [0, 1];
        const route: ParamRoute = {
          id: mkId(),
          visualizerId: 'shaderlab',
          paramKey,
          source,
          scale: { inMin, inMax, outMin, outMax },
          curve: 'linear',
          enabled: true,
        } as any;
        addRoute(route as any);
      };
      const add01 = (paramKey: string, source: any) => add(paramKey, source, range(paramKey, [0, 1]));
      // Common sensible routes (keep animations calmer; avoid driving speed)
      add('intensity', { kind: 'rms' }, range('intensity', [0, 2]));
      add('hueShift', { kind: 'centroid' }, range('hueShift', [0, 1]), [200, 12000]);
      // Preset-specific
      if (presetKey === 'Plasma') {
        add('plasmaBandLow', { kind: 'group', name: 'low' }, range('plasmaBandLow', [0, 2]));
        add('plasmaBandMid', { kind: 'group', name: 'mid' }, range('plasmaBandMid', [0, 2]));
        add('plasmaBandHigh', { kind: 'group', name: 'high' }, range('plasmaBandHigh', [0, 2]));
        add01('plasmaNoteDrive', { kind: 'onset' });
        add01('plasmaGlow', { kind: 'group', name: 'high' });
        add01('plasmaContrast', { kind: 'group', name: 'high' });
        add('zoom', { kind: 'rms' }, range('zoom', [0.5, 3]));
      } else if (presetKey === 'MultiNoteScribbles') {
        add('detail', { kind: 'group', name: 'high' }, range('detail', [0, 2]));
        add('speed', { kind: 'group', name: 'mid' }, range('speed', [0, 3]));
        add('noteThreshold', { kind: 'rms' }, range('noteThreshold', [0, 1]));
      } else if (presetKey.indexOf('Cymatics') === 0) {
        add('density', { kind: 'group', name: 'low' }, range('density', [0, 2]));
        add('nodeSharpness', { kind: 'group', name: 'high' }, range('nodeSharpness', [0, 1]));
        add('speed', { kind: 'group', name: 'mid' }, range('speed', [0, 3]));
      } else if (presetKey === 'PlotNotesScatter') {
        add('blipSize', { kind: 'rms' }, range('blipSize', [0, 1]));
        add('noteThreshold', { kind: 'rms' }, range('noteThreshold', [0, 1]));
      } else if (presetKey === 'PlotBandsDots') {
        add('blipSize', { kind: 'rms' }, range('blipSize', [0, 1]));
      }
    } catch {}
  }, []);

  if (Platform.OS !== 'web' && !shader) {
    return (
      <View style={{ flex: 1, padding: 12 }}>
        <Text style={{ color: 'white' }}>Shader compile error. Showing fallback.</Text>
      </View>
    );

  }


  // Provide u_res to WebGLFragment to match viewport size dynamically
  let effectiveScale = 1.0;
  let effectiveFPS = 60;
  let isFullscreen = false;
  if (Platform.OS === 'web') {
    // Performance: adjust render scale / fps if UI overlays are open
    const uiState = require('../../state/useStore').useStore.getState();
    isFullscreen = !!uiState.fullscreen;
    const uiActive = !!(uiState.showMenu || uiState.showLibrary || uiState.showInspector || uiState.showPanelsMenu || uiState.showRoutingPanel || uiState.showUniforms);
    const baseScale = Math.max(0.3, Math.min(1.0, ((params as any).renderScale ?? 0.85)));
    effectiveScale = uiActive ? baseScale * 0.6 : baseScale;
    const baseFPS = Math.max(15, Math.min(120, ((params as any).maxFPS ?? 60)));
    effectiveFPS = uiActive ? Math.min(baseFPS, 30) : baseFPS;
    uniforms.u_res = [window.innerWidth, window.innerHeight];
  }

  return (
    <View style={{ position: 'absolute', inset: 0 }}>
      {Platform.OS === 'web' ? (
        <WebGLFragment
          fragmentSource={buildShaderSource(activeUserBody, activeExtraDecl)}
          fallbackFragmentSource={buildShaderSource(SAFE_FALLBACK_SOURCE)}
          uniforms={uniforms}
          renderScale={effectiveScale}
          maxFPS={effectiveFPS}
          onCompileError={(e:any)=>{ try{ setWebCompileError(String(e?.message||e)); } catch{} }}
          onFallbackUsed={(e:any)=>{ try{ setWebCompileError('Fell back to safe shader due to error: ' + String(e?.message||e)); } catch{} }}
        />
      ) : (
        <GLSurface>
          <Node shader={shader.user} uniforms={uniforms} />
        </GLSurface>
      )}
      {/* Modular preset controls & discoverability (pilot) */}
      {Platform.OS === 'web' && !modularMode && !isFullscreen ? (
        <div style={{ position: 'absolute', left: 12, top: 12 }}>
          <button
            onClick={() => { try { require('../../state/useStore').useStore.getState().setParam('modularMode', true); } catch {} }}
            style={{ padding: '6px 10px', background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid #333', borderRadius: 8, cursor: 'pointer' }}
            title="Enable the new modular preset system (pilot)"
          >
            Enable Modular Presets
          </button>
        </div>
      ) : null}

      {modularMode && !isFullscreen ? (
        <View style={{ position: 'absolute', left: 12, top: 12, width: 300 }}>
          <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 8, borderWidth: 1, borderColor: '#222' }}>
            <Text style={{ color: 'white', fontWeight: 'bold', marginBottom: 6 }}>Preset Controls</Text>
            {Platform.OS === 'web' ? (
              <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ color: 'white' }}>Preset:</label>
                <select
                  value={currentPresetId || ''}
                  onChange={(e: any) => {
                    try {
                      const st = require('../../state/useStore').useStore.getState();
                      st.setParam('modularPresetId', e.target.value);
                      st.setParam('modularFragmentOverride', ''); // show the selected preset's default fragment
                    } catch {}
                  }}
                >
                  {Registry.all().map((p) => (
                    <option key={p.id} value={p.id}>{p.id}</option>
                  ))}
                </select>
              </div>
            ) : (
              <Text style={{ color: 'white', marginBottom: 8 }}>Preset: {currentPresetId || ''}</Text>
            )}
            {/* Per-preset knobs */}
            {currentPreset && (currentPreset as any).schema ? (
              Object.keys((currentPreset as any).schema).map((k) => {
                const meta: any = (currentPreset as any).schema[k];
                const paramKey = `pm_${(currentPreset as any).id}_${k}`;
                const value = (params as any)[paramKey] ?? meta.default;
                return (
                  <View key={k} style={{ marginBottom: 8 }}>
                    <Text style={{ color: 'white' }}>{k}: {typeof value === 'number' ? value.toFixed(2) : String(value)}</Text>
                    {Platform.OS === 'web' ? (
                      <input
                        type="range"
                        min={meta.min}
                        max={meta.max}
                        step={meta.step ?? 0.01}
                        value={value}
                        onChange={(e: any) => {
                          try { require('../../state/useStore').useStore.getState().setParam(paramKey, parseFloat(e.target.value)); } catch {}
                        }}
                        style={{ width: '100%' }}
                      />
                    ) : null}
                  </View>
                );
              })
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Modular fragment editor (web only) */}
      {modularMode && Platform.OS === 'web' && !isFullscreen ? (
        <div style={{ position: 'absolute', left: 12, top: 12 + 220, width: 520 }}>
          <div style={{ background: 'rgba(0,0,0,0.55)', borderRadius: 12, padding: 8, border: '1px solid #222' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color: 'white', fontWeight: 'bold' }}>GLSL Fragment (live)</span>
                {webCompileError ? (
                  <span style={{ color: '#ff6b6b', fontSize: 12 }}>Shader error: {webCompileError}</span>
                ) : null}
              </div>
              <button
                onClick={() => { try { require('../../state/useStore').useStore.getState().setParam('modularFragmentOverride', ''); setWebCompileError(null); } catch {} }}
                style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid #444', borderRadius: 6, cursor: 'pointer' }}
                title="Reset to preset source"
              >Reset</button>
            </div>
            <textarea
              spellCheck={false}
              style={{ width: '100%', height: 260, fontFamily: 'monospace', fontSize: 12, color: '#ddd', background: 'rgba(0,0,0,0.6)', border: '1px solid #333', borderRadius: 8, padding: 8 }}
              value={(((params as any).modularFragmentOverride as string) && ((params as any).modularFragmentOverride as string).length > 0) ? (params as any).modularFragmentOverride : activeUserBody}
              onChange={(e: any) => { try { require('../../state/useStore').useStore.getState().setParam('modularFragmentOverride', e.target.value); } catch {} }}
            />
          </div>
        </div>
      ) : null}
      {Platform.OS === 'web' && !isFullscreen ? (
        <div style={{ position: 'absolute', right: 12, top: 12 }}>
          <button
            onClick={() => { try { const nv = !dashOpen; setDashOpen(nv); window.localStorage.setItem('mvs:shaderlab:dashOpen', nv ? '1' : '0'); } catch {} }}
            style={{ padding: '6px 10px', background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid #333', borderRadius: 8, cursor: 'pointer' }}
            title="Toggle Audio Dashboard"
          >{dashOpen ? 'Hide' : 'Show'} Audio Dashboard</button>
        </div>
      ) : null}

      {Platform.OS === 'web' && dashOpen && !isFullscreen ? (
        <div style={{ position: 'absolute', right: 12, top: 52, width: 380, maxHeight: 520, overflow: 'auto', background: 'rgba(0,0,0,0.6)', border: '1px solid #222', borderRadius: 12, padding: 10 }}>
          <div style={{ color: 'white', fontWeight: 'bold', marginBottom: 6 }}>Audio Dashboard</div>
          <div style={{ color: '#ddd', fontSize: 12, lineHeight: 1.4, display: 'grid', gap: 8 }}>
            <div style={{ fontWeight: 'bold', color: '#9cf' }}>Raw Audio</div>
            <div>RMS: {(frame?.amplitudeRms ?? 0).toFixed(3)} | Centroid: {(frame?.spectralCentroidHz ?? 0).toFixed(1)} Hz | ZCR: {(frame?.zeroCrossingRate ?? 0).toFixed(3)}</div>
            <div>Rolloff: {(frame?.spectralRolloffHz ?? 0).toFixed(1)} Hz | Flatness: {(frame?.spectralFlatness ?? 0).toFixed(3)} | SR: {(frame?.sampleRateHz ?? 0)}</div>
            <div>Dominant Freq: {(frame?.dominantFreqHz ?? 0).toFixed(1)} Hz</div>
            <div style={{ fontWeight: 'bold', color: '#9cf' }}>Frequency Bands (0..15)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
              {[b0,b1,b2,b3,b4,b5,b6,b7,b8,b9,b10,b11,b12,b13,b14,b15].map((v, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.05)', padding: 2, borderRadius: 4 }}>
                  <div>B{i}: {v.toFixed(2)}</div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
                    <div style={{ width: `${Math.max(0, Math.min(1, v))*100}%`, height: '100%', background: '#6cf', borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontWeight: 'bold', color: '#9cf' }}>Note Detection (top 4)</div>
            <div>
              {[0,1,2,3].map((i)=>{
                const m = notesA[i] ?? -1; const a = notesAmpA[i] ?? 0;
                return <div key={i}>i{i}: midi={m.toFixed(1)}, amp={a.toFixed(2)}</div>;
              })}
            </div>
            <div style={{ fontWeight: 'bold', color: '#9cf' }}>Pitch Analysis</div>
            <div>u_pcSmooth: {(uniforms as any).u_pcSmooth?.toFixed ? (uniforms as any).u_pcSmooth.toFixed(2) : String((uniforms as any).u_pcSmooth)} | u_pc2Smooth: {(uniforms as any).u_pc2Smooth?.toFixed ? (uniforms as any).u_pc2Smooth.toFixed(2) : String((uniforms as any).u_pc2Smooth)} | u_pc2Weight: {(uniforms as any).u_pc2Weight?.toFixed ? (uniforms as any).u_pc2Weight.toFixed(2) : String((uniforms as any).u_pc2Weight)}</div>
            <div>Chroma12: {Array.from(frame?.chroma12 || []).map((v: number, idx: number) => `${idx}:${v.toFixed(2)}`).join(' ') || 'n/a'}</div>
            <div>Key: {frame?.keyIndex != null ? frame.keyIndex : 'n/a'} {frame?.keyIsMajor ? 'Major' : (frame?.keyIsMajor===false ? 'Minor' : '')} | conf: {(frame?.keyConfidence ?? 0).toFixed(2)}</div>
            <div style={{ fontWeight: 'bold', color: '#9cf' }}>Audio Features</div>
            <div>Low: {low.toFixed(2)} | Mid: {mid.toFixed(2)} | High: {high.toFixed(2)} | Onset: {onset}</div>
            <div>Onset rate: {(frame?.onsetRatePerSec ?? 0).toFixed(2)} /s</div>
            <div style={{ fontWeight: 'bold', color: '#9cf' }}>MIDI</div>
            <div>Current Note: {(frame?.midiNote ?? -1).toFixed(1)} | Velocity: n/a | Channel: n/a</div>
            <div style={{ fontWeight: 'bold', color: '#9cf' }}>Tone Mapping</div>
            <div>themeB: {(storeState.themeBrightness ?? 1).toFixed(2)} | themeS: {(storeState.themeSaturation ?? 1).toFixed(2)}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 2 }}>
              {Array.from({length:12}).map((_,i)=>{
                const r = (pitchR?.[i] ?? 0);
                const g = (pitchG?.[i] ?? 0);
                const b = (pitchB?.[i] ?? 0);
                const rgb = `rgb(${Math.round(r*255)},${Math.round(g*255)},${Math.round(b*255)})`;
                return <div key={i} title={`PC ${i}`} style={{ height: 10, background: rgb, borderRadius: 2 }} />;
              })}
            </div>
            <div style={{ fontWeight: 'bold', color: '#9cf' }}>Octave Analysis</div>
            {(() => {
              try {
                const bins = new Array(10).fill(0);
                [0,1,2,3].forEach((i)=>{ const m = notesA[i] ?? -1; const a = notesAmpA[i] ?? 0; if (m>=0) { const oc = Math.max(0, Math.min(9, Math.floor(m/12))); bins[oc] += a; }});
                return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
                  {bins.map((v,i)=> (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.05)', padding: 2, borderRadius: 4 }}>
                      <div>Oc{i}: {v.toFixed(2)}</div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
                        <div style={{ width: `${Math.max(0, Math.min(1, v))*100}%`, height: '100%', background: '#fc6', borderRadius: 3 }} />
                      </div>
                    </div>
                  ))}
                </div>;
              } catch {
                return <div>n/a</div>;
              }
            })()}
            <div style={{ fontWeight: 'bold', color: '#9cf' }}>System Status</div>
            <div>FPS: {fps.toFixed(0)} | Render scale: {effectiveScale.toFixed(2)} | Max FPS: {effectiveFPS}</div>
            <div>Quality (u_quality): {((uniforms as any).u_quality ?? 1.0).toFixed(2)} | Buffer: n/a | Latency: n/a</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button onClick={() => { try { const snap = { time, frame, bands: [b0,b1,b2,b3,b4,b5,b6,b7,b8,b9,b10,b11,b12,b13,b14,b15], notes: Array.from(notesA||[]).slice(0,4), amps: Array.from(notesAmpA||[]).slice(0,4), uniforms }; navigator.clipboard?.writeText(JSON.stringify(snap, null, 2)); } catch {} }} style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid #444', borderRadius: 6, cursor: 'pointer' }}>Copy Snapshot</button>
              <button onClick={() => { try { require('../../state/useStore').useStore.getState().setParam('noteThreshold', 0.08); require('../../state/useStore').useStore.getState().setParam('toneSmoothness', 0.22); } catch {} }} style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid #444', borderRadius: 6, cursor: 'pointer' }}>Reset</button>
            </div>
            <div style={{ fontWeight: 'bold', color: '#9cf' }}>Controls</div>
            <div>Note Threshold: <input type="range" min={0} max={1} step={0.01} defaultValue={(params as any).noteThreshold ?? 0.08} onChange={(e:any)=>{ try { require('../../state/useStore').useStore.getState().setParam('noteThreshold', parseFloat(e.target.value)); } catch {} }} /> <span>{((params as any).noteThreshold ?? 0.08).toFixed(2)}</span></div>
            <div>Tone Smoothness: <input type="range" min={0.01} max={1} step={0.01} defaultValue={(params as any).toneSmoothness ?? 0.22} onChange={(e:any)=>{ try { require('../../state/useStore').useStore.getState().setParam('toneSmoothness', parseFloat(e.target.value)); } catch {} }} /> <span>{((params as any).toneSmoothness ?? 0.22).toFixed(2)}</span></div>
          </div>
        </div>
      ) : null}


    </View>
  );
};

export const ShaderLabModule: VisualizerModule = {
  id: 'shaderlab',
  name: 'ShaderLab',
  schema: {
    // Feature flag for modular presets (Phase 1)
    modularMode: { type: 'boolean' as any, default: false, description: 'Enable modular preset loader (pilot)', group: 'Modular' },
    modularPresetId: { type: 'select', options: Registry.all().map(p=>p.id), default: (Registry.firstId?.() ?? 'Gridbreak'), description: 'Modular preset ID (pilot: Gridbreak, Squid, MountainFogBeach)', group: 'Modular' },
    modularFragmentOverride: { type: 'string', default: '', description: 'Override current modular preset fragment (live-edit)', multiline: true, group: 'Modular' },
    fragment: { type: 'string', default: DEFAULT_FRAGMENT, description: 'GLSL fragment code body; set vec3 col', multiline: true },
    // Sanity knobs (global to ShaderLab presets)
    sanityBrightness: { type: 'number', min: 0, max: 2, step: 0.01, default: 0.7, description: 'Global brightness multiplier for safety', group: 'Sanity' },
    sanityTintStrength: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.5, description: 'Strength of musical tint (note/band mix)', group: 'Sanity' },
    sanityFloor: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.08, description: 'Minimum brightness floor so visuals are visible', group: 'Sanity' },
    // Performance knobs
    quality: { type: 'number', min: 0.3, max: 1, step: 0.01, default: 1.0, description: 'Shader quality hint (affects loops/LOD if used by preset)', group: 'Performance' },
    renderScale: { type: 'number', min: 0.3, max: 1, step: 0.01, default: 0.85, description: 'Render resolution scale (lower = faster)', group: 'Performance' },
    maxFPS: { type: 'number', min: 15, max: 120, step: 1, default: 60, description: 'Max render FPS (lower = less main-thread load)', group: 'Performance' },
    noteAmpInfluence: { type: 'number', min: 0, max: 1, step: 0.01, default: 1.0, description: 'Scale note color by amplitude', group: 'Note Response', presets: ['Plasma','MultiNoteScribbles','CymaticsRadialModes','CymaticsNoteModes','CymaticsSpiralNodes','CymaticsDualSource','CymaticsPolarLissajous','FisheyeDistort','BumpySphereAudio','PlotNotesScatter','PlotNotesSmear'] },
    octaveBrightness: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.9, description: 'Brighten color with higher pitch', group: 'Note Response', presets: ['Plasma','MultiNoteScribbles','CymaticsRadialModes','CymaticsNoteModes','CymaticsSpiralNodes','CymaticsDualSource','CymaticsPolarLissajous','FisheyeDistort','BumpySphereAudio','PlotNotesScatter','PlotNotesSmear'] },
    noteThreshold: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.08, description: 'Minimum note amplitude to render blips', group: 'Note Response', presets: ['Plasma','MultiNoteScribbles','CymaticsRadialModes','CymaticsNoteModes','CymaticsSpiralNodes','CymaticsDualSource','CymaticsPolarLissajous','FisheyeDistort','BumpySphereAudio','PlotNotesScatter','PlotNotesSmear'] },
    toneSmoothness: { type: 'number', min: 0.01, max: 1, step: 0.01, default: 0.22, description: 'Smoothing for smoothed pitch-class color (lower = slower, smoother)', group: 'Note Response' },
    blipSize: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.2, description: 'Blip size for note-driven shapes', group: 'Note Response', presets: ['Plasma','MultiNoteScribbles','PlotNotesScatter','PlotNotesSmear'] },
    petals: { type: 'number', min: 3, max: 24, step: 1, default: 8, description: 'Petal count (Mandala variants)', presets: ['MultiNoteScribbles'], group: 'Geometry' },
    ripple: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.25, description: 'Ripple amount', presets: ['MultiNoteScribbles'], group: 'Geometry' },
    speed: { type: 'number', min: 0, max: 3, step: 0.01, default: 0.9, description: 'Animation speed', group: 'Animation', presets: ['Plasma','MultiNoteScribbles','CymaticsChladni','CymaticsRadialModes','CymaticsNoteModes','CymaticsSpiralNodes','CymaticsHexCells','CymaticsDualSource','CymaticsPolarLissajous'] },
    zoom: { type: 'number', min: 0.5, max: 3, step: 0.01, default: 1.1, description: 'Zoom level', group: 'Animation', presets: ['Plasma'] },
    detail: { type: 'number', min: 0, max: 2, step: 0.01, default: 0.9, description: 'Pattern detail', group: 'Animation', presets: ['Plasma','MultiNoteScribbles','CymaticsChladni','CymaticsRadialModes','CymaticsNoteModes','CymaticsSpiralNodes','CymaticsHexCells','CymaticsDualSource','CymaticsPolarLissajous'] },
    intensity: { type: 'number', min: 0, max: 2, step: 0.01, default: 0.95, description: 'Effect intensity', group: 'Animation', presets: ['Plasma','MultiNoteScribbles','CymaticsChladni','CymaticsRadialModes','CymaticsNoteModes','CymaticsSpiralNodes','CymaticsHexCells','CymaticsDualSource','CymaticsPolarLissajous'] },
    angle: { type: 'number', min: -6.283, max: 6.283, step: 0.01, default: 0.0, description: 'Rotation angle', presets: ['Plasma','MultiNoteScribbles'], group: 'Animation' },
    hueShift: { type: 'number', min: 0, max: 1, step: 0.001, default: 0.0, description: 'Hue shift phase', group: 'Color', presets: ['Plasma','SurfacePlotAudio','FisheyeDistort'] },
    fisheyeStrength: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.25, description: 'Fish-eye distortion strength', group: 'Distort', presets: ['FisheyeDistort'] },
    smearWidth: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.5, description: 'Plot smear width (notes)', group: 'Plot', presets: ['PlotNotesSmear'] },
    dripSpeed: { type: 'number', min: 0, max: 2, step: 0.01, default: 0.15, description: 'Plot smear vertical speed', group: 'Plot', presets: ['PlotNotesSmear'] },
    smearDecay: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.7, description: 'Plot smear fade curve', group: 'Plot', presets: ['PlotNotesSmear'] },
    smearJitter: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.05, description: 'Plot smear wobble amount', group: 'Plot', presets: ['PlotNotesSmear'] },
    density: { type: 'number', min: 0, max: 2, step: 0.01, default: 1.0, description: 'Cymatics density', presets: ['CymaticsRadialModes','CymaticsSpiralNodes','CymaticsDualSource','CymaticsPolarLissajous'], group: 'Cymatics' },
    nodeSharpness: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.5, description: 'Node edge sharpness', presets: ['CymaticsRadialModes','CymaticsNoteModes','CymaticsSpiralNodes','CymaticsDualSource','CymaticsPolarLissajous'], group: 'Cymatics' },
    bandBalance: { type: 'number', min: -1, max: 1, step: 0.01, default: 0.0, description: 'Tilt low(−) vs high(+)', presets: [], group: 'Cymatics' },
    harmonicFog: { type: 'boolean', default: false, description: 'Enable high-frequency fog', presets: ['CymaticsRadialModes','CymaticsSpiralNodes','CymaticsDualSource','CymaticsPolarLissajous'], group: 'Cymatics' },
    plasmaFocus: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.55, description: 'Plasma radial focus', presets: ['Plasma'], group: 'Plasma' },
    plasmaSwirl: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.25, description: 'Plasma swirl', presets: ['Plasma'], group: 'Plasma' },
    plasmaBandLow: { type: 'number', min: 0, max: 2, step: 0.01, default: 1.0, description: 'Low band influence', presets: ['Plasma'], group: 'Plasma' },
    plasmaBandMid: { type: 'number', min: 0, max: 2, step: 0.01, default: 1.0, description: 'Mid band influence', presets: ['Plasma'], group: 'Plasma' },
    plasmaBandHigh: { type: 'number', min: 0, max: 2, step: 0.01, default: 1.0, description: 'High band influence', presets: ['Plasma'], group: 'Plasma' },
    plasmaToneBlend: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.2, description: 'Blend toward tone/mix', presets: ['Plasma'], group: 'Plasma' },
    plasmaNoteDrive: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.6, description: 'Note-driven warp amount', presets: ['Plasma'], group: 'Plasma' },
    plasmaContrast: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.2, description: 'Contrast boost', presets: ['Plasma'], group: 'Plasma' },
    plasmaScaleX: { type: 'number', min: 0.5, max: 2, step: 0.01, default: 1.0, description: 'X scale', presets: ['Plasma'], group: 'Plasma' },
    plasmaScaleY: { type: 'number', min: 0.5, max: 2, step: 0.01, default: 1.0, description: 'Y scale', presets: ['Plasma'], group: 'Plasma' },
    plasmaGlow: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.2, description: 'Extra glow', presets: ['Plasma'], group: 'Plasma' },
    plasmaWarp: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.5, description: 'Field warp amount', presets: ['Plasma'], group: 'Plasma' },

    shockWidth: { type: 'number', min: 0.01, max: 0.5, step: 0.005, default: 0.12, description: 'Shockwave ring width', group: 'Shockwave', presets: [] },
    shockSpeed: { type: 'number', min: 0, max: 2, step: 0.01, default: 0.6, description: 'Shockwave expansion speed', group: 'Shockwave', presets: [] },
    shockMix: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.5, description: 'Mix notes into shockwave', group: 'Shockwave', presets: [] },
    light: { type: 'number', min: 0, max: 2, step: 0.01, default: 1.0, description: 'Lighting strength', group: 'Lighting', presets: ['BumpySphereAudio'] },
    bumpAmount: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.2, description: 'Bumpiness amount', group: 'Lighting', presets: ['BumpySphereAudio'] },
    surfaceA: { type: 'number', min: 0, max: 20, step: 0.1, default: 6.0, description: 'Surface X frequency', group: 'Surface', presets: [] },
    surfaceB: { type: 'number', min: 0, max: 20, step: 0.1, default: 7.0, description: 'Surface Y frequency', group: 'Surface', presets: [] },
    surfaceMix: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.4, description: 'Mix band tint into surface', group: 'Surface', presets: [] },
    gridOpacity: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.2, description: 'Grid opacity', group: 'Plot', presets: ['PlotNotesScatter'] },
    groupTintMix: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.7, description: 'Blend group tint with note tint', group: 'Plot', presets: ['PlotBandsDots'] },
    trailThickness: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.4, description: 'Snake trail thickness', group: 'Snakes', presets: ['AudioSnakes3D'] },
    trailLength: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.7, description: 'Snake trail length', group: 'Snakes', presets: ['AudioSnakes3D'] },
    turnRate: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.5, description: 'Turning rate with amplitude', group: 'Snakes', presets: ['AudioSnakes3D'] },
    zParallax: { type: 'number', min: 0.5, max: 2, step: 0.01, default: 1.0, description: 'Vertical parallax scale', group: 'Snakes', presets: ['AudioSnakes3D'] },
    randomness: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.2, description: 'Random wobble amount', group: 'Snakes', presets: ['AudioSnakes3D'] },
    snakeSpeed: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.4, description: 'Snake motion speed', group: 'Snakes', presets: ['AudioSnakes3D'] },
    trailGlow: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.5, description: 'Trail glow multiplier', group: 'Snakes', presets: ['AudioSnakes3D'] },
  },
  defaultParams: {
    modularMode: false,
    modularPresetId: 'Gridbreak',
    modularFragmentOverride: '',
    fragment: DEFAULT_FRAGMENT,
    // preset removed from UI; fragment only
    noteAmpInfluence: 1.0,
    octaveBrightness: 0.9,
    noteThreshold: 0.08,
    toneSmoothness: 0.22,
    blipSize: 0.2,
    petals: 8,
    ripple: 0.25,
    speed: 0.9,
    zoom: 1.1,
    detail: 0.9,
    intensity: 0.95,
    angle: 0.0,
    hueShift: 0.0,
    density: 1.0,
    nodeSharpness: 0.5,
    bandBalance: 0.0,
    harmonicFog: false,
    plasmaFocus: 0.55,
    plasmaSwirl: 0.25,
    plasmaBandLow: 1.0,
    plasmaBandMid: 1.0,
    plasmaBandHigh: 1.0,
    plasmaToneBlend: 0.2,
    plasmaNoteDrive: 0.6,
    plasmaContrast: 0.2,
    plasmaScaleX: 1.0,
    plasmaScaleY: 1.0,
    plasmaGlow: 0.2,
    plasmaWarp: 0.5,
    // sanity & performance defaults
    sanityBrightness: 0.7,
    sanityTintStrength: 0.5,
    sanityFloor: 0.08,
    quality: 1.0,
    renderScale: 0.85,
    maxFPS: 60,
  },
  Component: ShaderLabImpl as any,
};


