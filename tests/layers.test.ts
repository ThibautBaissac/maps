// The layer model: validation of a layer and of a layer file, and the selection of features.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { featuresOf, parseLayer, parseLayerFile, type Layer } from '../src/layers.ts';

const FOUNTAINS: Layer = {
  id: 'fontaines',
  kind: 'points',
  role: 'overlay',
  attribution: '© Ville de Lisbonne (CC BY 4.0)',
  source: 'layers/lisbonne-alfama/fontaines.geojson',
  features: [{ g: [10, 20], n: 'Chafariz d’El-Rei', k: 'fontaine', p: { eau: true, annee: 1220 } }],
};

const LINES: Layer = {
  id: 'trace',
  kind: 'lines',
  role: 'overlay',
  attribution: '© Test',
  source: 'layers/x/trace.geojson',
  features: [{ g: [0, 0, 10, 10] }],
};

// A copy of FOUNTAINS with some fields replaced by values the types forbid.
const broken = (changes: Record<string, unknown>): unknown => ({ ...FOUNTAINS, ...changes });

test('a valid layer is returned unchanged', () => {
  assert.deepEqual(parseLayer(FOUNTAINS, 'f'), FOUNTAINS);
});

test('a layer with an unknown kind is rejected', () => {
  assert.throws(() => parseLayer(broken({ kind: 'polygons' }), 'f'), { message: 'f: kind must be points, lines or areas' });
});

test('a layer with an unknown role is rejected', () => {
  assert.throws(() => parseLayer(broken({ role: 'ground' }), 'f'), { message: 'f: role must be one of buildings, roads, waterways, water, parks, building-parts, overlay' });
});

test('a layer id that is not a slug is rejected', () => {
  assert.throws(() => parseLayer(broken({ id: 'Fontaines' }), 'f'), { message: 'f: invalid id "Fontaines" (use a-z, 0-9 and -)' });
});

test('a layer without attribution is rejected', () => {
  assert.throws(() => parseLayer(broken({ attribution: '' }), 'f'), { message: 'f: attribution must be a non-empty string' });
});

test('a layer whose features are not an array is rejected', () => {
  assert.throws(() => parseLayer(broken({ features: {} }), 'f'), { message: 'f: features must be an array' });
});

test('a point feature without an [x, y] pair is rejected', () => {
  assert.throws(() => parseLayer(broken({ features: [{ g: [10] }] }), 'f'), { message: 'f: feature 0: points need [x, y]' });
});

test('a line feature with fewer than two pairs is rejected', () => {
  assert.throws(() => parseLayer({ ...LINES, features: [{ g: [0, 0] }] }, 'f'), { message: 'f: feature 0: lines need at least two [x, y] pairs' });
});

test('an area feature with a ring of fewer than three pairs is rejected', () => {
  assert.throws(
    () => parseLayer({ ...LINES, kind: 'areas', features: [{ g: [[0, 0, 1, 0]] }] }, 'f'),
    { message: 'f: feature 0: areas need rings of at least three [x, y] pairs' },
  );
});

test('a feature with a coordinate that is not a finite number is rejected', () => {
  assert.throws(() => parseLayer(broken({ features: [{ g: [10, Number.NaN] }] }), 'f'), { message: 'f: feature 0: coordinates must be finite numbers' });
});

test('feature properties that are not strings, numbers or booleans are rejected', () => {
  assert.throws(() => parseLayer(broken({ features: [{ g: [1, 2], p: { a: { b: 1 } } }] }), 'f'), { message: 'f: feature 0: p values must be strings, numbers or booleans' });
});

test('a feature name that is not a string is rejected', () => {
  assert.throws(() => parseLayer(broken({ features: [{ g: [1, 2], n: 3 }] }), 'f'), { message: 'f: feature 0: n must be a string' });
});

test('a valid layer file is returned unchanged', () => {
  const file = { square: { lat: 38.7118, lon: -9.1284, sizeKm: 2 }, layers: [FOUNTAINS] };
  assert.deepEqual(parseLayerFile(file, 'file'), file);
});

test('a layer file without a square is rejected', () => {
  assert.throws(() => parseLayerFile({ layers: [] }, 'file'), { message: 'file: square must hold lat, lon and sizeKm numbers' });
});

test('a layer file with two layers of the same id is rejected', () => {
  const square = { lat: 38.7118, lon: -9.1284, sizeKm: 2 };
  assert.throws(() => parseLayerFile({ square, layers: [FOUNTAINS, FOUNTAINS] }, 'file'), { message: 'file: duplicate layer "fontaines"' });
});

test('featuresOf gathers the features of the layers of one role and kind', () => {
  assert.deepEqual(featuresOf([FOUNTAINS, LINES], 'overlay', 'points'), FOUNTAINS.features);
});

test('an OpenStreetMap role is reserved for the layer whose id is that role', () => {
  assert.throws(() => parseLayer({ ...FOUNTAINS, id: 'batiments', role: 'buildings', kind: 'areas', features: [] }, 'f'), /role buildings is reserved for OpenStreetMap layers/);
  assert.doesNotThrow(() => parseLayer({ ...FOUNTAINS, id: 'buildings', role: 'buildings', kind: 'areas', features: [] }, 'f'));
});
