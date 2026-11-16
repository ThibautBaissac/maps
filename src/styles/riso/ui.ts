// Riso frame furniture: neatline, registration marks, cartouche, compass, legend.
// A / B are the contexts of the two ink plates; ink = { a, b } are their colours.
import type { MountMeta } from '../contract.ts';
import { formatLat, formatLon } from '../../place.ts';
import type { Point, Rect } from '../../toolkit/geometry.ts';
import { clamp, scaleBar, type Layout } from '../../toolkit/layout.ts';
import type { View } from '../../toolkit/viewport.ts';
import { FONT } from './font.ts';
import type { InkPatterns } from './inks.ts';

export interface Inks { a: string; b: string }

type Ctx = CanvasRenderingContext2D;

function strokeRect(ctx: Ctx, r: Rect, lw: number): void {
  ctx.lineWidth = lw;
  ctx.strokeRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
}

function regMark(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
  ctx.moveTo(x - r, y); ctx.lineTo(x + r, y);
  ctx.moveTo(x, y - r); ctx.lineTo(x, y + r);
  ctx.stroke();
}

function frame(A: Ctx, B: Ctx, L: Layout, ink: Inks): void {
  const { frame: F, map: M, band } = L;
  B.strokeStyle = ink.b;
  B.fillStyle = ink.b;
  strokeRect(B, F, 1.6);
  strokeRect(B, M, 1);
  // Alternating neatline blocks.
  const seg = clamp(L.u * 0.05, 22, 48);
  const inner = band * 0.55;
  for (let x = M[0], i = 0; x < M[2]; x += seg, i++) {
    if (i % 2) continue;
    const x2 = Math.min(M[2], x + seg);
    B.fillRect(x, M[1] - inner, x2 - x, inner);
    B.fillRect(x, M[3], x2 - x, inner);
  }
  for (let y = M[1], i = 0; y < M[3]; y += seg, i++) {
    if (i % 2) continue;
    const y2 = Math.min(M[3], y + seg);
    B.fillRect(M[0] - inner, y, inner, y2 - y);
    B.fillRect(M[2], y, inner, y2 - y);
  }
  // Corner squares in the first ink.
  A.fillStyle = ink.a;
  const corners: Point[] = [[F[0], F[1]], [M[2], F[1]], [F[0], M[3]], [M[2], M[3]]];
  for (const [x, y] of corners) A.fillRect(x, y, band, band);
  // Registration marks in both inks.
  if (L.m >= 16) {
    const r = L.m * 0.32;
    for (const ctx of [A, B]) {
      ctx.strokeStyle = ctx === A ? ink.a : ink.b;
      regMark(ctx, L.w / 2, L.m / 2, r);
      regMark(ctx, L.w / 2, L.h - L.m / 2, r);
      regMark(ctx, L.m / 2, L.h / 2, r);
      regMark(ctx, L.w - L.m / 2, L.h / 2, r);
    }
  }
}

function cartouche(A: Ctx, B: Ctx, L: Layout, view: View, meta: MountMeta, ink: Inks): void {
  const [x0, y0, x1, y1] = L.cart;
  const cw = x1 - x0, ch = y1 - y0;
  const pad = cw * 0.06;
  B.strokeStyle = ink.b;
  strokeRect(B, L.cart, 1.6);
  A.strokeStyle = ink.a;
  strokeRect(A, [x0 + 4, y0 + 4, x1 - 4, y1 - 4], 0.8);

  const title = meta.title.toUpperCase();
  const sub = meta.district.toUpperCase();
  const coords = `${formatLat(meta.lat, 4)}  ·  ${formatLon(meta.lon, 4)}`;
  A.font = `100px ${FONT}`;
  A.letterSpacing = '0px';
  const tw100 = A.measureText(title).width;
  const vertical = ch > cw * 1.4;
  let fs: number, cs: number;
  if (vertical) {
    cs = clamp(cw * 0.075, 11, 16);
    const along = ch - pad * 2 - cs * 4.5;
    fs = Math.min((cw - pad * 2 - cs * 1.8) / 1.45, (along / tw100) * 100);
  } else {
    fs = Math.min(ch * 0.44, ((cw - pad * 2) / tw100) * 100);
    cs = fs * 0.3 * 0.62;
  }
  const ss = fs * 0.3;
  // Text block in its own frame: horizontal at the top, or rotated up the column.
  for (const ctx of [A, B]) {
    ctx.save();
    if (vertical) {
      ctx.translate(x0 + pad + fs * 0.86, y0 + pad + (tw100 * fs) / 100);
      ctx.rotate(-Math.PI / 2);
    } else ctx.translate(x0 + pad, y0 + pad * 0.6 + fs * 0.86);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
  }
  const off = Math.max(2, fs * 0.04);
  A.font = B.font = `${fs}px ${FONT}`;
  B.fillStyle = ink.b;
  B.fillText(title, off, off);
  A.fillStyle = ink.a;
  A.fillText(title, 0, 0);
  B.font = `${ss}px ${FONT}`;
  B.letterSpacing = `${ss * 0.18}px`;
  B.fillText(sub, 0, ss * 1.25);
  A.font = `${cs}px ${FONT}`;
  A.letterSpacing = `${cs * 0.12}px`;
  A.fillText(coords, 0, ss * 1.25 + cs * 1.45);
  A.letterSpacing = B.letterSpacing = '0px';
  A.restore();
  B.restore();

  // Scale bar (4 alternating blocks).
  const maxLen = cw - pad * 2 - cs * 3;
  const { d, len } = scaleBar(view.s, maxLen);
  const bx = x0 + pad, by = y1 - pad - cs * 1.6, bh = Math.max(4, cs * 0.45);
  B.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const sx = bx + (len / 4) * i;
    if (i % 2 === 0) B.fillRect(sx, by, len / 4, bh);
    else B.strokeRect(sx + 0.5, by + 0.5, len / 4 - 1, bh - 1);
  }
  B.font = `${cs}px ${FONT}`;
  B.textBaseline = 'top';
  B.textAlign = 'center';
  B.fillText('0', bx, by + bh + 3);
  B.fillText(String(d / 2), bx + len / 2, by + bh + 3);
  B.textAlign = 'left';
  B.fillText(d >= 1000 ? `${d / 1000} KM` : `${d} M`, bx + len - cs * 0.3, by + bh + 3);
  B.textBaseline = 'alphabetic';
}

function compass(A: Ctx, B: Ctx, L: Layout, ink: Inks): void {
  const { x, y, r } = L.comp;
  B.strokeStyle = ink.b;
  B.fillStyle = ink.b;
  B.lineWidth = 1.3;
  B.beginPath(); B.arc(x, y, r, 0, Math.PI * 2); B.stroke();
  B.lineWidth = 0.7;
  B.beginPath(); B.arc(x, y, r * 0.84, 0, Math.PI * 2); B.stroke();
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2, l = i % 8 === 0 ? 0.16 : i % 4 === 0 ? 0.11 : 0.06;
    B.beginPath();
    B.moveTo(x + Math.cos(a) * r * 0.84, y + Math.sin(a) * r * 0.84);
    B.lineTo(x + Math.cos(a) * r * (0.84 + l), y + Math.sin(a) * r * (0.84 + l));
    B.stroke();
  }
  const point = (ctx: Ctx, a: number, len: number, wdt: number, side: 1 | -1, fill: boolean): void => {
    const tip: Point = [x + Math.cos(a) * len, y + Math.sin(a) * len];
    const b: Point = [x + Math.cos(a + side * Math.PI / 2) * wdt, y + Math.sin(a + side * Math.PI / 2) * wdt];
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(...tip); ctx.lineTo(...b); ctx.closePath();
    if (fill) ctx.fill(); else ctx.stroke();
  };
  A.fillStyle = ink.a;
  A.strokeStyle = ink.a;
  A.lineWidth = 1;
  // Diagonals in ink A, cardinals in ink B; north point overprinted.
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    point(A, a, r * 0.55, r * 0.12, 1, true);
    point(A, a, r * 0.55, r * 0.12, -1, false);
  }
  B.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 2;
    point(B, a, r * 0.8, r * 0.16, 1, true);
    point(B, a, r * 0.8, r * 0.16, -1, false);
  }
  point(A, -Math.PI / 2, r * 0.8, r * 0.16, -1, true);
  point(A, -Math.PI / 2, r * 0.8, r * 0.16, 1, true);
  const fs = r * 0.5;
  for (const ctx of [A, B]) {
    ctx.font = `${fs}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('N', x, y - r - fs * 0.18);
    ctx.textAlign = 'left';
  }
}

function legend(A: Ctx, B: Ctx, box: Rect, patterns: InkPatterns, dpr: number, ink: Inks): void {
  const [x0, y0, x1, y1] = box;
  const lw = x1 - x0;
  const row = (y1 - y0) / 5;
  const fs = clamp(row * 0.42, 11, 18);
  B.fillStyle = ink.b;
  B.strokeStyle = ink.b;
  B.font = `${fs * 1.15}px ${FONT}`;
  B.letterSpacing = `${fs * 0.2}px`;
  B.textBaseline = 'middle';
  B.textAlign = 'left';
  B.fillText('LÉGENDE', x0, y0 + row * 0.4);
  B.letterSpacing = '0px';
  B.lineWidth = 1;
  B.beginPath(); B.moveTo(x0, y0 + row * 0.85); B.lineTo(x1, y0 + row * 0.85); B.stroke();
  const sw = Math.min(row * 0.62, lw * 0.18), sh = sw * 0.62;
  const items = ['BÂTIMENTS', 'RUES & QUAIS', 'EAU', 'PARCS & JARDINS'];
  items.forEach((label, i) => {
    const cy = y0 + row * (1.5 + i);
    const sx = x0, sy = cy - sh / 2;
    if (i === 0) { A.fillStyle = ink.a; A.fillRect(sx, sy, sw, sh); }
    if (i === 1) {
      B.lineWidth = 2.4; B.lineCap = 'round';
      B.beginPath(); B.moveTo(sx, cy + sh * 0.25); B.quadraticCurveTo(sx + sw * 0.5, cy - sh * 0.5, sx + sw, cy); B.stroke();
    }
    if (i === 2 || i === 3) {
      // Patterns are defined in device pixels: draw them with an identity transform.
      B.save();
      B.setTransform(1, 0, 0, 1, 0, 0);
      B.fillStyle = i === 2 ? patterns.lines : patterns.dots;
      B.fillRect(sx * dpr, sy * dpr, sw * dpr, sh * dpr);
      B.restore();
      B.lineWidth = 1;
      B.setLineDash(i === 3 ? [2.5, 2] : []);
      B.strokeRect(sx, sy, sw, sh);
      B.setLineDash([]);
    }
    B.font = `${fs}px ${FONT}`;
    B.letterSpacing = `${fs * 0.08}px`;
    B.fillText(label, sx + sw + fs * 0.7, cy + 1);
    B.letterSpacing = '0px';
  });
  B.textBaseline = 'alphabetic';
}

export function renderUI(A: Ctx, B: Ctx, L: Layout, view: View, meta: MountMeta, dpr: number, patterns: InkPatterns, ink: Inks): void {
  for (const ctx of [A, B]) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  frame(A, B, L, ink);
  cartouche(A, B, L, view, meta, ink);
  compass(A, B, L, ink);
  if (L.legend) legend(A, B, L.legend, patterns, dpr, ink);
}
