// Architect's cyanotype: fine, perfectly regular white linework on a Prussian-blue
// ground, reference grid, dimension chains on the edges, title block bottom right.
import { buffer, clear, context2d, createStageCanvas, sizeCanvas, type CanvasBuffer } from '../../toolkit/canvas.ts';
import { loadFont } from '../../toolkit/fonts.ts';
import { scaleRect, type Rect } from '../../toolkit/geometry.ts';
import { drawJob, placeLabels, prepareLabels, type LabelGroup } from '../../toolkit/labels.ts';
import { fadePlate, makeProjector } from '../../toolkit/projection.ts';
import { createViewport, reprojection, type ElementSize, type ResizeResult, type View } from '../../toolkit/viewport.ts';
import type { MapHandle, MountArgs } from '../contract.ts';
import { DEFAULTS, type CyanotypeOptions } from './defaults.ts';
import { makeHatch, prepareMap, renderMap } from './map.ts';
import { drawBorder, drawGrid, drawTitleBlock, renderPaper, sheetLayout, type SheetLayout } from './sheet.ts';

/** Name kinds: waterways or streets. */
type NameKind = 'w' | 's';

/** Size-dependent state. */
interface Env {
  w: number;
  h: number;
  dpr: number;
  W: number;
  H: number;
  L: SheetLayout;
  map: CanvasBuffer;
  tmp: CanvasBuffer;
  paper: HTMLCanvasElement;
  hatch: CanvasPattern;
}

export async function mount({ container, data, meta, options, shell }: MountArgs<CyanotypeOptions>): Promise<MapHandle> {
  const o: CyanotypeOptions = { ...DEFAULTS, ...options };
  await Promise.all([
    loadFont('Space Mono', 'spacemono/SpaceMono-Regular.ttf', { weight: '400' }),
    loadFont('Space Mono', 'spacemono/SpaceMono-Bold.ttf', { weight: '700' }),
  ]);
  shell.theme({ font: o.font });

  const canvas = createStageCanvas(container, shell.label);
  const ctx = context2d(canvas);
  const M = prepareMap(data);
  const labels = prepareLabels(data);
  const half = data.meta.half;
  const PLATE = half + 40; // the survey square plus a feathered margin

  let env: Env | null = null;
  let snap: View | null = null;

  function labelGroups(view: View): LabelGroup<NameKind>[] {
    const zf = Math.min(1.5, Math.max(1, Math.pow(view.s / 0.6, 0.22)));
    const n = view.s < 0.6 ? 24 : view.s < 1.2 ? 55 : labels.streets.length;
    const per = view.s > 1.5 ? 3 : view.s > 0.8 ? 2 : 1;
    const streets = labels.streets.slice(0, n);
    return [
      { items: labels.canals.slice(0, 8), kind: 'w', size: 11 * zf, spacing: 2.2, maxPer: 2 },
      { items: streets.filter((s) => s.w >= 3), kind: 's', size: 10 * zf, spacing: 0.4, maxPer: per },
      { items: streets.filter((s) => s.w < 3), kind: 's', size: 8.5 * zf, spacing: 0.3, maxPer: per },
    ];
  }

  function onResize({ w, h, dpr }: ElementSize): ResizeResult {
    sizeCanvas(canvas, w, h, dpr);
    const W = canvas.width, H = canvas.height;
    const L = sheetLayout(w, h);
    const map = buffer(W, H);
    env = {
      w, h, dpr, W, H, L, map,
      tmp: buffer(W, H),
      paper: renderPaper(W, H, dpr, o.paper, o.paperNoise),
      hatch: makeHatch(map.x, dpr, o.hatch, o.line),
    };
    shell.place({
      back: { left: L.nav[0], top: L.nav[1] },
      attribution: { right: w - L.attr[2], bottom: h - L.attr[3] },
    });
    return { window: L.map, minScale: L.plate / (2 * PLATE) };
  }

  function renderCrisp(e: Env, view: View): void {
    const { map, tmp, dpr, L, W, H } = e;
    const c = map.x;
    clear(c);
    const P = makeProjector(view, W, H, dpr);
    renderMap(c, tmp.x, M, P, view, o, e.hatch);

    // Names: blue gap knocked out of the linework, then white capitals.
    const avoid = [L.cart, L.nav, L.attr].map((r): Rect => scaleRect([r[0] - 4, r[1] - 4, r[2] + 4, r[3] + 4], dpr));
    const jobs = placeLabels({
      groups: labelGroups(view), P, font: o.font, measureCtx: c,
      mapRect: scaleRect(L.map, dpr), avoid,
    });
    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.globalCompositeOperation = 'destination-out';
    c.lineWidth = 4 * dpr;
    for (const job of jobs) drawJob(c, job, 'stroke');
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = o.line;
    for (const job of jobs) drawJob(c, job, 'fill');
    c.restore();

    fadePlate(c, P, PLATE);
    snap = { ...view };
  }

  function present(e: Env, snapView: View, view: View): void {
    const { W, H, dpr, L } = e;
    const c = ctx;
    clear(c);
    c.drawImage(e.paper, 0, 0);
    const mr = scaleRect(L.map, dpr);
    c.save();
    c.beginPath();
    c.rect(mr[0], mr[1], mr[2] - mr[0], mr[3] - mr[1]);
    c.clip();
    c.setTransform(...reprojection(snapView, view, W, H, dpr));
    c.drawImage(e.map.c, 0, 0);
    c.restore();

    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGrid(c, L, view, half, o);
    drawBorder(c, L, view, half, o);
    drawTitleBlock(c, L, view, meta, o, e.paper);
    c.setTransform(1, 0, 0, 1, 0, 0);
  }

  // The viewport calls onResize before any frame, and a settle renders before presenting.
  const frame = (view: View): void => { if (env && snap) present(env, snap, view); };
  const settle = (view: View): void => {
    if (!env) return;
    renderCrisp(env, view);
    frame(view);
  };

  const viewport = createViewport({
    element: canvas,
    half: PLATE,
    maxScale: 10,
    onResize,
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
