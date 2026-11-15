// A place to map (places/<place>.ts): what fetch-osm downloads and the pages display.
// Runs in the browser and in Node (vite.config.ts, scripts/): no DOM, no Node API.

export interface Place {
  /** Displayed name, usually the city. */
  name: string;
  /** Displayed district. */
  district: string;
  /** Centre of the square, WGS84 degrees. */
  lat: number;
  lon: number;
  /** Side of the downloaded square, km. */
  sizeKm: number;
}

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Map and place ids: file names of places/ and page paths. */
export const isSlug = (s: string): boolean => /^[a-z0-9-]+$/.test(s);

/** 52.3731°N; `digits` decimals. */
export const formatLat = (v: number, digits: number): string => `${Math.abs(v).toFixed(digits)}°${v >= 0 ? 'N' : 'S'}`;
/** 4.8922°E; `west` is the letter for west (O in French text). */
export const formatLon = (v: number, digits: number, west = 'W'): string => `${Math.abs(v).toFixed(digits)}°${v >= 0 ? 'E' : west}`;

// Checks a place module's default export loaded at run time (dynamic import is untyped).
export function parsePlace(v: unknown, source: string): Place {
  if (!isRecord(v)) throw new Error(`${source}: default export is not an object`);
  const { name, district, lat, lon, sizeKm } = v;
  if (typeof name !== 'string' || typeof district !== 'string') throw new Error(`${source}: name and district must be strings`);
  if (typeof lat !== 'number' || Math.abs(lat) > 90) throw new Error(`${source}: lat must be a number in [-90, 90]`);
  if (typeof lon !== 'number' || Math.abs(lon) > 180) throw new Error(`${source}: lon must be a number in [-180, 180]`);
  if (typeof sizeKm !== 'number' || !(sizeKm > 0)) throw new Error(`${source}: sizeKm must be a positive number`);
  return { name, district, lat, lon, sizeKm };
}
