const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export { clamp };

// Page layout in CSS px: frame, map window, square plate size and the slots styles
// draw their furniture in (cartouche, compass, legend, back link).
export function computeLayout(w, h) {
  const u = Math.min(w, h);
  const m = clamp(u * 0.035, 12, 34);
  const band = clamp(u * 0.012, 5, 9);
  const frame = [m, m, w - m, h - m];
  const map = [m + band, m + band, w - m - band, h - m - band];
  const pad = clamp(u * 0.025, 10, 22);
  const mw = map[2] - map[0], mh = map[3] - map[1];
  // Square plate size at full zoom-out. In portrait it overflows the width a little
  // (pan sideways) so the page is not mostly empty.
  const plate = mh > mw ? Math.min(mh, Math.sqrt(mw * mh)) : Math.min(mw, mh);
  const side = (mw - plate) / 2, below = (mh - plate) / 2;
  const navH = 28; // "back to gallery" link, top-left of the map window
  const nav = [map[0] + 6, map[1] + 6, map[0] + 6 + 150, map[1] + 6 + navH];
  let cw = clamp(Math.min(w * 0.5, u * 0.46), 180, 360);
  const r = clamp(u * 0.055, 24, 50);
  let cart, comp, legend = null;
  if (side >= 180 + pad * 2) {
    // Landscape with room beside the plate: full-height cartouche left (vertical title),
    // compass and legend right.
    cw = Math.min(cw, side - pad * 2);
    const cx = map[0] + (side - cw) / 2;
    cart = [cx, map[1] + pad * 2 + navH, cx + cw, map[3] - pad * 2];
    const rx = map[2] - side / 2;
    comp = { x: rx, y: map[1] + pad * 2 + r * 1.4, r };
    const lw = Math.min(side - pad * 2, 220);
    if (side >= 150 + pad * 2) legend = [rx - lw / 2, comp.y + r * 1.6, rx + lw / 2, comp.y + r * 1.6 + lw * 0.78];
  } else if (below >= cw * 0.5 + pad + 30) {
    // Portrait with room under the plate; keep clear of the attribution (bottom right).
    const ch = cw * 0.5;
    const cx = (w - cw) / 2;
    const attrH = 30;
    cart = [cx, map[3] - pad - attrH - ch, cx + cw, map[3] - pad - attrH];
    comp = { x: map[2] - pad - r, y: map[1] + pad + r * 1.25, r };
  } else {
    const ch = cw * 0.5;
    cart = [map[0] + pad, map[3] - pad - ch, map[0] + pad + cw, map[3] - pad];
    comp = { x: map[2] - pad - r, y: map[1] + pad + r * 1.25, r };
  }
  return { w, h, u, m, band, frame, map, pad, plate, nav, cart, comp, legend };
}

export function scaleBar(s, maxLen) {
  const steps = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
  let d = steps[0];
  for (const v of steps) if (v * s <= maxLen) d = v;
  return { d, len: d * s };
}

// Areas where the map is replaced by the bare page background (CSS px).
export function knockouts(L) {
  const c = L.comp;
  const fs = c.r * 0.5;
  return {
    rects: [
      [L.cart[0] - 3, L.cart[1] - 3, L.cart[2] + 3, L.cart[3] + 3],
      ...(L.legend ? [[L.legend[0] - 8, L.legend[1] - 8, L.legend[2] + 8, L.legend[3] + 4]] : []),
    ],
    circles: [{ x: c.x, y: c.y, r: c.r * 1.22 }, { x: c.x, y: c.y - c.r - fs * 0.5, r: fs * 0.62 }],
  };
}

// Boxes (device px) that map labels must avoid: furniture and HTML overlays.
export function avoidBoxes(L, dpr) {
  const ko = knockouts(L);
  const attr = [L.map[2] - 230, L.map[3] - 34, L.map[2], L.map[3]];
  return [
    ...ko.rects,
    ...ko.circles.map((c) => [c.x - c.r, c.y - c.r, c.x + c.r, c.y + c.r]),
    L.nav,
    attr,
  ].map((r) => r.map((v) => v * dpr));
}
