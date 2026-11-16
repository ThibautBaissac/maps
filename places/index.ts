// The places to map, by id: the id names the data file (public/data/<id>.json) and is
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
} as const satisfies Record<string, Place>;

export type PlaceId = keyof typeof PLACES;

export const isPlaceId = (id: string): id is PlaceId => Object.hasOwn(PLACES, id);

/** Where a place's downloaded data lives, relative to the site root (public/ on disk). */
export const dataPath = (id: PlaceId): string => `data/${id}.json`;
