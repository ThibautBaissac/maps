// Art deco poster in relief: a 1930s travel poster in five flat inks, the buildings raised
// to their OpenStreetMap height in an oblique view, gold banner and fans, no outlines.
import { buffer, clear, type CanvasBuffer } from '../../toolkit/canvas.ts';
import { loadFont } from '../../toolkit/fonts.ts';
import { fillLabels, knockOutLabels } from '../../toolkit/labels.ts';
import { drawLayers } from '../../toolkit/layers.ts';
import { scaleBar } from '../../toolkit/layout.ts';
import { mountCanvasMap } from '../../toolkit/stage.ts';
import { drawTopic, drawTopicMarkers } from '../../toolkit/topic.ts';
import type { MapHandle, MountArgs } from '../contract.ts';
import { DEFAULTS, type ArtDecoOptions } from './defaults.ts';
import { drawGround, drawVolumes, palette, preparePlan, type Palette } from './relief.ts';
import { decoLayout, legendRows, renderPaper, renderSheet, type DecoLayout } from './sheet.ts';

/** Name kinds: streets only. */
type NameKind = 's';

interface Env {
  dpr: number;
  layout: DecoLayout;
  map: CanvasBuffer;
  paper: HTMLCanvasElement;
  sheet: CanvasBuffer;
  /** Scale-bar state the sheet was drawn for. */
  sheetKey: string;
}

export async function mount({ container, meta, locale, options, shell, layers, topic }: MountArgs<ArtDecoOptions>): Promise<MapHandle> {
  const o: ArtDecoOptions = { ...DEFAULTS, ...options };
  await Promise.all([
    loadFont('Poiret One', 'poiretone/PoiretOne-Regular.ttf'),
    loadFont('Bebas Neue', 'bebasneue/BebasNeue-Regular.ttf'),
  ]);
  shell.theme({ font: o.font });
  const plan = preparePlan(layers, o, topic);
  const colors: Palette = palette(o);
  const rows = legendRows(topic, locale).length;

  return mountCanvasMap<Env, NameKind>({ container, layers, meta, shell, ...(topic ? { topic } : {}) }, {
    font: o.labelFont,

    labels(view, names) {
      const zf = Math.min(1.5, Math.max(1, Math.pow(view.s / 0.6, 0.25)));
      const n = view.s < 0.6 ? 18 : view.s < 1.2 ? 45 : names.streets.length;
      const per = view.s > 1.5 ? 3 : view.s > 0.8 ? 2 : 1;
      const streets = names.streets.slice(0, n);
      return [
        { items: streets.filter((s) => s.w >= 3), kind: 's', size: 14 * zf, spacing: 1.4, maxPer: per },
        { items: streets.filter((s) => s.w < 3), kind: 's', size: 12 * zf, spacing: 1.1, maxPer: per },
      ];
    },

    resize({ w, h, dpr, W, H }) {
      const layout = decoLayout(w, h, rows);
      const env: Env = { dpr, layout, map: buffer(W, H), paper: renderPaper(W, H, dpr, layout, o), sheet: buffer(W, H), sheetKey: '' };
      return { env, layout };
    },

    render(e, { P, dpr, labels, fade }) {
      const c = e.map.x;
      clear(c);
      drawGround(c, P, plan.ground, colors);
      drawVolumes(c, P, plan.prisms, colors, o);
      drawLayers(c, P, layers, { stroke: o.navy, fill: o.cream, width: o.layerWidth, radius: o.layerRadius });
      if (topic) drawTopic(c, topic, P, o.navy, o.cream, o.red);
      // Names: a cream gap cut through the plan, then night-blue capitals.
      knockOutLabels(c, labels, 3.2 * dpr);
      fillLabels(c, labels, o.navy);
      fade(c);
      if (topic) drawTopicMarkers(c, topic, P, o.navy, o.cream, e.layout);
    },

    // The poster furniture, redrawn only when the scale changes.
    overlay(c, e, view) {
      const { layout, dpr } = e;
      const sb = scaleBar(view.s, layout.legend[2] - layout.legend[0] - 70);
      const key = `${sb.d}:${Math.round(view.s * 400)}`;
      if (key !== e.sheetKey) {
        clear(e.sheet.x);
        renderSheet(e.sheet.x, layout, view, meta, o, colors, dpr, locale, topic);
        e.sheetKey = key;
      }
      c.drawImage(e.sheet.c, 0, 0);
    },
  });
}
