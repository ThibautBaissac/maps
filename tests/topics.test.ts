import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseMapData, type MapData } from '../src/data.ts';
import type { Layer } from '../src/layers.ts';
import { osmLayers } from '../src/osm-layers.ts';
import * as topics from '../src/topics.ts';

const meta = parseMapData(JSON.parse(readFileSync(new URL('../public/data/lisbonne-alfama.json', import.meta.url), 'utf8')), 'fixture').meta;
const survey = { half: 10 };
const map = (roads: MapData['roads'], waterways: MapData['waterways'] = []): Layer[] =>
  osmLayers({ meta: { ...meta, half: 10, sizeKm: 0.02 }, roads, buildings: [], parks: [], water: [], waterways });

test('the stairs subject measures only stair geometry inside the survey, splitting its length across sectors', () => {
  assert.equal(typeof topics.analyseTopic, 'function');
  const layers = map([
    { k: 'steps', n: 'Escadinhas', p: [-20, 0, 20, 0] },
    { k: 'residential', p: [-10, 1, 10, 1] },
    { k: 'steps', p: [20, 20, 25, 25] },
    { k: 'steps', u: 1, p: [-5, 1, 5, 1] },
  ]);
  const result = topics.analyseTopic(survey, layers, 'steps');
  assert.equal(result.length, 20);
  assert.deepEqual(result.segments.map((f) => f.g), [[-10, 0, 10, 0]]);
  assert.equal(result.sectors.length, 9);
  assert.ok(Math.abs(result.sectors.reduce((sum, s) => sum + s.length, 0) - 20) < 1e-9);
  assert.ok(Math.abs(result.sectors[4]!.length - 20 / 3) < 1e-9);
  assert.equal(result.places[0]?.name, 'Escadinhas');
  assert.deepEqual(result.places[0]?.point, [0, 0]);
});

test('the canals subject requires a bridge crossing a surface canal inside the survey', () => {
  const layers = map([
    { k: 'residential', b: 1, n: 'Bridge', p: [-5, -2, 5, -2] },
    { k: 'cycleway', b: 1, n: 'Bridge', p: [-5, -1, 5, -1] },
    { k: 'residential', n: 'No bridge tag', p: [-5, 0, 5, 0] },
    { k: 'footway', b: 1, n: 'Over a road', p: [2, 2, 8, 2] },
    { k: 'steps', p: [-1, -1, 1, -1] },
    { k: 'residential', b: 1, u: 1, p: [-5, 1, 5, 1] },
    { k: 'residential', b: 1, n: 'Outside crossing', p: [5, 4, 25, 4] },
    { k: 'residential', b: 1, n: 'Culvert', p: [5, 6, 9, 6] },
  ], [
    { k: 'canal', n: 'Canal', p: [0, -10, 0, 10] },
    { k: 'canal', n: 'Outside', p: [20, -10, 20, 10] },
    { k: 'canal', n: 'Covered', u: 1, p: [7, 5, 7, 9] },
  ]);
  const result = topics.analyseTopic(survey, layers, 'canal-crossings');
  assert.deepEqual(result.segments.map((f) => f.n), ['Bridge', 'Bridge']);
  assert.equal(result.length, 20);
  assert.deepEqual(result.canals, ['Canal']);
  assert.equal(result.places.length, 1, 'Named segments group into a reference, never a physical-bridge count');
  assert.equal(result.places[0]?.length, 20);
  assert.deepEqual(result.places[0]?.waters, ['Canal']);
  assert.equal(result.sectors.reduce((sum, s) => sum + s.length, 0), 20);
});

test('empty thematic data produces zero measurements and no invented references', () => {
  const result = topics.analyseTopic(survey, map([]), 'steps');
  assert.equal(result.length, 0);
  assert.deepEqual(result.places, []);
  assert.ok(result.sectors.every((s) => s.length === 0));
});
