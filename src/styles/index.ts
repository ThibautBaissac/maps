// Available styles (contract in src/styles/README.md and contract.ts). `load` imports
// the style code only on the pages that use it; `card` gives the gallery and the page
// overlays their colours from the map's options ({ bg, fg, accent }, plus dark: true for
// a light-on-dark style).
import type { StyleDef } from './contract.ts';
import { DEFAULTS as RISO, type RisoOptions } from './riso/defaults.ts';
import { DEFAULTS as CYANOTYPE, type CyanotypeOptions } from './cyanotype/defaults.ts';

/** Options of each style, by key: adding a style starts here. */
export interface StyleOptions {
  riso: RisoOptions;
  cyanotype: CyanotypeOptions;
}
export type StyleKey = keyof StyleOptions;

export const STYLES: { [K in StyleKey]: StyleDef<StyleOptions[K]> } = {
  riso: {
    label: 'Risographie deux encres',
    legend: ['Bâtiments : surfaces pleines.', 'Rues et quais : traits.', 'Eau : hachures horizontales.', 'Parcs et jardins : trame de points.'],
    load: () => import('./riso/index.ts'),
    card: (o = {}) => {
      const v = { ...RISO, ...o };
      return { bg: v.paper, fg: v.inkA, accent: v.inkB };
    },
  },
  cyanotype: {
    label: "Cyanotype d'architecte",
    legend: ['Bâtiments : contours.', 'Rues : traits simples ou doubles selon le zoom.', 'Eau : lignes parallèles au rivage.', 'Parcs et jardins : hachures croisées.'],
    load: () => import('./cyanotype/index.ts'),
    card: (o = {}) => {
      const v = { ...CYANOTYPE, ...o };
      return { bg: v.paper, fg: v.line, accent: v.accent, dark: true };
    },
  },
};

export const isStyleKey = (k: string): k is StyleKey => Object.hasOwn(STYLES, k);
