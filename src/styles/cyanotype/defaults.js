// Cyanotype options a map can override in src/registry.js.
export const DEFAULTS = {
  paper: '#12408A', // Prussian-blue ground
  line: '#F2F6FF', // every stroke and letter
  accent: '#A9C4F0', // page overlays and gallery shadow (5.6:1 on the paper)
  paperNoise: 0.06, // strength of the paper mottling, 0–0.2
  grid: 0.15, // opacity of the reference grid
  building: 0.75, // building outline, CSS px
  road: 0.8, // road casing lines, CSS px
  contours: 10, // number of depth lines along each shore
  hatch: 6, // park cross-hatching pitch, CSS px
  font: '"Space Mono", ui-monospace, monospace',
};
