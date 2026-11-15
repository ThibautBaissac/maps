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
const target = { x: 0, y: 0, s: 1 }; // where wheel zoom is heading (animated)
const MAX_S = 10; // px per metre
// Extent of the drawn city (buildings), with a small margin.
const EXT = M.buildings.reduce((e, b) => [Math.min(e[0], b.bb[0]), Math.min(e[1], b.bb[1]), Math.max(e[2], b.bb[2]), Math.max(e[3], b.bb[3])], [Infinity, Infinity, -Infinity, -Infinity]);
EXT[0] -= 40; EXT[1] -= 40; EXT[2] += 40; EXT[3] += 40;

function clampView(v) {
  v.s = Math.min(MAX_S, Math.max(env.minS, v.s));
  v.x = Math.min(EXT[2], Math.max(EXT[0], v.x));
  v.y = Math.min(EXT[3], Math.max(EXT[1], v.y));
  return v;
}
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
  env.minS = Math.min(mw / (EXT[2] - EXT[0]), mh / (EXT[3] - EXT[1]));
  if (first) Object.assign(view, { x: (EXT[0] + EXT[2]) / 2, y: (EXT[1] + EXT[3]) / 2, s: env.minS });
  clampView(view);
  Object.assign(target, view);
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

// ---- Interaction: wheel zoom (animated, anchored on the cursor) and drag to pan.
// While moving, the last crisp render is re-projected (cheap); a full crisp render follows when idle.
let raf = 0, idleTimer = 0, anchor = null, drag = null;

function scheduleCrisp() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!raf && !drag) full(); else scheduleCrisp(); }, 140);
}

function frame() {
  raf = 0;
  if (anchor) {
    // Ease scale in log space, keeping the map point under the cursor fixed.
    const ls = Math.log(view.s), lt = Math.log(target.s);
    const next = Math.abs(lt - ls) < 0.002 ? target.s : Math.exp(ls + (lt - ls) * 0.28);
    const { mx, my, px, py } = anchor;
    view.s = next;
    view.x = mx - (px - env.w / 2) / next;
    view.y = my + (py - env.h / 2) / next;
    clampView(view);
    if (next === target.s) anchor = null;
  }
  present();
  if (anchor) raf = requestAnimationFrame(frame);
  scheduleCrisp();
}
const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

function zoomAt(px, py, factor) {
  const base = anchor ? target.s : view.s;
  target.s = Math.min(MAX_S, Math.max(env.minS, base * factor));
  // Map point currently under the cursor.
  anchor = { px, py, mx: view.x + (px - env.w / 2) / view.s, my: view.y - (py - env.h / 2) / view.s };
  kick();
}

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (!env) return;
  const r = canvas.getBoundingClientRect();
  const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
  zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-Math.max(-300, Math.min(300, dy)) * 0.0018));
}, { passive: false });

canvas.addEventListener('pointerdown', (e) => {
  if (!env || e.button !== 0) return;
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add('dragging');
  anchor = null;
  drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  view.x = drag.vx - (e.clientX - drag.x) / view.s;
  view.y = drag.vy + (e.clientY - drag.y) / view.s;
  clampView(view);
  target.s = view.s;
  kick();
});
const endDrag = () => { if (!drag) return; drag = null; canvas.classList.remove('dragging'); scheduleCrisp(); };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('dblclick', (e) => {
  const r = canvas.getBoundingClientRect();
  zoomAt(e.clientX - r.left, e.clientY - r.top, e.shiftKey ? 0.5 : 2);
});
// Keyboard: + / - to zoom, arrows to pan.
canvas.addEventListener('keydown', (e) => {
  if (!env) return;
  const step = 80 / view.s;
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
  if (e.key === '+' || e.key === '=') zoomAt(env.w / 2, env.h / 2, 1.5);
  else if (e.key === '-' || e.key === '_') zoomAt(env.w / 2, env.h / 2, 1 / 1.5);
  else if (moves[e.key]) {
    anchor = null;
    view.x += moves[e.key][0]; view.y += moves[e.key][1];
    clampView(view);
    kick();
  } else return;
  e.preventDefault();
});

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
