import type { PlaceId } from '../../places/index.ts';
import type { MapId } from '../registry.ts';
import type { StyleKey } from '../styles/index.ts';
import type { ThemeId } from '../topics/types.ts';
import type { TopicMessages } from '../topics/messages.ts';

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
    /** The places left out of a list cut short, as its last item: « Lisbonne et 12 autres ». */
    more: PluralMessage;
    open: string;
    /** Announced after the search changes. */
    shown: PluralMessage;
    /** Label of the search field, read by screen readers only. */
    search: string;
    /** What the search field takes, shown in it while it is empty. */
    searchHint: string;
    /** Shown when the search keeps no map. */
    noMatch: string;
    /** The button that clears the search. */
    reset: string;
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
    methodology: string;
    empty: string;
    overview: string;
    focus: (name: string) => string;
    /** A numbered reference in the text description. */
    referenceLine: (number: string, name: string, detail: string) => string;
    source: (date: string, size: string) => string;
    dataFile: string;
  };
  /** The texts of each subject, from src/topics/<id>/messages.ts (src/topics/messages.ts). */
  topics: TopicMessages;
  /** The texts of a map written in its own voice: see voices/<map-id>.md. */
  maps: Record<MapId, MapStory>;
  /** Labels of the subjects' themes (src/topics/types.ts), found by the gallery search. */
  themes: Record<ThemeId, string>;
  styles: Record<StyleKey, { label: string; legend: Four<string> }>;
}

/** A language's own file (src/i18n/<locale>.ts): every message but the subjects', which src/topics supplies. */
export type Dictionary = Omit<Messages, 'topics'>;
