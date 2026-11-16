// The GeoJSON → Layer conversion, fed small hand-written FeatureCollections around the
// centre of Amsterdam (places/index.ts: amsterdam-centre, 2 km square).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLACES } from '../places/index.ts';
import { geojsonLayer } from '../scripts/geojson.ts';
import { parseLayer, type LayerKind, type LayerSource } from '../src/layers.ts';

const PLACE = PLACES['amsterdam-centre'];
const KX = 67889.41512315086, KY = 111195.0802335329;
// GeoJSON order: [lon, lat], for a point given in metres east and north of the place centre.
const ll = (x: number, y: number): [number, number] => [PLACE.lon + x / KX, PLACE.lat + y / KY];

const spec = (kind: LayerKind): LayerSource => ({
  title: 'Ponts',
  file: 'x.geojson',
  kind,
  role: 'overlay',
  attribution: '© Test',
  nameField: 'nom',
  categoryField: 'type',
});
const collection = (...features: unknown[]) => ({ type: 'FeatureCollection', features });
const feature = (geometry: unknown, properties: unknown = {}) => ({ type: 'Feature', geometry, properties });

test('a point becomes an object with its name, category and scalar properties', () => {
  const json = collection(feature(
    { type: 'Point', coordinates: ll(10, 20) },
    { nom: 'Magere Brug', type: 'pont', annee: 1934, ouvert: true, meta: { a: 1 } },
  ));
  assert.deepEqual(geojsonLayer(json, PLACE, 'ponts', spec('points')), {
    id: 'ponts',
    kind: 'points',
    role: 'overlay',
    attribution: '© Test',
    source: 'x.geojson',
    features: [{ g: [10, 20], n: 'Magere Brug', k: 'pont', p: { annee: 1934, ouvert: true } }],
  });
});

test('a MultiPoint becomes one object per point', () => {
  const json = collection(feature({ type: 'MultiPoint', coordinates: [ll(10, 20), ll(30, 40)] }));
  assert.deepEqual(geojsonLayer(json, PLACE, 'ponts', spec('points')).features.map((f) => f.g), [[10, 20], [30, 40]]);
});

test('a MultiLineString becomes one flat line per part', () => {
  const json = collection(feature({ type: 'MultiLineString', coordinates: [[ll(0, 0), ll(10, 10)], [ll(20, 20), ll(30, 40)]] }));
  assert.deepEqual(geojsonLayer(json, PLACE, 'trace', spec('lines')).features.map((f) => f.g), [[0, 0, 10, 10], [20, 20, 30, 40]]);
});

test('a Polygon with a hole becomes one object holding two rings', () => {
  const outer = [ll(0, 0), ll(100, 0), ll(100, 100), ll(0, 0)];
  const hole = [ll(10, 10), ll(20, 10), ll(20, 20), ll(10, 10)];
  const { features } = geojsonLayer(collection(feature({ type: 'Polygon', coordinates: [outer, hole] })), PLACE, 'zones', spec('areas'));
  assert.deepEqual(features.map((f) => f.g), [[[0, 0, 100, 0, 100, 100, 0, 0], [10, 10, 20, 10, 20, 20, 10, 10]]]);
});

test('a MultiPolygon becomes one object per polygon', () => {
  const triangle = (x: number) => [ll(x, 0), ll(x + 10, 0), ll(x + 10, 10), ll(x, 0)];
  const json = collection(feature({ type: 'MultiPolygon', coordinates: [[triangle(0)], [triangle(50)]] }));
  assert.equal(geojsonLayer(json, PLACE, 'zones', spec('areas')).features.length, 2);
});

test('a geometry that does not fit the layer kind is rejected', () => {
  const json = collection(feature({ type: 'Polygon', coordinates: [[ll(0, 0), ll(10, 0), ll(10, 10), ll(0, 0)]] }));
  assert.throws(() => geojsonLayer(json, PLACE, 'trace', spec('lines')), { message: 'feature 0: Polygon in a lines layer' });
});

test('a feature without a geometry is rejected', () => {
  assert.throws(() => geojsonLayer(collection(feature(null)), PLACE, 'ponts', spec('points')), { message: 'feature 0: no geometry' });
});

test('a document that is not a FeatureCollection is rejected', () => {
  assert.throws(() => geojsonLayer({ type: 'Feature' }, PLACE, 'ponts', spec('points')), { message: 'not a GeoJSON FeatureCollection' });
});

test('a point outside the square is dropped', () => {
  const json = collection(
    feature({ type: 'Point', coordinates: ll(1500, 0) }),
    feature({ type: 'Point', coordinates: ll(10, 20) }),
  );
  assert.deepEqual(geojsonLayer(json, PLACE, 'ponts', spec('points')).features.map((f) => f.g), [[10, 20]]);
});

test('a line leaving the square is kept whole', () => {
  const json = collection(feature({ type: 'LineString', coordinates: [ll(900, 0), ll(1100, 0)] }));
  assert.deepEqual(geojsonLayer(json, PLACE, 'trace', spec('lines')).features.map((f) => f.g), [[900, 0, 1100, 0]]);
});

test('a line crossing the square without a vertex inside is kept', () => {
  const json = collection(feature({ type: 'LineString', coordinates: [ll(-1500, 0), ll(1500, 0)] }));
  assert.equal(geojsonLayer(json, PLACE, 'trace', spec('lines')).features.length, 1);
});

test('a line entirely outside the square is dropped', () => {
  const json = collection(feature({ type: 'LineString', coordinates: [ll(1200, 0), ll(1500, 0)] }));
  assert.equal(geojsonLayer(json, PLACE, 'trace', spec('lines')).features.length, 0);
});

test('an empty or missing name and no other property leave only the geometry', () => {
  const json = collection(
    feature({ type: 'Point', coordinates: ll(1, 2) }, { nom: '' }),
    feature({ type: 'Point', coordinates: ll(3, 4) }),
  );
  assert.deepEqual(geojsonLayer(json, PLACE, 'ponts', spec('points')).features, [{ g: [1, 2] }, { g: [3, 4] }]);
});

test('the result passes the layer validation', () => {
  const json = collection(feature({ type: 'Point', coordinates: ll(10, 20) }, { nom: 'Magere Brug', annee: 1934 }));
  const layer = geojsonLayer(json, PLACE, 'ponts', spec('points'));
  assert.deepEqual(parseLayer(layer, 'ponts'), layer);
});
