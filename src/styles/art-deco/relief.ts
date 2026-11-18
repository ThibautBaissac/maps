// The 2.5D plan: flat ground (streets, parks, water), cast shadows, then every building
// raised to its OSM height in an oblique view, back to front. A roof is the footprint
// shifted by (tiltX, tiltY) per metre of height; only the walls facing the viewer are drawn.
import { baseOf, featuresOf, hasParts, heightOf, isTunnel, type Feature, type Layer, type Line, type Ring } from '../../layers.ts';
import type { Rect } from '../../toolkit/geometry.ts';
import { bboxOf, type Projector } from '../../toolkit/projection.ts';
import type { TopicAnalysis } from '../../topics.ts';
import type { ArtDecoOptions } from './defaults.ts';

// Flat coordinate arrays hold [x, y] pairs: an index bounded by the length (stepping by 2)
// is always defined, hence the `!` in the loops below.

/** What a volume shows: the subject's two tower forms, ordinary buildings, or the two alternating inks without subject. */
export type Tone = 'stepped' | 'block' | 'plain' | 'inkA' | 'inkB';

export interface Prism {
  rings: Ring[];
  /** Bottom and top heights, m. */
  base: number;
  top: number;
  tone: Tone;
  bb: Rect;
  /** Outer ring edges facing the viewer: start vertex index and whether the light falls on it. */
  front: { i: number; lit: boolean }[];
}

export interface Ground {
  major: Line[];
  minor: Line[];
  paths: Line[];
  parks: Ring[][];
  water: Ring[][];
}

export interface Plan { ground: Ground; prisms: Prism[] }

export interface Inks { roof: string; lit: string; shade: string }
export type Palette = Record<Tone, Inks> & { ground: string; street: string; shadow: string; park: string; water: string };

/** Parts lower than this share of their tower's height keep the ordinary tone. */
const LOW_SHARE = 0.25;
const MAJOR = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link']);
const MINOR = new Set(['residential', 'unclassified', 'living_street', 'pedestrian', 'service']);

/** Mixes two #RRGGBB colours, t of the second. */
export function mix(a: string, b: string, t: number): string {
  const ch = (c: string, i: number): number => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
  return '#' + [0, 1, 2].map((i) => Math.round(ch(a, i) * (1 - t) + ch(b, i) * t).toString(16).padStart(2, '0')).join('');
}

export function palette(o: ArtDecoOptions): Palette {
  const ground = mix(o.cream, o.gold, 0.2);
  const ink = (base: string, roof: string): Inks => ({ roof, lit: base, shade: mix(base, o.navy, 0.42) });
  return {
    stepped: ink(o.red, o.gold),
    block: { roof: mix(o.navy, o.cream, 0.55), lit: mix(o.navy, o.cream, 0.28), shade: o.navy },
    plain: { roof: mix(o.cream, '#FFFFFF', 0.45), lit: mix(o.cream, o.navy, 0.13), shade: mix(o.cream, o.navy, 0.27) },
    inkA: ink(o.red, mix(o.red, o.cream, 0.35)),
    inkB: ink(o.gold, mix(o.gold, o.cream, 0.4)),
    ground, street: o.cream, shadow: mix(ground, o.navy, 0.2), park: o.green, water: o.navy,
  };
}

/** Signed area of a ring, positive when counter-clockwise (y north). */
function signedArea(r: Ring): number {
  let s = 0;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) s += r[j]! * r[i + 1]! - r[i]! * r[j + 1]!;
  return s / 2;
}

/** Edges of the outer ring whose outward normal looks against the tilt, lit when it also faces the light. */
function frontEdges(r: Ring, o: ArtDecoOptions): Prism['front'] {
  const ccw = signedArea(r) > 0;
  const front: Prism['front'] = [];
  for (let i = 0; i + 3 < r.length; i += 2) {
    const dx = r[i + 2]! - r[i]!, dy = r[i + 3]! - r[i + 1]!;
    if (!dx && !dy) continue;
    const nx = ccw ? dy : -dy, ny = ccw ? -dx : dx;
    if (nx * o.tiltX + ny * o.tiltY >= 0) continue;
    // The light comes from opposite the cast shadow.
    front.push({ i, lit: -(nx * o.shadowX + ny * o.shadowY) > 0 });
  }
  return front;
}

/** Closes a ring that does not repeat its first point. */
const closed = (r: Ring): Ring => (r[0] === r.at(-2) && r[1] === r.at(-1) ? r : [...r, r[0]!, r[1]!]);

/** Tones of the subject's towers and their parts; without subject, buildings alternate the two inks. */
function tones(topic: TopicAnalysis | undefined): Map<Feature<Ring[]>, Tone> {
  const map = new Map<Feature<Ring[]>, Tone>();
  if (topic?.id !== 'setbacks') return map;
  for (const t of topic.towers) {
    const tone: Tone = t.form === 'stepped' ? 'stepped' : t.form === 'block' ? 'block' : 'plain';
    if (!t.parts.length) map.set(t.feature, tone);
    // Low wings and podiums stay ordinary: the colour follows the tower, not a whole block.
    for (const p of t.parts) map.set(p, (heightOf(p) ?? 0) >= t.top * LOW_SHARE ? tone : 'plain');
  }
  return map;
}

export function preparePlan(layers: readonly Layer[], o: ArtDecoOptions, topic: TopicAnalysis | undefined): Plan {
  const roads = featuresOf(layers, 'roads', 'lines').filter((r) => !isTunnel(r));
  const ground: Ground = {
    major: roads.filter((r) => MAJOR.has(r.k ?? '')).map((r) => r.g),
    minor: roads.filter((r) => MINOR.has(r.k ?? '')).map((r) => r.g),
    paths: roads.filter((r) => !MAJOR.has(r.k ?? '') && !MINOR.has(r.k ?? '')).map((r) => r.g),
    parks: featuresOf(layers, 'parks', 'areas').map((f) => f.g),
    water: featuresOf(layers, 'water', 'areas').map((f) => f.g),
  };
  const byFeature = tones(topic);
  const subject = topic?.id === 'setbacks';
  const prisms: (Prism & { order: number })[] = [];
  const add = (f: Feature<Ring[]>, base: number, top: number, tone: Tone): void => {
    const rings = f.g.map(closed);
    const outer = rings[0];
    if (!outer || outer.length < 8) return;
    const bb = bboxOf([outer]);
    const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;
    // Farther along the tilt first; a part that starts higher comes after what it stands on.
    prisms.push({ rings, base, top, tone, bb, front: frontEdges(outer, o), order: cx * o.tiltX + cy * o.tiltY - base });
  };
  featuresOf(layers, 'buildings', 'areas').forEach((b, i) => {
    const tone = byFeature.get(b) ?? (subject ? 'plain' : i % 2 ? 'inkA' : 'inkB');
    // A building described by parts keeps only its footprint on the ground; its parts make the volume.
    add(b, 0, hasParts(b) ? 0 : heightOf(b) ?? o.defaultHeight, tone);
  });
  for (const p of featuresOf(layers, 'building-parts', 'areas')) {
    const top = heightOf(p);
    if (top === undefined || top <= baseOf(p)) continue;
    add(p, baseOf(p), top, byFeature.get(p) ?? (subject ? 'plain' : 'inkA'));
  }
  prisms.sort((a, b) => b.order - a.order);
  return { ground, prisms: prisms.map(({ order: _, ...p }) => p) };
}

function addLines(ctx: CanvasRenderingContext2D, P: Projector, lines: readonly Line[]): void {
  for (const p of lines) {
    ctx.moveTo(P.sx(p[0]!), P.sy(p[1]!));
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(P.sx(p[i]!), P.sy(p[i + 1]!));
  }
}

function addRingsShifted(ctx: CanvasRenderingContext2D, P: Projector, rings: readonly Ring[], dx: number, dy: number): void {
  for (const r of rings) {
    ctx.moveTo(P.sx(r[0]!) + dx, P.sy(r[1]!) + dy);
    for (let i = 2; i < r.length; i += 2) ctx.lineTo(P.sx(r[i]!) + dx, P.sy(r[i + 1]!) + dy);
    ctx.closePath();
  }
}

/** Streets, parks and water, flat. */
export function drawGround(ctx: CanvasRenderingContext2D, P: Projector, g: Ground, c: Palette): void {
  const { S, dpr } = P;
  const { width: W, height: H } = ctx.canvas;
  ctx.fillStyle = c.ground;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = c.park;
  ctx.beginPath();
  for (const rings of g.parks) addRingsShifted(ctx, P, rings, 0, 0);
  ctx.fill('evenodd');
  ctx.fillStyle = c.water;
  ctx.beginPath();
  for (const rings of g.water) addRingsShifted(ctx, P, rings, 0, 0);
  ctx.fill('evenodd');
  ctx.strokeStyle = c.street;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const stroke = (lines: readonly Line[], metres: number, minPx: number): void => {
    ctx.lineWidth = Math.max(minPx * dpr, metres * S);
    ctx.beginPath(); addLines(ctx, P, lines); ctx.stroke();
  };
  if (S > 0.9 * dpr) stroke(g.paths, 2.5, 0.8);
  stroke(g.minor, 10, 1.2);
  stroke(g.major, 17, 2);
}

/** A ring as a closed subpath of `path`, shifted by (dx, dy) metres, reversed if asked. */
function ringPath(path: Path2D, r: Ring, dx: number, dy: number, reverse = false): void {
  const n = r.length / 2;
  for (let k = 0; k < n; k++) {
    const i = (reverse ? n - 1 - k : k) * 2;
    if (k) path.lineTo(r[i]! + dx, r[i + 1]! + dy); else path.moveTo(r[i]! + dx, r[i + 1]! + dy);
  }
  path.closePath();
}

/** The prism's paths in map metres: the view only changes the transform they are filled with. */
interface PrismPaths { lit: Path2D | null; shade: Path2D | null; roof: Path2D; shadow: Path2D | null }

function buildPaths(p: Prism, o: ArtDecoOptions): PrismPaths {
  const r = p.rings[0]!;
  const bx = o.tiltX * p.base, by = o.tiltY * p.base, tx = o.tiltX * p.top, ty = o.tiltY * p.top;
  const walls = (lit: boolean): Path2D | null => {
    const edges = p.front.filter((e) => e.lit === lit);
    if (!edges.length || p.top <= p.base) return null;
    const path = new Path2D();
    for (const { i } of edges) {
      const ax = r[i]!, ay = r[i + 1]!, qx = r[i + 2]!, qy = r[i + 3]!;
      path.moveTo(ax + bx, ay + by); path.lineTo(qx + bx, qy + by); path.lineTo(qx + tx, qy + ty); path.lineTo(ax + tx, ay + ty);
      path.closePath();
    }
    return path;
  };
  const roof = new Path2D();
  for (const ring of p.rings) ringPath(roof, ring, tx, ty);
  let shadow: Path2D | null = null;
  if (p.top > 0) {
    // The footprint swept along the shadow, every subpath counter-clockwise so a nonzero fill joins them.
    shadow = new Path2D();
    const sx = o.shadowX * p.top, sy = o.shadowY * p.top;
    for (let i = 0; i + 3 < r.length; i += 2) {
      const ax = r[i]!, ay = r[i + 1]!, qx = r[i + 2]!, qy = r[i + 3]!;
      if ((qx - ax) * sy - (qy - ay) * sx >= 0) { shadow.moveTo(ax, ay); shadow.lineTo(qx, qy); shadow.lineTo(qx + sx, qy + sy); shadow.lineTo(ax + sx, ay + sy); }
      else { shadow.moveTo(ax, ay); shadow.lineTo(ax + sx, ay + sy); shadow.lineTo(qx + sx, qy + sy); shadow.lineTo(qx, qy); }
      shadow.closePath();
    }
    ringPath(shadow, r, sx, sy, signedArea(r) < 0);
  }
  return { lit: walls(true), shade: walls(false), roof, shadow };
}

/** Bounding box of a raised prism with its shadow, map metres. */
function reach(p: Prism, o: ArtDecoOptions): Rect {
  const h = p.top;
  return [
    p.bb[0] + Math.min(0, o.tiltX * h, o.shadowX * h), p.bb[1] + Math.min(0, o.tiltY * h, o.shadowY * h),
    p.bb[2] + Math.max(0, o.tiltX * h, o.shadowX * h), p.bb[3] + Math.max(0, o.tiltY * h, o.shadowY * h),
  ];
}

const cache = new WeakMap<Prism, PrismPaths>();
const pathsOf = (p: Prism, o: ArtDecoOptions): PrismPaths => {
  let paths = cache.get(p);
  if (!paths) { paths = buildPaths(p, o); cache.set(p, paths); }
  return paths;
};

/** Cast shadows, then every volume back to front. */
export function drawVolumes(ctx: CanvasRenderingContext2D, P: Projector, prisms: readonly Prism[], c: Palette, o: ArtDecoOptions): void {
  const { S, dpr } = P;
  const visible = prisms.filter((p) => P.visible(reach(p, o)));
  ctx.save();
  // Map metres (y north) to device px.
  ctx.setTransform(S, 0, 0, -S, P.sx(0), P.sy(0));
  ctx.fillStyle = c.shadow;
  for (const p of visible) {
    const { shadow } = pathsOf(p, o);
    if (shadow && p.top * S * Math.hypot(o.shadowX, o.shadowY) >= 1.5 * dpr) ctx.fill(shadow, 'nonzero');
  }
  const minWall = 0.6 * dpr / (S * Math.hypot(o.tiltX, o.tiltY));
  for (const p of visible) {
    const inks = c[p.tone], paths = pathsOf(p, o);
    if (p.top - p.base >= minWall) {
      if (paths.lit) { ctx.fillStyle = inks.lit; ctx.fill(paths.lit); }
      if (paths.shade) { ctx.fillStyle = inks.shade; ctx.fill(paths.shade); }
    }
    ctx.fillStyle = inks.roof;
    ctx.fill(paths.roof, 'evenodd');
  }
  ctx.restore();
}
