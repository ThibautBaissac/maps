// The subjects a map can explain, by id. Each subject is a folder src/topics/<id>/ whose
// index.ts exports a TopicDef (./types.ts): its themes, its analysis and its text. The
// drawing and the text share one analysis; nothing here depends on the browser.
import type { Locale, MapStory } from '../i18n/index.ts';
import type { Layer, Survey } from '../layers.ts';
import type { ThemeId, TopicContent, TopicDef } from './types.ts';
import { canalCrossings } from './canal-crossings/index.ts';
import { steps } from './steps/index.ts';
import { choleraPump } from './cholera-pump/index.ts';
import { setbacks } from './setbacks/index.ts';
import { investigations } from './investigations/index.ts';

export { THEME_IDS, type ThemeId, type TopicContent, type TopicMark, type TopicRow } from './types.ts';

export const TOPICS = {
  'canal-crossings': canalCrossings,
  steps,
  'cholera-pump': choleraPump,
  setbacks,
  investigations,
} as const;

export type TopicId = keyof typeof TOPICS;
export const TOPIC_IDS = Object.keys(TOPICS) as readonly TopicId[];
export const isTopicId = (value: string): value is TopicId => Object.hasOwn(TOPICS, value);

/** The analysis of one subject, typed by its id. */
export type TopicAnalysisOf<K extends TopicId> = ReturnType<(typeof TOPICS)[K]['analyse']>;
export type TopicAnalysis = TopicAnalysisOf<TopicId>;

// TOPICS[id] is a union of definitions whose analysis types differ: the one cast of the
// registry. Each analysis carries the id it is registered under (tests/topics.test.ts).
const defOf = <K extends TopicId>(id: K): TopicDef<TopicAnalysisOf<K>> => TOPICS[id] as unknown as TopicDef<TopicAnalysisOf<K>>;

export const themesOf = (id: TopicId): readonly ThemeId[] => TOPICS[id].themes;

/** Analyse only geometry inside the surveyed square, independently of the current zoom. */
export function analyseTopic<K extends TopicId>(survey: Pick<Survey, 'half'>, layers: readonly Layer[], id: K): TopicAnalysisOf<K> {
  return defOf(id).analyse(survey, layers);
}

/** One interpretation of the measurements for the sidebar and the text equivalent. */
export function topicContent(survey: Survey, topic: TopicAnalysis, story: MapStory, locale: Locale): TopicContent {
  return { story, ...defOf(topic.id).content(survey, topic, locale) };
}
