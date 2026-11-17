import type { PlaceId } from '../../places/index.ts';
import type { MapId } from '../registry.ts';
import type { StyleKey } from '../styles/index.ts';
import type { ThemeId, TopicId } from '../topics.ts';

export const LOCALES = ['fr', 'en', 'es', 'pt', 'de'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'fr';

export type LocalizedText = string | Record<Locale, string>;
export type PluralMessage = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
type Four<T> = readonly [T, T, T, T];
type Positions = readonly [readonly [string, string, string], readonly [string, string, string], readonly [string, string, string]];

/** The opening of a map, told in the map's voice. */
export interface MapStory {
  /** The validated subject, as the page heading and gallery card ask it. */
  question: string;
  /** Two or three sentences that set the scene before the measurements. */
  intro: string;
}

/** Every supported language supplies the same messages, including accessible text. */
export interface Messages {
  languageName: string;
  languageNav: string;
  attribution: string;
  data: string;
  gallery: {
    title: string;
    heading: readonly [string, string];
    /** The gallery's meta description; `places` lists its districts and cities. */
    description: (places: string) => string;
    maps: string;
    open: string;
    /** Name of the group of filter buttons. */
    filters: string;
    /** The button that shows every map again. */
    all: string;
    facets: Record<'place' | 'style' | 'theme', string>;
    /** Announced after a filter changes. */
    shown: PluralMessage;
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
    /** Overlay layer whose features carry no names. */
    unnamed: PluralMessage;
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
  topic: {
    eyebrow: string;
    references: string;
    referenceHelp: string;
    distribution: string;
    distributionHelp: string;
    methodology: string;
    empty: string;
    overview: string;
    focus: (name: string) => string;
    /** A numbered reference in the text description. */
    referenceLine: (number: string, name: string, detail: string) => string;
    source: (date: string, size: string) => string;
    dataFile: string;
    concentration: (position: string, share: string) => string;
    waterCrossed: (names: string) => string;
    /** Strings of the 1854 cholera subject (topic cholera-pump). */
    cholera: {
      broadPump: string;
      deaths: (count: number) => string;
      concentration: (share: string, within100: string) => string;
      distribution: string;
      distributionHelp: string;
      pumpDetail: (broad: string, within100: string) => string;
      workhouse: string;
      workhouseDetail: string;
      brewery: string;
      breweryDetail: string;
      source: string;
      /** Short legend labels drawn on the map. */
      legendDeaths: string;
      legendBroad: string;
      legendPump: string;
    };
  };
  /** The facts and method of a subject, in the plain house style, shared by every map of it. */
  topics: Record<TopicId, {
    metric: string;
    legend: string;
    method: string;
    limits: string;
  }>;
  /** The texts of a map written in its own voice: see voices/<map-id>.md. */
  maps: Record<MapId, MapStory>;
  /** Gallery filter labels of the subjects' themes (src/topics.ts). */
  themes: Record<ThemeId, string>;
  styles: Record<StyleKey, { label: string; legend: Four<string> }>;
}
