import { build } from 'vite'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
if(!existsSync('public/media-manifest.json'))throw new Error('Offline media manifest missing. Run npm run data:bootstrap first.')
const manifest=JSON.parse(readFileSync('public/media-manifest.json','utf8'))
for(const m of manifest.files){const file=readFileSync(resolve('public',m.path));if(file.length!==m.bytes||createHash('sha256').update(file).digest('hex')!==m.sha256)throw new Error('Offline media checksum mismatch: '+m.path)}
const hq=JSON.parse(readFileSync('public/exercise-hq-manifest.json','utf8'))
for(const m of hq.files){if(createHash('sha256').update(readFileSync(resolve('public',m.path))).digest('hex')!==m.sha256)throw new Error('HQ media checksum mismatch: '+m.path)}
const hd=JSON.parse(readFileSync('src/data/exercise-hd.json','utf8'))
for(const [id,meta] of Object.entries(hd))for(const key of ['image','animation']){const item=manifest.files.find(m=>m.exerciseId===id&&m.path.startsWith(key==='image'?'img/':'gif/'));if(!item||item.width!==meta[key].width||item.height!==meta[key].height||Math.min(item.width,item.height)<720||(key==='animation'&&item.frames<2))throw new Error('Invalid HD override: '+id)}
mkdirSync('public/notices',{recursive:true})
for(const [source,dest] of [['../data/FREE_EXERCISE_DB_LICENSE.txt','FREE-EXERCISE-DB.txt'],['../LICENSE','AGPL.txt'],['../NOTICE.md','THIRD-PARTY.md'],['../data/HOWTOCOOK_LICENSE.txt','HOWTOCOOK.txt'],['../data/EXERCISE_LICENSE.txt','EXERCISE.txt']])copyFileSync(source,'public/notices/'+dest)
process.env.VITE_MOBILE='1'
process.env.VITE_IMG_BASE='img/'
process.env.VITE_GIF_BASE='gif/'
process.env.VITE_OFFLINE_MEDIA='bundled'
await build()
if(process.argv.includes('--android')) {
  const r=spawnSync(process.execPath,['node_modules/@capacitor/cli/bin/capacitor','sync','android'],{stdio:'inherit'})
  if(r.status!==0)process.exit(r.status||1)
}
