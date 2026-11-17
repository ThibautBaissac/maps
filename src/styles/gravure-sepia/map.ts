// The engraved plan: sepia lines on transparent, laid over the paper with multiply.
// Buildings hatched at 45° with a densely hatched shaded side, main streets as fine double
// lines, other streets single, water as wavy lines, parks stippled with small trees.
import { featuresOf, isBridge, isRoadKind, isTunnel, type Layer, type Line, type Ring, type RoadKind } from '../../layers.ts';
import { context2d, makeCanvas, pattern } from '../../toolkit/canvas.ts';
import { mulberry32 } from '../../toolkit/noise.ts';
import { addLine, addRings, withBox, type Projector, type WithBox } from '../../toolkit/projection.ts';
import type { GravureSepiaOptions } from './defaults.ts';

/** Streets drawn as a double line, with their width in metres and minimum gap in CSS px. */
const MAIN: Partial<Record<RoadKind, { m: number; min: number }>> = {
  trunk: { m: 14, min: 3.2 }, primary: { m: 13, min: 3 }, secondary: { m: 11, min: 2.8 }, tertiary: { m: 9, min: 2.5 },
  trunk_link: { m: 8, min: 2.4 }, primary_link: { m: 8, min: 2.4 }, secondary_link: { m: 7, min: 2.2 }, tertiary_link: { m: 7, min: 2.2 },
};
/** Single-line streets, with their minimum zoom (px/m). */
const MINOR: Partial<Record<RoadKind, number>> = {
  residential: 0, unclassified: 0, living_street: 0, pedestrian: 0, service: 0.9,
};
const PATH_KINDS: readonly RoadKind[] = ['footway', 'cycleway', 'path', 'track', 'steps'];

interface Road { p: Line; b: boolean }

export interface PreparedPlan {
  buildings: WithBox<{ r: Ring[] }>[];
  water: WithBox<{ r: Ring[] }>[];
  parks: WithBox<{ r: Ring[] }>[];
  streams: WithBox<{ p: Line }>[];
  main: { k: RoadKind; m: number; min: number; list: WithBox<Road>[] }[];
  minor: { min: number; list: WithBox<Road>[] }[];
  paths: WithBox<Road>[];
}

export function preparePlan(layers: readonly Layer[]): PreparedPlan {
  const main = new Map<RoadKind, WithBox<Road>[]>(), minor = new Map<RoadKind, WithBox<Road>[]>();
  const paths: WithBox<Road>[] = [];
  for (const f of featuresOf(layers, 'roads', 'lines')) {
    if (!f.k || !isRoadKind(f.k) || isTunnel(f)) continue;
    const road = withBox({ p: f.g, b: isBridge(f) }, [f.g]);
    if (MAIN[f.k]) main.set(f.k, [...(main.get(f.k) ?? []), road]);
    else if (MINOR[f.k] !== undefined) minor.set(f.k, [...(minor.get(f.k) ?? []), road]);
    else if (PATH_KINDS.includes(f.k)) paths.push(road);
  }
  return {
    buildings: featuresOf(layers, 'buildings', 'areas').map((f) => withBox({ r: f.g }, f.g)),
    water: featuresOf(layers, 'water', 'areas').map((f) => withBox({ r: f.g }, f.g)),
    parks: featuresOf(layers, 'parks', 'areas').map((f) => withBox({ r: f.g }, f.g)),
    streams: featuresOf(layers, 'waterways', 'lines').filter((f) => !isTunnel(f)).map((f) => withBox({ p: f.g }, [f.g])),
    // Thin first, so wide streets are drawn over the narrow ones they meet.
    main: [...main].map(([k, list]) => ({ k, ...MAIN[k]!, list })).sort((a, b) => a.m - b.m),
    minor: [...minor].map(([k, list]) => ({ min: MINOR[k]!, list })),
    paths,
  };
}

/** Screen-scale fills: hatching, dense hatching, waves, stipple with trees. */
export interface PlanPatterns { hatch: CanvasPattern; shade: CanvasPattern; water: CanvasPattern; park: CanvasPattern }

function hatchPattern(ctx: CanvasRenderingContext2D, pitch: number, width: number, color: string): CanvasPattern {
  const p = Math.max(2, Math.round(pitch));
  const tile = makeCanvas(p, p);
  const t = context2d(tile);
  t.fillStyle = color;
  t.fillRect(0, 0, p, Math.max(1, Math.round(width)));
  const pat = pattern(ctx, tile, 'repeat');
  pat.setTransform(new DOMMatrix().rotateSelf(-45));
  return pat;
}

export function makePatterns(ctx: CanvasRenderingContext2D, dpr: number, o: GravureSepiaOptions): PlanPatterns {
  // Wavy horizontal lines.
  const ww = Math.round(18 * dpr), wh = Math.round(5 * dpr);
  const wave = makeCanvas(ww, wh);
  const w = context2d(wave);
  w.strokeStyle = o.ink; w.lineWidth = 0.55 * dpr; w.globalAlpha = 0.8;
  w.beginPath();
  for (let x = 0; x <= ww; x += 1) {
    const y = wh / 2 + Math.sin((x / ww) * Math.PI * 2) * wh * 0.22;
    if (x === 0) w.moveTo(x, y); else w.lineTo(x, y);
  }
  w.stroke();
  // Stipple with a small tree every tile.
  const ps = Math.round(26 * dpr);
  const park = makeCanvas(ps, ps);
  const k = context2d(park);
  const rand = mulberry32(5);
  k.fillStyle = o.ink;
  for (let i = 0; i < 26; i++) {
    k.globalAlpha = 0.35 + rand() * 0.4;
    k.beginPath(); k.arc(rand() * ps, rand() * ps, (0.35 + rand() * 0.35) * dpr, 0, Math.PI * 2); k.fill();
  }
  k.globalAlpha = 0.9;
  k.strokeStyle = o.ink; k.lineWidth = 0.6 * dpr;
  const tx = ps * 0.3, ty = ps * 0.38, tr = 2.6 * dpr;
  k.beginPath(); k.moveTo(tx, ty + tr); k.lineTo(tx, ty + tr * 2.2); k.stroke();
  k.beginPath();
  for (let a = 0; a < 6; a++) {
    const ang = (a / 6) * Math.PI * 2;
    k.moveTo(tx + Math.cos(ang) * tr * 0.55 + tr * 0.55, ty + Math.sin(ang) * tr * 0.55);
    k.arc(tx + Math.cos(ang) * tr * 0.55, ty + Math.sin(ang) * tr * 0.55, tr * 0.55, 0, Math.PI * 2);
  }
  k.stroke();
  return {
    hatch: hatchPattern(ctx, o.hatch * dpr, 0.55 * dpr, o.ink),
    shade: hatchPattern(ctx, o.shadeHatch * dpr, 0.6 * dpr, o.ink),
    water: pattern(ctx, wave, 'repeat'),
    park: pattern(ctx, park, 'repeat'),
  };
}

/** Visible buildings in batches: one huge path is slow, one path per building costs too many calls. */
function buildingBatches(P: Projector, items: WithBox<{ r: Ring[] }>[]): Path2D[] {
  const batches: Path2D[] = [];
  let path = new Path2D(), n = 0;
  for (const b of items) {
    if (!P.visible(b.bb)) continue;
    addRings(path, P, b.r, 0);
    if (++n % 300 === 0) { batches.push(path); path = new Path2D(); }
  }
  batches.push(path);
  return batches;
}

export function renderPlan(ctx: CanvasRenderingContext2D, M: PreparedPlan, P: Projector, o: GravureSepiaOptions, pat: PlanPatterns): void {
  const { dpr } = P;
  const s = P.view.s;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = o.ink;

  // Parks: stipple and trees, fine outline.
  const parks = new Path2D();
  for (const p of M.parks) if (P.visible(p.bb)) addRings(parks, P, p.r, 0);
  ctx.fillStyle = pat.park;
  ctx.fill(parks, 'evenodd');
  ctx.lineWidth = 0.5 * dpr;
  ctx.stroke(parks);

  // Water: wavy lines and a doubled shoreline.
  const water = new Path2D();
  for (const w of M.water) if (P.visible(w.bb)) addRings(water, P, w.r, 0);
  ctx.fillStyle = pat.water;
  ctx.fill(water, 'evenodd');
  ctx.lineWidth = 0.8 * dpr;
  ctx.stroke(water);
  ctx.lineWidth = 0.7 * dpr;
  ctx.beginPath();
  for (const w of M.streams) if (P.visible(w.bb)) addLine(ctx, P, w.p, 1e9, 0);
  ctx.stroke();

  // Buildings: dense hatching shifted south-east (the shaded side), then the building
  // itself blanked (white is neutral under multiply), hatched and outlined.
  const shade = o.shade * dpr * Math.min(2, Math.max(1, Math.sqrt(s)));
  const batches = buildingBatches(P, M.buildings);
  ctx.save();
  ctx.translate(shade, shade);
  ctx.fillStyle = pat.shade;
  for (const path of batches) ctx.fill(path, 'evenodd');
  ctx.restore();
  ctx.fillStyle = '#FFFFFF';
  for (const path of batches) ctx.fill(path, 'evenodd');
  ctx.fillStyle = pat.hatch;
  ctx.lineWidth = o.building * dpr;
  for (const path of batches) { ctx.fill(path, 'evenodd'); ctx.stroke(path); }

  // Paths: fine dotted lines, from a moderate zoom.
  if (s >= 0.9) {
    ctx.lineWidth = 0.5 * dpr;
    ctx.setLineDash([1.2 * dpr, 2 * dpr]);
    ctx.beginPath();
    for (const r of M.paths) if (P.visible(r.bb)) addLine(ctx, P, r.p, 1e9, 0);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Ordinary streets: one engraved line.
  ctx.lineWidth = o.road * dpr;
  ctx.beginPath();
  for (const g of M.minor) {
    if (s < g.min) continue;
    for (const r of g.list) if (P.visible(r.bb)) addLine(ctx, P, r.p, 1e9, 0);
  }
  ctx.stroke();

  // Main streets: a fine double line. Ink corridor, then its inside erased, so crossings
  // merge into one carriageway.
  const width = (g: PreparedPlan['main'][number]): number => Math.max(g.min, g.m * s) * dpr;
  for (const erase of [false, true]) {
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    for (const g of M.main) {
      ctx.lineWidth = width(g) + (erase ? 0 : 2 * o.road * dpr);
      ctx.beginPath();
      for (const r of g.list) if (P.visible(r.bb)) addLine(ctx, P, r.p, 1e9, 0);
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}
