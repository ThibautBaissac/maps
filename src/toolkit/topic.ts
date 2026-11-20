// A subject over a Canvas style: its own drawing (TopicDef.draw, in src/topics/<id>/) and
// the numbered badges of its references, placed around the page furniture.
import { loadedTopic, type TopicAnalysis } from '../topics/index.ts';
import type { Projector } from './projection.ts';
import { scaleRect } from './geometry.ts';
import type { CanvasLayout } from './stage.ts';

type MarkerLayout = Pick<CanvasLayout, 'map' | 'nav' | 'attr' | 'furniture'>;

/** Move badges around fixed page furniture; leaders preserve the actual feature position. */
export function placeTopicMarkers(topic: TopicAnalysis, P: Projector, layout: MarkerLayout) {
  const radius = 12 * P.dpr, margin = radius + 3 * P.dpr;
  const [left, top, right, bottom] = scaleRect(layout.map, P.dpr);
  const occupied = [...layout.furniture, layout.nav, layout.attr].map((r) => scaleRect(r, P.dpr));
  const markers: { index: number; x: number; y: number; anchor: [number, number] }[] = [];
  const badgesOn = loadedTopic(topic.id).badges === 'on';
  topic.places.forEach((place, index) => {
    const anchor: [number, number] = [P.sx(place.point[0]), P.sy(place.point[1])];
    if (anchor[0] < left || anchor[0] > right || anchor[1] < top || anchor[1] > bottom) return;
    // A point subject keeps its symbol visible: its badge starts beside it, never on it.
    for (const distance of badgesOn ? [0, 28, 56, 84, 112, 140, 168] : [24, 48, 72, 96, 120, 144]) {
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const x = anchor[0] + dx! * distance * P.dpr, y = anchor[1] + dy! * distance * P.dpr;
        if (x - margin < left || x + margin > right || y - margin < top || y + margin > bottom) continue;
        if (occupied.some((r) => x + margin > r[0] && x - margin < r[2] && y + margin > r[1] && y - margin < r[3])) continue;
        markers.push({ index, x, y, anchor });
        occupied.push([x - margin, y - margin, x + margin, y + margin]);
        return;
      }
    }
  });
  return markers;
}

/**
 * The subject's evidence over the dimmed base map: `color` for the subject, `background` to
 * detach it, `accent` (defaults to `color`) for what the subject singles out.
 */
export function drawTopic(ctx: CanvasRenderingContext2D, topic: TopicAnalysis, P: Projector, color: string, background: string, accent = color): void {
  // A subject without a drawing (stepped towers, investigations) is drawn by the styles that show it.
  loadedTopic(topic.id).draw?.(ctx, topic, P, { color, background, accent });
}

/** Badges stay legible after the geographic layer's edge fade. */
export function drawTopicMarkers(ctx: CanvasRenderingContext2D, topic: TopicAnalysis, P: Projector, color: string, background: string, layout: MarkerLayout): void {
  const { dpr } = P;
  ctx.save(); ctx.globalAlpha = 1;
  ctx.font = `bold ${12 * dpr}px system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const { x, y, anchor, index } of placeTopicMarkers(topic, P, layout)) {
    const radius = 12 * dpr;
    if (Math.hypot(x - anchor[0], y - anchor[1]) > dpr) {
      ctx.beginPath(); ctx.moveTo(...anchor); ctx.lineTo(x, y);
      ctx.strokeStyle = background; ctx.lineWidth = 4 * dpr; ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = dpr; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = background; ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 1.5 * dpr; ctx.stroke();
    ctx.fillStyle = color; ctx.fillText(String(index + 1), x, y + dpr * 0.5);
  }
  ctx.restore();
}
