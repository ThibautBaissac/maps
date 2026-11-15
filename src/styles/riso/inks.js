import { makeCanvas, pixelCanvas, vnoise } from '../../toolkit/noise.js';

// Per-ink texture: speckled drop-outs plus large uneven coverage, removed with destination-out.
export function makeInkTexture(W, H, seed) {
  const speckle = pixelCanvas(384, 384, seed, (r) => {
    const v = r();
    const a = v < 0.035 ? 140 + r() * 115 : r() * r() * 70;
    return [0, 0, 0, Math.round(a)];
  });
  const sw = Math.ceil(W / 90) + 2, sh = Math.ceil(H / 90) + 2;
  const blotch = pixelCanvas(sw, sh, seed + 9, (r, x, y) => {
    const n = vnoise(x * 0.35 + seed, y * 0.35) * 0.5 + 0.5;
    return [0, 0, 0, Math.round(Math.max(0, n - 0.35) * 110 + r() * 12)];
  });
  return { speckle, blotch };
}

export function applyInkTexture(ctx, tex) {
  const { width: W, height: H } = ctx.canvas;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = ctx.createPattern(tex.speckle, 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tex.blotch, 0, 0, W, H);
  ctx.restore();
}

// Halftone dots (rotated screen) and water line hatching in one ink, in device pixels.
export function makePatterns(ctx, dpr, ink) {
  const ds = Math.max(3, Math.round(4.2 * dpr));
  const dot = makeCanvas(ds, ds);
  const dc = dot.getContext('2d');
  dc.fillStyle = ink;
  dc.beginPath();
  dc.arc(ds / 2, ds / 2, 0.95 * dpr, 0, Math.PI * 2);
  dc.fill();
  const dots = ctx.createPattern(dot, 'repeat');
  dots.setTransform(new DOMMatrix().rotateSelf(0, 0, 22));

  const ls = Math.max(2, Math.round(3.1 * dpr));
  const line = makeCanvas(4, ls);
  const lc = line.getContext('2d');
  lc.fillStyle = ink;
  lc.fillRect(0, 0, 4, Math.max(1, Math.round(1.25 * dpr)));
  const lines = ctx.createPattern(line, 'repeat');
  return { dots, lines };
}
