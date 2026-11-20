// Subject steps: the stepped street sections of the square.
import { linearTopic } from '../linear/index.ts';
import { MESSAGES } from './messages.ts';

export { MESSAGES as messages };
export const topic = linearTopic('steps', MESSAGES);
