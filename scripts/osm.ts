// OpenStreetMap → MapData: the Overpass query for a place, the check of an answer and its
// conversion to local metres. Pure: no network, no file, no process, no console.
// scripts/fetch-osm.ts downloads and writes; this module decides what the data holds.
import { PLACES, type PlaceId } from '../places/index.ts';
import { isRoadKind, type BBox, type Line, type MapData, type Ring, type Road, type Waterway } from '../src/data.ts';
import { isRecord, parsePlace, type Place } from '../src/place.ts';
import { endpointKey as key, r1, seaPolygons } from './coastline.ts';

// Flat coordinate arrays hold [x, y] pairs: an index bounded by the length (stepping by 2)
// is always defined, hence the `!` in the loops below.

/** Seconds Overpass may spend on the query; the download waits a little longer. */
export const QUERY_TIMEOUT_S = 120;

// The part of the Overpass answer (out geom) the conversion reads.
interface LatLon { lat: number; lon: number }
interface OsmTags {
  [key: string]: string | undefined;
  area?: string;
  bridge?: string;
  building?: string;
  highway?: string;
  landuse?: string;
  leisure?: string;
  name?: string;
  natural?: string;
  tunnel?: string;
  waterway?: string;
}
interface OsmMember { type: string; role: string; geometry?: LatLon[] }
interface OsmElement { type: 'node' | 'way' | 'relation'; tags?: OsmTags; geometry?: LatLon[]; members?: OsmMember[] }
export interface OverpassAnswer { elements: OsmElement[]; remark?: string; osm3s?: { timestamp_osm_base?: string } }

const R = 6371008.8;
const toRad = (d: number): number => (d * Math.PI) / 180;

// The downloaded square: metres from the centre to its edge, and its bounds in degrees.
function survey(place: Place): { half: number; bbox: BBox } {
  const half = (place.sizeKm * 1000) / 2;
  const dLat = (half / R) * (180 / Math.PI);
  const dLon = dLat / Math.cos(toRad(place.lat));
  return { half, bbox: [place.lat - dLat, place.lon - dLon, place.lat + dLat, place.lon + dLon] };
}

/** The Overpass QL query for everything a map draws inside the place's square. */
export function overpassQuery(place: Place): string {
  const bb = survey(place).bbox.map((v) => v.toFixed(6)).join(',');
  return `
[out:json][timeout:${QUERY_TIMEOUT_S}];
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
out geom;`;
}

const isOverpassAnswer = (v: unknown): v is OverpassAnswer => isRecord(v) && Array.isArray(v['elements']);

/** The answer, typed; throws when it is not one or holds nothing (an overloaded server). */
export function parseOverpassAnswer(json: unknown): OverpassAnswer {
  if (!isOverpassAnswer(json)) throw new Error('unexpected answer');
  const answer = json;
  if (!answer.elements.length) throw new Error(`no elements (${answer.remark ?? 'empty answer'})`);
  return answer;
}

/** A download kept for converting again without network: the place as it was then, and the answer. */
export interface CachedAnswer { place: Place; server: string; fetchedAt: string; answer: OverpassAnswer }

/** Fields that set the downloaded square: when one changed, the cached answer covers other ground. */
const SQUARE_FIELDS = ['lat', 'lon', 'sizeKm'] as const;

/**
 * The cached download, checked against the place as it is now. Throws when the cache is
 * damaged or was downloaded for another square; a renamed place is fine (same ground).
 */
export function parseCachedAnswer(json: unknown, place: Place): CachedAnswer {
  if (!isRecord(json) || typeof json['server'] !== 'string' || typeof json['fetchedAt'] !== 'string') {
    throw new Error('damaged cache: expected { place, server, fetchedAt, answer }');
  }
  const cachedPlace = parsePlace(json['place'], 'cache');
  const answer = parseOverpassAnswer(json['answer']);
  for (const k of SQUARE_FIELDS) {
    if (cachedPlace[k] !== place[k]) {
      throw new Error(`the cache was downloaded for ${k} = ${cachedPlace[k]}, the place now has ${k} = ${place[k]}: run fetch-data without --offline`);
    }
  }
  return { place: cachedPlace, server: json['server'], fetchedAt: json['fetchedAt'], answer };
}

// Joins relation member ways into closed rings by matching endpoints.
function assembleRings(lines: readonly Line[]): Ring[] {
  const pool = lines.filter((l) => l.length >= 4).map((l) => l.slice());
  const rings: Ring[] = [];
  let first: Line | undefined;
  while ((first = pool.shift())) {
    let ring = first;
    let guard = 0;
    while (key(ring, 0) !== key(ring, ring.length - 2) && guard++ < 10000) {
      const end = key(ring, ring.length - 2);
      let idx = -1, reverse = false;
      for (let i = 0; i < pool.length; i++) {
        const l = pool[i]!;
        if (key(l, 0) === end) { idx = i; break; }
        if (key(l, l.length - 2) === end) { idx = i; reverse = true; break; }
      }
      if (idx < 0) break; // open ring: keep what we have
      let next = pool.splice(idx, 1)[0]!;
      if (reverse) {
        const rev: Line = [];
        for (let i = next.length - 2; i >= 0; i -= 2) rev.push(next[i]!, next[i + 1]!);
        next = rev;
      }
      ring = ring.concat(next.slice(2));
    }
    if (ring.length >= 6) rings.push(ring);
  }
  return rings;
}

/** A tag present with any value but "no" (bridge=yes, tunnel=culvert…). */
const isSet = (v: string | undefined): boolean => !!v && v !== 'no';

const isWater = (t: OsmTags): boolean => t.natural === 'water' || t.landuse === 'basin' || t.landuse === 'reservoir' || t.waterway === 'riverbank';
const isPark = (t: OsmTags): boolean =>
  /^(park|garden|playground|pitch|nature_reserve)$/.test(t.leisure ?? '') ||
  /^(grass|recreation_ground|village_green|forest|meadow|cemetery|allotments)$/.test(t.landuse ?? '') ||
  /^(wood|scrub|grassland)$/.test(t.natural ?? '');

/** The map data of a place from its Overpass answer: local metres, x east, y north, 0.1 m. */
export function convertOsm(answer: OverpassAnswer, placeId: PlaceId, source: { server: string; fetchedAt: string }): MapData {
  const place = PLACES[placeId];
  const { half, bbox } = survey(place);

  // Local equirectangular projection, metres, x east / y north, 0.1 m precision.
  const kx = R * toRad(1) * Math.cos(toRad(place.lat));
  const ky = R * toRad(1);
  const project = (geom: readonly LatLon[]): Line => {
    const out: Line = [];
    for (const p of geom) out.push(r1((p.lon - place.lon) * kx), r1((p.lat - place.lat) * ky));
    return out;
  };
  const polygonRings = (el: OsmElement): Ring[] => {
    if (el.type === 'way') return el.geometry ? [project(el.geometry)] : [];
    const members = (el.members ?? []).flatMap((m) => (m.type === 'way' && m.geometry ? [{ role: m.role, geometry: m.geometry }] : []));
    const outer = assembleRings(members.filter((m) => m.role !== 'inner').map((m) => project(m.geometry)));
    const inner = assembleRings(members.filter((m) => m.role === 'inner').map((m) => project(m.geometry)));
    return [...outer, ...inner];
  };

  const osmTimestamp = answer.osm3s?.timestamp_osm_base;
  const data: MapData = {
    meta: {
      place: placeId,
      ...place,
      bbox,
      half,
      server: source.server,
      fetchedAt: source.fetchedAt,
      ...(osmTimestamp ? { osmTimestamp } : {}),
      attribution: '© contributeurs OpenStreetMap (ODbL)',
    },
    buildings: [],
    roads: [],
    waterways: [],
    water: [],
    parks: [],
  };

  const coast: Line[] = [];
  for (const el of answer.elements) {
    const t = el.tags ?? {};
    if (el.type === 'way' && t.natural === 'coastline') {
      if (el.geometry) coast.push(project(el.geometry));
    } else if (isSet(t.building) && !t['building:part']) {
      const r = polygonRings(el);
      if (r.length) data.buildings.push(r);
    } else if (el.type === 'way' && t.highway && isRoadKind(t.highway) && t.area !== 'yes') {
      if (!el.geometry) continue;
      const road: Road = { k: t.highway, p: project(el.geometry) };
      if (t.name) road.n = t.name;
      if (isSet(t.bridge)) road.b = 1;
      if (isSet(t.tunnel)) road.u = 1;
      data.roads.push(road);
    } else if (el.type === 'way' && t.waterway && t.waterway !== 'riverbank' && t.waterway !== 'dam') {
      if (!el.geometry) continue;
      const w: Waterway = { k: t.waterway, p: project(el.geometry) };
      if (t.name) w.n = t.name;
      if (isSet(t.tunnel)) w.u = 1;
      data.waterways.push(w);
    } else if (isWater(t)) {
      const r = polygonRings(el);
      if (r.length) data.water.push(t.name ? { n: t.name, r } : { r });
    } else if (isPark(t)) {
      const r = polygonRings(el);
      const k = t.leisure ?? t.landuse ?? t.natural;
      if (r.length && k) data.parks.push({ k, r });
    }
  }

  data.water.push(...seaPolygons(coast, half));
  return data;
}
