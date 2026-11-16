import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Layer } from '../src/layers.ts';
import { describeMap } from '../src/map-description.ts';
import { osmLayersOf, readOsm } from './osm-file.ts';

// Only the external DOM API is substituted; all description logic runs unchanged.
class TextElement {
  children: TextElement[] = [];
  text = '';
  get textContent(): string { return this.text + this.children.map((c) => c.textContent).join(' '); }
  set textContent(value: string) { this.text = value; this.children = []; }
  get childElementCount(): number { return this.children.length; }
  append(...children: TextElement[]): void { this.children.push(...children); }
  replaceChildren(): void { this.children = []; this.text = ''; }
}

test('the accessible English description uses translated display metadata, plural rules and original street names', (t) => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => new TextElement() } });
  t.after(() => { if (saved) Object.defineProperty(globalThis, 'document', saved); else Reflect.deleteProperty(globalThis, 'document'); });
  const osm = readOsm('amsterdam-centre');
  const layers = osmLayersOf({ buildings: [{ g: [[0, 0, 10, 0, 10, 10, 0, 10, 0, 0]] }], roads: [{ g: [-20, 0, 20, 0], k: 'residential', n: 'Damrak' }] });
  const content = new TextElement(), summary = new TextElement();
  describeMap(content as unknown as HTMLElement, summary as unknown as HTMLElement, osm.survey, layers,
    { title: 'Amsterdam', district: 'Historic centre' }, ['Buildings: solid areas.'], 'en');
  assert.match(summary.textContent, /Amsterdam, Historic centre\. A square area/);
  assert.match(content.textContent, /1 building, 1 road segment, 0 green spaces and 0 water areas/);
  assert.match(content.textContent, /Damrak — in the centre/);
  assert.doesNotMatch(content.textContent, /Centre historique|Légende|au centre/);
});

test('an overlay layer gets its own section listing its named objects with their position', (t) => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => new TextElement() } });
  t.after(() => { if (saved) Object.defineProperty(globalThis, 'document', saved); else Reflect.deleteProperty(globalThis, 'document'); });
  const osm = readOsm('amsterdam-centre');
  const layer: Layer = { id: 'ponts', kind: 'points', role: 'overlay', attribution: '© test', source: 'layers/x.geojson', features: [{ g: [0, 0], n: 'Magere Brug' }, { g: [5, 5] }] };
  const content = new TextElement(), summary = new TextElement();
  describeMap(content as unknown as HTMLElement, summary as unknown as HTMLElement, osm.survey, osm.layers,
    { title: 'Amsterdam', district: 'Historic centre' }, [], 'en', undefined, [{ title: 'Ponts', layer }]);
  assert.match(content.textContent, /Ponts \(1\)/);
  assert.match(content.textContent, /Magere Brug — in the centre\./);
});
