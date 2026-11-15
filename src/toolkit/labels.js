// Street and waterway name placement along their lines (style-independent).
// Styles decide which names, sizes and inks; they also draw the returned glyphs.

const STREET_WEIGHT = {
  motorway: 5, trunk: 5, primary: 5, secondary: 4, tertiary: 3.5,
  primary_link: 2, secondary_link: 2, tertiary_link: 2,
  pedestrian: 2.4, unclassified: 1.5, residential: 1.5, living_street: 1.2,
};

// Joins open polylines sharing endpoints into longer chains.
function joinChains(lines) {
  const key = (p, i) => `${p[i]},${p[i + 1]}`;
  const rev = (p) => { const o = []; for (let i = p.length - 2; i >= 0; i -= 2) o.push(p[i], p[i + 1]); return o; };
  const pool = lines.map((l) => l.slice());
  const out = [];
  while (pool.length) {
    let c = pool.shift();
    let grown = true;
    while (grown) {
      grown = false;
      for (let i = 0; i < pool.length; i++) {
        const l = pool[i];
        const cs = key(c, 0), ce = key(c, c.length - 2), ls = key(l, 0), le = key(l, l.length - 2);
        if (ce === ls) c = c.concat(l.slice(2));
        else if (ce === le) c = c.concat(rev(l).slice(2));
        else if (cs === le) c = l.concat(c.slice(2));
        else if (cs === ls) c = rev(l).concat(c.slice(2));
        else continue;
        pool.splice(i, 1);
        grown = true;
        break;
      }
    }
    out.push(c);
  }
  const len = (p) => { let s = 0; for (let i = 2; i < p.length; i += 2) s += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]); return s; };
  return out.map((p) => ({ p, len: len(p) })).sort((a, b) => b.len - a.len);
}

function group(items, weightOf) {
  const m = new Map();
  for (const it of items) {
    const w = weightOf(it);
    if (!it.n || !w) continue;
    const g = m.get(it.n) ?? { name: it.n, w: 0, lines: [] };
    g.w = Math.max(g.w, w);
    g.lines.push(it.p);
    m.set(it.n, g);
  }
  return [...m.values()].map((g) => {
    const chains = joinChains(g.lines);
    const len = chains.reduce((s, c) => s + c.len, 0);
    return { name: g.name, w: g.w, chains, score: g.w * Math.sqrt(len) };
  }).sort((a, b) => b.score - a.score);
}

export function prepareLabels(data) {
  const streets = group(data.roads.filter((r) => !r.u), (r) => STREET_WEIGHT[r.k] ?? 0).slice(0, 90);
  const canals = group(data.waterways.filter((w) => !w.u), (w) => (/^(canal|river|fairway)$/.test(w.k) ? 1 : 0)).slice(0, 40);
  return { streets, canals };
}

function toScreen(p, P) {
  const pts = new Float32Array(p.length);
  for (let i = 0; i < p.length; i += 2) {
    pts[i] = (p[i] - P.view.x) * P.S + P.cx;
    pts[i + 1] = P.cy - (p[i + 1] - P.view.y) * P.S;
  }
  const cum = new Float32Array(p.length / 2);
  for (let i = 1; i < cum.length; i++) cum[i] = cum[i - 1] + Math.hypot(pts[2 * i] - pts[2 * i - 2], pts[2 * i + 1] - pts[2 * i - 1]);
  return { pts, cum, len: cum[cum.length - 1] };
}

function pointAt(g, d) {
  const { pts, cum } = g;
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= d) lo = mid; else hi = mid; }
  const seg = cum[hi] - cum[lo] || 1;
  const t = Math.min(1, Math.max(0, (d - cum[lo]) / seg));
  return [pts[2 * lo] + (pts[2 * hi] - pts[2 * lo]) * t, pts[2 * lo + 1] + (pts[2 * hi + 1] - pts[2 * lo + 1]) * t];
}

const overlaps = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

// Lays out characters along the path; returns glyph placements or null if too curvy / outside.
function layout(g, start, widths, tw, size, bounds) {
  const a0 = pointAt(g, start), a1 = pointAt(g, start + tw);
  const reversed = a1[0] < a0[0];
  const glyphs = [];
  let acc = 0, prev = null, minA = Infinity, maxA = -Infinity;
  for (let i = 0; i < widths.length; i++) {
    const cw = widths[i];
    const dc = reversed ? start + tw - (acc + cw / 2) : start + acc + cw / 2;
    const h = Math.max(cw, size * 0.5) / 2;
    const p0 = pointAt(g, reversed ? dc + h : dc - h), p1 = pointAt(g, reversed ? dc - h : dc + h);
    const a = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
    if (prev !== null) {
      let da = Math.abs(a - prev);
      if (da > Math.PI) da = 2 * Math.PI - da;
      if (da > 0.4) return null;
    }
    prev = a; minA = Math.min(minA, a); maxA = Math.max(maxA, a);
    const c = pointAt(g, dc);
    if (c[0] < bounds[0] || c[0] > bounds[2] || c[1] < bounds[1] || c[1] > bounds[3]) return null;
    glyphs.push({ x: c[0], y: c[1], a, cw });
    acc += cw;
  }
  if (maxA - minA > 1.1) return null;
  return glyphs;
}

/**
 * Places labels along lines, most important first, without collisions.
 * groups: [{ items, kind, size (CSS px), spacing (CSS px), maxPer, upper }]
 * Returns jobs: [{ kind, font, size, text: string[], glyphs: [{ x, y, a, cw }] }] in device px.
 */
export function placeLabels({ groups, P, mapRect, avoid, font, measureCtx }) {
  const dpr = P.dpr;
  const pad = 3 * dpr;
  const bounds = [mapRect[0] + 10 * dpr, mapRect[1] + 10 * dpr, mapRect[2] - 10 * dpr, mapRect[3] - 10 * dpr];
  const placed = avoid.map((r) => r.slice());
  const jobs = [];

  const tryItem = (item, g0) => {
    const { kind, size, spacing, maxPer } = g0;
    const text = g0.upper === false ? item.name : item.name.toUpperCase();
    const f = `${size * dpr}px ${font}`;
    measureCtx.font = f;
    const widths = [...text].map((ch) => measureCtx.measureText(ch).width + spacing * dpr);
    const tw = widths.reduce((s, w) => s + w, 0);
    const step = Math.max(tw * 2.2, 380 * dpr);
    let count = 0;
    for (const chain of item.chains) {
      if (count >= maxPer) break;
      if (chain.len * P.S < tw + 24 * dpr) continue;
      const g = toScreen(chain.p, P);
      const centers = [g.len / 2];
      for (let d = step; g.len / 2 + d + tw / 2 < g.len; d += step) centers.push(g.len / 2 + d, g.len / 2 - d);
      // Off-centre fallbacks when the middle is taken or too curvy.
      for (const fr of [0.3, 0.7, 0.15, 0.85]) centers.push(g.len * fr);
      for (const c of centers) {
        if (count >= maxPer) break;
        const start = c - tw / 2;
        if (start < 4 * dpr || start + tw > g.len - 4 * dpr) continue;
        const glyphs = layout(g, start, widths, tw, size * dpr, bounds);
        if (!glyphs) continue;
        const r = (size * dpr) / 2 + pad;
        const boxes = glyphs.map((q) => [q.x - r, q.y - r, q.x + r, q.y + r]);
        if (boxes.some((b) => placed.some((p) => overlaps(b, p)))) continue;
        placed.push(...boxes);
        jobs.push({ kind, font: f, size, text: [...text], glyphs });
        count++;
      }
    }
  };

  for (const g of groups) for (const item of g.items) tryItem(item, g);
  return jobs;
}

// Draws glyphs of one job with fillText or strokeText; the caller sets styles.
export function drawJob(ctx, job, mode = 'fill') {
  ctx.font = job.font;
  job.glyphs.forEach((q, i) => {
    ctx.setTransform(1, 0, 0, 1, q.x, q.y);
    ctx.rotate(q.a);
    if (mode === 'stroke') ctx.strokeText(job.text[i], 0, 0);
    else ctx.fillText(job.text[i], 0, 0);
  });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
