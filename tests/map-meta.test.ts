import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findMap } from '../src/catalogue.ts';
import type { LayerFile } from '../src/layers.ts';
import { mountMetaOf } from '../src/map-meta.ts';

const map = findMap('amsterdam-riso', 'en')!;
const osm: LayerFile = {
  square: { lat: 0, lon: 0, sizeKm: 99 },
  fetchedAt: '2026-11-15T12:59:00.000Z',
  layers: [{ id: 'buildings', kind: 'areas', role: 'buildings', source: 'openstreetmap', attribution: '© contributeurs OpenStreetMap (ODbL)', features: [] }],
};

test('the page metadata takes the place from the catalogue and the data date and credit from the file', () => {
  const { survey, meta } = mountMetaOf(map, osm);
  assert.equal(survey.half, 1000);
  assert.equal(survey.osmDate, '2026-11-15T12:59:00.000Z');
  assert.deepEqual([survey.lat, survey.lon, survey.sizeKm], [map.place.lat, map.place.lon, map.place.sizeKm]);
  assert.equal(meta.title, map.title);
  assert.equal(meta.district, 'Historic centre');
  assert.equal(meta.place, 'amsterdam-centre');
  assert.equal(meta.attribution, '© contributeurs OpenStreetMap (ODbL)');
  assert.equal(meta.half, 1000);
  assert.equal(meta.bbox[0] < map.place.lat && map.place.lat < meta.bbox[2], true);
});

test('the data date is the OpenStreetMap database timestamp, not the later download date', () => {
  const { survey } = mountMetaOf(map, { ...osm, fetchedAt: '2026-11-17T12:23:16.078Z', osmTimestamp: '2026-07-28T02:16:18Z' });
  assert.equal(survey.osmDate, '2026-07-28T02:16:18Z');
});

test('a file without dates or layers gives empty strings', () => {
  const { survey, meta } = mountMetaOf(map, { square: osm.square, layers: [] });
  assert.equal(survey.osmDate, '');
  assert.equal(meta.attribution, '');
});
