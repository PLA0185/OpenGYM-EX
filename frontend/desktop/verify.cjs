// Purpose-built verification command. Uses an isolated profile and synthetic credentials only.
exports.run=async({app,win,fs,path,state,credential,entry})=>{
  const errors=[];win.webContents.on('console-message',(_event,level,message)=>{if(level===3)errors.push(message)})
  await new Promise(resolve=>win.webContents.once('did-finish-load',resolve))
  const pause=ms=>new Promise(r=>setTimeout(r,ms)),check=(ok,msg)=>{if(!ok)throw new Error(msg)}
  await pause(1000)
  if(app.commandLine.hasSwitch('verify-closed-pipe')){process.stdout.write('Closed output pipe regression check\n');process.stderr.write('Closed error pipe regression check\n');await pause(100)}
  check((await win.webContents.executeJavaScript('document.body.innerText')).includes('循练'),'Chinese startup')
  const synthetic='verification-only-not-a-real-api-key'
  await win.webContents.executeJavaScript(`window.xunlianDesktop.credentialSet(${JSON.stringify(synthetic)})`)
  check(await win.webContents.executeJavaScript(`window.xunlianDesktop.credentialGet().then(v=>v===${JSON.stringify(synthetic)})`),'Credential round-trip')
  check(!fs.readFileSync(credential).includes(Buffer.from(synthetic)),'Credential encryption')
  await win.webContents.executeJavaScript("window.xunlianDesktop.stateSave({routines:[],workouts:[],bodyweight:[],customEx:[],week:{},dayPlan:{},schemaVersion:2,verificationMarker:'saved',apiKey:'must-not-be-saved'})")
  check(!fs.readFileSync(state,'utf8').includes('must-not-be-saved'),'State credential exclusion')
  check((await win.webContents.executeJavaScript("window.xunlianDesktop.stateLoad().then(v=>v.verificationMarker)"))==='saved','State round-trip')
  for(const [route,title] of [['nutrition','营养'],['nutrition/week','一周餐食'],['programs','训练计划资料库'],['planning','统一规划档案'],['joint','训练与饮食联合周计划'],['library','动作库']]){
    await win.webContents.executeJavaScript(`location.hash=${JSON.stringify('#/'+route)}`)
    let text=''
    for(let attempt=0;attempt<40;attempt++){await pause(250);text=await win.webContents.executeJavaScript('document.body.innerText');if(text.includes(title))break}
    check(!text.includes('Something went wrong')&&!text.includes('出了点问题'),'Route crashed: '+route)
    check(text.includes(title),'Missing title: '+route+' '+text.slice(0,120))
  }
  const manifest=JSON.parse(fs.readFileSync(path.join(path.dirname(entry),'media-manifest.json'),'utf8'))
  const crypto=require('node:crypto')
  for(const m of manifest.files){const file=fs.readFileSync(path.join(path.dirname(entry),m.path));check(file.length===m.bytes,'Media size: '+m.path);check(crypto.createHash('sha256').update(file).digest('hex')===m.sha256,'Media hash: '+m.path)}
  await pause(500)
  check(await win.webContents.executeJavaScript('Array.from(document.images).some(img=>img.complete&&img.naturalWidth>0&&img.src.includes("/img/"))'),'Offline exercise image decode')
  await win.webContents.executeJavaScript("window.xunlianDesktop.credentialSet('')")
  check(!errors.length,'Renderer errors: '+errors.join('; '))
  const report={status:'PASS',checkedAt:new Date().toISOString(),platform:process.platform,packaged:app.isPackaged,checks:['Chinese startup','DPAPI credential round-trip and encrypted file','State IPC round-trip and credential redaction','Six offline routes','2648 packaged media SHA-256 hashes','Offline exercise image decoding'],rendererErrors:errors,profile:'isolated verification profile'}
  fs.writeFileSync(path.join(app.getPath('userData'),'verification-report.json'),JSON.stringify(report,null,2));app.quit()
}
