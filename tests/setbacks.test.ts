import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Feature, Ring } from '../src/layers.ts';
import { analyseSetbacks, formOf, periodOf } from '../src/topics/setbacks/evidence.ts';
import { analyseTopic } from '../src/topics/index.ts';
import { osmLayersOf } from './osm-file.ts';

/** A closed square ring of side s at (x, y). */
const square = (x: number, y: number, s: number): Ring => [x, y, x + s, y, x + s, y + s, x, y + s, x, y];
const outline = (x: number, y: number, s: number, p: Feature<Ring[]>['p'] = {}, n?: string): Feature<Ring[]> =>
  ({ g: [square(x, y, s)], ...(n && { n }), p });
const part = (x: number, y: number, s: number, h: number): Feature<Ring[]> => ({ g: [square(x, y, s)], p: { h } });

// A stepped tower: three tiers, the top one on a small share of the footprint.
const stepped = outline(0, 0, 40, { parts: true, year: 1931 }, 'Stepped');
const steppedParts = [part(0, 0, 40, 40), part(8, 8, 24, 100), part(14, 14, 12, 160)];
// A block tower: one part over the whole footprint.
const block = outline(100, 0, 40, { parts: true, year: 1971 }, 'Block');
const blockParts = [part(100, 0, 40, 200)];
// A tower OSM gives no parts for, and a low building.
const bare = outline(200, 0, 30, { h: 120, year: 1950 }, 'Bare');
const low = outline(-200, 0, 20, { h: 30, year: 1930 });

const layers = osmLayersOf({ buildings: [stepped, block, bare, low], buildingParts: [...steppedParts, ...blockParts] });

test('building periods follow the 1916 and 1961 zoning resolutions', () => {
  assert.equal(periodOf(1915), 'before-1916');
  assert.equal(periodOf(1916), 'zoning-1916');
  assert.equal(periodOf(1960), 'zoning-1916');
  assert.equal(periodOf(1961), 'zoning-1961');
  assert.equal(periodOf(undefined), 'undated');
});

test('a tower rises in steps when its parts form three levels and its top covers little of its footprint', () => {
  assert.deepEqual(formOf(stepped, steppedParts, 160), { form: 'stepped', levels: 3 });
  assert.deepEqual(formOf(block, blockParts, 200), { form: 'block', levels: 1 });
  assert.deepEqual(formOf(bare, [], 120), { form: 'unknown', levels: 0 });
});

test('a tall base under a small spire is not stepped: the top level must be narrow AND three levels apart', () => {
  const tall = outline(0, 0, 40, { parts: true });
  assert.equal(formOf(tall, [part(0, 0, 40, 150), part(18, 18, 4, 160)], 160).form, 'block');
});

test('towers are buildings of 80 m or more inside the square, counted per period', () => {
  const { towers, periods } = analyseSetbacks(layers, 500);
  assert.deepEqual(towers.map((t) => [t.name, t.top, t.form, t.period]), [
    ['Block', 200, 'block', 'zoning-1961'],
    ['Stepped', 160, 'stepped', 'zoning-1916'],
    ['Bare', 120, 'unknown', 'zoning-1916'],
  ]);
  assert.deepEqual(towers[1]!.parts, steppedParts);
  assert.deepEqual(periods, [
    { id: 'before-1916', towers: 0, detailed: 0, stepped: 0 },
    { id: 'zoning-1916', towers: 2, detailed: 1, stepped: 1 },
    { id: 'zoning-1961', towers: 1, detailed: 1, stepped: 0 },
    { id: 'undated', towers: 0, detailed: 0, stepped: 0 },
  ]);
  assert.equal(analyseSetbacks(layers, 150).towers.length, 2, 'The bare tower lies outside a 300 m square');
});

test('the subject numbers the stepped towers of 1916–1960 first, then a block tower of 1961 or later', () => {
  const topic = analyseTopic({ half: 500 }, layers, 'setbacks');
  assert.deepEqual(topic.places.map((p) => p.name), ['Stepped', 'Block']);
});
