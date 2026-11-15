// The drawing itself: white linework on transparent, rendered once per settled view.
// Buildings in outline, parks cross-hatched, water as depth lines along the shore,
// streets as double lines (single at small scale), stairs as ladders.
import { addLine, addRings, bboxOf } from '../../toolkit/projection.js';

// Street width in metres when drawn as a double line, and the smallest gap (CSS px)
// it keeps when zoomed out. Gaps under CASED px fall back to a single line.
const CASED = 2.4;
const STREETS = {
  motorway: { m: 18, min: 3.4 }, trunk: { m: 16, min: 3.2 }, primary: { m: 14, min: 3 },
  secondary: { m: 12, min: 2.8 }, tertiary: { m: 10, min: 2.4 },
  motorway_link: { m: 8, min: 0 }, trunk_link: { m: 8, min: 0 }, primary_link: { m: 8, min: 0 },
  secondary_link: { m: 7, min: 0 }, tertiary_link: { m: 7, min: 0 },
  unclassified: { m: 7, min: 0 }, residential: { m: 7, min: 0 },
  living_street: { m: 5.5, min: 0 }, pedestrian: { m: 5.5, min: 0 }, service: { m: 4, min: 0 },
};
const STREET_ORDER = Object.keys(STREETS).reverse(); // thin first
// Paths: minimum zoom (px/m) and dash pattern in CSS px.
const PATHS = {
  footway: { min: 0.9, dash: [3, 2] }, cycleway: { min: 0.9, dash: [4, 2] },
  path: { min: 1.1, dash: [1.5, 2] }, track: { min: 1.1, dash: [5, 2.5] },
};

export function prepareMap(data) {
  const withBox = (o, rings) => ({ ...o, bb: bboxOf(rings) });
  const streets = {}, paths = {};
  for (const k of STREET_ORDER) streets[k] = [];
  for (const k of Object.keys(PATHS)) paths[k] = [];
  const steps = [];
  for (const r of data.roads) {
    const it = withBox(r, [r.p]);
    if (streets[r.k]) streets[r.k].push(it);
    else if (paths[r.k]) paths[r.k].push(it);
    else if (r.k === 'steps') steps.push(it);
  }
  return {
    buildings: data.buildings.map((r) => ({ r, bb: bboxOf(r) })),
    water: data.water.map((w) => withBox(w, w.r)),
    parks: data.parks.map((p) => withBox(p, p.r)),
    streams: data.waterways.filter((w) => !w.u).map((w) => withBox(w, [w.p])),
    streets, paths, steps,
    half: data.meta.half,
  };
}

// Screen-scale cross-hatching (same pitch at every zoom).
export function makeHatch(ctx, dpr, pitch, color) {
  const p = Math.max(3, Math.round(pitch * dpr));
  const tile = document.createElement('canvas');
  tile.width = tile.height = p;
  const t = tile.getContext('2d');
  t.fillStyle = color;
  const lw = Math.max(1, Math.round(0.6 * dpr));
  t.fillRect(0, 0, p, lw);
  t.fillRect(0, 0, lw, p);
  const pat = ctx.createPattern(tile, 'repeat');
  pat.setTransform(new DOMMatrix().rotateSelf(45));
  return pat;
}

const streetGap = (k, s) => Math.max(STREETS[k].min, STREETS[k].m * s);

// Depth lines along the shore: concentric rings cut from wide strokes, kept inside the water.
function drawWater(ctx, tmp, M, P, o, half) {
  const { dpr } = P;
  const water = M.water.filter((w) => P.visible(w.bb));
  if (!water.length) return;
  const fill = new Path2D();
  for (const w of water) addRings(fill, P, w.r, 0);
  // Shore only: skip edges lying on the border of the downloaded square.
  const shore = new Path2D();
  const e = half - 1;
  const onEdge = (x, y) => Math.abs(x) >= e || Math.abs(y) >= e;
  const pt = [0, 0];
  for (const w of water) for (const r of w.r) {
    let pen = false;
    for (let i = 0; i < r.length; i += 2) {
      const j = (i + 2) % r.length;
      const a = onEdge(r[i], r[i + 1]) && onEdge(r[j], r[j + 1]);
      if (a) { pen = false; continue; }
      if (!pen) { P.pt(r[i], r[i + 1], 0, pt); shore.moveTo(pt[0], pt[1]); pen = true; }
      P.pt(r[j], r[j + 1], 0, pt);
      shore.lineTo(pt[0], pt[1]);
    }
  }
  const t = tmp;
  t.setTransform(1, 0, 0, 1, 0, 0);
  t.clearRect(0, 0, t.canvas.width, t.canvas.height);
  t.lineJoin = 'round';
  t.strokeStyle = o.line;
  const lw = 0.6 * dpr;
  for (let i = o.contours; i >= 1; i--) {
    const d = 2.6 * Math.pow(i, 1.35) * dpr;
    t.globalCompositeOperation = 'source-over';
    t.globalAlpha = Math.max(0.3, 0.95 - i * 0.065);
    t.lineWidth = 2 * d + lw;
    t.stroke(shore);
    t.globalAlpha = 1;
    t.globalCompositeOperation = 'destination-out';
    t.lineWidth = 2 * d - lw;
    t.stroke(shore);
  }
  t.globalCompositeOperation = 'destination-in';
  t.fillStyle = '#000';
  t.fill(fill, 'evenodd');
  t.globalCompositeOperation = 'source-over';
  t.lineWidth = 1.1 * dpr;
  t.stroke(shore);
  ctx.drawImage(t.canvas, 0, 0);
}

// Ladder ticks across a polyline (stairs), every `gap` device px.
function ladder(ctx, P, p, gap, half) {
  const a = [0, 0], b = [0, 0];
  let carry = gap / 2;
  for (let i = 2; i < p.length; i += 2) {
    P.pt(p[i - 2], p[i - 1], 0, a);
    P.pt(p[i], p[i + 1], 0, b);
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (!len) continue;
    const nx = (-dy / len) * half, ny = (dx / len) * half;
    let t = carry;
    for (; t < len; t += gap) {
      const x = a[0] + (dx * t) / len, y = a[1] + (dy * t) / len;
      ctx.moveTo(x - nx, y - ny);
      ctx.lineTo(x + nx, y + ny);
    }
    carry = t - len;
  }
}

export function renderMap(ctx, tmp, M, P, view, o, hatch) {
  const { dpr } = P;
  const s = view.s;
  ctx.strokeStyle = o.line;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'butt';

  // Parks: cross-hatching and a fine outline.
  const parks = new Path2D();
  for (const p of M.parks) if (P.visible(p.bb)) addRings(parks, P, p.r, 0);
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = hatch;
  ctx.fill(parks, 'nonzero');
  ctx.globalAlpha = 1;
  ctx.lineWidth = 0.6 * dpr;
  ctx.stroke(parks);

  drawWater(ctx, tmp, M, P, o, M.half);

  // Streams and drains; navigation channels (fairways) as a faint dashed line.
  ctx.lineWidth = 0.8 * dpr;
  ctx.beginPath();
  for (const w of M.streams) if (w.k !== 'fairway' && P.visible(w.bb)) addLine(ctx, P, w.p, 1e9, 0);
  ctx.stroke();
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 0.6 * dpr;
  ctx.setLineDash([8 * dpr, 4 * dpr, 1.5 * dpr, 4 * dpr]);
  ctx.beginPath();
  for (const w of M.streams) if (w.k === 'fairway' && P.visible(w.bb)) addLine(ctx, P, w.p, 1e9, 0);
  ctx.stroke();
  ctx.restore();

  // Buildings: outline only, in small batches (one huge path is slow).
  ctx.lineWidth = Math.min(1.1, o.building * Math.pow(Math.max(1, s), 0.15)) * dpr;
  ctx.globalAlpha = s < 0.5 ? 0.8 : 0.95;
  let n = 0;
  ctx.beginPath();
  for (const b of M.buildings) {
    if (!P.visible(b.bb)) continue;
    addRings(ctx, P, b.r, 0);
    if (++n % 250 === 0) { ctx.stroke(); ctx.beginPath(); }
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Paths and stairs, single fine lines.
  ctx.lineWidth = 0.6 * dpr;
  for (const [k, st] of Object.entries(PATHS)) {
    if (s < st.min) continue;
    ctx.setLineDash(st.dash.map((d) => d * dpr));
    ctx.beginPath();
    for (const r of M.paths[k]) if (P.visible(r.bb)) addLine(ctx, P, r.p, 1e9, 0);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  if (s >= 0.9) {
    ctx.beginPath();
    for (const r of M.steps) if (P.visible(r.bb)) addLine(ctx, P, r.p, 1e9, 0);
    ctx.stroke();
    if (s >= 1.8) {
      ctx.lineWidth = 0.5 * dpr;
      ctx.beginPath();
      const gap = Math.max(2.6 * dpr, 0.9 * s * dpr), half = Math.min(1.6 * s, 6) * dpr;
      for (const r of M.steps) if (P.visible(r.bb)) ladder(ctx, P, r.p, gap, half);
      ctx.stroke();
    }
  }

  // Streets too narrow on screen for a double line.
  const lw = o.road * dpr;
  const cased = [];
  for (const k of STREET_ORDER) {
    const gap = streetGap(k, s);
    if (k === 'service' && s < 0.8) continue;
    const list = M.streets[k].filter((r) => P.visible(r.bb));
    if (gap >= CASED) { cased.push({ k, gap: gap * dpr, list }); continue; }
    ctx.lineWidth = (gap < 1.2 ? 0.7 : 1) * dpr;
    ctx.setLineDash(k === 'service' ? [3 * dpr, 1.5 * dpr] : []);
    ctx.beginPath();
    for (const r of list) if (!r.b) addLine(ctx, P, r.p, 1e9, 0);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Double lines: white corridor, then its inside erased, so crossings merge cleanly.
  const strokeAll = (pick, extra) => {
    for (const c of cased) {
      ctx.lineWidth = c.gap + extra;
      ctx.beginPath();
      for (const r of c.list) if (pick(r)) addLine(ctx, P, r.p, 1e9, 0);
      ctx.stroke();
    }
  };
  const ground = (r) => !r.b && !r.u;
  ctx.lineCap = 'round';
  strokeAll(ground, 2 * lw);
  ctx.globalCompositeOperation = 'destination-out';
  strokeAll(ground, 0);
  // Bridges cut through whatever they cross, then get their own double line.
  ctx.lineCap = 'butt';
  strokeAll((r) => r.b, 2 * lw + 3 * dpr);
  ctx.globalCompositeOperation = 'source-over';
  strokeAll((r) => r.b, 2 * lw);
  ctx.globalCompositeOperation = 'destination-out';
  strokeAll((r) => r.b, 0);
  ctx.globalCompositeOperation = 'source-over';
  // Tunnels: dashed centre line.
  ctx.lineWidth = 0.7 * dpr;
  ctx.setLineDash([4 * dpr, 3 * dpr]);
  ctx.beginPath();
  for (const c of cased) for (const r of c.list) if (r.u && !r.b) addLine(ctx, P, r.p, 1e9, 0);
  ctx.stroke();
  ctx.setLineDash([]);
}
