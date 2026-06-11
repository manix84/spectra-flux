import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const targets = [
  ['public/icons/icon-192.png', 192],
  ['public/icons/icon-512.png', 512],
  ['public/icons/apple-touch-icon.png', 180],
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

function lerp(left, right, amount) {
  return Math.round(left + (right - left) * amount);
}

function pixel(size, x, y) {
  const nx = (x / (size - 1)) * 2 - 1;
  const ny = (y / (size - 1)) * 2 - 1;
  const distance = Math.hypot(nx, ny);
  const angle = Math.atan2(ny, nx);
  const glow = Math.max(0, 1 - distance);
  const stripe = Math.sin(nx * 12 + Math.sin(ny * 8) * 1.5);
  const ring = Math.abs(distance - 0.42) < 0.045 || Math.abs(distance - 0.68) < 0.035;
  const wave = Math.abs(ny - Math.sin(nx * Math.PI * 2.25) * 0.22) < 0.045;
  const bar = Math.abs(nx) < 0.44 && y > size * 0.62 && ((Math.floor((x / size) * 10) % 2 === 0) || y > size * 0.78);

  let red = lerp(7, 36, glow);
  let green = lerp(7, 219, Math.max(0, Math.cos(angle - 0.5) * 0.5 + 0.5) * glow);
  let blue = lerp(17, 255, Math.max(0, Math.sin(angle + 0.4) * 0.5 + 0.5) * glow);

  if (stripe > 0.92) {
    red = 255;
    green = 67;
    blue = 209;
  }
  if (ring) {
    red = 36;
    green = 219;
    blue = 255;
  }
  if (wave) {
    red = 255;
    green = 255;
    blue = 255;
  }
  if (bar) {
    red = 255;
    green = 196;
    blue = 92;
  }

  const corner = Math.max(Math.abs(nx), Math.abs(ny));
  if (corner > 0.9) {
    const fade = Math.max(0, (1 - corner) / 0.1);
    red = lerp(7, red, fade);
    green = lerp(7, green, fade);
    blue = lerp(17, blue, fade);
  }

  return [red, green, blue, 255];
}

function png(size) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * stride] = 0;
    for (let x = 0; x < size; x += 1) {
      const offset = y * stride + 1 + x * 4;
      const [red, green, blue, alpha] = pixel(size, x, y);
      raw[offset] = red;
      raw[offset + 1] = green;
      raw[offset + 2] = blue;
      raw[offset + 3] = alpha;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [path, size] of targets) {
  writeFileSync(path, png(size));
  console.log(`Wrote ${path}`);
}
