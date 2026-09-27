const {contextBridge,ipcRenderer}=require('electron')
contextBridge.exposeInMainWorld('xunlianDesktop',{stateLoad:()=>ipcRenderer.invoke('state-load'),stateSave:value=>ipcRenderer.invoke('state-save',value),credentialGet:()=>ipcRenderer.invoke('credential-get'),credentialSet:value=>ipcRenderer.invoke('credential-set',value)})
