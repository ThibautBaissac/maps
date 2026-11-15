import { context2d, makeCanvas, pattern } from '../../toolkit/canvas.ts';
import { mulberry32, pixelCanvas } from '../../toolkit/noise.ts';

// Paper texture at device resolution: fine grain, fibres, mottling, stains, darker edges.
export function renderPaper(W: number, H: number, dpr: number, color: string, seed = 7): HTMLCanvasElement {
  const c = makeCanvas(W, H);
  const ctx = context2d(c);
  const rand = mulberry32(seed);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);

  // Large soft mottling.
  const mott = pixelCanvas(Math.ceil(W / 48) + 2, Math.ceil(H / 48) + 2, seed + 1, (r) => {
    const v = r();
    return [120, 95, 60, Math.round(v * 22)];
  });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(mott, 0, 0, W, H);

  // Fine grain: dark and light specks.
  const grain = pixelCanvas(256, 256, seed + 2, (r) => {
    const v = r();
    if (v < 0.5) return [70, 55, 35, Math.round(r() * 26)];
    return [255, 253, 245, Math.round(r() * 40)];
  });
  ctx.fillStyle = pattern(ctx, grain, 'repeat');
  ctx.fillRect(0, 0, W, H);

  // Fibres.
  ctx.lineCap = 'round';
  const fibres = Math.round((W * H) / 2500);
  for (let i = 0; i < fibres; i++) {
    const x = rand() * W, y = rand() * H, a = rand() * Math.PI * 2, l = (4 + rand() * 14) * dpr;
    ctx.strokeStyle = rand() < 0.6 ? 'rgba(120,96,62,0.10)' : 'rgba(255,255,250,0.35)';
    ctx.lineWidth = (0.4 + rand() * 0.5) * dpr;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }

  // Stains: soft blots and a couple of rings.
  const diag = Math.hypot(W, H);
  for (let i = 0; i < 7; i++) {
    const x = rand() * W, y = rand() * H, r = diag * (0.03 + rand() * 0.09);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const ring = i < 2;
    const a = 0.035 + rand() * 0.04;
    g.addColorStop(0, `rgba(170,128,70,${ring ? 0 : a})`);
    g.addColorStop(ring ? 0.86 : 0.6, `rgba(170,128,70,${ring ? a * 0.6 : a * 0.5})`);
    g.addColorStop(ring ? 0.93 : 1, `rgba(150,110,60,${ring ? a * 1.6 : 0})`);
    g.addColorStop(1, 'rgba(150,110,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Darkened edges.
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, diag * 0.62);
  v.addColorStop(0, 'rgba(110,85,50,0)');
  v.addColorStop(1, 'rgba(110,85,50,0.26)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  return c;
}
