// View state and navigation for any rendering technique (Canvas 2D, WebGL, SVG…).
//
// The view is { x, y, s }: the map point (metres, y north) shown at the centre of the
// element, and the scale in CSS px per metre. The viewport handles wheel zoom (animated,
// anchored on the cursor), drag, double-click and keyboard, keeps the view inside the
// map bounds, and tells the style when to draw:
//
//   onResize({ w, h, dpr }) -> { window, minScale }
//       element size changed (also called once at start). Resize your canvases here.
//       Return the area where the map is visible (CSS px [x0, y0, x1, y1]) and the
//       smallest allowed scale.
//   onFrame(view)   every animation frame while the view moves: keep it cheap
//                   (e.g. re-project the last crisp image with reprojection()).
//   onSettle(view)  once the view stops moving (and after each resize): crisp render.

export function createViewport({ element, half, maxScale = 10, onResize, onFrame, onSettle, settleDelay = 140 }) {
  const view = { x: 0, y: 0, s: 1 };
  const target = { s: 1 };
  let size = null; // { w, h, dpr, window, minScale }
  const abort = new AbortController();
  const on = (type, fn, opts = {}) => element.addEventListener(type, fn, { ...opts, signal: abort.signal });

  // Keeps the scale in range and, when zoomed in, the visible window inside the map square.
  function clampView(v) {
    v.s = Math.min(maxScale, Math.max(size.minScale, v.s));
    const W = size.window;
    const hw = (W[2] - W[0]) / 2 / v.s, hh = (W[3] - W[1]) / 2 / v.s;
    v.x = hw < half ? Math.min(half - hw, Math.max(-half + hw, v.x)) : 0;
    v.y = hh < half ? Math.min(half - hh, Math.max(-half + hh, v.y)) : 0;
    return v;
  }

  function measure() {
    const w = element.clientWidth, h = element.clientHeight;
    if (!w || !h) return false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const first = !size;
    size = { w, h, dpr, ...onResize({ w, h, dpr }) };
    if (first) Object.assign(view, { x: 0, y: 0, s: size.minScale });
    clampView(view);
    target.s = view.s;
    return true;
  }

  let raf = 0, idleTimer = 0, anchor = null, drag = null;

  function scheduleSettle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (!raf && !drag) onSettle(view); else scheduleSettle(); }, settleDelay);
  }

  function frame() {
    raf = 0;
    if (anchor) {
      // Ease the scale in log space, keeping the map point under the cursor fixed.
      const ls = Math.log(view.s), lt = Math.log(target.s);
      const next = Math.abs(lt - ls) < 0.002 ? target.s : Math.exp(ls + (lt - ls) * 0.28);
      const { mx, my, px, py } = anchor;
      view.s = next;
      view.x = mx - (px - size.w / 2) / next;
      view.y = my + (py - size.h / 2) / next;
      clampView(view);
      if (next === target.s) anchor = null;
    }
    onFrame(view);
    if (anchor) raf = requestAnimationFrame(frame);
    scheduleSettle();
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  function zoomAt(px, py, factor) {
    const base = anchor ? target.s : view.s;
    target.s = Math.min(maxScale, Math.max(size.minScale, base * factor));
    anchor = { px, py, mx: view.x + (px - size.w / 2) / view.s, my: view.y - (py - size.h / 2) / view.s };
    kick();
  }

  const local = (e) => { const r = element.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  on('wheel', (e) => {
    e.preventDefault();
    if (!size) return;
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    zoomAt(...local(e), Math.exp(-Math.max(-300, Math.min(300, dy)) * 0.0018));
  }, { passive: false });
  on('pointerdown', (e) => {
    if (!size || e.button !== 0) return;
    element.setPointerCapture(e.pointerId);
    element.classList.add('dragging');
    anchor = null;
    drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
  });
  on('pointermove', (e) => {
    if (!drag) return;
    view.x = drag.vx - (e.clientX - drag.x) / view.s;
    view.y = drag.vy + (e.clientY - drag.y) / view.s;
    clampView(view);
    target.s = view.s;
    kick();
  });
  const endDrag = () => { if (!drag) return; drag = null; element.classList.remove('dragging'); scheduleSettle(); };
  on('pointerup', endDrag);
  on('pointercancel', endDrag);
  on('dblclick', (e) => { if (size) zoomAt(...local(e), e.shiftKey ? 0.5 : 2); });
  on('keydown', (e) => {
    if (!size) return;
    const step = 80 / view.s;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (e.key === '+' || e.key === '=') zoomAt(size.w / 2, size.h / 2, 1.5);
    else if (e.key === '-' || e.key === '_') zoomAt(size.w / 2, size.h / 2, 1 / 1.5);
    else if (moves[e.key]) {
      anchor = null;
      view.x += moves[e.key][0]; view.y += moves[e.key][1];
      clampView(view);
      kick();
    } else return;
    e.preventDefault();
  });

  // First measure synchronously (ResizeObserver does not fire in hidden pages), then follow resizes.
  let resizeTimer = 0;
  function onElementResize() {
    clearTimeout(resizeTimer);
    if (!size) { if (measure()) onSettle(view); return; }
    resizeTimer = setTimeout(() => { if (measure()) onSettle(view); }, 120);
  }
  const ro = new ResizeObserver(onElementResize);

  return {
    view,
    get size() { return size; },
    // Starts measuring and drawing; call once the style is ready.
    start() { onElementResize(); ro.observe(element); },
    // Moves the view (clamped) and redraws crisply.
    setView(v) { Object.assign(view, v); clampView(view); target.s = view.s; onSettle(view); },
    redraw() { onSettle(view); },
    destroy() {
      abort.abort();
      ro.disconnect();
      cancelAnimationFrame(raf);
      clearTimeout(idleTimer);
      clearTimeout(resizeTimer);
    },
  };
}

// Transform that maps an image rendered for view `snap` onto the current `view`
// (device px, both centred on a W×H canvas). Use with ctx.setTransform(...t).
export function reprojection(snap, view, W, H, dpr) {
  const k = view.s / snap.s, Sd = view.s * dpr;
  return [k, 0, 0, k, (W / 2) * (1 - k) + (snap.x - view.x) * Sd, (H / 2) * (1 - k) - (snap.y - view.y) * Sd];
}
