import { context2d, makeCanvas, pattern } from '../../toolkit/canvas.ts';
import { pixelCanvas, vnoise } from '../../toolkit/noise.ts';

export interface InkTexture { speckle: HTMLCanvasElement; blotch: HTMLCanvasElement }
export interface InkPatterns { dots: CanvasPattern; lines: CanvasPattern }

// Speckled drop-outs of one ink: a repeating tile, independent of the page size.
export function makeSpeckle(seed: number): HTMLCanvasElement {
  return pixelCanvas(384, 384, seed, (r) => {
    const v = r();
    const a = v < 0.035 ? 140 + r() * 115 : r() * r() * 70;
    return [0, 0, 0, Math.round(a)];
  });
}

// Per-ink texture: speckled drop-outs plus large uneven coverage, removed with destination-out.
export function makeInkTexture(speckle: HTMLCanvasElement, W: number, H: number, seed: number): InkTexture {
  const sw = Math.ceil(W / 90) + 2, sh = Math.ceil(H / 90) + 2;
  const blotch = pixelCanvas(sw, sh, seed + 9, (r, x, y) => {
    const n = vnoise(x * 0.35 + seed, y * 0.35) * 0.5 + 0.5;
    return [0, 0, 0, Math.round(Math.max(0, n - 0.35) * 110 + r() * 12)];
  });
  return { speckle, blotch };
}

export function applyInkTexture(ctx: CanvasRenderingContext2D, tex: InkTexture): void {
  const { width: W, height: H } = ctx.canvas;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = pattern(ctx, tex.speckle, 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tex.blotch, 0, 0, W, H);
  ctx.restore();
}

// Halftone dots (rotated screen) and water line hatching in one ink, in device pixels.
export function makePatterns(ctx: CanvasRenderingContext2D, dpr: number, ink: string): InkPatterns {
  const ds = Math.max(3, Math.round(4.2 * dpr));
  const dot = makeCanvas(ds, ds);
  const dc = context2d(dot);
  dc.fillStyle = ink;
  dc.beginPath();
  dc.arc(ds / 2, ds / 2, 0.95 * dpr, 0, Math.PI * 2);
  dc.fill();
  const dots = pattern(ctx, dot, 'repeat');
  dots.setTransform(new DOMMatrix().rotateSelf(0, 0, 22));

  const ls = Math.max(2, Math.round(3.1 * dpr));
  const line = makeCanvas(4, ls);
  const lc = context2d(line);
  lc.fillStyle = ink;
  lc.fillRect(0, 0, 4, Math.max(1, Math.round(1.25 * dpr)));
  const lines = pattern(ctx, line, 'repeat');
  return { dots, lines };
}
