import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyseInvestigations, departementsOf, type UnlocatedInvestigation } from '../src/topics/investigations/evidence.ts';
import type { Feature, Layer, Ring } from '../src/layers.ts';
import type { Point } from '../src/toolkit/geometry.ts';
import { analyseTopic, topicContent } from '../src/topics/all.ts';

const square = (x: number, y: number, s: number): Ring => [x, y, x + s, y, x + s, y + s, x, y + s, x, y];
// Three départements: two in Bretagne (53), one in Pays de la Loire (52), 100 km wide.
const dep = (code: string, region: string, x: number, name = code): Feature<Ring[]> => ({ g: [square(x, 0, 100_000)], k: code, n: name, p: { region } });
const base: Layer = {
  id: 'departements', kind: 'areas', role: 'base', attribution: 'IGN', source: 'test',
  features: [dep('29', '53', -300_000, 'Finistère'), dep('56', '53', -200_000, 'Morbihan'), dep('53', '52', 200_000, 'Mayenne')],
};
const point = (g: Point, n: string, site: string, p: NonNullable<Feature<Point>['p']>): Feature<Point> => ({ g, n, k: site, p });
const enquetes = (features: Feature<Point>[]): Layer => ({ id: 'enquetes', kind: 'points', role: 'overlay', attribution: 'relevé', source: 'test', features });
const unlocated: UnlocatedInvestigation[] = [{ name: 'Transport de veaux', year: 2019, site: 'transport', url: 'https://example.org/t' }];

const layers = [base, enquetes([
  point([-250_000, 50_000], 'Abattoir de Briec', 'abattoir', { year: 2021, precision: 'commune', commune: 'Briec', departement: '29', region: '53' }),
  point([-250_000, 50_000], 'Élevage du Finistère', 'elevage', { year: 2019, precision: 'departement', departement: '29', region: '53' }),
  point([-150_000, 50_000], 'Élevage du Morbihan', 'elevage', { year: 2014, precision: 'commune', commune: 'Augan', departement: '56', region: '53' }),
  point([-200_000, 50_000], 'Élevage breton', 'elevage', { year: 2024, precision: 'region', region: '53' }),
  point([250_000, 50_000], 'Abattoir de Craon', 'abattoir', { year: 2024, precision: 'commune', commune: 'Craon', departement: '53', region: '52' }),
  point([0, 0], 'Sans région', 'elevage', { year: 2020, precision: 'commune' }),
])];

test('départements are read from the base areas, with their region and the centre of their outline', () => {
  const [finistere] = departementsOf(layers);
  assert.equal(finistere?.code, '29');
  assert.equal(finistere?.name, 'Finistère');
  assert.equal(finistere?.region, '53');
  assert.deepEqual(finistere?.centre, [-250_000, 50_000]);
});

test('investigations are counted by region and kind of site, oldest first; an incomplete record is left out', () => {
  const e = analyseInvestigations(layers, unlocated);
  assert.deepEqual(e.investigations.map((i) => i.year), [2014, 2019, 2021, 2024, 2024]);
  assert.deepEqual(e.regions.map((r) => [r.name, r.count]), [['Bretagne', 4], ['Pays de la Loire', 1]]);
  assert.equal(e.sites.abattoir, 2);
  assert.equal(e.sites.elevage, 3);
  assert.deepEqual(e.years, [2014, 2024]);
  assert.equal(e.unlocated.length, 1);
});

test('an investigation known only to its département or region hatches that area instead of giving a point', () => {
  const e = analyseInvestigations(layers, unlocated);
  assert.deepEqual(e.hatched, { departements: ['29'], regions: ['53'] });
});

test('numbered references are the départements with the most investigations', () => {
  const topic = analyseTopic({ half: 590_000 }, layers, 'investigations');
  assert.deepEqual(topic.places.map((p) => [p.name, p.count]), [['Finistère', 2], ['Mayenne', 1], ['Morbihan', 1]]);
});

test('the panel states placed over total, the leading region, and cites the investigations without a place', () => {
  // The register's own unlocated list is swapped for the fixture's.
  const topic = { ...analyseTopic({ half: 590_000 }, layers, 'investigations'), unlocated };
  const survey = { half: 590_000, sizeKm: 1180, lat: 46.2, lon: 2.2, osmDate: '2026-11-18' };
  const content = topicContent(survey, topic, { question: 'Q', intro: 'I' }, 'fr');
  assert.equal(content.value, '5 / 6');
  assert.equal(content.concentration, 'Région Bretagne : 80 % des enquêtes situées sur la carte.');
  assert.deepEqual(content.notes?.items, ['2019 · Transport · Transport de veaux']);
  assert.equal(content.references[0]?.detail, '2 enquêtes · 2019–2021');
  assert.equal(content.dataFile, 'Consulter les enquêtes situées (JSON)');
  // The map draws its own legend: the panel leaves the text one to the description.
  assert.equal(content.panelLegend, false);
  assert.equal(topicContent(survey, topic, { question: 'Q', intro: 'I' }, 'en').references[2]?.detail, '1 investigation · 2014');
});
