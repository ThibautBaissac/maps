"""Detect the death bars of Snow's 1855 map: thick solid ink that survives a morphological opening."""
import json
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

Image.MAX_IMAGE_PIXELS = None
src, out_json, out_png = sys.argv[1], sys.argv[2], sys.argv[3]
F = 2  # downsample factor
im = Image.open(src)
W, H = im.size
small = im.resize((W // F, H // F), Image.BILINEAR)
a = np.asarray(small) < 110  # ink
r = int(sys.argv[4]) if len(sys.argv) > 4 else 5
yy, xx = np.mgrid[-r:r + 1, -r:r + 1]
disk = xx * xx + yy * yy <= r * r
opened = ndi.binary_opening(a, structure=disk)
lab, n = ndi.label(opened)
objs = ndi.find_objects(lab)
areas = ndi.sum(opened, lab, range(1, n + 1))
blobs = []
for i, sl in enumerate(objs):
    area = float(areas[i])
    if area < 60:
        continue
    ys, xs = np.nonzero(lab[sl] == i + 1)
    ys = ys + sl[0].start
    xs = xs + sl[1].start
    blobs.append({
        'id': i + 1,
        'area': area * F * F,
        'cx': float(xs.mean() * F), 'cy': float(ys.mean() * F),
        'bbox': [int(sl[1].start * F), int(sl[0].start * F), int(sl[1].stop * F), int(sl[0].stop * F)],
        'pts': np.stack([xs * F, ys * F], 1)[:: max(1, len(xs) // 400)].tolist(),
    })
json.dump(blobs, open(out_json, 'w'))
# preview
th = im.resize((2000, int(2000 * H / W)), Image.BILINEAR).convert('RGB')
d = ImageDraw.Draw(th)
s = 2000 / W
for b in blobs:
    x0, y0, x1, y1 = b['bbox']
    d.rectangle([x0 * s - 2, y0 * s - 2, x1 * s + 2, y1 * s + 2], outline=(255, 0, 0), width=2)
th.save(out_png)
print(len(blobs), 'blobs')
print('area quantiles', np.percentile([b['area'] for b in blobs], [5, 25, 50, 75, 95]).round())
