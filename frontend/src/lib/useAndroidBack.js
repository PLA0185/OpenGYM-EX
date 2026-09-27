import { useEffect,useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { createAndroidBackHandler } from './android-back.js'
import { useUI } from '../store/useUI.js'

export function useAndroidBack(navigate,location){
  const latest=useRef({navigate,location});latest.current={navigate,location}
  useEffect(()=>{
    if(Capacitor.getPlatform()!=='android')return
    let disposed=false,listener
    const back=createAndroidBackHandler({getUI:()=>useUI.getState(),getPath:()=>latest.current.location.pathname,getIndex:()=>window.history.state?.idx||0,navigate:(...args)=>latest.current.navigate(...args),minimize:()=>App.minimizeApp().catch(()=>useUI.getState().toast('无法回到桌面，请使用系统主页手势'))})
    App.addListener('backButton',back).then(handle=>{if(disposed)handle.remove();else listener=handle}).catch(()=>useUI.getState().toast('系统返回监听未就绪，请使用页面返回按钮'))
    return ()=>{disposed=true;listener?.remove()}
  },[])
}
