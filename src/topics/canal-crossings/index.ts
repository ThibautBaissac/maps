// Subject canal-crossings: the bridge sections that cross a canal of the square.
import { linearTopic } from '../linear/index.ts';
import { MESSAGES } from './messages.ts';

export { MESSAGES as messages };
export const topic = linearTopic('canal-crossings', MESSAGES);
