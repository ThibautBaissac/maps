// The OSM conversion to layers, fed a small hand-written Overpass answer (out geom)
// around the centre of Amsterdam (places/index.ts: amsterdam-centre, 2 km square).
// The fixture's elements are known to exist, hence the `!` on array reads below.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { convertOsm, metres, osmLayerFile, overpassQuery, parseCachedAnswer, parseOverpassAnswer, volumeProps } from '../scripts/osm.ts';
import { baseOf, featureCounts, featuresOf, hasParts, heightOf, isBridge, isTunnel, parseLayer, parseLayerFile, yearOf, type Ring } from '../src/layers.ts';
import { PLACES } from '../places/index.ts';
import { ANSWER, PLACE, SOURCE, square } from './fixtures/overpass.ts';

const HALF = 1000;

const layers = convertOsm(ANSWER, 'amsterdam-centre');
const buildings = featuresOf(layers, 'buildings', 'areas');
const roads = featuresOf(layers, 'roads', 'lines');
const waterways = featuresOf(layers, 'waterways', 'lines');
const water = featuresOf(layers, 'water', 'areas');
const parks = featuresOf(layers, 'parks', 'areas');

const closed = (r: Ring): boolean => r[0] === r.at(-2) && r[1] === r.at(-1);
const area = (r: Ring): number => {
  let s = 0;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) s += r[j]! * r[i + 1]! - r[i]! * r[j + 1]!;
  return Math.abs(s) / 2;
};

test('the layers come in the order buildings, roads, waterways, water, parks, building parts, each with the id of its role', () => {
  assert.deepEqual(layers.map((l) => [l.id, l.role, l.kind]), [
    ['buildings', 'buildings', 'areas'],
    ['roads', 'roads', 'lines'],
    ['waterways', 'waterways', 'lines'],
    ['water', 'water', 'areas'],
    ['parks', 'parks', 'areas'],
    ['building-parts', 'building-parts', 'areas'],
  ]);
});

test('layers carry the OpenStreetMap attribution and source, and pass parseLayer', () => {
  for (const l of layers) {
    assert.equal(l.attribution, '© contributeurs OpenStreetMap (ODbL)');
    assert.equal(l.source, 'openstreetmap');
    assert.deepEqual(parseLayer(l, l.id), l);
  }
});

test('a building way becomes a ring in local metres, rounded to 0.1 m, closing on its first point', () => {
  const plain = buildings[0]!;
  assert.deepEqual(plain, { g: [[67.9, 111.2, 135.8, 111.2, 135.8, 222.4, 67.9, 111.2]] });
  assert.ok(closed(plain.g[0]!));
});

test('a multipolygon building joins its outer ways into one closed ring, then its hole', () => {
  const rings = buildings[1]!.g;
  assert.equal(rings.length, 2);
  const [outer, inner] = rings as [Ring, Ring];
  assert.equal(outer.length, 10, 'Four corners plus the repeated first point');
  assert.ok(closed(outer) && closed(inner));
  assert.ok(Math.abs(area(outer) - 400) < 1, `outer area ${area(outer)} should be 20 m × 20 m`);
  assert.ok(Math.abs(area(inner) - 25) < 1, `inner area ${area(inner)} should be 5 m × 5 m`);
});

test('building parts and building=no are left out', () => {
  assert.equal(buildings.length, 2);
});

test('roads keep their kind, name, bridge and tunnel; road areas and unknown kinds are left out', () => {
  // Compared as JSON: the key order is part of the file format.
  assert.deepEqual(roads.map((r) => JSON.stringify(r)), [
    '{"g":[0,0,50,0],"k":"residential","n":"Damrak","p":{"bridge":true}}',
    '{"g":[0,50,0,80],"k":"footway","p":{"tunnel":true}}',
    '{"g":[0,100,0,120],"k":"cycleway"}',
  ]);
});

test('a bridge is a bridge and not a tunnel, and a tunnel the other way round', () => {
  const damrak = roads.find((f) => f.n === 'Damrak')!;
  assert.equal(isBridge(damrak), true);
  assert.equal(isTunnel(damrak), false);
  const footway = roads.find((f) => f.k === 'footway')!;
  assert.equal(isTunnel(footway), true);
  assert.equal(isBridge(footway), false);
});

test('waterways are lines, tunnels marked, dams left out; riverbanks, basins and water bodies are areas', () => {
  assert.deepEqual(waterways.map((w) => JSON.stringify({ ...w, g: undefined })), ['{"k":"canal","n":"Singel"}', '{"k":"stream","p":{"tunnel":true}}']);
  assert.ok(waterways.some((f) => f.k === 'stream' && isTunnel(f)));
  const bodies = water.filter((w) => w.g[0]!.every((v) => Math.abs(v) < 400));
  assert.deepEqual(bodies.map((w) => w.n), [undefined, undefined, 'Vijver'], 'Basin, riverbank, then the named pond, in answer order');
  assert.ok(!('n' in bodies[0]!), 'An unnamed area has no n key');
});

test('parks keep the value of the tag that made them a park', () => {
  // leisure wins over landuse, which wins over natural.
  assert.deepEqual(parks.map((p) => p.k), ['garden', 'grass', 'wood', 'park']);
});

test('a coastline crossing the square turns the sea side into water, cut to the square', () => {
  const sea = water.filter((w) => !w.g[0]!.every((v) => Math.abs(v) < 400));
  assert.equal(sea.length, 1);
  const ring = sea[0]!.g[0]!;
  assert.ok(ring.every((v) => Math.abs(v) <= HALF), 'The sea stays inside the 2 km square');
  assert.ok(Math.abs(area(ring) - 1300 * 2000) < 1, `sea area ${area(ring)} should run from x = -1000 to 300 m`);
});

test('the feature counts name each collection in French', () => {
  assert.deepEqual(featureCounts(layers), {
    bâtiments: 2,
    routes: 3,
    'cours d’eau': 2,
    'plans d’eau': water.length,
    'parcs / espaces verts': 4,
  });
});

test('the layer file records the square, where the data came from and the OSM timestamp, in file order', () => {
  const { lat, lon, sizeKm } = PLACES['amsterdam-centre'];
  const file = osmLayerFile(ANSWER, 'amsterdam-centre', SOURCE);
  assert.deepEqual(Object.keys(file), ['square', 'fetchedAt', 'server', 'osmTimestamp', 'layers']);
  assert.deepEqual(file.square, { lat, lon, sizeKm });
  assert.equal(file.fetchedAt, SOURCE.fetchedAt);
  assert.equal(file.server, SOURCE.server);
  assert.equal(file.osmTimestamp, '2026-11-01T00:00:00Z');
  assert.deepEqual(file.layers, layers);
  assert.deepEqual(parseLayerFile(JSON.parse(JSON.stringify(file)), 'osm.json'), file);
});

test('the layer file has no osmTimestamp key when the answer carries none', () => {
  const { osm3s: _dropped, ...bare } = ANSWER;
  const file = osmLayerFile(bare, 'amsterdam-centre', SOURCE);
  assert.deepEqual(Object.keys(file), ['square', 'fetchedAt', 'server', 'layers']);
});

test('the query asks Overpass for everything a map draws in the place square', () => {
  const bb = '52.362207,4.878870,52.380193,4.908330';
  assert.equal(overpassQuery(PLACE), `
[out:json][timeout:120];
(
  way["building"](${bb});
  relation["building"]["type"="multipolygon"](${bb});
  way["building:part"](${bb});
  relation["building:part"]["type"="multipolygon"](${bb});
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

test('a height tag is read in metres, from metres or feet', () => {
  assert.equal(metres('52'), 52);
  assert.equal(metres('52.5 m'), 52.5);
  assert.equal(metres('12,5'), 12.5);
  assert.equal(metres("100'"), 30.5);
  assert.equal(metres('100 ft'), 30.5);
  assert.equal(metres('tall'), undefined);
  assert.equal(metres(undefined), undefined);
});

test('a building keeps its height, from height first, else from its storeys, and its start year', () => {
  assert.deepEqual(volumeProps({ height: '120', 'building:levels': '10', start_date: '1931-05-01' }), { h: 120, year: 1931 });
  assert.deepEqual(volumeProps({ 'building:levels': '10', start_date: 'C19' }), { h: 32 });
  assert.deepEqual(volumeProps({ height: '200', min_height: '150' }), { h: 200, base: 150 });
  assert.deepEqual(volumeProps({ 'building:levels': '30', 'building:min_level': '20' }), { h: 96, base: 64 });
  assert.deepEqual(volumeProps({ start_date: '~1929' }), { year: 1929 });
  assert.deepEqual(volumeProps({}), {});
});

test('a building part goes to the building-parts layer with its heights, never to the buildings', () => {
  const parts = featuresOf(layers, 'building-parts', 'areas');
  assert.equal(parts.length, 1);
  assert.equal(buildings.length, 2);
});

test('a building whose outline holds a part is marked, so maps draw its parts instead', () => {
  const answer = {
    elements: [
      { type: 'way' as const, tags: { building: 'yes', height: '100', name: 'Tower', start_date: '1930' }, geometry: square(400, 400, 40) },
      { type: 'way' as const, tags: { 'building:part': 'yes', height: '100' }, geometry: square(410, 410, 20) },
      { type: 'way' as const, tags: { 'building:part': 'yes', height: '40', min_height: '10' }, geometry: square(400, 400, 8) },
      { type: 'way' as const, tags: { building: 'yes' }, geometry: square(500, 500, 10) },
    ],
  };
  const converted = convertOsm(answer, 'amsterdam-centre');
  const [tower, plain] = featuresOf(converted, 'buildings', 'areas');
  assert.ok(tower && plain);
  assert.equal(tower.n, 'Tower');
  assert.equal(heightOf(tower), 100);
  assert.equal(yearOf(tower), 1930);
  assert.ok(hasParts(tower));
  assert.ok(!hasParts(plain));
  assert.equal(heightOf(plain), undefined);
  const parts = featuresOf(converted, 'building-parts', 'areas');
  assert.deepEqual(parts.map((p) => [heightOf(p), baseOf(p)]), [[100, 0], [40, 10]]);
});
