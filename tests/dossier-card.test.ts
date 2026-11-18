import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Departement, Investigation } from '../src/investigations.ts';
import type { Ring } from '../src/layers.ts';
import { areaInvestigations, departementAt, markAt, placeText } from '../src/styles/dossier/card.ts';

const square = (x: number, y: number, s: number): Ring => [x, y, x + s, y, x + s, y + s, x, y + s, x, y];
const dep = (code: string, region: string, x: number): Departement => ({ code, name: `D${code}`, region, rings: [square(x, 0, 10)], centre: [x + 5, 5] });
const inv = (name: string, extra: Partial<Investigation>): Investigation =>
  ({ name, point: [0, 0], year: 2024, site: 'elevage', precision: 'commune', region: '53', species: ['cochons'], ...extra });

test('a click picks the closest mark within reach, and none beyond', () => {
  const a = { item: inv('A', {}), x: 10, y: 10 }, b = { item: inv('B', {}), x: 18, y: 10 };
  assert.equal(markAt([a, b], 15, 10, 6)?.item.name, 'B');
  assert.equal(markAt([a, b], 40, 40, 6), undefined);
});

test('a point falls in the département whose outline holds it', () => {
  const deps = [dep('29', '53', 0), dep('56', '53', 20)];
  assert.equal(departementAt(deps, [25, 5])?.code, '56');
  assert.equal(departementAt(deps, [15, 5]), undefined);
});

test('a hatched département lists its own investigations, then those of its region only', () => {
  const list = [
    inv('Commune', { departement: '29' }),
    inv('Département', { precision: 'departement', departement: '29' }),
    inv('Autre département', { precision: 'departement', departement: '56' }),
    inv('Région', { precision: 'region' }),
    inv('Autre région', { precision: 'region', region: '52' }),
  ];
  assert.deepEqual(areaInvestigations(list, dep('29', '53', 0)).map((i) => i.name), ['Département', 'Région']);
});

test('the place reads as precisely as the page gives it', () => {
  const name = (code: string): string => (code === '29' ? 'Finistère' : code);
  assert.equal(placeText(inv('A', { commune: 'Briec', departement: '29' }), name, 'fr'), 'Briec (Finistère)');
  assert.equal(placeText(inv('B', { precision: 'departement', departement: '29' }), name, 'fr'), 'Département : Finistère (commune non précisée)');
  assert.equal(placeText(inv('C', { precision: 'region' }), name, 'en'), 'Region: Bretagne (place not given)');
});
