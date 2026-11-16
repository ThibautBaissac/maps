// A whole Canvas 2D map behind one call: the focusable stage canvas, the viewport, the
// printed square and its fade, the HTML overlays' placement, the names' placement, and
// the "crisp render on settle, re-projected image while moving" loop. The style passes
// an adapter that only holds its graphic choices; see mountCanvasMap() below.
import type { MapHandle, MountArgs } from '../styles/contract.ts';
import { clear, context2d, createStageCanvas, sizeCanvas, type CanvasBuffer } from './canvas.ts';
import { growRect, scaleRect, type Rect } from './geometry.ts';
import { placeLabels, prepareLabels, type LabelGroup, type LabelJob, type Labels } from './labels.ts';
import { fadePlate, makeProjector, type Projector } from './projection.ts';
import { createViewport, reprojection, type ElementSize, type View } from './viewport.ts';
import { placeTopicMarkers } from './topic.ts';

/** Metres of feathered margin around the surveyed square, faded by frame.fade(). */
const PLATE_MARGIN = 40;
/** CSS px kept free of names around the navigation group and the attribution. */
const OVERLAY_MARGIN = 4;

/** Element size plus the stage canvas size in device px. */
export interface StageSize extends ElementSize { W: number; H: number }

/** Where things go on the page, CSS px. */
export interface CanvasLayout {
  /** Map window: the viewport's frame, and where names may be printed. */
  map: Rect;
  /** Side of the printed square at full zoom-out. */
  plate: number;
  /** Slot of the HTML zoom and description controls. */
  nav: Rect;
  /** Slot of the HTML OSM attribution. */
  attr: Rect;
  /** Drawn furniture that names avoid (cartouche, compass, legend…). */
  furniture: Rect[];
}

/** What the stage needs from the style's size-dependent state. */
export interface CanvasEnv {
  /** Page background, stage-sized. */
  paper: CanvasImageSource;
  /** The crisp render, stage-sized, drawn by render(). */
  map: CanvasBuffer;
}

export interface CrispFrame<K extends string> {
  view: View;
  P: Projector;
  dpr: number;
  /** Names already placed, clear of each other, the overlays and the furniture. */
  labels: LabelJob<K>[];
  /** Fades the edges of the printed square on `ctx`. */
  fade(ctx: CanvasRenderingContext2D): void;
}

/** A Canvas 2D style's graphic choices. */
export interface CanvasStyle<E extends CanvasEnv, K extends string> {
  /** CSS font-family of the map names. */
  font: string;
  /** The stage canvas is sized: build the size-dependent state and the layout. */
  resize(size: StageSize, ctx: CanvasRenderingContext2D): { env: E; layout: CanvasLayout };
  /** Which names, how big and in which kind, at this view. */
  labels(view: View, names: Labels): LabelGroup<K>[];
  /** Crisp render of the frame into env.map. */
  render(env: E, frame: CrispFrame<K>): void;
  /** How env.map is laid over the paper (default source-over). */
  blend?: GlobalCompositeOperation;
  /** Cheap per-frame drawing over paper and map; the context comes reset (identity, opaque, source-over). */
  overlay(ctx: CanvasRenderingContext2D, env: E, view: View): void;
}

/**
 * Mounts the map in `container` and returns once a crisp render is on the stage canvas,
 * if the container has a size (otherwise on its first resize): vignette capture relies on it.
 */
export function mountCanvasMap<E extends CanvasEnv, K extends string>(
  { container, layers, meta, shell, topic }: Pick<MountArgs<unknown>, 'container' | 'layers' | 'meta' | 'shell' | 'topic'>,
  style: CanvasStyle<E, K>,
): MapHandle {
  const half = meta.half + PLATE_MARGIN;
  const names = prepareLabels(layers);
  const canvas = createStageCanvas(container, shell.label);
  const ctx = context2d(canvas);
  let sized: { env: E; layout: CanvasLayout; dpr: number; W: number; H: number; avoid: Rect[] } | null = null; // state for the current size
  let snap: View | null = null; // view the buffers were rendered with

  // The viewport calls onResize before any frame, and a settle renders before presenting.
  const frame = (view: View): void => {
    if (!sized || !snap) return;
    const { env, layout, dpr } = sized;
    clear(ctx);
    ctx.drawImage(env.paper, 0, 0);
    drawReprojected(ctx, env.map.c, layout.map, snap, view, dpr, style.blend);
    style.overlay(ctx, env, view);
  };
  const settle = (view: View): void => {
    if (!sized) return;
    const { env, layout, dpr, W, H, avoid } = sized;
    const P = makeProjector(view, W, H, dpr);
    const labels = placeLabels({
      groups: style.labels(view, names), P, font: style.font, measureCtx: env.map.x,
      mapRect: scaleRect(layout.map, dpr), avoid: [...avoid, ...(topic ? placeTopicMarkers(topic, P, layout).map(({ x, y }): Rect => {
        const radius = 16 * dpr;
        return [x - radius, y - radius, x + radius, y + radius];
      }) : [])],
    });
    style.render(env, { view, P, dpr, labels, fade: (c) => fadePlate(c, P, half) });
    snap = { ...view };
    frame(view);
  };

  const viewport = createViewport({
    element: canvas,
    half,
    onResize(size) {
      sizeCanvas(canvas, size.w, size.h, size.dpr);
      const W = canvas.width, H = canvas.height;
      const { env, layout } = style.resize({ ...size, W, H }, ctx);
      shell.place({
        back: { left: layout.nav[0], top: layout.nav[1] },
        attribution: { right: size.w - layout.attr[2], bottom: size.h - layout.attr[3] },
      });
      const avoid = [...layout.furniture, growRect(layout.nav, OVERLAY_MARGIN), growRect(layout.attr, OVERLAY_MARGIN)]
        .map((r) => scaleRect(r, size.dpr));
      sized = { env, layout, dpr: size.dpr, W, H, avoid };
      return { window: layout.map, minScale: layout.plate / (2 * half) };
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
function drawReprojected(ctx: CanvasRenderingContext2D, image: CanvasImageSource, window: Rect, snap: View, view: View, dpr: number, op: GlobalCompositeOperation = 'source-over'): void {
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
