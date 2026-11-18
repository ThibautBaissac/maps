// Dossier options a map can override in src/registry.ts.
export interface DossierOptions {
  /** Page and sea. */
  paper: string;
  /** Land: the tint inside the country outline. */
  land: string;
  /** Country outline, texts, numbered badges. */
  ink: string;
  /** Département boundaries, rivers, city names. */
  grey: string;
  /** The subject: marks and hatching. */
  red: string;
  /** Country outline width, CSS px. */
  outline: number;
  /** Département boundary width, CSS px. */
  boundary: number;
  /** Side of a mark, CSS px. */
  mark: number;
  /** Spacing of the red hatching, CSS px. */
  hatch: number;
}

export const DEFAULTS: DossierOptions = {
  paper: '#ECE6D8',
  land: '#E2D9C6',
  ink: '#1F1D1A',
  grey: '#9C958A',
  red: '#B0261C',
  outline: 1.5,
  boundary: 0.6,
  mark: 9,
  hatch: 6,
};
