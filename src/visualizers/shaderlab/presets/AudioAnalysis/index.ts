import type { PresetModule } from "../../core/types";

const schema = {
  brightness: { type: 'number', min: 0, max: 2, step: 0.01, default: 1.0, description: 'Overall brightness' },
  gridOpacity: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.15, description: 'Background grid opacity' },
} as const;

type Params = { [K in keyof typeof schema]: number };

const buildFragment = (_params: Params) => `
// Physics-Based Audio Analysis: bands, notes, RMS, onset, pitch class & octave views
vec2 R = u_res; vec2 q = p - 0.5; q.x *= R.x / max(R.y, 1.0);
col = vec3(0.02,0.02,0.03);

// helper: draw rect at pos (min,max) with soft edge
float rect(vec2 uv, vec2 mn, vec2 mx, float soft){
  float gx = smoothstep(mn.x, mn.x+soft, uv.x) * (1.0 - smoothstep(mx.x-soft, mx.x, uv.x));
  float gy = smoothstep(mn.y, mn.y+soft, uv.y) * (1.0 - smoothstep(mx.y-soft, mx.y, uv.y));
  return gx * gy;
}

// Background grid
float grid = (step(0.0, sin((p.x)*R.x*0.02)) * 0.5 + 0.5) * 0.03 + (step(0.0, sin((p.y)*R.y*0.02)) * 0.5 + 0.5) * 0.03;
col += vec3(grid) * u_pm_gridOpacity;

// Layout regions (0..1)
// Left column: Frequency Bands (top), RMS/Onset (bottom)
// Right column: Pitch Class ring (top), Octave bars (bottom)

// 1) Bands (16) as vertical bars
{
  vec2 mn = vec2(0.05, 0.55), mx = vec2(0.48, 0.95);
  float w = (mx.x - mn.x) / 16.0;
  for (int i=0; i<16; i++){
    float x0 = mn.x + (float(i)+0.1)*w;
    float x1 = x0 + w*0.8;
    float a = clamp(band(i), 0.0, 1.0);
    float y0 = mn.y; float y1 = mix(mn.y, mx.y, pow(a, 0.85));
    float b = rect(p, vec2(x0, y0), vec2(x1, y1), 0.002);
    vec3 c = mix(vec3(0.15,0.18,0.22), vec3(0.65,0.9,1.0), a);
    col += c * b;
  }
}

// 2) RMS/Onset gauges
{
  vec2 mn = vec2(0.05, 0.08), mx = vec2(0.48, 0.48);
  // RMS bar
  float y = mix(mn.y, mx.y, clamp(u_amp, 0.0, 1.0));
  float bar = rect(p, vec2(mn.x, mn.y), vec2(mn.x + 0.04, y), 0.002);
  col += vec3(0.9, 0.8, 0.6) * bar * 0.9;
  // Onset flash indicator (ring)
  vec2 ctr = mix(mn, mx, vec2(0.7, 0.6));
  float r0 = 0.06, r1 = r0 + 0.02 + 0.08*u_onset;
  float d = distance(p, ctr);
  float ring = smoothstep(r1, r1-0.01, d) * (1.0 - smoothstep(r0, r0+0.01, d));
  col += vec3(1.0,0.6,0.4) * ring * (0.3 + 0.7*clamp(u_onset,0.0,1.0));
}

// 3) Pitch Class activity ring (top-right)
{
  vec2 C = vec2(0.74, 0.74);
  float Rr = 0.20; float soft = 0.01;
  for (int pc=0; pc<12; pc++){
    float th = (float(pc)/12.0)*6.28318530718;
    vec2 ctr = C + vec2(cos(th), sin(th))*Rr;
    // aggregate amplitude for this pitch class from top notes
    float a = 0.0;
    for (int k=0; k<4; k++){
      float m = noteAt(k); if (m<0.0) break; int pci=int(mod(floor(m+0.5),12.0));
      float eqpc = (pci == pc) ? 1.0 : 0.0;
      a = max(a, noteAmp(k) * eqpc);
    }
    float r = 0.03 + 0.07*a;
    float d = distance(p, ctr);
    float fill = 1.0 - smoothstep(r, r+soft, d);
    col += toneColor(pc) * fill * (0.4 + 0.6*a);
  }
}

// 4) Octave distribution bars (bottom-right) using top 4 notes
{
  vec2 mn = vec2(0.55, 0.08), mx = vec2(0.95, 0.48);
  // 8 fixed bins without dynamic indexing (WebGL1 safe)
  float b0=0.0,b1=0.0,b2=0.0,b3=0.0,b4=0.0,b5=0.0,b6=0.0,b7=0.0;
  for (int k=0; k<4; k++){
    float m = noteAt(k); if (m<0.0) break; float a = noteAmp(k);
    int oct = int(floor(m/12.0));
    b0 = max(b0, (oct==0)?a:0.0);
    b1 = max(b1, (oct==1)?a:0.0);
    b2 = max(b2, (oct==2)?a:0.0);
    b3 = max(b3, (oct==3)?a:0.0);
    b4 = max(b4, (oct==4)?a:0.0);
    b5 = max(b5, (oct==5)?a:0.0);
    b6 = max(b6, (oct==6)?a:0.0);
    b7 = max(b7, (oct==7)?a:0.0);
  }
  float w = (mx.x - mn.x) / 8.0;
  // draw each bin (unrolled)
  {
    float a = clamp(b0,0.0,1.0); float x0 = mn.x + (0.0+0.1)*w; float x1 = x0 + w*0.8;
    float y0 = mn.y; float y1 = mix(mn.y, mx.y, pow(a, 0.9)); float bb = rect(p, vec2(x0,y0), vec2(x1,y1), 0.002);
    vec3 c = mix(vec3(0.18,0.2,0.24), vec3(0.9,0.85,0.6), a); col += c * bb;
  }
  {
    float a = clamp(b1,0.0,1.0); float x0 = mn.x + (1.0+0.1)*w; float x1 = x0 + w*0.8;
    float y0 = mn.y; float y1 = mix(mn.y, mx.y, pow(a, 0.9)); float bb = rect(p, vec2(x0,y0), vec2(x1,y1), 0.002);
    vec3 c = mix(vec3(0.18,0.2,0.24), vec3(0.9,0.85,0.6), a); col += c * bb;
  }
  {
    float a = clamp(b2,0.0,1.0); float x0 = mn.x + (2.0+0.1)*w; float x1 = x0 + w*0.8;
    float y0 = mn.y; float y1 = mix(mn.y, mx.y, pow(a, 0.9)); float bb = rect(p, vec2(x0,y0), vec2(x1,y1), 0.002);
    vec3 c = mix(vec3(0.18,0.2,0.24), vec3(0.9,0.85,0.6), a); col += c * bb;
  }
  {
    float a = clamp(b3,0.0,1.0); float x0 = mn.x + (3.0+0.1)*w; float x1 = x0 + w*0.8;
    float y0 = mn.y; float y1 = mix(mn.y, mx.y, pow(a, 0.9)); float bb = rect(p, vec2(x0,y0), vec2(x1,y1), 0.002);
    vec3 c = mix(vec3(0.18,0.2,0.24), vec3(0.9,0.85,0.6), a); col += c * bb;
  }
  {
    float a = clamp(b4,0.0,1.0); float x0 = mn.x + (4.0+0.1)*w; float x1 = x0 + w*0.8;
    float y0 = mn.y; float y1 = mix(mn.y, mx.y, pow(a, 0.9)); float bb = rect(p, vec2(x0,y0), vec2(x1,y1), 0.002);
    vec3 c = mix(vec3(0.18,0.2,0.24), vec3(0.9,0.85,0.6), a); col += c * bb;
  }
  {
    float a = clamp(b5,0.0,1.0); float x0 = mn.x + (5.0+0.1)*w; float x1 = x0 + w*0.8;
    float y0 = mn.y; float y1 = mix(mn.y, mx.y, pow(a, 0.9)); float bb = rect(p, vec2(x0,y0), vec2(x1,y1), 0.002);
    vec3 c = mix(vec3(0.18,0.2,0.24), vec3(0.9,0.85,0.6), a); col += c * bb;
  }
  {
    float a = clamp(b6,0.0,1.0); float x0 = mn.x + (6.0+0.1)*w; float x1 = x0 + w*0.8;
    float y0 = mn.y; float y1 = mix(mn.y, mx.y, pow(a, 0.9)); float bb = rect(p, vec2(x0,y0), vec2(x1,y1), 0.002);
    vec3 c = mix(vec3(0.18,0.2,0.24), vec3(0.9,0.85,0.6), a); col += c * bb;
  }
  {
    float a = clamp(b7,0.0,1.0); float x0 = mn.x + (7.0+0.1)*w; float x1 = x0 + w*0.8;
    float y0 = mn.y; float y1 = mix(mn.y, mx.y, pow(a, 0.9)); float bb = rect(p, vec2(x0,y0), vec2(x1,y1), 0.002);
    vec3 c = mix(vec3(0.18,0.2,0.24), vec3(0.9,0.85,0.6), a); col += c * bb;
  }
}

// Overlay small note markers with confidence (amp)
{
  for (int k=0;k<4;k++){
    float m = noteAt(k); if (m<0.0) break; float a = noteAmp(k);
    float th = (mod(floor(m+0.5), 12.0)/12.0) * 6.28318530718;
    vec2 C = vec2(0.74, 0.74);
    float Rr = 0.20;
    vec2 ctr = C + vec2(cos(th), sin(th)) * (Rr + 0.12);
    float r = 0.012 + 0.04*a;
    float d = distance(p, ctr);
    float fill = 1.0 - smoothstep(r, r+0.01, d);
    col += noteColor(m) * fill * (0.6 + 0.6*a);
  }
}

col *= u_pm_brightness;
`;

export const AudioAnalysisPreset: PresetModule = {
  id: 'AudioAnalysis',
  title: 'Physics-Based Audio Analysis',
  schema: schema as any,
  defaults: { brightness: 1.0, gridOpacity: 0.15 },
  buildFragment: buildFragment as any,
};

export default AudioAnalysisPreset;

