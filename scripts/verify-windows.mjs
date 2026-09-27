// Verify our actual packaged app, with a fresh test profile and no personal data.
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
const root=resolve(import.meta.dirname,'..')
mkdirSync(join(root,'data/raw'),{recursive:true})
const profile=mkdtempSync(join(root,'data/raw/windows-verify-'))
const executable=resolve(process.argv[2]||join(root,'artifacts/windows/win-unpacked/Xunlian.exe'))
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE
const child=spawn(executable,['--verify-build','--verify-closed-pipe','--verify-profile='+profile],{env,windowsHide:true,stdio:['ignore','pipe','pipe']})
// Reproduce the launcher exiting and closing its stdout/stderr pipe handles.
child.stdout.destroy();child.stderr.destroy()
const timer=setTimeout(()=>{child.kill();process.exitCode=1},60000)
await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error('Packaged verifier exited: '+code)))})
clearTimeout(timer)
const report=JSON.parse(readFileSync(join(profile,'verification-report.json'),'utf8'))
if(report.status!=='PASS'||!report.packaged)throw new Error('Verification failed: '+JSON.stringify(report))
report.checks.push('Closed stdout/stderr EPIPE regression')
writeFileSync(join(root,'data/raw/windows-verify.json'),JSON.stringify(report,null,2))
process.stdout.write(JSON.stringify(report,null,2)+'\n')
