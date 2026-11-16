// GeoJSON → Layer: converts a FeatureCollection to the local metres of a place and keeps
// what touches its square. Pure: no file, no process, no console.
// scripts/build-layers.ts reads the source files and writes the layer files.
import { localProjection, survey } from '../src/geo.ts';
import { parseLayer, type Feature, type Layer, type LayerKind, type LayerSource, type Scalar } from '../src/layers.ts';
import { isRecord, type Place } from '../src/place.ts';
import type { Point } from '../src/toolkit/geometry.ts';

// The geometry of one GeoJSON feature, as local points, flat lines or rings.
type Part = Point | number[] | number[][];

// GeoJSON geometry types by layer kind: the single one, then its multi version.
const GEOMETRIES: Record<LayerKind, readonly [string, string]> = {
  points: ['Point', 'MultiPoint'],
  lines: ['LineString', 'MultiLineString'],
  areas: ['Polygon', 'MultiPolygon'],
};

const isScalar = (v: unknown): v is Scalar => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
const text = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

export function geojsonLayer(json: unknown, place: Place, id: string, spec: LayerSource): Layer {
  if (!isRecord(json) || json['type'] !== 'FeatureCollection' || !Array.isArray(json['features'])) {
    throw new Error('not a GeoJSON FeatureCollection');
  }
  const toLocal = localProjection(place);
  const half = survey(place).half;

  const features = json['features'].flatMap((item: unknown, i): Feature<Part>[] => {
    const at = (msg: string): never => { throw new Error(`feature ${i}: ${msg}`); };
    if (!isRecord(item)) return at('not a feature');
    const geometry = item['geometry'];
    if (!isRecord(geometry)) return at('no geometry');
    const type = String(geometry['type']);
    const [single, multi] = GEOMETRIES[spec.kind];
    if (type !== single && type !== multi) return at(`${type} in a ${spec.kind} layer`);

    // [lon, lat] to local [x, y].
    const position = (v: unknown): Point => {
      const [lon, lat] = Array.isArray(v) ? v : [];
      if (typeof lon !== 'number' || typeof lat !== 'number') return at('invalid position');
      return toLocal(lat, lon);
    };
    const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : at('invalid coordinates'));
    const line = (v: unknown): number[] => list(v).flatMap(position);
    const polygon = (v: unknown): number[][] => list(v).map(line);
    const coordinates = geometry['coordinates'];
    const parts: Part[] =
      spec.kind === 'points' ? (type === single ? [position(coordinates)] : list(coordinates).map(position))
      : spec.kind === 'lines' ? (type === single ? [line(coordinates)] : list(coordinates).map(line))
      : type === single ? [polygon(coordinates)] : list(coordinates).map(polygon);

    const properties = isRecord(item['properties']) ? item['properties'] : {};
    const n = spec.nameField === undefined ? undefined : text(properties[spec.nameField]);
    const k = spec.categoryField === undefined ? undefined : text(properties[spec.categoryField]);
    const p: Record<string, Scalar> = {};
    for (const [key, v] of Object.entries(properties)) {
      if (key !== spec.nameField && key !== spec.categoryField && isScalar(v)) p[key] = v;
    }
    const rest = {
      ...(k === undefined ? {} : { k }),
      ...(n === undefined ? {} : { n }),
      ...(Object.keys(p).length ? { p } : {}),
    };
    return parts.filter((part) => touchesSquare(part, half)).map((g) => ({ g, ...rest }));
  });

  // The layer's own validation turns degenerate geometries into errors.
  return parseLayer({
    id,
    kind: spec.kind,
    role: spec.role,
    attribution: spec.attribution,
    source: spec.file,
    features,
  }, spec.file);
}

// Whether the bounding box of a geometry meets the square [-half, half]²: lines and areas
// leaving the square are kept whole, those entirely outside are dropped.
function touchesSquare(part: Part, half: number): boolean {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const flat of Array.isArray(part[0]) ? (part as number[][]) : [part as number[]]) {
    for (let i = 0; i + 1 < flat.length; i += 2) xs.push(flat[i]!), ys.push(flat[i + 1]!);
  }
  return Math.min(...xs) <= half && Math.max(...xs) >= -half && Math.min(...ys) <= half && Math.max(...ys) >= -half;
}
