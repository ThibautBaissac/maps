// Available styles. `load` imports the style code only on the pages that use it;
// `card` gives the gallery its colours from the map's options.
import { DEFAULTS as RISO } from './riso/defaults.js';

export const STYLES = {
  riso: {
    label: 'Risographie deux encres',
    load: () => import('./riso/index.js'),
    card: (o = {}) => {
      const v = { ...RISO, ...o };
      return { bg: v.paper, fg: v.inkA, accent: v.inkB };
    },
  },
};
