import type { Line, Ring } from '../layers.ts';
import type { Point, Rect } from './geometry.ts';
import { vnoise } from './noise.ts';
import type { View } from './viewport.ts';

// Flat coordinate arrays hold [x, y] pairs: an index bounded by the length (stepping by 2)
// is always defined, hence the `!` in the loops below.

export interface Projector {
  view: View;
  dpr: number;
  /** Device px per metre. */
  S: number;
  /** Map metres -> device px, straight (no wobble). */
  sx(x: number): number;
  sy(y: number): number;
  /** Whether a map box (metres) is on screen, with a margin. */
  visible(bb: Rect): boolean;
  /** Writes [sx, sy] for map point (x, y) with the wobble scaled by k. */
  pt(x: number, y: number, k: number, out: Point): void;
}

/** An item with its bounding box (metres), for P.visible(). */
export type WithBox<T> = T & { bb: Rect };

export function withBox<T extends object>(o: T, rings: readonly Ring[]): WithBox<T> {
  return { ...o, bb: bboxOf(rings) };
}

export function bboxOf(rings: readonly Ring[]): Rect {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const r of rings) for (let i = 0; i < r.length; i += 2) {
    const x = r[i]!, y = r[i + 1]!;
    if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y;
  }
  return [a, b, c, d];
}

// Map metres (y north) -> device px (y down), with a coherent "hand-drawn" wobble.
// Styles that want straight lines pass k = 0 to pt().
export function makeProjector(view: View, W: number, H: number, dpr: number): Projector {
  const S = view.s * dpr, cx = W / 2, cy = H / 2;
  const lam = 2 ** Math.round(Math.log2((70 * dpr) / S)); // wobble wavelength (m), stable per octave
  const inv = 1 / lam;
  const amp = Math.min(2.2, 0.7 + 0.4 * Math.log2(1 + view.s)) * dpr;
  const pad = 30 / S;
  const vb: Rect = [view.x - cx / S - pad, view.y - cy / S - pad, view.x + cx / S + pad, view.y + cy / S + pad];
  const sx = (x: number): number => (x - view.x) * S + cx;
  const sy = (y: number): number => cy - (y - view.y) * S;
  return {
    view, dpr, S, sx, sy,
    visible: (bb) => bb[2] >= vb[0] && bb[0] <= vb[2] && bb[3] >= vb[1] && bb[1] <= vb[3],
    pt(x, y, k, out) {
      const a = amp * k;
      out[0] = sx(x) + (a && vnoise(x * inv, y * inv) * a);
      out[1] = sy(y) + (a && vnoise(x * inv + 31.7, y * inv - 17.3) * a);
    },
  };
}

const tmp: Point = [0, 0];

// Adds closed rings (flat [x, y, ...] arrays in metres) to the current path.
export function addRings(ctx: CanvasPath, P: Projector, rings: readonly Ring[], k = 1): void {
  for (const r of rings) {
    P.pt(r[0]!, r[1]!, k, tmp);
    ctx.moveTo(tmp[0], tmp[1]);
    for (let i = 2; i < r.length; i += 2) {
      P.pt(r[i]!, r[i + 1]!, k, tmp);
      ctx.lineTo(tmp[0], tmp[1]);
    }
    ctx.closePath();
  }
}

// Adds a polyline; long segments are subdivided so the wobble bends them a little.
export function addLine(ctx: CanvasPath, P: Projector, p: Line, maxSeg: number, k = 1): void {
  let x0 = p[0]!, y0 = p[1]!;
  P.pt(x0, y0, k, tmp);
  ctx.moveTo(tmp[0], tmp[1]);
  for (let i = 2; i < p.length; i += 2) {
    const x1 = p[i]!, y1 = p[i + 1]!;
    const n = k ? Math.min(40, Math.ceil((Math.hypot(x1 - x0, y1 - y0) * P.S) / maxSeg)) : 1;
    for (let j = 1; j <= n; j++) {
      const t = j / n;
      P.pt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, k, tmp);
      ctx.lineTo(tmp[0], tmp[1]);
    }
    x0 = x1; y0 = y1;
  }
}

// Erases everything outside the square plate and feathers its edges (destination-out).
export function fadePlate(ctx: CanvasRenderingContext2D, P: Projector, half: number): void {
  const { S, dpr } = P;
  const x0 = P.sx(-half), x1 = P.sx(half);
  const y0 = P.sy(half), y1 = P.sy(-half);
  const f = Math.min((x1 - x0) * 0.14, Math.max(50 * dpr, 170 * S));
  const { width: W, height: H } = ctx.canvas;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.fillStyle = '#000';
  ctx.fill('evenodd');
  const strip = (gx0: number, gy0: number, gx1: number, gy1: number, rx: number, ry: number, rw: number, rh: number): void => {
    const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.35, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
  };
  strip(x0, 0, x0 + f, 0, x0, y0, f, y1 - y0);
  strip(x1, 0, x1 - f, 0, x1 - f, y0, f, y1 - y0);
  strip(0, y0, 0, y0 + f, x0, y0, x1 - x0, f);
  strip(0, y1, 0, y1 - f, x0, y1 - f, x1 - x0, f);
  ctx.restore();
}
