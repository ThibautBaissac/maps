// A fake browser page for running a style's real mount() under Node: canvases whose 2D
// context records every call, a sized stage, and the few globals the toolkit touches.
// Everything installed is removed after the test.
import type { TestContext } from 'node:test';
import type { Inset, Shell, ShellTheme } from '../src/shell.ts';
import type { Transform } from '../src/toolkit/viewport.ts';

export interface Call { method: string; args: unknown[] }

export interface FakeCanvas {
  width: number;
  height: number;
  clientWidth: number;
  clientHeight: number;
  /** Calls made on this canvas's 2D context, in order. */
  calls: Call[];
}

export interface FakePage {
  /** The <div id="stage"> handed to mount(). */
  container: HTMLElement;
  /** The canvas the style appended to the stage. */
  stage(): FakeCanvas;
  /** Every canvas created, in creation order. */
  canvases: FakeCanvas[];
  shell: Shell;
  /** Arguments of every shell.place() call. */
  placed: { back?: Inset; attribution?: Inset }[];
  /** Arguments of every shell.theme() call. */
  themed: ShellTheme[];
  /** Runs `fn` after the test, before the fake page is removed. */
  cleanup(fn: () => void): void;
}

const gradient = { addColorStop() {} };

/** A 2D context that records every method call into `calls`; property writes are kept. */
export function recordingContext(canvas: { width: number; height: number }, calls: Call[] = []): CanvasRenderingContext2D {
  const values: Record<string, unknown> = {
    canvas,
    measureText: (text: string) => ({ width: text.length * 10 }),
    createPattern: () => ({ setTransform() {} }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createImageData: (cw: number, ch: number) => ({ width: cw, height: ch, data: new Uint8ClampedArray(cw * ch * 4) }),
  };
  return new Proxy(values, {
    get: (o, k: string) => o[k] ?? ((...args: unknown[]) => { calls.push({ method: k, args }); }),
  }) as unknown as CanvasRenderingContext2D;
}

function fakeCanvas(w: number, h: number): FakeCanvas & Record<string, unknown> {
  const calls: Call[] = [];
  const canvas: FakeCanvas & Record<string, unknown> = {
    width: 300, height: 150, clientWidth: w, clientHeight: h, calls,
    tabIndex: -1,
    setAttribute() {},
    addEventListener() {},
    remove() {},
    classList: { add() {}, remove() {} },
  };
  const ctx = recordingContext(canvas, calls);
  canvas['getContext'] = () => ctx;
  return canvas;
}

/** An HTML element a style adds over its canvas (the dossier's detail card): it keeps its children and attributes, and measures nothing. */
function fakeElement(tag: string): Record<string, unknown> {
  const children: unknown[] = [];
  const attributes: Record<string, string> = {};
  return {
    tagName: tag.toUpperCase(), className: '', hidden: false, textContent: '', style: {}, offsetWidth: 0, offsetHeight: 0,
    children, attributes,
    setAttribute(name: string, value: string) { attributes[name] = value; },
    append(...nodes: unknown[]) { children.push(...nodes); },
    replaceChildren(...nodes: unknown[]) { children.splice(0, children.length, ...nodes); },
    addEventListener() {},
    remove() {},
  };
}

/** Installs a page whose stage measures `width` × `height` CSS px, at pixel density `dpr` (default 1). */
export function installPage(t: TestContext, { width, height, dpr = 1 }: { width: number; height: number; dpr?: number }): FakePage {
  const canvases: FakeCanvas[] = [];
  const children: FakeCanvas[] = [];
  const placed: FakePage['placed'] = [];
  const themed: ShellTheme[] = [];
  const cleanups: (() => void)[] = [];

  const globals: Record<string, unknown> = {
    document: {
      createElement(tag: string) {
        if (tag !== 'canvas') return fakeElement(tag);
        const c = fakeCanvas(width, height);
        canvases.push(c);
        return c;
      },
      fonts: { add() {} },
      addEventListener() {},
    },
    window: { devicePixelRatio: dpr, setTimeout, clearTimeout },
    ResizeObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    FontFace: class { load() { return Promise.resolve(this); } },
    DOMMatrix: class { rotateSelf() { return this; } },
    Path2D: class { [k: string]: unknown; constructor() { return new Proxy(this, { get: (o, k) => (k in o ? Reflect.get(o, k) : () => {}) }); } },
  };
  const saved = Object.keys(globals).map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)] as const);
  for (const [k, v] of Object.entries(globals)) Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  t.after(() => {
    for (const fn of cleanups) fn();
    for (const [k, d] of saved) {
      if (d) Object.defineProperty(globalThis, k, d);
      else Reflect.deleteProperty(globalThis, k);
    }
  });

  const container = {
    clientWidth: width, clientHeight: height,
    append: (c: FakeCanvas) => { children.push(c); },
    // The stage's own canvas, as the dossier looks it up to listen for clicks.
    querySelector: (selector: string) => selector === 'canvas' ? children.find((c) => 'getContext' in c) ?? null : null,
  } as unknown as HTMLElement;
  const shell: Shell = {
    label: 'Plan de test',
    place(p = {}) { placed.push(p); },
    theme(th = {}) { themed.push(th); },
    ready() {},
  };
  return {
    container,
    canvases,
    shell,
    placed,
    themed,
    cleanup(fn) { cleanups.push(fn); },
    stage() {
      const c = children[0];
      if (!c) throw new Error('No canvas in the stage');
      return c;
    },
  };
}

/** Letters of map names: one character drawn at (0, 0) after a translation and a rotation. */
export function nameGlyphs(calls: readonly Call[]): { ch: string; x: number; y: number }[] {
  const out: { ch: string; x: number; y: number }[] = [];
  for (let i = 2; i < calls.length; i++) {
    const draw = calls[i]!, rot = calls[i - 1]!, move = calls[i - 2]!;
    if (draw.method !== 'fillText' && draw.method !== 'strokeText') continue;
    const [ch, x0, y0] = draw.args as [string, number, number];
    if (ch.length !== 1 || x0 !== 0 || y0 !== 0 || rot.method !== 'rotate' || move.method !== 'setTransform') continue;
    const [a, b, c, d, x, y] = move.args as Transform;
    if (a === 1 && b === 0 && c === 0 && d === 1) out.push({ ch, x, y });
  }
  return out;
}
