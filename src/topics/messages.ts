// The texts of every subject, by id and language. Pure data, read by src/i18n/index.ts to
// complete each language's dictionary under topics.<id>: a subject's folder holds its
// analysis, its definition and its texts together.
import type { Locale } from '../i18n/types.ts';
import type { TopicId } from './index.ts';
import type { TopicFacts } from './types.ts';
import { MESSAGES as canalCrossings } from './canal-crossings/messages.ts';
import { MESSAGES as steps } from './steps/messages.ts';
import { MESSAGES as choleraPump } from './cholera-pump/messages.ts';
import { MESSAGES as setbacks } from './setbacks/messages.ts';
import { MESSAGES as investigations } from './investigations/messages.ts';

const TOPIC_MESSAGES = {
  'canal-crossings': canalCrossings,
  steps,
  'cholera-pump': choleraPump,
  setbacks,
  investigations,
} as const satisfies Record<TopicId, Record<Locale, TopicFacts>>;

export type TopicMessages = { [K in keyof typeof TOPIC_MESSAGES]: (typeof TOPIC_MESSAGES)[K][Locale] };

export const topicMessages = (locale: Locale): TopicMessages => ({
  'canal-crossings': TOPIC_MESSAGES['canal-crossings'][locale],
  steps: TOPIC_MESSAGES.steps[locale],
  'cholera-pump': TOPIC_MESSAGES['cholera-pump'][locale],
  setbacks: TOPIC_MESSAGES.setbacks[locale],
  investigations: TOPIC_MESSAGES.investigations[locale],
});
