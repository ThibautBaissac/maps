// The drawing of the linear subjects (canal-crossings, steps), over the dimmed base map of a
// Canvas style: the selected sections, and symbolic ticks for stairs.
import { addLine, type Projector } from '../../toolkit/projection.ts';
import type { TopicInk } from '../types.ts';
import type { LinearTopic } from './index.ts';

/** Real thematic geometry, with a constant minimum screen width and symbolic stair ticks. */
export function drawLinear(ctx: CanvasRenderingContext2D, topic: LinearTopic, P: Projector, { color, background }: TopicInk): void {
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
