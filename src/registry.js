// The maps of the site. Each map is a place (places/<place>.js, data in
// public/data/<place>.json) drawn in a style (src/styles/). One page per entry is
// generated at build time, at cartes/<id>/.
//
//   id       URL slug, unique
//   place    file name in places/, without .js
//   style    key of src/styles/index.js
//   title    optional, defaults to the place name
//   options  optional, style settings (see the style's defaults.js)
export const MAPS = [
  { id: 'amsterdam-riso', place: 'amsterdam-centre', style: 'riso' },
];
