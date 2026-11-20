import { featureCount, formatDate, formatNumber, messages, pluralText, type Locale } from './i18n/index.ts';
import { featuresOf, isTunnel, type Feature as LayerFeature, type Layer, type Line, type Survey } from './layers.ts';
import type { TopicContent } from './topics/index.ts';

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

/** The name of an overlay object: the subject's name for it, else its own. */
const overlayName = (f: LayerFeature<unknown>, topic: TopicContent | undefined): string | undefined => topic?.featureName?.(f) ?? f.n;

/** Whole-survey description, independent of the visual zoom and the drawing technique. */
export function describeMap(container: HTMLElement, summary: HTMLElement, survey: Survey, layers: readonly Layer[], display: { title: string; district: string; osm?: boolean }, legend: readonly string[], locale: Locale, topic?: TopicContent, overlays: readonly { title: string; layer: Layer }[] = []): void {
  const copy = messages(locale).description;
  const fmt = (n: number): string => formatNumber(locale, n);
  const overview = copy.overview(display.title, display.district, fmt(survey.sizeKm));
  summary.textContent = `${overview} ${copy.help}`;
  container.replaceChildren();
  const paragraph = (text: string): void => {
    const p = document.createElement('p');
    p.textContent = text;
    container.append(p);
  };
  paragraph(overview);
  if (topic) {
    const content = topic;
    summary.textContent = `${content.story.question} ${content.value} ${content.subject.metric}. ${content.concentration} ${overview} ${copy.help}`;
    for (const text of [content.story.question, content.story.intro, `${content.value} ${content.subject.metric}.`, content.concentration,
      ...content.references.map((ref) => content.copy.referenceLine(String(ref.number), ref.name, ref.detail)),
      content.subject.legend, content.source, content.subject.method, content.subject.limits]) paragraph(text);
    if (content.notes?.items.length) {
      const heading = document.createElement('h2');
      heading.textContent = content.notes.title;
      const list = document.createElement('ul');
      for (const text of content.notes.items) {
        const item = document.createElement('li');
        item.textContent = text;
        list.append(item);
      }
      container.append(heading);
      paragraph(content.notes.help);
      container.append(list);
    }
  }
  // A place without OpenStreetMap data (Place.basemap) has no extract to describe.
  if (display.osm !== false) paragraph(copy.centre(fmt(survey.lat), fmt(survey.lon), formatDate(locale, survey.osmDate)));
  if (display.osm !== false) paragraph(copy.counts(featureCount(locale, 0, featuresOf(layers, 'buildings', 'areas').length), featureCount(locale, 1, featuresOf(layers, 'roads', 'lines').length), featureCount(locale, 2, featuresOf(layers, 'parks', 'areas').length), featureCount(locale, 3, featuresOf(layers, 'water', 'areas').length)));
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
  const sections: [string, Feature[]][] = display.osm === false ? [] : [
    [copy.roads, featuresOf(layers, 'roads', 'lines').map((r): Feature => [r.n, [r.g]])],
    [copy.water, [
      ...featuresOf(layers, 'waterways', 'lines').filter((w) => !isTunnel(w)).map((w): Feature => [w.n, [w.g]]),
      ...featuresOf(layers, 'water', 'areas').map((w): Feature => [w.n, w.g]),
    ]],
  ];
  // Overlays whose objects carry no names are counted rather than reported as empty.
  const unnamed = new Map<string, number>();
  for (const { title, layer } of overlays) {
    sections.push([title, layer.features.map((f): Feature => [overlayName(f, topic), layer.kind === 'areas' ? f.g as Line[] : [f.g as Line]])]);
    if (layer.features.length && layer.features.every((f) => !f.n)) unnamed.set(title, layer.features.length);
  }
  for (const [title, features] of sections) {
    const list = namedFeatures(features, survey.half, locale);
    const count = unnamed.get(title);
    const details = document.createElement('details');
    const caption = document.createElement('summary');
    caption.textContent = `${title} (${fmt(count ?? list.childElementCount)})`;
    details.append(caption);
    if (list.childElementCount) details.append(list);
    else {
      const empty = document.createElement('p');
      empty.textContent = count === undefined ? copy.empty : pluralText(locale, copy.unnamed, count);
      details.append(empty);
    }
    container.append(details);
  }
}
