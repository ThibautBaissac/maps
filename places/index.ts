// The places to map, by id: the id names the data file (public/data/<id>/osm.json) and is
// what src/registry.ts entries point to. Runs in the browser and in Node.
// Add one with .claude/skills/new-map/scripts/new-place.ts, then download its data
// with npm run fetch-data -- <id>.
import type { Place } from '../src/place.ts';

export const PLACES = {
  // npm run fetch-data -- amsterdam-centre
  'amsterdam-centre': {
    name: 'Amsterdam',
    district: 'Centre historique',
    lat: 52.3712,
    lon: 4.8936,
    sizeKm: 2,
  },
  // npm run fetch-data -- lisbonne-alfama
  // Located from: Alfama, Santa Maria Maior, Madalena, Lisbonne, 1100-095, Portugal
  'lisbonne-alfama': {
    name: 'Lisbonne',
    district: 'Alfama',
    lat: 38.7118,
    lon: -9.1284,
    sizeKm: 2,
  },
  // npm run fetch-data -- londres-soho
  // Located from: coordinates given
  'londres-soho': {
    name: 'Londres',
    district: 'Soho',
    lat: 51.5132,
    lon: -0.1367,
    sizeKm: 1.2,
  },
  // npm run fetch-data -- new-york-midtown
  // Located from: coordinates given
  'new-york-midtown': {
    name: 'New York',
    district: 'Midtown',
    lat: 40.753,
    lon: -73.981,
    sizeKm: 1.6,
  },
  // No OpenStreetMap file: the base map is the external layers of places/layers.ts, built with
  // npm run layers -- france. The square covers metropolitan France and Corsica.
  france: {
    name: 'France',
    district: 'Métropole',
    lat: 46.2,
    lon: 2.2,
    sizeKm: 1180,
    basemap: { date: '2026-11-18' },
  },
} as const satisfies Record<string, Place>;

export type PlaceId = keyof typeof PLACES;

export const isPlaceId = (id: string): id is PlaceId => Object.hasOwn(PLACES, id);

/** Where a place's downloaded data lives, relative to the site root (public/ on disk). */
export const dataPath = (id: PlaceId): string => `data/${id}/osm.json`;

/** The base map of a place drawn from its external layers only, without OpenStreetMap data. */
export const basemapOf = (id: PlaceId): { date: string } | undefined => {
  const place: Place = PLACES[id];
  return place.basemap;
};
