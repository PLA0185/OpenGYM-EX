// Real renderer checks: the long summary must have its own width, and scrolling
// must advance in frames rather than be reset by its resize observer.
exports.run=async({win,check,pause,fs,path,app})=>{
  const readable=await win.webContents.executeJavaScript(`(()=>{
    const target=[...document.querySelectorAll('.lrow')].find(r=>r.querySelector('.lrow-t')?.textContent==='营养目标')||document.querySelector('.nutrition-target');
    const basis=target?.querySelector('.lrow-s,.target-basis');
    return !!basis&&basis.getBoundingClientRect().width>=target.getBoundingClientRect().width-36;
  })()`)
  await win.webContents.executeJavaScript("document.querySelector('.day-dates button:first-child').click()",true);await pause(450)
  const motion=await win.webContents.executeJavaScript(`new Promise(resolve=>{
    const rail=document.querySelector('.day-track'),positions=[rail.scrollLeft];let started=performance.now();
    const frame=()=>{positions.push(rail.scrollLeft);if(performance.now()-started<650)requestAnimationFrame(frame);else resolve(positions)};
    document.querySelector('.day-dates button:nth-child(2)').click();requestAnimationFrame(frame);
  })`)
  check(motion.at(-1)>300&&motion.filter((x,i)=>i&&Math.abs(x-motion[i-1])>1).length>=4&&motion.every((x,i)=>!i||Math.abs(x-motion[i-1])<150),'Date change scrolls continuously without observer snapping')
  check(readable,'Nutrition basis gets full readable width, never a squeezed value column')
  await win.webContents.executeJavaScript("document.querySelector('.day-track').scrollIntoView({block:'center'})");await pause(150)
  const point=await win.webContents.executeJavaScript("(()=>{const r=document.querySelector('.day-track').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+Math.min(40,r.height/2)}})()")
  win.webContents.debugger.attach('1.3')
  try{
    await win.webContents.debugger.sendCommand('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1})
    await win.webContents.executeJavaScript("window.__touchFrames=[];window.__touchEvents=[];window.__touchSampling=true;document.querySelector('.day-track').addEventListener('touchmove',e=>window.__touchEvents.push({x:e.touches[0].clientX,y:e.touches[0].clientY}),{passive:true});(()=>{const rail=document.querySelector('.day-track');const frame=()=>{window.__touchFrames.push(rail.scrollLeft);if(window.__touchSampling)requestAnimationFrame(frame)};requestAnimationFrame(frame)})()")
    // Electron 44's synthesizeScrollGesture crashes the Windows browser process
    // under device emulation; actual dispatched touch events exercise the same
    // renderer scrolling without that unsupported gesture synthesizer.
    const start={x:60,y:point.y,id:1,radiusX:1,radiusY:1,force:1}
    await win.webContents.debugger.sendCommand('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]})
    for(let step=1;step<=26;step++){await win.webContents.debugger.sendCommand('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...start,x:start.x+step*10}]});await pause(16)}
    await win.webContents.debugger.sendCommand('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
    for(let attempt=0;attempt<25;attempt++){await pause(60);if(await win.webContents.executeJavaScript("document.querySelector('.day-track').scrollLeft<1&&document.querySelector('.day-dates button[aria-pressed=true]').textContent.includes('周一')"))break}
    const touch=await win.webContents.executeJavaScript("window.__touchSampling=false;({positions:window.__touchFrames,events:window.__touchEvents,date:document.querySelector('.day-dates button[aria-pressed=true]').textContent})")
    fs.writeFileSync(path.join(app.getPath('userData'),'touch-scroll.json'),JSON.stringify(touch,null,2))
    check(touch.date.includes('周一')&&touch.positions.filter((x,i)=>i&&Math.abs(x-touch.positions[i-1])>1).length>=4&&touch.positions.every((x,i)=>!i||Math.abs(x-touch.positions[i-1])<150),'Rightward touch swipe returns continuously to Monday without a reset')
  }finally{await win.webContents.debugger.sendCommand('Emulation.setTouchEmulationEnabled',{enabled:false});win.webContents.debugger.detach()}
  await win.webContents.executeJavaScript("document.querySelector('.nutrition-target').scrollIntoView({block:'center'})");await pause(200)
  fs.writeFileSync(path.join(app.getPath('userData'),'assistant-target-mobile.png'),(await win.webContents.capturePage({x:0,y:0,width:360,height:800})).toPNG())
  for(const width of [320,360,412]){
    win.webContents.enableDeviceEmulation({screenPosition:'mobile',screenSize:{width,height:800},viewPosition:{x:0,y:0},viewSize:{width,height:800},deviceScaleFactor:1,scale:1});await pause(180)
    check(await win.webContents.executeJavaScript(`(()=>{
      const el=document.querySelector('.target-basis');el.style.fontSize='20px';
      const lines=new Map(),walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node;
      while(node=walker.nextNode())for(let i=0;i<node.length;i++){const r=document.createRange();r.setStart(node,i);r.setEnd(node,i+1);const rect=r.getBoundingClientRect(),y=Math.round(rect.top);lines.set(y,(lines.get(y)||'')+node.data[i])}
      const orphan=[...lines.values()].some(text=>text.replace(/[\\s\\p{P}·]/gu,'').length===1);
      return !orphan&&document.documentElement.scrollWidth<=innerWidth;
    })()`),'No one-character or character-plus-punctuation lines at '+width+'px with enlarged Chinese text')
  }
  await win.webContents.executeJavaScript("document.querySelector('.target-basis').style.fontSize='';window.scrollTo(0,document.documentElement.scrollHeight)");await pause(150)
  check(await win.webContents.executeJavaScript("(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='应用这份训练和饮食'),nav=document.querySelector('#tabbar').getBoundingClientRect();return b.getBoundingClientRect().bottom<nav.top})()"),'Last apply action clears bottom navigation when scrolled to end')
  win.webContents.enableDeviceEmulation({screenPosition:'mobile',screenSize:{width:360,height:800},viewPosition:{x:0,y:0},viewSize:{width:360,height:800},deviceScaleFactor:1,scale:1});await pause(150)
}
