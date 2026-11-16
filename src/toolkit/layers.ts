// Generic drawing of the external layers of a map (src/layers.ts): one stroke and one fill
// colour for every object, whatever the style. Only the "overlay" role is drawn here.
import { featuresOf, type Layer } from '../layers.ts';
import { addLine, addRings, bboxOf, type Projector } from './projection.ts';

export interface LayerInk {
  stroke: string;
  fill: string;
  /** Line width, CSS px. */
  width: number;
  /** Point radius, CSS px. */
  radius: number;
}

/** Longest segment (device px) before addLine subdivides; unused here, the wobble is off. */
const MAX_SEGMENT = 12;
const AREA_FILL_ALPHA = 0.3;

/** Draws the overlay layers on `ctx`, in the order of `layers`; the context state is restored. */
export function drawLayers(ctx: CanvasRenderingContext2D, P: Projector, layers: readonly Layer[], ink: LayerInk): void {
  const areas = featuresOf(layers, 'overlay', 'areas');
  const lines = featuresOf(layers, 'overlay', 'lines');
  const points = featuresOf(layers, 'overlay', 'points');
  if (!areas.length && !lines.length && !points.length) return;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = ink.width * P.dpr;
  ctx.strokeStyle = ink.stroke;
  ctx.fillStyle = ink.fill;
  for (const { g } of areas) {
    if (!P.visible(bboxOf(g))) continue;
    ctx.beginPath();
    addRings(ctx, P, g, 0);
    ctx.globalAlpha = AREA_FILL_ALPHA;
    ctx.fill('evenodd');
    ctx.globalAlpha = 1;
    ctx.stroke();
  }
  for (const { g } of lines) {
    if (!P.visible(bboxOf([g]))) continue;
    ctx.beginPath();
    addLine(ctx, P, g, MAX_SEGMENT, 0);
    ctx.stroke();
  }
  for (const { g } of points) {
    if (!P.visible([g[0], g[1], g[0], g[1]])) continue;
    ctx.beginPath();
    ctx.arc(P.sx(g[0]), P.sy(g[1]), ink.radius * P.dpr, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
