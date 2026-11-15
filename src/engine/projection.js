import { vnoise } from './noise.js';

export function bboxOf(rings) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const r of rings) for (let i = 0; i < r.length; i += 2) {
    const x = r[i], y = r[i + 1];
    if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y;
  }
  return [a, b, c, d];
}

// Map metres (y north) -> device px (y down), with a coherent "hand-drawn" wobble.
// Styles that want straight lines pass k = 0 to pt().
export function makeProjector(view, W, H, dpr) {
  const S = view.s * dpr, cx = W / 2, cy = H / 2;
  const lam = 2 ** Math.round(Math.log2((70 * dpr) / S)); // wobble wavelength (m), stable per octave
  const inv = 1 / lam;
  const amp = Math.min(2.2, 0.7 + 0.4 * Math.log2(1 + view.s)) * dpr;
  const pad = 30 / S;
  const vb = [view.x - cx / S - pad, view.y - cy / S - pad, view.x + cx / S + pad, view.y + cy / S + pad];
  return {
    view, dpr, S, cx, cy, vb, amp, inv,
    visible: (bb) => bb[2] >= vb[0] && bb[0] <= vb[2] && bb[3] >= vb[1] && bb[1] <= vb[3],
    // Writes [sx, sy] for map point (x, y) with the wobble scaled by k.
    pt(x, y, k, out) {
      const a = amp * k;
      out[0] = (x - view.x) * S + cx + (a && vnoise(x * inv, y * inv) * a);
      out[1] = cy - (y - view.y) * S + (a && vnoise(x * inv + 31.7, y * inv - 17.3) * a);
    },
  };
}

const tmp = [0, 0];

// Adds closed rings (flat [x, y, ...] arrays in metres) to the current path.
export function addRings(ctx, P, rings, k = 1) {
  for (const r of rings) {
    P.pt(r[0], r[1], k, tmp);
    ctx.moveTo(tmp[0], tmp[1]);
    for (let i = 2; i < r.length; i += 2) {
      P.pt(r[i], r[i + 1], k, tmp);
      ctx.lineTo(tmp[0], tmp[1]);
    }
    ctx.closePath();
  }
}

// Adds a polyline; long segments are subdivided so the wobble bends them a little.
export function addLine(ctx, P, p, maxSeg, k = 1) {
  let x0 = p[0], y0 = p[1];
  P.pt(x0, y0, k, tmp);
  ctx.moveTo(tmp[0], tmp[1]);
  for (let i = 2; i < p.length; i += 2) {
    const x1 = p[i], y1 = p[i + 1];
    const n = k ? Math.min(40, Math.ceil((Math.hypot(x1 - x0, y1 - y0) * P.S) / maxSeg)) : 1;
    for (let j = 1; j <= n; j++) {
      const t = j / n;
      P.pt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, k, tmp);
      ctx.lineTo(tmp[0], tmp[1]);
    }
    x0 = x1; y0 = y1;
  }
}

// Erases everything outside the square plate and feathers its edges (destination-out).
export function fadePlate(ctx, P, half) {
  const { S, cx, cy, view, dpr } = P;
  const x0 = (-half - view.x) * S + cx, x1 = (half - view.x) * S + cx;
  const y0 = cy - (half - view.y) * S, y1 = cy - (-half - view.y) * S;
  const f = Math.min((x1 - x0) * 0.14, Math.max(50 * dpr, 170 * S));
  const { width: W, height: H } = ctx.canvas;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.fillStyle = '#000';
  ctx.fill('evenodd');
  const strip = (gx0, gy0, gx1, gy1, rx, ry, rw, rh) => {
    const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.35, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
  };
  strip(x0, 0, x0 + f, 0, x0, y0, f, y1 - y0);
  strip(x1, 0, x1 - f, 0, x1 - f, y0, f, y1 - y0);
  strip(0, y0, 0, y0 + f, x0, y0, x1 - x0, f);
  strip(0, y1, 0, y1 - f, x0, y1 - f, x1 - x0, f);
  ctx.restore();
}
