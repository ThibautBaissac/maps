// The two printing plates of the riso style:
// plate A (first ink) = buildings, plate B (second ink) = water, parks, streams, roads.
import type { Line, MapData, Ring, Road, RoadKind } from '../../data.ts';
import { recordOf, typedKeys, type Rect } from '../../toolkit/geometry.ts';
import { addLine, addRings, bboxOf, type Projector } from '../../toolkit/projection.ts';
import type { View } from '../../toolkit/viewport.ts';
import type { InkPatterns } from './inks.ts';

interface RoadStyle {
  /** Stroke width in CSS px at s = 0.5 px/m. */
  w: number;
  /** Minimum zoom (px/m) to show it. */
  min: number;
  /** Dash pattern, in stroke widths / 1.6. */
  dash?: number[];
}

const PRIMARY_LINK: RoadStyle = { w: 2.4, min: 0 };

// Thin to thick: the drawing order.
const ROADS: Record<RoadKind, RoadStyle> = {
  path: { w: 0.5, min: 1.1, dash: [2, 2.5] },
  track: { w: 0.6, min: 1.1, dash: [3, 2] },
  footway: { w: 0.5, min: 1.1 },
  cycleway: { w: 0.55, min: 0.9 },
  steps: { w: 0.9, min: 1.4, dash: [0.8, 1.2] },
  service: { w: 0.9, min: 0.7 },
  pedestrian: { w: 1.5, min: 0 },
  living_street: { w: 1.4, min: 0 },
  residential: { w: 1.6, min: 0 },
  unclassified: { w: 1.7, min: 0 },
  tertiary_link: { w: 2, min: 0 },
  secondary_link: { w: 2.2, min: 0 },
  primary_link: PRIMARY_LINK,
  tertiary: { w: 2.4, min: 0 },
  secondary: { w: 2.8, min: 0 },
  primary: { w: 3.2, min: 0 },
  trunk: { w: 3.4, min: 0 },
  motorway: { w: 3.6, min: 0 },
  trunk_link: PRIMARY_LINK,
  motorway_link: PRIMARY_LINK,
};
export const ROAD_ORDER = typedKeys(ROADS);

export function roadWidth(k: RoadKind, s: number): number {
  return ROADS[k].w * Math.min(5, Math.pow(s / 0.5, 0.6));
}

type WithBox<T> = T & { bb: Rect };

export interface Plates {
  buildings: WithBox<{ r: Ring[] }>[];
  water: WithBox<{ r: Ring[] }>[];
  parks: WithBox<{ r: Ring[] }>[];
  streams: WithBox<{ p: Line }>[];
  roads: Record<RoadKind, WithBox<Road>[]>;
}

export function preparePlates(data: MapData): Plates {
  const roads = recordOf(ROAD_ORDER, (): WithBox<Road>[] => []);
  for (const r of data.roads) roads[r.k].push({ ...r, bb: bboxOf([r.p]) });
  return {
    buildings: data.buildings.map((r) => ({ r, bb: bboxOf(r) })),
    water: data.water.map((w) => ({ r: w.r, bb: bboxOf(w.r) })),
    parks: data.parks.map((p) => ({ r: p.r, bb: bboxOf(p.r) })),
    streams: data.waterways.filter((w) => !/^(canal|river)$/.test(w.k) && !w.u).map((w) => ({ p: w.p, bb: bboxOf([w.p]) })),
    roads,
  };
}

export function renderPlateA(ctx: CanvasRenderingContext2D, M: Plates, P: Projector, view: View, ink: string): void {
  const dpr = P.dpr;
  // One fill per building: far faster in Skia than a single huge self-overlapping path.
  ctx.fillStyle = ink;
  for (const b of M.buildings) {
    if (!P.visible(b.bb)) continue;
    ctx.beginPath();
    addRings(ctx, P, b.r, 0.6);
    ctx.fill('evenodd');
  }
  // At close range, thin paper gaps reveal individual houses.
  if (view.s >= 2.2) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = Math.min(1.4, 0.35 + view.s * 0.08) * dpr;
    ctx.lineJoin = 'round';
    for (const b of M.buildings) {
      if (!P.visible(b.bb)) continue;
      ctx.beginPath();
      addRings(ctx, P, b.r, 0.6);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function renderPlateB(ctx: CanvasRenderingContext2D, M: Plates, P: Projector, view: View, ink: string, patterns: InkPatterns): void {
  const dpr = P.dpr;
  // Water: line hatching tint + solid shoreline.
  ctx.fillStyle = patterns.lines;
  for (const w of M.water) {
    if (!P.visible(w.bb)) continue;
    ctx.beginPath();
    addRings(ctx, P, w.r, 1);
    ctx.fill('evenodd');
  }
  ctx.strokeStyle = ink;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.min(2.2, 0.9 + view.s * 0.15) * dpr;
  ctx.beginPath();
  for (const w of M.water) if (P.visible(w.bb)) addRings(ctx, P, w.r, 1);
  ctx.stroke();

  // Parks: halftone dots + fine outline.
  ctx.fillStyle = patterns.dots;
  ctx.beginPath();
  for (const p of M.parks) if (P.visible(p.bb)) addRings(ctx, P, p.r, 1);
  ctx.fill('nonzero');
  ctx.lineWidth = 0.7 * dpr;
  ctx.setLineDash([2.5 * dpr, 2 * dpr]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Small streams and ditches.
  ctx.lineWidth = 0.8 * dpr;
  ctx.beginPath();
  for (const w of M.streams) if (P.visible(w.bb)) addLine(ctx, P, w.p, 14 * dpr);
  ctx.stroke();

  // Roads, thin to thick.
  const bridges: { r: WithBox<Road>; w: number }[] = [];
  for (const k of ROAD_ORDER) {
    const st = ROADS[k];
    if (view.s < st.min) continue;
    const w = Math.max(0.45, roadWidth(k, view.s)) * dpr;
    ctx.lineWidth = w;
    ctx.setLineDash(st.dash ? st.dash.map((d) => d * w * 1.6) : []);
    ctx.beginPath();
    for (const r of M.roads[k]) {
      if (!P.visible(r.bb)) continue;
      if (r.b) { bridges.push({ r, w }); continue; }
      if (r.u) continue;
      addLine(ctx, P, r.p, 14 * dpr);
    }
    ctx.stroke();
    // Tunnels: thin dashes.
    ctx.lineWidth = Math.max(0.5 * dpr, w * 0.45);
    ctx.setLineDash([3 * dpr, 3 * dpr]);
    ctx.beginPath();
    for (const r of M.roads[k]) if (r.u && !r.b && P.visible(r.bb)) addLine(ctx, P, r.p, 14 * dpr);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Bridges: paper casing so they read over the water.
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineCap = 'butt';
  for (const { r, w } of bridges) {
    ctx.lineWidth = w + 3.2 * dpr;
    ctx.beginPath();
    addLine(ctx, P, r.p, 14 * dpr);
    ctx.stroke();
  }
  ctx.restore();
  for (const { r, w } of bridges) {
    ctx.lineWidth = w;
    ctx.beginPath();
    addLine(ctx, P, r.p, 14 * dpr);
    ctx.stroke();
  }
}
