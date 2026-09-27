"""Bundle the pinned public media for the user's private development build.
The owner is obtaining Gym visual permission; do not treat this as a license grant.
"""
import pathlib,zipfile,json,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
raw=ROOT/'data/raw/exercise-media.zip'
lockpath=ROOT/'data/sources.lock.json'
lock=json.loads(lockpath.read_text(encoding='utf8'))
checksum=hashlib.sha256(raw.read_bytes()).hexdigest()
prior=next((s for s in lock['sources'] if s['source']=='Exercise media'),None)
if prior and prior['sha256']!=checksum:raise ValueError('Media archive checksum mismatch')
commit='7455efae41b330c265e7cd4b78dfa848e7ce5ebd'
source=dict(source='Exercise media',localPath='data/raw/exercise-media.zip',sourceUrl='https://codeload.github.com/hasaneyldrm/exercises-dataset/zip/'+commit,release=commit,sha256=checksum,license='Gym visual; permission pending owner procurement; private development build',transformVersion=1)
lock['sources']=[s for s in lock['sources'] if s['source']!='Exercise media']+[source]
lockpath.write_text(json.dumps(lock,ensure_ascii=False,indent=2),encoding='utf8')
exs=json.loads((ROOT/'data/raw/exercise-names.json').read_text(encoding='utf8'))
manifest=[]
with zipfile.ZipFile(raw) as z:
    prefix=z.namelist()[0].split('/')[0]
    licenseText=z.read(prefix+'/LICENSE')
    (ROOT/'data/EXERCISE_LICENSE.txt').write_bytes(licenseText)
    # Match the upstream application's filename references, not just the new dataset IDs.
    text=(ROOT/'frontend/src/lib/exercises-data.js').read_text(encoding='utf8')
    app=json.loads(text[text.index('['):text.rindex(']')+1])
    for e in app:
        for key,sub,dest in [('img','images','img'),('gif','videos','gif')]:
            name=e[key]
            if '/' in name or '\\' in name:raise ValueError('Invalid media filename')
            data=z.read(prefix+'/'+sub+'/'+name)
            path=ROOT/'frontend/public'/dest/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
            manifest.append(dict(exerciseId=e['id'],path=dest+'/'+name,bytes=len(data),sha256=hashlib.sha256(data).hexdigest()))
result=dict(sourceVersion=commit,archiveSha256=checksum,licenseStatus='permission-pending; private development build',files=manifest)
(ROOT/'frontend/public/media-manifest.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf8')
reportpath=ROOT/'data/build-report.json';report=json.loads(reportpath.read_text(encoding='utf8'));report['offlineExerciseMedia']=len(manifest);report['mediaLicenseStatus']=result['licenseStatus'];reportpath.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
# Restoring the original low-resolution archive must clear HD overrides.
(ROOT/'frontend/src/data/exercise-hd.json').write_text('{}\n',encoding='utf8')
print('Bundled',len(manifest),'media files;',sum(m['bytes'] for m in manifest),'bytes')
