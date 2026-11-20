// What a map page tells its style and its description about the map: the place from the
// catalogue, the date of the data and the credit from the OpenStreetMap layer file.
// Runs in the browser and in Node: no DOM, no Node API.
import { survey as surveyOf } from './geo.ts';
import { parseLayerFile, type Layer, type LayerFile, type Survey } from './layers.ts';
import type { CatalogueMap } from './catalogue.ts';
import type { Place } from './place.ts';
import type { PlaceId } from '../places/index.ts';
import type { MountMeta } from './styles/contract.ts';

// A place drawn from its own base layers (Place.basemap) has no OSM file: its date is the
// basemap's and the credits are the layers' own.
export function mountMetaOf(map: { title: string; placeId: PlaceId; place: Place }, osm: LayerFile | null): { survey: Survey; meta: MountMeta } {
  const { place } = map;
  const { half, bbox } = surveyOf(place);
  const date = osm ? osm.osmTimestamp ?? osm.fetchedAt ?? '' : place.basemap?.date ?? '';
  const survey: Survey = { half, lat: place.lat, lon: place.lon, sizeKm: place.sizeKm, osmDate: date };
  const meta: MountMeta = { ...survey, title: map.title, district: place.district, place: map.placeId, bbox, attribution: osm?.layers[0]?.attribution ?? '' };
  return { survey, meta };
}

/** What a map page draws and describes, read from its files. */
export interface MapData {
  /** The OpenStreetMap layer file; null for a place drawn from its own base layers. */
  osm: LayerFile | null;
  /** The OSM file's layers, then each external layer file's, in the registry order. */
  layers: Layer[];
  /** The external layers, titled, for the text description. */
  overlays: { title: string; layer: Layer }[];
  survey: Survey;
  meta: MountMeta;
}

/** Reads a map's layer files with `read(path)` (a path under public/, as in map.paths) and assembles them: the page fetches, the tests read the disk. */
export async function loadMapData(map: Pick<CatalogueMap, 'paths' | 'layers' | 'title' | 'placeId' | 'place'>, read: (path: string) => Promise<unknown>): Promise<MapData> {
  const dataPath = map.paths.data;
  const [osm, layerSets] = await Promise.all([
    dataPath === null ? null : read(dataPath).then((json) => parseLayerFile(json, dataPath)),
    Promise.all(map.layers.map(async ({ id, path }) => ({ id, layers: parseLayerFile(await read(path), path).layers }))),
  ]);
  const layers: Layer[] = [...osm?.layers ?? [], ...layerSets.flatMap((set) => set.layers)];
  const overlays = layerSets.flatMap((set, i) => set.layers.map((layer) => ({ title: map.layers[i]?.title ?? set.id, layer })));
  return { osm, layers, overlays, ...mountMetaOf(map, osm) };
}
