import React from 'react';
import { Platform } from 'react-native';
import Registry from '../visualizers/shaderlab/core/registry';
import { WebGLFragment } from '../ui/WebGLFragment';
import { WebGLMultipass } from '../ui/WebGLMultipass';
import { ENABLE_MULTIPASS } from '../config/featureFlags';
import type { MPGraph } from '../visualizers/shaderlab/multipass/types';

function buildShaderSourceHarness(userBody: string, extraUniformDecl: string = ""): string {
  return `#ifdef GL_ES\nprecision highp float;\nprecision highp int;\n#endif\n\nvarying vec2 uv;\nuniform vec2 u_res;\nuniform float u_time, u_amp, u_centroid, u_note;\nuniform float u_low, u_mid, u_high, u_onset;\nuniform float u_themeB, u_themeS;\nuniform vec4 u_bands0, u_bands1, u_bands2, u_bands3;\nuniform vec4 u_pitchR0, u_pitchR1, u_pitchR2;\nuniform vec4 u_pitchG0, u_pitchG1, u_pitchG2;\nuniform vec4 u_pitchB0, u_pitchB1, u_pitchB2;\nuniform vec4 u_notesA;\nuniform vec4 u_notesAmpA;\nuniform float u_petals;\nuniform float u_ripple;\nuniform float u_speed;\nuniform float u_zoom;\nuniform float u_detail;\nuniform float u_intensity;\nuniform float u_angle;\nuniform float u_hueShift;\nuniform float u_noteAmpInfluence;\nuniform float u_octaveBrightness;\nuniform float u_noteThreshold;\nuniform float u_blipSize;\nuniform float u_plasmaFocus;\nuniform float u_plasmaSwirl;\nuniform float u_plasmaBandLow;\nuniform float u_plasmaBandMid;\nuniform float u_plasmaBandHigh;\nuniform float u_density;\nuniform float u_nodeSharpness;\nuniform float u_bandBalance;\nuniform float u_harmonicFog;\nuniform float u_plasmaToneBlend;\nuniform float u_plasmaNoteDrive;\nuniform float u_plasmaContrast;\nuniform float u_plasmaScaleX;\nuniform float u_plasmaScaleY;\nuniform float u_plasmaGlow;\nuniform float u_plasmaWarp;\nuniform float u_smearWidth;\nuniform float u_dripSpeed;\nuniform float u_smearDecay;\nuniform float u_smearJitter;\nuniform float u_fisheyeStrength;\nuniform float u_shockWidth;\nuniform float u_shockSpeed;\nuniform float u_shockMix;\nuniform float u_bumpAmount;\nuniform float u_light;\nuniform float u_surfaceA;\nuniform float u_surfaceB;\nuniform float u_surfaceMix;\nuniform float u_gridOpacity;\nuniform float u_groupTintMix;\nuniform float u_trailThickness;\nuniform float u_trailLength;\nuniform float u_turnRate;\nuniform float u_zParallax;\nuniform float u_randomness;\nuniform float u_snakeSpeed;\nuniform float u_trailGlow;\nuniform float u_quality;\nfloat pick4(vec4 v, int i){\n  if(i==0) return v.x;\n  if(i==1) return v.y;\n  if(i==2) return v.z;\n  return v.w;\n}\nfloat band(int i){\n  if(i<4) return pick4(u_bands0, i);\n  else if(i<8) return pick4(u_bands1, i-4);\n  else if(i<12) return pick4(u_bands2, i-8);\n  else return pick4(u_bands3, i-12);\n}\nfloat samplePitch(in vec4 a0,in vec4 a1,in vec4 a2, int i){\n  if(i<4) return pick4(a0, i);\n  else if(i<8) return pick4(a1, i-4);\n  else return pick4(a2, i-8);\n}\nint wrap12(int k){\n  return int(mod(float(k), 12.0));\n}\nvec3 toneColor(int idx){\n  int i = wrap12(idx);\n  float r = samplePitch(u_pitchR0,u_pitchR1,u_pitchR2,i);\n  float g = samplePitch(u_pitchG0,u_pitchG1,u_pitchG2,i);\n  float b = samplePitch(u_pitchB0,u_pitchB1,u_pitchB2,i);\n  vec3 c = vec3(r,g,b);\n  c = mix(vec3(0.0), c, u_themeS);\n  c *= u_themeB;\n  return c;\n}\nvec3 noteColor(float midi){\n  int idx = int(floor(midi+0.5));\n  vec3 nc = toneColor(idx);\n  float bright = clamp((midi - 36.0)/60.0, 0.0, 1.0) * u_octaveBrightness;\n  return mix(nc, vec3(1.0), bright*0.35);\n}\nfloat noteAt(int i){ return pick4(u_notesA, i); }\nfloat noteAmp(int i){ return pick4(u_notesAmpA, i); }\n// Sanity uniforms\nuniform float u_sanityBrightness;\nuniform float u_sanityTintStrength;\nuniform float u_sanityFloor;\n\n${extraUniformDecl}\n// Shared helpers\nmat2 r2(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }\nmat2 Rm(float a){ return r2(a); }\nfloat hash12(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }\nfloat noise(vec2 p){ vec2 i=floor(p), f=fract(p); float a=hash12(i), b=hash12(i+vec2(1.0,0.0)); float c=hash12(i+vec2(0.0,1.0)), d=hash12(i+vec2(1.0,1.0)); vec2 u=f*f*(3.0-2.0*f); return mix(mix(a,b,u.x), mix(c,d,u.x), u.y); }\n\nvoid main(){\n  vec3 col = vec3(0.0);\n  vec2 p = uv;\n  ${userBody}\n  vec3 finalCol = max(col, vec3(u_sanityFloor)) * (0.5 + 0.5*u_sanityBrightness);\n  gl_FragColor = vec4(clamp(finalCol,0.0,1.0), 1.0);\n}`;
}

function defaultUniforms(): Record<string, number | number[] | Float32Array> {
  const zeros4: [number, number, number, number] = [0,0,0,0];
  const u: Record<string, number | number[] | Float32Array> = {
    u_res: [1280, 720],
    u_time: 0,
    u_amp: 0.2,
    u_centroid: 0,
    u_note: -1,
    u_low: 0,
    u_mid: 0,
    u_high: 0,
    u_onset: 0,
    u_themeB: 1,
    u_themeS: 1,
    u_bands0: zeros4,
    u_bands1: zeros4,
    u_bands2: zeros4,
    u_bands3: zeros4,
    u_pitchR0: zeros4, u_pitchR1: zeros4, u_pitchR2: zeros4,
    u_pitchG0: zeros4, u_pitchG1: zeros4, u_pitchG2: zeros4,
    u_pitchB0: zeros4, u_pitchB1: zeros4, u_pitchB2: zeros4,
    u_notesA: [-1,-1,-1,-1],
    u_notesAmpA: [0,0,0,0],
    u_petals: 0, u_ripple: 0, u_speed: 1, u_zoom: 1, u_detail: 0.5, u_intensity: 1, u_angle: 0,
    u_hueShift: 0, u_noteAmpInfluence: 0.5, u_octaveBrightness: 0.8, u_noteThreshold: 0.1, u_blipSize: 0.5,
    u_plasmaFocus: 0.5, u_plasmaSwirl: 0.0, u_plasmaBandLow: 0.0, u_plasmaBandMid: 0.0, u_plasmaBandHigh: 0.0,
    u_density: 1.0, u_nodeSharpness: 0.5, u_bandBalance: 0.0, u_harmonicFog: 0.0,
    u_plasmaToneBlend: 0.0, u_plasmaNoteDrive: 0.0, u_plasmaContrast: 0.0,
    u_plasmaScaleX: 1.0, u_plasmaScaleY: 1.0, u_plasmaGlow: 0.0, u_plasmaWarp: 0.0,
    u_smearWidth: 0.0, u_dripSpeed: 0.0, u_smearDecay: 0.0, u_smearJitter: 0.0,
    u_fisheyeStrength: 0.0, u_shockWidth: 0.0, u_shockSpeed: 0.0, u_shockMix: 0.0,
    u_bumpAmount: 0.0, u_light: 1.0, u_surfaceA: 0.0, u_surfaceB: 0.0, u_surfaceMix: 0.0,
    u_gridOpacity: 0.0, u_groupTintMix: 0.0, u_trailThickness: 0.5, u_trailLength: 0.5, u_turnRate: 0.5,
    u_zParallax: 0.0, u_randomness: 0.0, u_snakeSpeed: 0.5, u_trailGlow: 0.0, u_quality: 1.0,
    u_sanityBrightness: 1.0, u_sanityTintStrength: 0.0, u_sanityFloor: 0.0,
  };
  return u;
}

function sampleGraphs(): MPGraph[] {
  // Graph 1: Buffer A plasma -> Image samples A
  const graph1: MPGraph = {
    nodes: [
      { id: 'A', kind: 'buffer', body: `vec2 q=(p-0.5)*2.0; float t=u_time; float v=sin(q.x*6.0+t)*cos(q.y*6.0-t); col = 0.5+0.5*cos(6.2831*(vec3(0.3,0.6,0.9)*v));`, iChannels: [] },
      { id: 'Image', kind: 'image', body: `vec3 tex = texture2D(iChannel0, p).rgb; col = tex;`, iChannels: [{kind:'pass', id:'A'}, null, null, null] }
    ]
  };
  // Graph 2: Feedback ping-pong on A (self iChannel0) -> Image shows A
  const graph2: MPGraph = {
    nodes: [
      { id: 'A', kind: 'buffer', pingpong: true, body: `vec2 uv2=p; vec3 prev = texture2D(iChannel0, uv2 + vec2(0.002*sin(u_time),0.0)).rgb; vec3 add = vec3(0.02,0.01,0.03) + vec3(u_low,u_mid,u_high)*0.02; col = clamp(prev*0.985 + add, 0.0, 1.0);`, iChannels: [{kind:'pass', id:'A'}, {kind:'audio', source:'spectrum'}, null, null] },
      { id: 'Image', kind: 'image', body: `col = texture2D(iChannel0, p).rgb;`, iChannels: [{kind:'pass', id:'A'}, null, null, null] }
    ]
  };
  // Graph 3: A -> B -> Image chain
  const graph3: MPGraph = {
    nodes: [
      { id: 'A', kind: 'buffer', body: `vec2 q=p-0.5; float v=fbm(q*4.0 + vec2(u_time*0.1, -u_time*0.13)); col = mix(vec3(0.05), vec3(0.2,0.5,0.9), v);`, iChannels: [] },
      { id: 'B', kind: 'buffer', body: `vec3 a = texture2D(iChannel0, p + vec2(0.002*sin(u_time), 0.0)).rgb; col = pow(a, vec3(1.2));`, iChannels: [{kind:'pass', id:'A'}, null, null, null] },
      { id: 'Image', kind: 'image', body: `col = texture2D(iChannel0, p).rgb;`, iChannels: [{kind:'pass', id:'B'}, null, null, null] }
    ]
  };
  return [graph1, graph2, graph3];
}

export const Harness: React.FC = () => {
  const [idx, setIdx] = React.useState(0);
  const [frag, setFrag] = React.useState<string>("");
  const [compileError, setCompileError] = React.useState<string | null>(null);
  const [fps, setFps] = React.useState<number | null>(null);
  const [useMP, setUseMP] = React.useState(false);
  const [mpIdx, setMpIdx] = React.useState(0);
  const rafRef = React.useRef(0);
  const framesRef = React.useRef(0);
  const startRef = React.useRef(0);

  const presets = React.useMemo(() => Registry.all(), []);
  const graphs = React.useMemo(() => sampleGraphs(), []);

  React.useEffect(() => {
    if (useMP) return; // multipass mode drives source via graphs
    if (!presets.length) return;
    const pm = presets[idx % presets.length];
    const body = pm.buildFragment({});
    const src = buildShaderSourceHarness(body);
    setFrag(src);
    setCompileError(null);
    setFps(null);
  }, [idx, presets, useMP]);

  const uniforms = React.useMemo(() => defaultUniforms(), [frag, useMP, mpIdx]);

  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    // Simple FPS counter over ~2 seconds
    cancelAnimationFrame(rafRef.current);
    framesRef.current = 0; startRef.current = performance.now();
    const loop = () => {
      framesRef.current++;
      const dt = performance.now() - startRef.current;
      if (dt >= 2000) { setFps(Math.round(framesRef.current / (dt / 1000))); return; }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [frag, idx, useMP, mpIdx]);

  if (Platform.OS !== 'web') return <></>;

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000', color: '#fff', fontFamily: 'monospace' }}>
      <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
        {!useMP && (
          <>
            <button onClick={() => setIdx((i) => (i - 1 + presets.length) % presets.length)} disabled={!presets.length}>Prev</button>
            <button onClick={() => setIdx((i) => (i + 1) % presets.length)} disabled={!presets.length}>Next</button>
            <span>Preset: {presets[idx % presets.length]?.id || 'n/a'}</span>
          </>
        )}
        {ENABLE_MULTIPASS && (
          <>
            <span style={{marginLeft: 12}}>Multipass:</span>
            <input type="checkbox" checked={useMP} onChange={(e)=> setUseMP(e.target.checked)} />
            {useMP && (
              <>
                <button onClick={() => setMpIdx((i)=>(i-1+graphs.length)%graphs.length)}>MP-Prev</button>
                <button onClick={() => setMpIdx((i)=>(i+1)%graphs.length)}>MP-Next</button>
                <span>Graph: {mpIdx+1}/{graphs.length}</span>
              </>
            )}
          </>
        )}
        <span>| Compile: {compileError ? 'FAIL' : (useMP ? 'MP' : (frag ? 'OK' : '...'))}</span>
        <span>| FPS(2s): {fps ?? '...'}</span>
        {compileError && (
          <button onClick={() => navigator.clipboard?.writeText(compileError || '')}>Copy Error</button>
        )}
      </div>
      {!useMP && frag && (
        <WebGLFragment
          fragmentSource={frag}
          uniforms={uniforms}
          maxFPS={60}
          onCompileError={(e:any)=> setCompileError(String(e?.message||e))}
        />
      )}
      {useMP && ENABLE_MULTIPASS && (
        <WebGLMultipass
          graph={graphs[mpIdx]}
          uniforms={uniforms}
          maxFPS={60}
          onError={(e:any)=> setCompileError(String(e?.message||e))}
        />
      )}
    </div>
  );
};

