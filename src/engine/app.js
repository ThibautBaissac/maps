import { computeLayout, knockouts, scaleBar, avoidBoxes } from './layout.js';
import { makeProjector } from './projection.js';
import { makeCanvas } from './noise.js';

/**
 * Generic map viewer: canvas buffers, view state, zoom/pan, crisp-render scheduling.
 * Everything visual comes from the style object:
 *
 *   fonts: string[]                CSS font shorthands loaded before the first draw
 *   prepare(data) -> prepared      once per map (indexes, label candidates…)
 *   setup(env) -> res              per canvas size (textures, offscreen buffers…)
 *   background(ctx, env, res)      page background, device px
 *   renderMap(ctx, frame)          full crisp map into a buffer, device px
 *   mapBlend                       composite operation used to lay the map on the background
 *   renderUI(ctx, frame)           frame, cartouche, compass, scale… into a buffer
 *   uiBlend                        composite operation for the UI buffer
 *   overlay?(ctx, env, res)        optional final pass (grain…)
 *
 * frame = { env, res, data, prepared, view, P, plate, mapRect, avoid }
 */
export async function createMapApp({ canvas, attribution, nav, data, style }) {
  await Promise.all((style.fonts ?? []).map((f) => document.fonts.load(f)));
  const ctx = canvas.getContext('2d');
  const prepared = style.prepare(data);
  const PLATE = data.meta.half + 40; // the printed square, in metres from the centre
  const MAX_S = 10; // px per metre

  const view = { x: 0, y: 0, s: 1 };
  const target = { s: 1 }; // where the wheel zoom is heading (animated)
  let env = null; // size-dependent buffers
  let snap = null; // view the map buffer was rendered with
  let uiKey = '';

  // Keeps the zoom in range and, when zoomed in, the viewport inside the plate.
  function clampView(v) {
    v.s = Math.min(MAX_S, Math.max(env.minS, v.s));
    const L = env.layout;
    const hw = (L.map[2] - L.map[0]) / 2 / v.s, hh = (L.map[3] - L.map[1]) / 2 / v.s;
    v.x = hw < PLATE ? Math.min(PLATE - hw, Math.max(-PLATE + hw, v.x)) : 0;
    v.y = hh < PLATE ? Math.min(PLATE - hh, Math.max(-PLATE + hh, v.y)) : 0;
    return v;
  }

  function setup() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    canvas.width = W; canvas.height = H;
    const layout = computeLayout(w, h);
    const buffer = () => { const c = makeCanvas(W, H); return { c, x: c.getContext('2d') }; };
    const first = !env;
    env = { w, h, dpr, W, H, layout, map: buffer(), ui: buffer(), minS: layout.plate / (2 * PLATE) };
    env.res = style.setup(env);
    if (first) Object.assign(view, { x: 0, y: 0, s: env.minS });
    clampView(view);
    target.s = view.s;
    const place = (el, css) => el && Object.assign(el.style, css);
    place(attribution, { right: `${w - layout.map[2] + 6}px`, bottom: `${h - layout.map[3] + 6}px` });
    place(nav, { left: `${layout.nav[0]}px`, top: `${layout.nav[1]}px` });
    uiKey = '';
    return true;
  }

  const frameFor = () => ({
    env, res: env.res, data, prepared, view,
    P: makeProjector(view, env.W, env.H, env.dpr),
    plate: PLATE,
    mapRect: env.layout.map.map((v) => v * env.dpr),
    avoid: avoidBoxes(env.layout, env.dpr),
  });

  function renderMap() {
    const t0 = performance.now();
    const b = env.map.x;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalCompositeOperation = 'source-over';
    b.clearRect(0, 0, env.W, env.H);
    style.renderMap(b, frameFor());
    snap = { ...view };
    return performance.now() - t0;
  }

  function renderUI() {
    const b = env.ui.x;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalCompositeOperation = 'source-over';
    b.clearRect(0, 0, env.W, env.H);
    style.renderUI(b, frameFor());
  }

  function present() {
    const { W, H, dpr, layout, res } = env;
    const c = ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    style.background(c, env, res);

    // Map buffer, re-projected to the current view while a crisp render is pending.
    const mr = layout.map.map((v) => v * dpr);
    c.save();
    c.beginPath();
    c.rect(mr[0], mr[1], mr[2] - mr[0], mr[3] - mr[1]);
    c.clip();
    c.globalCompositeOperation = style.mapBlend ?? 'source-over';
    const k = view.s / snap.s, Sd = view.s * dpr;
    c.setTransform(k, 0, 0, k, (W / 2) * (1 - k) + (snap.x - view.x) * Sd, (H / 2) * (1 - k) - (snap.y - view.y) * Sd);
    c.drawImage(env.map.c, 0, 0);
    c.restore();

    // Bare background under the cartouche, compass and legend.
    const ko = knockouts(layout);
    c.save();
    c.beginPath();
    for (const r of ko.rects) c.rect(r[0] * dpr, r[1] * dpr, (r[2] - r[0]) * dpr, (r[3] - r[1]) * dpr);
    for (const o of ko.circles) { c.moveTo((o.x + o.r) * dpr, o.y * dpr); c.arc(o.x * dpr, o.y * dpr, o.r * dpr, 0, Math.PI * 2); }
    c.clip();
    style.background(c, env, res);
    c.restore();

    // UI buffer, refreshed only when the scale bar changes.
    const sb = scaleBar(view.s, (layout.cart[2] - layout.cart[0]) * 0.7);
    const key = `${sb.d}:${Math.round(view.s * 400)}`;
    if (key !== uiKey) { renderUI(); uiKey = key; }
    c.globalCompositeOperation = style.uiBlend ?? 'source-over';
    c.drawImage(env.ui.c, 0, 0);
    c.globalCompositeOperation = 'source-over';
    if (style.overlay) style.overlay(c, env, res);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  function full() {
    const ms = renderMap();
    present();
    return ms;
  }

  // ---- Interaction: wheel zoom (animated, anchored on the cursor) and drag to pan.
  // Moving frames re-project the last crisp render; a full render follows when idle.
  let raf = 0, idleTimer = 0, anchor = null, drag = null;

  function scheduleCrisp() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (!raf && !drag) full(); else scheduleCrisp(); }, 140);
  }

  function frame() {
    raf = 0;
    if (anchor) {
      // Ease the scale in log space, keeping the map point under the cursor fixed.
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

  // First render synchronously (ResizeObserver does not fire in hidden pages), then follow resizes.
  let resizeTimer = 0;
  function onResize() {
    clearTimeout(resizeTimer);
    if (!env) { if (setup()) full(); return; }
    resizeTimer = setTimeout(() => { if (setup()) full(); }, 120);
  }
  onResize();
  new ResizeObserver(onResize).observe(canvas);

  return { view, full, renderMap, present, get env() { return env; } };
}
