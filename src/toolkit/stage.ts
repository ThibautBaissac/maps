// The plumbing every Canvas 2D style needs: a focusable stage canvas, the toolkit
// viewport, and the "crisp render on settle, re-projected image while moving" loop.
// The style only renders and presents; see mountCanvasMap() below.
import type { MapHandle } from '../styles/contract.ts';
import { context2d, createStageCanvas, sizeCanvas } from './canvas.ts';
import { scaleRect, type Rect } from './geometry.ts';
import { createViewport, reprojection, type ElementSize, type ResizeResult, type View } from './viewport.ts';

/** Element size plus the stage canvas size in device px. */
export interface StageSize extends ElementSize { W: number; H: number }

export interface CanvasMapOptions<E> {
  container: HTMLElement;
  /** Accessible label of the canvas (shell.label). */
  label: string;
  /** Metres from the centre to the edge of the navigable square. */
  half: number;
  /** The stage canvas is already sized: build the size-dependent state `env`. */
  onResize(size: StageSize, ctx: CanvasRenderingContext2D): { env: E } & ResizeResult;
  /** Crisp render of `view`, into the style's own buffers. */
  render(env: E, view: View): void;
  /** Draws the stage for `view` from the buffers rendered for `snap`. */
  present(ctx: CanvasRenderingContext2D, env: E, snap: View, view: View): void;
}

export function mountCanvasMap<E>({ container, label, half, onResize, render, present }: CanvasMapOptions<E>): MapHandle {
  const canvas = createStageCanvas(container, label);
  const ctx = context2d(canvas);
  let env: E | null = null;
  let snap: View | null = null; // view the buffers were rendered with

  // The viewport calls onResize before any frame, and a settle renders before presenting.
  const frame = (view: View): void => { if (env && snap) present(ctx, env, snap, view); };
  const settle = (view: View): void => {
    if (!env) return;
    render(env, view);
    snap = { ...view };
    frame(view);
  };

  const viewport = createViewport({
    element: canvas,
    half,
    onResize(size) {
      sizeCanvas(canvas, size.w, size.h, size.dpr);
      const { env: e, ...result } = onResize({ ...size, W: canvas.width, H: canvas.height }, ctx);
      env = e;
      return result;
    },
    onFrame: frame,
    onSettle: settle,
  });
  viewport.start();

  return {
    viewport,
    destroy() { viewport.destroy(); canvas.remove(); },
    // Debug helper: crisp render, returns its duration in ms.
    full() { const t = performance.now(); settle(viewport.view); return performance.now() - t; },
  };
}

// Draws `image`, rendered for view `snap`, re-projected onto `view` and clipped to the map
// window (CSS px).
export function drawReprojected(ctx: CanvasRenderingContext2D, image: CanvasImageSource, window: Rect, snap: View, view: View, dpr: number, op: GlobalCompositeOperation = 'source-over'): void {
  const r = scaleRect(window, dpr);
  ctx.save();
  ctx.beginPath();
  ctx.rect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
  ctx.clip();
  ctx.globalCompositeOperation = op;
  ctx.setTransform(...reprojection(snap, view, ctx.canvas.width, ctx.canvas.height, dpr));
  ctx.drawImage(image, 0, 0);
  ctx.restore();
}
