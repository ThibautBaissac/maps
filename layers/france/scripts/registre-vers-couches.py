# Converts the investigations register (layers/france/registre.json) into the enquetes layer
# source (layers/france/enquetes.geojson) and the list of investigations without a place in
# metropolitan France (places/investigations.ts). Run from the repository root:
#   python3 -I layers/france/scripts/registre-vers-couches.py
# then npm run layers -- france. Method in layers/france/README.md.
import json,collections
r=json.load(open('layers/france/registre.json'))
inv=r['investigations']
NOT_L214={'kapparot-marseille-2016','abattoirs-chevaux-canada-2010-2011'}
pre=[i for i in inv if i['year']<2008]
print('pre-2008',len(pre),sorted({i.get('group') or i['id'] for i in pre}))
deps=json.load(open('layers/france/departements.geojson'))
def bbox_centre(polys):
    best=None;ba=-1
    for poly in polys:
        ring=poly[0]; a=0
        for (x0,y0),(x1,y1) in zip(ring,ring[1:]): a+=x0*y1-x1*y0
        if abs(a)>ba: ba=abs(a);best=ring
    xs=[p[0] for p in best]; ys=[p[1] for p in best]
    return [(min(xs)+max(xs))/2,(min(ys)+max(ys))/2]
dc={};dreg={}
for f in deps['features']:
    g=f['geometry']; polys=g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
    dc[f['properties']['code']]=bbox_centre(polys); dreg[f['properties']['code']]=f['properties']['region']
rc={}
for reg in set(dreg.values()):
    pts=[dc[d] for d in dc if dreg[d]==reg]; rc[reg]=[sum(p[0] for p in pts)/len(pts),sum(p[1] for p in pts)/len(pts)]
feats=[];unloc={}
for i in inv:
    if i['year']<2008 or i['id'] in NOT_L214: continue
    url=i['urls'][0] if i.get('urls') else ''
    p=i['precision']
    if p in ('commune','departement','region'):
        if p=='commune': coords=[i['lon'],i['lat']]
        elif p=='departement': coords=dc[i['departement']]
        else: coords=rc[i['region']]
        if p!='region': assert dreg[i['departement']]==i['region'],i['id']
        props={'title':i['title'],'site':i['site'],'year':i['year'],'precision':p,'region':i['region']}
        if p=='commune': props['commune']=i['commune']
        if i.get('departement'): props['departement']=i['departement']
        props['species']=','.join(i['species']); props['url']=url
        if i.get('group'): props['group']=i['group']
        feats.append({'type':'Feature','properties':props,'geometry':{'type':'Point','coordinates':[round(coords[0],4),round(coords[1],4)]}})
    else:
        k=i.get('group') or i['id']
        unloc.setdefault(k,(i['year'],i['title'],i['site'],url,p))
feats.sort(key=lambda f:(f['properties']['year'],f['properties']['title']))
json.dump({'type':'FeatureCollection','features':feats},open('layers/france/enquetes.geojson','w'),ensure_ascii=False,indent=1)
print('located',len(feats),collections.Counter(f['properties']['precision'] for f in feats))
print('unlocated',len(unloc),collections.Counter(v[4] for v in unloc.values()))
print('years',min(f['properties']['year'] for f in feats),max(f['properties']['year'] for f in feats))
lg={f['properties'].get('group') for f in feats}
print('mixed groups',[k for k in unloc if k in lg])
print('distinct located investigations', len({f['properties'].get('group') or f['properties']['title'] for f in feats}))
def ts(s): return "'"+s.replace('\\','\\\\').replace("'","\\'")+"'"
rows=sorted(unloc.values())
body='\n'.join(f"  {{ year: {y}, site: '{s}', name: {ts(t)}, url: {ts(u)} }}," for y,t,s,u,p in rows)
ts_file='places/investigations.ts'
src=open(ts_file).read()
start=src.index('= [\n')+4; end=src.index('\n];',start)
open(ts_file,'w').write(src[:start]+body+src[end:])
for y,t,s,u,p in rows: print(y,p,s,t[:70])
