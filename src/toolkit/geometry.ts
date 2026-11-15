// Shared geometry types and small typed helpers.

/** [x, y] */
export type Point = [x: number, y: number];
/** [x0, y0, x1, y1] */
export type Rect = [x0: number, y0: number, x1: number, y1: number];
export interface Circle { x: number; y: number; r: number }

export const scaleRect = (r: Rect, k: number): Rect => [r[0] * k, r[1] * k, r[2] * k, r[3] * k];

// Object.keys keeps the declaration order; typed for objects with known keys.
export const typedKeys = <T extends object>(o: T): (keyof T & string)[] => Object.keys(o) as (keyof T & string)[];

export const isKeyOf = <T extends object>(o: T, k: PropertyKey): k is keyof T => Object.hasOwn(o, k);

// One fresh value per key, e.g. an empty list per road kind.
export function recordOf<K extends string, V>(keys: readonly K[], make: (k: K) => V): Record<K, V> {
  return Object.fromEntries(keys.map((k) => [k, make(k)])) as Record<K, V>;
}
