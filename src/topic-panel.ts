import type { MapHandle } from './styles/contract.ts';
import type { TopicContent } from './topics/index.ts';

export function mountTopicPanel(container: HTMLElement, content: TopicContent, handle: MapHandle, dataUrl: string): void {
  const { copy, subject } = content;
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const metric = el('p', undefined, 'topic-metric');
  metric.append(el('strong', content.value), el('span', subject.metric));
  const legend = el('p', subject.legend, 'topic-legend');
  const distribution = el('section');
  const { title, help, layout, rows } = content.distribution;
  distribution.append(el('h2', title), el('p', content.concentration));
  const grid = el('ul', undefined, layout === 'grid' ? 'sector-grid' : 'topic-rows');
  grid.setAttribute('aria-label', title);
  for (const s of rows) {
    const cell = el('li', undefined, s.strongest ? 'strongest' : '');
    cell.append(el('span', s.name), el('strong', s.value)); grid.append(cell);
  }
  distribution.append(grid, el('p', help, 'topic-small'));
  const references = el('section');
  references.append(el('h2', copy.references), el('p', copy.referenceHelp, 'topic-small'));
  const list = el('ol', undefined, 'topic-references');
  const status = el('p', undefined, 'sr-only');
  status.setAttribute('role', 'status');
  for (const ref of content.references) {
    const item = el('li');
    const button = el('button', ref.name);
    button.type = 'button';
    button.setAttribute('aria-label', copy.focus(ref.name));
    button.disabled = !handle.viewport;
    button.addEventListener('click', () => {
      handle.viewport?.goTo({ x: ref.point[0], y: ref.point[1], s: 1.6 });
      const canvas = document.querySelector<HTMLCanvasElement>('#stage canvas');
      canvas?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      status.textContent = copy.focus(ref.name);
    });
    item.append(button, el('p', ref.detail)); list.append(item);
  }
  references.append(list);
  const overview = el('button', copy.overview, 'topic-overview');
  overview.type = 'button'; overview.disabled = !handle.viewport;
  overview.addEventListener('click', () => {
    handle.viewport?.goTo({ x: 0, y: 0, s: 0 });
    status.textContent = copy.overview;
  });
  const method = el('details', undefined, 'topic-method');
  const link = el('a', content.dataFile ?? copy.dataFile); link.href = dataUrl;
  const notes = el('section');
  if (content.notes?.items.length) {
    const items = el('ul', undefined, 'topic-notes');
    for (const text of content.notes.items) items.append(el('li', text));
    notes.append(el('h2', content.notes.title), el('p', content.notes.help, 'topic-small'), items);
  }
  method.append(el('summary', copy.methodology), el('p', content.source), el('p', subject.method), el('p', subject.limits), link);
  container.replaceChildren(el('p', content.story.intro, 'topic-intro'), metric, ...(content.panelLegend === false ? [] : [legend]), distribution, references, ...(notes.childElementCount ? [notes] : []), overview, method, status);
}
