// What a map page tells its style and its description about the map: the place from the
// catalogue, the download date and the credit from the OpenStreetMap layer file.
// Runs in the browser and in Node: no DOM, no Node API.
import { survey as surveyOf } from './geo.ts';
import type { LayerFile, Survey } from './layers.ts';
import type { Place } from './place.ts';
import type { PlaceId } from '../places/index.ts';
import type { MountMeta } from './styles/contract.ts';

export function mountMetaOf(map: { title: string; placeId: PlaceId; place: Place }, osm: LayerFile): { survey: Survey; meta: MountMeta } {
  const { place } = map;
  const { half, bbox } = surveyOf(place);
  const survey: Survey = { half, lat: place.lat, lon: place.lon, sizeKm: place.sizeKm, fetchedAt: osm.fetchedAt ?? '' };
  const meta: MountMeta = { ...survey, title: map.title, district: place.district, place: map.placeId, bbox, attribution: osm.layers[0]?.attribution ?? '' };
  return { survey, meta };
}
