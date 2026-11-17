// What the gallery shows for the selected filter. Kept apart from filters.ts so the
// gallery script does not bundle the catalogue.

/** Every map with no filter; with one, the maps that carry it. */
export const isShown = (tags: readonly string[], selected: string | null): boolean => selected === null || tags.includes(selected);

/** The ?tag= of an address search, kept only when it is one of the offered filters. */
export function parseTag(search: string, offered: readonly string[]): string | null {
  const tag = new URLSearchParams(search).get('tag');
  return tag !== null && offered.includes(tag) ? tag : null;
}
