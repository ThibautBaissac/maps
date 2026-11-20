// The pictures of a map, taken by scripts/vignettes.ts. Opened with #vignette in its URL,
// a map page draws two centred crops of its canvas into <output id="vignette">, which
// headless Chrome dumps: data-src, the gallery's portrait (WebP), and data-share, the
// 1200×630 picture of a shared link (JPEG, which every link preview reads).
import { context2d, makeCanvas } from './toolkit/canvas.ts';

/** Portrait crop, width / height. */
const RATIO = 4 / 5;
/** Share of the canvas height kept: leaves out most of the style's frame. */
const HEIGHT_SHARE = 0.88;
/** 960 × 1200: sharp on a gallery strip 600 CSS px high at 2× density (a laptop), slightly soft on the tallest 820 px strip. Every pixel more is committed for each map and locale. */
const MAX_WIDTH = 960;
const QUALITY = 0.75;
/** Open Graph's recommended size. */
const SHARE = { width: 1200, height: 630 };
const SHARE_QUALITY = 0.85;

/** The largest centred crop of `source` with the ratio of `width` × `height`, drawn at that size over the page's paper. */
function crop(source: HTMLCanvasElement, width: number, height: number, heightShare = 1): HTMLCanvasElement {
  const h = Math.min(source.height * heightShare, source.width * height / width);
  const w = h * width / height;
  const out = makeCanvas(width, height);
  const ctx = context2d(out);
  ctx.fillStyle = getComputedStyle(document.documentElement).backgroundColor;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(source, (source.width - w) / 2, (source.height - h) / 2, w, h, 0, 0, width, height);
  return out;
}

// The style has already drawn a crisp render: mounting ends with a synchronous settle.
export function captureVignette(stage: HTMLElement): void {
  const source = stage.querySelector('canvas');
  if (!source) throw new Error('No canvas to capture in #stage');

  const h = Math.round(Math.min(source.height * HEIGHT_SHARE, source.width / RATIO));
  const w = Math.round(h * RATIO);
  const scale = Math.min(1, MAX_WIDTH / w);
  const out = makeCanvas(w * scale, h * scale);
  const ctx = context2d(out);
  // A style may leave its canvas transparent over the page's paper: paint it first.
  ctx.fillStyle = getComputedStyle(document.documentElement).backgroundColor;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(source, (source.width - w) / 2, (source.height - h) / 2, w, h, 0, 0, out.width, out.height);

  const result = document.createElement('output');
  result.id = 'vignette';
  result.hidden = true;
  result.dataset['src'] = out.toDataURL('image/webp', QUALITY);
  // Same share of the height as the portrait, so the frame stays out of the picture.
  result.dataset['share'] = crop(source, SHARE.width, SHARE.height, HEIGHT_SHARE).toDataURL('image/jpeg', SHARE_QUALITY);
  document.body.append(result);
}
