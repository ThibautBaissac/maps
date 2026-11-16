import type { Line } from './data.ts';
import { featureCount, formatDate, formatNumber, messages, type Locale } from './i18n/index.ts';
import { featuresOf, isTunnel, type Layer, type Survey } from './layers.ts';
import type { TopicAnalysis } from './topics.ts';
import { topicContent } from './topic-content.ts';

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
export function describeMap(container: HTMLElement, summary: HTMLElement, survey: Survey, layers: readonly Layer[], display: { title: string; district: string }, legend: readonly string[], locale: Locale, topic?: TopicAnalysis, overlays: readonly { title: string; layer: Layer }[] = []): void {
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
    const content = topicContent(survey, topic, locale);
    summary.textContent = `${content.subject.question} ${content.value} ${content.subject.metric}. ${content.concentration} ${overview} ${copy.help}`;
    for (const text of [content.subject.question, content.subject.intro, `${content.value} ${content.subject.metric}.`, content.concentration,
      ...content.references.map((ref) => `${ref.number}. ${ref.name} : ${ref.detail}`), content.subject.legend, content.source, content.subject.method, content.subject.limits]) paragraph(text);
  }
  paragraph(copy.centre(fmt(survey.lat), fmt(survey.lon), formatDate(locale, survey.fetchedAt)));
  paragraph(copy.counts(featureCount(locale, 0, featuresOf(layers, 'buildings', 'areas').length), featureCount(locale, 1, featuresOf(layers, 'roads', 'lines').length), featureCount(locale, 2, featuresOf(layers, 'parks', 'areas').length), featureCount(locale, 3, featuresOf(layers, 'water', 'areas').length)));
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
    [copy.roads, featuresOf(layers, 'roads', 'lines').map((r): Feature => [r.n, [r.g]])],
    [copy.water, [
      ...featuresOf(layers, 'waterways', 'lines').filter((w) => !isTunnel(w)).map((w): Feature => [w.n, [w.g]]),
      ...featuresOf(layers, 'water', 'areas').map((w): Feature => [w.n, w.g]),
    ]],
  ];
  for (const { title, layer } of overlays) {
    sections.push([title, layer.features.map((f): Feature => [f.n, layer.kind === 'areas' ? f.g as Line[] : [f.g as Line]])]);
  }
  for (const [title, features] of sections) {
    const list = namedFeatures(features, survey.half, locale);
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
