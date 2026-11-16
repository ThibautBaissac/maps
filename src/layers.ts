// Map layers: the format of the files in public/data/<place>/ that hold the objects a map
// draws, in local metres (x east, y north, origin at the place centre, 0.1 m). A layer is
// one kind of geometry with its attribution; scripts/geojson.ts writes them from GeoJSON.
// Unlike parseMapData, every object is checked: layer sources are versioned and may be
// edited by hand.
// Runs in the browser and in Node: no DOM, no Node API.
import type { LocalizedText } from './i18n/index.ts';
import type { Line, Ring } from './data.ts';
import { isRecord, isSlug } from './place.ts';
import type { Point } from './toolkit/geometry.ts';

export const LAYER_KINDS = ['points', 'lines', 'areas'] as const;
export type LayerKind = (typeof LAYER_KINDS)[number];
/** What a layer is for: an overlay is drawn on top of the base map. */
export const LAYER_ROLES = ['overlay'] as const;
export type LayerRole = (typeof LAYER_ROLES)[number];

/** The geometry of one object: a point, a flat polyline, or rings (outer one first, then holes). */
export type Geometry<K extends LayerKind> = K extends 'points' ? Point : K extends 'lines' ? Line : Ring[];
export type Scalar = string | number | boolean;

export interface Feature<G> {
  g: G;
  /** Category. */
  k?: string;
  /** Name. */
  n?: string;
  /** Other properties. */
  p?: Readonly<Record<string, Scalar>>;
}

export interface LayerOf<K extends LayerKind> {
  /** Slug; "osm" is reserved. */
  id: string;
  kind: K;
  role: LayerRole;
  /** Credit displayed on the map page. */
  attribution: string;
  /** Where the data comes from, relative to the repository root. */
  source: string;
  features: Feature<Geometry<K>>[];
}
export type Layer = LayerOf<'points'> | LayerOf<'lines'> | LayerOf<'areas'>;

/** The square a layer file covers, as for a Place. */
export interface Square {
  lat: number;
  lon: number;
  sizeKm: number;
}

/** Format of a layer file. */
export interface LayerFile {
  square: Square;
  layers: Layer[];
  /** ISO date of the download (OSM layers). */
  fetchedAt?: string;
  server?: string;
  osmTimestamp?: string;
}

/** The declaration of an external layer in places/layers.ts. */
export interface LayerSource {
  title: LocalizedText;
  /** GeoJSON file, relative to the repository root. */
  file: string;
  kind: LayerKind;
  role: LayerRole;
  attribution: string;
  /** Property holding the name of an object. */
  nameField?: string;
  /** Property holding the category of an object. */
  categoryField?: string;
}

const isKind = (v: unknown): v is LayerKind => (LAYER_KINDS as readonly unknown[]).includes(v);
const isRole = (v: unknown): v is LayerRole => (LAYER_ROLES as readonly unknown[]).includes(v);
export const isScalar = (v: unknown): v is Scalar => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';

/** A flat array of at least `min` [x, y] pairs, as a polyline or a ring. */
const isFlat = (v: unknown, min: number): v is number[] => Array.isArray(v) && v.length % 2 === 0 && v.length >= min * 2;

export function parseLayer(v: unknown, source: string): Layer {
  const fail = (msg: string): never => { throw new Error(`${source}: ${msg}`); };
  if (!isRecord(v)) return fail('layer is not an object');
  const { id, kind, role, attribution, features } = v;
  if (typeof id !== 'string' || !isSlug(id)) return fail(`invalid id "${String(id)}" (use a-z, 0-9 and -)`);
  if (!isKind(kind)) return fail('kind must be points, lines or areas');
  if (!isRole(role)) return fail('role must be overlay');
  if (typeof attribution !== 'string' || !attribution.trim()) return fail('attribution must be a non-empty string');
  if (typeof v['source'] !== 'string') return fail('source must be a string');
  if (!Array.isArray(features)) return fail('features must be an array');
  features.forEach((feature: unknown, i) => {
    const at = (msg: string): never => fail(`feature ${i}: ${msg}`);
    if (!isRecord(feature)) return at('not an object');
    const { g, k, n, p } = feature;
    if (kind === 'points') {
      if (!isFlat(g, 1) || g.length !== 2) return at('points need [x, y]');
    } else if (kind === 'lines') {
      if (!isFlat(g, 2)) return at('lines need at least two [x, y] pairs');
    } else if (!Array.isArray(g) || !g.length || !g.every((ring: unknown) => isFlat(ring, 3))) {
      return at('areas need rings of at least three [x, y] pairs');
    }
    const coordinates: unknown[] = kind === 'areas' ? (g as unknown[][]).flat() : (g as unknown[]);
    if (!coordinates.every((c) => typeof c === 'number' && Number.isFinite(c))) return at('coordinates must be finite numbers');
    if (k !== undefined && typeof k !== 'string') return at('k must be a string');
    if (n !== undefined && typeof n !== 'string') return at('n must be a string');
    if (p !== undefined && (!isRecord(p) || !Object.values(p).every(isScalar))) return at('p values must be strings, numbers or booleans');
  });
  // Every field and every object is checked above.
  return v as unknown as Layer;
}

export function parseLayerFile(v: unknown, source: string): LayerFile {
  const fail = (msg: string): never => { throw new Error(`${source}: ${msg}`); };
  if (!isRecord(v)) return fail('not an object');
  const { square, layers } = v;
  if (!isRecord(square) || !['lat', 'lon', 'sizeKm'].every((key) => typeof square[key] === 'number')) {
    return fail('square must hold lat, lon and sizeKm numbers');
  }
  if (!Array.isArray(layers)) return fail('layers must be an array');
  for (const key of ['fetchedAt', 'server', 'osmTimestamp']) {
    if (v[key] !== undefined && typeof v[key] !== 'string') fail(`${key} must be a string`);
  }
  const seen = new Set<string>();
  layers.forEach((layer: unknown, i) => {
    const parsed = parseLayer(layer, `${source}: layer ${i}`);
    if (seen.has(parsed.id)) fail(`duplicate layer "${parsed.id}"`);
    seen.add(parsed.id);
  });
  // Every field is checked above.
  return v as unknown as LayerFile;
}

/** The objects of the layers of a role and kind, in the order of the layers. */
export function featuresOf<K extends LayerKind>(layers: readonly Layer[], role: LayerRole, kind: K): Feature<Geometry<K>>[] {
  return layers.flatMap((layer) => (layer.role === role && layer.kind === kind ? (layer.features as Feature<Geometry<K>>[]) : []));
}
