// Every map of src/registry.ts, resolved once: title, place, style and paths. The
// generated pages, the gallery, the map pages and the scripts all read maps from here.
// Runs in the browser and in Node: no DOM, no Node API, no import.meta.env.
import { dataPath, isPlaceId, PLACES, type PlaceId } from '../places/index.ts';
import { isRecord, isSlug, type Place } from './place.ts';
import { MAPS, type MapEntry, type MapEntryOf } from './registry.ts';
import type { StyleDef } from './styles/contract.ts';
import { isStyleKey, STYLES, type StyleKey, type StyleOptions } from './styles/index.ts';

export interface CatalogueMapOf<K extends StyleKey> {
  id: string;
  /** The registry title, or the place name. */
  title: string;
  placeId: PlaceId;
  place: Place;
  style: K;
  styleDef: StyleDef<StyleOptions[K]>;
  options: Partial<StyleOptions[K]>;
  /** Relative to the site root, no leading slash: prefix BASE_URL, or public/ on disk. */
  paths: { page: string; data: string; vignette: string };
}

/** A resolved map, its options typed by its style. */
export type CatalogueMap = { [K in StyleKey]: CatalogueMapOf<K> }[StyleKey];

/** Folder of the generated map pages, relative to the site root. */
export const PAGES_DIR = 'cartes';

function resolve<K extends StyleKey>(m: MapEntryOf<K>): CatalogueMapOf<K> {
  const place = PLACES[m.place];
  return {
    id: m.id,
    title: m.title ?? place.name,
    placeId: m.place,
    place,
    style: m.style,
    styleDef: STYLES[m.style],
    options: m.options ?? {},
    paths: { page: `${PAGES_DIR}/${m.id}/`, data: dataPath(m.place), vignette: `vignettes/${m.id}.webp` },
  };
}

// Types are stripped at run time: an entry the type-checker refuses can still get here.
const resolvable = (m: MapEntry): boolean => isPlaceId(m.place) && isStyleKey(m.style);

/** For tests: resolves any registry, leaving out entries with an unknown place or style (problemsOf reports them). */
export function catalogueOf(maps: readonly MapEntry[]): CatalogueMap[] {
  return maps.filter(resolvable).map((m) => resolve(m) as CatalogueMap);
}

export const CATALOGUE: readonly CatalogueMap[] = catalogueOf(MAPS);

export function findMap(id: string): CatalogueMap | undefined {
  return CATALOGUE.find((m) => m.id === id);
}

/** A registry entry the build cannot publish. */
export interface CatalogueProblem { id: string; message: string }

/** Fields of the place copied into the data's meta when it is downloaded. */
const PLACE_FIELDS = ['name', 'district', 'lat', 'lon', 'sizeKm'] as const;

/** For tests: checks any registry. `readData(path)` returns the parsed JSON, undefined when the file is missing, null when it cannot be parsed. */
export function problemsOf(maps: readonly MapEntry[], readData: (path: string) => unknown): CatalogueProblem[] {
  const problems: CatalogueProblem[] = [];
  const seen = new Set<string>();
  const check = (entry: MapEntry): string | null => {
    if (!isSlug(entry.id)) return `invalid id "${entry.id}" (use a-z, 0-9 and -)`;
    if (seen.has(entry.id)) return `duplicate id "${entry.id}"`;
    seen.add(entry.id);
    if (!isPlaceId(entry.place)) return `unknown place "${entry.place}" (${entry.id}); known: ${Object.keys(PLACES).join(', ')}`;
    if (!isStyleKey(entry.style)) return `unknown style "${entry.style}" (${entry.id}); known: ${Object.keys(STYLES).join(', ')}`;
    const m = resolve(entry) as CatalogueMap;
    const refetch = `npm run fetch-data -- ${m.placeId}`;
    const data = readData(m.paths.data);
    if (data === undefined) return `no data for ${m.placeId} (${m.id}); run ${refetch}`;
    const meta = isRecord(data) ? data['meta'] : undefined;
    if (!isRecord(meta)) return `${m.paths.data} is unreadable or has no meta (${m.id}); run ${refetch}`;
    for (const k of PLACE_FIELDS) {
      if (meta[k] !== m.place[k]) {
        return `data for ${m.placeId} is out of date (${m.id}): ${k} is ${JSON.stringify(m.place[k])} in places/index.ts but ${JSON.stringify(meta[k])} in the data; run ${refetch}`;
      }
    }
    return null;
  };
  for (const entry of maps) {
    const message = check(entry);
    if (message) problems.push({ id: entry.id, message });
  }
  return problems;
}

/** What stops the registry's maps from being published, one problem per map at most. */
export function catalogueProblems(readData: (path: string) => unknown): CatalogueProblem[] {
  return problemsOf(MAPS, readData);
}
