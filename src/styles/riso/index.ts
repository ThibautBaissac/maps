// Two-ink risograph style: buildings on plate A, network/water/parks on plate B,
// plates misregistered and multiplied over a generated paper texture.
// Reference implementation of a Canvas 2D style built from the toolkit.
import { buffer, clear, context2d, createStageCanvas, pattern, sizeCanvas, type CanvasBuffer } from '../../toolkit/canvas.ts';
import { loadFont } from '../../toolkit/fonts.ts';
import { scaleRect } from '../../toolkit/geometry.ts';
import { drawJob, placeLabels, prepareLabels, type LabelGroup } from '../../toolkit/labels.ts';
import { avoidBoxes, computeLayout, knockouts, scaleBar, type Layout } from '../../toolkit/layout.ts';
import { pixelCanvas } from '../../toolkit/noise.ts';
import { fadePlate, makeProjector } from '../../toolkit/projection.ts';
import { createViewport, reprojection, type ElementSize, type ResizeResult, type View } from '../../toolkit/viewport.ts';
import type { MapHandle, MountArgs } from '../contract.ts';
import { DEFAULTS, type RisoOptions } from './defaults.ts';
import { FONT } from './font.ts';
import { applyInkTexture, makeInkTexture, makePatterns, type InkPatterns, type InkTexture } from './inks.ts';
import { renderPaper } from './paper.ts';
import { preparePlates, renderPlateA, renderPlateB } from './plates.ts';
import { renderUI, type Inks } from './ui.ts';

/** Which plate a name is printed on. */
type Plate = keyof Inks;

/** Size-dependent state: layout, buffers, textures. */
interface Env {
  w: number;
  h: number;
  dpr: number;
  W: number;
  H: number;
  layout: Layout;
  a: CanvasBuffer;
  b: CanvasBuffer;
  map: CanvasBuffer;
  ui: CanvasBuffer;
  paper: HTMLCanvasElement;
  texA: InkTexture;
  texB: InkTexture;
  patterns: InkPatterns;
  grain: CanvasPattern;
}

export async function mount({ container, data, options, shell }: MountArgs<RisoOptions>): Promise<MapHandle> {
  const o: RisoOptions = { ...DEFAULTS, ...options };
  const ink: Inks = { a: o.inkA, b: o.inkB };
  await loadFont('Bebas Neue', 'bebasneue/BebasNeue-Regular.ttf');

  const canvas = createStageCanvas(container, shell.label);
  const ctx = context2d(canvas);
  const plates = preparePlates(data);
  const labels = prepareLabels(data);
  const PLATE = data.meta.half + 40; // printed square, metres from the centre

  let env: Env | null = null;
  let snap: View | null = null; // view the map buffer was rendered with
  let uiKey = '';

  // White-backed multiply of the two plates, plate B offset (the misregistration).
  function compose(target: CanvasRenderingContext2D, a: HTMLCanvasElement, b: HTMLCanvasElement, dpr: number): void {
    target.setTransform(1, 0, 0, 1, 0, 0);
    target.globalCompositeOperation = 'source-over';
    target.fillStyle = '#fff';
    target.fillRect(0, 0, target.canvas.width, target.canvas.height);
    target.globalCompositeOperation = 'multiply';
    target.drawImage(a, 0, 0);
    target.drawImage(b, o.misregistration[0] * dpr, o.misregistration[1] * dpr);
    target.globalCompositeOperation = 'source-over';
  }

  // Which names, in which ink and size, depending on the zoom.
  function labelGroups(view: View): LabelGroup<Plate>[] {
    const zf = Math.min(1.6, Math.max(0.95, Math.pow(view.s / 0.6, 0.24)));
    const n = view.s < 0.6 ? 28 : view.s < 1.2 ? 60 : labels.streets.length;
    const per = view.s > 1.5 ? 3 : view.s > 0.8 ? 2 : 1;
    const streets = labels.streets.slice(0, n);
    const groups: LabelGroup<Plate>[] = [
      { items: labels.canals.slice(0, 10), kind: 'a', size: 13.5 * zf, spacing: 1.8, maxPer: view.s > 1.5 ? 3 : 2 },
      { items: streets.filter((s) => s.w >= 3), kind: 'b', size: 12.5 * zf, spacing: 0.6, maxPer: per },
      { items: streets.filter((s) => s.w < 3), kind: 'b', size: 10.5 * zf, spacing: 0.6, maxPer: per },
    ];
    if (view.s >= 0.6) groups.push({ items: labels.canals.slice(10), kind: 'a', size: 11 * zf, spacing: 1.4, maxPer: 1 });
    return groups;
  }

  function onResize({ w, h, dpr }: ElementSize): ResizeResult {
    sizeCanvas(canvas, w, h, dpr);
    const W = canvas.width, H = canvas.height;
    const layout = computeLayout(w, h);
    const a = buffer(W, H), b = buffer(W, H);
    const grain = pixelCanvas(256, 256, 5, (r) => { const v = 128 + (r() - 0.5) * 100; return [v, v, v, 255]; });
    env = {
      w, h, dpr, W, H, layout, a, b,
      map: buffer(W, H), ui: buffer(W, H),
      paper: renderPaper(W, H, dpr, o.paper),
      texA: makeInkTexture(W, H, 11),
      texB: makeInkTexture(W, H, 23),
      patterns: makePatterns(b.x, dpr, ink.b),
      grain: pattern(ctx, grain, 'repeat'),
    };
    shell.place({
      back: { left: layout.nav[0], top: layout.nav[1] },
      attribution: { right: w - layout.map[2] + 6, bottom: h - layout.map[3] + 6 },
    });
    uiKey = '';
    return { window: layout.map, minScale: layout.plate / (2 * PLATE) };
  }

  function renderMap(e: Env, view: View): void {
    const { a, b, dpr, layout } = e;
    clear(a.x); clear(b.x);
    const P = makeProjector(view, e.W, e.H, dpr);
    renderPlateA(a.x, plates, P, view, ink.a);
    renderPlateB(b.x, plates, P, view, ink.b, e.patterns);

    // Names: paper halo knocked out of both plates, letters in their own ink.
    const jobs = placeLabels({
      groups: labelGroups(view), P, font: FONT, measureCtx: a.x,
      mapRect: scaleRect(layout.map, dpr), avoid: avoidBoxes(layout, dpr),
    });
    for (const c of [a.x, b.x]) {
      c.save();
      c.globalCompositeOperation = 'destination-out';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineJoin = 'round';
      c.lineWidth = 4.2 * dpr;
      for (const job of jobs) drawJob(c, job, 'stroke');
      c.restore();
    }
    for (const job of jobs) {
      const c = job.kind === 'a' ? a.x : b.x;
      c.save();
      c.fillStyle = ink[job.kind];
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      drawJob(c, job, 'fill');
      c.restore();
    }

    fadePlate(a.x, P, PLATE);
    fadePlate(b.x, P, PLATE);
    applyInkTexture(a.x, e.texA);
    applyInkTexture(b.x, e.texB);
    clear(e.map.x);
    compose(e.map.x, a.c, b.c, dpr);
    snap = { ...view };
  }

  function renderFurniture(e: Env, view: View): void {
    const { a, b, dpr } = e;
    clear(a.x); clear(b.x);
    renderUI(a.x, b.x, e.layout, view, data.meta, dpr, e.patterns, ink);
    applyInkTexture(a.x, e.texA);
    applyInkTexture(b.x, e.texB);
    compose(e.ui.x, a.c, b.c, dpr);
  }

  // Paper, map (re-projected while a crisp render is pending), bare paper under the
  // furniture, furniture, then grain.
  function present(e: Env, snapView: View, view: View): void {
    const { W, H, dpr, layout } = e;
    const c = ctx;
    clear(c);
    c.drawImage(e.paper, 0, 0);

    const mr = scaleRect(layout.map, dpr);
    c.save();
    c.beginPath();
    c.rect(mr[0], mr[1], mr[2] - mr[0], mr[3] - mr[1]);
    c.clip();
    c.globalCompositeOperation = 'multiply';
    c.setTransform(...reprojection(snapView, view, W, H, dpr));
    c.drawImage(e.map.c, 0, 0);
    c.restore();

    const ko = knockouts(layout);
    c.save();
    c.beginPath();
    for (const r of ko.rects) c.rect(r[0] * dpr, r[1] * dpr, (r[2] - r[0]) * dpr, (r[3] - r[1]) * dpr);
    for (const k of ko.circles) { c.moveTo((k.x + k.r) * dpr, k.y * dpr); c.arc(k.x * dpr, k.y * dpr, k.r * dpr, 0, Math.PI * 2); }
    c.clip();
    c.drawImage(e.paper, 0, 0);
    c.restore();

    // Furniture is re-rendered only when the scale bar changes.
    const sb = scaleBar(view.s, (layout.cart[2] - layout.cart[0]) * 0.7);
    const key = `${sb.d}:${Math.round(view.s * 400)}`;
    if (key !== uiKey) { renderFurniture(e, view); uiKey = key; }
    c.globalCompositeOperation = 'multiply';
    c.drawImage(e.ui.c, 0, 0);

    c.globalCompositeOperation = 'overlay';
    c.globalAlpha = 0.32;
    c.fillStyle = e.grain;
    c.fillRect(0, 0, W, H);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  // The viewport calls onResize before any frame, and a settle renders before presenting.
  const frame = (view: View): void => { if (env && snap) present(env, snap, view); };
  const settle = (view: View): void => {
    if (!env) return;
    renderMap(env, view);
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
