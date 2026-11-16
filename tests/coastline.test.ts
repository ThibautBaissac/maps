import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seaPolygons } from '../scripts/coastline.ts';
import type { Feature, Ring } from '../src/layers.ts';


function area(r: Ring): number {
  let sum = 0;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    sum += r[j]! * r[i + 1]! - r[i]! * r[j + 1]!;
  }
  return Math.abs(sum) / 2;
}
function waterArea(water: Feature<Ring[]>[]): number {
  return water.reduce((sum, w) => sum + area(w.g[0]!) - w.g.slice(1).reduce((holes, r) => holes + area(r), 0), 0);
}

test('an island entirely inside the survey leaves sea around its land', () => {
  const water = seaPolygons([[-2, -2, 2, -2, 2, 2, -2, 2, -2, -2]], 10);
  assert.equal(waterArea(water), 384, '400 m² survey minus 16 m² island must leave 384 m² of sea');
  assert.equal(water[0]?.g.length, 2, 'The island must remain a hole in the sea');
});

test('a closed coastline starting inside the survey preserves the sea outside its land', () => {
  const water = seaPolygons([[0, 0, 20, 0, 20, 20, 0, 20, 0, 0]], 10);
  assert.equal(waterArea(water), 300, 'Only the north-east quarter of the survey is land');
});
