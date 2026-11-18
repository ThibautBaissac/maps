// Art deco poster options a map can override in src/registry.ts.
export interface ArtDecoOptions {
  /** Night blue: water, frame, letters, shaded walls of the single-block towers. */
  navy: string;
  /** Gold: banner, roofs of the stepped towers. */
  gold: string;
  /** Vermilion: lit walls of the stepped towers, markers. */
  red: string;
  /** Cream: page, streets, roofs of ordinary buildings. */
  cream: string;
  /** Green: parks and gardens. */
  green: string;
  /** Oblique view: screen shift of a roof per metre of height, east and north (map metres). */
  tiltX: number;
  tiltY: number;
  /** Cast shadow per metre of height, east and north (map metres), drawn on the ground. */
  shadowX: number;
  shadowY: number;
  /** Height given to a building without height in OSM, m. */
  defaultHeight: number;
  /** Line width of the external layers, CSS px. */
  layerWidth: number;
  /** Point radius of the external layers, CSS px. */
  layerRadius: number;
  /** CSS font-family of the title and legend. */
  font: string;
  /** CSS font-family of the street names. */
  labelFont: string;
}

export const DEFAULTS: ArtDecoOptions = {
  navy: '#0F2C4A',
  gold: '#E8B04A',
  red: '#D4572F',
  cream: '#F2E6CC',
  green: '#3E7C6B',
  tiltX: 0.32,
  tiltY: 0.5,
  shadowX: 0.42,
  shadowY: -0.16,
  defaultHeight: 10,
  layerWidth: 2,
  layerRadius: 5,
  font: '"Poiret One", "Futura", sans-serif',
  labelFont: '"Bebas Neue", "Futura", sans-serif',
};
