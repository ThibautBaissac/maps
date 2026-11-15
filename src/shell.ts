// The thin page frame every map shares: back link, OSM attribution, loading text,
// accessible label and colours. Styles position and theme it, nothing more.
import { element } from './dom.ts';

/** Offsets from the page edges, CSS px; unset keeps the CSS corner. */
export interface Inset { left?: number; top?: number; right?: number; bottom?: number }

export interface ShellTheme {
  bg?: string;
  accent?: string;
  /** CSS font-family list. */
  font?: string;
}

export interface Shell {
  /** Accessible description for the focusable element (aria-label). */
  readonly label: string;
  /** Positions of the back link and the attribution. */
  place(p?: { back?: Inset; attribution?: Inset }): void;
  /** Look of the HTML overlays. */
  theme(t?: ShellTheme): void;
  ready(): void;
}

export function createShell({ label, colors }: { label: string; colors: ShellTheme }): Shell {
  const root = document.documentElement.style;
  const back = element('.back', HTMLElement);
  const attribution = element('.attribution', HTMLElement);
  const loading = document.querySelector('.loading');
  const px = (v: number | undefined): string => (v == null ? '' : `${v}px`);
  const position = (el: HTMLElement, i: Inset): void => {
    Object.assign(el.style, { left: px(i.left), top: px(i.top), right: px(i.right), bottom: px(i.bottom) });
  };
  const shell: Shell = {
    label,
    place({ back: b = {}, attribution: a = {} } = {}) {
      position(back, b);
      position(attribution, a);
    },
    theme({ bg, accent, font } = {}) {
      if (bg) root.setProperty('--bg', bg);
      if (accent) root.setProperty('--accent', accent);
      if (font) root.setProperty('--font', font);
    },
    ready() { loading?.remove(); },
  };
  shell.theme(colors);
  return shell;
}
