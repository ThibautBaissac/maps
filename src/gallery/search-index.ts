// The documents of the gallery search, worked out at build time from the catalogue and
// embedded in each gallery page. Runs in Node and the browser.
import type { CatalogueMap } from '../catalogue.ts';
import { mapStory, messages, type Locale } from '../i18n/index.ts';
import { themesOf } from '../topics/index.ts';
import type { SearchDocument } from './search.ts';

export function searchDocuments(maps: readonly CatalogueMap[], locale: Locale): SearchDocument[] {
  const text = messages(locale);
  return maps.map((map) => ({
    id: map.id,
    title: map.title,
    place: map.place.name,
    district: map.place.district,
    style: map.styleDef.label,
    question: mapStory(locale, map.id)?.question ?? '',
    themes: themesOf(map.topic).map((theme) => text.themes[theme]).join(' '),
  }));
}
