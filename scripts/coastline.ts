import type { Line, Ring, Water } from '../src/data.ts';

// Coordinate pairs are complete in the OSM data, hence the bounded index assertions.
/** Rounds to the 0.1 m precision of the data files. */
export const r1 = (v: number): number => Math.round(v * 10) / 10;
/** The point at index i of a line, as a string to match endpoints. */
export const endpointKey = (a: Line, i: number): string => `${a[i]},${a[i + 1]}`;
const key = endpointKey;

// Sea and estuaries are not water areas in OSM but coastline ways (land on the left,
// water on the right). Turns those crossing the square [-H, H]² into water polygons.
export function seaPolygons(lines: readonly Line[], H: number): Water[] {
  // Directed chains: a way's end joins the next way's start.
  const pool = lines.filter((l) => l.length >= 4).map((l) => l.slice());
  const chains: Line[] = [];
  let first: Line | undefined;
  while ((first = pool.shift())) {
    let c = first;
    for (let grown = true; grown;) {
      grown = false;
      const i = pool.findIndex((l) => key(l, 0) === key(c, c.length - 2));
      if (i >= 0) { c = c.concat(pool.splice(i, 1)[0]!.slice(2)); grown = true; continue; }
      const j = pool.findIndex((l) => key(l, l.length - 2) === key(c, 0));
      if (j >= 0) { c = pool.splice(j, 1)[0]!.concat(c.slice(2)); grown = true; }
    }
    chains.push(c);
  }
  const inside = (x: number, y: number): boolean => Math.abs(x) <= H && Math.abs(y) <= H;
  const onEdge = (x: number, y: number): boolean => Math.abs(Math.abs(x) - H) < 0.05 || Math.abs(Math.abs(y) - H) < 0.05;
  // Clockwise position along the square's border, from the north-west corner, in [0, 4).
  const along = (x: number, y: number): number => {
    if (Math.abs(y - H) < 0.05) return (x + H) / (2 * H);
    if (Math.abs(x - H) < 0.05) return 1 + (H - y) / (2 * H);
    if (Math.abs(y + H) < 0.05) return 2 + (H - x) / (2 * H);
    return 3 + (y + H) / (2 * H);
  };
  const corners: [number, number][] = [[-H, H], [H, H], [H, -H], [-H, -H]]; // at positions 0, 1, 2, 3
  // Liang–Barsky: part of segment a→b inside the square, as [t0, t1], or null.
  const clip = (ax: number, ay: number, bx: number, by: number): [number, number] | null => {
    let t0 = 0, t1 = 1;
    const dx = bx - ax, dy = by - ay;
    const edges: [number, number][] = [[-dx, ax + H], [dx, H - ax], [-dy, ay + H], [dy, H - ay]];
    for (const [p, q] of edges) {
      if (p === 0) { if (q < 0) return null; continue; }
      const r = q / p;
      if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
    return [t0, t1];
  };

  interface Piece { p: Line; tin: number; tout: number }
  const pieces: Line[] = [], islands: Ring[] = [];
  for (let c of chains) {
    const closed = key(c, 0) === key(c, c.length - 2);
    if (closed && c.every((v, i) => i % 2 || inside(v, c[i + 1]!))) { islands.push(c); continue; }
    if (closed) {
      // Start outside so a clipped ring cannot split at an interior vertex.
      const outside = c.findIndex((v, i) => i % 2 === 0 && !inside(v, c[i + 1]!));
      c = c.slice(outside, -2).concat(c.slice(0, outside + 2));
    }
    let cur: Line | null = null;
    for (let i = 2; i < c.length; i += 2) {
      const ax = c[i - 2]!, ay = c[i - 1]!, bx = c[i]!, by = c[i + 1]!;
      const t = clip(ax, ay, bx, by);
      if (!t) continue;
      const p0 = [r1(ax + (bx - ax) * t[0]), r1(ay + (by - ay) * t[0])];
      const p1 = [r1(ax + (bx - ax) * t[1]), r1(ay + (by - ay) * t[1])];
      cur ??= [...p0];
      cur.push(...p1);
      if (t[1] < 1) { pieces.push(cur); cur = null; }
    }
    if (cur) pieces.push(cur); // ends inside: incomplete data, dropped below
  }
  const ok: Piece[] = pieces
    .filter((p) => p.length >= 4 && onEdge(p[0]!, p[1]!) && onEdge(p.at(-2)!, p.at(-1)!))
    .map((p) => ({ p, tin: along(p[0]!, p[1]!), tout: along(p.at(-2)!, p.at(-1)!) }));

  // Follow each piece, then the border clockwise to the next piece's entry, until closed.
  const polys: { r: Ring[] }[] = [];
  const used = new Set<Piece>();
  for (const start of ok) {
    if (used.has(start)) continue;
    used.add(start);
    const ring: Ring = [...start.p];
    let cur = start;
    for (let guard = 0; guard < ok.length + 1; guard++) {
      const t = cur.tout;
      let next: Piece | null = null, best = Infinity;
      for (const pc of ok) {
        if (used.has(pc) && pc !== start) continue;
        const d = (pc.tin - t + 4) % 4;
        if (d < best) { best = d; next = pc; }
      }
      for (let k = 1; k <= 4; k++) {
        const ck = Math.ceil(t + 1e-9) + k - 1; // corners after t, clockwise
        if (ck - t >= best) break;
        ring.push(...corners[ck % 4]!);
      }
      if (next === start || !next) break;
      used.add(next);
      ring.push(...next.p);
      cur = next;
    }
    polys.push({ r: [ring] });
  }
  if (!polys.length && islands.length) {
    polys.push({ r: [[-H, H, H, H, H, -H, -H, -H]] });
  }
  // Each island becomes a hole of the one sea polygon that contains it.
  const contains = (ring: Ring, x: number, y: number): boolean => {
    let inPoly = false;
    for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
      const xi = ring[i]!, yi = ring[i + 1]!, xj = ring[j]!, yj = ring[j + 1]!;
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inPoly = !inPoly;
    }
    return inPoly;
  };
  for (const isl of islands) polys.find((p) => contains(p.r[0]!, isl[0]!, isl[1]!))?.r.push(isl);
  return polys;
}
