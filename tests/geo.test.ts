// The local projection shared by the OSM and GeoJSON converters, around the centre of
// Amsterdam (places/index.ts: amsterdam-centre, 2 km square).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLACES } from '../places/index.ts';
import { localProjection, survey } from '../src/geo.ts';

const PLACE = PLACES['amsterdam-centre'];
const KX = 67889.41512315086, KY = 111195.0802335329;

test('the place centre projects to the origin', () => {
  assert.deepEqual(localProjection(PLACE)(52.3712, 4.8936), [0, 0]);
});

test('a point is projected to metres, x east and y north', () => {
  assert.deepEqual(localProjection(PLACE)(52.3712 + 100 / KY, 4.8936 + 50 / KX), [50, 100]);
});

test('projected metres are rounded to 0.1 m', () => {
  assert.deepEqual(localProjection(PLACE)(52.3712 + 0.04 / KY, 4.8936), [0, 0]);
});

test('the projection accepts a bare square as well as a place', () => {
  const { lat, lon, sizeKm } = PLACE;
  assert.deepEqual(localProjection({ lat, lon, sizeKm })(52.3712 + 100 / KY, 4.8936 + 50 / KX), [50, 100]);
});

test('the survey spans half the side of the square from the centre', () => {
  assert.equal(survey(PLACE).half, 1000);
});

test('the survey bounds are centred on the place', () => {
  const [south, west, north, east] = survey(PLACE).bbox;
  assert.ok(Math.abs((south + north) / 2 - PLACE.lat) < 1e-9);
  assert.ok(Math.abs((west + east) / 2 - PLACE.lon) < 1e-9);
  assert.ok(Math.abs((north - south) * KY - 2000) < 1);
});
