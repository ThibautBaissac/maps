// A small hand-written Overpass answer (out geom) around the centre of Amsterdam
// (places/index.ts: amsterdam-centre, 2 km square), shared by the OSM tests.
import { PLACES } from '../../places/index.ts';
import type { OverpassAnswer } from '../../scripts/osm.ts';

export const PLACE = PLACES['amsterdam-centre'];

// Lat/lon of a point given in metres east and north of the place centre, for building
// fixtures; the assertions use hard-coded metres.
const KX = 67889.41512315086, KY = 111195.0802335329;
export const ll = (x: number, y: number): { lat: number; lon: number } => ({ lat: PLACE.lat + y / KY, lon: PLACE.lon + x / KX });
export const geom = (...pts: [number, number][]) => pts.map(([x, y]) => ll(x, y));
export const square = (x: number, y: number, s: number) => geom([x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]);

export const ANSWER: OverpassAnswer = {
  osm3s: { timestamp_osm_base: '2026-11-01T00:00:00Z' },
  elements: [
    // A plain building, given in degrees so its projected metres can be checked exactly.
    { type: 'way', tags: { building: 'yes' }, geometry: [
      { lat: 52.3722, lon: 4.8946 }, { lat: 52.3722, lon: 4.8956 }, { lat: 52.3732, lon: 4.8956 }, { lat: 52.3722, lon: 4.8946 },
    ] },
    // A multipolygon building: outer split in two ways, the second running backwards, plus a hole.
    { type: 'relation', tags: { building: 'yes', type: 'multipolygon' }, members: [
      { type: 'way', role: 'outer', geometry: geom([200, 200], [220, 200], [220, 220]) },
      { type: 'way', role: 'outer', geometry: geom([200, 200], [200, 220], [220, 220]) },
      { type: 'way', role: 'inner', geometry: square(205, 205, 5) },
    ] },
    { type: 'way', tags: { building: 'yes', 'building:part': 'yes' }, geometry: square(300, 300, 10) },
    { type: 'way', tags: { building: 'no' }, geometry: square(320, 300, 10) },
    { type: 'way', tags: { highway: 'residential', name: 'Damrak', bridge: 'yes' }, geometry: geom([0, 0], [50, 0]) },
    { type: 'way', tags: { highway: 'pedestrian', area: 'yes' }, geometry: square(-100, -100, 20) },
    { type: 'way', tags: { highway: 'footway', tunnel: 'yes' }, geometry: geom([0, 50], [0, 80]) },
    { type: 'way', tags: { highway: 'cycleway', bridge: 'no', tunnel: 'no' }, geometry: geom([0, 100], [0, 120]) },
    { type: 'way', tags: { highway: 'proposed' }, geometry: geom([0, 140], [0, 160]) },
    { type: 'way', tags: { waterway: 'canal', name: 'Singel' }, geometry: geom([-200, 0], [-200, 100]) },
    { type: 'way', tags: { waterway: 'stream', tunnel: 'culvert' }, geometry: geom([-220, 0], [-220, 100]) },
    { type: 'way', tags: { waterway: 'dam' }, geometry: geom([-240, 0], [-240, 100]) },
    { type: 'way', tags: { landuse: 'basin' }, geometry: square(-300, 200, 30) },
    { type: 'way', tags: { waterway: 'riverbank' }, geometry: square(-300, 0, 30) },
    { type: 'way', tags: { natural: 'water', name: 'Vijver' }, geometry: square(-300, 100, 30) },
    { type: 'way', tags: { leisure: 'garden', name: 'Hortus' }, geometry: square(400, -400, 50) },
    { type: 'way', tags: { landuse: 'grass' }, geometry: square(400, -300, 50) },
    { type: 'way', tags: { natural: 'wood' }, geometry: square(400, -200, 50) },
    { type: 'way', tags: { leisure: 'park', landuse: 'grass' }, geometry: square(400, -100, 50) },
    // Coastline running south along x = 300 m: land on its left (east), sea on its right (west).
    { type: 'way', tags: { natural: 'coastline' }, geometry: geom([300, 1500], [300, -1500]) },
  ],
};
export const SOURCE = { server: 'https://overpass.test/api', fetchedAt: '2026-11-16T10:00:00.000Z' };
