// Two-ink risograph style: buildings on plate A, network/water/parks on plate B,
// plates misregistered and multiplied over a generated paper texture.
import { makeCanvas, pixelCanvas } from '../../engine/noise.js';
import { fadePlate } from '../../engine/projection.js';
import { prepareLabels, placeLabels, drawJob } from '../../engine/labels.js';
import { renderPaper } from './paper.js';
import { makeInkTexture, applyInkTexture, makePatterns } from './inks.js';
import { preparePlates, renderPlateA, renderPlateB } from './plates.js';
import { renderUI } from './ui.js';
import { FONT } from './font.js';
import { DEFAULTS } from './defaults.js';


export function create(options = {}) {
  const o = { ...DEFAULTS, ...options };
  const ink = { a: o.inkA, b: o.inkB };

  // White-backed multiply of the two plates, plate B offset (the misregistration).
  const compose = (target, a, b, dpr) => {
    target.setTransform(1, 0, 0, 1, 0, 0);
    target.globalCompositeOperation = 'source-over';
    target.fillStyle = '#fff';
    target.fillRect(0, 0, target.canvas.width, target.canvas.height);
    target.globalCompositeOperation = 'multiply';
    target.drawImage(a, 0, 0);
    target.drawImage(b, o.misregistration[0] * dpr, o.misregistration[1] * dpr);
    target.globalCompositeOperation = 'source-over';
  };
  const clear = (c) => {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, c.canvas.width, c.canvas.height);
  };

  // Which names, in which ink and size, depending on the zoom.
  function labelGroups(L, view) {
    const zf = Math.min(1.6, Math.max(0.95, Math.pow(view.s / 0.6, 0.24)));
    const nStreets = view.s < 0.6 ? 28 : view.s < 1.2 ? 60 : L.streets.length;
    const groups = [
      { items: L.canals.slice(0, 10), kind: 'a', size: 13.5 * zf, spacing: 1.8, maxPer: view.s > 1.5 ? 3 : 2 },
      { items: L.streets.filter((s) => s.w >= 3).slice(0, nStreets), kind: 'b', size: 12.5 * zf, spacing: 0.6, maxPer: view.s > 1.5 ? 3 : view.s > 0.8 ? 2 : 1 },
    ];
    groups.push({
      items: L.streets.slice(0, nStreets).filter((s) => s.w < 3),
      kind: 'b', size: 10.5 * zf, spacing: 0.6, maxPer: view.s > 1.5 ? 3 : view.s > 0.8 ? 2 : 1,
    });
    if (view.s >= 0.6) groups.push({ items: L.canals.slice(10), kind: 'a', size: 11 * zf, spacing: 1.4, maxPer: 1 });
    return groups;
  }

  return {
    fonts: ['20px "Bebas Neue"'],
    mapBlend: 'multiply',
    uiBlend: 'multiply',

    prepare(data) {
      return { plates: preparePlates(data), labels: prepareLabels(data) };
    },

    setup(env) {
      const { W, H, dpr } = env;
      const buffer = () => { const c = makeCanvas(W, H); return { c, x: c.getContext('2d') }; };
      const a = buffer(), b = buffer();
      const grain = pixelCanvas(256, 256, 5, (r) => { const v = 128 + (r() - 0.5) * 100; return [v, v, v, 255]; });
      return {
        paper: renderPaper(W, H, dpr, o.paper),
        texA: makeInkTexture(W, H, 11),
        texB: makeInkTexture(W, H, 23),
        a, b,
        patterns: makePatterns(b.x, dpr, ink.b),
        grain: a.x.createPattern(grain, 'repeat'),
      };
    },

    background(ctx, env, res) {
      ctx.drawImage(res.paper, 0, 0);
    },

    renderMap(target, f) {
      const { res, P, view, prepared } = f;
      const { a, b } = res;
      const dpr = P.dpr;
      clear(a.x); clear(b.x);
      renderPlateA(a.x, prepared.plates, P, view, ink.a);
      renderPlateB(b.x, prepared.plates, P, view, ink.b, res.patterns);

      // Names: paper halo knocked out of both plates, letters in their own ink.
      const jobs = placeLabels({
        groups: labelGroups(prepared.labels, view),
        P, mapRect: f.mapRect, avoid: f.avoid, font: FONT, measureCtx: a.x,
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

      fadePlate(a.x, P, f.plate);
      fadePlate(b.x, P, f.plate);
      applyInkTexture(a.x, res.texA);
      applyInkTexture(b.x, res.texB);
      compose(target, a.c, b.c, dpr);
    },

    renderUI(target, f) {
      const { res, env, view, data } = f;
      const { a, b } = res;
      clear(a.x); clear(b.x);
      renderUI(a.x, b.x, env.layout, view, data.meta, env.dpr, res.patterns, ink);
      applyInkTexture(a.x, res.texA);
      applyInkTexture(b.x, res.texB);
      compose(target, a.c, b.c, env.dpr);
    },

    // Grain over everything.
    overlay(ctx, env, res) {
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = res.grain;
      ctx.fillRect(0, 0, env.W, env.H);
    },
  };
}
