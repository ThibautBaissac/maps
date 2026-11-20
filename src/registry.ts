// The maps of the site. Each map is a place of places/index.ts drawn in a style
// (src/styles/). src/catalogue.ts resolves each entry (title, place, style, paths);
// vite.config.ts generates one page per entry at build time.
import type { PlaceId } from '../places/index.ts';
import type { StyleKey, StyleOptions } from './styles/index.ts';
import type { LocalizedText } from './i18n/index.ts';
import type { TopicId } from './topics/index.ts';

export interface MapEntryOf<K extends StyleKey> {
  /** URL slug, unique, [a-z0-9-]. */
  id: string;
  /** Key of places/index.ts. */
  place: PlaceId;
  /** Key of src/styles/index.ts. */
  style: K;
  /** Subject explicitly approved by the author before the map is made. */
  topic: TopicId;
  /** Defaults to the place name. */
  title?: LocalizedText;
  /** Ids of the external layers of the place (places/layers.ts) drawn over the map. */
  layers?: readonly string[];
  /** Style settings (see the style's defaults.ts). */
  options?: Partial<StyleOptions[K]>;
}

/** A map entry, its options checked against its style. */
export type MapEntry = { [K in StyleKey]: MapEntryOf<K> }[StyleKey];

export const MAPS = [
  { id: 'amsterdam-riso', place: 'amsterdam-centre', style: 'riso', topic: 'canal-crossings' },
  { id: 'lisbonne-cyanotype', place: 'lisbonne-alfama', style: 'cyanotype', topic: 'steps', layers: ['chafarizes'], options: { layerRadius: 6, layerWidth: 2 } },
  { id: 'londres-gravure-sepia', place: 'londres-soho', style: 'gravure-sepia', topic: 'cholera-pump', layers: ['pompes', 'deces', 'reperes'] },
  { id: 'new-york-art-deco', place: 'new-york-midtown', style: 'art-deco', topic: 'setbacks' },
  { id: 'france-dossier', place: 'france', style: 'dossier', topic: 'investigations', layers: ['departements', 'fleuves', 'villes', 'enquetes'] },
] as const satisfies readonly MapEntry[];

/** Id of a registered map: the dictionaries hold its question and intro under this key. */
export type MapId = (typeof MAPS)[number]['id'];
