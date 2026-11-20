// The contract of a subject (src/topics/<id>/index.ts): its gallery themes, the geographic
// evidence shared by the drawing and its text, and that text. Types only, plus the themes.
import type { Locale, MapStory } from '../i18n/index.ts';
import type { Messages } from '../i18n/types.ts';
import type { Layer, Survey } from '../layers.ts';
import type { Point } from '../toolkit/geometry.ts';

/** Themes the gallery search finds maps by; their labels are under themes.<id> in the dictionaries. */
export const THEME_IDS = ['water', 'relief', 'history', 'health', 'architecture', 'animals'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

/** A subject's facts and method in the plain house style, shared by every map of it. */
export interface TopicFacts {
  metric: string;
  legend: string;
  method: string;
  limits: string;
}

/** A numbered reference on the map and in the panel. */
export interface TopicMark {
  name: string;
  point: Point;
}

/** What every analysis carries: its subject id and its numbered references. */
export interface TopicEvidence {
  id: string;
  places: readonly TopicMark[];
}

export interface TopicRow { name: string; value: string; strongest: boolean }

/** One interpretation of the measurements for the sidebar and the text equivalent. */
export interface TopicContent {
  copy: Messages['topic'];
  subject: Messages['topics'][keyof Messages['topics']];
  /** The map's question and intro, in its own voice. */
  story: MapStory;
  value: string;
  concentration: string;
  source: string;
  references: { number: number; name: string; point: Point; detail: string }[];
  distribution: { title: string; help: string; layout: 'grid' | 'list'; rows: TopicRow[] };
  /** A list cited beside the measurements (investigations without a place). */
  notes?: { title: string; help: string; items: string[] };
  /** Label of the link to the data file, when it is not OpenStreetMap's. */
  dataFile?: string;
  /** False when the map draws its own legend: the panel leaves the text legend to the description. */
  panelLegend?: false;
}

/** A subject: registered in TOPICS (src/topics/index.ts) under the id its analysis carries. */
export interface TopicDef<A extends TopicEvidence> {
  /** Gallery search themes, most specific first: every map of the subject shares them. */
  themes: readonly ThemeId[];
  /** Analyse only geometry inside the surveyed square, independently of the current zoom. */
  analyse(survey: Pick<Survey, 'half'>, layers: readonly Layer[]): A;
  /** The panel and description text, in the plain house style. */
  content(survey: Survey, topic: A, locale: Locale): Omit<TopicContent, 'story'>;
}
