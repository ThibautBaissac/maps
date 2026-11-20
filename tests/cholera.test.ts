import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyseCholera } from '../src/topics/cholera-pump/evidence.ts';
import type { Feature, Layer, Line } from '../src/layers.ts';
import { analyseTopic, topicContent } from '../src/topics/index.ts';
import type { Point } from '../src/toolkit/geometry.ts';
import { osmLayersOf } from './osm-file.ts';

const points = (id: string, features: Feature<Point>[]): Layer =>
  ({ id, kind: 'points', role: 'overlay', attribution: 'test', source: `${id}.geojson`, features });

// A comb of streets: a main street along y = 0 and two dead ends going north at x = 0 and x = 40.
// The Broad Street pump stands at the top of the west dead end, another pump on the main street.
const streets: Feature<Line>[] = [
  { g: [-100, 0, 0, 0, 40, 0, 100, 0], k: 'residential', n: 'Main' },
  { g: [0, 0, 0, 60], k: 'residential', n: 'West' },
  { g: [40, 0, 40, 60], k: 'residential', n: 'East' },
  // Mapped inside a block and connected to nothing: never a place to snap to.
  { g: [18, 55, 22, 55], k: 'footway' },
];
const pumps = points('pompes', [
  { g: [0, 60], k: 'broad-street', n: 'Broad Street' },
  { g: [80, 0], k: 'pump', n: 'Main' },
]);
const layers = (deaths: Feature<Point>[], extra: Layer[] = []): Layer[] =>
  [...osmLayersOf({ roads: streets }), pumps, points('deces', deaths), ...extra];

test('a death goes to the pump closest on foot, not as the crow flies', () => {
  // At the top of the east dead end: 40 m from Broad Street across the block, but 160 m
  // on foot; the main-street pump is 100 m away on foot.
  const result = analyseCholera(layers([{ g: [40, 60], p: { deaths: 3 } }]));
  assert.equal(result.deaths[0]?.pump, 1);
  assert.ok(Math.abs(result.deaths[0]!.walk - 100) < 1e-9);
  assert.equal(result.broad, 0);
  assert.deepEqual(result.pumps.map((p) => p.deaths), [0, 3]);
});

test('deaths are counted per address, with the share closest to Broad Street and those within 100 m of it', () => {
  const result = analyseCholera(layers([
    { g: [2, 40], p: { deaths: 5 } },   // 20 m from Broad Street along West
    { g: [-60, 0], p: { deaths: 2 } },  // 120 m from Broad Street, 140 m from the other pump
    { g: [70, 1], p: { deaths: 1 } },   // closest to the main-street pump
  ]));
  assert.equal(result.total, 8);
  assert.equal(result.broad, 7);
  assert.equal(result.within100, 5);
  assert.deepEqual(result.pumps.map((p) => p.deaths), [7, 1]);
});

test('a death next to an unconnected path snaps to the street network instead', () => {
  const result = analyseCholera(layers([{ g: [20, 56], p: { deaths: 1 } }]));
  assert.notEqual(result.deaths[0]?.pump, -1);
  assert.ok(Number.isFinite(result.deaths[0]!.walk));
});

test('the cholera subject numbers the Broad Street pump, then the brewery and the workhouse', () => {
  const landmarks = points('reperes', [
    { g: [10, 30], k: 'workhouse', n: 'Workhouse' },
    { g: [30, 30], k: 'brewery', n: 'Brewery' },
  ]);
  const topic = analyseTopic({ half: 100 }, layers([{ g: [2, 40], p: { deaths: 5 } }], [landmarks]), 'cholera-pump');
  assert.deepEqual(topic.places.map((p) => p.kind), ['pump', 'brewery', 'workhouse']);
  assert.deepEqual(topic.places[0]?.point, [0, 60]);
});

test('the cholera panel lists pumps by deaths, Broad Street highlighted, and states the measured share', () => {
  const topic = analyseTopic({ half: 100 }, layers([{ g: [2, 40], p: { deaths: 3 } }, { g: [70, 1], p: { deaths: 1 } }]), 'cholera-pump');
  const survey = { half: 100, sizeKm: 0.2, lat: 51.5, lon: -0.13, osmDate: '2026-11-17T12:00:00Z' };
  const content = topicContent(survey, topic, { question: 'Q?', intro: 'I.' }, 'en');
  assert.equal(content.value, '3 / 4');
  assert.equal(content.distribution.layout, 'list');
  assert.deepEqual(content.distribution.rows.map((r) => [r.name, r.value, r.strongest]),
    [['Broad Street pump', '3 deaths', true], ['Main', '1 death', false]]);
  assert.match(content.concentration, /^75% /);
});
