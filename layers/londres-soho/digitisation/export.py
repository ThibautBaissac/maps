"""Write the GeoJSON layers digitised from Snow's 1855 map: pumps, deaths per address, landmarks.

export.py osm.json affine.json blobs.json deaths.json out_dir lat lon
Display px (thumb.png coords / 1.01) -> local metres through the affine, metres -> WGS84 with
the inverse of src/geo.ts localProjection.
"""
import json
import math
import sys

import numpy as np

osm_path, affine_path, blobs_path, deaths_path, out_dir, lat0, lon0 = sys.argv[1:8]
lat0, lon0 = float(lat0), float(lon0)
coef = np.array(json.load(open(affine_path)))
S = 20124 / 2000 * 1.01  # full px -> display px divisor
R = 6371008.8
kx = R * math.radians(1) * math.cos(math.radians(lat0))
ky = R * math.radians(1)


def to_m(dx, dy):
    return np.array([dx, dy, 1.0]) @ coef


def to_ll(x, y):
    return [round(lon0 + x / kx, 7), round(lat0 + y / ky, 7)]


osm = json.load(open(osm_path))
roads = [f for l in osm['layers'] if l['id'] == 'roads' for f in l['features']]
SEG = []
for f in roads:
    if f.get('k') in ('footway', 'steps', 'path', 'cycleway', 'service') and not f.get('n'):
        continue
    g = f['g']
    for i in range(2, len(g), 2):
        SEG.append((g[i - 2], g[i - 1], g[i], g[i + 1], f.get('n')))
SEG = np.array([s[:4] for s in SEG]), [s[4] for s in SEG]


def nearest_road(p):
    a, names = SEG
    d = a[:, 2:] - a[:, :2]
    t = np.clip(((p - a[:, :2]) * d).sum(1) / np.maximum((d * d).sum(1), 1e-9), 0, 1)
    q = a[:, :2] + d * t[:, None]
    dist = np.hypot(*(q - p).T)
    i = int(np.argmin(dist))
    named = [j for j in np.argsort(dist)[:20] if names[j]]
    return float(dist[i]), q[i], (names[named[0]] if named else None)


def fc(features):
    return {'type': 'FeatureCollection', 'features': features}


def point(x, y, props):
    return {'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': to_ll(x, y)}, 'properties': props}


# Pumps: centre of the filled circle detected on the map (display px).
PUMPS = [(950, 52), (673, 115), (1404, 142), (1228, 187), (669, 472), (683, 722), (1115, 850),
         (1563, 1152), (1857, 1100), (1215, 1292), (878, 1346), (657, 1618), (1500, 1640)]
blobs = json.load(open(blobs_path))
pumps = []
for px, py in PUMPS:
    near = [b for b in blobs if b['area'] > 2500 and math.hypot(b['cx'] / S - px, b['cy'] / S - py) < 7]
    # The circle's darkest compact part: the pixels of the blob within 6 display px of the guess.
    if near:
        pts = np.array(near[0]['pts'], float) / S
        pts = pts[np.hypot(pts[:, 0] - px, pts[:, 1] - py) < 6]
        if len(pts):
            px, py = pts.mean(0)
    x, y = to_m(px, py)
    _, _, street = nearest_road(np.array([x, y]))
    broad = abs(px - 1115) < 8 and abs(py - 850) < 8
    pumps.append(point(x, y, {
        'name': 'Broad Street' if broad else street,
        'kind': 'broad-street' if broad else 'pump',
    }))

# Deaths: one point per blob of bars, put at the end of the stack nearest a street.
deaths = []
total = 0
for d in json.load(open(deaths_path)):
    pts = np.array(d['pts'], float) / S
    m = np.array([to_m(px, py) for px, py in pts])
    c = m.mean(0)
    _, q, _ = nearest_road(c)
    base = m[int(np.argmin(np.hypot(*(m - q).T)))]
    deaths.append(point(float(base[0]), float(base[1]), {'deaths': int(d['n'])}))
    total += int(d['n'])

# Landmarks named in Snow's text, placed at the centre of their block on the map.
LANDMARKS = [
    ((970, 655), 'Workhouse, Poland Street', 'workhouse'),
    ((1262, 835), 'Brewery, Broad Street', 'brewery'),
]
landmarks = [point(*to_m(*p), {'name': n, 'kind': k}) for p, n, k in LANDMARKS]

for name, feats in (('pompes', pumps), ('deces', deaths), ('reperes', landmarks)):
    with open(f'{out_dir}/{name}.geojson', 'w') as f:
        json.dump(fc(feats), f, indent=1, ensure_ascii=False)
        f.write('\n')
print('pumps', len(pumps), 'death points', len(deaths), 'deaths', total)
print([p['properties']['name'] for p in pumps])
