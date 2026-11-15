// Cyanotype options a map can override in src/registry.ts.
export interface CyanotypeOptions {
  /** Prussian-blue ground. */
  paper: string;
  /** Every stroke and letter. */
  line: string;
  /** Page overlays and gallery shadow (5.6:1 on the paper). */
  accent: string;
  /** Strength of the paper mottling, 0–0.2. */
  paperNoise: number;
  /** Opacity of the reference grid. */
  grid: number;
  /** Building outline, CSS px. */
  building: number;
  /** Road casing lines, CSS px. */
  road: number;
  /** Number of depth lines along each shore. */
  contours: number;
  /** Park cross-hatching pitch, CSS px. */
  hatch: number;
  /** CSS font-family list. */
  font: string;
}

export const DEFAULTS: CyanotypeOptions = {
  paper: '#12408A',
  line: '#F2F6FF',
  accent: '#A9C4F0',
  paperNoise: 0.06,
  grid: 0.15,
  building: 0.75,
  road: 0.8,
  contours: 10,
  hatch: 6,
  font: '"Space Mono", ui-monospace, monospace',
};
