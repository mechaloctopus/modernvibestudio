import type { PresetModule } from "../core/types";

const ToroidalPreset: PresetModule = {
  id: "Toroidal",
  title: "Toroidal",
  description: "Wireframe torus with electromagnetic pulse and rotating star tetrahedron overlay; fully audio-reactive.",
  buildFragment: () => `
// Toroidal wireframe with EM pulse and rotating star tetrahedron
// Uses: u_time, u_amp, u_low/u_mid/u_high, band(i), noteAt/noteAmp, toneColor

vec3 acc = vec3(0.0);

// aspect-corrected coords centered
vec2 uv = p - 0.5; uv.x *= u_res.x / max(u_res.y, 1.0);

// camera setup
float t = u_time;
vec3 ro = vec3(0.0, 0.0, 3.0);
vec3 ta = vec3(0.0);
// gentle orbit driven by mids
float yaw = t*0.3*(1.0 + 0.6*u_mid);
float pitch = 0.15*sin(t*0.2) + 0.1*u_low;
mat2 Ry = r2(yaw);
mat2 Rx = r2(pitch);
vec3 fwd = vec3(0.0, 0.0, -1.0);
vec3 right = vec3(1.0, 0.0, 0.0);
vec3 up = vec3(0.0, 1.0, 0.0);
right.xz = (Ry * right.xz);
fwd.xz = (Ry * fwd.xz);
up.yx = (Rx * up.yx);
right.yx = (Rx * right.yx);

vec3 rd = normalize(uv.x*right + uv.y*up + fwd*1.8);

float sdTorus(vec3 p, vec2 t){ vec2 q = vec2(length(p.xz) - t.x, p.y); return length(q) - t.y; }

// edge lines from torus param angles (u around major, v around minor)
float torusGrid(vec3 p, vec2 t, float Nu, float Nv, float thick){
  float u = atan(p.z, p.x);
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  float v = atan(q.y, q.x);
  float lu = abs(sin(u * Nu));
  float lv = abs(sin(v * Nv));
  float lines = smoothstep(thick, 0.0, min(lu, lv));
  return lines;
}

float sdLine(vec2 a, vec2 b, vec2 x){ vec2 pa=x-a, ba=b-a; float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-4),0.0,1.0); return length(pa - ba*h); }

// Project 3D to screen space
vec2 project(vec3 p3){ vec3 d = p3 - ro; float z = max(0.3, dot(d, fwd)); vec3 r = vec3(dot(d,right), dot(d,up), dot(d,fwd)); return (r.xy / z) / 1.8; }

// march scene
vec3 colT = vec3(0.0);
{
  float ql = clamp(u_quality, 0.35, 1.0);
  float iterLim = mix(28.0, 72.0, ql);
  float R = 1.05 + 0.15*sin(t*0.4) + 0.12*u_low; // major radius reacts to bass
  float r = 0.34 + 0.06*(0.6*u_mid + 0.4*u_high); // minor radius reacts to bands
  vec3 pos = ro;
  float tt = 0.0; float glow = 0.0; vec3 glowCol = vec3(0.0);
  for (int i=0; i<80; i++){
    if (float(i) > iterLim) break;
    vec3 p3 = ro + rd * tt;
    float d = sdTorus(p3, vec2(R, r));
    float stepLen = max(0.004, abs(d)*0.7);
    // accumulate wireframe glow when near surface
    float lines = torusGrid(p3, vec2(R, r), 28.0, 18.0, 0.06);
    float g = (0.015 / (abs(d) + 0.002)) * lines;
    // EM pulse: music-driven field
    float em = 0.35 + 0.45*clamp(u_amp,0.0,1.0) + 0.25*(0.5*u_low+0.3*u_mid+0.2*u_high);
    float field = 0.5 + 0.5*cos(3.0*length(p3) - t*2.2*(1.0+0.6*u_mid));
    float cloud = pow(clamp(field,0.0,1.0), 3.0) * em * 0.4;
    vec3 tint = mix(vec3(0.7,0.9,1.0), vec3(u_low,u_mid,u_high), 0.5);
    glowCol += (g*vec3(0.9,0.95,1.0) + cloud*tint) * (0.8 + 0.5*u_high);
    glow += g + cloud*0.2;
    tt += stepLen * mix(1.35, 1.0, ql);
    if (tt > 8.0) break;
  }
  colT = glowCol * (0.8 + 0.6*clamp(u_amp,0.0,1.0));
}

// Rotating star tetrahedron (2D overlay from projected rotating 3D)
vec3 colS = vec3(0.0);
{
  // construct tetrahedron vertices (regular)
  float s3 = 0.5773502691896258; // 1/sqrt(3)
  vec3 V[4];
  V[0] = vec3( s3,  s3,  s3);
  V[1] = vec3(-s3, -s3,  s3);
  V[2] = vec3(-s3,  s3, -s3);
  V[3] = vec3( s3, -s3, -s3);
  // rotate
  float r1 = t*0.6;
  float r2a = t*0.37;
  // apply rotations
  mat2 Rz = r2(r1);
  mat2 Ry2 = r2(r2a);
  for (int i=0;i<4;i++){
    V[i].xy = (Rz * V[i].xy); V[i].xz = (Ry2 * V[i].xz);
  }
  // edges of two tetrahedra (star): connect all pairs with different sign sum
  int E[12][2];
  int idx=0; for (int a=0;a<4;a++){ for (int b=a+1;b<4;b++){ E[idx][0]=a; E[idx][1]=b; idx++; }}
  float glowS = 0.0; vec3 tintS = mix(vec3(0.9,0.95,1.0), vec3(u_low,u_mid,u_high), 0.4);
  float lw = 0.007 + 0.008*clamp(u_high,0.0,1.0);
  vec2 uv2 = uv;
  for (int e=0;e<6;e++){
    vec2 a = project(V[E[e][0]]);
    vec2 b = project(V[E[e][1]]);
    float d = sdLine(a, b, uv2);
    glowS += smoothstep(lw, 0.0, d);
  }
  // second tetrahedron inverted
  for (int i=0;i<4;i++){ V[i] = -V[i]; }
  for (int e=0;e<6;e++){
    vec2 a = project(V[E[e][0]]);
    vec2 b = project(V[E[e][1]]);
    float d = sdLine(a, b, uv2);
    glowS += smoothstep(lw, 0.0, d);
  }
  colS = tintS * glowS * (0.5 + 0.7*clamp(u_amp,0.0,1.0));
}

// combine with subtle note-colored aura
vec3 colN = vec3(0.0);
{
  float sumA = 0.0; vec3 nc = vec3(0.0);
  for (int i=0;i<4;i++){ float m = noteAt(i); if (m<0.0) break; float a = noteAmp(i); nc += noteColor(m) * a; sumA += a; }
  nc /= max(sumA, 1e-3);
  float r = length(uv);
  float aura = smoothstep(0.9, 0.0, r) * sumA * 0.4;
  colN = nc * aura;
}

col = clamp(colT + colS + colN, 0.0, 1.0);
`,
};

export default ToroidalPreset;

