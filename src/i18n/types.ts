import type { PlaceId } from '../../places/index.ts';
import type { StyleKey } from '../styles/index.ts';

export const LOCALES = ['fr', 'en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'fr';

export type LocalizedText = string | Record<Locale, string>;
export type PluralMessage = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
type Four<T> = readonly [T, T, T, T];
type Positions = readonly [readonly [string, string, string], readonly [string, string, string], readonly [string, string, string]];

/** Every supported language supplies the same messages, including accessible text. */
export interface Messages {
  languageName: string;
  languageNav: string;
  attribution: string;
  data: string;
  gallery: {
    title: string;
    heading: readonly [string, string];
    intro: string;
    description: string;
    maps: string;
    open: string;
  };
  map: {
    description: (title: string, district: string, style: string) => string;
    label: (title: string, district: string) => string;
    summaryHelp: string;
    loading: string;
    back: string;
    zoom: string;
    zoomIn: string;
    zoomOut: string;
    descriptionButton: string;
    descriptionTitle: string;
    close: string;
    error: string;
    retry: string;
  };
  description: {
    overview: (title: string, district: string, size: string) => string;
    help: string;
    centre: (lat: string, lon: string, date: string) => string;
    counts: (buildings: string, roads: string, parks: string, water: string) => string;
    features: Four<PluralMessage>;
    legend: string;
    positionsHelp: string;
    positions: Positions;
    roads: string;
    water: string;
    empty: string;
  };
  canvas: {
    legend: string;
    items: Four<string>;
    work: string;
    kind: string;
    sheet: string;
    scale: string;
    survey: (date: string) => string;
    north: string;
    south: string;
    east: string;
    west: string;
  };
  places: Record<PlaceId, { name: string; district: string }>;
  styles: Record<StyleKey, { label: string; legend: Four<string> }>;
}
