import React from 'react';
import type { MPGraph, MPNode, Channel, MPUniforms } from '../visualizers/shaderlab/multipass/types';

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const sh = gl.createShader(type)!; gl.shaderSource(sh, source); gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { const info = gl.getShaderInfoLog(sh) || 'shader compile error'; gl.deleteShader(sh); throw new Error(info); }
  return sh;
}
function createProgram(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()!; const v = createShader(gl, gl.VERTEX_SHADER, vs); const f = createShader(gl, gl.FRAGMENT_SHADER, fs);
  gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { const info = gl.getProgramInfoLog(p) || 'program link error'; gl.deleteProgram(p); gl.deleteShader(v); gl.deleteShader(f); throw new Error(info); }
  gl.deleteShader(v); gl.deleteShader(f); return p;
}

const VERT = `
attribute vec2 a_pos; varying vec2 uv;
void main(){ uv=(a_pos+1.0)*0.5; gl_Position=vec4(a_pos,0.0,1.0); }
`;

function buildFrag(body: string, extraDecl: string = ''): string {
  return `#ifdef GL_ES\nprecision highp float; precision highp int;\n#endif\nvarying vec2 uv;\nuniform vec2 u_res;\nuniform float u_time;\n// Shadertoy compatibility
uniform vec3 iResolution; uniform float iTime; uniform int iFrame;\nuniform sampler2D iChannel0; uniform sampler2D iChannel1; uniform sampler2D iChannel2; uniform sampler2D iChannel3;\n${extraDecl}\n// helpers
float hash12(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }\nvoid main(){ vec3 col=vec3(0.0); vec2 p=uv; ${body} gl_FragColor=vec4(clamp(col,0.0,1.0),1.0); }`;
}

function topoSort(nodes: MPNode[]): MPNode[] {
  const inDeg = new Map<string, number>(); const map = new Map(nodes.map(n => [n.id, n]));
  nodes.forEach(n => inDeg.set(n.id, 0));
  nodes.forEach(n => (n.iChannels||[]).forEach((ch) => { if (ch && ch.kind==='pass') inDeg.set(n.id, (inDeg.get(n.id)||0)+1); }));
  const q: MPNode[] = []; inDeg.forEach((d,k)=>{ if(d===0) q.push(map.get(k)!); });
  const out: MPNode[] = [];
  while(q.length){ const n = q.shift()!; out.push(n); (n.iChannels||[]).forEach(ch=>{ if(ch&&ch.kind==='pass'){ const dep = map.get(ch.id); if(dep){ const d=inDeg.get(dep.id)!-1; inDeg.set(dep.id, d); if(d===0) q.push(dep); } } }); }
  // fallback: if cycle (self-feedback), keep original order
  if (out.length !== nodes.length) return nodes.slice();
  return out;
}

function makeTex(gl: WebGLRenderingContext, width: number, height: number, filter: number = gl.LINEAR): WebGLTexture {
  const tex = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  return tex;
}

function makeFbo(gl: WebGLRenderingContext, width: number, height: number){
  const fbo = gl.createFramebuffer()!; const tex = makeTex(gl, width, height);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, tex };
}

export type MPProps = {
  graph: MPGraph;
  uniforms: MPUniforms;
  clearColor?: [number,number,number,number];
  renderScale?: number;
  maxFPS?: number;
  onError?: (e:any)=>void;
};

export const WebGLMultipass: React.FC<MPProps> = ({ graph, uniforms, clearColor=[0,0,0,1], renderScale=1, maxFPS=60, onError }) => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const glRef = React.useRef<WebGLRenderingContext | null>(null);
  const quadRef = React.useRef<WebGLBuffer | null>(null);
  const progsRef = React.useRef<Map<string, WebGLProgram>>(new Map());
  const attribLocRef = React.useRef<number>(-1);
  const locsRef = React.useRef<Map<string, Record<string, WebGLUniformLocation | null>>>(new Map());
  const fbosRef = React.useRef<Map<string, { front: {fbo: WebGLFramebuffer|null, tex: WebGLTexture}, back?: {fbo: WebGLFramebuffer|null, tex: WebGLTexture} }>>(new Map());
  const lastDrawRef = React.useRef(0);
  const frameIntervalRef = React.useRef(1000 / Math.max(1, Math.min(240, maxFPS)));
  const frameCountRef = React.useRef(0);
  React.useEffect(()=>{ frameIntervalRef.current = 1000 / Math.max(1, Math.min(240, maxFPS)); }, [maxFPS]);

  const ensureGL = React.useCallback(() => {
    const canvas = canvasRef.current!; let gl = glRef.current;
    if (!gl) { gl = (canvas.getContext('webgl', { antialias:false, preserveDrawingBuffer:false }) as WebGLRenderingContext); if(!gl) throw new Error('WebGL not supported'); glRef.current = gl; }
    if (!quadRef.current) {
      const vbo = gl.createBuffer(); if(!vbo) throw new Error('VBO fail'); quadRef.current = vbo;
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([ -1,-1, 1,-1, -1,1, 1,1 ]), gl.STATIC_DRAW);
    }
    return gl;
  }, []);

  const compileAll = React.useCallback((gl: WebGLRenderingContext, width: number, height: number) => {
    progsRef.current.forEach(p => gl.deleteProgram(p)); progsRef.current.clear(); locsRef.current.clear();
    fbosRef.current.forEach(v => { gl.deleteFramebuffer(v.front.fbo); gl.deleteTexture(v.front.tex); if (v.back){ gl.deleteFramebuffer(v.back.fbo); gl.deleteTexture(v.back.tex); } });
    fbosRef.current.clear();
    const nodes = graph.nodes;
    for (const n of nodes){
      const frag = buildFrag(n.body, '');
      const prog = createProgram(gl, VERT, frag);
      progsRef.current.set(n.id, prog);
      gl.useProgram(prog);
      const loc = gl.getAttribLocation(prog, 'a_pos'); attribLocRef.current = loc;
      gl.bindBuffer(gl.ARRAY_BUFFER, quadRef.current); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const locs: Record<string, WebGLUniformLocation | null> = {
        u_res: gl.getUniformLocation(prog, 'u_res'),
        u_time: gl.getUniformLocation(prog, 'u_time'),
        iResolution: gl.getUniformLocation(prog, 'iResolution'),
        iTime: gl.getUniformLocation(prog, 'iTime'),
        iFrame: gl.getUniformLocation(prog, 'iFrame'),
        iChannel0: gl.getUniformLocation(prog, 'iChannel0'),
        iChannel1: gl.getUniformLocation(prog, 'iChannel1'),
        iChannel2: gl.getUniformLocation(prog, 'iChannel2'),
        iChannel3: gl.getUniformLocation(prog, 'iChannel3'),
      };
      locsRef.current.set(n.id, locs);
      if (n.kind === 'buffer'){
        const a = makeFbo(gl, width, height); const store: any = { front: a };
        if (n.pingpong) { const b = makeFbo(gl, width, height); store.back = b; }
        fbosRef.current.set(n.id, store);
      }
    }
  }, [graph]);

  const bindChannel = (gl: WebGLRenderingContext, passId: string, unit: number, ch: Channel | undefined | null) => {
    if (!ch) return;
    const locs = locsRef.current.get(passId)!; const texUnit = gl.TEXTURE0 + unit; gl.activeTexture(texUnit);
    if (ch.kind === 'pass') {
      const f = fbosRef.current.get(ch.id); if (!f) return; const tex = f.front.tex; gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i((locs as any)[`iChannel${unit}`], unit);
    } else if (ch.kind === 'texture') {
      // simple builtin textures
      const key = `__builtin_${ch.builtin||'checker'}`; let tex = (gl as any)[key] as WebGLTexture | undefined;
      if (!tex){ tex = gl.createTexture()!; (gl as any)[key] = tex; gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const W=128,H=128; const data = new Uint8Array(W*H*4);
        for(let y=0;y<H;y++){ for(let x=0;x<W;x++){ const i=(y*W+x)*4; const c = (((x>>4)&1) ^ ((y>>4)&1))?200:50; data[i]=c; data[i+1]=c; data[i+2]=c; data[i+3]=255; } }
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,128,128,0,gl.RGBA,gl.UNSIGNED_BYTE,data);
      } else { gl.bindTexture(gl.TEXTURE_2D, tex); }
      gl.uniform1i((locs as any)[`iChannel${unit}`], unit);
    } else if (ch.kind === 'audio') {
      // build/update a tiny 256x1 spectrum or 1x1 rms tex from provided uniforms (best-effort for smoke test)
      const key = ch.source==='spectrum' ? '__audio_spec' : '__audio_rms'; let tex = (gl as any)[key] as WebGLTexture | undefined;
      const W = ch.source==='spectrum' ? 256 : 1; const H = 1; const data = new Uint8Array(W*H*4);
      // fill from uniforms if available (u_low/mid/high); otherwise low noise
      const u_low = Number((uniforms as any).u_low||0)*255|0; const u_mid = Number((uniforms as any).u_mid||0)*255|0; const u_high = Number((uniforms as any).u_high||0)*255|0;
      for(let x=0;x<W;x++){ const i=x*4; if (ch.source==='spectrum'){ const t = x/255; const val = (t<0.33?u_low:(t<0.66?u_mid:u_high)); data[i]=val; data[i+1]=val; data[i+2]=val; data[i+3]=255; } else { data[i]=u_low; data[i+1]=u_mid; data[i+2]=u_high; data[i+3]=255; } }
      if (!tex){ tex = gl.createTexture()!; (gl as any)[key]=tex; gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,W,H,0,gl.RGBA,gl.UNSIGNED_BYTE,data);
      } else { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,W,H,0,gl.RGBA,gl.UNSIGNED_BYTE,data); }
      gl.uniform1i((locs as any)[`iChannel${unit}`], unit);
    }
  };

  const draw = React.useCallback(() => {
    const now = typeof performance!=='undefined'?performance.now():Date.now(); if(now - lastDrawRef.current < frameIntervalRef.current) return; lastDrawRef.current = now;
    const canvas = canvasRef.current!; const gl = ensureGL(); const R = [canvas.width, canvas.height] as const;
    gl.viewport(0,0,canvas.width,canvas.height); gl.clearColor(clearColor[0],clearColor[1],clearColor[2],clearColor[3]); gl.clear(gl.COLOR_BUFFER_BIT);
    const order = topoSort(graph.nodes);
    for (const n of order){
      const prog = progsRef.current.get(n.id)!; const locs = locsRef.current.get(n.id)!; gl.useProgram(prog);
      // common uniforms
      gl.uniform2f(locs.u_res, R[0], R[1]); gl.uniform3f(locs.iResolution, R[0], R[1], 1.0);
      const tsec = (now/1000); gl.uniform1f(locs.u_time, tsec); gl.uniform1f(locs.iTime, tsec);
      gl.uniform1i(locs.iFrame, frameCountRef.current);
      // bind channels
      const chs: Channel[] = (n.iChannels as any) || [];
      for (let k=0;k<4;k++){ bindChannel(gl, n.id, k, chs[k]||null); }
      if (n.kind === 'buffer'){
        const fb = fbosRef.current.get(n.id)!; gl.bindFramebuffer(gl.FRAMEBUFFER, fb.front.fbo);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        // ping-pong swap
        if (n.pingpong && fb.back){ const tmp = fb.front; fb.front = fb.back; fb.back = tmp; }
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }
    frameCountRef.current++;
  }, [bindChannel, clearColor, ensureGL, graph.nodes]);

  // handle resize
  React.useEffect(() => {
    function resize(){ const canvas = canvasRef.current!; const baseDpr = Math.min(window.devicePixelRatio||1, 2); const scale = Math.max(0.3, Math.min(1, renderScale||1)); const dpr = baseDpr*scale; const w=Math.floor(window.innerWidth*dpr), h=Math.floor(window.innerHeight*dpr); if(canvas.width!==w||canvas.height!==h){ canvas.width=w; canvas.height=h; canvas.style.width=`${window.innerWidth}px`; canvas.style.height=`${window.innerHeight}px`; const gl=ensureGL(); try{ compileAll(gl,w,h); } catch(e){ onError?.(e); } } draw(); }
    resize(); window.addEventListener('resize', resize); return ()=> window.removeEventListener('resize', resize);
  }, [compileAll, draw, ensureGL, onError, renderScale]);

  // compile on graph change
  React.useEffect(() => {
    const canvas = canvasRef.current!; const gl = ensureGL(); try { compileAll(gl, canvas.width||1280, canvas.height||720); } catch(e){ onError?.(e); }
  }, [compileAll, ensureGL, graph]);

  // continuous loop
  React.useEffect(()=>{ let raf=0; const loop=()=>{ draw(); raf=requestAnimationFrame(loop); }; raf=requestAnimationFrame(loop); return ()=> cancelAnimationFrame(raf); }, [draw, maxFPS]);

  return <canvas ref={canvasRef} style={{ position:'absolute', inset: 0 }} />;
};

