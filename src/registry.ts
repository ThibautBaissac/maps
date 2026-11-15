// The maps of the site. Each map is a place (places/<place>.ts, data in
// public/data/<place>.json) drawn in a style (src/styles/). One page per entry is
// generated at build time, at cartes/<id>/.
import type { StyleKey, StyleOptions } from './styles/index.ts';

export interface MapEntryOf<K extends StyleKey> {
  /** URL slug, unique, [a-z0-9-]. */
  id: string;
  /** File name in places/, without .ts. */
  place: string;
  /** Key of src/styles/index.ts. */
  style: K;
  /** Defaults to the place name. */
  title?: string;
  /** Style settings (see the style's defaults.ts). */
  options?: Partial<StyleOptions[K]>;
}

/** A map entry, its options checked against its style. */
export type MapEntry = { [K in StyleKey]: MapEntryOf<K> }[StyleKey];

export const MAPS: readonly MapEntry[] = [
  { id: 'amsterdam-riso', place: 'amsterdam-centre', style: 'riso' },
  { id: 'lisbonne-cyanotype', place: 'lisbonne-alfama', style: 'cyanotype' },
];
