"""Keep the death bars among the thick blobs and count deaths per blob (coordinates in display px of thumb.png, x1.01 to thumb, x10.062 to full)."""
import json
import sys

import numpy as np
from PIL import Image, ImageDraw

B = json.load(open(sys.argv[1]))
S = 20124 / 2000 * 1.01  # display px -> full px
PUMPS = [(950, 52), (673, 115), (1404, 142), (1228, 187), (669, 472), (683, 722), (1115, 850),
         (1563, 1152), (1857, 1100), (1215, 1292), (878, 1346), (657, 1618), (1500, 1640)]
LABELS = [(898, 44, 946, 60), (628, 101, 668, 117), (1409, 130, 1452, 147), (1223, 191, 1267, 207),
          (674, 472, 715, 489), (641, 705, 680, 722), (1119, 840, 1162, 858), (1568, 1128, 1607, 1147),
          (1806, 1098, 1851, 1115), (1168, 1290, 1213, 1307), (884, 1336, 927, 1354), (618, 1610, 656, 1627),
          (1460, 1648, 1502, 1667)]
BOUNDARY = [(322, 380), (1495, 175), (1500, 182), (1860, 1100), (1860, 1130), (1745, 1188), (1860, 1565),
            (1530, 1642), (1350, 1592), (1300, 1585), (980, 1525), (830, 1565), (620, 1625), (380, 1752),
            (125, 1375), (505, 885), (322, 380)]


def seg_dist(p, a, b):
    p, a, b = map(np.asarray, (p, a, b))
    ab = b - a
    t = np.clip(np.dot(p - a, ab) / max(np.dot(ab, ab), 1e-9), 0, 1)
    return float(np.linalg.norm(p - (a + t * ab)))


def shape(b):
    p = np.array(b['pts'], float)
    ev, vec = np.linalg.eigh(np.cov(p.T))
    return np.sqrt(12 * ev[0]), np.sqrt(12 * ev[1])


PUMP_DOT = 4500  # filled pump circle after opening, full px (isolated pumps measure 3500-7200)
keep, dropped = [], []
for b in B:
    if b['area'] < 2500:
        continue
    x, y = b['cx'] / S, b['cy'] / S
    why = None
    if x < 58 or x > 1952 or y < 45 or y > 1815 or b['bbox'][2] - b['bbox'][0] > 3000:
        why = 'frame'
    elif any(x0 <= x <= x1 and y0 <= y <= y1 for x0, y0, x1, y1 in LABELS):
        why = 'label'
    elif min(np.hypot(x - px, y - py) for px, py in PUMPS) < 7:
        # only the Broad Street pump touches death bars
        if np.hypot(x - 1115, y - 850) < 7:
            b['area'] -= PUMP_DOT
        else:
            why = 'pump'
    elif min(seg_dist((x, y), BOUNDARY[i], BOUNDARY[i + 1]) for i in range(len(BOUNDARY) - 1)) < 16:
        why = 'boundary'
    b['w'], b['l'] = shape(b)
    if not why and b['area'] < 6000 and b['l'] / b['w'] < 2.8 and b['l'] < 110:
        why = 'letter'
    (dropped if why else keep).append((b, why))

singles = [b['area'] for b, _ in keep if 22 <= b['w'] <= 38 and 110 <= b['l'] <= 180]
unit = float(np.median(singles))
total = 0
out = []
for b, _ in keep:
    n = max(1, int(round(b['area'] / unit)))
    total += n
    out.append({'cx': b['cx'], 'cy': b['cy'], 'n': n, 'area': b['area'], 'pts': b['pts'], 'bbox': b['bbox']})
json.dump(out, open(sys.argv[2], 'w'))
print('unit', round(unit), 'singles', len(singles), 'blobs kept', len(out), 'deaths', total,
      'dropped', {k: sum(1 for _, w in dropped if w == k) for k in ('frame', 'label', 'pump', 'boundary', 'letter')})

im = Image.open(sys.argv[3]).convert('RGB')
d = ImageDraw.Draw(im)
s = 2000 / 20124
for o in out:
    x0, y0, x1, y1 = o['bbox']
    d.rectangle([x0 * s - 2, y0 * s - 2, x1 * s + 2, y1 * s + 2], outline=(255, 0, 0), width=2)
    if o['n'] > 1:
        d.text((x1 * s + 3, y0 * s - 4), str(o['n']), fill=(0, 0, 255))
for b, w in dropped:
    x0, y0, x1, y1 = b['bbox']
    d.rectangle([x0 * s - 2, y0 * s - 2, x1 * s + 2, y1 * s + 2], outline=(0, 180, 0), width=1)
im.save(sys.argv[4])
