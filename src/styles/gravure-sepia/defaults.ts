// Sepia engraving options a map can override in src/registry.ts.
export interface GravureSepiaOptions {
  /** Aged paper. */
  paper: string;
  /** Every engraved line and letter. */
  ink: string;
  /** Second ink, kept for what the subject singles out. */
  accent: string;
  /** Pitch of the 45° building hatching, CSS px. */
  hatch: number;
  /** Pitch of the dense hatching on the shaded side of buildings, CSS px. */
  shadeHatch: number;
  /** Offset of the shaded side towards the south-east, CSS px. */
  shade: number;
  /** Building outline, CSS px. */
  building: number;
  /** Street line, CSS px. */
  road: number;
  /** Line width of the external layers, CSS px. */
  layerWidth: number;
  /** Point radius of the external layers, CSS px. */
  layerRadius: number;
  /** CSS font-family list. */
  font: string;
}

export const DEFAULTS: GravureSepiaOptions = {
  paper: '#E8D9B5',
  ink: '#4A3320',
  accent: '#A3301D',
  hatch: 4,
  shadeHatch: 1.8,
  shade: 1.6,
  building: 0.7,
  road: 0.8,
  layerWidth: 1.2,
  layerRadius: 3.5,
  font: '"IM Fell English", Georgia, serif',
};
