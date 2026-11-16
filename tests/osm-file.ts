// The committed OpenStreetMap layer files (public/data/<place>/osm.json), as the tests read them.
import { readFileSync } from 'node:fs';
import { parseLayerFile, type Feature, type Layer, type Line, type Ring } from '../src/layers.ts';
import { mountMetaOf } from '../src/map-meta.ts';
import type { MountMeta } from '../src/styles/contract.ts';
import { PLACES, type PlaceId } from '../places/index.ts';

export function readOsm(id: PlaceId) {
  const file = parseLayerFile(JSON.parse(readFileSync(new URL(`../public/data/${id}/osm.json`, import.meta.url), 'utf8')), `${id}/osm.json`);
  const place = PLACES[id];
  /** What a style prints about the map, as src/map-page.ts builds it. */
  const mountMeta = (title: string): MountMeta => mountMetaOf({ title, placeId: id, place }, file).meta;
  return { file, layers: file.layers as Layer[], place, survey: mountMetaOf({ title: '', placeId: id, place }, file).survey, mountMeta };
}

/** The five OpenStreetMap layers, in the order the styles draw them, from the objects a test needs. */
export function osmLayersOf(parts: {
  buildings?: Feature<Ring[]>[];
  roads?: Feature<Line>[];
  waterways?: Feature<Line>[];
  water?: Feature<Ring[]>[];
  parks?: Feature<Ring[]>[];
}): Layer[] {
  const base = { source: 'openstreetmap', attribution: '© contributeurs OpenStreetMap (ODbL)' } as const;
  return [
    { ...base, id: 'buildings', role: 'buildings', kind: 'areas', features: parts.buildings ?? [] },
    { ...base, id: 'roads', role: 'roads', kind: 'lines', features: parts.roads ?? [] },
    { ...base, id: 'waterways', role: 'waterways', kind: 'lines', features: parts.waterways ?? [] },
    { ...base, id: 'water', role: 'water', kind: 'areas', features: parts.water ?? [] },
    { ...base, id: 'parks', role: 'parks', kind: 'areas', features: parts.parks ?? [] },
  ];
}
