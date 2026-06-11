import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { AudioFrame, ColorMode, VisualMode } from './visualizer/types';

interface VisualizerCanvasProps {
  audioFrameRef: RefObject<AudioFrame>;
  colorMode: ColorMode;
  onFpsChange: (fps: number) => void;
  particleCount: number;
  sensitivity: number;
  visualMode: VisualMode;
}

const modeIds: Record<VisualMode, number> = {
  spectrum: 0,
  oscilloscope: 1,
  radial: 2,
  particles: 3,
  abstract: 4,
};

const colorModeIds: Record<ColorMode, number> = {
  rainbow: 0,
  synthwave: 1,
  phosphor: 2,
  mono: 3,
  ember: 4,
};

const vertexShaderSource = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const fragmentShaderSource = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform sampler2D u_freq;
uniform sampler2D u_wave;
uniform float u_freqSize;
uniform float u_waveSize;
uniform int u_mode;
uniform int u_colorMode;
uniform float u_sensitivity;
uniform float u_particleDensity;
uniform float u_volume;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_beat;

varying vec2 v_uv;

const float PI = 3.141592653589793;

float saturate(float value) {
  return clamp(value, 0.0, 1.0);
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec2 hash22(vec2 p) {
  float n = hash21(p);
  return vec2(n, hash21(p + n + 17.17));
}

float sampleFreq(float phase) {
  float eased = pow(saturate(phase), 1.85);
  float x = (floor(eased * (u_freqSize - 1.0)) + 0.5) / u_freqSize;
  return texture2D(u_freq, vec2(x, 0.5)).r * u_sensitivity;
}

float sampleWave(float phase) {
  float x = (floor(saturate(phase) * (u_waveSize - 1.0)) + 0.5) / u_waveSize;
  return texture2D(u_wave, vec2(x, 0.5)).r;
}

vec3 palette(float phase, float intensity) {
  phase = fract(phase);
  intensity = 0.58 + intensity * 0.62;

  if (u_colorMode == 0) {
    return (0.55 + 0.45 * cos(6.28318 * (phase + vec3(0.0, 0.33, 0.67)))) * intensity;
  }

  vec3 a;
  vec3 b;
  vec3 c;

  if (u_colorMode == 2) {
    a = vec3(0.16, 0.86, 0.31);
    b = vec3(0.72, 1.0, 0.78);
    c = vec3(0.03, 0.32, 0.13);
  } else if (u_colorMode == 3) {
    a = vec3(0.95, 0.97, 1.0);
    b = vec3(0.38, 0.43, 0.50);
    c = vec3(1.0);
  } else if (u_colorMode == 4) {
    a = vec3(1.0, 0.24, 0.12);
    b = vec3(1.0, 0.73, 0.24);
    c = vec3(0.20, 0.92, 0.78);
  } else {
    a = vec3(0.10, 0.88, 1.0);
    b = vec3(1.0, 0.12, 0.84);
    c = vec3(1.0, 0.67, 0.24);
  }

  float sector = phase * 3.0;
  float mixValue = smoothstep(0.0, 1.0, fract(sector));
  vec3 left = sector < 1.0 ? a : sector < 2.0 ? b : c;
  vec3 right = sector < 1.0 ? b : sector < 2.0 ? c : a;
  return mix(left, right, mixValue) * intensity;
}

vec3 background(vec2 uv) {
  vec3 top;
  vec3 mid;
  vec3 bottom;

  if (u_colorMode == 2) {
    top = vec3(0.00, 0.03, 0.01);
    mid = vec3(0.02, 0.08, 0.03);
    bottom = vec3(0.04, 0.12, 0.06);
  } else if (u_colorMode == 3) {
    top = vec3(0.01, 0.02, 0.04);
    mid = vec3(0.06, 0.09, 0.14);
    bottom = vec3(0.02, 0.03, 0.05);
  } else if (u_colorMode == 4) {
    top = vec3(0.06, 0.01, 0.00);
    mid = vec3(0.13, 0.04, 0.02);
    bottom = vec3(0.01, 0.07, 0.05);
  } else {
    top = vec3(0.02, 0.02, 0.07);
    mid = vec3(0.08, 0.02, 0.15);
    bottom = vec3(0.02, 0.10, 0.15);
  }

  vec3 base = mix(bottom, top, uv.y);
  base = mix(base, mid, 0.35 * (1.0 - distance(uv, vec2(0.5)) * 1.4));
  return base;
}

vec3 spectrum(vec2 uv) {
  float skippedBars = 5.0;
  float bars = u_resolution.x < 760.0 ? 48.0 : 72.0;
  float visibleBars = bars - skippedBars;
  float index = floor(uv.x * bars);
  float sampleIndex = index + skippedBars;
  float local = fract(uv.x * bars);
  float energy = sampleFreq(sampleIndex / max(1.0, bars - 1.0));
  float level = saturate(pow(energy, 0.86) + 0.03);
  float body = step(uv.y, level * 0.76 + 0.08);
  float gap = smoothstep(0.08, 0.18, local) * (1.0 - smoothstep(0.82, 0.92, local));
  float peakY = level * 0.76 + 0.105 + u_bass * 0.035;
  float peak = 1.0 - smoothstep(0.0, 0.012, abs(uv.y - peakY));
  vec3 color = palette(index / max(1.0, visibleBars) - u_time * 0.035, level);
  return color * gap * (body * 0.92 + peak * 0.65);
}

vec3 oscilloscope(vec2 uv) {
  float wave = sampleWave(uv.x);
  float y = 0.5 + (wave - 0.5) * (0.74 + u_bass * 0.26) * u_sensitivity;
  float mirroredY = 1.0 - y;
  float line = 1.0 - smoothstep(0.0, 0.012 + u_treble * 0.018, abs(uv.y - y));
  float mirror = 1.0 - smoothstep(0.0, 0.010 + u_treble * 0.014, abs(uv.y - mirroredY));
  vec3 primary = palette(uv.x - u_time * 0.045, 1.0);
  vec3 secondary = palette(uv.x - u_time * 0.045 + 0.18, 0.7);
  return primary * line + secondary * mirror * 0.48;
}

vec3 radial(vec2 uv) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;
  float radius = length(p);
  float angle = fract(atan(p.y, p.x) / (2.0 * PI) + 0.5 + u_time * 0.032);
  float skippedBars = 5.0;
  float bars = u_resolution.x < 760.0 ? 48.0 : 72.0;
  float visibleBars = bars - skippedBars;
  float index = floor(angle * bars);
  float sampleIndex = index + skippedBars;
  float local = fract(angle * bars);
  float phase = sampleIndex / max(1.0, bars - 1.0);

  float energy = sampleFreq(phase);
  float level = saturate(pow(energy, 0.86) + 0.03);
  float inner = 0.21;
  float barHeight = 0.04 + level * 0.58;
  float outer = inner + barHeight;
  float radialBar = smoothstep(inner - 0.005, inner + 0.004, radius) * (1.0 - smoothstep(outer, outer + 0.012, radius));
  float angularBar = smoothstep(0.08, 0.18, local) * (1.0 - smoothstep(0.82, 0.92, local));
  float peak = 1.0 - smoothstep(0.0, 0.010, abs(radius - outer));
  vec3 color = palette(index / max(1.0, visibleBars) - u_time * 0.080, level);
  return color * angularBar * (radialBar * 0.92 + peak * 0.65);
}

vec3 particles(vec2 uv) {
  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = (uv - 0.5) * aspect;
  vec3 total = vec3(0.0);
  float density = mix(10.0, 24.0, saturate(u_particleDensity));
  vec2 grid = vec2(density * aspect.x, density);
  vec2 cell = floor(uv * grid);
  vec2 local = fract(uv * grid);

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y));
      vec2 id = cell + offset;
      vec2 seed = hash22(id);
      float energy = sampleFreq(seed.x);
      float drift = u_time * (0.08 + seed.y * 0.22) + energy * 2.0 + u_beat * 0.28;
      vec2 point = offset + seed + 0.18 * vec2(cos(drift * 6.28318), sin((drift + seed.x) * 6.28318)) - local;
      float dist = length(point);
      float sparkle = exp(-dist * (13.0 + u_treble * 10.0));
      total += palette(seed.x + u_time * 0.025, energy) * sparkle * (0.16 + energy * 0.9);
    }
  }

  float push = 0.22 + u_bass * 0.22 + u_beat * 0.08;
  float center = exp(-abs(length(p) - push) * 16.0) * (0.08 + u_bass * 0.22);
  return total + palette(u_time * 0.03, 1.0) * center;
}

vec3 abstractMode(vec2 uv) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;
  float angle = atan(p.y, p.x);
  float radius = length(p);
  float folds = 5.0 + floor(u_mid * 5.0);
  float folded = abs(fract(angle / (2.0 * PI) * folds + u_time * 0.025) - 0.5);
  float wave = sin(radius * (18.0 + u_bass * 16.0) - u_time * 2.2 + folded * 12.0);
  float freq = sampleFreq(fract(radius * 0.72 + folded));
  float bands = smoothstep(0.62, 0.96, wave * 0.5 + 0.5) * (0.28 + freq);
  float tunnel = 1.0 / (1.0 + radius * radius * 4.0);
  vec3 color = palette(folded + radius * 0.2 + u_time * 0.035, freq);
  return color * bands * (0.45 + tunnel) + color * tunnel * 0.28;
}

void main() {
  vec2 uv = v_uv;
  vec3 color = background(uv);
  vec3 effect;

  if (u_mode == 0) {
    effect = spectrum(uv);
  } else if (u_mode == 1) {
    effect = oscilloscope(uv);
  } else if (u_mode == 2) {
    effect = radial(uv);
  } else if (u_mode == 3) {
    effect = particles(uv);
  } else {
    effect = abstractMode(uv);
  }

  color += effect * (1.0 + u_beat * 0.12);
  color += palette(u_time * 0.06, 1.0) * u_beat * 0.018;
  color = color / (color + vec3(1.0));
  color = pow(color, vec3(0.82));
  gl_FragColor = vec4(color, 1.0);
}
`;

interface WebglProgram {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  buffer: WebGLBuffer;
  freqTexture: WebGLTexture;
  waveTexture: WebGLTexture;
  freqTextureWidth: number;
  waveTextureWidth: number;
  uniforms: {
    resolution: WebGLUniformLocation | null;
    time: WebGLUniformLocation | null;
    freq: WebGLUniformLocation | null;
    wave: WebGLUniformLocation | null;
    freqSize: WebGLUniformLocation | null;
    waveSize: WebGLUniformLocation | null;
    mode: WebGLUniformLocation | null;
    colorMode: WebGLUniformLocation | null;
    sensitivity: WebGLUniformLocation | null;
    particleDensity: WebGLUniformLocation | null;
    volume: WebGLUniformLocation | null;
    bass: WebGLUniformLocation | null;
    mid: WebGLUniformLocation | null;
    treble: WebGLUniformLocation | null;
    beat: WebGLUniformLocation | null;
  };
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('Unable to create WebGL shader.');
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? 'Unknown shader compile error.';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createTexture(gl: WebGLRenderingContext) {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error('Unable to create WebGL texture.');
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

function createProgram(canvas: HTMLCanvasElement): WebglProgram | null {
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    powerPreference: 'high-performance',
    premultipliedAlpha: false,
    stencil: false,
  });

  if (!gl) {
    return null;
  }

  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  const program = gl.createProgram();
  const buffer = gl.createBuffer();
  if (!program || !buffer) {
    throw new Error('Unable to create WebGL program.');
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? 'Unknown WebGL link error.');
  }

  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const position = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const freqTexture = createTexture(gl);
  const waveTexture = createTexture(gl);

  return {
    gl,
    program,
    buffer,
    freqTexture,
    waveTexture,
    freqTextureWidth: 0,
    waveTextureWidth: 0,
    uniforms: {
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      time: gl.getUniformLocation(program, 'u_time'),
      freq: gl.getUniformLocation(program, 'u_freq'),
      wave: gl.getUniformLocation(program, 'u_wave'),
      freqSize: gl.getUniformLocation(program, 'u_freqSize'),
      waveSize: gl.getUniformLocation(program, 'u_waveSize'),
      mode: gl.getUniformLocation(program, 'u_mode'),
      colorMode: gl.getUniformLocation(program, 'u_colorMode'),
      sensitivity: gl.getUniformLocation(program, 'u_sensitivity'),
      particleDensity: gl.getUniformLocation(program, 'u_particleDensity'),
      volume: gl.getUniformLocation(program, 'u_volume'),
      bass: gl.getUniformLocation(program, 'u_bass'),
      mid: gl.getUniformLocation(program, 'u_mid'),
      treble: gl.getUniformLocation(program, 'u_treble'),
      beat: gl.getUniformLocation(program, 'u_beat'),
    },
  };
}

function resizeCanvas(canvas: HTMLCanvasElement, gl: WebGLRenderingContext, quality: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, quality);
  const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
  }
}

function uploadTexture(
  gl: WebGLRenderingContext,
  texture: WebGLTexture,
  unit: number,
  data: Uint8Array,
  currentWidth: number,
) {
  gl.activeTexture(unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  if (currentWidth === data.length) {
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, data.length, 1, gl.LUMINANCE, gl.UNSIGNED_BYTE, data);
    return currentWidth;
  }
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, data.length, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, data);
  return data.length;
}

export function VisualizerCanvas({
  audioFrameRef,
  colorMode,
  onFpsChange,
  particleCount,
  sensitivity,
  visualMode,
}: VisualizerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const optionsRef = useRef({ colorMode, particleCount, sensitivity, visualMode });
  const qualityRef = useRef(1);
  const beatPulseRef = useRef(0);

  useEffect(() => {
    optionsRef.current = { colorMode, particleCount, sensitivity, visualMode };
  }, [colorMode, particleCount, sensitivity, visualMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    let renderer: WebglProgram | null = null;
    try {
      renderer = createProgram(canvas);
    } catch (error) {
      console.error(error);
      return undefined;
    }

    if (!renderer) {
      console.error('WebGL is unavailable in this browser.');
      return undefined;
    }

    const { gl, program, freqTexture, waveTexture, uniforms } = renderer;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.useProgram(program);
    gl.uniform1i(uniforms.freq, 0);
    gl.uniform1i(uniforms.wave, 1);

    let animation = 0;
    let frames = 0;
    let lastFpsUpdate = performance.now();
    let lastUploadedVersion = -1;

    const render = (time: number) => {
      frames += 1;
      if (time - lastFpsUpdate >= 1000) {
        const fps = Math.round((frames * 1000) / (time - lastFpsUpdate));
        if (fps < 110 && qualityRef.current > 0.55) {
          qualityRef.current = Math.max(0.55, qualityRef.current - 0.1);
        } else if (fps > 138 && qualityRef.current < 1.3) {
          qualityRef.current = Math.min(1.3, qualityRef.current + 0.05);
        }
        onFpsChange(fps);
        frames = 0;
        lastFpsUpdate = time;
      }

      resizeCanvas(canvas, gl, qualityRef.current);

      const options = optionsRef.current;
      const frame = audioFrameRef.current;
      beatPulseRef.current = frame.beat ? 1 : beatPulseRef.current * 0.88;
      if (frame.version !== lastUploadedVersion) {
        renderer.freqTextureWidth = uploadTexture(gl, freqTexture, gl.TEXTURE0, frame.frequencyBins, renderer.freqTextureWidth);
        renderer.waveTextureWidth = uploadTexture(gl, waveTexture, gl.TEXTURE1, frame.waveform, renderer.waveTextureWidth);
        lastUploadedVersion = frame.version;
      }

      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform1f(uniforms.time, time * 0.001);
      gl.uniform1f(uniforms.freqSize, frame.frequencyBins.length);
      gl.uniform1f(uniforms.waveSize, frame.waveform.length);
      gl.uniform1i(uniforms.mode, modeIds[options.visualMode]);
      gl.uniform1i(uniforms.colorMode, colorModeIds[options.colorMode]);
      gl.uniform1f(uniforms.sensitivity, options.sensitivity);
      gl.uniform1f(uniforms.particleDensity, options.particleCount / 2200);
      gl.uniform1f(uniforms.volume, frame.volume);
      gl.uniform1f(uniforms.bass, frame.bass);
      gl.uniform1f(uniforms.mid, frame.mid);
      gl.uniform1f(uniforms.treble, frame.treble);
      gl.uniform1f(uniforms.beat, beatPulseRef.current);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      animation = requestAnimationFrame(render);
    };

    animation = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animation);
      gl.deleteTexture(freqTexture);
      gl.deleteTexture(waveTexture);
      gl.deleteBuffer(renderer.buffer);
      gl.deleteProgram(program);
    };
  }, [audioFrameRef, onFpsChange]);

  return <canvas ref={canvasRef} className="visualizer-canvas" aria-label="Audio visualizer canvas" />;
}
