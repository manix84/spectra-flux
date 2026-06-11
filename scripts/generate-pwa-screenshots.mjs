import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const outputDir = 'public/screenshots';
const targets = [
  ['desktop.png', 1280, 720],
  ['mobile.png', 390, 844],
];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function palette(phase) {
  const red = 130 + Math.cos(phase * Math.PI * 2) * 95;
  const green = 150 + Math.cos((phase + 0.68) * Math.PI * 2) * 90;
  const blue = 190 + Math.cos((phase + 0.35) * Math.PI * 2) * 65;
  return [clamp(red), clamp(green), clamp(blue)];
}

function pixel(width, height, x, y) {
  const uvx = x / Math.max(1, width - 1);
  const uvy = y / Math.max(1, height - 1);
  const cx = width * 0.56;
  const cy = height * 0.47;
  const dx = (x - cx) / Math.min(width, height);
  const dy = (y - cy) / Math.min(width, height);
  const radius = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const ringPhase = ((angle / (Math.PI * 2)) + 1) % 1;
  const wave = 0.028 * Math.sin(ringPhase * Math.PI * 2 * 9) + 0.018 * Math.sin(ringPhase * Math.PI * 2 * 17);
  const ring = Math.abs(radius - (0.15 + wave)) < 0.016;
  const core = radius < 0.105;
  const panel = width > height ? x < width * 0.30 && y > 18 && y < height - 18 : y > height * 0.66;
  const panelEdge = panel && (Math.abs(x - width * 0.30) < 2 || Math.abs(y - height * 0.66) < 2);

  let red = 5 + uvx * 8 + uvy * 5;
  let green = 9 + uvx * 14 + uvy * 22;
  let blue = 28 + uvx * 25 + uvy * 16;

  if (panel) {
    red *= 0.55;
    green *= 0.68;
    blue *= 0.82;
  }

  if (panelEdge) {
    red = 42;
    green = 55;
    blue = 75;
  }

  if (ring) {
    const [r, g, b] = palette(ringPhase + 0.05);
    red = r;
    green = g;
    blue = b;
  }

  if (core) {
    red = 38 + (1 - radius / 0.105) * 58;
    green = 78 + (1 - radius / 0.105) * 128;
    blue = 98 + (1 - radius / 0.105) * 120;
  }

  return [clamp(red), clamp(green), clamp(blue), 255];
}

function png(width, height) {
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * stride] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = y * stride + 1 + x * 4;
      const [red, green, blue, alpha] = pixel(width, height, x, y);
      raw[offset] = red;
      raw[offset + 1] = green;
      raw[offset + 2] = blue;
      raw[offset + 3] = alpha;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(outputDir, { recursive: true });

for (const [fileName, width, height] of targets) {
  const path = `${outputDir}/${fileName}`;
  writeFileSync(path, png(width, height));
  console.log(`Wrote ${path}`);
}
