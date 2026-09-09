import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// Actually this file will live in tools/ - wait, writing to temp. Put in tools/

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type);
  const crcBuf = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuf));
  return Buffer.concat([len, t, data, crc]);
}

/** Very small solid rounded-rect PNG via raw RGBA (no deps) */
function makePng(size, paint) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const i = y * (size * 4 + 1) + 1 + x * 4;
      const [r, g, b, a] = paint(x, y, size);
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function distSq(x, y, cx, cy) {
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy;
}

function inRoundRect(x, y, s, r) {
  if (x < 0 || y < 0 || x >= s || y >= s) return false;
  if (x >= r && x < s - r) return true;
  if (y >= r && y < s - r) return true;
  // corners
  if (x < r && y < r) return distSq(x, y, r, r) <= r * r;
  if (x >= s - r && y < r) return distSq(x, y, s - r, r) <= r * r;
  if (x < r && y >= s - r) return distSq(x, y, r, s - r) <= r * r;
  if (x >= s - r && y >= s - r) return distSq(x, y, s - r, s - r) <= r * r;
  return true;
}

function lerp(a, b, t) { return a + (b - a) * t; }
function mix(c1, c2, t) {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
    255,
  ];
}

function paint(x, y, s) {
  const r = s * 0.225;
  if (!inRoundRect(x + 0.5, y + 0.5, s, r)) return [0, 0, 0, 0];
  const t = (x + y) / (2 * (s - 1));
  let col = mix([244, 250, 254], [75, 159, 212], Math.min(1, Math.max(0, t * 1.05)));
  // notebook pages (simple white diamond-ish open book)
  const cx = s / 2;
  const top = s * 0.29, bot = s * 0.71, left = s * 0.22, right = s * 0.78;
  const inLeft =
    x >= left && x <= cx &&
    y >= top - (x - left) * 0.08 &&
    y <= bot + (x - left) * 0.08;
  const inRight =
    x >= cx && x <= right &&
    y >= top - (right - x) * 0.08 &&
    y <= bot + (right - x) * 0.08;
  if (inLeft || inRight) col = [255, 255, 255, 255];
  // spine
  if (Math.abs(x - cx) < 0.6 && y > top && y < bot) col = [213, 229, 242, 255];
  // curve approx dots
  const d1 = distSq(x + 0.5, y + 0.5, s * 0.32, s * 0.58);
  const d2 = distSq(x + 0.5, y + 0.5, s * 0.70, s * 0.49);
  if (d1 < 1.5 * 1.5) col = [90, 167, 216, 255];
  if (d2 < 1.5 * 1.5) col = [232, 154, 106, 255];
  // soft curve pixels
  for (let u = 0; u <= 1.001; u += 0.02) {
    const bx = (1 - u) * (1 - u) * (1 - u) * (s * 0.28) + 3 * (1 - u) * (1 - u) * u * (s * 0.42) + 3 * (1 - u) * u * u * (s * 0.55) + u * u * u * (s * 0.72);
    const by = (1 - u) * (1 - u) * (1 - u) * (s * 0.54) + 3 * (1 - u) * (1 - u) * u * (s * 0.42) + 3 * (1 - u) * u * u * (s * 0.60) + u * u * u * (s * 0.55);
    if (distSq(x + 0.5, y + 0.5, bx, by) < 0.85 * 0.85) col = [63, 143, 200, 255];
  }
  return col;
}

const root = process.argv[2] || process.cwd();
const png = makePng(32, paint);
fs.writeFileSync(path.join(root, "icon.png"), png);
fs.writeFileSync(path.join(root, "icon-market.png"), png);
console.log("wrote 32x32 icon.png / icon-market.png", png.length);
