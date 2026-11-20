// Available styles (contract in src/styles/README.md and contract.ts). `load` imports
// the style code only on the pages that use it; `card` gives the gallery and the page
// overlays their colours from the map's options ({ bg, fg, accent }, plus dark: true for
// a light-on-dark style).
import type { StyleEntry } from './contract.ts';
import { DEFAULTS as RISO, type RisoOptions } from './riso/defaults.ts';
import { DEFAULTS as CYANOTYPE, type CyanotypeOptions } from './cyanotype/defaults.ts';
import { DEFAULTS as GRAVURE_SEPIA, type GravureSepiaOptions } from './gravure-sepia/defaults.ts';
import { DEFAULTS as ART_DECO, type ArtDecoOptions } from './art-deco/defaults.ts';
import { DEFAULTS as DOSSIER, type DossierOptions } from './dossier/defaults.ts';

/** Options of each style, by key: adding a style starts here. */
export interface StyleOptions {
  riso: RisoOptions;
  cyanotype: CyanotypeOptions;
  'gravure-sepia': GravureSepiaOptions;
  'art-deco': ArtDecoOptions;
  dossier: DossierOptions;
}
export type StyleKey = keyof StyleOptions;

export const STYLES: { [K in StyleKey]: StyleEntry<StyleOptions[K]> } = {
  riso: {
    load: () => import('./riso/index.ts'),
    card: (o = {}) => {
      const v = { ...RISO, ...o };
      return { bg: v.paper, fg: v.inkA, accent: v.inkB };
    },
  },
  cyanotype: {
    load: () => import('./cyanotype/index.ts'),
    card: (o = {}) => {
      const v = { ...CYANOTYPE, ...o };
      return { bg: v.paper, fg: v.line, accent: v.accent, dark: true };
    },
  },
  'gravure-sepia': {
    load: () => import('./gravure-sepia/index.ts'),
    card: (o = {}) => {
      const v = { ...GRAVURE_SEPIA, ...o };
      return { bg: v.paper, fg: v.ink, accent: v.accent };
    },
  },
  'art-deco': {
    load: () => import('./art-deco/index.ts'),
    card: (o = {}) => {
      const v = { ...ART_DECO, ...o };
      return { bg: v.cream, fg: v.navy, accent: v.red };
    },
  },
  dossier: {
    load: () => import('./dossier/index.ts'),
    card: (o = {}) => {
      const v = { ...DOSSIER, ...o };
      return { bg: v.paper, fg: v.ink, accent: v.red };
    },
  },
};

export const isStyleKey = (k: string): k is StyleKey => Object.hasOwn(STYLES, k);
