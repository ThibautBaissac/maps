// Antique sepia engraving: fine sepia lines multiplied over aged paper, hatched buildings
// shaded on their south-east side, double-ruled frame, cartouche and ornate compass rose.
import { buffer, clear, type CanvasBuffer } from '../../toolkit/canvas.ts';
import type { Rect } from '../../toolkit/geometry.ts';
import { loadFont } from '../../toolkit/fonts.ts';
import { fillLabels, knockOutLabels } from '../../toolkit/labels.ts';
import { computeLayout, knockouts, scaleBar, type Layout } from '../../toolkit/layout.ts';
import { drawLayers } from '../../toolkit/layers.ts';
import { mountCanvasMap } from '../../toolkit/stage.ts';
import { drawTopic, drawTopicMarkers } from '../../toolkit/topic.ts';
import type { MapHandle, MountArgs } from '../contract.ts';
import { DEFAULTS, type GravureSepiaOptions } from './defaults.ts';
import { makePatterns, preparePlan, renderPlan, type PlanPatterns } from './map.ts';
import { renderPaper, renderSheet } from './sheet.ts';

/** Name kinds: water or streets. */
type NameKind = 'w' | 's';

/** Size-dependent state. */
interface Env {
  dpr: number;
  layout: Layout;
  map: CanvasBuffer;
  /** The base plan, faded into `map` when a subject is shown. */
  base: CanvasBuffer;
  sheet: CanvasBuffer;
  paper: HTMLCanvasElement;
  patterns: PlanPatterns;
  /** Scale-bar state the sheet was drawn for. */
  sheetKey: string;
}

/** On narrow pages the cartouche and the attribution share the bottom: lift the cartouche above it. */
function liftCartouche(L: Layout): Layout {
  const [cx0, cy0, cx1, cy1] = L.cart, [ax0, ay0, ax1, ay1] = L.attr;
  if (cx1 <= ax0 || cx0 >= ax1 || cy1 <= ay0 || cy0 >= ay1) return L;
  const dy = cy1 - ay0 + 6;
  const cart: Rect = [cx0, cy0 - dy, cx1, cy1 - dy];
  const ko = knockouts({ cart, comp: L.comp, legend: L.legend });
  return { ...L, cart, furniture: [...ko.rects, ...ko.circles.map((k): Rect => [k.x - k.r, k.y - k.r, k.x + k.r, k.y + k.r])] };
}

export async function mount({ container, meta, locale, options, shell, layers, topic }: MountArgs<GravureSepiaOptions>): Promise<MapHandle> {
  const o: GravureSepiaOptions = { ...DEFAULTS, ...options };
  await Promise.all([
    loadFont('IM Fell English', 'imfellenglish/IMFeENrm28P.ttf', { style: 'normal' }),
    loadFont('IM Fell English', 'imfellenglish/IMFeENit28P.ttf', { style: 'italic' }),
  ]);
  shell.theme({ font: o.font });
  const plan = preparePlan(layers);
  // Layers the subject draws itself are not drawn again as generic points.
  const overlays = topic?.id === 'cholera-pump' ? [] : layers;

  return mountCanvasMap<Env, NameKind>({ container, layers, meta, shell, ...(topic ? { topic } : {}) }, {
    font: o.font,
    blend: 'multiply',

    labels(view, names) {
      const zf = Math.min(1.5, Math.max(1, Math.pow(view.s / 0.6, 0.22)));
      const n = view.s < 0.6 ? 26 : view.s < 1.2 ? 60 : names.streets.length;
      const per = view.s > 1.5 ? 3 : view.s > 0.8 ? 2 : 1;
      const streets = names.streets.slice(0, n);
      return [
        { items: names.canals.slice(0, 8), kind: 'w', size: 13 * zf, spacing: 1.6, maxPer: 2 },
        { items: streets.filter((s) => s.w >= 3), kind: 's', size: 12.5 * zf, spacing: 0.5, maxPer: per },
        { items: streets.filter((s) => s.w < 3), kind: 's', size: 10.5 * zf, spacing: 0.4, maxPer: per },
      ];
    },

    resize({ w, h, dpr, W, H }) {
      const layout = liftCartouche(computeLayout(w, h));
      const map = buffer(W, H);
      const env: Env = {
        dpr, layout, map,
        base: buffer(W, H),
        sheet: buffer(W, H),
        paper: renderPaper(W, H, dpr, o.paper),
        patterns: makePatterns(map.x, dpr, o),
        sheetKey: '',
      };
      return { env, layout };
    },

    render(e, { P, dpr, labels, fade }) {
      const c = e.map.x;
      clear(c);
      if (topic) {
        // The plan recedes behind the subject.
        clear(e.base.x);
        renderPlan(e.base.x, plan, P, o, e.patterns);
        c.globalAlpha = 0.42;
        c.drawImage(e.base.c, 0, 0);
        c.globalAlpha = 1;
      } else renderPlan(c, plan, P, o, e.patterns);
      drawLayers(c, P, overlays, { stroke: o.ink, fill: '#FFFFFF', width: o.layerWidth, radius: o.layerRadius });
      if (topic) drawTopic(c, topic, P, o.ink, '#FFFFFF', o.accent);
      // Names: a gap cut out of the plan (the paper shows through), then the letters.
      knockOutLabels(c, labels, 3.6 * dpr);
      fillLabels(c, labels, o.ink);
      fade(c);
      if (topic) drawTopicMarkers(c, topic, P, o.ink, '#FFFFFF', e.layout);
    },

    // Bare paper under the furniture, then the sheet, redrawn only when the scale changes.
    overlay(c, e, view) {
      const { dpr, layout } = e;
      const ko = knockouts(layout);
      c.save();
      c.beginPath();
      for (const r of ko.rects) c.rect(r[0] * dpr, r[1] * dpr, (r[2] - r[0]) * dpr, (r[3] - r[1]) * dpr);
      for (const k of ko.circles) { c.moveTo((k.x + k.r) * dpr, k.y * dpr); c.arc(k.x * dpr, k.y * dpr, k.r * dpr, 0, Math.PI * 2); }
      c.clip();
      c.drawImage(e.paper, 0, 0);
      c.restore();
      const sb = scaleBar(view.s, (layout.cart[2] - layout.cart[0]) * 0.7);
      const key = `${sb.d}:${Math.round(view.s * 400)}`;
      if (key !== e.sheetKey) {
        clear(e.sheet.x);
        renderSheet(e.sheet.x, layout, view, meta, o, e.patterns, dpr, locale, topic);
        e.sheetKey = key;
      }
      c.globalCompositeOperation = 'multiply';
      c.drawImage(e.sheet.c, 0, 0);
      c.globalCompositeOperation = 'source-over';
    },
  });
}
