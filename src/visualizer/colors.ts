import type { ColorMode } from './types';

const synthwave = [
  [30, 225, 255],
  [255, 47, 214],
  [255, 179, 71],
];

const phosphor = [
  [87, 255, 118],
  [185, 255, 199],
  [33, 135, 73],
];

const mono = [
  [240, 244, 255],
  [130, 145, 166],
  [255, 255, 255],
];

const ember = [
  [255, 76, 41],
  [255, 194, 87],
  [115, 221, 196],
];

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function paletteColor(palette: number[][], index: number, intensity = 1) {
  const phase = (index % 1) * palette.length;
  const left = Math.floor(phase) % palette.length;
  const right = (left + 1) % palette.length;
  const mix = phase - Math.floor(phase);
  const color = palette[left].map((channel, channelIndex) => {
    const blended = channel + (palette[right][channelIndex] - channel) * mix;
    return clampByte(blended * intensity);
  });
  return `rgb(${color[0]} ${color[1]} ${color[2]})`;
}

export function getColor(mode: ColorMode, phase: number, intensity = 1) {
  if (mode === 'rainbow') {
    return `hsl(${Math.round((phase * 360) % 360)} 96% ${Math.round(48 + intensity * 18)}%)`;
  }
  if (mode === 'phosphor') {
    return paletteColor(phosphor, phase, 0.65 + intensity * 0.55);
  }
  if (mode === 'mono') {
    return paletteColor(mono, phase, 0.62 + intensity * 0.45);
  }
  if (mode === 'ember') {
    return paletteColor(ember, phase, 0.72 + intensity * 0.5);
  }
  return paletteColor(synthwave, phase, 0.72 + intensity * 0.55);
}

export function backgroundGradient(mode: ColorMode) {
  if (mode === 'phosphor') {
    return ['#020802', '#051408', '#0b2111'];
  }
  if (mode === 'mono') {
    return ['#03050a', '#111827', '#070b12'];
  }
  if (mode === 'ember') {
    return ['#100402', '#210b06', '#051611'];
  }
  if (mode === 'rainbow') {
    return ['#020413', '#0a0628', '#06182f'];
  }
  return ['#070711', '#130728', '#071b27'];
}
