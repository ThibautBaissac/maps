// Street and waterway name placement along their lines (style-independent).
// Styles decide which names, sizes and inks; they also draw the returned glyphs.
import type { Line, MapData, RoadKind } from '../data.ts';
import type { Point, Rect } from './geometry.ts';
import type { Projector } from './projection.ts';

// Flat coordinate arrays hold [x, y] pairs: an index bounded by the length (stepping by 2)
// is always defined, hence the `!` in the loops below.

const STREET_WEIGHT: Partial<Record<RoadKind, number>> = {
  motorway: 5, trunk: 5, primary: 5, secondary: 4, tertiary: 3.5,
  primary_link: 2, secondary_link: 2, tertiary_link: 2,
  pedestrian: 2.4, unclassified: 1.5, residential: 1.5, living_street: 1.2,
};

/** Joined polyline and its length (metres). */
export interface Chain { p: Line; len: number }

/** One name and all its lines. */
export interface LabelItem {
  name: string;
  /** Importance weight of the name (largest of its lines). */
  w: number;
  chains: Chain[];
  score: number;
}

export interface Labels { streets: LabelItem[]; canals: LabelItem[] }

/** Names placed together with the same look; `kind` is the style's own tag for them. */
export interface LabelGroup<K extends string> {
  items: LabelItem[];
  kind: K;
  /** CSS px. */
  size: number;
  /** Letter spacing, CSS px. */
  spacing: number;
  /** Most copies of one name. */
  maxPer: number;
  /** Capitals (default) or the name as written. */
  upper?: boolean;
}

/** One letter, device px, rotated by `a` radians. */
export interface Glyph { x: number; y: number; a: number; cw: number }

export interface LabelJob<K extends string> {
  kind: K;
  font: string;
  size: number;
  text: string[];
  glyphs: Glyph[];
}

interface Named { n?: string; p: Line }

// Joins open polylines sharing endpoints into longer chains.
function joinChains(lines: readonly Line[]): Chain[] {
  const key = (p: Line, i: number): string => `${p[i]},${p[i + 1]}`;
  const rev = (p: Line): Line => { const o: Line = []; for (let i = p.length - 2; i >= 0; i -= 2) o.push(p[i]!, p[i + 1]!); return o; };
  const pool = lines.map((l) => l.slice());
  const out: Line[] = [];
  let first: Line | undefined;
  while ((first = pool.shift())) {
    let c = first;
    let grown = true;
    while (grown) {
      grown = false;
      for (let i = 0; i < pool.length; i++) {
        const l = pool[i]!;
        const cs = key(c, 0), ce = key(c, c.length - 2), ls = key(l, 0), le = key(l, l.length - 2);
        if (ce === ls) c = c.concat(l.slice(2));
        else if (ce === le) c = c.concat(rev(l).slice(2));
        else if (cs === le) c = l.concat(c.slice(2));
        else if (cs === ls) c = rev(l).concat(c.slice(2));
        else continue;
        pool.splice(i, 1);
        grown = true;
        break;
      }
    }
    out.push(c);
  }
  const len = (p: Line): number => { let s = 0; for (let i = 2; i < p.length; i += 2) s += Math.hypot(p[i]! - p[i - 2]!, p[i + 1]! - p[i - 1]!); return s; };
  return out.map((p) => ({ p, len: len(p) })).sort((a, b) => b.len - a.len);
}

function group<T extends Named>(items: readonly T[], weightOf: (it: T) => number): LabelItem[] {
  const m = new Map<string, { name: string; w: number; lines: Line[] }>();
  for (const it of items) {
    const w = weightOf(it);
    if (!it.n || !w) continue;
    const g = m.get(it.n) ?? { name: it.n, w: 0, lines: [] };
    g.w = Math.max(g.w, w);
    g.lines.push(it.p);
    m.set(it.n, g);
  }
  return [...m.values()].map((g) => {
    const chains = joinChains(g.lines);
    const len = chains.reduce((s, c) => s + c.len, 0);
    return { name: g.name, w: g.w, chains, score: g.w * Math.sqrt(len) };
  }).sort((a, b) => b.score - a.score);
}

export function prepareLabels(data: MapData): Labels {
  const streets = group(data.roads.filter((r) => !r.u), (r) => STREET_WEIGHT[r.k] ?? 0).slice(0, 90);
  const canals = group(data.waterways.filter((w) => !w.u), (w) => (/^(canal|river|fairway)$/.test(w.k) ? 1 : 0)).slice(0, 40);
  return { streets, canals };
}

/** A chain in device px, with the cumulative length at each point. */
interface ScreenLine { pts: Float32Array; cum: Float32Array; len: number }

function toScreen(p: Line, P: Projector): ScreenLine {
  const pts = new Float32Array(p.length);
  for (let i = 0; i < p.length; i += 2) {
    pts[i] = P.sx(p[i]!);
    pts[i + 1] = P.sy(p[i + 1]!);
  }
  const cum = new Float32Array(p.length / 2);
  for (let i = 1; i < cum.length; i++) cum[i] = cum[i - 1]! + Math.hypot(pts[2 * i]! - pts[2 * i - 2]!, pts[2 * i + 1]! - pts[2 * i - 1]!);
  return { pts, cum, len: cum[cum.length - 1]! };
}

function pointAt(g: ScreenLine, d: number): Point {
  const { pts, cum } = g;
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid]! <= d) lo = mid; else hi = mid; }
  const seg = cum[hi]! - cum[lo]! || 1;
  const t = Math.min(1, Math.max(0, (d - cum[lo]!) / seg));
  return [pts[2 * lo]! + (pts[2 * hi]! - pts[2 * lo]!) * t, pts[2 * lo + 1]! + (pts[2 * hi + 1]! - pts[2 * lo + 1]!) * t];
}

const overlaps = (a: Rect, b: Rect): boolean => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

// Lays out characters along the path; returns glyph placements or null if too curvy / outside.
function layout(g: ScreenLine, start: number, widths: readonly number[], tw: number, size: number, bounds: Rect): Glyph[] | null {
  const a0 = pointAt(g, start), a1 = pointAt(g, start + tw);
  const reversed = a1[0] < a0[0];
  const glyphs: Glyph[] = [];
  let acc = 0, prev: number | null = null, minA = Infinity, maxA = -Infinity;
  for (const cw of widths) {
    const dc = reversed ? start + tw - (acc + cw / 2) : start + acc + cw / 2;
    const h = Math.max(cw, size * 0.5) / 2;
    const p0 = pointAt(g, reversed ? dc + h : dc - h), p1 = pointAt(g, reversed ? dc - h : dc + h);
    const a = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
    if (prev !== null) {
      let da = Math.abs(a - prev);
      if (da > Math.PI) da = 2 * Math.PI - da;
      if (da > 0.4) return null;
    }
    prev = a; minA = Math.min(minA, a); maxA = Math.max(maxA, a);
    const c = pointAt(g, dc);
    if (c[0] < bounds[0] || c[0] > bounds[2] || c[1] < bounds[1] || c[1] > bounds[3]) return null;
    glyphs.push({ x: c[0], y: c[1], a, cw });
    acc += cw;
  }
  if (maxA - minA > 1.1) return null;
  return glyphs;
}

export interface PlaceLabelsArgs<K extends string> {
  groups: readonly LabelGroup<K>[];
  P: Projector;
  /** Map window, device px. */
  mapRect: Rect;
  /** Boxes to keep clear, device px. */
  avoid: readonly Rect[];
  /** CSS font-family list. */
  font: string;
  measureCtx: CanvasRenderingContext2D;
}

// Places labels along lines, most important first, without collisions.
// Returns the jobs in device px.
export function placeLabels<K extends string>({ groups, P, mapRect, avoid, font, measureCtx }: PlaceLabelsArgs<K>): LabelJob<K>[] {
  const dpr = P.dpr;
  const pad = 3 * dpr;
  const bounds: Rect = [mapRect[0] + 10 * dpr, mapRect[1] + 10 * dpr, mapRect[2] - 10 * dpr, mapRect[3] - 10 * dpr];
  const placed: Rect[] = avoid.map((r) => [...r]);
  const jobs: LabelJob<K>[] = [];

  const tryItem = (item: LabelItem, g0: LabelGroup<K>): void => {
    const { kind, size, spacing, maxPer } = g0;
    const text = g0.upper === false ? item.name : item.name.toUpperCase();
    const f = `${size * dpr}px ${font}`;
    measureCtx.font = f;
    const widths = [...text].map((ch) => measureCtx.measureText(ch).width + spacing * dpr);
    const tw = widths.reduce((s, w) => s + w, 0);
    const step = Math.max(tw * 2.2, 380 * dpr);
    let count = 0;
    for (const chain of item.chains) {
      if (count >= maxPer) break;
      if (chain.len * P.S < tw + 24 * dpr) continue;
      const g = toScreen(chain.p, P);
      const centers = [g.len / 2];
      for (let d = step; g.len / 2 + d + tw / 2 < g.len; d += step) centers.push(g.len / 2 + d, g.len / 2 - d);
      // Off-centre fallbacks when the middle is taken or too curvy.
      for (const fr of [0.3, 0.7, 0.15, 0.85]) centers.push(g.len * fr);
      for (const c of centers) {
        if (count >= maxPer) break;
        const start = c - tw / 2;
        if (start < 4 * dpr || start + tw > g.len - 4 * dpr) continue;
        const glyphs = layout(g, start, widths, tw, size * dpr, bounds);
        if (!glyphs) continue;
        const r = (size * dpr) / 2 + pad;
        const boxes = glyphs.map((q): Rect => [q.x - r, q.y - r, q.x + r, q.y + r]);
        if (boxes.some((b) => placed.some((p) => overlaps(b, p)))) continue;
        placed.push(...boxes);
        jobs.push({ kind, font: f, size, text: [...text], glyphs });
        count++;
      }
    }
  };

  for (const g of groups) for (const item of g.items) tryItem(item, g);
  return jobs;
}

// Erases a halo `width` device px wide around the letters (destination-out).
export function knockOutLabels(ctx: CanvasRenderingContext2D, jobs: readonly LabelJob<string>[], width: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = width;
  for (const job of jobs) drawJob(ctx, job, 'stroke');
  ctx.restore();
}

export function fillLabels(ctx: CanvasRenderingContext2D, jobs: readonly LabelJob<string>[], color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const job of jobs) drawJob(ctx, job, 'fill');
  ctx.restore();
}

// Draws glyphs of one job with fillText or strokeText; the caller sets styles.
export function drawJob(ctx: CanvasRenderingContext2D, job: LabelJob<string>, mode: 'fill' | 'stroke' = 'fill'): void {
  ctx.font = job.font;
  job.glyphs.forEach((q, i) => {
    const ch = job.text[i] ?? '';
    ctx.setTransform(1, 0, 0, 1, q.x, q.y);
    ctx.rotate(q.a);
    if (mode === 'stroke') ctx.strokeText(ch, 0, 0);
    else ctx.fillText(ch, 0, 0);
  });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
