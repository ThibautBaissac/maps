// The gallery search: MiniSearch over the documents of search-index.ts, which the
// gallery page embeds in its language. Kept apart from search-index.ts so the gallery
// script does not bundle the catalogue. Runs in Node and the browser.
import MiniSearch from 'minisearch';

/** What the search reads of a map, in the page language. */
export interface SearchDocument {
  id: string;
  title: string;
  place: string;
  district: string;
  style: string;
  question: string;
  /** The labels of the subject's themes, space-separated. */
  themes: string;
}

const FIELDS = ['title', 'place', 'district', 'style', 'question', 'themes'] as const satisfies readonly (keyof SearchDocument)[];

/** Lower case without accents: "Choléra" and "cholera" are the same word. */
const fold = (term: string): string => term.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** The ids of the maps a query keeps, or null for a blank query (every map). */
export type Search = (query: string) => ReadonlySet<string> | null;

export function createSearch(documents: readonly SearchDocument[]): Search {
  const index = new MiniSearch<SearchDocument>({
    fields: [...FIELDS],
    processTerm: fold,
    searchOptions: {
      // Every word must match; the last one may still be typed; a short slip is forgiven.
      combineWith: 'AND',
      prefix: true,
      fuzzy: (term) => (term.length > 4 ? 0.2 : false),
      boost: { title: 3, place: 2, district: 2 },
    },
  });
  index.addAll(documents);
  return (query) => {
    if (!query.trim()) return null;
    return new Set(index.search(query).map((result) => String(result.id)));
  };
}

/** The ?q= of an address search, trimmed; empty when absent. */
export const parseQuery = (search: string): string => (new URLSearchParams(search).get('q') ?? '').trim();
