// Architect's cyanotype: fine, perfectly regular white linework on a Prussian-blue
// ground, reference grid, dimension chains on the edges, title block bottom right.
import { buffer, clear, type CanvasBuffer } from '../../toolkit/canvas.ts';
import { loadFont } from '../../toolkit/fonts.ts';
import { fillLabels, knockOutLabels } from '../../toolkit/labels.ts';
import { mountCanvasMap } from '../../toolkit/stage.ts';
import type { MapHandle, MountArgs } from '../contract.ts';
import { DEFAULTS, type CyanotypeOptions } from './defaults.ts';
import { makeHatch, prepareMap, renderMap } from './map.ts';
import { drawBorder, drawGrid, drawTitleBlock, renderPaper, sheetLayout, type SheetLayout } from './sheet.ts';

/** Name kinds: waterways or streets. */
type NameKind = 'w' | 's';

/** Size-dependent state. */
interface Env {
  dpr: number;
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

  const M = prepareMap(data);
  const half = data.meta.half;

  return mountCanvasMap<Env, NameKind>({ container, data, shell }, {
    font: o.font,

    labels(view, names) {
      const zf = Math.min(1.5, Math.max(1, Math.pow(view.s / 0.6, 0.22)));
      const n = view.s < 0.6 ? 24 : view.s < 1.2 ? 55 : names.streets.length;
      const per = view.s > 1.5 ? 3 : view.s > 0.8 ? 2 : 1;
      const streets = names.streets.slice(0, n);
      return [
        { items: names.canals.slice(0, 8), kind: 'w', size: 11 * zf, spacing: 2.2, maxPer: 2 },
        { items: streets.filter((s) => s.w >= 3), kind: 's', size: 10 * zf, spacing: 0.4, maxPer: per },
        { items: streets.filter((s) => s.w < 3), kind: 's', size: 8.5 * zf, spacing: 0.3, maxPer: per },
      ];
    },

    resize({ w, h, dpr, W, H }) {
      const L = sheetLayout(w, h);
      const map = buffer(W, H);
      const env: Env = {
        dpr, L, map,
        tmp: buffer(W, H),
        paper: renderPaper(W, H, dpr, o.paper, o.paperNoise),
        hatch: makeHatch(map.x, dpr, o.hatch, o.line),
      };
      return { env, layout: L };
    },

    render(e, { P, dpr, labels, fade }) {
      const c = e.map.x;
      clear(c);
      renderMap(c, e.tmp.x, M, P, o, e.hatch);

      // Names: blue gap knocked out of the linework, then white capitals.
      knockOutLabels(c, labels, 4 * dpr);
      fillLabels(c, labels, o.line);
      fade(c);
    },

    // Grid, border and title block, in CSS px.
    overlay(c, e, view) {
      const { dpr, L } = e;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawGrid(c, L, view, half, o);
      drawBorder(c, L, view, half, o);
      drawTitleBlock(c, L, view, meta, o, e.paper);
      c.setTransform(1, 0, 0, 1, 0, 0);
    },
  });
}
