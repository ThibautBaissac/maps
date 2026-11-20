// Every subject's module, loaded at once: for Node (the page generation, the build checks)
// and the tests. A map page never imports this file: it loads its own subject (./index.ts).
import { compareTranslations, type Locale, type MapStory } from '../i18n/index.ts';
import type { Layer, Survey } from '../layers.ts';
import { addTopic, contentOf, defOf, TOPIC_IDS, type TopicAnalysis, type TopicAnalysisOf, type TopicId, type TopicModuleOf, type TopicTextOf } from './index.ts';
import type { TopicContent } from './types.ts';
import * as canalCrossings from './canal-crossings/index.ts';
import * as steps from './steps/index.ts';
import * as choleraPump from './cholera-pump/index.ts';
import * as setbacks from './setbacks/index.ts';
import * as investigations from './investigations/index.ts';

export * from './index.ts';

const MODULES: { [K in TopicId]: TopicModuleOf<K> } = {
  'canal-crossings': canalCrossings,
  steps,
  'cholera-pump': choleraPump,
  setbacks,
  investigations,
};
for (const id of TOPIC_IDS) addTopic(id, MODULES[id]);

/** Analyse only geometry inside the surveyed square, independently of the current zoom. */
export function analyseTopic<K extends TopicId>(survey: Pick<Survey, 'half'>, layers: readonly Layer[], id: K): TopicAnalysisOf<K> {
  return defOf<K>(MODULES[id]).analyse(survey, layers);
}

/** One interpretation of the measurements for the sidebar and the text equivalent. */
export function topicContent(survey: Survey, topic: TopicAnalysis, story: MapStory, locale: Locale): TopicContent {
  return contentOf(defOf(MODULES[topic.id]), survey, topic, story, locale);
}

/** A subject's texts in one language. */
export const topicText = <K extends TopicId>(locale: Locale, id: K): TopicTextOf<K> => MODULES[id].messages[locale];

/** Missing or empty texts of the subjects, against French, as "<locale>.topics.<id>.<path>". `texts` stands for every subject's texts by language. */
export function topicTranslationProblems(texts: Record<TopicId, unknown> = Object.fromEntries(TOPIC_IDS.map((id) => [id, MODULES[id].messages])) as Record<TopicId, unknown>): string[] {
  return TOPIC_IDS.flatMap((id) => compareTranslations(MODULES[id].messages.fr, texts[id], (locale) => `${locale}.topics.${id}`));
}
