// The external layers of each place, by place id then layer id: GeoJSON files kept in
// layers/<place>/<id>.geojson and converted by npm run layers -- <place-id> into
// public/data/<place>/<id>.json. The id "osm" is reserved. Runs in the browser and in Node.
import type { LayerSource } from '../src/layers.ts';
import type { PlaceId } from './index.ts';

export const LAYERS: { readonly [P in PlaceId]?: Readonly<Record<string, LayerSource>> } = {};

/** Where a layer file lives, relative to the site root (public/ on disk). */
export const layerPath = (place: PlaceId, id: string): string => `data/${place}/${id}.json`;
