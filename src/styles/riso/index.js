// Two-ink risograph style: buildings on plate A, network/water/parks on plate B,
// plates misregistered and multiplied over a generated paper texture.
// Reference implementation of a Canvas 2D style built from the toolkit.
import { createViewport, reprojection } from '../../toolkit/viewport.js';
import { createStageCanvas, sizeCanvas, buffer, clear } from '../../toolkit/canvas.js';
import { computeLayout, knockouts, avoidBoxes, scaleBar } from '../../toolkit/layout.js';
import { makeProjector, fadePlate } from '../../toolkit/projection.js';
import { prepareLabels, placeLabels, drawJob } from '../../toolkit/labels.js';
import { pixelCanvas } from '../../toolkit/noise.js';
import { renderPaper } from './paper.js';
import { makeInkTexture, applyInkTexture, makePatterns } from './inks.js';
import { preparePlates, renderPlateA, renderPlateB } from './plates.js';
import { renderUI } from './ui.js';
import { FONT } from './font.js';
import { DEFAULTS } from './defaults.js';

export async function mount({ container, data, options, shell }) {
  const o = { ...DEFAULTS, ...options };
  const ink = { a: o.inkA, b: o.inkB };
  await document.fonts.load('20px "Bebas Neue"');

  const canvas = createStageCanvas(container, shell.label);
  const ctx = canvas.getContext('2d');
  const plates = preparePlates(data);
  const labels = prepareLabels(data);
  const PLATE = data.meta.half + 40; // printed square, metres from the centre

  let env = null; // size-dependent: layout, buffers, textures
  let snap = null; // view the map buffer was rendered with
  let uiKey = '';

  // White-backed multiply of the two plates, plate B offset (the misregistration).
  function compose(target, a, b, dpr) {
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
  function labelGroups(view) {
    const zf = Math.min(1.6, Math.max(0.95, Math.pow(view.s / 0.6, 0.24)));
    const n = view.s < 0.6 ? 28 : view.s < 1.2 ? 60 : labels.streets.length;
    const per = view.s > 1.5 ? 3 : view.s > 0.8 ? 2 : 1;
    const streets = labels.streets.slice(0, n);
    const groups = [
      { items: labels.canals.slice(0, 10), kind: 'a', size: 13.5 * zf, spacing: 1.8, maxPer: view.s > 1.5 ? 3 : 2 },
      { items: streets.filter((s) => s.w >= 3), kind: 'b', size: 12.5 * zf, spacing: 0.6, maxPer: per },
      { items: streets.filter((s) => s.w < 3), kind: 'b', size: 10.5 * zf, spacing: 0.6, maxPer: per },
    ];
    if (view.s >= 0.6) groups.push({ items: labels.canals.slice(10), kind: 'a', size: 11 * zf, spacing: 1.4, maxPer: 1 });
    return groups;
  }

  function onResize({ w, h, dpr }) {
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
      grain: ctx.createPattern(grain, 'repeat'),
    };
    shell.place({
      back: { left: layout.nav[0], top: layout.nav[1] },
      attribution: { right: w - layout.map[2] + 6, bottom: h - layout.map[3] + 6 },
    });
    uiKey = '';
    return { window: layout.map, minScale: layout.plate / (2 * PLATE) };
  }

  function renderMap(view) {
    const { a, b, dpr, layout } = env;
    clear(a.x); clear(b.x);
    const P = makeProjector(view, env.W, env.H, dpr);
    renderPlateA(a.x, plates, P, view, ink.a);
    renderPlateB(b.x, plates, P, view, ink.b, env.patterns);

    // Names: paper halo knocked out of both plates, letters in their own ink.
    const jobs = placeLabels({
      groups: labelGroups(view), P, font: FONT, measureCtx: a.x,
      mapRect: layout.map.map((v) => v * dpr), avoid: avoidBoxes(layout, dpr),
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
    applyInkTexture(a.x, env.texA);
    applyInkTexture(b.x, env.texB);
    clear(env.map.x);
    compose(env.map.x, a.c, b.c, dpr);
    snap = { ...view };
  }

  function renderFurniture(view) {
    const { a, b, dpr } = env;
    clear(a.x); clear(b.x);
    renderUI(a.x, b.x, env.layout, view, data.meta, dpr, env.patterns, ink);
    applyInkTexture(a.x, env.texA);
    applyInkTexture(b.x, env.texB);
    compose(env.ui.x, a.c, b.c, dpr);
  }

  // Paper, map (re-projected while a crisp render is pending), bare paper under the
  // furniture, furniture, then grain.
  function present(view) {
    const { W, H, dpr, layout } = env;
    const c = ctx;
    clear(c);
    c.drawImage(env.paper, 0, 0);

    const mr = layout.map.map((v) => v * dpr);
    c.save();
    c.beginPath();
    c.rect(mr[0], mr[1], mr[2] - mr[0], mr[3] - mr[1]);
    c.clip();
    c.globalCompositeOperation = 'multiply';
    c.setTransform(...reprojection(snap, view, W, H, dpr));
    c.drawImage(env.map.c, 0, 0);
    c.restore();

    const ko = knockouts(layout);
    c.save();
    c.beginPath();
    for (const r of ko.rects) c.rect(r[0] * dpr, r[1] * dpr, (r[2] - r[0]) * dpr, (r[3] - r[1]) * dpr);
    for (const k of ko.circles) { c.moveTo((k.x + k.r) * dpr, k.y * dpr); c.arc(k.x * dpr, k.y * dpr, k.r * dpr, 0, Math.PI * 2); }
    c.clip();
    c.drawImage(env.paper, 0, 0);
    c.restore();

    // Furniture is re-rendered only when the scale bar changes.
    const sb = scaleBar(view.s, (layout.cart[2] - layout.cart[0]) * 0.7);
    const key = `${sb.d}:${Math.round(view.s * 400)}`;
    if (key !== uiKey) { renderFurniture(view); uiKey = key; }
    c.globalCompositeOperation = 'multiply';
    c.drawImage(env.ui.c, 0, 0);

    c.globalCompositeOperation = 'overlay';
    c.globalAlpha = 0.32;
    c.fillStyle = env.grain;
    c.fillRect(0, 0, W, H);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  const viewport = createViewport({
    element: canvas,
    half: PLATE,
    maxScale: 10,
    onResize,
    onFrame: present,
    onSettle: (view) => { renderMap(view); present(view); },
  });
  viewport.start();

  return {
    viewport,
    destroy() { viewport.destroy(); canvas.remove(); },
    // Debug helper: crisp render, returns its duration in ms.
    full() { const t = performance.now(); renderMap(viewport.view); present(viewport.view); return performance.now() - t; },
  };
}
