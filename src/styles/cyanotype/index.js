// Architect's cyanotype: fine, perfectly regular white linework on a Prussian-blue
// ground, reference grid, dimension chains on the edges, title block bottom right.
import { createViewport, reprojection } from '../../toolkit/viewport.js';
import { createStageCanvas, sizeCanvas, buffer, clear } from '../../toolkit/canvas.js';
import { makeProjector, fadePlate } from '../../toolkit/projection.js';
import { prepareLabels, placeLabels, drawJob } from '../../toolkit/labels.js';
import { loadFont } from '../../toolkit/fonts.js';
import { prepareMap, renderMap, makeHatch } from './map.js';
import { sheetLayout, renderPaper, drawGrid, drawBorder, drawTitleBlock } from './sheet.js';
import { DEFAULTS } from './defaults.js';

export async function mount({ container, data, meta, options, shell }) {
  const o = { ...DEFAULTS, ...options };
  await Promise.all([
    loadFont('Space Mono', 'spacemono/SpaceMono-Regular.ttf', { weight: '400' }),
    loadFont('Space Mono', 'spacemono/SpaceMono-Bold.ttf', { weight: '700' }),
  ]);
  shell.theme({ font: o.font });

  const canvas = createStageCanvas(container, shell.label);
  const ctx = canvas.getContext('2d');
  const M = prepareMap(data);
  const labels = prepareLabels(data);
  const half = data.meta.half;
  const PLATE = half + 40; // the survey square plus a feathered margin

  let env = null;
  let snap = null;

  function labelGroups(view) {
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

  function onResize({ w, h, dpr }) {
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

  function renderCrisp(view) {
    const { map, tmp, dpr, L, W, H } = env;
    const c = map.x;
    clear(c);
    const P = makeProjector(view, W, H, dpr);
    renderMap(c, tmp.x, M, P, view, o, env.hatch);

    // Names: blue gap knocked out of the linework, then white capitals.
    const avoid = [L.cart, L.nav, L.attr].map((r) => [r[0] - 4, r[1] - 4, r[2] + 4, r[3] + 4].map((v) => v * dpr));
    const jobs = placeLabels({
      groups: labelGroups(view), P, font: o.font, measureCtx: c,
      mapRect: L.map.map((v) => v * dpr), avoid,
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

  function present(view) {
    const { W, H, dpr, L } = env;
    const c = ctx;
    clear(c);
    c.drawImage(env.paper, 0, 0);
    const mr = L.map.map((v) => v * dpr);
    c.save();
    c.beginPath();
    c.rect(mr[0], mr[1], mr[2] - mr[0], mr[3] - mr[1]);
    c.clip();
    c.setTransform(...reprojection(snap, view, W, H, dpr));
    c.drawImage(env.map.c, 0, 0);
    c.restore();

    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGrid(c, L, view, half, o);
    drawBorder(c, L, view, half, o);
    drawTitleBlock(c, L, view, meta, o, env.paper, dpr);
    c.setTransform(1, 0, 0, 1, 0, 0);
  }

  const viewport = createViewport({
    element: canvas,
    half: PLATE,
    maxScale: 10,
    onResize,
    onFrame: present,
    onSettle: (view) => { renderCrisp(view); present(view); },
  });
  viewport.start();

  return {
    viewport,
    destroy() { viewport.destroy(); canvas.remove(); },
    // Debug helper: crisp render, returns its duration in ms.
    full() { const t = performance.now(); renderCrisp(viewport.view); present(viewport.view); return performance.now() - t; },
  };
}
