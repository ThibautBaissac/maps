import type { Line, MapData } from './data.ts';
import { featureCount, formatDate, formatNumber, messages, type Locale } from './i18n/index.ts';

type Feature = readonly [name: string | undefined, paths: readonly Line[]];
interface Bounds { left: number; right: number; bottom: number; top: number }

function namedFeatures(features: readonly Feature[], half: number, locale: Locale): HTMLUListElement {
  const { positions } = messages(locale).description;
  const names = new Map<string, Bounds>();
  for (const [name, paths] of features) {
    if (!name) continue;
    for (const p of paths) for (let i = 0; i < p.length; i += 2) {
      const x = p[i]!, y = p[i + 1]!; // complete coordinate pairs from fetch-osm
      if (Math.abs(x) > half || Math.abs(y) > half) continue;
      const b = names.get(name) ?? { left: x, right: x, bottom: y, top: y };
      b.left = Math.min(b.left, x); b.right = Math.max(b.right, x);
      b.bottom = Math.min(b.bottom, y); b.top = Math.max(b.top, y);
      names.set(name, b);
    }
  }
  const band = (v: number): 0 | 1 | 2 => v < -half / 3 ? 0 : v > half / 3 ? 2 : 1;
  const list = document.createElement('ul');
  for (const [name, b] of [...names].sort(([a], [b]) => a.localeCompare(b, locale))) {
    const item = document.createElement('li');
    item.textContent = `${name} — ${positions[band((b.bottom + b.top) / 2)][band((b.left + b.right) / 2)]}.`;
    list.append(item);
  }
  return list;
}

/** Whole-survey description, independent of the visual zoom and the drawing technique. */
export function describeMap(container: HTMLElement, summary: HTMLElement, data: MapData, display: { title: string; district: string }, legend: readonly string[], locale: Locale): void {
  const { meta } = data;
  const copy = messages(locale).description;
  const fmt = (n: number): string => formatNumber(locale, n);
  const overview = copy.overview(display.title, display.district, fmt(meta.sizeKm));
  summary.textContent = `${overview} ${copy.help}`;
  container.replaceChildren();
  const paragraph = (text: string): void => {
    const p = document.createElement('p');
    p.textContent = text;
    container.append(p);
  };
  paragraph(overview);
  paragraph(copy.centre(fmt(meta.lat), fmt(meta.lon), formatDate(locale, meta.fetchedAt)));
  paragraph(copy.counts(featureCount(locale, 0, data.buildings.length), featureCount(locale, 1, data.roads.length), featureCount(locale, 2, data.parks.length), featureCount(locale, 3, data.water.length)));
  const heading = document.createElement('h2');
  heading.textContent = copy.legend;
  const key = document.createElement('ul');
  for (const text of legend) {
    const item = document.createElement('li');
    item.textContent = text;
    key.append(item);
  }
  container.append(heading, key);
  paragraph(copy.positionsHelp);
  const sections: [string, Feature[]][] = [
    [copy.roads, data.roads.map((r) => [r.n, [r.p]])],
    [copy.water, [
      ...data.waterways.filter((w) => !w.u).map((w): Feature => [w.n, [w.p]]),
      ...data.water.map((w): Feature => [w.n, w.r]),
    ]],
  ];
  for (const [title, features] of sections) {
    const list = namedFeatures(features, meta.half, locale);
    const details = document.createElement('details');
    const caption = document.createElement('summary');
    caption.textContent = `${title} (${fmt(list.childElementCount)})`;
    details.append(caption);
    if (list.childElementCount) details.append(list);
    else {
      const empty = document.createElement('p');
      empty.textContent = copy.empty;
      details.append(empty);
    }
    container.append(details);
  }
}
