import type { TopicAnalysis } from '../topics.ts';
import { addLine, type Projector } from './projection.ts';
import { scaleRect } from './geometry.ts';
import type { CanvasLayout } from './stage.ts';

type MarkerLayout = Pick<CanvasLayout, 'map' | 'nav' | 'attr' | 'furniture'>;

/** Move badges around fixed page furniture; leaders preserve the actual feature position. */
export function placeTopicMarkers(topic: TopicAnalysis, P: Projector, layout: MarkerLayout) {
  const radius = 12 * P.dpr, margin = radius + 3 * P.dpr;
  const [left, top, right, bottom] = scaleRect(layout.map, P.dpr);
  const occupied = [...layout.furniture, layout.nav, layout.attr].map((r) => scaleRect(r, P.dpr));
  const markers: { index: number; x: number; y: number; anchor: [number, number] }[] = [];
  topic.places.forEach((place, index) => {
    const anchor: [number, number] = [P.sx(place.point[0]), P.sy(place.point[1])];
    if (anchor[0] < left || anchor[0] > right || anchor[1] < top || anchor[1] > bottom) return;
    for (const distance of [0, 28, 56, 84, 112, 140, 168]) {
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

/** Real thematic geometry, with a constant minimum screen width and symbolic stair ticks. */
export function drawTopic(ctx: CanvasRenderingContext2D, topic: TopicAnalysis, P: Projector, color: string, background: string): void {
  const { dpr } = P;
  const width = (topic.id === 'steps' ? 2 : 3) * dpr;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.setLineDash([]);
  const lines = (): void => {
    ctx.beginPath();
    for (const r of topic.segments) addLine(ctx, P, r.g, 1e9, 0);
    ctx.stroke();
  };
  ctx.strokeStyle = background; ctx.lineWidth = width + 3 * dpr;
  lines();
  ctx.strokeStyle = color; ctx.lineWidth = width;
  lines();
  if (topic.id === 'steps') {
    ctx.lineWidth = dpr;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    for (const r of topic.segments) {
      let carry = 2.5 * dpr;
      for (let i = 2; i < r.g.length; i += 2) {
        const x = P.sx(r.g[i - 2]!), y = P.sy(r.g[i - 1]!);
        const dx = P.sx(r.g[i]!) - x, dy = P.sy(r.g[i + 1]!) - y, length = Math.hypot(dx, dy);
        if (!length) continue;
        let distance = carry;
        for (; distance < length; distance += 5 * dpr) {
          const px = x + dx * distance / length, py = y + dy * distance / length;
          const nx = -dy / length * 3.2 * dpr, ny = dx / length * 3.2 * dpr;
          ctx.moveTo(px - nx, py - ny); ctx.lineTo(px + nx, py + ny);
        }
        carry = distance - length;
      }
    }
    ctx.stroke();
  }
  ctx.restore();
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
