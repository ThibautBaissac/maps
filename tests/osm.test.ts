// The OSM → MapData conversion, fed a small hand-written Overpass answer (out geom)
// around the centre of Amsterdam (places/index.ts: amsterdam-centre, 2 km square).
// The fixture's elements are known to exist, hence the `!` on array reads below.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Ring } from '../src/data.ts';
import { convertOsm, overpassQuery, parseCachedAnswer, parseOverpassAnswer } from '../scripts/osm.ts';
import { ANSWER, PLACE, SOURCE } from './fixtures/overpass.ts';

const HALF = 1000;

const data = () => convertOsm(ANSWER, 'amsterdam-centre', SOURCE);

const closed = (r: Ring): boolean => r[0] === r.at(-2) && r[1] === r.at(-1);
const area = (r: Ring): number => {
  let s = 0;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) s += r[j]! * r[i + 1]! - r[i]! * r[j + 1]!;
  return Math.abs(s) / 2;
};

test('a building way becomes a ring in local metres, rounded to 0.1 m, closing on its first point', () => {
  const [plain] = data().buildings;
  assert.deepEqual(plain, [[67.9, 111.2, 135.8, 111.2, 135.8, 222.4, 67.9, 111.2]]);
  assert.ok(closed(plain![0]!));
});

test('a multipolygon building joins its outer ways into one closed ring, then its hole', () => {
  const rings = data().buildings[1]!;
  assert.equal(rings.length, 2);
  const [outer, inner] = rings as [Ring, Ring];
  assert.equal(outer.length, 10, 'Four corners plus the repeated first point');
  assert.ok(closed(outer) && closed(inner));
  assert.ok(Math.abs(area(outer) - 400) < 1, `outer area ${area(outer)} should be 20 m × 20 m`);
  assert.ok(Math.abs(area(inner) - 25) < 1, `inner area ${area(inner)} should be 5 m × 5 m`);
});

test('building parts and building=no are left out', () => {
  assert.equal(data().buildings.length, 2);
});

test('roads keep their kind, name, bridge and tunnel; road areas and unknown kinds are left out', () => {
  const roads = data().roads;
  // Compared as JSON: the key order is part of the file format.
  assert.deepEqual(roads.map((r) => JSON.stringify(r)), [
    '{"k":"residential","p":[0,0,50,0],"n":"Damrak","b":1}',
    '{"k":"footway","p":[0,50,0,80],"u":1}',
    '{"k":"cycleway","p":[0,100,0,120]}',
  ]);
});

test('waterways are lines, tunnels marked, dams left out; riverbanks, basins and water bodies are areas', () => {
  const d = data();
  assert.deepEqual(d.waterways.map((w) => JSON.stringify({ ...w, p: undefined })), ['{"k":"canal","n":"Singel"}', '{"k":"stream","u":1}']);
  const bodies = d.water.filter((w) => w.r[0]!.every((v) => Math.abs(v) < 400));
  assert.deepEqual(bodies.map((w) => w.n), [undefined, undefined, 'Vijver'], 'Basin, riverbank, then the named pond, in answer order');
  assert.ok(!('n' in bodies[0]!), 'An unnamed area has no n key');
});

test('parks keep the value of the tag that made them a park', () => {
  // leisure wins over landuse, which wins over natural.
  assert.deepEqual(data().parks.map((p) => p.k), ['garden', 'grass', 'wood', 'park']);
});

test('a coastline crossing the square turns the sea side into water, cut to the square', () => {
  const sea = data().water.filter((w) => !w.r[0]!.every((v) => Math.abs(v) < 400));
  assert.equal(sea.length, 1);
  const ring = sea[0]!.r[0]!;
  assert.ok(ring.every((v) => Math.abs(v) <= HALF), 'The sea stays inside the 2 km square');
  assert.ok(Math.abs(area(ring) - 1300 * 2000) < 1, `sea area ${area(ring)} should run from x = -1000 to 300 m`);
});

test('meta records the place, its square and where the data came from, in file order', () => {
  assert.equal(JSON.stringify(data().meta), JSON.stringify({
    place: 'amsterdam-centre',
    ...PLACE,
    bbox: [52.362206796362756, 4.878870163276765, 52.38019320363725, 4.908329836723236],
    half: HALF,
    server: SOURCE.server,
    fetchedAt: SOURCE.fetchedAt,
    osmTimestamp: '2026-11-01T00:00:00Z',
    attribution: '© contributeurs OpenStreetMap (ODbL)',
  }));
});

test('the query asks Overpass for everything a map draws in the place square', () => {
  const bb = '52.362207,4.878870,52.380193,4.908330';
  assert.equal(overpassQuery(PLACE), `
[out:json][timeout:120];
(
  way["building"](${bb});
  relation["building"]["type"="multipolygon"](${bb});
  way["highway"](${bb});
  way["waterway"](${bb});
  way["natural"="water"](${bb});
  way["natural"="coastline"](${bb});
  relation["natural"="water"](${bb});
  way["landuse"~"^(basin|reservoir)$"](${bb});
  way["leisure"~"^(park|garden|playground|pitch|nature_reserve)$"](${bb});
  relation["leisure"~"^(park|garden)$"](${bb});
  way["landuse"~"^(grass|recreation_ground|village_green|forest|meadow|cemetery|allotments)$"](${bb});
  relation["landuse"~"^(grass|recreation_ground|forest|cemetery)$"](${bb});
  way["natural"~"^(wood|scrub|grassland)$"](${bb});
);
out geom;`);
});

test('an Overpass answer must hold elements', () => {
  assert.throws(() => parseOverpassAnswer({ remark: 'x' }), /unexpected answer/);
  assert.throws(() => parseOverpassAnswer({ elements: [], remark: 'runtime error: timeout' }), /no elements \(runtime error: timeout\)/);
  assert.throws(() => parseOverpassAnswer({ elements: [] }), /no elements \(empty answer\)/);
  assert.equal(parseOverpassAnswer(ANSWER), ANSWER);
});

// The cache of a download: { place, server, fetchedAt, answer }, place as it was then.
const cached = (place: object = PLACE) => ({ place, server: SOURCE.server, fetchedAt: SOURCE.fetchedAt, answer: ANSWER });

test('a cached answer for the same square is read back with its server and date', () => {
  assert.deepEqual(parseCachedAnswer(cached(), PLACE), { place: PLACE, server: SOURCE.server, fetchedAt: SOURCE.fetchedAt, answer: ANSWER });
});

test('a cached answer still serves a place renamed since the download', () => {
  const renamed = { ...PLACE, name: 'Mokum', district: 'Binnenstad' };
  assert.equal(parseCachedAnswer(cached(), renamed).answer, ANSWER);
});

test('a cached answer for another square is refused, naming the field and the way out', () => {
  for (const [field, value] of [['lat', 52.4], ['lon', 4.9], ['sizeKm', 3]] as const) {
    const moved = { ...PLACE, [field]: value };
    assert.throws(() => parseCachedAnswer(cached(), moved), (err: Error) =>
      err.message.includes(field) && err.message.includes(String(value)) && err.message.includes(String(PLACE[field]))
      && err.message.includes('without --offline'));
  }
});

test('a damaged cache is refused', () => {
  assert.throws(() => parseCachedAnswer({ place: PLACE }, PLACE), /cache/);
  assert.throws(() => parseCachedAnswer({ ...cached(), answer: { elements: [] } }, PLACE), /no elements/);
  assert.throws(() => parseCachedAnswer(null, PLACE), /cache/);
});
