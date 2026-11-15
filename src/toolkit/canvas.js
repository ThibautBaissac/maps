// Canvas helpers for Canvas 2D styles.
import { makeCanvas } from './noise.js';

// The visible, focusable canvas filling the stage (keyboard navigation needs focus).
export function createStageCanvas(container, label) {
  const c = document.createElement('canvas');
  c.tabIndex = 0;
  c.setAttribute('role', 'img');
  c.setAttribute('aria-label', label);
  container.append(c);
  return c;
}

export function sizeCanvas(canvas, w, h, dpr) {
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
}

// Offscreen buffer: { c: canvas, x: 2D context }.
export function buffer(W, H) {
  const c = makeCanvas(W, H);
  return { c, x: c.getContext('2d') };
}

export function clear(ctx) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}
