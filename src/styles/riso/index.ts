// Two-ink risograph style: buildings on plate A, network/water/parks on plate B,
// plates misregistered and multiplied over a generated paper texture.
// Reference implementation of a Canvas 2D style built from the toolkit.
import { buffer, clear, pattern, type CanvasBuffer } from '../../toolkit/canvas.ts';
import { loadFont } from '../../toolkit/fonts.ts';
import { fillLabels, knockOutLabels, type LabelGroup } from '../../toolkit/labels.ts';
import { computeLayout, knockouts, scaleBar, type Layout } from '../../toolkit/layout.ts';
import { pixelCanvas } from '../../toolkit/noise.ts';
import { drawLayers } from '../../toolkit/layers.ts';
import { mountCanvasMap } from '../../toolkit/stage.ts';
import { drawTopic, drawTopicMarkers } from '../../toolkit/topic.ts';
import type { View } from '../../toolkit/viewport.ts';
import type { MapHandle, MountArgs } from '../contract.ts';
import { DEFAULTS, type RisoOptions } from './defaults.ts';
import { FONT } from './font.ts';
import { applyInkTexture, makeInkTexture, makePatterns, makeSpeckle, type InkPatterns, type InkTexture } from './inks.ts';
import { renderPaper } from './paper.ts';
import { preparePlates, renderPlateA, renderPlateB } from './plates.ts';
import { renderUI, type Inks } from './ui.ts';

/** Which plate a name is printed on. */
type Plate = keyof Inks;

/** Size-dependent state: layout, buffers, textures. */
interface Env {
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
  /** Scale-bar state the furniture in `ui` was rendered for. */
  uiKey: string;
}

export async function mount({ container, data, meta, locale, options, shell, layers, topic }: MountArgs<RisoOptions>): Promise<MapHandle> {
  const o: RisoOptions = { ...DEFAULTS, ...options };
  const ink: Inks = { a: o.inkA, b: o.inkB };
  await loadFont('Bebas Neue', 'bebasneue/BebasNeue-Regular.ttf');

  const plates = preparePlates(data);
  // Size-independent textures, made once.
  const speckleA = makeSpeckle(11), speckleB = makeSpeckle(23);
  const grainTile = pixelCanvas(256, 256, 5, (r) => { const v = 128 + (r() - 0.5) * 100; return [v, v, v, 255]; });

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

  function renderFurniture(e: Env, view: View): void {
    const { a, b, dpr } = e;
    clear(a.x); clear(b.x);
    renderUI(a.x, b.x, e.layout, view, meta, dpr, e.patterns, ink, locale);
    applyInkTexture(a.x, e.texA);
    applyInkTexture(b.x, e.texB);
    compose(e.ui.x, a.c, b.c, dpr);
  }

  return mountCanvasMap<Env, Plate>({ container, data, shell, ...(topic ? { topic } : {}) }, {
    font: FONT,
    blend: 'multiply',

    // Which names, in which ink and size, depending on the zoom.
    labels(view, names) {
      const zf = Math.min(1.6, Math.max(0.95, Math.pow(view.s / 0.6, 0.24)));
      const n = view.s < 0.6 ? 28 : view.s < 1.2 ? 60 : names.streets.length;
      const per = view.s > 1.5 ? 3 : view.s > 0.8 ? 2 : 1;
      const streets = names.streets.slice(0, n);
      const groups: LabelGroup<Plate>[] = [
        { items: names.canals.slice(0, 10), kind: 'a', size: 13.5 * zf, spacing: 1.8, maxPer: view.s > 1.5 ? 3 : 2 },
        { items: streets.filter((s) => s.w >= 3), kind: 'b', size: 12.5 * zf, spacing: 0.6, maxPer: per },
        { items: streets.filter((s) => s.w < 3), kind: 'b', size: 10.5 * zf, spacing: 0.6, maxPer: per },
      ];
      if (view.s >= 0.6) groups.push({ items: names.canals.slice(10), kind: 'a', size: 11 * zf, spacing: 1.4, maxPer: 1 });
      return groups;
    },

    resize({ w, h, dpr, W, H }, ctx) {
      const layout = computeLayout(w, h);
      const a = buffer(W, H), b = buffer(W, H);
      const env: Env = {
        dpr, W, H, layout, a, b,
        map: buffer(W, H), ui: buffer(W, H),
        paper: renderPaper(W, H, dpr, o.paper),
        texA: makeInkTexture(speckleA, W, H, 11),
        texB: makeInkTexture(speckleB, W, H, 23),
        patterns: makePatterns(b.x, dpr, ink.b),
        grain: pattern(ctx, grainTile, 'repeat'),
        uiKey: '',
      };
      return { env, layout };
    },

    render(e, { P, dpr, labels, fade }) {
      const { a, b } = e;
      clear(a.x); clear(b.x);
      a.x.globalAlpha = topic ? 0.22 : 1;
      renderPlateA(a.x, plates, P, ink.a);
      a.x.globalAlpha = 1;
      b.x.globalAlpha = topic ? 0.45 : 1;
      renderPlateB(b.x, plates, P, ink.b, e.patterns);
      b.x.globalAlpha = 1;
      drawLayers(b.x, P, layers, { stroke: ink.b, fill: '#FFFFFF', width: 1.5, radius: 4 });
      if (topic) drawTopic(b.x, topic, P, ink.b, '#FFFFFF');

      // Names: paper halo knocked out of both plates, letters in their own ink.
      for (const c of [a.x, b.x]) knockOutLabels(c, labels, 4.2 * dpr);
      fillLabels(a.x, labels.filter((j) => j.kind === 'a'), ink.a);
      fillLabels(b.x, labels.filter((j) => j.kind === 'b'), ink.b);

      fade(a.x);
      fade(b.x);
      if (topic) drawTopicMarkers(b.x, topic, P, ink.b, '#FFFFFF', e.layout);
      applyInkTexture(a.x, e.texA);
      applyInkTexture(b.x, e.texB);
      compose(e.map.x, a.c, b.c, dpr);
    },

    // Over paper and map: bare paper under the furniture, furniture, then grain.
    overlay(c, e, view) {
      const { W, H, dpr, layout } = e;
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
      if (key !== e.uiKey) { renderFurniture(e, view); e.uiKey = key; }
      c.globalCompositeOperation = 'multiply';
      c.drawImage(e.ui.c, 0, 0);

      c.globalCompositeOperation = 'overlay';
      c.globalAlpha = 0.32;
      c.fillStyle = e.grain;
      c.fillRect(0, 0, W, H);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    },
  });
}
