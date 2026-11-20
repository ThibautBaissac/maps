// The subjects a map can explain, by id. Each subject is a folder src/topics/<id>/ whose
// index.ts exports its code and its texts (TopicModule, ./types.ts). Only the ids and the
// gallery themes are here: a map page loads its own subject's module, and Node loads them
// all through ./all.ts. Nothing here depends on the browser.
import type { Locale, MapStory } from '../i18n/index.ts';
import type { Survey } from '../layers.ts';
import type { ThemeId, TopicContent, TopicDef, TopicModule } from './types.ts';

export { THEME_IDS, type ThemeId, type TopicContent, type TopicFacts, type TopicMark, type TopicModule, type TopicRow } from './types.ts';

interface TopicEntry {
  /** Gallery search themes, most specific first: every map of the subject shares them. */
  themes: readonly ThemeId[];
  /** The subject's module: its own chunk, fetched by the pages of its maps only. */
  load: () => Promise<TopicModule>;
}

export const TOPICS = {
  'canal-crossings': { themes: ['water'], load: () => import('./canal-crossings/index.ts') },
  steps: { themes: ['relief'], load: () => import('./steps/index.ts') },
  'cholera-pump': { themes: ['history', 'health', 'water'], load: () => import('./cholera-pump/index.ts') },
  setbacks: { themes: ['architecture', 'history'], load: () => import('./setbacks/index.ts') },
  investigations: { themes: ['animals'], load: () => import('./investigations/index.ts') },
} as const satisfies Record<string, TopicEntry>;

export type TopicId = keyof typeof TOPICS;
export const TOPIC_IDS = Object.keys(TOPICS) as readonly TopicId[];
export const isTopicId = (value: string): value is TopicId => Object.hasOwn(TOPICS, value);

export const themesOf = (id: TopicId): readonly ThemeId[] => TOPICS[id].themes;

/** The module of one subject, typed by its id. */
export type TopicModuleOf<K extends TopicId> = Awaited<ReturnType<(typeof TOPICS)[K]['load']>>;
/** The analysis of one subject, typed by its id. */
export type TopicAnalysisOf<K extends TopicId> = ReturnType<TopicModuleOf<K>['topic']['analyse']>;
export type TopicAnalysis = TopicAnalysisOf<TopicId>;
/** The texts of one subject in one language. */
export type TopicTextOf<K extends TopicId> = TopicModuleOf<K>['messages'][Locale];

/** A loaded subject's code, typed by its id. */
export type TopicDefOf<K extends TopicId> = TopicDef<TopicAnalysisOf<K>>;

// A module's topic is a union of definitions whose analysis types differ: the one cast of
// the registry. Each analysis carries the id it is registered under (tests/topics.test.ts).
export const defOf = <K extends TopicId>(module: TopicModule): TopicDefOf<K> => module.topic as unknown as TopicDefOf<K>;

/** Fetches a subject's code and texts. */
export async function loadTopic<K extends TopicId>(id: K): Promise<TopicDefOf<K>> {
  return defOf<K>(await TOPICS[id].load());
}

/** One interpretation of the measurements for the sidebar and the text equivalent. */
export function contentOf<K extends TopicId>(def: TopicDefOf<K>, survey: Survey, topic: TopicAnalysisOf<K>, story: MapStory, locale: Locale): TopicContent {
  return { story, ...def.content(survey, topic, locale) };
}
