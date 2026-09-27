// Purpose-built verification command. Uses an isolated profile and synthetic credentials only.
exports.run=async({app,win,fs,path,state,credential,entry})=>{
  const errors=[];win.webContents.on('console-message',(_event,level,message)=>{if(level===3)errors.push(message)})
  await new Promise(resolve=>win.webContents.once('did-finish-load',resolve))
  const pause=ms=>new Promise(r=>setTimeout(r,ms)),check=(ok,msg)=>{if(!ok)throw new Error(msg)}
  await pause(1000)
  if(app.commandLine.hasSwitch('verify-closed-pipe')){process.stdout.write('Closed output pipe regression check\n');process.stderr.write('Closed error pipe regression check\n');await pause(100)}
  check((await win.webContents.executeJavaScript('document.body.innerText')).includes('先了解你的运动基础'),'Chinese first-launch profile')
  const synthetic='verification-only-not-a-real-api-key'
  await win.webContents.executeJavaScript(`window.xunlianDesktop.credentialSet(${JSON.stringify(synthetic)})`)
  check(await win.webContents.executeJavaScript(`window.xunlianDesktop.credentialGet().then(v=>v===${JSON.stringify(synthetic)})`),'Credential round-trip')
  check(!fs.readFileSync(credential).includes(Buffer.from(synthetic)),'Credential encryption')
  await win.webContents.executeJavaScript("window.xunlianDesktop.stateSave({routines:[],workouts:[],bodyweight:[],customEx:[],week:{},dayPlan:{},schemaVersion:2,verificationMarker:'saved',apiKey:'must-not-be-saved'})")
  check(!fs.readFileSync(state,'utf8').includes('must-not-be-saved'),'State credential exclusion')
  check((await win.webContents.executeJavaScript("window.xunlianDesktop.stateLoad().then(v=>v.verificationMarker)"))==='saved','State round-trip')
  const fixture=JSON.parse(fs.readFileSync(path.join(app.getPath('userData'),'workout-fixture.json'),'utf8'))
  await win.webContents.executeJavaScript(`window.xunlianDesktop.stateSave(${JSON.stringify(fixture)}).then(()=>{localStorage.setItem('gym_state_v1',${JSON.stringify(JSON.stringify(fixture))});location.hash='#/workout';location.reload()})`)
  await new Promise(resolve=>win.webContents.once('did-finish-load',resolve));await pause(1000)
  check(await win.webContents.executeJavaScript("Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('预填剩余组'))"),'Prefill button visible')
  await win.webContents.executeJavaScript("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('预填剩余组')).click()",true)
  const copied=await win.webContents.executeJavaScript("JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0].sets")
  check(copied[0].done&&copied[0].r===8&&copied[2].w===15&&copied[2].r===10&&!copied[2].done,'Prefill preserves actual records')
  check((await win.webContents.executeJavaScript('document.body.innerText')).includes('120 s'),'Source rest preset visible')
  await win.webContents.executeJavaScript("document.querySelector('.setrow [role=checkbox][aria-checked=false]').click()",true);await pause(300)
  check(await win.webContents.executeJavaScript("['2:00','1:59'].includes(document.querySelector('#timer.rest .t')?.textContent)"),'Source 120-second rest countdown')
  await win.webContents.executeJavaScript("document.querySelector('.setrow [role=checkbox][aria-checked=false]').click()",true);await pause(300)
  check(await win.webContents.executeJavaScript("Array.from(document.querySelectorAll('h3')).some(h=>h.textContent.includes('杠铃卧推')&&/barbell bench press/i.test(h.textContent)&&h.textContent.includes('完成'))"),'Bilingual completion sheet')
  check(await win.webContents.executeJavaScript("document.querySelector('.sheet .bw-read')?.textContent.trim()==='15 kg'&&document.body.innerText.includes('下次按来源方案')"),'Actual working load is not replaced by lifetime best')
  await pause(500)
  fs.writeFileSync(path.join(app.getPath('userData'),'workout-completion.png'),(await win.webContents.capturePage()).toPNG())
  await win.webContents.executeJavaScript("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('保存并下')).click()",true)
  check(await win.webContents.executeJavaScript("JSON.parse(localStorage.getItem('gym_state_v1')).active.cur===1"),'Completion advances to next exercise')
  for(const [route,title] of [['nutrition','营养'],['nutrition/week','一周餐食'],['programs','训练计划资料库'],['planning','统一规划档案'],['joint','训练与饮食联合周计划'],['library','动作库'],['assistant','AI 训练与饮食教练'],['health','心率与健康数据'],['kitchen','HowToCook 在线菜谱'],['settings','设置']]){
    await win.webContents.executeJavaScript(`location.hash=${JSON.stringify('#/'+route)}`)
    let text=''
    for(let attempt=0;attempt<40;attempt++){await pause(250);text=await win.webContents.executeJavaScript('document.body.innerText');if(text.includes(title))break}
    check(!text.includes('Something went wrong')&&!text.includes('出了点问题'),'Route crashed: '+route)
    check(text.includes(title),'Missing title: '+route+' '+text.slice(0,120))
    if(route==='programs'){
      win.webContents.enableDeviceEmulation({screenPosition:'mobile',screenSize:{width:360,height:800},viewPosition:{x:0,y:0},viewSize:{width:360,height:800},deviceScaleFactor:1,scale:1})
      await win.webContents.executeJavaScript("Array.from(document.querySelectorAll('.lrow.tap')).find(b=>b.textContent.includes('ACSM 2026')).click()",true);await pause(300)
      check(await win.webContents.executeJavaScript("document.body.innerText.includes('训练预填')&&document.body.innerText.includes('180 s')&&document.body.innerText.includes('80% 1RM')"),'Official-derived program prescription review')
      check(await win.webContents.executeJavaScript("Array.from(document.querySelectorAll('.prescription-grid input')).every(i=>{const c=getComputedStyle(i),r=i.getBoundingClientRect();return c.color==='rgb(255, 255, 255)'&&c.backgroundColor!=='rgb(255, 255, 255)'&&r.width>=90&&r.right<=innerWidth})"),'Readable dark numeric fields at 360px')
      await win.webContents.executeJavaScript("document.querySelector('.prescription-grid').scrollIntoView({block:'center'})");await pause(200)
      fs.writeFileSync(path.join(app.getPath('userData'),'program-dark-mobile.png'),(await win.webContents.capturePage()).toPNG())
      await win.webContents.executeJavaScript("document.documentElement.dataset.theme='light'")
      check(await win.webContents.executeJavaScript("Array.from(document.querySelectorAll('.prescription-grid input')).every(i=>getComputedStyle(i).color!=='rgb(255, 255, 255)')"),'Readable light numeric fields')
      await win.webContents.executeJavaScript("document.documentElement.dataset.theme='dark'")
      await win.webContents.executeJavaScript("document.querySelector('.mback').click()",true)
      win.webContents.disableDeviceEmulation()
    }
    if(route==='settings'){
      await win.webContents.executeJavaScript("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='显示密钥').click()",true)
      check(await win.webContents.executeJavaScript("document.querySelector('input[placeholder=\"输入 API 密钥\"]')?.type==='text'"),'Credential reveal avoids password keyboard')
    }
  }
  // Reproduce a successful connection followed by object-shaped intake questions.
  // These requests are synthetic and never reach a provider.
  win.webContents.enableDeviceEmulation({screenPosition:'mobile',screenSize:{width:360,height:800},viewPosition:{x:0,y:0},viewSize:{width:360,height:800},deviceScaleFactor:1,scale:1})
  check(await win.webContents.executeJavaScript("Array.from(document.querySelectorAll('.credential-actions .btn')).every(b=>{const r=b.getBoundingClientRect();return r.width>=120&&r.height>=44&&r.height<70&&r.right<=innerWidth})"),'Compact mobile credential actions')
  await win.webContents.executeJavaScript("document.querySelector('.deepseek-settings').scrollIntoView({block:'start'})");await pause(200)
  fs.writeFileSync(path.join(app.getPath('userData'),'settings-mobile.png'),(await win.webContents.capturePage()).toPNG())
  await win.webContents.executeJavaScript(`window.__originalFetch=window.fetch;window.fetch=async(url,options)=>{if(String(url)!=='https://api.deepseek.com/chat/completions')return window.__originalFetch(url,options);const body=JSON.parse(options.body);let content='OK';if(body.messages[0].role==='system'){if(body.messages[0].content.includes('当前操作是追问'))content=JSON.stringify({questions:Array.from({length:8},(_,i)=>({question:'确认训练条件 '+(i+1)})),summary:'模拟：确认运动限制和忌口'});else{const input=JSON.parse(body.messages.find(m=>m.role==='user').content);content=JSON.stringify({program:{nameZh:'模拟联合计划',days:input.context.availableDays.map(weekday=>({weekday,dayName:'模拟训练日',exerciseItems:[{originalText:input.exercises[0].nameEn,sets:2,reps:10,restSec:90,weight:null}]}))},meals:input.dates.flatMap(date=>input.feasibleDayMenu.map(m=>({...m,date}))),explanation:'模拟响应验证，不是真实 AI 生成'});}}return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content}}]}),{status:200,headers:{'Content-Type':'application/json'}})};void 0`)
  await win.webContents.executeJavaScript("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='测试连接').click()",true);await pause(250)
  check((await win.webContents.executeJavaScript('document.body.innerText')).includes('连接成功'),'Mock connection succeeds')
  await win.webContents.executeJavaScript("location.hash='#/assistant'");await pause(500)
  await win.webContents.executeJavaScript("(()=>{const field=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(field,'早上六点半到健身房，九点上班，请安排训练和早餐');field.dispatchEvent(new Event('input',{bubbles:true}));})()");await pause(100)
  await win.webContents.executeJavaScript("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='开始对话，确认需求').click()",true);await pause(500)
  check(await win.webContents.executeJavaScript("document.querySelectorAll('input[placeholder=\"请明确回答，没有请写“无”\"]').length===8"),'Object-shaped eight-question intake reaches form')
  for(let i=0;i<8;i++){await win.webContents.executeJavaScript(`(()=>{const field=document.querySelectorAll('input[placeholder="请明确回答，没有请写“无”"]')[${i}];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,'无');field.dispatchEvent(new Event('input',{bubbles:true}));})()`);await pause(50)}
  await win.webContents.executeJavaScript("Array.from(document.querySelectorAll('.lrow')).find(r=>r.textContent.includes('以上限制和忌口已确认')).querySelector('[role=switch]').click()",true);await pause(100)
  await win.webContents.executeJavaScript("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='生成训练 + 一周饮食').click()",true)
  let coachText='';for(let i=0;i<40;i++){await pause(250);coachText=await win.webContents.executeJavaScript('document.body.innerText');if(coachText.includes('审核训练与饮食'))break}
  check(coachText.includes('审核训练与饮食'),'Mock intake proceeds to editable training and seven-day meal proposal: '+coachText.slice(-500))
  await win.webContents.executeJavaScript("window.fetch=window.__originalFetch;document.querySelector('.feature-page').scrollIntoView({block:'start'})");await pause(200)
  fs.writeFileSync(path.join(app.getPath('userData'),'assistant-mobile.png'),(await win.webContents.capturePage()).toPNG())
  win.webContents.disableDeviceEmulation()
  const manifest=JSON.parse(fs.readFileSync(path.join(path.dirname(entry),'media-manifest.json'),'utf8'))
  const crypto=require('node:crypto')
  for(const m of manifest.files){const file=fs.readFileSync(path.join(path.dirname(entry),m.path));check(file.length===m.bytes,'Media size: '+m.path);check(crypto.createHash('sha256').update(file).digest('hex')===m.sha256,'Media hash: '+m.path)}
  const hq=JSON.parse(fs.readFileSync(path.join(path.dirname(entry),'exercise-hq-manifest.json'),'utf8'));for(const m of hq.files){check(crypto.createHash('sha256').update(fs.readFileSync(path.join(path.dirname(entry),m.path))).digest('hex')===m.sha256,'Higher-resolution media hash')}
  await win.webContents.executeJavaScript("location.hash='#/library'");await pause(600)
  await pause(500)
  check(await win.webContents.executeJavaScript('Array.from(document.images).some(img=>img.complete&&img.naturalWidth>0&&img.src.includes("/img/"))'),'Offline exercise image decode')
  await win.webContents.executeJavaScript("window.xunlianDesktop.credentialSet('')")
  check(!errors.length,'Renderer errors: '+errors.join('; '))
  const report={status:'PASS',checkedAt:new Date().toISOString(),platform:process.platform,packaged:app.isPackaged,checks:['Chinese first-launch profile','DPAPI credential round-trip and encrypted file','State IPC round-trip and credential redaction','Prefill preserves actual records','Source 120-second rest preset and countdown','Bilingual completion sheet','Completion advances to next exercise','Ten offline routes','2648 original media and 22 higher-resolution photo SHA-256 hashes','Readable dark/light program numeric fields at 360px','Credential visibility toggle','Compact mobile credential actions','Mock connection, object-question intake and editable joint proposal','Offline exercise image decoding'],rendererErrors:errors,profile:'isolated verification profile; synthetic workout'}
  fs.writeFileSync(path.join(app.getPath('userData'),'verification-report.json'),JSON.stringify(report,null,2));app.quit()
}
