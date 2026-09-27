"""Validate a local media manifest, then replace matching offline assets without resizing.

Dry run by default. --apply requires complete coverage of every built-in exercise.
Input: {sourceName, sourceVersion, exercises:[{exerciseId,nameEn,image,animation}]}.
Paths are relative to the input manifest, JPEG stills and animated GIFs only.
"""
import argparse, hashlib, json, pathlib, re, shutil, struct, tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]

def dimensions(data):
    if data[:6] in (b'GIF87a', b'GIF89a'):
        if len(data) < 13: raise ValueError('Truncated GIF')
        return struct.unpack('<HH', data[6:10])
    if data[:2] != b'\xff\xd8': raise ValueError('Still image must be a JPEG')
    i = 2
    while i + 4 <= len(data):
        if data[i] != 255: raise ValueError('Invalid JPEG marker')
        while i < len(data) and data[i] == 255: i += 1
        marker = data[i]; i += 1
        length = int.from_bytes(data[i:i+2], 'big')
        if length < 2 or i + length > len(data): raise ValueError('Truncated JPEG')
        if marker in (0xC0, 0xC1, 0xC2):
            if length < 8: raise ValueError('Invalid JPEG dimensions')
            h, w = struct.unpack('>HH', data[i+3:i+7]); return w, h
        i += length
    raise ValueError('JPEG dimensions missing')

def gif_frames(data):
    dimensions(data)
    if data[:6] not in (b'GIF87a', b'GIF89a'): raise ValueError('Animation must be a GIF')
    i = 13 + (3 * (2 ** ((data[10] & 7) + 1)) if data[10] & 128 else 0)
    count = 0
    def blocks(pos):
        while pos < len(data):
            size = data[pos]; pos += 1
            if not size: return pos
            if pos + size > len(data): raise ValueError('Truncated GIF data block')
            pos += size
        raise ValueError('GIF terminator missing')
    while i < len(data):
        tag = data[i]; i += 1
        if tag == 0x3B: return count
        if tag == 0x21:
            if i >= len(data): raise ValueError('Truncated GIF extension')
            i = blocks(i + 1)
        elif tag == 0x2C:
            if i + 9 > len(data): raise ValueError('Truncated GIF frame')
            flags = data[i+8]; i += 9
            if flags & 128: i += 3 * (2 ** ((flags & 7) + 1))
            if i >= len(data): raise ValueError('Truncated GIF color table')
            i = blocks(i + 1); count += 1
        else: raise ValueError('Invalid GIF block')
    raise ValueError('GIF trailer missing')

def normal(text):
    return re.sub(r'\s+', ' ', str(text).casefold()).strip()

def catalog():
    text = (ROOT/'frontend/src/lib/exercises-data.js').read_text(encoding='utf-8')
    return json.loads(text[text.index('['):text.rindex(']')+1])

def inspect(manifest_path, exercises):
    manifest_path = pathlib.Path(manifest_path).resolve()
    pack = json.loads(manifest_path.read_text(encoding='utf-8-sig'))
    if not pack.get('sourceName') or not pack.get('sourceVersion'): raise ValueError('Source name/version required')
    rows = pack.get('exercises')
    if not isinstance(rows, list): raise ValueError('exercises must be an array')
    known = {e['id']:e for e in exercises}; seen = set(); valid = {}; errors = []
    for row in rows:
        identifier = str(row.get('exerciseId', ''))
        try:
            if identifier in seen: raise ValueError('Duplicate ID')
            seen.add(identifier)
            e = known.get(identifier)
            if not e: raise ValueError('Unknown ID')
            if normal(row.get('nameEn', '')) != normal(e['n']): raise ValueError('ID/name mismatch; review mapping manually')
            values = {}
            for key, extension in [('image','.jpg'),('animation','.gif')]:
                path = (manifest_path.parent/row[key]).resolve()
                if path.suffix.lower() not in (['.jpg','.jpeg'] if key=='image' else ['.gif']): raise ValueError('Unsupported '+key+' format')
                data = path.read_bytes(); w,h = dimensions(data)
                if min(w,h) < 720: raise ValueError(key+' is below 720px on its shorter side')
                frames = gif_frames(data) if key=='animation' else 1
                if key=='animation' and frames < 2: raise ValueError('Animation contains fewer than two frames')
                values[key] = dict(path=str(path),width=w,height=h,frames=frames,bytes=len(data),sha256=hashlib.sha256(data).hexdigest())
            valid[identifier] = values
        except (ValueError, KeyError, OSError, struct.error) as error:
            errors.append(dict(exerciseId=identifier,error=str(error)))
    missing = sorted(set(known)-set(valid))
    return pack, valid, dict(totalExercises=len(known),validExercises=len(valid),missingIds=missing,errors=errors,complete=not missing and not errors,quality='Dimensions and structural animation checks; source fidelity and movement must still be visually reviewed')

def apply(pack, valid, exercises):
    # Prepare the entire validated set before replacing any existing runtime assets.
    public = ROOT/'frontend/public'; public.mkdir(exist_ok=True)
    manifest = []; metadata = {}
    with tempfile.TemporaryDirectory(prefix='hd-media-',dir=ROOT/'data/raw') as staging:
        stage = pathlib.Path(staging)
        for e in exercises:
            values = valid[e['id']]
            for key,sub,filename in [('image','img',e['img']),('animation','gif',e['gif'])]:
                file = values[key]; target=stage/sub/filename; target.parent.mkdir(parents=True,exist_ok=True)
                shutil.copyfile(file['path'],target)
                if hashlib.sha256(target.read_bytes()).hexdigest()!=file['sha256']: raise ValueError('Source changed during import')
                manifest.append(dict(exerciseId=e['id'],path=sub+'/'+filename,**{k:file[k] for k in ['width','height','frames','bytes','sha256']}))
            metadata[e['id']]={k:{f:values[k][f] for f in ['width','height','frames']} for k in ['image','animation']}
            metadata[e['id']].update(sourceName=pack['sourceName'],sourceVersion=pack['sourceVersion'])
        for item in manifest:
            target=public/item['path']; target.parent.mkdir(parents=True,exist_ok=True); shutil.copyfile(stage/item['path'],target)
    (public/'media-manifest.json').write_text(json.dumps(dict(sourceName=pack['sourceName'],sourceVersion=pack['sourceVersion'],quality='full-hd-source-assets',files=manifest),ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    (ROOT/'frontend/src/data/exercise-hd.json').write_text(json.dumps(metadata,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest',nargs='?'); parser.add_argument('--apply',action='store_true');parser.add_argument('--template',action='store_true')
    args=parser.parse_args(); exercises=catalog(); raw=ROOT/'data/raw';raw.mkdir(exist_ok=True)
    if args.template:
        path=raw/'hd-media-template.json'
        path.write_text(json.dumps(dict(sourceName='填实际供应商',sourceVersion='填素材版本',exercises=[dict(exerciseId=e['id'],nameEn=e['n'],image='images/'+e['id']+'.jpg',animation='animations/'+e['id']+'.gif') for e in exercises]),ensure_ascii=False,indent=2),encoding='utf-8')
        print(path); raise SystemExit(0)
    if not args.manifest: parser.error('manifest path required')
    pack, valid, report=inspect(args.manifest,exercises)
    (raw/'hd-media-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k not in ['missingIds','errors']},ensure_ascii=False));print('Full report:',raw/'hd-media-report.json')
    if args.apply:
        if not report['complete']: raise SystemExit('No changes applied: complete matching HD images AND animations are required.')
        apply(pack,valid,exercises);print('Imported complete HD source pack without resizing.')
