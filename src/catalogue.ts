// Every map of src/registry.ts, resolved once: title, place, style and paths. The
// generated pages, the gallery, the map pages and the scripts all read maps from here.
// Runs in the browser and in Node: no DOM, no Node API, no import.meta.env.
import { dataPath, isPlaceId, PLACES, type PlaceId } from '../places/index.ts';
import { LAYERS, layerPath } from '../places/layers.ts';
import { isSlug, type Place } from './place.ts';
import { MAPS, type MapEntry, type MapEntryOf } from './registry.ts';
import type { StyleDef } from './styles/contract.ts';
import { isStyleKey, STYLES, type StyleKey, type StyleOptions } from './styles/index.ts';
import { DEFAULT_LOCALE, LOCALES, messages, type Locale } from './i18n/index.ts';
import { parseLayerFile, type Square } from './layers.ts';
import { isTopicId, type TopicId } from './topics.ts';

export interface CatalogueMapOf<K extends StyleKey> {
  id: string;
  /** The registry title, or the place name. */
  title: string;
  placeId: PlaceId;
  place: Place;
  style: K;
  topic: TopicId;
  styleDef: StyleDef<StyleOptions[K]>;
  options: Partial<StyleOptions[K]>;
  /** The external layers of the map, in the registry order. */
  layers: readonly { id: string; title: string; path: string }[];
  /** Credits of the external layers, without duplicates, in the registry order. */
  attributions: readonly string[];
  /** Relative to the site root, no leading slash: prefix BASE_URL, or public/ on disk. */
  paths: { page: string; data: string; vignette: string };
}

/** A resolved map, its options typed by its style. */
export type CatalogueMap = { [K in StyleKey]: CatalogueMapOf<K> }[StyleKey];

/** Folder of the generated map pages, relative to the site root. */
export const PAGES_DIR = 'cartes';

type LayerRegistry = typeof LAYERS;

function resolve<K extends StyleKey>(m: MapEntryOf<K>, locale: Locale, registry: LayerRegistry): CatalogueMapOf<K> {
  const place = { ...PLACES[m.place], ...messages(locale).places[m.place] };
  // An id the place does not declare is left out: problemsOf reports it.
  const sources = (m.layers ?? []).flatMap((id) => {
    const source = Object.hasOwn(registry[m.place] ?? {}, id) ? registry[m.place]?.[id] : undefined;
    return source ? [{ id, source }] : [];
  });
  return {
    id: m.id,
    title: typeof m.title === 'string' ? m.title : m.title?.[locale] ?? place.name,
    placeId: m.place,
    place,
    style: m.style,
    topic: m.topic,
    styleDef: { ...STYLES[m.style], ...messages(locale).styles[m.style] },
    options: m.options ?? {},
    layers: sources.map(({ id, source }) => ({ id, title: typeof source.title === 'string' ? source.title : source.title[locale], path: layerPath(m.place, id) })),
    attributions: [...new Set(sources.map(({ source }) => source.attribution))],
    paths: { page: `${locale}/${PAGES_DIR}/${m.id}/`, data: dataPath(m.place), vignette: `vignettes/${locale}/${m.id}.webp` },
  };
}

// Types are stripped at run time: an entry the type-checker refuses can still get here.
const resolvable = (m: MapEntry): boolean => isPlaceId(m.place) && isStyleKey(m.style)
  && isTopicId(m.topic);

/** For tests: resolves any registry, leaving out entries with an unknown place or style (problemsOf reports them). `layers` stands for places/layers.ts. */
export function catalogueOf(maps: readonly MapEntry[], locale: Locale = DEFAULT_LOCALE, layers: LayerRegistry = LAYERS): CatalogueMap[] {
  return maps.filter(resolvable).map((m) => resolve(m, locale, layers) as CatalogueMap);
}

const catalogues = new Map(LOCALES.map((locale) => [locale, catalogueOf(MAPS, locale)]));
export const mapsForLocale = (locale: Locale): readonly CatalogueMap[] => catalogues.get(locale)!;
export const CATALOGUE = mapsForLocale(DEFAULT_LOCALE);

export function findMap(id: string, locale: Locale = DEFAULT_LOCALE): CatalogueMap | undefined {
  return mapsForLocale(locale).find((m) => m.id === id);
}

/** A registry entry the build cannot publish. */
export interface CatalogueProblem { id: string; message: string }

/** The first field of a layer file's square that differs from the place, as "<field> is <place value> in places/index.ts but <file value> in the data". */
function staleSquare(square: Square, place: Square): string | null {
  for (const k of ['lat', 'lon', 'sizeKm'] as const) {
    if (square[k] !== place[k]) return `${k} is ${JSON.stringify(place[k])} in places/index.ts but ${JSON.stringify(square[k])} in the data`;
  }
  return null;
}

/** For tests: checks any registry. `readData(path)` returns the parsed JSON, undefined when the file is missing, null when it cannot be parsed. */
export function problemsOf(maps: readonly MapEntry[], readData: (path: string) => unknown, layers: LayerRegistry = LAYERS): CatalogueProblem[] {
  const problems: CatalogueProblem[] = [];
  const seen = new Set<string>();
  const check = (entry: MapEntry): string | null => {
    if (!isSlug(entry.id)) return `invalid id "${entry.id}" (use a-z, 0-9 and -)`;
    if (seen.has(entry.id)) return `duplicate id "${entry.id}"`;
    seen.add(entry.id);
    if (!isPlaceId(entry.place)) return `unknown place "${entry.place}" (${entry.id}); known: ${Object.keys(PLACES).join(', ')}`;
    if (!isStyleKey(entry.style)) return `unknown style "${entry.style}" (${entry.id}); known: ${Object.keys(STYLES).join(', ')}`;
    if (!isTopicId(entry.topic)) return entry.topic === undefined ? `missing topic (${entry.id})` : `unknown topic "${entry.topic}" (${entry.id})`;
    const declared = layers[entry.place] ?? {};
    for (const id of Object.keys(declared)) {
      if (id === 'osm') return `layer id "osm" is reserved (${entry.place})`;
      if (!isSlug(id)) return `invalid layer id "${id}" for ${entry.place} (use a-z, 0-9 and -)`;
    }
    for (const id of entry.layers ?? []) {
      if (!Object.hasOwn(declared, id)) return `unknown layer "${id}" for ${entry.place} (${entry.id}); known: ${Object.keys(declared).join(', ')}`;
    }
    const m = resolve(entry, DEFAULT_LOCALE, layers) as CatalogueMap;
    const place = PLACES[entry.place]; // Display translations never invalidate geographic data.
    const refetch = `npm run fetch-data -- ${m.placeId}`;
    const data = readData(m.paths.data);
    if (data === undefined) return `no data for ${m.placeId} (${m.id}); run ${refetch}`;
    const osm = parseLayerFile(data, m.paths.data); // Throws a message naming the file.
    const stale = staleSquare(osm.square, place);
    if (stale) return `data for ${m.placeId} is out of date (${m.id}): ${stale}; run ${refetch}`;
    if (osm.fetchedAt === undefined) return `${m.paths.data} has no fetchedAt (${m.id}); run ${refetch}`;
    const relayer = `npm run layers -- ${m.placeId}`;
    for (const { id, path } of m.layers) {
      const file = readData(path);
      if (file === undefined) return `no data for layer "${id}" of ${m.placeId} (${m.id}); run ${relayer}`;
      const { square, layers: parsed } = parseLayerFile(file, path);
      const declared = layers[m.placeId]?.[id];
      const found = parsed[0];
      if (declared && found) {
        for (const k of ['id', 'kind', 'attribution'] as const) {
          const want = k === 'id' ? id : declared[k];
          if (found[k] !== want) return `layer "${id}" of ${m.placeId} does not match places/layers.ts (${m.id}): ${k} differs; run ${relayer}`;
        }
      }
      const layerStale = staleSquare(square, place);
      if (layerStale) return `layer "${id}" of ${m.placeId} is out of date (${m.id}): ${layerStale}; run ${relayer}`;
    }
    return null;
  };
  for (const entry of maps) {
    let message: string | null;
    try {
      message = check(entry);
    } catch (err) {
      message = err instanceof Error ? err.message : String(err); // parseLayerFile names the file.
    }
    if (message) problems.push({ id: entry.id, message });
  }
  return problems;
}

/** What stops the registry's maps from being published, one problem per map at most. */
export function catalogueProblems(readData: (path: string) => unknown): CatalogueProblem[] {
  return problemsOf(MAPS, readData);
}
