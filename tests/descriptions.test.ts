import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseMapData } from '../src/data.ts';
import type { Layer } from '../src/layers.ts';
import { describeMap } from '../src/map-description.ts';

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
  const data = parseMapData(JSON.parse(readFileSync(new URL('../public/data/amsterdam-centre.json', import.meta.url), 'utf8')), 'fixture');
  data.buildings.length = 1;
  data.roads = [{ k: 'residential', n: 'Damrak', p: [-20, 0, 20, 0] }];
  data.parks = []; data.waterways = []; data.water = [];
  const content = new TextElement(), summary = new TextElement();
  describeMap(content as unknown as HTMLElement, summary as unknown as HTMLElement, data,
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
  const data = parseMapData(JSON.parse(readFileSync(new URL('../public/data/amsterdam-centre.json', import.meta.url), 'utf8')), 'fixture');
  const layer: Layer = { id: 'ponts', kind: 'points', role: 'overlay', attribution: '© test', source: 'layers/x.geojson', features: [{ g: [0, 0], n: 'Magere Brug' }, { g: [5, 5] }] };
  const content = new TextElement(), summary = new TextElement();
  describeMap(content as unknown as HTMLElement, summary as unknown as HTMLElement, data,
    { title: 'Amsterdam', district: 'Historic centre' }, [], 'en', undefined, [{ title: 'Ponts', layer }]);
  assert.match(content.textContent, /Ponts \(1\)/);
  assert.match(content.textContent, /Magere Brug — in the centre\./);
});
