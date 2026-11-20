import { LOCALES, type Locale, type LocalizedText, type Messages, type PluralMessage } from './types.ts';
import { isRecord } from '../place.ts';

export { DEFAULT_LOCALE, LOCALES, type Locale, type LocalizedText, type MapStories, type MapStory } from './types.ts';

// The dictionaries loaded so far. A map page loads only its own language's (src/entries/);
// Node loads them all (./all.ts). A subject's texts are in its folder, src/topics/<id>/
// messages.ts; a map's question and intro in src/i18n/maps/<map-id>.ts.
const MESSAGES: Partial<Record<Locale, Messages>> = {};

/** Makes a language's dictionary available: each src/i18n/<locale>.ts adds itself when imported. */
export function addMessages(locale: Locale, dictionary: Messages): void {
  MESSAGES[locale] = dictionary;
}

export function messages(locale: Locale): Messages {
  const dictionary = MESSAGES[locale];
  if (!dictionary) throw new Error(`No ${locale} dictionary loaded: import src/i18n/${locale}.ts first (src/i18n/all.ts in Node)`);
  return dictionary;
}

/** A text given once for every language, or per language. */
export const localized = (text: LocalizedText, locale: Locale): string => typeof text === 'string' ? text : text[locale];

export const isLocale = (value: string): value is Locale => (LOCALES as readonly string[]).includes(value);
const TAGS: Record<Locale, string> = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES', pt: 'pt-PT', de: 'de-DE' };

/** Open Graph locale, as fr_FR. */
export const ogLocale = (locale: Locale): string => TAGS[locale].replace('-', '_');

/** "a, b and c" in the language. */
export const formatList = (locale: Locale, items: readonly string[]): string =>
  new Intl.ListFormat(TAGS[locale], { type: 'conjunction' }).format(items);

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
  return compareTranslations(messages('fr'), catalogues);
}

/** Every text of `reference` (French) missing or empty in each language of `catalogues`, as "<path>.<key>: …", the path of a language given by `pathOf`. */
export function compareTranslations(reference: unknown, catalogues: unknown, pathOf: (locale: Locale) => string = (locale) => locale): string[] {
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
  for (const locale of LOCALES) check(reference, isRecord(catalogues) ? catalogues[locale] : undefined, pathOf(locale));
  return problems;
}
