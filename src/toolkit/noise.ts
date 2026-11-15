// Small deterministic noise helpers (no dependency).
import { context2d, makeCanvas } from './canvas.ts';

export type Rand = () => number;
/** [r, g, b, a], 0–255 */
export type RGBA = [r: number, g: number, b: number, a: number];

export function mulberry32(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(ix: number, iy: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Smooth value noise in [-1, 1].
export function vnoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  const top = a + (b - a) * ux, bot = c + (d - c) * ux;
  return (top + (bot - top) * uy) * 2 - 1;
}

// Canvas whose pixels come from fn(rand, x, y) -> [r, g, b, a] (0–255).
export function pixelCanvas(w: number, h: number, seed: number, fn: (rand: Rand, x: number, y: number) => RGBA): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const ctx = context2d(c);
  const img = ctx.createImageData(c.width, c.height);
  const rand = mulberry32(seed);
  const d = img.data;
  for (let y = 0, i = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++, i += 4) {
      const [r, g, b, a] = fn(rand, x, y);
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
