// Architect's cyanotype: fine, perfectly regular white linework on a Prussian-blue
// ground, reference grid, dimension chains on the edges, title block bottom right.
import { buffer, clear, type CanvasBuffer } from '../../toolkit/canvas.ts';
import { loadFont } from '../../toolkit/fonts.ts';
import { scaleRect, type Rect } from '../../toolkit/geometry.ts';
import { fillLabels, knockOutLabels, placeLabels, prepareLabels, type LabelGroup } from '../../toolkit/labels.ts';
import { fadePlate, makeProjector } from '../../toolkit/projection.ts';
import { drawReprojected, mountCanvasMap, type StageSize } from '../../toolkit/stage.ts';
import type { ResizeResult, View } from '../../toolkit/viewport.ts';
import type { MapHandle, MountArgs } from '../contract.ts';
import { DEFAULTS, type CyanotypeOptions } from './defaults.ts';
import { makeHatch, prepareMap, renderMap } from './map.ts';
import { drawBorder, drawGrid, drawTitleBlock, renderPaper, sheetLayout, type SheetLayout } from './sheet.ts';

/** Name kinds: waterways or streets. */
type NameKind = 'w' | 's';

/** Size-dependent state. */
interface Env {
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

  const M = prepareMap(data);
  const labels = prepareLabels(data);
  const half = data.meta.half;
  const PLATE = half + 40; // the survey square plus a feathered margin

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

  function onResize({ w, h, dpr, W, H }: StageSize): { env: Env } & ResizeResult {
    const L = sheetLayout(w, h);
    const map = buffer(W, H);
    const env: Env = {
      dpr, W, H, L, map,
      tmp: buffer(W, H),
      paper: renderPaper(W, H, dpr, o.paper, o.paperNoise),
      hatch: makeHatch(map.x, dpr, o.hatch, o.line),
    };
    shell.place({
      back: { left: L.nav[0], top: L.nav[1] },
      attribution: { right: w - L.attr[2], bottom: h - L.attr[3] },
    });
    return { env, window: L.map, minScale: L.plate / (2 * PLATE) };
  }

  function renderCrisp(e: Env, view: View): void {
    const { map, tmp, dpr, L, W, H } = e;
    const c = map.x;
    clear(c);
    const P = makeProjector(view, W, H, dpr);
    renderMap(c, tmp.x, M, P, o, e.hatch);

    // Names: blue gap knocked out of the linework, then white capitals.
    const avoid = [L.cart, L.nav, L.attr].map((r): Rect => scaleRect([r[0] - 4, r[1] - 4, r[2] + 4, r[3] + 4], dpr));
    const jobs = placeLabels({
      groups: labelGroups(view), P, font: o.font, measureCtx: c,
      mapRect: scaleRect(L.map, dpr), avoid,
    });
    knockOutLabels(c, jobs, 4 * dpr);
    fillLabels(c, jobs, o.line);

    fadePlate(c, P, PLATE);
  }

  function present(c: CanvasRenderingContext2D, e: Env, snap: View, view: View): void {
    const { dpr, L } = e;
    clear(c);
    c.drawImage(e.paper, 0, 0);
    drawReprojected(c, e.map.c, L.map, snap, view, dpr);

    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGrid(c, L, view, half, o);
    drawBorder(c, L, view, half, o);
    drawTitleBlock(c, L, view, meta, o, e.paper);
    c.setTransform(1, 0, 0, 1, 0, 0);
  }

  return mountCanvasMap({ container, label: shell.label, half: PLATE, onResize, render: renderCrisp, present });
}
