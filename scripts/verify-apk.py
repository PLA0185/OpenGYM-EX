"""Verify the actual personal APK: native version/signature and exact offline assets."""
import hashlib, json, os, pathlib, re, subprocess, zipfile
ROOT = pathlib.Path(__file__).resolve().parents[1]
version = json.loads((ROOT / 'frontend/package.json').read_text(encoding='utf-8'))['version']
apk = ROOT / ('artifacts/OpenGymEX-' + version + '-personal.apk')
sdk = pathlib.Path(os.environ.get('ANDROID_HOME', 'D:/DeepSeekHarnessData/android-sdk'))
tools = sdk / 'build-tools/36.0.0'
badging = subprocess.run([str(tools / 'aapt.exe'), 'dump', 'badging', str(apk)], capture_output=True, text=True, check=True).stdout
if "name='app.xunlian.personal'" not in badging or "versionName='" + version + "-dev'" not in badging:
    raise ValueError('APK identity/version mismatch')
jdk = pathlib.Path(os.environ.get('JAVA_HOME', 'D:/DeepSeekHarnessData/jdk-21'))
signing = subprocess.run([str(jdk / 'bin/java.exe'), '-jar', str(tools / 'lib/apksigner.jar'), 'verify', '--verbose', '--print-certs', str(apk)], capture_output=True, text=True, check=True).stdout
certificate = '100d6bb2cc70e95b8b203935bbdc62de4f15a5e478465c78aafd74e77d60285f'
if certificate not in signing or 'Verified using v2 scheme (APK Signature Scheme v2): true' not in signing or 'Verified using v3 scheme (APK Signature Scheme v3): true' not in signing:
    raise ValueError('APK certificate or signature mismatch')
def sha(data): return hashlib.sha256(data).hexdigest()
dist = ROOT / 'frontend/dist'
with zipfile.ZipFile(apk) as archive:
    count = 0
    for local in dist.rglob('*'):
        if local.is_file():
            path = 'assets/public/' + str(local.relative_to(dist)).replace('\\', '/')
            if sha(archive.read(path)) != sha(local.read_bytes()): raise ValueError('APK web asset mismatch: ' + path)
            count += 1
    media = json.loads(archive.read('assets/public/media-manifest.json'))
    hq = json.loads(archive.read('assets/public/exercise-hq-manifest.json'))
    for item in media['files'] + hq['files']:
        if sha(archive.read('assets/public/' + item['path'])) != item['sha256']: raise ValueError('APK media mismatch')
    plugins = json.loads(archive.read('assets/capacitor.plugins.json'))
    if not any(p.get('classpath') == 'com.capacitorjs.plugins.app.AppPlugin' for p in plugins):
        raise ValueError('Android back plugin missing')
    notices = [n for n in archive.namelist() if n.startswith('assets/public/notices/') and not n.endswith('/')]
    if len(notices) < 5: raise ValueError('License notices missing')
report = dict(status='PASS', version=version, applicationId='app.xunlian.personal', versionCode=int(re.search(r"versionCode='(\d+)'", badging)[1]), certificateSha256=certificate, apkSha256=sha(apk.read_bytes()), bytes=apk.stat().st_size, identicalDistFiles=count, originalMedia=len(media['files']), higherResolutionPhotos=len(hq['files']), notices=len(notices), androidBackPlugin=True, physicalDevice='not tested')
(ROOT / 'artifacts/verification-apk.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False, indent=2))
