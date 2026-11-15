// Format of public/data/<place>.json, written by scripts/fetch-osm.ts and read by the
// map pages. Coordinates are local metres, x east, y north, origin at the place centre.
// Runs in the browser and in Node: no DOM, no Node API.
import type { Place } from './place.ts';

/** Flat polyline [x0, y0, x1, y1, …]. */
export type Line = number[];
/** Flat closed ring [x0, y0, x1, y1, …] (last point not repeated). */
export type Ring = number[];

/** OSM highway values kept by fetch-osm. */
export const ROAD_KINDS = [
  'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential',
  'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link',
  'living_street', 'service', 'pedestrian', 'footway', 'cycleway', 'path', 'steps', 'track',
] as const;
export type RoadKind = (typeof ROAD_KINDS)[number];
export const isRoadKind = (k: string): k is RoadKind => (ROAD_KINDS as readonly string[]).includes(k);

export interface Road {
  /** highway=* */
  k: RoadKind;
  p: Line;
  /** name=* */
  n?: string;
  /** Bridge. */
  b?: 1;
  /** Tunnel. */
  u?: 1;
}

export interface Waterway {
  /** waterway=* (river, canal, stream, ditch, fairway…) */
  k: string;
  p: Line;
  n?: string;
  /** Tunnel or culvert. */
  u?: 1;
}

/** Lakes, basins, and the sea or estuary rebuilt from the coastline. */
export interface Water {
  /** Rings, outer ones first, then holes. */
  r: Ring[];
  n?: string;
}

export interface Park {
  /** leisure, landuse or natural value. */
  k: string;
  r: Ring[];
}

/** Outer ring first, then holes. */
export type Building = Ring[];

export type BBox = [south: number, west: number, north: number, east: number];

export interface MapMeta extends Place {
  /** File name in places/, without extension. */
  place: string;
  bbox: BBox;
  /** Metres from the centre to the edge of the square. */
  half: number;
  server: string;
  /** ISO date of the download. */
  fetchedAt: string;
  osmTimestamp?: string;
  attribution: string;
}

export interface MapData {
  meta: MapMeta;
  buildings: Building[];
  roads: Road[];
  waterways: Waterway[];
  water: Water[];
  parks: Park[];
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

// Checks the shape of a downloaded data file: the meta block field by field, the
// collections as arrays (their items are trusted: fetch-osm writes them with these types).
export function parseMapData(v: unknown, source: string): MapData {
  const fail = (msg: string): never => { throw new Error(`${source}: ${msg}`); };
  if (!isRecord(v)) return fail('not an object');
  const { meta, buildings, roads, waterways, water, parks } = v;
  if (!isRecord(meta)) return fail('no meta');
  for (const key of ['place', 'name', 'district', 'server', 'fetchedAt', 'attribution']) {
    if (typeof meta[key] !== 'string') fail(`meta.${key} must be a string`);
  }
  for (const key of ['lat', 'lon', 'sizeKm', 'half']) {
    if (typeof meta[key] !== 'number') fail(`meta.${key} must be a number`);
  }
  if (!Array.isArray(meta['bbox']) || meta['bbox'].length !== 4) fail('meta.bbox must hold 4 numbers');
  for (const [key, list] of Object.entries({ buildings, roads, waterways, water, parks })) {
    if (!Array.isArray(list)) fail(`${key} must be an array`);
  }
  // Every field is checked above.
  return v as unknown as MapData;
}
