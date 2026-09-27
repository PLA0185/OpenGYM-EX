// Verify our actual packaged app, with a fresh test profile and no personal data.
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { EXDB } from '../frontend/src/lib/exercises-data.js'
const root=resolve(import.meta.dirname,'..')
mkdirSync(join(root,'data/raw'),{recursive:true})
const profile=mkdtempSync(join(root,'data/raw/windows-verify-'))
const bench=EXDB.find(e=>e.n==='barbell bench press').id,squat=EXDB.find(e=>e.n==='barbell full squat').id
const fixture={schemaVersion:2,lang:'zh',unit:'kg',sound:false,_ts:Date.now(),routines:[],workouts:[],bodyweight:[],customEx:[],week:{},dayPlan:{},exWeights:{},active:{id:'verification-workout',d:new Date().toISOString().slice(0,10),start:Date.now(),name:'验证用训练',routineId:null,cur:0,entries:[{id:bench,target:{sets:3,reps:10,weight:15},sets:[{w:15,r:8,done:true},{w:15,r:10,done:false},{w:0,r:0,done:false}]},{id:squat,target:{sets:1,reps:10,weight:0},sets:[{w:0,r:10,done:false}]}]}}
writeFileSync(join(profile,'workout-fixture.json'),JSON.stringify(fixture))
const executable=resolve(process.argv[2]||join(root,'artifacts/windows/win-unpacked/DongQi.exe'))
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE
const child=spawn(executable,['--verify-build','--verify-closed-pipe','--verify-profile='+profile],{env,windowsHide:true,stdio:['ignore','pipe','pipe']})
// Reproduce the launcher exiting and closing its stdout/stderr pipe handles.
child.stdout.destroy();child.stderr.destroy()
const timer=setTimeout(()=>{child.kill();process.exitCode=1},180000)
await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error('Packaged verifier exited: '+code)))})
clearTimeout(timer)
const report=JSON.parse(readFileSync(join(profile,'verification-report.json'),'utf8'))
if(report.status!=='PASS'||!report.packaged)throw new Error('Verification failed: '+JSON.stringify(report))
report.checks.push('Closed stdout/stderr EPIPE regression')
writeFileSync(join(root,'artifacts/DongQi-workout-bilingual.png'),readFileSync(join(profile,'workout-completion.png')))
writeFileSync(join(root,'data/raw/windows-verify.json'),JSON.stringify(report,null,2))
process.stdout.write(JSON.stringify(report,null,2)+'\n')
