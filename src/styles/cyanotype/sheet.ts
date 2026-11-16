// The drawing sheet around the map: layout, paper, reference grid, dimension chains on
// the four edges and the title block (bottom right). All in CSS px, drawn each frame.
import type { MountMeta } from '../contract.ts';
import { formatCoordinate, formatDate, formatNumber, messages, type Locale } from '../../i18n/index.ts';
import { context2d, makeCanvas, pattern } from '../../toolkit/canvas.ts';
import { growRect, type Point, type Rect } from '../../toolkit/geometry.ts';
import { clamp, mapWindow, scaleBar } from '../../toolkit/layout.ts';
import { pixelCanvas, vnoise } from '../../toolkit/noise.ts';
import { makeProjector, type Projector } from '../../toolkit/projection.ts';
import type { View } from '../../toolkit/viewport.ts';
import type { CyanotypeOptions } from './defaults.ts';

type Ctx = CanvasRenderingContext2D;

/** Sheet layout, CSS px. */
export interface SheetLayout {
  w: number;
  h: number;
  /** Outer margin to the double border. */
  m: number;
  /** Dimension band between border and map. */
  band: number;
  frame: Rect;
  map: Rect;
  /** Square plate size at full zoom-out. */
  plate: number;
  /** Title block. */
  cart: Rect;
  /** Zoom and description controls. */
  nav: Rect;
  /** OSM attribution. */
  attr: Rect;
  /** Boxes of the drawn furniture, for names to avoid. */
  furniture: Rect[];
}

export function sheetLayout(w: number, h: number): SheetLayout {
  const u = Math.min(w, h);
  const m = clamp(u * 0.026, 9, 24);
  const band = clamp(u * 0.042, 22, 34);
  const { frame, map, plate, nav } = mapWindow(w, h, m, band);
  const mw = map[2] - map[0];
  const pad = clamp(u * 0.018, 8, 16);
  const cw = clamp(Math.min(mw * 0.62, 360), 196, 360);
  const ch = Math.round(cw * 0.5);
  const cart: Rect = [map[2] - pad - cw, map[3] - pad - ch, map[2] - pad, map[3] - pad];
  // The OSM attribution sits on top of the title block, right-aligned with it.
  const attr: Rect = [Math.max(map[0], cart[2] - 320), cart[1] - 6 - 48, cart[2], cart[1] - 6];
  const furniture = [growRect(cart, 4)];
  return { w, h, m, band, frame, map, plate, cart, nav, attr, furniture };
}

// Blue ground with soft mottling, fine grain and a slightly darker rim.
export function renderPaper(W: number, H: number, dpr: number, color: string, strength: number): HTMLCanvasElement {
  const c = makeCanvas(W, H);
  const x = context2d(c);
  x.fillStyle = color;
  x.fillRect(0, 0, W, H);
  const sw = Math.ceil(W / (70 * dpr)) + 2, sh = Math.ceil(H / (70 * dpr)) + 2;
  const mottle = pixelCanvas(sw, sh, 7, (_r, i, j) => {
    const n = vnoise(i * 0.45, j * 0.45) * 0.7 + vnoise(i * 1.3 + 9, j * 1.3) * 0.3;
    const v = n > 0 ? 255 : 0;
    return [v, v, v, Math.round(Math.abs(n) * strength * 255 * 1.6)];
  });
  x.imageSmoothingEnabled = true;
  x.drawImage(mottle, 0, 0, W, H);
  const grain = pixelCanvas(200, 200, 3, (r) => {
    const v = r() < 0.5 ? 0 : 255;
    return [v, v, v, Math.round(r() * strength * 255 * 0.9)];
  });
  x.fillStyle = pattern(x, grain, 'repeat');
  x.fillRect(0, 0, W, H);
  const g = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6);
  g.addColorStop(0, 'rgba(0,10,40,0)');
  g.addColorStop(1, `rgba(0,10,40,${strength * 3})`);
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  return c;
}

// Grid step (m) so that cells are 70–160 CSS px wide.
function gridStep(s: number): number {
  for (const g of [10, 20, 25, 50, 100, 200, 250, 500, 1000]) if (g * s >= 70) return g;
  return 1000;
}

const fmt = (locale: Locale, n: number): string => formatNumber(locale, n, { maximumFractionDigits: 0 });

// Map metres -> CSS px for the current view.
const cssProjector = (L: SheetLayout, view: View): Projector => makeProjector(view, L.w, L.h, 1);

export function drawGrid(c: Ctx, L: SheetLayout, view: View, half: number, o: CyanotypeOptions): void {
  const G = gridStep(view.s);
  const M = L.map;
  const { sx, sy } = cssProjector(L, view);
  c.save();
  c.beginPath();
  c.rect(M[0], M[1], M[2] - M[0], M[3] - M[1]);
  c.clip();
  c.globalAlpha = o.grid;
  c.strokeStyle = o.line;
  c.lineWidth = 0.6;
  c.beginPath();
  for (let x = -half; x <= half + 0.1; x += G) {
    const X = Math.round(sx(x)) + 0.5;
    if (X < M[0] || X > M[2]) continue;
    c.moveTo(X, Math.max(M[1], sy(half))); c.lineTo(X, Math.min(M[3], sy(-half)));
  }
  for (let y = -half; y <= half + 0.1; y += G) {
    const Y = Math.round(sy(y)) + 0.5;
    if (Y < M[1] || Y > M[3]) continue;
    c.moveTo(Math.max(M[0], sx(-half)), Y); c.lineTo(Math.min(M[2], sx(half)), Y);
  }
  c.stroke();
  c.restore();
}

// Border, and a chain of dimensions on each edge: running totals (from the south-west
// corner of the survey) on top and left, partial lengths on bottom and right.
export function drawBorder(c: Ctx, L: SheetLayout, view: View, half: number, o: CyanotypeOptions, locale: Locale): void {
  const { frame: F, map: M, band, m } = L;
  c.strokeStyle = o.line;
  c.fillStyle = o.line;
  c.lineWidth = 1.3;
  c.strokeRect(F[0], F[1], F[2] - F[0], F[3] - F[1]);
  c.lineWidth = 0.5;
  c.strokeRect(F[0] + 3, F[1] + 3, F[2] - F[0] - 6, F[3] - F[1] - 6);
  c.lineWidth = 0.9;
  c.strokeRect(M[0], M[1], M[2] - M[0], M[3] - M[1]);

  const G = gridStep(view.s);
  const fs = clamp(band * 0.3, 7, 10);
  c.font = `${fs}px ${o.font}`;
  c.textBaseline = 'middle';
  const off = band * 0.3; // dimension line distance from the map edge
  const tick = Math.min(4, band * 0.14);
  const lab = (off + tick + band - 3) / 2; // label centre, between the line and the border

  // One edge, expressed along a 1-D axis then mapped to the screen by `at(pos, d)`,
  // d = distance outward from the map edge.
  const edge = (lo: 0 | 1, hi: 2 | 3, toScreen: (v: number) => number, at: (p: number, d: number) => Point, labels: boolean, partial: boolean, rotate: boolean): void => {
    const p0 = M[lo], p1 = M[hi];
    const line = (a: number, b: number, d1: number, d2: number): void => { const A = at(a, d1), B = at(b, d2); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); };
    c.lineWidth = 0.7;
    c.beginPath();
    line(p0, p1, off, off);
    let prev: { p: number; v: number } | null = null;
    const marks: { p: number; v: number }[] = [];
    for (let v = -half; v <= half + 0.1; v += G / 5) {
      const p = toScreen(v);
      if (p < p0 - 0.5 || p > p1 + 0.5) continue;
      const major = Math.abs(((v + half) / G) - Math.round((v + half) / G)) < 1e-6;
      if (major) {
        line(p, p, 2, off + tick); // extension line
        const A = at(p - tick * 0.8, off - tick * 0.8), B = at(p + tick * 0.8, off + tick * 0.8);
        c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); // architect's slash
        marks.push({ p, v });
      } else line(p, p, off - tick * 0.45, off);
    }
    c.stroke();
    c.save();
    c.textAlign = 'center';
    const put = (text: string, p: number): void => {
      const A = at(p, lab);
      c.save();
      c.translate(A[0], A[1]);
      if (rotate) c.rotate(-Math.PI / 2);
      c.fillText(text, 0, 0);
      c.restore();
    };
    const tw = c.measureText('0000').width;
    for (const mk of marks) {
      if (labels && mk.p - tw / 2 > p0 + 2 && mk.p + tw / 2 < p1 - 2) put(fmt(locale, mk.v + half), mk.p);
      if (partial && prev && Math.abs(mk.p - prev.p) > tw * 1.3) {
        const mid = (mk.p + prev.p) / 2;
        put(fmt(locale, G), mid);
      }
      prev = mk;
    }
    c.restore();
  };
  const { sx: X, sy: Y } = cssProjector(L, view);
  edge(0, 2, X, (p, d) => [p, M[1] - d], true, false, false); // top: running totals
  edge(0, 2, X, (p, d) => [p, M[3] + d], false, true, false); // bottom: partials
  edge(1, 3, Y, (p, d) => [M[0] - d, p], true, false, true); // left: running totals, from the south
  edge(1, 3, Y, (p, d) => [M[2] + d, p], false, true, true); // right: partials

  // Corner crosshairs and the unit.
  c.lineWidth = 0.7;
  const r = Math.min(band, m) * 0.32 + 3;
  const corners: Point[] = [[M[0], M[1]], [M[2], M[1]], [M[0], M[3]], [M[2], M[3]]];
  for (const [x, y] of corners) {
    const cx = x + (x === M[0] ? -band / 2 : band / 2), cy = y + (y === M[1] ? -band / 2 : band / 2);
    c.beginPath();
    c.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
    c.moveTo(cx - r, cy); c.lineTo(cx + r, cy);
    c.moveTo(cx, cy - r); c.lineTo(cx, cy + r);
    c.stroke();
  }
  c.textAlign = 'center';
  c.fillText('m', M[0] - band / 2, M[1] - band / 2 + r + fs * 0.9);
}

// Largest font size (px) at which `text` fits in `width`, capped at `max`.
function fit(c: Ctx, family: string, text: string, width: number, max: number, weight = ''): number {
  c.font = `${weight}${max}px ${family}`;
  const w = c.measureText(text).width;
  return w <= width ? max : Math.max(6, (max * width) / w);
}

interface TextOptions { bold?: boolean; align?: CanvasTextAlign; base?: CanvasTextBaseline; alpha?: number }

export function drawTitleBlock(c: Ctx, L: SheetLayout, view: View, meta: MountMeta, o: CyanotypeOptions, paper: HTMLCanvasElement, locale: Locale): void {
  const copy = messages(locale).canvas;
  const [x0, y0, x1, y1] = L.cart;
  const cw = x1 - x0, ch = y1 - y0;

  // Knock the map out behind the block.
  c.save();
  c.beginPath();
  c.rect(x0, y0, cw, ch);
  c.clip();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.drawImage(paper, 0, 0);
  c.restore();

  c.strokeStyle = o.line;
  c.fillStyle = o.line;
  c.lineWidth = 1.3;
  c.strokeRect(x0, y0, cw, ch);
  c.lineWidth = 0.6;
  const r1 = y0 + ch * 0.42, r2 = y0 + ch * 0.6, r3 = y0 + ch * 0.82;
  const north = x1 - (r1 - y0);
  const mid = x0 + cw * 0.55;
  c.beginPath();
  for (const y of [r1, r2, r3]) { c.moveTo(x0, y); c.lineTo(x1, y); }
  c.moveTo(north, y0); c.lineTo(north, r1);
  c.moveTo(mid, r1); c.lineTo(mid, r2);
  c.moveTo(mid, r3); c.lineTo(mid, y1);
  c.stroke();

  const p = Math.max(5, cw * 0.025);
  const small = clamp(cw * 0.026, 6.5, 9);
  const text = (t: string, x: number, y: number, size: number, opts: TextOptions = {}): void => {
    c.font = `${opts.bold ? 'bold ' : ''}${size}px ${o.font}`;
    c.textAlign = opts.align ?? 'left';
    c.textBaseline = opts.base ?? 'alphabetic';
    c.globalAlpha = opts.alpha ?? 1;
    c.fillText(t, x, y);
    c.globalAlpha = 1;
  };
  const caption = (t: string, x: number, y: number): void => text(t, x + p * 0.8, y + small + p * 0.4, small * 0.85, { alpha: 0.7 });

  // Title and district.
  const title = meta.title.toLocaleUpperCase(locale);
  const tw = north - x0 - 2 * p;
  const ts = fit(c, o.font, title, tw, ch * 0.2, 'bold ');
  caption(copy.work, x0, y0);
  text(title, x0 + p, y0 + small + p * 0.6 + ts * 0.95, ts, { bold: true });
  const district = meta.district.toLocaleUpperCase(locale);
  text(district, x0 + p, r1 - p * 0.9, fit(c, o.font, district, tw, ch * 0.09), {});

  // North arrow.
  const nx = (north + x1) / 2, ny = (y0 + r1) / 2 + small * 0.4, nr = (r1 - y0) * 0.28;
  c.beginPath();
  c.arc(nx, ny, nr, 0, Math.PI * 2);
  c.stroke();
  c.beginPath();
  c.moveTo(nx, ny - nr * 1.15); c.lineTo(nx + nr * 0.38, ny + nr * 0.6); c.lineTo(nx, ny + nr * 0.25); c.closePath();
  c.fill();
  c.beginPath();
  c.moveTo(nx, ny - nr * 1.15); c.lineTo(nx - nr * 0.38, ny + nr * 0.6); c.lineTo(nx, ny + nr * 0.25); c.closePath();
  c.stroke();
  text(copy.north, nx, y0 + p * 0.5 + small, small, { align: 'center', bold: true });

  // Drawing kind and sheet number.
  const rowMid = (a: number, b: number): number => (a + b) / 2 + small * 0.35;
  text(copy.kind, x0 + p, rowMid(r1, r2), fit(c, o.font, copy.kind, mid - x0 - 2 * p, small));
  text(copy.sheet, x1 - p, rowMid(r1, r2), fit(c, o.font, copy.sheet, x1 - mid - 2 * p, small), { align: 'right' });

  // Scale: bar in four segments, and the ratio at screen resolution (96 px / in).
  caption(copy.scale, x0, r2);
  const ratio = 1 / (view.s * 0.0254 / 96);
  const rText = `1:${fmt(locale, Number(ratio.toPrecision(2)))}`;
  c.font = `${small}px ${o.font}`;
  const rW = c.measureText(rText).width;
  const sb = scaleBar(view.s, cw - 2 * p - rW - p * 3 - c.measureText(' 0000 M').width);
  const bx = x0 + p, by = r2 + (r3 - r2) * 0.62, bh = Math.max(3, (r3 - r2) * 0.16);
  c.lineWidth = 0.7;
  for (let i = 0; i < 4; i++) {
    const sx0 = bx + (sb.len * i) / 4;
    if (i % 2 === 0) c.fillRect(sx0, by - bh, sb.len / 4, bh);
    c.strokeRect(sx0, by - bh, sb.len / 4, bh);
  }
  text('0', bx, by + small * 1.05, small * 0.9, { align: 'center' });
  text(`${fmt(locale, sb.d)} m`, bx + sb.len + p * 0.6, by, small * 0.9);
  text(rText, x1 - p, by, small, { align: 'right' });

  // Coordinates and survey source.
  const lat = formatCoordinate(locale, meta.lat, 'lat', 4), lon = formatCoordinate(locale, meta.lon, 'lon', 4);
  const date = formatDate(locale, meta.fetchedAt);
  const bs = Math.min(small, fit(c, o.font, `${lat} ${lon}`, mid - x0 - 2 * p, small));
  text(`${lat} ${lon}`, x0 + p, rowMid(r3, y1), bs);
  text(copy.survey(date), x1 - p, rowMid(r3, y1), Math.min(small, fit(c, o.font, copy.survey(date), x1 - mid - 2 * p, small)), { align: 'right' });
}
