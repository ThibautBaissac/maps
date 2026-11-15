// Canvas helpers for Canvas 2D styles.

export interface CanvasBuffer {
  c: HTMLCanvasElement;
  x: CanvasRenderingContext2D;
}

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// getContext('2d') only returns null when the canvas already has another context type.
export function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  return ctx;
}

// createPattern() returns null for an image that is not decoded yet; canvases always are.
export function pattern(ctx: CanvasRenderingContext2D, image: CanvasImageSource, repetition: string): CanvasPattern {
  const p = ctx.createPattern(image, repetition);
  if (!p) throw new Error('Pattern image not ready');
  return p;
}

// The visible, focusable canvas filling the stage (keyboard navigation needs focus).
export function createStageCanvas(container: HTMLElement, label: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.tabIndex = 0;
  c.setAttribute('role', 'img');
  c.setAttribute('aria-label', label);
  c.setAttribute('aria-describedby', 'map-summary');
  container.append(c);
  return c;
}

export function sizeCanvas(canvas: HTMLCanvasElement, w: number, h: number, dpr: number): void {
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
}

// Offscreen buffer: { c: canvas, x: 2D context }.
export function buffer(W: number, H: number): CanvasBuffer {
  const c = makeCanvas(W, H);
  return { c, x: context2d(c) };
}

export function clear(ctx: CanvasRenderingContext2D): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}
