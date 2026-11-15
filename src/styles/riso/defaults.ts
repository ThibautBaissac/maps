// Riso options a map can override in src/registry.ts.
export interface RisoOptions {
  /** First ink: buildings. */
  inkA: string;
  /** Second ink: streets, water, parks. */
  inkB: string;
  paper: string;
  /** Offset of plate B, CSS px. */
  misregistration: readonly [x: number, y: number];
}

export const DEFAULTS: RisoOptions = {
  inkA: '#FF4F9A',
  inkB: '#1E5FD8',
  paper: '#F6F1E7',
  misregistration: [2.4, -1.7],
};
