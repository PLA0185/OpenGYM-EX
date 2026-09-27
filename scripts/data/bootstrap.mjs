import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
const root=resolve(import.meta.dirname,'../..'), lock=JSON.parse(readFileSync(resolve(root,'data/sources.lock.json')))
for(const source of lock.sources) {
  const path=resolve(root,source.localPath);mkdirSync(resolve(path,'..'),{recursive:true})
  if(!existsSync(path)) {
    const r=spawnSync('curl.exe',['-L','--fail','--retry','2','--max-time','900','-o',path,source.sourceUrl],{stdio:'inherit'})
    if(r.status!==0)throw new Error('Download failed: '+source.source)
  }
}
writeFileSync(resolve(root,'data/raw/howtocook-commit.json'),JSON.stringify({sha:lock.sources.find(s=>s.source==='HowToCook').release}))
const r=spawnSync('python',['-X','utf8',resolve(root,'scripts/data/build-seed.py')],{cwd:root,stdio:'inherit'})
if(r.status!==0)process.exit(r.status||1)

for(const file of ['build-media.py','build-references.py']){const r=spawnSync('python',['-X','utf8',resolve(root,'scripts/data',file)],{cwd:root,stdio:'inherit'});if(r.status!==0)process.exit(r.status||1)}
