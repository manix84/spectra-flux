import { useEffect, useRef } from 'react';
import { backgroundGradient, getColor } from './visualizer/colors';
import type { AudioFrame, ColorMode, VisualMode } from './visualizer/types';

interface VisualizerCanvasProps {
  audioFrame: AudioFrame;
  colorMode: ColorMode;
  particleCount: number;
  sensitivity: number;
  visualMode: VisualMode;
}

interface Particle {
  angle: number;
  radius: number;
  speed: number;
  size: number;
  orbit: number;
  energy: number;
}

const idlePulse = (time: number) => 0.08 + Math.sin(time * 0.0012) * 0.025;

function resizeCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.floor(canvas.clientWidth * dpr);
  const height = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function frequencyAt(data: Uint8Array, index: number, total: number) {
  const eased = Math.pow(index / Math.max(1, total - 1), 1.85);
  const bin = Math.min(data.length - 1, Math.floor(eased * data.length));
  return data[bin] / 255;
}

function clearScene(context: CanvasRenderingContext2D, width: number, height: number, colorMode: ColorMode, fade: number) {
  const colors = backgroundGradient(colorMode);
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(0.48, colors[1]);
  gradient.addColorStop(1, colors[2]);
  context.globalCompositeOperation = 'source-over';
  context.globalAlpha = fade;
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.globalAlpha = 1;
}

function drawSpectrum(
  context: CanvasRenderingContext2D,
  frame: AudioFrame,
  colorMode: ColorMode,
  width: number,
  height: number,
  time: number,
  sensitivity: number,
) {
  const bars = Math.min(128, Math.floor(width / 8));
  const gap = 2;
  const barWidth = width / bars;
  const floor = height * 0.82;
  context.shadowBlur = 18 + frame.treble * 26;
  for (let index = 0; index < bars; index += 1) {
    const energy = Math.pow(frequencyAt(frame.frequencyBins, index, bars) * sensitivity, 1.12);
    const heightScale = Math.min(1, energy + idlePulse(time) * 0.5);
    const barHeight = heightScale * height * 0.72;
    const x = index * barWidth;
    const y = floor - barHeight;
    const color = getColor(colorMode, index / bars + time * 0.00008, heightScale);
    context.fillStyle = color;
    context.shadowColor = color;
    context.fillRect(x + gap, y, Math.max(2, barWidth - gap * 2), barHeight);
    context.globalAlpha = 0.55;
    context.fillRect(x + gap, y - 8 - frame.bass * 16, Math.max(2, barWidth - gap * 2), 3);
    context.globalAlpha = 1;
  }
  context.shadowBlur = 0;
}

function drawOscilloscope(
  context: CanvasRenderingContext2D,
  frame: AudioFrame,
  colorMode: ColorMode,
  width: number,
  height: number,
  time: number,
  sensitivity: number,
) {
  const centerY = height / 2;
  const amplitude = height * (0.34 + frame.bass * 0.16) * sensitivity;
  context.lineWidth = 2.2 + frame.treble * 3;
  context.shadowBlur = 24;
  context.shadowColor = getColor(colorMode, time * 0.00012, 1);
  for (let pass = 0; pass < 2; pass += 1) {
    context.beginPath();
    for (let index = 0; index < frame.waveform.length; index += 1) {
      const x = (index / (frame.waveform.length - 1)) * width;
      const sample = (frame.waveform[index] - 128) / 128;
      const mirrored = pass === 0 ? sample : -sample;
      const y = centerY + mirrored * amplitude;
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    context.strokeStyle = getColor(colorMode, pass * 0.18 + time * 0.0001, pass === 0 ? 1 : 0.62);
    context.globalAlpha = pass === 0 ? 1 : 0.42;
    context.stroke();
  }
  context.globalAlpha = 1;
  context.shadowBlur = 0;
}

function drawRadial(
  context: CanvasRenderingContext2D,
  frame: AudioFrame,
  colorMode: ColorMode,
  width: number,
  height: number,
  time: number,
  sensitivity: number,
) {
  const centerX = width / 2;
  const centerY = height / 2;
  const baseRadius = Math.min(width, height) * (0.16 + frame.bass * 0.055);
  const bars = 180;
  context.save();
  context.translate(centerX, centerY);
  context.rotate(time * 0.00006);
  context.lineCap = 'round';
  context.shadowBlur = 16 + (frame.beat ? 24 : 0);
  for (let index = 0; index < bars; index += 1) {
    const angle = (index / bars) * Math.PI * 2;
    const energy = Math.min(1.35, frequencyAt(frame.frequencyBins, index, bars) * sensitivity + idlePulse(time));
    const inner = baseRadius * (0.78 + Math.sin(time * 0.001 + index) * 0.02);
    const outer = inner + energy * Math.min(width, height) * 0.24;
    const color = getColor(colorMode, index / bars + time * 0.0001, energy);
    context.strokeStyle = color;
    context.shadowColor = color;
    context.lineWidth = 2 + energy * 5;
    context.beginPath();
    context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    context.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    context.stroke();
  }

  const core = context.createRadialGradient(0, 0, baseRadius * 0.1, 0, 0, baseRadius * (1.05 + frame.volume));
  core.addColorStop(0, getColor(colorMode, time * 0.00012, 1.2));
  core.addColorStop(0.42, 'rgb(255 255 255 / 0.16)');
  core.addColorStop(1, 'rgb(0 0 0 / 0)');
  context.fillStyle = core;
  context.beginPath();
  context.arc(0, 0, baseRadius * (1.05 + frame.volume * 0.8), 0, Math.PI * 2);
  context.fill();
  context.restore();
  context.shadowBlur = 0;
}

function ensureParticles(particles: Particle[], count: number) {
  while (particles.length < count) {
    particles.push({
      angle: Math.random() * Math.PI * 2,
      radius: Math.random(),
      speed: 0.00025 + Math.random() * 0.0014,
      size: 0.65 + Math.random() * 2.8,
      orbit: 0.45 + Math.random() * 1.35,
      energy: Math.random(),
    });
  }
  if (particles.length > count) {
    particles.length = count;
  }
}

function drawParticles(
  context: CanvasRenderingContext2D,
  particles: Particle[],
  frame: AudioFrame,
  colorMode: ColorMode,
  width: number,
  height: number,
  time: number,
  sensitivity: number,
) {
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.max(width, height) * 0.52;
  context.globalCompositeOperation = 'lighter';
  for (let index = 0; index < particles.length; index += 1) {
    const particle = particles[index];
    const binEnergy = frequencyAt(frame.frequencyBins, index, particles.length) * sensitivity;
    particle.energy += (binEnergy - particle.energy) * 0.08;
    particle.angle += particle.speed * (1 + frame.treble * 8 + particle.energy * 3);
    particle.radius += (frame.beat ? 0.016 : 0.0015) + particle.energy * 0.003;
    if (particle.radius > 1.18) {
      particle.radius = Math.random() * 0.18;
      particle.angle = Math.random() * Math.PI * 2;
    }

    const wave = Math.sin(time * 0.0012 + particle.angle * 3) * frame.mid * 0.12;
    const radius = (particle.radius + wave) * maxRadius * particle.orbit;
    const x = centerX + Math.cos(particle.angle) * radius;
    const y = centerY + Math.sin(particle.angle) * radius;
    const size = particle.size * (1 + particle.energy * 4 + (frame.beat ? 1.5 : 0));
    context.fillStyle = getColor(colorMode, particle.angle / (Math.PI * 2) + time * 0.00008, particle.energy);
    context.globalAlpha = Math.min(0.86, 0.18 + particle.energy * 0.72);
    context.beginPath();
    context.arc(x, y, size, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
}

function drawAbstract(
  context: CanvasRenderingContext2D,
  frame: AudioFrame,
  colorMode: ColorMode,
  width: number,
  height: number,
  time: number,
  sensitivity: number,
) {
  const centerX = width / 2;
  const centerY = height / 2;
  const rings = 18;
  context.save();
  context.translate(centerX, centerY);
  context.rotate(time * 0.00008);
  context.globalCompositeOperation = 'lighter';
  for (let ring = 0; ring < rings; ring += 1) {
    const progress = ring / rings;
    const sides = 5 + ((ring * 3) % 8);
    const radius = progress * Math.min(width, height) * 0.54 + frame.bass * 90;
    const energy = frequencyAt(frame.frequencyBins, ring * 7, rings * 7) * sensitivity;
    context.beginPath();
    for (let side = 0; side <= sides; side += 1) {
      const angle = (side / sides) * Math.PI * 2;
      const distortion =
        Math.sin(angle * (3 + ring * 0.4) + time * 0.001 + frame.mid * 8) * (22 + frame.treble * 120) * energy;
      const x = Math.cos(angle) * (radius + distortion);
      const y = Math.sin(angle) * (radius + distortion);
      if (side === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    context.strokeStyle = getColor(colorMode, progress + time * 0.00009, 0.58 + energy);
    context.lineWidth = 1 + energy * 4;
    context.shadowColor = context.strokeStyle;
    context.shadowBlur = 12 + energy * 22;
    context.globalAlpha = 0.2 + progress * 0.55;
    context.stroke();
  }
  context.restore();
  context.globalAlpha = 1;
  context.shadowBlur = 0;
  context.globalCompositeOperation = 'source-over';
}

export function VisualizerCanvas({ audioFrame, colorMode, particleCount, sensitivity, visualMode }: VisualizerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef(audioFrame);
  const optionsRef = useRef({ colorMode, particleCount, sensitivity, visualMode });
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    frameRef.current = audioFrame;
  }, [audioFrame]);

  useEffect(() => {
    optionsRef.current = { colorMode, particleCount, sensitivity, visualMode };
  }, [colorMode, particleCount, sensitivity, visualMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !context) {
      return undefined;
    }

    let animation = 0;
    const render = (time: number) => {
      resizeCanvas(canvas, context);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const frame = frameRef.current;
      const options = optionsRef.current;
      const fade = options.visualMode === 'particles' || options.visualMode === 'abstract' ? 0.2 : 0.42;
      clearScene(context, width, height, options.colorMode, fade);

      if (frame.beat) {
        context.globalAlpha = 0.16;
        context.fillStyle = getColor(options.colorMode, time * 0.00018, 1.4);
        context.fillRect(0, 0, width, height);
        context.globalAlpha = 1;
      }

      if (options.visualMode === 'spectrum') {
        drawSpectrum(context, frame, options.colorMode, width, height, time, options.sensitivity);
      } else if (options.visualMode === 'oscilloscope') {
        drawOscilloscope(context, frame, options.colorMode, width, height, time, options.sensitivity);
      } else if (options.visualMode === 'radial') {
        drawRadial(context, frame, options.colorMode, width, height, time, options.sensitivity);
      } else if (options.visualMode === 'particles') {
        ensureParticles(particlesRef.current, options.particleCount);
        drawParticles(context, particlesRef.current, frame, options.colorMode, width, height, time, options.sensitivity);
      } else {
        drawAbstract(context, frame, options.colorMode, width, height, time, options.sensitivity);
      }

      animation = requestAnimationFrame(render);
    };

    animation = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animation);
  }, []);

  return <canvas ref={canvasRef} className="visualizer-canvas" aria-label="Audio visualizer canvas" />;
}
