// generate_icons.mjs
// Renders the Dev ToolBox Pro `</>` mark to PNG at 16/48/128 with a
// pure-JS PNG encoder (no image deps). Geometry is signed-distance based so
// every size gets analytic anti-aliasing instead of downscaling artifacts.

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

// ─── PNG encoding ────────────────────────────────────────────────────────────

const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

function createPNG(width, height, renderPixel) {
  const rowSize = 1 + width * 4;
  const raw = Buffer.alloc(height * rowSize);

  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = renderPixel(x + 0.5, y + 0.5);
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
      raw[offset++] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    createChunk('IHDR', ihdr),
    createChunk('IDAT', deflateSync(raw, { level: 9 })),
    createChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Math helpers ────────────────────────────────────────────────────────────

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const mix = (a, b, t) => a + (b - a) * t;

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

// Distance from p to the capsule spine a→b.
function segmentDist(px, py, ax, ay, bx, by) {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const t = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay));
  return Math.hypot(pax - t * bax, pay - t * bay);
}

// Approximate signed distance to a superellipse |x|^n + |y|^n = r^n.
function squircleDist(nx, ny, n, r) {
  const p = Math.pow(Math.pow(Math.abs(nx), n) + Math.pow(Math.abs(ny), n), 1 / n);
  return p - r;
}

// ─── Design tokens ───────────────────────────────────────────────────────────

// Violet ramp, light top-left to deep bottom-right.
const TINT_LIGHT = [167, 139, 250];
const TINT_MID = [124, 58, 237];
const TINT_DEEP = [72, 26, 145];

const SQUIRCLE_N = 4.6;
const SQUIRCLE_R = 0.98;

// The `</>` layout. Small sizes need a wider bracket spread and a fatter stroke
// so the slash does not visually weld itself to the chevrons.
function layoutFor(size) {
  return size <= 16
    ? { innerX: 0.34, outerX: 0.66, tipY: 0.3, slashX: 0.115, slashY: 0.44, stroke: 0.1 }
    : { innerX: 0.28, outerX: 0.57, tipY: 0.28, slashX: 0.135, slashY: 0.47, stroke: 0.086 };
}

function glyphDist(nx, ny, L) {
  return Math.min(
    segmentDist(nx, ny, -L.innerX, -L.tipY, -L.outerX, 0),
    segmentDist(nx, ny, -L.outerX, 0, -L.innerX, L.tipY),
    segmentDist(nx, ny, L.slashX, -L.slashY, -L.slashX, L.slashY),
    segmentDist(nx, ny, L.innerX, -L.tipY, L.outerX, 0),
    segmentDist(nx, ny, L.outerX, 0, L.innerX, L.tipY)
  );
}

// ─── Pixel shader ────────────────────────────────────────────────────────────

function renderIconPixel(x, y, size) {
  const half = size / 2;
  const nx = (x - half) / half;
  const ny = (y - half) / half;

  const unit = 2 / size; // normalized units per device pixel
  const aa = unit * 0.5;

  const tileDist = squircleDist(nx, ny, SQUIRCLE_N, SQUIRCLE_R);
  const tileAlpha = 1 - smoothstep(-aa, aa, tileDist);
  if (tileAlpha <= 0) return [0, 0, 0, 0];

  // Diagonal three-stop gradient.
  const t = clamp((nx + ny + 2) / 4);
  const ramp = t < 0.5
    ? TINT_LIGHT.map((c, i) => mix(c, TINT_MID[i], t / 0.5))
    : TINT_MID.map((c, i) => mix(c, TINT_DEEP[i], (t - 0.5) / 0.5));
  let [r, g, b] = ramp;

  // Broad specular sheen in the upper-left quadrant.
  const sheen = Math.pow(1 - clamp(Math.hypot((nx + 0.42) * 0.85, (ny + 0.62) * 1.15)), 2) * 0.2;

  // Thin rim light along the top edge, matching lit-from-above physicality.
  const rim = smoothstep(-unit * 2.2, 0, tileDist) * clamp(-ny) * 0.5;

  const lift = sheen + rim;
  r = mix(r, 255, lift);
  g = mix(g, 255, lift);
  b = mix(b, 255, lift);

  // Contact shadow along the bottom edge.
  const floor = smoothstep(-unit * 2.4, 0, tileDist) * clamp(ny) * 0.28;
  r = mix(r, TINT_DEEP[0] * 0.55, floor);
  g = mix(g, TINT_DEEP[1] * 0.55, floor);
  b = mix(b, TINT_DEEP[2] * 0.55, floor);

  const L = layoutFor(size);
  const d = glyphDist(nx, ny, L) - L.stroke;

  // Drop shadow is dropped at 16px: it only muddies a 16x16 grid.
  if (size > 16) {
    const ds = glyphDist(nx, ny - unit * 1.6, L) - L.stroke;
    const shade = (1 - smoothstep(0, unit * 3, ds)) * 0.3;
    r *= 1 - shade;
    g *= 1 - shade;
    b *= 1 - shade;
  }

  const glyph = 1 - smoothstep(-aa, aa, d);
  if (glyph > 0) {
    // Bevel: the upper half of each stroke stays pure white, the lower half
    // picks up a trace of the violet behind it so the mark reads as carved.
    const shade = clamp(0.5 + ny * 0.5) * 0.07;
    const gr = mix(255, 232, shade * 4);
    const gg = mix(255, 228, shade * 4);
    const gb = mix(255, 246, shade * 4);
    r = mix(r, gr, glyph);
    g = mix(g, gg, glyph);
    b = mix(b, gb, glyph);
  }

  return [
    Math.round(clamp(r, 0, 255)),
    Math.round(clamp(g, 0, 255)),
    Math.round(clamp(b, 0, 255)),
    Math.round(tileAlpha * 255),
  ];
}

// ─── Emit ────────────────────────────────────────────────────────────────────

mkdirSync('icons', { recursive: true });
for (const size of [16, 48, 128]) {
  writeFileSync(`icons/icon${size}.png`, createPNG(size, size, (x, y) => renderIconPixel(x, y, size)));
  console.log(`icons/icon${size}.png`);
}
