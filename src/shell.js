// The thin page frame every map shares: back link, OSM attribution, loading text,
// accessible label and colours. Styles position and theme it, nothing more.
export function createShell({ label, colors }) {
  const root = document.documentElement.style;
  const back = document.querySelector('.back');
  const attribution = document.querySelector('.attribution');
  const loading = document.querySelector('.loading');
  const px = (v) => (v == null ? '' : `${v}px`);
  const shell = {
    label,
    // Positions (CSS px) of the back link and the attribution; unset keeps the CSS corner.
    place({ back: b = {}, attribution: a = {} } = {}) {
      Object.assign(back.style, { left: px(b.left), top: px(b.top), right: px(b.right), bottom: px(b.bottom) });
      Object.assign(attribution.style, { left: px(a.left), top: px(a.top), right: px(a.right), bottom: px(a.bottom) });
    },
    // Look of the HTML overlays: { bg, accent, font } (font: a CSS font-family list).
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
