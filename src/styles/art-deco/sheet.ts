// The poster around the plan: night-blue border, gold banner with the title and fans,
// legend card with a scale. Layout and drawing in CSS px on a context scaled by dpr.
import { formatNumber, messages, type Locale } from '../../i18n/index.ts';
import { makeCanvas, context2d } from '../../toolkit/canvas.ts';
import type { Rect } from '../../toolkit/geometry.ts';
import { clamp, scaleBar } from '../../toolkit/layout.ts';
import type { CanvasLayout } from '../../toolkit/stage.ts';
import type { View } from '../../toolkit/viewport.ts';
import type { TopicAnalysis } from '../../topics.ts';
import type { MountMeta } from '../contract.ts';
import type { ArtDecoOptions } from './defaults.ts';
import type { Inks, Palette } from './relief.ts';

type Ctx = CanvasRenderingContext2D;

export interface DecoLayout extends CanvasLayout {
  w: number;
  h: number;
  frame: Rect;
  /** Gold banner across the top of the frame. */
  banner: Rect;
  legend: Rect;
  /** Height of a legend row, CSS px: smaller on narrow pages. */
  row: number;
}

const NAV_W = 224, NAV_H = 44, ATTR_W = 320, ATTR_H = 48, INSET = 6;

export function decoLayout(w: number, h: number, rows: number): DecoLayout {
  const u = Math.min(w, h);
  const m = clamp(u * 0.028, 8, 24);
  const bandH = clamp(u * 0.085, 40, 74);
  const frame: Rect = [m, m, w - m, h - m];
  const banner: Rect = [m, m, w - m, m + bandH];
  const gap = clamp(u * 0.006, 2, 5);
  const map: Rect = [m + gap, m + bandH + gap, w - m - gap, h - m - gap];
  const mw = map[2] - map[0], mh = map[3] - map[1];
  const plate = mh > mw ? Math.min(mh, Math.sqrt(mw * mh)) : Math.min(mw, mh);
  const nav: Rect = [map[0] + INSET, map[1] + INSET, map[0] + INSET + NAV_W, map[1] + INSET + NAV_H];
  const attr: Rect = [Math.max(map[0], map[2] - INSET - ATTR_W), map[3] - INSET - ATTR_H, map[2] - INSET, map[3] - INSET];
  const compact = mw < 440;
  const row = compact ? 17 : 22;
  const lw = Math.min(compact ? 180 : 230, mw - 2 * INSET), lh = row * 1.55 + rows * row + 34;
  // The legend sits bottom left beside the attribution, or above it on narrow pages, where
  // the tall map window leaves room under the square plate.
  const legend: Rect = mw >= lw + ATTR_W + 40
    ? [map[0] + INSET * 2, map[3] - INSET * 2 - lh, map[0] + INSET * 2 + lw, map[3] - INSET * 2]
    : [map[0] + INSET, attr[1] - INSET - lh, map[0] + INSET + lw, attr[1] - INSET];
  return { w, h, frame, banner, map, plate, nav, attr, legend, row, furniture: [[legend[0] - 4, legend[1] - 4, legend[2] + 4, legend[3] + 4]] };
}

/** Night-blue page with a cream map window: the plan's faded edges dissolve into cream. */
export function renderPaper(W: number, H: number, dpr: number, L: DecoLayout, o: ArtDecoOptions): HTMLCanvasElement {
  const c = makeCanvas(W, H);
  const ctx = context2d(c);
  ctx.fillStyle = o.navy;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = o.cream;
  const [x0, y0, x1, y1] = L.map;
  ctx.fillRect(x0 * dpr, y0 * dpr, (x1 - x0) * dpr, (y1 - y0) * dpr);
  return c;
}

/** A quarter-circle fan of rays, alternating two inks, in the corner (x, y) opening towards (sx, sy). */
function fan(ctx: Ctx, x: number, y: number, r: number, sx: 1 | -1, sy: 1 | -1, a: string, b: string): void {
  const rays = 7;
  const start = sx > 0 ? (sy > 0 ? 0 : -Math.PI / 2) : (sy > 0 ? Math.PI / 2 : Math.PI);
  for (let i = 0; i < rays; i++) {
    const a0 = start + (i / rays) * (Math.PI / 2), a1 = start + ((i + 1) / rays) * (Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, a0, a1); ctx.closePath();
    ctx.fillStyle = i % 2 ? a : b; ctx.fill();
  }
  ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r * 0.32, start, start + Math.PI / 2); ctx.closePath();
  ctx.fillStyle = a; ctx.fill();
}

function banner(ctx: Ctx, L: DecoLayout, meta: MountMeta, o: ArtDecoOptions, locale: Locale): void {
  const [x0, y0, x1, y1] = L.banner, bh = y1 - y0;
  ctx.fillStyle = o.gold;
  ctx.fillRect(x0, y0, x1 - x0, bh);
  // Fans hang from the banner's lower corners, stepped bands run beside the title.
  const r = bh * 0.86;
  fan(ctx, x0, y1, r, 1, -1, o.navy, o.red);
  fan(ctx, x1, y1, r, -1, -1, o.navy, o.red);
  const title = `${meta.title} · ${meta.district}`.toLocaleUpperCase(locale);
  let fs = bh * 0.5;
  ctx.font = `${fs}px ${o.font}`;
  const room = x1 - x0 - r * 2.4;
  const tw = ctx.measureText(title).width + title.length * fs * 0.12;
  if (tw > room) { fs *= room / tw; ctx.font = `${fs}px ${o.font}`; }
  ctx.letterSpacing = `${fs * 0.12}px`;
  ctx.fillStyle = o.navy;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(title, (x0 + x1) / 2, y0 + bh * 0.54);
  ctx.letterSpacing = '0px';
  const w = ctx.measureText(title).width + title.length * fs * 0.12;
  const cx = (x0 + x1) / 2, gapX = w / 2 + fs * 0.6, end = Math.max(cx + gapX, x1 - r * 1.15);
  ctx.fillStyle = o.navy;
  for (const side of [-1, 1] as const) {
    for (let k = 0; k < 3; k++) {
      const len = (end - cx - gapX) * (1 - k * 0.25), y = y0 + bh * (0.36 + k * 0.14), th = Math.max(1, bh * 0.035);
      if (len <= 2) continue;
      ctx.fillRect(side > 0 ? cx + gapX : cx - gapX - len, y - th / 2, len, th);
    }
  }
}

/** A tiny raised block in a tone, for the legend. */
function block(ctx: Ctx, x: number, y: number, w: number, h: number, inks: Inks, o: ArtDecoOptions, steps: boolean): void {
  const dx = h * o.tiltX * 0.6, dy = h * o.tiltY * 0.6;
  const tiers: [number, number, number][] = steps ? [[0, w, h * 0.45], [w * 0.18, w * 0.64, h * 0.75], [w * 0.32, w * 0.36, h]] : [[w * 0.12, w * 0.76, h]];
  for (const [ox, tw, th] of tiers) {
    const bx = x + ox, by = y + h;
    ctx.fillStyle = inks.lit;
    ctx.fillRect(bx, by - th, tw, th);
    ctx.fillStyle = inks.shade;
    ctx.beginPath(); ctx.moveTo(bx + tw, by); ctx.lineTo(bx + tw + dx, by - dy); ctx.lineTo(bx + tw + dx, by - th - dy); ctx.lineTo(bx + tw, by - th); ctx.closePath(); ctx.fill();
    ctx.fillStyle = inks.roof;
    ctx.beginPath(); ctx.moveTo(bx, by - th); ctx.lineTo(bx + tw, by - th); ctx.lineTo(bx + tw + dx, by - th - dy); ctx.lineTo(bx + dx, by - th - dy); ctx.closePath(); ctx.fill();
  }
}

/** Legend rows: the subject's tones first, then parks (and water without subject). */
export function legendRows(topic: TopicAnalysis | undefined, locale: Locale): { label: string; tone: 'stepped' | 'block' | 'plain' | 'inkA' | 'park' | 'water' }[] {
  const text = messages(locale);
  const items = text.canvas.items.map((t) => t.charAt(0) + t.slice(1).toLocaleLowerCase(locale));
  if (topic?.id === 'setbacks') {
    const c = text.topic.setbacks;
    return [{ label: c.legendStepped, tone: 'stepped' }, { label: c.legendBlock, tone: 'block' }, { label: c.legendOther, tone: 'plain' }, { label: items[3]!, tone: 'park' }];
  }
  return [{ label: items[0]!, tone: 'inkA' }, { label: items[3]!, tone: 'park' }, { label: items[2]!, tone: 'water' }];
}

function legend(ctx: Ctx, L: DecoLayout, view: View, o: ArtDecoOptions, c: Palette, locale: Locale, topic: TopicAnalysis | undefined): void {
  const [x0, y0, x1, y1] = L.legend, row = L.row, head = row * 1.2;
  const rows = legendRows(topic, locale);
  ctx.fillStyle = o.cream;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.fillStyle = o.navy;
  ctx.fillRect(x0, y0, x1 - x0, head);
  ctx.fillStyle = o.gold;
  ctx.fillRect(x0, y0 + head, x1 - x0, 3);
  ctx.font = `${row * 0.72}px ${o.font}`;
  ctx.letterSpacing = '2px';
  ctx.fillStyle = o.cream;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(messages(locale).canvas.legend, (x0 + x1) / 2, y0 + head * 0.54);
  ctx.letterSpacing = '0px';
  ctx.textAlign = 'left';
  const sw = row * 1.2;
  rows.forEach(({ label, tone }, i) => {
    const y = y0 + head + 9 + i * row;
    if (tone === 'park' || tone === 'water') {
      ctx.fillStyle = tone === 'park' ? c.park : c.water;
      ctx.fillRect(x0 + 10, y + row * 0.15, sw, row * 0.55);
    } else block(ctx, x0 + 10, y, sw * 0.8, row * 0.72, c[tone], o, tone === 'stepped');
    ctx.fillStyle = o.navy;
    let fs = row * 0.68;
    ctx.font = `${fs}px ${o.font}`;
    const room = x1 - x0 - sw - 26, m = ctx.measureText(label).width;
    if (m > room) { fs *= room / m; ctx.font = `${fs}px ${o.font}`; }
    ctx.fillText(label, x0 + sw + 18, y + row * 0.45);
  });
  // Scale: alternating navy and gold blocks.
  const { d, len } = scaleBar(view.s, (x1 - x0) - 70);
  const sy = y1 - 22, sx = x0 + 10;
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 ? o.gold : o.navy;
    ctx.fillRect(sx + (len / 4) * i, sy, len / 4, 5);
  }
  ctx.fillStyle = o.navy;
  ctx.font = `13px ${o.font}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(d >= 1000 ? `${formatNumber(locale, d / 1000)} km` : `${formatNumber(locale, d)} m`, sx + len + 8, sy + 3);
}

export function renderSheet(ctx: Ctx, L: DecoLayout, view: View, meta: MountMeta, o: ArtDecoOptions, c: Palette, dpr: number, locale: Locale, topic: TopicAnalysis | undefined): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Gold rule around the map window, inside the night-blue border.
  const [x0, y0, x1, y1] = L.map;
  ctx.strokeStyle = o.gold; ctx.lineWidth = 1.5;
  ctx.strokeRect(x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2);
  banner(ctx, L, meta, o, locale);
  legend(ctx, L, view, o, c, locale, topic);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
