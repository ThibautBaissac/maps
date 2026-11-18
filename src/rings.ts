// Plane geometry of flat rings ([x0, y0, x1, y1, …], local metres), shared by the OSM
// conversion and the subjects. Runs in the browser and in Node: no DOM, no Node API.
import type { Ring } from './layers.ts';
import type { Point, Rect } from './toolkit/geometry.ts';

// An index bounded by the length (stepping by 2) is always defined, hence the `!` below.

/** Mean of the ring's vertices: inside any convex or nearly convex footprint. */
export function ringCentroid(r: Ring): Point {
  let x = 0, y = 0;
  const n = r.length / 2;
  for (let i = 0; i < r.length; i += 2) { x += r[i]!; y += r[i + 1]!; }
  return [x / n, y / n];
}

/** Even-odd test of a point against one ring. */
export function inRing([x, y]: Point, r: Ring): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    const xi = r[i]!, yi = r[i + 1]!, xj = r[j]!, yj = r[j + 1]!;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Unsigned area of one ring, m². */
export function ringArea(r: Ring): number {
  let s = 0;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) s += r[j]! * r[i + 1]! - r[i]! * r[j + 1]!;
  return Math.abs(s) / 2;
}

/** Bounding box of one ring. */
export function ringBox(r: Ring): Rect {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (let i = 0; i < r.length; i += 2) {
    const x = r[i]!, y = r[i + 1]!;
    if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y;
  }
  return [a, b, c, d];
}

/**
 * For each item of `inner`, the index of the first outline of `outer` holding its centre,
 * or -1. Outlines are tested on their outer ring.
 */
export function owners(outer: readonly { g: Ring[] }[], inner: readonly { g: Ring[] }[]): number[] {
  const boxes = outer.map((o) => ringBox(o.g[0]!));
  return inner.map((part) => {
    const p = ringCentroid(part.g[0]!);
    return outer.findIndex((o, k) => {
      const [a, b, c, d] = boxes[k]!;
      return p[0] >= a && p[0] <= c && p[1] >= b && p[1] <= d && inRing(p, o.g[0]!);
    });
  });
}
