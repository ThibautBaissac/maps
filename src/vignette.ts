// The gallery's picture of a map, taken by scripts/vignettes.ts. Opened with #vignette in
// its URL, a map page draws a centred portrait crop of its canvas into
// <output id="vignette" data-src="data:image/webp;base64,…">, which headless Chrome dumps.
import type { MapHandle } from './styles/contract.ts';

/** Portrait crop, width / height. */
const RATIO = 4 / 5;
/** Share of the canvas height kept: leaves out most of the style's frame. */
const HEIGHT_SHARE = 0.88;
const MAX_WIDTH = 1200;
const QUALITY = 0.82;

export function captureVignette(handle: MapHandle, stage: HTMLElement): void {
  const source = stage.querySelector('canvas');
  if (!source) throw new Error('No canvas to capture in #stage');
  handle.full?.(); // a crisp render, not a fast one drawn during navigation

  const h = Math.round(Math.min(source.height * HEIGHT_SHARE, source.width / RATIO));
  const w = Math.round(h * RATIO);
  const scale = Math.min(1, MAX_WIDTH / w);
  const out = document.createElement('canvas');
  out.width = Math.round(w * scale);
  out.height = Math.round(h * scale);
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  // A style may leave its canvas transparent over the page's paper: paint it first.
  ctx.fillStyle = getComputedStyle(document.documentElement).backgroundColor;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(source, (source.width - w) / 2, (source.height - h) / 2, w, h, 0, 0, out.width, out.height);

  const result = document.createElement('output');
  result.id = 'vignette';
  result.hidden = true;
  result.dataset['src'] = out.toDataURL('image/webp', QUALITY);
  document.body.append(result);
}
