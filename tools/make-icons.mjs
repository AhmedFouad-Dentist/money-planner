// Generates the app icons as PNG files with no dependencies (node tools/make-icons.mjs).
// Design: green rounded square with three rising white bars and a gold coin.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('../icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// Shapes in a 0..1 coordinate space. Returns [r,g,b,a] or null.
const inRoundRect = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};

function shade(x, y, { rounded, scale }) {
  // map into the artwork box (scale < 1 keeps content inside the maskable safe zone)
  const u = 0.5 + (x - 0.5) / scale;
  const v = 0.5 + (y - 0.5) / scale;
  if (rounded && !inRoundRect(x, y, 0, 0, 1, 1, 0.22)) return [0, 0, 0, 0];
  const t = (x + y) / 2;
  let c = [Math.round(0x22 + (0x0e - 0x22) * t), Math.round(0x8c + (0x5a - 0x8c) * t), Math.round(0x66 + (0x42 - 0x66) * t), 255];
  const bars = [[0.2, 0.58], [0.39, 0.46], [0.58, 0.32]];
  for (const [bx, top] of bars) if (inRoundRect(u, v, bx, top, bx + 0.14, 0.8, 0.035)) c = [255, 255, 255, 255];
  const dx = u - 0.74, dy = v - 0.26;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= 0.11) c = d > 0.085 ? [0xc9, 0x8a, 0x00, 255] : [0xf2, 0xb8, 0x22, 255];
  return c;
}

function render(size, opts) {
  const SS = 4;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const c = shade((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size, opts);
      r += c[0] * c[3]; g += c[1] * c[3]; b += c[2] * c[3]; a += c[3];
    }
    const i = (y * size + x) * 4;
    buf[i] = a ? Math.round(r / a) : 0; buf[i + 1] = a ? Math.round(g / a) : 0; buf[i + 2] = a ? Math.round(b / a) : 0; buf[i + 3] = Math.round(a / (SS * SS));
  }
  return png(size, buf);
}

const write = (name, data) => writeFileSync(new URL(name, OUT), data);
write('icon-192.png', render(192, { rounded: true, scale: 1 }));
write('icon-512.png', render(512, { rounded: true, scale: 1 }));
write('icon-maskable-512.png', render(512, { rounded: false, scale: 0.8 }));
write('apple-touch-icon.png', render(180, { rounded: false, scale: 0.92 }));
write('icon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#228c66"/><stop offset="1" stop-color="#0e5a42"/></linearGradient></defs>
<rect width="100" height="100" rx="22" fill="url(#g)"/>
<rect x="20" y="58" width="14" height="22" rx="3.5" fill="#fff"/><rect x="39" y="46" width="14" height="34" rx="3.5" fill="#fff"/><rect x="58" y="32" width="14" height="48" rx="3.5" fill="#fff"/>
<circle cx="74" cy="26" r="11" fill="#c98a00"/><circle cx="74" cy="26" r="8.5" fill="#f2b822"/>
</svg>
`);
console.log('icons written');
