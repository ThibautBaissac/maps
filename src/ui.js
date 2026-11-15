import { INK } from './inks.js';
import { FONT } from './labels.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Page layout in CSS px.
export function computeLayout(w, h) {
  const u = Math.min(w, h);
  const m = clamp(u * 0.035, 12, 34);
  const band = clamp(u * 0.012, 5, 9);
  const frame = [m, m, w - m, h - m];
  const map = [m + band, m + band, w - m - band, h - m - band];
  const pad = clamp(u * 0.025, 10, 22);
  const cw = clamp(Math.min(w * 0.5, u * 0.46), 180, 360);
  const ch = cw * 0.5;
  const cart = [map[0] + pad, map[3] - pad - ch, map[0] + pad + cw, map[3] - pad];
  const r = clamp(u * 0.055, 24, 50);
  const comp = { x: map[2] - pad - r, y: map[1] + pad + r * 1.25, r };
  return { w, h, u, m, band, frame, map, pad, cart, comp };
}

export function scaleBar(s, maxLen) {
  const steps = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
  let d = steps[0];
  for (const v of steps) if (v * s <= maxLen) d = v;
  return { d, len: d * s };
}

function strokeRect(ctx, r, lw) {
  ctx.lineWidth = lw;
  ctx.strokeRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
}

function regMark(ctx, x, y, r) {
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
  ctx.moveTo(x - r, y); ctx.lineTo(x + r, y);
  ctx.moveTo(x, y - r); ctx.lineTo(x, y + r);
  ctx.stroke();
}

function frame(pink, blue, L) {
  const { frame: F, map: M, band } = L;
  blue.strokeStyle = INK.blue;
  blue.fillStyle = INK.blue;
  strokeRect(blue, F, 1.6);
  strokeRect(blue, M, 1);
  // Alternating neatline blocks.
  const seg = clamp(L.u * 0.05, 22, 48);
  const inner = band * 0.55;
  for (let x = M[0], i = 0; x < M[2]; x += seg, i++) {
    if (i % 2) continue;
    const x2 = Math.min(M[2], x + seg);
    blue.fillRect(x, M[1] - inner, x2 - x, inner);
    blue.fillRect(x, M[3], x2 - x, inner);
  }
  for (let y = M[1], i = 0; y < M[3]; y += seg, i++) {
    if (i % 2) continue;
    const y2 = Math.min(M[3], y + seg);
    blue.fillRect(M[0] - inner, y, inner, y2 - y);
    blue.fillRect(M[2], y, inner, y2 - y);
  }
  // Pink corner squares.
  pink.fillStyle = INK.pink;
  for (const [x, y] of [[F[0], F[1]], [M[2], F[1]], [F[0], M[3]], [M[2], M[3]]]) pink.fillRect(x, y, band, band);
  // Registration marks in both inks.
  if (L.m >= 16) {
    const r = L.m * 0.32;
    for (const ctx of [pink, blue]) {
      ctx.strokeStyle = ctx === pink ? INK.pink : INK.blue;
      regMark(ctx, L.w / 2, L.m / 2, r);
      regMark(ctx, L.w / 2, L.h - L.m / 2, r);
      regMark(ctx, L.m / 2, L.h / 2, r);
      regMark(ctx, L.w - L.m / 2, L.h / 2, r);
    }
  }
}

function cartouche(pink, blue, L, view, meta) {
  const [x0, y0, x1, y1] = L.cart;
  const cw = x1 - x0, ch = y1 - y0;
  const pad = cw * 0.06;
  blue.strokeStyle = INK.blue;
  strokeRect(blue, L.cart, 1.6);
  pink.strokeStyle = INK.pink;
  strokeRect(pink, [x0 + 4, y0 + 4, x1 - 4, y1 - 4], 0.8);

  const title = meta.name.toUpperCase();
  pink.font = `100px ${FONT}`;
  pink.letterSpacing = '0px';
  const fs = Math.min(ch * 0.44, ((cw - pad * 2) / pink.measureText(title).width) * 100);
  const ty = y0 + pad * 0.6 + fs * 0.86;
  pink.font = blue.font = `${fs}px ${FONT}`;
  pink.textBaseline = blue.textBaseline = 'alphabetic';
  const off = Math.max(2, fs * 0.04);
  blue.fillStyle = INK.blue;
  blue.fillText(title, x0 + pad + off, ty + off);
  pink.fillStyle = INK.pink;
  pink.fillText(title, x0 + pad, ty);

  const sub = `${meta.district.toUpperCase()}`;
  const ss = fs * 0.3;
  blue.font = `${ss}px ${FONT}`;
  blue.letterSpacing = `${ss * 0.18}px`;
  blue.fillText(sub, x0 + pad, ty + ss * 1.25);
  const coords = `${Math.abs(meta.lat).toFixed(4)}°${meta.lat >= 0 ? 'N' : 'S'}  ·  ${Math.abs(meta.lon).toFixed(4)}°${meta.lon >= 0 ? 'E' : 'W'}`;
  const cs = ss * 0.62;
  pink.font = `${cs}px ${FONT}`;
  pink.letterSpacing = `${cs * 0.12}px`;
  pink.fillText(coords, x0 + pad, ty + ss * 1.25 + cs * 1.45);
  pink.letterSpacing = blue.letterSpacing = '0px';

  // Scale bar (4 alternating blocks).
  const maxLen = cw - pad * 2 - cs * 3;
  const { d, len } = scaleBar(view.s, maxLen);
  const bx = x0 + pad, by = y1 - pad - cs * 1.6, bh = Math.max(4, cs * 0.45);
  blue.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const sx = bx + (len / 4) * i;
    if (i % 2 === 0) blue.fillRect(sx, by, len / 4, bh);
    else blue.strokeRect(sx + 0.5, by + 0.5, len / 4 - 1, bh - 1);
  }
  blue.font = `${cs}px ${FONT}`;
  blue.textBaseline = 'top';
  blue.textAlign = 'center';
  blue.fillText('0', bx, by + bh + 3);
  blue.fillText(String(d / 2), bx + len / 2, by + bh + 3);
  blue.textAlign = 'left';
  blue.fillText(d >= 1000 ? `${d / 1000} KM` : `${d} M`, bx + len - cs * 0.3, by + bh + 3);
  blue.textBaseline = 'alphabetic';
}

function compass(pink, blue, L) {
  const { x, y, r } = L.comp;
  blue.strokeStyle = INK.blue;
  blue.fillStyle = INK.blue;
  blue.lineWidth = 1.3;
  blue.beginPath(); blue.arc(x, y, r, 0, Math.PI * 2); blue.stroke();
  blue.lineWidth = 0.7;
  blue.beginPath(); blue.arc(x, y, r * 0.84, 0, Math.PI * 2); blue.stroke();
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2, l = i % 8 === 0 ? 0.16 : i % 4 === 0 ? 0.11 : 0.06;
    blue.beginPath();
    blue.moveTo(x + Math.cos(a) * r * 0.84, y + Math.sin(a) * r * 0.84);
    blue.lineTo(x + Math.cos(a) * r * (0.84 + l), y + Math.sin(a) * r * (0.84 + l));
    blue.stroke();
  }
  const point = (ctx, a, len, wdt, side, fill) => {
    const tip = [x + Math.cos(a) * len, y + Math.sin(a) * len];
    const b = [x + Math.cos(a + side * Math.PI / 2) * wdt, y + Math.sin(a + side * Math.PI / 2) * wdt];
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(...tip); ctx.lineTo(...b); ctx.closePath();
    if (fill) ctx.fill(); else ctx.stroke();
  };
  pink.fillStyle = INK.pink;
  pink.strokeStyle = INK.pink;
  pink.lineWidth = 1;
  // Diagonals in pink, cardinals in blue; north half overprinted (violet).
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    point(pink, a, r * 0.55, r * 0.12, 1, true);
    point(pink, a, r * 0.55, r * 0.12, -1, false);
  }
  blue.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 2;
    point(blue, a, r * 0.8, r * 0.16, 1, true);
    point(blue, a, r * 0.8, r * 0.16, -1, false);
  }
  point(pink, -Math.PI / 2, r * 0.8, r * 0.16, -1, true);
  point(pink, -Math.PI / 2, r * 0.8, r * 0.16, 1, true);
  const fs = r * 0.5;
  for (const ctx of [pink, blue]) {
    ctx.font = `${fs}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('N', x, y - r - fs * 0.18);
    ctx.textAlign = 'left';
  }
}

export function renderUI(pink, blue, L, view, meta, dpr) {
  for (const ctx of [pink, blue]) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  frame(pink, blue, L);
  cartouche(pink, blue, L, view, meta);
  compass(pink, blue, L);
}

// Areas where the map is replaced by bare paper (CSS px).
export function knockouts(L) {
  const c = L.comp;
  const fs = c.r * 0.5;
  return {
    rects: [[L.cart[0] - 3, L.cart[1] - 3, L.cart[2] + 3, L.cart[3] + 3]],
    circles: [{ x: c.x, y: c.y, r: c.r * 1.22 }, { x: c.x, y: c.y - c.r - fs * 0.5, r: fs * 0.62 }],
  };
}
