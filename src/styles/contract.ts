// What a style is (see src/styles/README.md).
import type { MapData, MapMeta } from '../data.ts';
import type { Shell } from '../shell.ts';
import type { Viewport } from '../toolkit/viewport.ts';
import type { Locale } from '../i18n/index.ts';

/** What a style prints about its map: the data's meta without the place name, plus the title. */
export type MountMeta = Omit<MapMeta, 'name'> & {
  /** The registry title, or the place name (src/catalogue.ts): print this, never data.meta.name. */
  title: string;
};

export interface MountArgs<O> {
  /** Empty <div id="stage"> filling the window. */
  container: HTMLElement;
  data: MapData;
  meta: MountMeta;
  locale: Locale;
  /** The map's options in src/registry.ts, to merge over the style's defaults. */
  options: Partial<O>;
  shell: Shell;
}

/** What mount() resolves to. In development it is exposed as window.__map. */
export interface MapHandle {
  destroy(): void;
  /** Navigation for the page's zoom buttons, when the style uses the toolkit viewport. */
  viewport?: Viewport;
  /** Debug: a crisp render, returns its duration in ms. */
  full?(): number;
}

/** The module a style's index.ts is. */
export interface StyleModule<O> {
  mount(args: MountArgs<O>): Promise<MapHandle>;
}

/** Colours of the gallery card and the page overlays. */
export interface CardColors {
  bg: string;
  fg: string;
  accent: string;
  /** Light ink on a dark ground: the gallery inverts its colour blend. */
  dark?: true;
}

/** A style as declared in src/styles/index.ts. */
export interface StyleDef<O> {
  label: string;
  /** Text equivalent of the visual symbols, used by the map description. */
  legend: readonly string[];
  /** Imports the style code, only on the pages that use it. */
  load(): Promise<StyleModule<O>>;
  card(options?: Partial<O>): CardColors;
}
