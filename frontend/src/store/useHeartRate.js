import { create } from 'zustand'
import { Capacitor } from '@capacitor/core'
import { BleClient,numberToUUID } from '@capacitor-community/bluetooth-le'
import { parseHeartRate } from '../lib/heart-rate.js'
import { useStore } from './useStore.js'
const service=numberToUUID(0x180d),measurement=numberToUUID(0x2a37)
let deviceId=null,connecting=false
export const useHeartRate=create((set,get)=>({status:'idle',name:'',bpm:null,at:0,error:'',
  connect:async()=>{if(connecting)return;connecting=true;set({error:'',status:'connecting',bpm:null,at:0})
    try{if(Capacitor.getPlatform()!=='android')throw new Error('实时蓝牙心率请使用安卓端。')
      await get().disconnect();set({status:'connecting'});await BleClient.initialize({androidNeverForLocation:true})
      const device=await BleClient.requestDevice({services:[service]}),id=device.deviceId;deviceId=id
      await BleClient.connect(id,()=>{if(deviceId===id){deviceId=null;set({status:'disconnected',bpm:null,at:0})}})
      await BleClient.startNotifications(id,service,measurement,value=>{if(deviceId!==id)return;let bpm;try{bpm=parseHeartRate(value)}catch{return}const at=Date.now();set({bpm,at:bpm==null?0:at});if(bpm==null)return
        const active=useStore.getState().S.active,last=active?.heartRateSamples?.at(-1)
        if(active&&(!last||at-last.at>=10000))useStore.getState().update(s=>{if(s.active?.id!==active.id)return;s.active.heartRateSamples=[...(s.active.heartRateSamples||[]),{at,bpm,source:'BLE heart-rate broadcast',deviceName:device.name||'心率设备'}].slice(-1800)})
      });set({status:'connected',name:device.name||'心率设备'})
    }catch(e){await get().disconnect();set({status:'error',error:String(e.message||'未能连接心率设备。')})}finally{connecting=false}},
  disconnect:async()=>{const id=deviceId;deviceId=null;if(id){try{await BleClient.stopNotifications(id,service,measurement)}catch{}try{await BleClient.disconnect(id)}catch{}}set({status:'idle',bpm:null,at:0,name:''})}
}))
