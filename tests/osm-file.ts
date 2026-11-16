// The committed OpenStreetMap layer files (public/data/<place>/osm.json), as the tests read them.
import { readFileSync } from 'node:fs';
import type { MapMeta } from '../src/data.ts';
import { survey } from '../src/geo.ts';
import { parseLayerFile, type Layer, type Survey } from '../src/layers.ts';
import type { MountMeta } from '../src/styles/contract.ts';
import { PLACES, type PlaceId } from '../places/index.ts';

export function readOsm(id: PlaceId) {
  const file = parseLayerFile(JSON.parse(readFileSync(new URL(`../public/data/${id}/osm.json`, import.meta.url), 'utf8')), `${id}/osm.json`);
  const fetchedAt = file.fetchedAt ?? '';
  const { half, bbox } = survey(file.square);
  const attribution = file.layers[0]?.attribution ?? '';
  const surveyed: Survey = { half, ...file.square, fetchedAt };
  const place = PLACES[id];
  /** What a style prints about the map, as src/map-page.ts builds it. */
  const mountMeta = (title: string): MountMeta => ({ title, district: place.district, place: id, ...file.square, half, bbox, fetchedAt, attribution });
  /** The meta block of the former MapData, for the fixtures that still build one. */
  const mapMeta: MapMeta = { ...place, place: id, ...file.square, half, bbox, server: file.server ?? '', fetchedAt, attribution };
  return { file, layers: file.layers as Layer[], place, survey: surveyed, mountMeta, mapMeta };
}
