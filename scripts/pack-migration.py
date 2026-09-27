"""Private release assets: pinned source cache and optional AI media samples.
Never enumerate private signing or user-data directories into an archive.
"""
import hashlib, json, pathlib, zipfile
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/migration'
OUT.mkdir(parents=True, exist_ok=True)
lock = json.loads((ROOT / 'data/sources.lock.json').read_text(encoding='utf-8'))
manifest = []
with zipfile.ZipFile(OUT / 'source-cache.zip', 'w', compression=zipfile.ZIP_STORED) as archive:
    for source in lock['sources']:
        path = (ROOT / source['localPath']).resolve()
        if not path.is_relative_to((ROOT / 'data/raw').resolve()):
            raise ValueError('Unexpected cache path: ' + source['localPath'])
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != source['sha256']:
            raise ValueError('Pinned source mismatch: ' + source['source'])
        archive.write(path, source['localPath'])
        manifest.append({'source': source['source'], 'path': source['localPath'], 'sha256': digest, 'bytes': path.stat().st_size})
    archive.writestr('source-cache-manifest.json', json.dumps(manifest, ensure_ascii=False, indent=2))
preview = ROOT / 'artifacts/media-preview'
if preview.exists():
    with zipfile.ZipFile(OUT / 'media-preview.zip', 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(preview.rglob('*')):
            if path.is_file() and path.suffix.lower() in {'.png', '.jpg', '.gif', '.md', '.json'}:
                archive.write(path, str(path.relative_to(ROOT)).replace('\\', '/'))
print(json.dumps({'cacheSources': len(manifest), 'cacheBytes': (OUT / 'source-cache.zip').stat().st_size, 'directory': str(OUT)}, ensure_ascii=False))
