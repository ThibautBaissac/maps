import data from '../data/quartier.json';
import { renderPaper } from './paper.js';
import { makeInkTexture, applyInkTexture, makePatterns } from './inks.js';
import { prepare, makeProjector, renderPink, renderBlue } from './map.js';
import { prepareLabels, renderLabels } from './labels.js';
import { computeLayout, renderUI, knockouts, scaleBar } from './ui.js';
import { makeCanvas, pixelCanvas } from './noise.js';

console.log(`${data.meta.name} — ${data.meta.district} : éléments par type`);
console.table({
  bâtiments: data.buildings.length,
  routes: data.roads.length,
  'cours d’eau': data.waterways.length,
  'plans d’eau': data.water.length,
  parcs: data.parks.length,
});

const MISREG = { x: 2.4, y: -1.7 }; // blue plate offset, CSS px
const M = prepare(data);
const LABELS = prepareLabels(data);
const canvas = document.getElementById('map');
const ctx = canvas.getContext('2d');
const attribution = document.querySelector('.attribution');

const view = { x: 0, y: 0, s: 1 };
let env = null; // size-dependent buffers
let snap = null; // view the ink snapshot was rendered with
let uiKey = '';

function setup() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return false;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = Math.round(w * dpr), H = Math.round(h * dpr);
  canvas.width = W; canvas.height = H;
  const layout = computeLayout(w, h);
  const mk = () => { const c = makeCanvas(W, H); return { c, x: c.getContext('2d') }; };
  const first = !env;
  env = {
    w, h, dpr, W, H, layout,
    paper: renderPaper(W, H, dpr),
    texPink: makeInkTexture(W, H, 11),
    texBlue: makeInkTexture(W, H, 23),
    pink: mk(), blue: mk(), ink: mk(), uiPink: mk(), uiBlue: mk(), uiInk: mk(),
  };
  env.patterns = makePatterns(env.blue.x, dpr);
  const grain = pixelCanvas(256, 256, 5, (r) => { const v = 128 + (r() - 0.5) * 100; return [v, v, v, 255]; });
  env.grain = ctx.createPattern(grain, 'repeat');
  const mw = layout.map[2] - layout.map[0], mh = layout.map[3] - layout.map[1];
  env.minS = Math.min(mw, mh) / (data.meta.half * 2);
  if (first) Object.assign(view, { x: 0, y: 0, s: env.minS });
  view.s = Math.max(view.s, env.minS * 0.9);
  Object.assign(attribution.style, {
    right: `${layout.w - layout.map[2] + 6}px`,
    bottom: `${layout.h - layout.map[3] + 6}px`,
  });
  uiKey = '';
  return true;
}

function compose(target, a, b, dx, dy) {
  target.setTransform(1, 0, 0, 1, 0, 0);
  target.globalCompositeOperation = 'source-over';
  target.fillStyle = '#fff';
  target.fillRect(0, 0, env.W, env.H);
  target.globalCompositeOperation = 'multiply';
  target.drawImage(a, 0, 0);
  target.drawImage(b, dx, dy);
  target.globalCompositeOperation = 'source-over';
}

function clear(c) {
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'source-over';
  c.clearRect(0, 0, env.W, env.H);
}

const deviceAvoid = () => {
  const ko = knockouts(env.layout), d = env.dpr;
  return [
    ...ko.rects.map((r) => r.map((v) => v * d)),
    ...ko.circles.map((c) => [(c.x - c.r) * d, (c.y - c.r) * d, (c.x + c.r) * d, (c.y + c.r) * d]),
  ];
};

export function renderMap() {
  const t0 = performance.now();
  const { pink, blue, dpr } = env;
  clear(pink.x); clear(blue.x);
  const P = makeProjector(view, env.W, env.H, dpr);
  renderPink(pink.x, M, P, dpr, view);
  renderBlue(blue.x, M, P, dpr, view, env.patterns);
  const mr = env.layout.map.map((v) => v * dpr);
  renderLabels(pink.x, blue.x, LABELS, P, dpr, view, mr, deviceAvoid());
  applyInkTexture(pink.x, env.texPink);
  applyInkTexture(blue.x, env.texBlue);
  compose(env.ink.x, pink.c, blue.c, MISREG.x * dpr, MISREG.y * dpr);
  snap = { ...view };
  return performance.now() - t0;
}

function renderUiLayers() {
  const { uiPink, uiBlue, dpr } = env;
  clear(uiPink.x); clear(uiBlue.x);
  renderUI(uiPink.x, uiBlue.x, env.layout, view, data.meta, dpr);
  applyInkTexture(uiPink.x, env.texPink);
  applyInkTexture(uiBlue.x, env.texBlue);
  compose(env.uiInk.x, uiPink.c, uiBlue.c, MISREG.x * dpr, MISREG.y * dpr);
}

export function present() {
  const { W, H, dpr, layout } = env;
  const c = ctx;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
  c.drawImage(env.paper, 0, 0);

  // Map inks (snapshot, re-projected to the current view while it is being refreshed).
  const mr = layout.map.map((v) => v * dpr);
  c.save();
  c.beginPath();
  c.rect(mr[0], mr[1], mr[2] - mr[0], mr[3] - mr[1]);
  c.clip();
  c.globalCompositeOperation = 'multiply';
  const k = view.s / snap.s, Sd = view.s * dpr;
  c.setTransform(k, 0, 0, k, (W / 2) * (1 - k) + (snap.x - view.x) * Sd, (H / 2) * (1 - k) - (snap.y - view.y) * Sd);
  c.drawImage(env.ink.c, 0, 0);
  c.restore();

  // Bare paper under the cartouche and compass.
  const ko = knockouts(layout);
  c.save();
  c.beginPath();
  for (const r of ko.rects) c.rect(r[0] * dpr, r[1] * dpr, (r[2] - r[0]) * dpr, (r[3] - r[1]) * dpr);
  for (const o of ko.circles) { c.moveTo((o.x + o.r) * dpr, o.y * dpr); c.arc(o.x * dpr, o.y * dpr, o.r * dpr, 0, Math.PI * 2); }
  c.clip();
  c.drawImage(env.paper, 0, 0);
  c.restore();

  // Frame, title, compass, scale.
  const cart = layout.cart;
  const sb = scaleBar(view.s, (cart[2] - cart[0]) * 0.7);
  const key = `${sb.d}:${Math.round(sb.len)}`;
  if (key !== uiKey) { renderUiLayers(); uiKey = key; }
  c.globalCompositeOperation = 'multiply';
  c.drawImage(env.uiInk.c, 0, 0);

  // Grain over everything.
  c.globalCompositeOperation = 'overlay';
  c.globalAlpha = 0.32;
  c.fillStyle = env.grain;
  c.fillRect(0, 0, W, H);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
}

function full() {
  const ms = renderMap();
  present();
  return ms;
}

let resizeTimer = 0;
function onResize() {
  clearTimeout(resizeTimer);
  if (!env) { if (setup()) full(); return; }
  resizeTimer = setTimeout(() => { if (setup()) full(); }, 120);
}

await document.fonts.load('20px "Bebas Neue"');
onResize();
new ResizeObserver(onResize).observe(canvas);

// Debug hooks for manual checks in the console.
window.__map = { view, full, renderMap, present, get env() { return env; } };
