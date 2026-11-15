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
import type { Point, Rect } from './geometry.ts';

export interface View {
  /** Map point at the centre, metres east. */
  x: number;
  /** Map point at the centre, metres north. */
  y: number;
  /** Scale, CSS px per metre. */
  s: number;
}

export interface ElementSize { w: number; h: number; dpr: number }
export interface ResizeResult {
  /** Where the map is visible, CSS px. */
  window: Rect;
  minScale: number;
}
type ViewportSize = ElementSize & ResizeResult;

/** Zoom factor of one button press or +/- key. */
export const ZOOM_STEP = 1.5;

export interface ViewportOptions {
  element: HTMLElement;
  /** Metres from the centre to the edge of the navigable square. */
  half: number;
  maxScale?: number;
  onResize(size: ElementSize): ResizeResult;
  onFrame(view: View): void;
  onSettle(view: View): void;
  settleDelay?: number;
}

export interface Viewport {
  readonly view: View;
  /** Starts measuring and drawing; call once the style is ready. */
  start(): void;
  /** Animated zoom around the centre, shared by buttons and keyboard navigation. */
  zoom(factor: number): void;
  destroy(): void;
}

/** Arguments of ctx.setTransform(). */
export type Transform = [a: number, b: number, c: number, d: number, e: number, f: number];

export function createViewport({ element, half, maxScale = 10, onResize, onFrame, onSettle, settleDelay = 140 }: ViewportOptions): Viewport {
  const view: View = { x: 0, y: 0, s: 1 };
  const target = { s: 1 };
  let size: ViewportSize | null = null;
  const abort = new AbortController();
  const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void, opts: AddEventListenerOptions = {}): void =>
    element.addEventListener(type, fn, { ...opts, signal: abort.signal });

  // Keeps the scale in range and, when zoomed in, the visible window inside the map square.
  function clampView(v: View, sz: ViewportSize): View {
    v.s = Math.min(maxScale, Math.max(sz.minScale, v.s));
    const W = sz.window;
    const hw = (W[2] - W[0]) / 2 / v.s, hh = (W[3] - W[1]) / 2 / v.s;
    v.x = hw < half ? Math.min(half - hw, Math.max(-half + hw, v.x)) : 0;
    v.y = hh < half ? Math.min(half - hh, Math.max(-half + hh, v.y)) : 0;
    return v;
  }

  function measure(): boolean {
    const w = element.clientWidth, h = element.clientHeight;
    if (!w || !h) return false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const first = !size;
    const sz: ViewportSize = { w, h, dpr, ...onResize({ w, h, dpr }) };
    size = sz;
    if (first) Object.assign(view, { x: 0, y: 0, s: sz.minScale });
    clampView(view, sz);
    target.s = view.s;
    return true;
  }

  let raf = 0, idleTimer = 0;
  let anchor: { mx: number; my: number; px: number; py: number } | null = null;
  let drag: { x: number; y: number; vx: number; vy: number } | null = null;

  function scheduleSettle(): void {
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => { if (!raf && !drag) onSettle(view); else scheduleSettle(); }, settleDelay);
  }

  function frame(): void {
    raf = 0;
    if (anchor && size) {
      // Ease the scale in log space, keeping the map point under the cursor fixed.
      const ls = Math.log(view.s), lt = Math.log(target.s);
      const next = Math.abs(lt - ls) < 0.002 ? target.s : Math.exp(ls + (lt - ls) * 0.28);
      const { mx, my, px, py } = anchor;
      view.s = next;
      view.x = mx - (px - size.w / 2) / next;
      view.y = my + (py - size.h / 2) / next;
      clampView(view, size);
      if (next === target.s) anchor = null;
    }
    onFrame(view);
    if (anchor) raf = requestAnimationFrame(frame);
    scheduleSettle();
  }
  const kick = (): void => { if (!raf) raf = requestAnimationFrame(frame); };

  function zoomAt(sz: ViewportSize, px: number, py: number, factor: number): void {
    const base = anchor ? target.s : view.s;
    target.s = Math.min(maxScale, Math.max(sz.minScale, base * factor));
    anchor = { px, py, mx: view.x + (px - sz.w / 2) / view.s, my: view.y - (py - sz.h / 2) / view.s };
    kick();
  }

  const zoomCentre = (factor: number): void => { if (size) zoomAt(size, size.w / 2, size.h / 2, factor); };
  const local = (e: MouseEvent): Point => { const r = element.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  on('wheel', (e) => {
    e.preventDefault();
    if (!size) return;
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    zoomAt(size, ...local(e), Math.exp(-Math.max(-300, Math.min(300, dy)) * 0.0018));
  }, { passive: false });
  on('pointerdown', (e) => {
    if (!size || e.button !== 0) return;
    element.setPointerCapture(e.pointerId);
    element.classList.add('dragging');
    anchor = null;
    drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
  });
  on('pointermove', (e) => {
    if (!drag || !size) return;
    view.x = drag.vx - (e.clientX - drag.x) / view.s;
    view.y = drag.vy + (e.clientY - drag.y) / view.s;
    clampView(view, size);
    target.s = view.s;
    kick();
  });
  const endDrag = (): void => { if (!drag) return; drag = null; element.classList.remove('dragging'); scheduleSettle(); };
  on('pointerup', endDrag);
  on('pointercancel', endDrag);
  on('dblclick', (e) => { if (size) zoomAt(size, ...local(e), e.shiftKey ? 0.5 : 2); });
  on('keydown', (e) => {
    if (!size) return;
    const step = 80 / view.s;
    const moves: Partial<Record<string, Point>> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const move = moves[e.key];
    if (e.key === '+' || e.key === '=') zoomCentre(ZOOM_STEP);
    else if (e.key === '-' || e.key === '_') zoomCentre(1 / ZOOM_STEP);
    else if (move) {
      anchor = null;
      view.x += move[0]; view.y += move[1];
      clampView(view, size);
      kick();
    } else return;
    e.preventDefault();
  });

  // First measure synchronously (ResizeObserver does not fire in hidden pages), then follow resizes.
  let resizeTimer = 0;
  function onElementResize(): void {
    window.clearTimeout(resizeTimer);
    if (!size) { if (measure()) onSettle(view); return; }
    resizeTimer = window.setTimeout(() => { if (measure()) onSettle(view); }, 120);
  }
  const ro = new ResizeObserver(onElementResize);

  return {
    view,
    start() { onElementResize(); ro.observe(element); },
    zoom: zoomCentre,
    destroy() {
      abort.abort();
      ro.disconnect();
      cancelAnimationFrame(raf);
      window.clearTimeout(idleTimer);
      window.clearTimeout(resizeTimer);
    },
  };
}

// Transform that maps an image rendered for view `snap` onto the current `view`
// (device px, both centred on a W×H canvas). Use with ctx.setTransform(...t).
export function reprojection(snap: View, view: View, W: number, H: number, dpr: number): Transform {
  const k = view.s / snap.s, Sd = view.s * dpr;
  return [k, 0, 0, k, (W / 2) * (1 - k) + (snap.x - view.x) * Sd, (H / 2) * (1 - k) - (snap.y - view.y) * Sd];
}
