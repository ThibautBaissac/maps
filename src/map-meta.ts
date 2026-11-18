// What a map page tells its style and its description about the map: the place from the
// catalogue, the date of the data and the credit from the OpenStreetMap layer file.
// Runs in the browser and in Node: no DOM, no Node API.
import { survey as surveyOf } from './geo.ts';
import type { LayerFile, Survey } from './layers.ts';
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
