import React from 'react';
import { Dimensions, View, Text, Button } from 'react-native';
// @ts-ignore - legacy library lacks types
import { Shaders, Node, GLSL } from 'gl-react';
import type { FeatureFrame, VisualizerModule } from '../../core/types';
import { applySpectrumMapping } from '../../core/mapping';
import { GLSurface } from '../../ui/GLSurface';
import { hslToRgb } from '../../core/color';
import type { ParamRoute } from '../../core/types';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

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

function buildShaderSource(userBody: string): string {
  return `precision highp float;\n\nvarying vec2 uv;\nuniform vec2 u_res;\nuniform float u_time, u_amp, u_centroid, u_note;\nuniform float u_low, u_mid, u_high, u_onset;\nuniform float u_themeB, u_themeS;\nuniform vec4 u_bands0, u_bands1, u_bands2, u_bands3;\nuniform vec4 u_pitchR0, u_pitchR1, u_pitchR2;\nuniform vec4 u_pitchG0, u_pitchG1, u_pitchG2;\nuniform vec4 u_pitchB0, u_pitchB1, u_pitchB2;\nuniform vec4 u_notesA;\nuniform vec4 u_notesAmpA;\nuniform float u_petals;\nuniform float u_ripple;\nuniform float u_speed;\nuniform float u_zoom;\nuniform float u_detail;\nuniform float u_intensity;\nuniform float u_angle;\nuniform float u_hueShift;\nuniform float u_noteAmpInfluence;\nuniform float u_octaveBrightness;\nuniform float u_noteThreshold;\nuniform float u_blipSize;\nuniform float u_plasmaFocus;\nuniform float u_plasmaSwirl;\nuniform float u_plasmaBandLow;\nuniform float u_plasmaBandMid;\nuniform float u_plasmaBandHigh;\nuniform float u_density;\nuniform float u_nodeSharpness;\nuniform float u_bandBalance;\nuniform float u_harmonicFog;\nuniform float u_plasmaToneBlend;\nuniform float u_plasmaNoteDrive;\nuniform float u_plasmaContrast;\nuniform float u_plasmaScaleX;\nuniform float u_plasmaScaleY;\nuniform float u_plasmaGlow;\nuniform float u_plasmaWarp;\nuniform float u_smearWidth;\nuniform float u_dripSpeed;\nuniform float u_smearDecay;\nuniform float u_smearJitter;\nuniform float u_fisheyeStrength;\nuniform float u_shockWidth;\nuniform float u_shockSpeed;\nuniform float u_shockMix;\nuniform float u_bumpAmount;\nuniform float u_light;\nuniform float u_surfaceA;\nuniform float u_surfaceB;\nuniform float u_surfaceMix;\nuniform float u_gridOpacity;\nuniform float u_groupTintMix;\nuniform float u_trailThickness;\nuniform float u_trailLength;\nuniform float u_turnRate;\nuniform float u_zParallax;\nuniform float u_randomness;\nuniform float u_snakeSpeed;\nuniform float u_trailGlow;\nfloat pick4(vec4 v, int i){\n  if(i==0) return v.x;\n  if(i==1) return v.y;\n  if(i==2) return v.z;\n  return v.w;\n}\nfloat band(int i){\n  if(i<4) return pick4(u_bands0, i);\n  else if(i<8) return pick4(u_bands1, i-4);\n  else if(i<12) return pick4(u_bands2, i-8);\n  else return pick4(u_bands3, i-12);\n}\nfloat samplePitch(in vec4 a0,in vec4 a1,in vec4 a2, int i){\n  if(i<4) return pick4(a0, i);\n  else if(i<8) return pick4(a1, i-4);\n  else return pick4(a2, i-8);\n}\nint wrap12(int k){\n  return int(mod(float(k), 12.0));\n}\nvec3 toneColor(int idx){\n  int i = wrap12(idx);\n  float r = samplePitch(u_pitchR0,u_pitchR1,u_pitchR2,i);\n  float g = samplePitch(u_pitchG0,u_pitchG1,u_pitchG2,i);\n  float b = samplePitch(u_pitchB0,u_pitchB1,u_pitchB2,i);\n  vec3 c = vec3(r,g,b);\n  c = mix(vec3(0.0), c, u_themeS);\n  c *= u_themeB;\n  return c;\n}\nvec3 noteColor(float midi){\n  int idx = int(floor(midi+0.5));\n  vec3 nc = toneColor(idx);\n  float bright = clamp((midi - 36.0)/60.0, 0.0, 1.0) * u_octaveBrightness;\n  return mix(nc, vec3(1.0), bright*0.35);\n}\nfloat noteAt(int i){ return pick4(u_notesA, i); }\nfloat noteAmp(int i){ return pick4(u_notesAmpA, i); }\nvoid main(){\n  vec3 col = vec3(0.0);\n  vec2 p = uv;\n  ${userBody}\n  gl_FragColor = vec4(clamp(col,0.0,1.0), 1.0);\n}`;
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
  React.useEffect(() => {
    let raf: number;
    const loop = (t: number) => {
      if (start.current == null) start.current = t;
      setTime((t - start.current) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
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
  };

  const [shader, setShader] = React.useState<any>(() => {
    try {
      return Shaders.create({ user: { frag: GLSL`${buildShaderSource(params.fragment || DEFAULT_FRAGMENT)}` } });
    } catch (e) {
      try {
        return Shaders.create({ user: { frag: GLSL`${buildShaderSource(SAFE_FALLBACK_SOURCE)}` } });
      } catch {}
      return null;
    }
  });
  const [shaderWarning, setShaderWarning] = React.useState<string | null>(null);

  React.useEffect(() => {
    const userSource = params.fragment || DEFAULT_FRAGMENT;
    try {
      const s = Shaders.create({ user: { frag: GLSL`${buildShaderSource(userSource)}` } });
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
  }, [params.fragment]);

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

  if (!shader) {
    return (
      <View style={{ flex: 1, padding: 12 }}>
        <Text style={{ color: 'white' }}>Shader compile error. Showing fallback.</Text>
      </View>
    );
  }

  return (
    <View style={{ position: 'absolute', inset: 0 }}>
      <GLSurface>
        <Node shader={shader.user} uniforms={uniforms} />
      </GLSurface>
    </View>
  );
};

export const ShaderLabModule: VisualizerModule = {
  id: 'shaderlab',
  name: 'ShaderLab',
  schema: {
    fragment: { type: 'string', default: DEFAULT_FRAGMENT, description: 'GLSL fragment code body; set vec3 col', multiline: true },
    noteAmpInfluence: { type: 'number', min: 0, max: 1, step: 0.01, default: 1.0, description: 'Scale note color by amplitude', group: 'Note Response', presets: ['Plasma','MultiNoteScribbles','CymaticsRadialModes','CymaticsNoteModes','CymaticsSpiralNodes','CymaticsDualSource','CymaticsPolarLissajous','FisheyeDistort','BumpySphereAudio','PlotNotesScatter','PlotNotesSmear'] },
    octaveBrightness: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.9, description: 'Brighten color with higher pitch', group: 'Note Response', presets: ['Plasma','MultiNoteScribbles','CymaticsRadialModes','CymaticsNoteModes','CymaticsSpiralNodes','CymaticsDualSource','CymaticsPolarLissajous','FisheyeDistort','BumpySphereAudio','PlotNotesScatter','PlotNotesSmear'] },
    noteThreshold: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.08, description: 'Minimum note amplitude to render blips', group: 'Note Response', presets: ['Plasma','MultiNoteScribbles','CymaticsRadialModes','CymaticsNoteModes','CymaticsSpiralNodes','CymaticsDualSource','CymaticsPolarLissajous','FisheyeDistort','BumpySphereAudio','PlotNotesScatter','PlotNotesSmear'] },
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
    fragment: DEFAULT_FRAGMENT,
    // preset removed from UI; fragment only
    noteAmpInfluence: 1.0,
    octaveBrightness: 0.9,
    noteThreshold: 0.08,
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
  },
  Component: ShaderLabImpl as any,
};


