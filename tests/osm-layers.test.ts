// The OpenStreetMap adapter: MapData seen as layers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { convertOsm } from '../scripts/osm.ts';
import { featuresOf, isBridge, isTunnel, parseLayer, type Layer } from '../src/layers.ts';
import { osmLayers } from '../src/osm-layers.ts';
import { ANSWER, SOURCE } from './fixtures/overpass.ts';

const data = convertOsm(ANSWER, 'amsterdam-centre', SOURCE);
const layers = osmLayers(data);
const layer = (id: string): Layer => {
  const found = layers.find((l) => l.id === id);
  assert.ok(found, `layer ${id} exists`);
  return found;
};

test('the layers come in the order buildings, roads, waterways, water, parks, each with the id of its role', () => {
  assert.deepEqual(layers.map((l) => [l.id, l.role, l.kind]), [
    ['buildings', 'buildings', 'areas'],
    ['roads', 'roads', 'lines'],
    ['waterways', 'waterways', 'lines'],
    ['water', 'water', 'areas'],
    ['parks', 'parks', 'areas'],
  ]);
});

test('each layer holds as many objects as the collection it comes from', () => {
  assert.equal(layer('buildings').features.length, data.buildings.length);
  assert.equal(layer('roads').features.length, data.roads.length);
  assert.equal(layer('waterways').features.length, data.waterways.length);
  assert.equal(layer('water').features.length, data.water.length);
  assert.equal(layer('parks').features.length, data.parks.length);
});

test('layers carry the OpenStreetMap attribution and source', () => {
  for (const l of layers) {
    assert.equal(l.attribution, data.meta.attribution);
    assert.equal(l.source, 'openstreetmap');
  }
});

test('a bridge road keeps its geometry, highway, name and a bridge property', () => {
  const damrak = featuresOf(layers, 'roads', 'lines').find((f) => f.n === 'Damrak');
  assert.ok(damrak);
  assert.deepEqual(damrak, { g: [0, 0, 50, 0], k: 'residential', n: 'Damrak', p: { bridge: true } });
  assert.equal(isBridge(damrak), true);
  assert.equal(isTunnel(damrak), false);
});

test('a tunnel footway is a tunnel and not a bridge', () => {
  const tunnel = featuresOf(layers, 'roads', 'lines').find((f) => f.k === 'footway' && isTunnel(f));
  assert.ok(tunnel);
  assert.equal(isBridge(tunnel), false);
});

test('a waterway tunnel is flagged', () => {
  assert.ok(featuresOf(layers, 'waterways', 'lines').some((f) => f.k === 'stream' && isTunnel(f)));
});

test('a lake keeps its name in the water layer', () => {
  assert.ok(featuresOf(layers, 'water', 'areas').some((f) => f.n === 'Vijver'));
});

test('a building is its rings and a park its category', () => {
  assert.deepEqual(featuresOf(layers, 'buildings', 'areas').map((f) => f.g), data.buildings);
  assert.deepEqual(featuresOf(layers, 'parks', 'areas').map((f) => f.k), data.parks.map((p) => p.k));
});

test('every layer passes parseLayer', () => {
  for (const l of layers) assert.deepEqual(parseLayer(l, l.id), l);
});
