# Builds layers/france/registre.json from L214's investigations database (Notion, internal),
# as transcribed in notion_table.py: one record per site, communes placed at their centre by
# https://geo.api.gouv.fr (Licence Ouverte). Only public facts are kept: title, date, kind
# of site, animals, place and the public page; no farmer or company names, no internal link.
# Run from the repository root:  python3 -I layers/france/scripts/notion-vers-registre.py
import json, os, sys, time, urllib.parse, urllib.request
sys.path.insert(0, 'layers/france/scripts')
from notion_table import ROWS, SP

deps = json.load(open('layers/france/departements.geojson'))['features']
region_of = {f['properties']['code']: f['properties']['region'] for f in deps}
old = json.load(open('layers/france/registre.json')).get('investigations', [])

# Answers kept between runs (git-ignored location), so a rerun does not hit the API again.
CACHE = os.path.join(os.environ.get('TMPDIR', '/tmp'), 'maps-geo-communes.json')
cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}

def commune(name, dep):
    q = urllib.parse.urlencode({'nom': name, 'codeDepartement': dep, 'fields': 'code,nom,centre,codeRegion', 'format': 'json'})
    if q in cache: found = cache[q]
    else:
        req = urllib.request.Request(f'https://geo.api.gouv.fr/communes?{q}', headers={'User-Agent': 'maps-build'})
        for attempt in range(5):
            try:
                found = json.load(urllib.request.urlopen(req, timeout=20))
                break
            except Exception:
                if attempt == 4: raise
                time.sleep(2 * (attempt + 1))
        cache[q] = found
        time.sleep(0.3)
    exact = [c for c in found if c['nom'].lower() == name.lower()]
    if not (exact or found):
        missing.append(f'{name} ({dep})')
        return None
    return (exact or found)[0]
missing = []

def public_url(year, place):
    # A public page already in the previous register for the same year and place.
    for i in old:
        if i.get('year') == year and place and place in (i.get('commune'), i.get('departement')) and i.get('urls'):
            return i['urls'][0]
    return ''

records = []
for num, date, kind, species, title, url, sites in ROWS:
    year = int(date[:4])
    base = {'num': num, 'title': title, 'year': year, 'date': date if len(date) == 10 else None,
            'site': kind, 'species': [SP[s] for s in species.split()], 'url': url.split('?')[0] if url else ''}
    if isinstance(sites, str):
        records.append({**base, 'precision': sites})
        continue
    for s in sites:
        r = dict(base, group=num)
        if s[0] == 'c':
            c = commune(s[1], s[2])
            if c is None: continue
            r.update(precision='commune', commune=c['nom'], insee=c['code'], departement=s[2], region=c['codeRegion'],
                     lon=c['centre']['coordinates'][0], lat=c['centre']['coordinates'][1])
            if len(s) > 3: r['site'] = s[3]
        elif s[0] == 'd':
            r.update(precision='departement', departement=s[1], region=region_of[s[1]])
        else:
            r.update(precision='region', region=s[1])
        if not r['url']: r['url'] = public_url(year, r.get('commune') or r.get('departement'))
        records.append(r)

json.dump(cache, open(CACHE, 'w'))
if missing: sys.exit('communes not found: ' + ', '.join(missing))
json.dump({'source': 'Base des enquêtes de L214 (Notion interne), consultée le 2026-11-18',
           'collectedAt': '2026-11-18', 'investigations': records}, open('layers/france/registre.json', 'w'), ensure_ascii=False, indent=1)
print(len(ROWS), 'enquêtes,', len(records), 'enregistrements')
