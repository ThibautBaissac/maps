// The question and intro of every map, by id: src/i18n/maps/<map-id>.ts. Build time only:
// scripts/pages.ts writes each page's own story into it, so a map page loads no other.
import type { MapId } from '../registry.ts';
import { compareTranslations } from './index.ts';
import type { Locale, MapStories, MapStory } from './types.ts';
import { STORY as amsterdamRiso } from './maps/amsterdam-riso.ts';
import { STORY as lisbonneCyanotype } from './maps/lisbonne-cyanotype.ts';
import { STORY as londresGravureSepia } from './maps/londres-gravure-sepia.ts';
import { STORY as newYorkArtDeco } from './maps/new-york-art-deco.ts';
import { STORY as franceDossier } from './maps/france-dossier.ts';

const STORIES: Record<MapId, MapStories> = {
  'amsterdam-riso': amsterdamRiso,
  'lisbonne-cyanotype': lisbonneCyanotype,
  'londres-gravure-sepia': londresGravureSepia,
  'new-york-art-deco': newYorkArtDeco,
  'france-dossier': franceDossier,
};

/** The question and intro of a registered map; undefined for an id the registry does not know. */
export function mapStory(locale: Locale, id: string): MapStory | undefined {
  return Object.hasOwn(STORIES, id) ? STORIES[id as MapId][locale] : undefined;
}

/** Missing or empty stories, against French, as "<locale>.maps.<id>.<field>". `stories` stands for every map's stories. */
export function storyProblems(stories: Record<string, unknown> = STORIES): string[] {
  return Object.entries(STORIES).flatMap(([id, story]) => compareTranslations(story.fr, stories[id], (locale) => `${locale}.maps.${id}`));
}
