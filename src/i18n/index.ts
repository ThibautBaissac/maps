import { fr } from './fr.ts';
import { en } from './en.ts';
import { es } from './es.ts';
import { LOCALES, type Locale, type LocalizedText, type MapStory, type Messages, type PluralMessage } from './types.ts';
import type { MapId } from '../registry.ts';
import { isRecord } from '../place.ts';

export { DEFAULT_LOCALE, LOCALES, type Locale, type LocalizedText, type MapStory } from './types.ts';
const MESSAGES: Record<Locale, Messages> = { fr, en, es };

export const messages = (locale: Locale): Messages => MESSAGES[locale];

/** The question and intro of a registered map; undefined for an id the dictionaries do not know. */
export function mapStory(locale: Locale, id: string): MapStory | undefined {
  const maps = messages(locale).maps;
  return Object.hasOwn(maps, id) ? maps[id as MapId] : undefined;
}

/** A text given once for every language, or per language. */
export const localized = (text: LocalizedText, locale: Locale): string => typeof text === 'string' ? text : text[locale];

export const isLocale = (value: string): value is Locale => (LOCALES as readonly string[]).includes(value);
const TAGS: Record<Locale, string> = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES' };

export function formatNumber(locale: Locale, value: number, options: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat(TAGS[locale], { maximumFractionDigits: 4, ...options }).format(value);
}

export function formatCoordinate(locale: Locale, value: number, axis: 'lat' | 'lon', digits: number): string {
  const directions = messages(locale).canvas;
  const suffix = axis === 'lat' ? value >= 0 ? directions.north : directions.south : value >= 0 ? directions.east : directions.west;
  return `${formatNumber(locale, Math.abs(value), { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false })}°${suffix}`;
}

/** Use the survey's UTC calendar day, independent of the visitor's timezone. */
export function formatDate(locale: Locale, iso: string): string {
  return new Intl.DateTimeFormat(TAGS[locale], { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));
}

export function pluralText(locale: Locale, forms: PluralMessage, count: number): string {
  const form = new Intl.PluralRules(TAGS[locale]).select(count);
  return (forms[form] ?? forms.other).replaceAll('{count}', formatNumber(locale, count));
}

export function featureCount(locale: Locale, feature: 0 | 1 | 2 | 3, count: number): string {
  return pluralText(locale, messages(locale).description.features[feature], count);
}

/** Also checked at build time: Node strips types, and empty strings still type-check. */
export function translationProblems(catalogues: unknown = MESSAGES): string[] {
  const problems: string[] = [];
  const check = (reference: unknown, value: unknown, path: string): void => {
    if (typeof reference === 'string') {
      if (typeof value !== 'string') problems.push(`${path}: missing or invalid translation`);
      else if (!value.trim()) problems.push(`${path}: empty translation`);
    } else if (typeof reference === 'function') {
      if (typeof value !== 'function') problems.push(`${path}: missing or invalid translation`);
    } else if (isRecord(reference)) {
      if (!isRecord(value) || Array.isArray(reference) !== Array.isArray(value)) {
        problems.push(`${path}: missing or invalid translation`);
        return;
      }
      if (Array.isArray(reference) && reference.length !== value['length']) problems.push(`${path}: invalid translation count`);
      // Plural categories vary by language; only "other" is mandatory.
      if (typeof reference['other'] === 'string') {
        check(reference['other'], value['other'], `${path}.other`);
        for (const [key, item] of Object.entries(value)) if (key !== 'other') check('', item, `${path}.${key}`);
      } else {
        for (const [key, item] of Object.entries(reference)) check(item, value[key], `${path}.${key}`);
      }
    }
  };
  for (const locale of LOCALES) check(fr, isRecord(catalogues) ? catalogues[locale] : undefined, locale);
  return problems;
}
