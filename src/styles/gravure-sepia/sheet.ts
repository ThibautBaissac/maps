// The sheet around the engraved plan: aged paper, double-ruled frame, cartouche with a
// scale, ornate compass rose and legend. Drawn in CSS px on a context scaled by dpr.
import { formatCoordinate, formatDate, formatNumber, messages, type Locale } from '../../i18n/index.ts';
import { context2d, makeCanvas, pattern } from '../../toolkit/canvas.ts';
import type { Rect } from '../../toolkit/geometry.ts';
import { clamp, scaleBar, type Layout } from '../../toolkit/layout.ts';
import { mulberry32, pixelCanvas } from '../../toolkit/noise.ts';
import type { View } from '../../toolkit/viewport.ts';
import type { TopicAnalysis } from '../../topics.ts';
import type { MountMeta } from '../contract.ts';
import type { GravureSepiaOptions } from './defaults.ts';
import type { PlanPatterns } from './map.ts';

type Ctx = CanvasRenderingContext2D;

/** Aged paper at device resolution: fine grain, brown stains, darkened edges. */
export function renderPaper(W: number, H: number, dpr: number, color: string, seed = 11): HTMLCanvasElement {
  const c = makeCanvas(W, H);
  const ctx = context2d(c);
  const rand = mulberry32(seed);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  // Soft mottling.
  const mott = pixelCanvas(Math.ceil(W / 40) + 2, Math.ceil(H / 40) + 2, seed, (r) => [110, 80, 40, Math.round(r() * 26)]);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(mott, 0, 0, W, H);
  // Fine grain.
  const grain = pixelCanvas(200, 200, seed + 1, (r) => (r() < 0.55 ? [80, 55, 30, Math.round(r() * 30)] : [255, 248, 230, Math.round(r() * 34)]));
  ctx.fillStyle = pattern(ctx, grain, 'repeat');
  ctx.fillRect(0, 0, W, H);
  // Brown stains: blots with a darker rim, foxing specks.
  const diag = Math.hypot(W, H);
  for (let i = 0; i < 9; i++) {
    const x = rand() * W, y = rand() * H, r = diag * (0.04 + rand() * 0.1), a = 0.04 + rand() * 0.05;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(140,95,45,${a * 0.7})`);
    g.addColorStop(0.7, `rgba(140,95,45,${a * 0.45})`);
    g.addColorStop(1, 'rgba(140,95,45,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < Math.round((W * H) / 60000); i++) {
    ctx.fillStyle = `rgba(120,75,35,${0.1 + rand() * 0.2})`;
    ctx.beginPath(); ctx.arc(rand() * W, rand() * H, (0.6 + rand() * 1.8) * dpr, 0, Math.PI * 2); ctx.fill();
  }
  // Darkened edges.
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, diag * 0.6);
  v.addColorStop(0, 'rgba(95,60,25,0)');
  v.addColorStop(1, 'rgba(95,60,25,0.38)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  return c;
}

function rule(ctx: Ctx, r: Rect, lw: number): void {
  ctx.lineWidth = lw;
  ctx.strokeRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
}

/** Double-ruled frame: a heavy outer rule and a fine inner one, the map window ruled too. */
function frame(ctx: Ctx, L: Layout): void {
  const F = L.frame, M = L.map, g = clamp(L.band * 0.45, 2.5, 4);
  rule(ctx, F, 2);
  rule(ctx, [F[0] + g, F[1] + g, F[2] - g, F[3] - g], 0.6);
  rule(ctx, M, 0.8);
}

/** Cartouche: double frame with corner flourishes, title, district, survey and scale. */
function cartouche(ctx: Ctx, L: Layout, view: View, meta: MountMeta, o: GravureSepiaOptions, locale: Locale): void {
  const [x0, y0, x1, y1] = L.cart;
  const cw = x1 - x0, ch = y1 - y0, pad = clamp(cw * 0.08, 10, 22);
  ctx.save();
  rule(ctx, L.cart, 1.4);
  rule(ctx, [x0 + 4, y0 + 4, x1 - 4, y1 - 4], 0.5);
  // Corner flourishes: small quarter-circle scrolls.
  ctx.lineWidth = 0.7;
  for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]] as const) {
    ctx.beginPath();
    ctx.arc(cx + sx * 9, cy + sy * 9, 5, 0, Math.PI * 2);
    ctx.moveTo(cx + sx * 4, cy + sy * 14); ctx.quadraticCurveTo(cx + sx * 4, cy + sy * 4, cx + sx * 14, cy + sy * 4);
    ctx.stroke();
  }
  const text = messages(locale);
  const vertical = ch > cw * 1.4;
  const inner = vertical ? ch - pad * 2 : cw - pad * 2;
  ctx.fillStyle = o.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `100px ${o.font}`;
  const tw = ctx.measureText(meta.title).width;
  const across = vertical ? cw : ch;
  const fs = Math.min((inner / tw) * 100 * 0.86, across * 0.3, (across - 2 * pad - 30) / 1.6);
  const ss = fs * 0.42, cs = clamp(fs * 0.2, 9, 13);
  // A tall cartouche reads bottom to top: its local box is then ch wide and cw high.
  if (vertical) { ctx.translate(x0, y1); ctx.rotate(-Math.PI / 2); }
  const box: Rect = vertical ? [0, 0, ch, cw] : L.cart;
  const mx = (box[0] + box[2]) / 2;
  let y = box[1] + pad + fs * 0.9;
  ctx.font = `${fs}px ${o.font}`;
  ctx.fillText(meta.title, mx, y);
  y += ss * 1.4;
  ctx.font = `italic ${ss}px ${o.font}`;
  ctx.fillText(meta.district, mx, y);
  // Scale at the bottom; the ornament, coordinates and survey date only where they fit.
  const bh = Math.max(3.5, cs * 0.4), by = box[3] - pad - cs * 1.4 - bh;
  const lines = [
    () => {
      y += ss * 0.7;
      const half = Math.min(inner * 0.32, fs * 2.2);
      ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(mx - half, y); ctx.lineTo(mx - 5, y); ctx.moveTo(mx + 5, y); ctx.lineTo(mx + half, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx, y - 3); ctx.lineTo(mx + 3, y); ctx.lineTo(mx, y + 3); ctx.lineTo(mx - 3, y); ctx.closePath(); ctx.fill();
    },
    () => {
      y += cs * 1.8;
      ctx.font = `${cs}px ${o.font}`;
      ctx.fillText(`${formatCoordinate(locale, meta.lat, 'lat', 4)} · ${formatCoordinate(locale, meta.lon, 'lon', 4)}`, mx, y);
    },
    () => {
      y += cs * 1.4;
      ctx.font = `italic ${cs}px ${o.font}`;
      ctx.fillText(text.canvas.survey(formatDate(locale, meta.osmDate)).toLocaleLowerCase(locale).replace(/\bosm\b/, 'OSM'), mx, y);
    },
  ];
  const steps = [ss * 0.7 + 3, cs * 1.8, cs * 1.4];
  for (let i = 0; i < lines.length; i++) {
    if (y + steps[i]! + cs * 0.6 > by) break;
    lines[i]!();
  }

  // Scale: alternating engraved blocks.
  const { d, len } = scaleBar(view.s, (box[2] - box[0]) - pad * 2 - cs * 3);
  const bx = mx - len / 2;
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 4; i++) {
    const sx = bx + (len / 4) * i;
    if (i % 2 === 0) ctx.fillRect(sx, by, len / 4, bh);
    ctx.strokeRect(sx, by, len / 4, bh);
  }
  ctx.font = `${cs}px ${o.font}`;
  ctx.textBaseline = 'top';
  ctx.fillText('0', bx, by + bh + 3);
  ctx.fillText(d >= 1000 ? `${formatNumber(locale, d / 1000)} km` : `${formatNumber(locale, d)} m`, bx + len, by + bh + 3);
  ctx.restore();
}

/** Ornate compass rose: sixteen points, half filled and half white (neutral under multiply), rings and a lily north. */
function compass(ctx: Ctx, L: Layout, o: GravureSepiaOptions, locale: Locale): void {
  const { x, y, r } = L.comp;
  ctx.save();
  ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.arc(x, y, r * 0.9, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2, l = i % 16 === 0 ? 0.1 : i % 4 === 0 ? 0.07 : 0.035;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9);
    ctx.lineTo(x + Math.cos(a) * r * (0.9 - l), y + Math.sin(a) * r * (0.9 - l));
    ctx.stroke();
  }
  const blade = (a: number, len: number, wid: number): void => {
    const tip = [x + Math.cos(a) * len, y + Math.sin(a) * len] as const;
    for (const side of [1, -1] as const) {
      const bx = x + Math.cos(a + side * Math.PI / 2) * wid, by = y + Math.sin(a + side * Math.PI / 2) * wid;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(...tip); ctx.lineTo(bx, by); ctx.closePath();
      if (side === 1) ctx.fill(); else { ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.fillStyle = o.ink; }
      ctx.stroke();
    }
  };
  ctx.fillStyle = o.ink;
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 8; i++) blade(Math.PI / 8 + (i * Math.PI) / 4, r * 0.48, r * 0.06);
  for (let i = 0; i < 4; i++) blade(Math.PI / 4 + (i * Math.PI) / 2, r * 0.62, r * 0.1);
  for (let i = 0; i < 4; i++) blade(-Math.PI / 2 + (i * Math.PI) / 2, r * 0.86, r * 0.13);
  ctx.beginPath(); ctx.arc(x, y, r * 0.07, 0, Math.PI * 2); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.stroke();
  // Lily above the north point.
  const ny = y - r * 1.02, s = r * 0.13;
  ctx.fillStyle = o.ink;
  ctx.beginPath();
  ctx.moveTo(x, ny - s * 2.2);
  ctx.quadraticCurveTo(x + s * 0.9, ny - s, x, ny);
  ctx.quadraticCurveTo(x - s * 0.9, ny - s, x, ny - s * 2.2);
  ctx.moveTo(x, ny - s * 0.4);
  ctx.quadraticCurveTo(x + s * 1.8, ny - s * 1.6, x + s * 1.5, ny - s * 0.2);
  ctx.quadraticCurveTo(x + s * 0.8, ny - s * 0.6, x, ny - s * 0.1);
  ctx.moveTo(x, ny - s * 0.4);
  ctx.quadraticCurveTo(x - s * 1.8, ny - s * 1.6, x - s * 1.5, ny - s * 0.2);
  ctx.quadraticCurveTo(x - s * 0.8, ny - s * 0.6, x, ny - s * 0.1);
  ctx.fill();
  ctx.font = `${r * 0.34}px ${o.font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const c = messages(locale).canvas;
  ctx.fillText(c.east, x + r * 1.16, y);
  ctx.fillText(c.west, x - r * 1.16, y);
  ctx.fillText(c.south, x, y + r * 1.16);
  ctx.restore();
}

/** Legend: the subject's symbols first, then the base map's. */
function legend(ctx: Ctx, box: Rect, o: GravureSepiaOptions, pat: PlanPatterns, dpr: number, locale: Locale, topic?: TopicAnalysis): void {
  const text = messages(locale);
  const rows: { label: string; draw: (x: number, y: number, w: number, h: number) => void }[] = [];
  const swatch = (fill: CanvasPattern) => (x: number, y: number, w: number, h: number): void => {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = fill; ctx.fillRect(x * dpr, y * dpr, w * dpr, h * dpr); ctx.restore();
    ctx.lineWidth = 0.6; ctx.strokeRect(x, y, w, h);
  };
  const disc = (color: string, alpha: number) => (x: number, y: number, w: number, h: number): void => {
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
    for (const [dx, r] of [[0.18, 0.18], [0.5, 0.26], [0.84, 0.36]] as const) { ctx.beginPath(); ctx.arc(x + w * dx, y + h / 2, h * r, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  };
  if (topic?.id === 'cholera-pump') {
    const c = text.topic.cholera;
    rows.push({ label: c.legendDeaths, draw: disc(o.ink, 0.55) });
    rows.push({ label: c.legendBroad, draw: disc(o.accent, 0.85) });
    rows.push({ label: c.legendPump, draw: (x, y, w, h) => {
      const r = h * 0.38, cx = x + w / 2, cy = y + h / 2;
      ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();
    } });
  }
  const items = text.canvas.items;
  rows.push({ label: items[0], draw: swatch(pat.hatch) });
  rows.push({ label: items[3], draw: swatch(pat.park) });
  if (!topic) rows.push({ label: items[2], draw: swatch(pat.water) });

  const [x0, y0, x1, y1] = box;
  const row = Math.min((y1 - y0) / (rows.length + 1), 30);
  const fs = clamp(row * 0.5, 10, 15);
  ctx.save();
  ctx.fillStyle = o.ink; ctx.strokeStyle = o.ink;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.font = `italic ${fs * 1.2}px ${o.font}`;
  const title = text.canvas.legend.charAt(0) + text.canvas.legend.slice(1).toLocaleLowerCase(locale);
  ctx.fillText(title, (x0 + x1) / 2, y0 + row * 0.45);
  ctx.textAlign = 'left';
  const sw = Math.min(row * 1.3, (x1 - x0) * 0.22), sh = row * 0.58;
  rows.forEach(({ label, draw }, i) => {
    const cy = y0 + row * (1.5 + i);
    ctx.fillStyle = o.ink;
    draw(x0, cy - sh / 2, sw, sh);
    ctx.fillStyle = o.ink;
    ctx.font = `${fs}px ${o.font}`;
    const tx = x0 + sw + fs * 0.6, width = x1 - tx, m = ctx.measureText(label).width;
    if (m > width) ctx.font = `${(fs * width) / m}px ${o.font}`;
    ctx.fillText(label, tx, cy);
  });
  ctx.restore();
}

export function renderSheet(ctx: Ctx, L: Layout, view: View, meta: MountMeta, o: GravureSepiaOptions, pat: PlanPatterns, dpr: number, locale: Locale, topic?: TopicAnalysis): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.strokeStyle = o.ink;
  ctx.fillStyle = o.ink;
  frame(ctx, L);
  cartouche(ctx, L, view, meta, o, locale);
  compass(ctx, L, o, locale);
  if (L.legend) legend(ctx, L.legend, o, pat, dpr, locale, topic);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
