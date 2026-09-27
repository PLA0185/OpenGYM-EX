import pathlib,json,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
def read(p):return json.loads(p.read_text(encoding='utf8'))
def write(p,o):p.write_text(json.dumps(o,ensure_ascii=False,separators=(',',':')),encoding='utf8')
recipes=read(ROOT/'frontend/src/data/recipes.json');extra=read(ROOT/'data/official-recipes.json')
recipes=[r for r in recipes if r['id'] not in {e['id'] for e in extra}]+extra
write(ROOT/'frontend/src/data/recipes.json',recipes)
write(ROOT/'frontend/src/data/activity-reference.json',read(ROOT/'data/activity-reference.json'))
lock=read(ROOT/'data/sources.lock.json');source=dict(source='Nutrition.gov partner recipe page',localPath='data/raw/usda-breakfast-smoothie.html',sourceUrl=extra[0]['sourceUrl'],release='checked-2026-09-27',sha256=hashlib.sha256((ROOT/'data/raw/usda-breakfast-smoothie.html').read_bytes()).hexdigest(),license=extra[0]['license'],transformVersion=1)
old=next((s for s in lock['sources'] if s['source']==source['source']),None)
if old and old['sha256']!=source['sha256']:raise ValueError('Official source checksum mismatch')
lock['sources']=[s for s in lock['sources'] if s['source']!=source['source']]+[source];write(ROOT/'data/sources.lock.json',lock)
report=read(ROOT/'data/build-report.json');report['officialIndexedRecipes']=len(extra);write(ROOT/'data/build-report.json',report)
print('Added source-credited recipe and 2024 MET reference')
