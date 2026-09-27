"""Selected, manually matched start/end photos. Do not match by fuzzy exercise name."""
import pathlib,json,urllib.request,hashlib,struct,time
ROOT=pathlib.Path(__file__).resolve().parents[2]
commit=next(s['release'] for s in json.loads((ROOT/'data/sources.lock.json').read_text(encoding='utf-8'))['sources'] if s['source']=='Free Exercise DB catalog')
mapping={'0001':'3_4_Sit-Up','0025':'Barbell_Bench_Press_-_Medium_Grip','0027':'Bent_Over_Barbell_Row','0043':'Barbell_Full_Squat','0085':'Romanian_Deadlift','0405':'Dumbbell_Shoulder_Press','0334':'Side_Lateral_Raise','0201':'Triceps_Pushdown','0285':'Dumbbell_Bicep_Curl','0585':'Leg_Extensions','0594':'Seated_Calf_Raise'}
raw=ROOT/'data/raw/free-exercises.json'
locked=next(s for s in json.loads((ROOT/'data/sources.lock.json').read_text(encoding='utf-8'))['sources'] if s['source']=='Free Exercise DB catalog')
if hashlib.sha256(raw.read_bytes()).hexdigest()!=locked['sha256']:raise ValueError('Free Exercise DB catalog checksum mismatch')
catalog={e['id']:e for e in json.loads((ROOT/'data/raw/free-exercises.json').read_text(encoding='utf-8'))}
out=ROOT/'frontend/public/exercise-hq';out.mkdir(exist_ok=True)
def size(data):
    i=2
    while i<len(data):
        if data[i]!=255:i+=1;continue
        marker=data[i+1];i+=2
        if marker in (216,217):continue
        length=struct.unpack('>H',data[i:i+2])[0]
        if marker in (192,193,194):return struct.unpack('>HH',data[i+3:i+7])[::-1]
        i+=length
    raise ValueError('JPEG dimensions missing')
result={};files=[]
for old,new in mapping.items():
    paths=[];dimensions=[]
    for index,path in enumerate(catalog[new]['images'][:2]):
        name=old+'-'+str(index)+'.jpg';target=out/name
        if not target.exists():
            for attempt in range(3):
                try:
                    request=urllib.request.Request('https://raw.githubusercontent.com/yuhonas/free-exercise-db/'+commit+'/exercises/'+path,headers={'User-Agent':'OpenGym-EX-data-build'})
                    with urllib.request.urlopen(request,timeout=15) as response:target.write_bytes(response.read())
                    break
                except Exception:
                    if attempt==2:raise
                    time.sleep(1)
        data=target.read_bytes();w,h=size(data)
        if w<500:raise ValueError('Not higher resolution: '+path)
        paths.append('exercise-hq/'+name);dimensions.append({'width':w,'height':h})
        files.append({'path':'exercise-hq/'+name,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'sourcePath':path})
    result[old]={'images':paths,'dimensions':dimensions,'sourceName':'Free Exercise DB','sourceUrl':'https://github.com/yuhonas/free-exercise-db/blob/'+commit+'/exercises/'+new+'.json','sourceVersion':commit,'license':'Unlicense','type':'two-frame-photo','matching':'manual equipment, position and movement review'}
(ROOT/'frontend/src/data/exercise-hq.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(ROOT/'frontend/public/exercise-hq-manifest.json').write_text(json.dumps({'sourceVersion':commit,'files':files}),encoding='utf-8')
(ROOT/'frontend/public/notices/FREE-EXERCISE-DB.txt').write_bytes((ROOT/'data/FREE_EXERCISE_DB_LICENSE.txt').read_bytes())
print('Higher resolution photos:',len(result),'exercises,',len(files),'frames')
