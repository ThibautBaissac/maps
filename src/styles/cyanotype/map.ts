// The drawing itself: white linework on transparent, rendered once per settled view.
// Buildings in outline, parks cross-hatched, water as a flat tint with a shoreline,
// streets as double lines (single at small scale), stairs as ladders.
import { featuresOf, isBridge, isRoadKind, isTunnel, type Layer, type Line, type Ring, type RoadKind } from '../../layers.ts';
import { context2d, makeCanvas, pattern } from '../../toolkit/canvas.ts';
import { isKeyOf, recordOf, typedKeys, type Point } from '../../toolkit/geometry.ts';
import { addLine, addRings, withBox, type Projector, type WithBox } from '../../toolkit/projection.ts';
import type { CyanotypeOptions } from './defaults.ts';

/** A road as the map draws it: highway kind, polyline, name, bridge and tunnel flags. */
interface Road { k: RoadKind; p: Line; n?: string; b?: 1; u?: 1 }
/** A stream, canal or other waterway; `u` marks a tunnel or culvert. */
interface Waterway { k: string; p: Line; n?: string; u?: 1 }
/** A water area: rings, outer ones first, then holes. */
interface Water { r: Ring[]; n?: string }
interface Park { k: string; r: Ring[] }

// Flat coordinate arrays hold [x, y] pairs: an index bounded by the length (stepping by 2)
// is always defined, hence the `!` in the loops below.

// Street width in metres when drawn as a double line, and the smallest gap (CSS px)
// it keeps when zoomed out. Gaps under CASED px fall back to a single line.
const CASED = 2.4;
const STREETS = {
  motorway: { m: 18, min: 3.4 }, trunk: { m: 16, min: 3.2 }, primary: { m: 14, min: 3 },
  secondary: { m: 12, min: 2.8 }, tertiary: { m: 10, min: 2.4 },
  motorway_link: { m: 8, min: 0 }, trunk_link: { m: 8, min: 0 }, primary_link: { m: 8, min: 0 },
  secondary_link: { m: 7, min: 0 }, tertiary_link: { m: 7, min: 0 },
  unclassified: { m: 7, min: 0 }, residential: { m: 7, min: 0 },
  living_street: { m: 5.5, min: 0 }, pedestrian: { m: 5.5, min: 0 }, service: { m: 4, min: 0 },
} satisfies Partial<Record<RoadKind, { m: number; min: number }>>;
type StreetKind = keyof typeof STREETS;
const STREET_ORDER = typedKeys(STREETS).reverse(); // thin first

// Paths: minimum zoom (px/m) and dash pattern in CSS px.
const PATHS = {
  footway: { min: 0.9, dash: [3, 2] }, cycleway: { min: 0.9, dash: [4, 2] },
  path: { min: 1.1, dash: [1.5, 2] }, track: { min: 1.1, dash: [5, 2.5] },
} satisfies Partial<Record<RoadKind, { min: number; dash: number[] }>>;
type PathKind = keyof typeof PATHS;
const PATH_ORDER = typedKeys(PATHS);

export interface PreparedMap {
  buildings: WithBox<{ r: Ring[] }>[];
  water: WithBox<Water>[];
  parks: WithBox<Park>[];
  streams: WithBox<Waterway>[];
  streets: Record<StreetKind, WithBox<Road>[]>;
  paths: Record<PathKind, WithBox<Road>[]>;
  steps: WithBox<Road>[];
  half: number;
}

export function prepareMap(layers: readonly Layer[], half: number): PreparedMap {
  const streets = recordOf(STREET_ORDER, (): WithBox<Road>[] => []);
  const paths = recordOf(PATH_ORDER, (): WithBox<Road>[] => []);
  const steps: WithBox<Road>[] = [];
  for (const f of featuresOf(layers, 'roads', 'lines')) {
    if (!f.k || !isRoadKind(f.k)) continue;
    const r: Road = { k: f.k, p: f.g, ...(f.n !== undefined && { n: f.n }), ...(isBridge(f) && { b: 1 as const }), ...(isTunnel(f) && { u: 1 as const }) };
    const it = withBox(r, [r.p]);
    if (isKeyOf(streets, r.k)) streets[r.k].push(it);
    else if (isKeyOf(paths, r.k)) paths[r.k].push(it);
    else if (r.k === 'steps') steps.push(it);
  }
  return {
    buildings: featuresOf(layers, 'buildings', 'areas').map((f) => withBox({ r: f.g }, f.g)),
    water: featuresOf(layers, 'water', 'areas').map((f) => withBox({ r: f.g, ...(f.n !== undefined && { n: f.n }) }, f.g)),
    parks: featuresOf(layers, 'parks', 'areas').map((f) => withBox({ k: f.k ?? '', r: f.g }, f.g)),
    streams: featuresOf(layers, 'waterways', 'lines').filter((f) => !isTunnel(f))
      .map((f) => withBox({ k: f.k ?? '', p: f.g, ...(f.n !== undefined && { n: f.n }) }, [f.g])),
    streets, paths, steps,
    half,
  };
}

// Screen-scale cross-hatching (same pitch at every zoom).
export function makeHatch(ctx: CanvasRenderingContext2D, dpr: number, pitch: number, color: string): CanvasPattern {
  const p = Math.max(3, Math.round(pitch * dpr));
  const tile = makeCanvas(p, p);
  const t = context2d(tile);
  t.fillStyle = color;
  const lw = Math.max(1, Math.round(0.6 * dpr));
  t.fillRect(0, 0, p, lw);
  t.fillRect(0, 0, lw, p);
  const pat = pattern(ctx, tile, 'repeat');
  pat.setTransform(new DOMMatrix().rotateSelf(45));
  return pat;
}

const streetGap = (k: StreetKind, s: number): number => Math.max(STREETS[k].min, STREETS[k].m * s);

// A flat water tint and the shoreline; no depth information is implied.
function drawWater(ctx: CanvasRenderingContext2D, tmp: CanvasRenderingContext2D, M: PreparedMap, P: Projector, o: CyanotypeOptions): void {
  const { dpr } = P;
  const water = M.water.filter((w) => P.visible(w.bb));
  if (!water.length) return;
  const fill = new Path2D();
  for (const w of water) addRings(fill, P, w.r, 0);
  // Shore only: skip edges lying on the border of the downloaded square.
  const shore = new Path2D();
  const e = M.half - 1;
  const onEdge = (x: number, y: number): boolean => Math.abs(x) >= e || Math.abs(y) >= e;
  const pt: Point = [0, 0];
  for (const w of water) for (const r of w.r) {
    let pen = false;
    for (let i = 0; i < r.length; i += 2) {
      const j = (i + 2) % r.length;
      const a = onEdge(r[i]!, r[i + 1]!) && onEdge(r[j]!, r[j + 1]!);
      if (a) { pen = false; continue; }
      if (!pen) { P.pt(r[i]!, r[i + 1]!, 0, pt); shore.moveTo(pt[0], pt[1]); pen = true; }
      P.pt(r[j]!, r[j + 1]!, 0, pt);
      shore.lineTo(pt[0], pt[1]);
    }
  }
  const t = tmp;
  t.setTransform(1, 0, 0, 1, 0, 0);
  t.clearRect(0, 0, t.canvas.width, t.canvas.height);
  t.lineJoin = 'round';
  t.strokeStyle = o.line;
  t.globalAlpha = 0.12;
  t.fillStyle = o.line;
  t.fill(fill, 'evenodd');
  t.globalAlpha = 1;
  t.lineWidth = 1.1 * dpr;
  t.stroke(shore);
  ctx.drawImage(t.canvas, 0, 0);
}

// Ladder ticks across a polyline (stairs), every `gap` device px.
function ladder(ctx: CanvasRenderingContext2D, P: Projector, p: Line, gap: number, half: number): void {
  const a: Point = [0, 0], b: Point = [0, 0];
  let carry = gap / 2;
  for (let i = 2; i < p.length; i += 2) {
    P.pt(p[i - 2]!, p[i - 1]!, 0, a);
    P.pt(p[i]!, p[i + 1]!, 0, b);
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (!len) continue;
    const nx = (-dy / len) * half, ny = (dx / len) * half;
    let t = carry;
    for (; t < len; t += gap) {
      const x = a[0] + (dx * t) / len, y = a[1] + (dy * t) / len;
      ctx.moveTo(x - nx, y - ny);
      ctx.lineTo(x + nx, y + ny);
    }
    carry = t - len;
  }
}

export function renderMap(ctx: CanvasRenderingContext2D, tmp: CanvasRenderingContext2D, M: PreparedMap, P: Projector, o: CyanotypeOptions, hatch: CanvasPattern): void {
  const { dpr } = P;
  const s = P.view.s;
  ctx.strokeStyle = o.line;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'butt';

  // Parks: cross-hatching and a fine outline.
  const parks = new Path2D();
  for (const p of M.parks) if (P.visible(p.bb)) addRings(parks, P, p.r, 0);
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = hatch;
  ctx.fill(parks, 'nonzero');
  ctx.globalAlpha = 1;
  ctx.lineWidth = 0.6 * dpr;
  ctx.stroke(parks);

  drawWater(ctx, tmp, M, P, o);

  // Streams and drains; navigation channels (fairways) as a faint dashed line.
  ctx.lineWidth = 0.8 * dpr;
  ctx.beginPath();
  for (const w of M.streams) if (w.k !== 'fairway' && P.visible(w.bb)) addLine(ctx, P, w.p, 1e9, 0);
  ctx.stroke();
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 0.6 * dpr;
  ctx.setLineDash([8 * dpr, 4 * dpr, 1.5 * dpr, 4 * dpr]);
  ctx.beginPath();
  for (const w of M.streams) if (w.k === 'fairway' && P.visible(w.bb)) addLine(ctx, P, w.p, 1e9, 0);
  ctx.stroke();
  ctx.restore();

  // Buildings: outline only, in small batches (one huge path is slow).
  ctx.lineWidth = Math.min(1.1, o.building * Math.pow(Math.max(1, s), 0.15)) * dpr;
  ctx.globalAlpha = s < 0.5 ? 0.8 : 0.95;
  let n = 0;
  ctx.beginPath();
  for (const b of M.buildings) {
    if (!P.visible(b.bb)) continue;
    addRings(ctx, P, b.r, 0);
    if (++n % 250 === 0) { ctx.stroke(); ctx.beginPath(); }
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Paths and stairs, single fine lines.
  ctx.lineWidth = 0.6 * dpr;
  for (const k of PATH_ORDER) {
    const st = PATHS[k];
    if (s < st.min) continue;
    ctx.setLineDash(st.dash.map((d) => d * dpr));
    ctx.beginPath();
    for (const r of M.paths[k]) if (P.visible(r.bb)) addLine(ctx, P, r.p, 1e9, 0);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  if (s >= 0.9) {
    ctx.beginPath();
    for (const r of M.steps) if (P.visible(r.bb)) addLine(ctx, P, r.p, 1e9, 0);
    ctx.stroke();
    if (s >= 1.8) {
      ctx.lineWidth = 0.5 * dpr;
      ctx.beginPath();
      const gap = Math.max(2.6 * dpr, 0.9 * s * dpr), half = Math.min(1.6 * s, 6) * dpr;
      for (const r of M.steps) if (P.visible(r.bb)) ladder(ctx, P, r.p, gap, half);
      ctx.stroke();
    }
  }

  // Streets too narrow on screen for a double line.
  const lw = o.road * dpr;
  const cased: { k: StreetKind; gap: number; list: WithBox<Road>[] }[] = [];
  for (const k of STREET_ORDER) {
    const gap = streetGap(k, s);
    if (k === 'service' && s < 0.8) continue;
    const list = M.streets[k].filter((r) => P.visible(r.bb));
    if (gap >= CASED) { cased.push({ k, gap: gap * dpr, list }); continue; }
    ctx.lineWidth = (gap < 1.2 ? 0.7 : 1) * dpr;
    ctx.setLineDash(k === 'service' ? [3 * dpr, 1.5 * dpr] : []);
    ctx.beginPath();
    for (const r of list) addLine(ctx, P, r.p, 1e9, 0);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Double lines: white corridor, then its inside erased, so crossings merge cleanly.
  const strokeAll = (pick: (r: Road) => boolean, extra: number): void => {
    for (const c of cased) {
      ctx.lineWidth = c.gap + extra;
      ctx.beginPath();
      for (const r of c.list) if (pick(r)) addLine(ctx, P, r.p, 1e9, 0);
      ctx.stroke();
    }
  };
  const ground = (r: Road): boolean => !r.b && !r.u;
  const bridge = (r: Road): boolean => !!r.b;
  ctx.lineCap = 'round';
  strokeAll(ground, 2 * lw);
  ctx.globalCompositeOperation = 'destination-out';
  strokeAll(ground, 0);
  // Bridges cut through whatever they cross, then get their own double line.
  ctx.lineCap = 'butt';
  strokeAll(bridge, 2 * lw + 3 * dpr);
  ctx.globalCompositeOperation = 'source-over';
  strokeAll(bridge, 2 * lw);
  ctx.globalCompositeOperation = 'destination-out';
  strokeAll(bridge, 0);
  ctx.globalCompositeOperation = 'source-over';
  // Tunnels: dashed centre line.
  ctx.lineWidth = 0.7 * dpr;
  ctx.setLineDash([4 * dpr, 3 * dpr]);
  ctx.beginPath();
  for (const c of cased) for (const r of c.list) if (r.u && !r.b) addLine(ctx, P, r.p, 1e9, 0);
  ctx.stroke();
  ctx.setLineDash([]);
}
