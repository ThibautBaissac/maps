# Converts the investigations register (layers/france/registre.json, built by
# notion-vers-registre.py) into the enquetes layer source (layers/france/enquetes.geojson) and
# the list of investigations without a place in metropolitan France (places/investigations.ts).
# Run from the repository root:
#   python3 -I layers/france/scripts/registre-vers-couches.py
# then npm run layers -- france. Method in layers/france/README.md.
import collections, json

FIRST_YEAR = 2008  # the map's question: since 2008
inv = json.load(open('layers/france/registre.json'))['investigations']

deps = json.load(open('layers/france/departements.geojson'))['features']
def bbox_centre(polys):
    best, best_area = None, -1
    for poly in polys:
        ring = poly[0]
        area = abs(sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(ring, ring[1:])))
        if area > best_area: best, best_area = ring, area
    xs, ys = [p[0] for p in best], [p[1] for p in best]
    return [(min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2]
dep_centre, dep_region = {}, {}
for f in deps:
    g = f['geometry']
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    dep_centre[f['properties']['code']] = bbox_centre(polys)
    dep_region[f['properties']['code']] = f['properties']['region']
region_centre = {}
for reg in set(dep_region.values()):
    pts = [dep_centre[d] for d in dep_centre if dep_region[d] == reg]
    region_centre[reg] = [sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)]

features, unlocated = [], {}
for i in inv:
    if i['year'] < FIRST_YEAR: continue
    p = i['precision']
    if p in ('commune', 'departement', 'region'):
        coords = [i['lon'], i['lat']] if p == 'commune' else dep_centre[i['departement']] if p == 'departement' else region_centre[i['region']]
        if p != 'region': assert dep_region[i['departement']] == i['region'], i
        props = {'title': i['title'], 'site': i['site'], 'year': i['year'], 'precision': p, 'region': i['region']}
        if p == 'commune': props['commune'] = i['commune']
        if i.get('departement'): props['departement'] = i['departement']
        props['species'] = ','.join(i['species'])
        props['url'] = i['url']
        props['group'] = str(i['num'])
        features.append({'type': 'Feature', 'properties': props, 'geometry': {'type': 'Point', 'coordinates': [round(coords[0], 4), round(coords[1], 4)]}})
    else:
        unlocated.setdefault(i['num'], (i['year'], i['title'], i['site'], i['url'], p))
features.sort(key=lambda f: (f['properties']['year'], f['properties']['title']))
json.dump({'type': 'FeatureCollection', 'features': features}, open('layers/france/enquetes.geojson', 'w'), ensure_ascii=False, indent=1)

def ts(s): return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"
body = '\n'.join(f"  {{ year: {y}, site: '{s}', name: {ts(t)}, url: {ts(u)} }}," for y, t, s, u, _ in sorted(unlocated.values()))
ts_file = 'places/investigations.ts'
src = open(ts_file).read()
start = src.index('= [\n') + 4
end = src.index('\n];', start)
open(ts_file, 'w').write(src[:start] + body + src[end:])

print('sites placés', len(features), dict(collections.Counter(f['properties']['precision'] for f in features)))
print('enquêtes sans lieu', len(unlocated), dict(collections.Counter(v[4] for v in unlocated.values())))
print('enquêtes depuis', FIRST_YEAR, len({i['num'] for i in inv if i['year'] >= FIRST_YEAR}))
