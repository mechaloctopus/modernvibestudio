import React from 'react';

// Minimal WebGL fragment shader renderer for web (React 19 compatible)
// Renders a full-screen quad and applies provided uniforms

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || 'Unknown shader compile error';
    gl.deleteShader(shader);
    throw new Error(info);
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext, vertSrc: string, fragSrc: string): WebGLProgram {
  const vs = createShader(gl, gl.VERTEX_SHADER, vertSrc);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || 'Unknown program link error';
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    throw new Error(info);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return program;
}

function isArrayLike(v: any): v is number[] | Float32Array { return Array.isArray(v) || v instanceof Float32Array; }

type Props = {
  fragmentSource: string;
  fallbackFragmentSource?: string;
  uniforms: Record<string, number | number[] | Float32Array>;
  clearColor?: [number, number, number, number];
};

export const WebGLFragment: React.FC<Props> = ({ fragmentSource, fallbackFragmentSource, uniforms, clearColor = [0, 0, 0, 1] }) => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const glRef = React.useRef<WebGLRenderingContext | null>(null);
  const programRef = React.useRef<WebGLProgram | null>(null);
  const attribLocRef = React.useRef<number>(-1);
  const uniformLocationsRef = React.useRef<Record<string, WebGLUniformLocation | null>>({});
  const currentFragRef = React.useRef<string>('');
  const vboRef = React.useRef<WebGLBuffer | null>(null);

  const vertexSource = React.useMemo(() => `
attribute vec2 a_pos;
varying vec2 uv;
void main(){
  uv = (a_pos + 1.0) * 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`, []);

  const setupGL = React.useCallback((gl: WebGLRenderingContext) => {
    // Create a static fullscreen quad
    const verts = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]);
    const vbo = gl.createBuffer();
    if (!vbo) throw new Error('Failed to create buffer');
    vboRef.current = vbo;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  }, []);

  const compileAndLink = React.useCallback((gl: WebGLRenderingContext, frag: string): WebGLProgram => {
    const prog = createProgram(gl, vertexSource, frag);
    gl.useProgram(prog);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    attribLocRef.current = loc;
    gl.bindBuffer(gl.ARRAY_BUFFER, vboRef.current);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    // Cache uniform locations
    const uniformNames = Object.keys(uniforms);
    const map: Record<string, WebGLUniformLocation | null> = {};
    for (const name of uniformNames) {
      map[name] = gl.getUniformLocation(prog, name);
    }
    uniformLocationsRef.current = map;
    return prog;
  }, [uniforms, vertexSource]);

  const ensureGL = React.useCallback(() => {
    const canvas = canvasRef.current!;
    let gl = glRef.current;
    if (!gl) {
      gl = (canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: false }) as WebGLRenderingContext);
      if (!gl) throw new Error('WebGL not supported');
      glRef.current = gl;
      setupGL(gl);
    }
    return gl;
  }, [setupGL]);

  const setUniform = React.useCallback((gl: WebGLRenderingContext, name: string, value: number | number[] | Float32Array) => {
    const loc = uniformLocationsRef.current[name];
    if (!loc) return;
    if (typeof value === 'number') {
      gl.uniform1f(loc, value);
    } else if (isArrayLike(value)) {
      const len = value.length;
      if (len === 2) gl.uniform2f(loc, (value as any)[0], (value as any)[1]);
      else if (len === 3) gl.uniform3f(loc, (value as any)[0], (value as any)[1], (value as any)[2]);
      else if (len === 4) gl.uniform4f(loc, (value as any)[0], (value as any)[1], (value as any)[2], (value as any)[3]);
    }
  }, []);

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current!;
    const gl = ensureGL();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Update uniforms
    for (const [k, v] of Object.entries(uniforms)) setUniform(gl, k, v as any);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, [clearColor, ensureGL, setUniform, uniforms]);

  // Resize handler
  React.useEffect(() => {
    function resize() {
      const canvas = canvasRef.current!;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
      }
      draw();
    }
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [draw]);

  // Compile program when fragmentSource changes
  React.useEffect(() => {
    const gl = ensureGL();
    if (currentFragRef.current === fragmentSource && programRef.current) {
      draw();
      return;
    }
    // Recreate program
    if (programRef.current) {
      gl.deleteProgram(programRef.current);
      programRef.current = null;
    }
    try {
      const prog = compileAndLink(gl, fragmentSource);
      programRef.current = prog;
      currentFragRef.current = fragmentSource;
      draw();
    } catch (e) {
      if (fallbackFragmentSource) {
        try {
          const prog = compileAndLink(gl, fallbackFragmentSource);
          programRef.current = prog;
          currentFragRef.current = fallbackFragmentSource;
          draw();
        } catch (e2) {
          // eslint-disable-next-line no-console
          console.error('Fragment compile failed (including fallback):', e2);
        }
      } else {
        // eslint-disable-next-line no-console
        console.error('Fragment compile failed:', e);
      }
    }
  }, [compileAndLink, draw, ensureGL, fallbackFragmentSource, fragmentSource]);

  // Redraw on uniform updates
  React.useEffect(() => { draw(); }, [uniforms, draw]);

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />;
};

