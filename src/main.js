import data from '../data/quartier.json';

console.log(`${data.meta.name} — éléments par type`);
console.table({
  bâtiments: data.buildings.length,
  routes: data.roads.length,
  'cours d’eau': data.waterways.length,
  'plans d’eau': data.water.length,
  parcs: data.parks.length,
});

const canvas = document.getElementById('map');
const ctx = canvas.getContext('2d');

function draw() {
  const dpr = devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const s = Math.min(w, h) / (data.meta.half * 2) * 0.95;
  // map metres (y north) -> screen px (y down)
  ctx.setTransform(dpr * s, 0, 0, -dpr * s, dpr * w / 2, dpr * h / 2);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-5000, -5000, 10000, 10000);

  const poly = (rings) => { for (const r of rings) { ctx.moveTo(r[0], r[1]); for (let i = 2; i < r.length; i += 2) ctx.lineTo(r[i], r[i + 1]); ctx.closePath(); } };
  ctx.beginPath(); data.water.forEach((w) => poly(w.r)); ctx.fillStyle = '#9cf'; ctx.fill('evenodd');
  ctx.beginPath(); data.parks.forEach((p) => poly(p.r)); ctx.fillStyle = '#9d9'; ctx.fill('evenodd');
  ctx.beginPath(); data.buildings.forEach(poly); ctx.fillStyle = '#c66'; ctx.fill('evenodd');
  ctx.beginPath();
  for (const r of data.roads) { const p = r.p; ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); }
  ctx.lineWidth = 1.2 / s; ctx.strokeStyle = '#222'; ctx.stroke();
  ctx.strokeStyle = '#f00'; ctx.lineWidth = 2 / s; ctx.strokeRect(-data.meta.half, -data.meta.half, data.meta.half * 2, data.meta.half * 2);
}
new ResizeObserver(draw).observe(canvas);
