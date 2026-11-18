// Dossier: a working map slipped into a case file, for a country-wide subject. Paper,
// country outline in ink, départements and rivers in grey, the subject in red: marks whose
// shape tells the kind of site, hatching where only the département or region is known, and
// a stapled sheet beside the map citing what has no place on it. Spec in SPEC.md.
import { buffer, clear, pattern, type CanvasBuffer } from '../../toolkit/canvas.ts';
import { loadFont } from '../../toolkit/fonts.ts';
import type { Rect } from '../../toolkit/geometry.ts';
import { pixelCanvas } from '../../toolkit/noise.ts';
import type { Projector } from '../../toolkit/projection.ts';
import { mountCanvasMap, type CanvasLayout } from '../../toolkit/stage.ts';
import { drawTopicMarkers } from '../../toolkit/topic.ts';
import type { View } from '../../toolkit/viewport.ts';
import { departementsOf, type Investigation, type SiteKind } from '../../investigations.ts';
import { featuresOf, type Ring } from '../../layers.ts';
import { formatNumber, messages, pluralText } from '../../i18n/index.ts';
import type { MapHandle, MountArgs } from '../contract.ts';
import { DEFAULTS, type DossierOptions } from './defaults.ts';

const FONT = '"Courier Prime", "Courier New", monospace';
/** Scale bar lengths, km. */
const SCALE_KM = [10, 20, 50, 100, 200, 300] as const;

interface Layout extends CanvasLayout {
  w: number;
  h: number;
  /** The stapled sheet: title, count, legend, investigations without a place; none at phone width. */
  sheet: Rect | null;
  /** Scale bar slot, top right of the map window. */
  scale: Rect;
  /** A short sheet only counts what has no place. */
  compact: boolean;
}

interface Env {
  dpr: number;
  W: number;
  H: number;
  layout: Layout;
  paper: HTMLCanvasElement;
  map: CanvasBuffer;
  /** The sheet, drawn once per size. */
  sheet: CanvasBuffer;
  /** Dense hatching: only the département is known. */
  hatch: CanvasPattern;
  /** Sparse hatching: only the region is known. */
  hatchRegion: CanvasPattern;
}

const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));

// The viewport centres the square on the stage, so the map window is the whole stage. The
// sheet sits bottom left, over the Bay of Biscay and Spain, which the base map leaves empty
// at full zoom-out; the attribution goes under it, clear of Corsica (bottom right).
function computeLayout(w: number, h: number): Layout {
  const m = clamp(Math.min(w, h) * 0.025, 8, 20);
  const map: Rect = [m, m, w - m, h - m];
  const mw = map[2] - map[0], mh = map[3] - map[1];
  const plate = Math.min(mw, mh);
  const plateLeft = w / 2 - plate / 2, plateTop = h / 2 - plate / 2;
  const nav: Rect = [map[0] + 6, map[1] + 6, map[0] + 230, map[1] + 50];
  const attrW = clamp(mw * 0.55, 200, 330), attrH = attrW < 300 ? 92 : 78;
  const attr: Rect = [map[0] + 6, map[3] - 6 - attrH, map[0] + 6 + attrW, map[3] - 6];
  // Empty land-free corner: west of Bordeaux, south of the Loire mouth, about.
  // Phone width: the country fills the stage and the legend sits just under it in the page,
  // so the sheet is left out and the scale bar goes under the controls.
  const narrow = w < 560;
  const scale: Rect = narrow ? [map[0] + 8, nav[3] + 8, map[0] + 190, nav[3] + 40] : [map[2] - 190, map[1] + 8, map[2] - 10, map[1] + 40];
  if (narrow) return { w, h, map, plate, nav, attr, sheet: null, scale, compact: true, furniture: [scale] };
  const sw = clamp(plateLeft - map[0] + plate * 0.28, 180, 290);
  const bottom = attr[1] - 8;
  const top = Math.max(nav[3] + 10, Math.min(bottom - 150, plateTop + plate * 0.5));
  const sheet: Rect = [map[0] + 6, top, map[0] + 6 + sw, bottom];
  return { w, h, map, plate, nav, attr, sheet, scale, compact: bottom - top < 260, furniture: [sheet, scale] };
}

/** Paper with a faint, even grain. */
function renderPaper(W: number, H: number, color: string): HTMLCanvasElement {
  const c = buffer(W, H);
  c.x.fillStyle = color;
  c.x.fillRect(0, 0, W, H);
  const grain = pixelCanvas(192, 192, 7, (r) => { const v = 120 + (r() - 0.5) * 90; return [v, v, v, 14]; });
  c.x.fillStyle = pattern(c.x, grain, 'repeat');
  c.x.fillRect(0, 0, W, H);
  return c.c;
}

/** 45° red lines on a transparent tile, in device px so the hatching keeps its fineness at every zoom. */
function hatchTile(spacing: number, color: string, dpr: number, width = 0.9): HTMLCanvasElement {
  const s = Math.max(3, Math.round(spacing * dpr));
  const c = buffer(s, s);
  c.x.strokeStyle = color;
  c.x.lineWidth = Math.max(1, width * dpr);
  c.x.beginPath();
  for (const k of [-s, 0, s]) { c.x.moveTo(k, s); c.x.lineTo(k + s, 0); }
  c.x.stroke();
  return c.c;
}

/** A Path2D of rings in metres, drawn through a metres → device px transform. */
function ringsPath(rings: readonly Ring[]): Path2D {
  const p = new Path2D();
  for (const r of rings) {
    p.moveTo(r[0]!, r[1]!);
    for (let i = 2; i < r.length; i += 2) p.lineTo(r[i]!, r[i + 1]!);
    p.closePath();
  }
  return p;
}

const toMetres = (ctx: CanvasRenderingContext2D, P: Projector): void => ctx.setTransform(P.S, 0, 0, -P.S, P.sx(0), P.sy(0));

/** The mark of a kind of site, centred on (x, y), side s (device px). */
function markPath(ctx: CanvasRenderingContext2D, site: SiteKind, x: number, y: number, s: number): void {
  ctx.beginPath();
  if (site === 'abattoir') ctx.rect(x - s / 2, y - s / 2, s, s);
  else if (site === 'elevage') ctx.arc(x, y, s * 0.56, 0, Math.PI * 2);
  else {
    const t = s * 1.15;
    ctx.moveTo(x, y - t * 0.62); ctx.lineTo(x + t * 0.58, y + t * 0.42); ctx.lineTo(x - t * 0.58, y + t * 0.42); ctx.closePath();
  }
}

/**
 * Screen positions of the marks: each at its town, or pushed onto rings around it, never on
 * another mark. Investigations of the same town gather around it.
 */
function placeMarks(items: readonly Investigation[], P: Projector, s: number): { item: Investigation; x: number; y: number; ax: number; ay: number }[] {
  const placed: { item: Investigation; x: number; y: number; ax: number; ay: number }[] = [];
  const gap = s + 2.5 * P.dpr;
  for (const item of items) {
    const ax = P.sx(item.point[0]), ay = P.sy(item.point[1]);
    let spot: [number, number] | null = null;
    for (let ring = 0; ring < 8 && !spot; ring++) {
      const n = ring === 0 ? 1 : 6 * ring;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 - Math.PI / 2;
        const x = ax + Math.cos(a) * ring * gap, y = ay + Math.sin(a) * ring * gap;
        if (placed.every((p) => Math.hypot(p.x - x, p.y - y) >= gap)) { spot = [x, y]; break; }
      }
    }
    const [x, y] = spot ?? [ax, ay];
    placed.push({ item, x, y, ax, ay });
  }
  return placed;
}

/** Fits `text` into `width` px, ending with an ellipsis when cut. */
function fit(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(`${text.slice(0, mid)}…`).width <= width) lo = mid; else hi = mid - 1;
  }
  return `${text.slice(0, lo).trimEnd()}…`;
}

/** Splits `text` into lines no wider than `width` px. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export async function mount({ container, meta, locale, options, shell, layers, topic }: MountArgs<DossierOptions>): Promise<MapHandle> {
  const o: DossierOptions = { ...DEFAULTS, ...options };
  await Promise.all([
    loadFont('Courier Prime', 'courierprime/CourierPrime-Regular.ttf'),
    loadFont('Courier Prime', 'courierprime/CourierPrime-Bold.ttf', { weight: '700' }),
  ]);
  shell.theme({ bg: o.paper, accent: o.ink, font: FONT });
  const text = messages(locale), c = text.topic.investigations;
  const n = (v: number): string => formatNumber(locale, v);

  // Base map, prepared once in metres.
  const subject = topic?.id === 'investigations' ? topic : undefined;
  const departements = subject?.departements ?? departementsOf(layers);
  const land = ringsPath(departements.flatMap((d) => d.rings));
  const rivers = new Path2D();
  for (const r of featuresOf(layers, 'base', 'lines')) {
    rivers.moveTo(r.g[0]!, r.g[1]!);
    for (let i = 2; i < r.g.length; i += 2) rivers.lineTo(r.g[i]!, r.g[i + 1]!);
  }
  const cities = featuresOf(layers, 'base', 'points').filter((f) => f.n);
  const hatchedDepartements = new Set(subject?.hatched.departements ?? []), hatchedRegions = new Set(subject?.hatched.regions ?? []);
  const hatchedDep = ringsPath(departements.filter((d) => hatchedDepartements.has(d.code)).flatMap((d) => d.rings));
  const hatchedReg = ringsPath(departements.filter((d) => hatchedRegions.has(d.region)).flatMap((d) => d.rings));
  const hasHatched = hatchedDepartements.size + hatchedRegions.size > 0;
  // Town marks only: an investigation known to its département or region is hatching, not a point.
  const marks = (subject?.investigations ?? []).filter((i) => i.precision === 'commune');

  function renderSheet(e: Env): void {
    const { x } = e.sheet, { dpr, layout } = e;
    clear(x);
    if (!layout.sheet) return;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const [l, t, r, b] = layout.sheet;
    // The sheet: a lighter page with a soft offset shadow and a staple.
    x.fillStyle = 'rgba(31, 29, 26, 0.12)';
    x.fillRect(l + 3, t + 4, r - l, b - t);
    x.fillStyle = '#F6F2E8';
    x.fillRect(l, t, r - l, b - t);
    x.strokeStyle = o.grey; x.lineWidth = 0.8;
    x.strokeRect(l + 0.5, t + 0.5, r - l - 1, b - t - 1);
    x.fillStyle = o.grey;
    x.fillRect(l + 18, t - 3, 34, 6);
    x.fillStyle = '#C9C2B4';
    x.fillRect(l + 20, t - 1.5, 30, 3);

    const pad = 14, width = r - l - pad * 2;
    let y = t + pad + 6;
    // Nothing leaves the sheet, whatever the page size.
    x.save();
    x.beginPath(); x.rect(l, t, r - l, b - t); x.clip();
    const line = (s: string, size: number, color = o.ink, weight = 400, gap = 1.35): void => {
      x.font = `${weight} ${size}px ${FONT}`;
      x.fillStyle = color;
      x.textBaseline = 'top';
      x.fillText(fit(x, s, width), l + pad, y);
      y += size * gap;
    };
    const rule = (): void => {
      y += 4;
      x.strokeStyle = o.grey; x.lineWidth = 0.8; x.setLineDash([3, 3]);
      x.beginPath(); x.moveTo(l + pad, y); x.lineTo(r - pad, y); x.stroke();
      x.setLineDash([]);
      y += 10;
    };

    line(`${meta.title.toUpperCase()} · ${meta.district.toUpperCase()}`, 11, o.grey, 700);
    if (subject) {
      const located = subject.investigations.length, total = located + subject.unlocated.length;
      y += 2;
      line(`${n(located)} / ${n(total)}`, 26, o.red, 700, 1.1);
      x.font = `400 12px ${FONT}`;
      // A short sheet keeps the figures; the panel and the description spell them out.
      if (!layout.compact) for (const s of wrap(x, text.topics.investigations.metric, width).slice(0, 2)) line(s, 12, o.ink);
    }
    rule();

    // Legend: the three marks, then the hatching.
    const s = o.mark;
    type Row = [SiteKind | 'departement' | 'region' | 'reference', string];
    const legend: Row[] = [
      ['abattoir', c.sites.abattoir], ['elevage', c.sites.elevage],
      ['couvoir', `${c.sites.couvoir}, ${c.sites.transport.toLowerCase()}, ${c.sites.autre.toLowerCase()}`],
      ...(hatchedDepartements.size ? [['departement', c.legendDepartement] as Row] : []),
      ...(hatchedRegions.size ? [['region', c.legendRegion] as Row] : []),
      ...(subject?.places.length ? [['reference', c.legendReferences] as Row] : []),
    ];
    const columns = 1;
    const colWidth = (width - (columns - 1) * 16) / columns;
    const top = y;
    legend.forEach(([kind, label], i) => {
      const cx = l + pad + (i % columns) * (colWidth + 16), cy = top + Math.floor(i / columns) * 18;
      x.save();
      if (kind === 'reference') {
        // The numbered badge as drawTopicMarkers() draws it, smaller.
        x.beginPath(); x.arc(cx + 7, cy + 7, 7, 0, Math.PI * 2);
        x.fillStyle = '#F6F2E8'; x.fill();
        x.strokeStyle = o.ink; x.lineWidth = 1.2; x.stroke();
        x.font = 'bold 9px system-ui, sans-serif'; x.fillStyle = o.ink;
        x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText('1', cx + 7, cy + 7.5);
      } else if (kind === 'departement' || kind === 'region') {
        x.fillStyle = kind === 'region' ? e.hatchRegion : e.hatch;
        x.setTransform(1, 0, 0, 1, 0, 0);
        x.fillRect(cx * dpr, (cy + 1) * dpr, 14 * dpr, 12 * dpr);
        x.setTransform(dpr, 0, 0, dpr, 0, 0);
        x.strokeStyle = o.red; x.lineWidth = 0.8; x.strokeRect(cx + 0.5, cy + 1.5, 13, 11);
      } else {
        markPath(x, kind, cx + 7, cy + 7, s);
        x.fillStyle = o.red; x.fill();
        x.strokeStyle = '#F6F2E8'; x.lineWidth = 1; x.stroke();
      }
      x.restore();
      x.font = `400 12px ${FONT}`; x.fillStyle = o.ink; x.textBaseline = 'middle';
      x.fillText(fit(x, label, colWidth - 24), cx + 22, cy + 7);
    });
    y = top + Math.ceil(legend.length / columns) * 18 + 2;
    if (!layout.compact) {
      // Grey context.
      x.strokeStyle = o.grey; x.lineWidth = 1;
      x.beginPath(); x.moveTo(l + pad, y + 7); x.lineTo(l + pad + 14, y + 7); x.stroke();
      x.font = `400 12px ${FONT}`; x.fillStyle = o.ink; x.textBaseline = 'middle';
      x.fillText(fit(x, c.legendContext, width - 22), l + pad + 22, y + 7);
      y += 20;
    }

    if (subject) {
      rule();
      line(c.margin, 11, o.grey, 700, 1.6);
      const items = subject.unlocated;
      const room = Math.max(0, Math.floor((b - pad - y) / 16));
      // Too little room for a useful sample: the count alone, the panel lists them all.
      const shown = items.length <= room ? items.length : room >= 4 ? room - 1 : 0;
      for (const u of items.slice(0, shown)) line(`${u.year} · ${u.name}`, 11.5, o.ink, 400, 1.4);
      if (shown < items.length) line(`${shown ? '+ ' : ''}${pluralText(locale, c.count, items.length - shown)}`, 11.5, o.grey, 700, 1.4);
    }
    x.restore();
  }

  return mountCanvasMap<Env, never>({ container, layers, meta, shell, ...(topic ? { topic } : {}) }, {
    font: FONT,
    // A département at most fills the window: beyond, the base map has no more detail.
    maxScale: 0.005,

    labels: () => [],

    resize({ w, h, dpr, W, H }) {
      const layout = computeLayout(w, h);
      const sheet = buffer(W, H);
      const env: Env = {
        dpr, W, H, layout, sheet,
        paper: renderPaper(W, H, o.paper),
        map: buffer(W, H),
        hatch: pattern(sheet.x, hatchTile(o.hatch, o.red, dpr), 'repeat'),
        hatchRegion: pattern(sheet.x, hatchTile(o.hatch * 2.4, o.red, dpr, 0.6), 'repeat'),
      };
      renderSheet(env);
      return { env, layout };
    },

    render(e, { P, dpr, fade }) {
      const x = e.map.x;
      clear(x);
      // Land: tint, then the outline as the outer half of a doubled stroke, so only the coast and borders show.
      x.save();
      toMetres(x, P);
      x.fillStyle = o.land;
      x.fill(land);
      x.lineJoin = 'round';
      x.strokeStyle = o.ink;
      x.lineWidth = (o.outline * 2 * dpr) / P.S;
      x.stroke(land);
      x.fill(land);
      // Hatching where only the département or region is known, in screen px.
      if (hasHatched) {
        // Regions say less than départements: their hatching stays faint.
        for (const [area, fill, alpha] of [[hatchedReg, e.hatchRegion, 0.45], [hatchedDep, e.hatch, 0.75]] as const) {
          x.save();
          x.clip(area);
          x.setTransform(1, 0, 0, 1, 0, 0);
          x.globalAlpha = alpha;
          x.fillStyle = fill;
          x.fillRect(0, 0, e.W, e.H);
          x.restore();
        }
        x.strokeStyle = o.red;
        x.lineWidth = (0.8 * dpr) / P.S;
        x.stroke(hatchedDep);
      }
      // Départements and rivers in grey, rivers kept inside the country.
      x.strokeStyle = o.grey;
      x.lineWidth = (o.boundary * dpr) / P.S;
      x.stroke(land);
      x.clip(land);
      x.lineWidth = (1.1 * dpr) / P.S;
      x.globalAlpha = 0.8;
      x.stroke(rivers);
      x.restore();
      // Only the base map fades at the square's edge: Brest and Lille keep full-strength marks.
      fade(x);

      // Regional capitals: a grey dot and a small-capital name, for orientation.
      x.save();
      x.font = `700 ${10.5 * dpr}px ${FONT}`;
      x.textBaseline = 'middle';
      x.lineJoin = 'round';
      for (const city of cities) {
        const cx = P.sx(city.g[0]), cy = P.sy(city.g[1]);
        x.fillStyle = o.grey;
        x.beginPath(); x.arc(cx, cy, 2 * dpr, 0, Math.PI * 2); x.fill();
        const name = (city.n ?? '').toUpperCase();
        x.strokeStyle = o.land; x.lineWidth = 3 * dpr;
        x.strokeText(name, cx + 5 * dpr, cy);
        x.fillText(name, cx + 5 * dpr, cy);
      }
      x.restore();

      // Marks, oldest first, each kept clear of the others; a thin lead to the town when moved.
      const s = o.mark * dpr;
      const placed = placeMarks(marks, P, s);
      x.save();
      for (const p of placed) {
        if (Math.hypot(p.x - p.ax, p.y - p.ay) < 0.5) continue;
        x.strokeStyle = o.ink; x.lineWidth = 0.7 * dpr;
        x.beginPath(); x.moveTo(p.ax, p.ay); x.lineTo(p.x, p.y); x.stroke();
        x.fillStyle = o.ink;
        x.beginPath(); x.arc(p.ax, p.ay, 1.4 * dpr, 0, Math.PI * 2); x.fill();
      }
      for (const p of placed) {
        markPath(x, p.item.site, p.x, p.y, s);
        x.strokeStyle = o.land; x.lineWidth = 2.2 * dpr; x.stroke();
        x.fillStyle = o.red; x.fill();
      }
      x.restore();

      if (topic) drawTopicMarkers(x, topic, P, o.ink, '#F6F2E8', e.layout);
    },

    overlay(ctx, e, view: View) {
      ctx.drawImage(e.sheet.c, 0, 0);
      // Scale bar: the longest round length that fits.
      const { dpr, layout } = e;
      const [l, , r, b] = layout.scale;
      let km: number = SCALE_KM[0];
      for (const v of SCALE_KM) if (v * 1000 * view.s <= (r - l) - 20) km = v;
      const len = km * 1000 * view.s;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.strokeStyle = o.ink; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(l, b - 6); ctx.lineTo(l, b); ctx.lineTo(l + len, b); ctx.lineTo(l + len, b - 6);
      ctx.stroke();
      ctx.font = `700 11px ${FONT}`; ctx.fillStyle = o.ink; ctx.textBaseline = 'bottom';
      ctx.fillText(`${n(km)} km`, l + 4, b - 4);
      ctx.restore();
    },
  });
}
