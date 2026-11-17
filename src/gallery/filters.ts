// The gallery filters, worked out at build time from the catalogue: a map is tagged
// with its place, its style and the themes of its subject. Runs in Node and the browser.
import type { CatalogueMap } from '../catalogue.ts';
import { messages, type Locale } from '../i18n/index.ts';
import { TOPIC_THEMES } from '../topics.ts';

export const FACETS = ['place', 'style', 'theme'] as const;
export type Facet = (typeof FACETS)[number];

export interface GalleryFilter {
  /** `<facet>:<value>`, as found in the strips' data-tags and in ?tag=. */
  tag: string;
  label: string;
  /** Number of maps the filter keeps. */
  count: number;
}

export interface GalleryFacet {
  facet: Facet;
  label: string;
  filters: GalleryFilter[];
}

/** The tags of a map: its place, its style, then the themes of its subject. */
export function mapTags(map: CatalogueMap): string[] {
  return [`place:${map.placeId}`, `style:${map.style}`, ...TOPIC_THEMES[map.topic].map((theme) => `theme:${theme}`)];
}

/** The filters worth offering, by facet in a fixed order: each keeps at least one map but not all of them. */
export function galleryFilters(maps: readonly CatalogueMap[], locale: Locale): GalleryFacet[] {
  const text = messages(locale);
  const found = new Map<string, GalleryFilter>();
  for (const map of maps) {
    const labels: Record<string, string> = {
      [`place:${map.placeId}`]: map.place.name,
      [`style:${map.style}`]: map.styleDef.label,
      ...Object.fromEntries(TOPIC_THEMES[map.topic].map((theme) => [`theme:${theme}`, text.themes[theme]])),
    };
    for (const tag of mapTags(map)) {
      const filter = found.get(tag);
      if (filter) filter.count += 1;
      else found.set(tag, { tag, label: labels[tag] ?? tag, count: 1 });
    }
  }
  return FACETS.map((facet) => ({
    facet,
    label: text.gallery.facets[facet],
    filters: [...found.values()].filter((f) => f.tag.startsWith(`${facet}:`) && f.count < maps.length),
  })).filter((f) => f.filters.length > 0);
}
