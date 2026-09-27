const { app, BrowserWindow, ipcMain, safeStorage, shell, Menu } = require('electron')
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url')
// A launched desktop app may outlive the terminal that supplied its output pipes.
// Only closed-pipe errors are ignored; unrelated stream errors still fail visibly.
for(const stream of [process.stdout,process.stderr])stream.on('error',error=>{if(error.code!=='EPIPE')throw error})
app.setName('动起')
// Keep the prior data location so changing the display name preserves personal records.
app.setPath('userData',path.join(app.getPath('appData'),'Xunlian'))
const verify=app.commandLine.hasSwitch('verify-build')
if(verify)app.setPath('userData',app.commandLine.getSwitchValue('verify-profile')||path.join(app.getPath('userData'),'verification'))
app.setPath('sessionData',path.join(app.getPath('userData'),'webview'))
fs.mkdirSync(app.getPath('sessionData'),{recursive:true})
const entry=path.join(__dirname,'../dist/index.html'),entryURL=pathToFileURL(entry).href
function trusted(event){if(event.senderFrame?.url.split('#')[0]!==entryURL)throw new Error('Untrusted IPC sender')}
function atomic(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',data);fs.renameSync(file+'.tmp',file)}
function sanitized(v){if(Array.isArray(v))return v.map(sanitized);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([k])=>!/^(apiKey|api_key|token|credential|credentials|authorization|secret|credentialCache|__proto__|constructor|prototype)$/i.test(k)).map(([k,x])=>[k,sanitized(x)]));return v}
app.whenReady().then(()=>{
  Menu.setApplicationMenu(null)
  const state=path.join(app.getPath('userData'),'state.json'),credential=path.join(app.getPath('userData'),'deepseek.bin')
  ipcMain.handle('state-load',event=>{trusted(event);try{return JSON.parse(fs.readFileSync(state,'utf8'))}catch{return null}})
  ipcMain.handle('state-save',(event,value)=>{trusted(event);const data=JSON.stringify(sanitized(value));if(data.length>30*1024*1024)throw new Error('State too large');atomic(state,data);return true})
  ipcMain.handle('credential-get',event=>{trusted(event);if(!safeStorage.isEncryptionAvailable())return '';try{return safeStorage.decryptString(fs.readFileSync(credential))}catch{return ''}})
  ipcMain.handle('credential-set',(event,value)=>{trusted(event);if(typeof value!=='string'||value.length>512)throw new Error('Invalid credential');if(!value){if(fs.existsSync(credential))fs.unlinkSync(credential);return 'secure'}if(!safeStorage.isEncryptionAvailable())throw new Error('Secure storage unavailable');atomic(credential,safeStorage.encryptString(value));return 'secure'})
  const win=new BrowserWindow({width:1100,height:860,minWidth:380,minHeight:640,title:'动起',backgroundColor:'#000000',show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,offscreen:verify}})
  win.webContents.setWindowOpenHandler(({url})=>{if(/^https:\/\//.test(url))shell.openExternal(url);return {action:'deny'}})
  win.webContents.on('will-navigate',(e,url)=>{if(url.split('#')[0]!==entryURL){e.preventDefault();if(/^https:\/\//.test(url))shell.openExternal(url)}})
  win.loadFile(entry)
  if(verify){require('./verify.cjs').run({app,win,fs,path,state,credential,entry}).catch(e=>{fs.writeFileSync(path.join(app.getPath('userData'),'verification-report.json'),JSON.stringify({status:'FAIL',error:e.message,checkedAt:new Date().toISOString()},null,2));app.exit(1)})}
  else {
    win.once('ready-to-show',()=>win.show())
    let closing=false
    win.on('close',event=>{if(closing)return;event.preventDefault();closing=true;win.webContents.executeJavaScript("localStorage.getItem('gym_state_v1')").then(raw=>{if(raw&&raw.length<30*1024*1024)atomic(state,JSON.stringify(sanitized(JSON.parse(raw))))}).catch(()=>{}).finally(()=>win.destroy())})
  }
})
app.on('window-all-closed',()=>app.quit())
