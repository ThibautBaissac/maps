// The drawing of the cholera-pump subject, over the dimmed base map of a Canvas style.
import type { Projector } from '../../toolkit/projection.ts';
import type { TopicInk } from '../types.ts';
import type { CholeraTopic } from './index.ts';

/** Death disc radius, device px: area proportional to the deaths, readable at every zoom. */
function deathRadius(count: number, P: Projector): number {
  return Math.sqrt(count) * Math.max(2.1 * P.dpr, 1.1 * P.S);
}

/** Deaths as proportional discs (accent when Broad Street is the closest pump), pumps as crossed circles. */
export function drawCholera(ctx: CanvasRenderingContext2D, topic: CholeraTopic, P: Projector, { color, background, accent }: TopicInk): void {
  const { dpr } = P;
  const broad = topic.pumps.findIndex((p) => p.broad);
  ctx.save();
  ctx.globalAlpha = 1; ctx.setLineDash([]);
  // Largest first, so the small discs stay visible on top.
  const deaths = [...topic.deaths].sort((a, b) => b.count - a.count);
  for (const pass of [false, true]) {
    for (const d of deaths) {
      if ((d.pump === broad) !== pass) continue;
      const r = deathRadius(d.count, P), x = P.sx(d.point[0]), y = P.sy(d.point[1]);
      if (!P.visible([d.point[0] - r / P.S, d.point[1] - r / P.S, d.point[0] + r / P.S, d.point[1] + r / P.S])) continue;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = pass ? accent : color;
      ctx.globalAlpha = pass ? 0.85 : 0.55;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = background; ctx.lineWidth = 0.75 * dpr; ctx.stroke();
    }
  }
  for (const pump of topic.pumps) {
    const r = (pump.broad ? 8 : 5.5) * dpr, x = P.sx(pump.point[0]), y = P.sy(pump.point[1]);
    ctx.beginPath(); ctx.arc(x, y, r + 2 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = background; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.moveTo(x - r, y); ctx.lineTo(x + r, y);
    ctx.moveTo(x, y - r); ctx.lineTo(x, y + r);
    ctx.strokeStyle = pump.broad ? accent : color;
    ctx.lineWidth = (pump.broad ? 2.2 : 1.4) * dpr;
    ctx.stroke();
  }
  ctx.restore();
}
