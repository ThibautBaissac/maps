// The local projection and the surveyed square, shared by the converters that write map data
// (scripts/osm.ts for OpenStreetMap, scripts/geojson.ts for GeoJSON layers).
// Local metres: x east, y north, origin at the place centre, 0.1 m precision.
// Runs in the browser and in Node: no DOM, no Node API.
import type { BBox, Square } from './layers.ts';
import type { Point } from './toolkit/geometry.ts';

const R = 6371008.8;
const toRad = (d: number): number => (d * Math.PI) / 180;

/** Rounds to the 0.1 m precision of the data files. */
export const r1 = (v: number): number => Math.round(v * 10) / 10;

/** The surveyed square: metres from the centre to its edge, and its bounds in degrees. */
export function survey(place: Square): { half: number; bbox: BBox } {
  const half = (place.sizeKm * 1000) / 2;
  const dLat = (half / R) * (180 / Math.PI);
  const dLon = dLat / Math.cos(toRad(place.lat));
  return { half, bbox: [place.lat - dLat, place.lon - dLon, place.lat + dLat, place.lon + dLon] };
}

/** Local equirectangular projection of a place: (lat, lon) to local metres. */
export function localProjection(place: Square): (lat: number, lon: number) => Point {
  const kx = R * toRad(1) * Math.cos(toRad(place.lat));
  const ky = R * toRad(1);
  return (lat, lon) => [r1((lon - place.lon) * kx), r1((lat - place.lat) * ky)];
}
