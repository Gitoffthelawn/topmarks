// Rasterize the extension icon (same design as assets/icons/icon.svg) to a
// 128×128 PNG for Chrome, which doesn't accept SVG manifest icons. Pure
// Node, no dependencies: signed-distance fields for the rounded rects and a
// minimal PNG encoder. The Chrome build calls it, so dist/ never drifts from
// the SVG; scripts/generate-icon.mjs writes the committed copy for the store.
import { deflateSync } from "node:zlib";

const SIZE = 128;

const GRAD_A = [74, 90, 200]; // #4a5ac8
const GRAD_B = [124, 77, 255]; // #7c4dff
const PAPER = [255, 255, 255];
const INK = [28, 28, 46]; // #1c1c2e

type Rect = { x: number; y: number; w: number; h: number; r: number };
const BAR: Rect = { x: 20, y: 46, w: 88, h: 36, r: 18 };
const MARKS: Rect[] = [
  { x: 30, y: 60, w: 16, h: 8, r: 4 },
  { x: 52, y: 60, w: 24, h: 8, r: 4 },
  { x: 82, y: 60, w: 16, h: 8, r: 4 },
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const coverage = (distance: number) => clamp01(0.5 - distance);
const blend = (rgb: number[], over: number[], t: number) =>
  rgb.map((c, i) => mix(c, over[i] ?? c, t));

function roundedRectSDF(px: number, py: number, rect: Rect): number {
  const halfW = rect.w / 2;
  const halfH = rect.h / 2;
  const dx = Math.abs(px - (rect.x + halfW)) - (halfW - rect.r);
  const dy = Math.abs(py - (rect.y + halfH)) - (halfH - rect.r);
  return (
    Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - rect.r
  );
}

function pixel(x: number, y: number): number[] {
  const cx = x + 0.5;
  const cy = y + 0.5;
  const shape = coverage(roundedRectSDF(cx, cy, { x: 0, y: 0, w: SIZE, h: SIZE, r: 28 }));
  if (shape === 0) return [0, 0, 0, 0];

  const t = (x + y) / (2 * (SIZE - 1));
  let rgb = GRAD_A.map((a, i) => mix(a, GRAD_B[i] ?? a, t));

  rgb = blend(rgb, PAPER, coverage(roundedRectSDF(cx, cy, BAR)));
  for (const mark of MARKS) {
    rgb = blend(rgb, INK, coverage(roundedRectSDF(cx, cy, mark)));
  }

  return [...rgb.map(Math.round), Math.round(shape * 255)];
}

// --- Minimal PNG encoder (RGBA, 8-bit, no interlace) ---
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of buf) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

export function renderIconPng(): Buffer {
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
  for (let y = 0; y < SIZE; y++) {
    const row = y * (SIZE * 4 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < SIZE; x++) {
      raw.set(pixel(x, y), row + 1 + x * 4);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
