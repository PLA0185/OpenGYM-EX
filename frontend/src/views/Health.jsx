import { useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Health as NativeHealth } from '@capgo/capacitor-health'
import { useStore } from '../store/useStore.js'
import { useHeartRate } from '../store/useHeartRate.js'
import { mergeHealthSamples } from '../lib/heart-rate.js'
import { Section,Row,Button } from '../components/ui.jsx'
import HeartRateCard from '../components/HeartRateCard.jsx'
const types=['steps','heartRate','distance','calories'],labels={steps:'步数',heartRate:'心率',distance:'距离',calories:'活动能量'}
export default function Health(){const S=useStore(s=>s.S),update=useStore(s=>s.update),hr=useHeartRate(),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[permissions,setPermissions]=useState(null)
  const run=async fn=>{setBusy(true);setMessage('');try{if(Capacitor.getPlatform()!=='android')throw new Error('Health Connect 接入请使用安卓端。');const availability=await NativeHealth.isAvailable();if(!availability.available)throw new Error('手机的 Health Connect 不可用，请检查系统支持及安装状态。');await fn()}catch(e){setMessage(String(e.message||'健康数据操作失败。'))}finally{setBusy(false)}}
  const sync=()=>run(async()=>{const access=await NativeHealth.checkAuthorization({read:types});setPermissions(access);const incoming=[],failures=[];const startDate=new Date(Date.now()-7*86400000).toISOString(),endDate=new Date().toISOString()
    for(const dataType of types){if(!access.readAuthorized.includes(dataType)){failures.push(labels[dataType]+'未授权');continue}try{const result=await NativeHealth.readSamples({dataType,startDate,endDate,limit:10000,ascending:false});incoming.push(...result.samples)}catch{failures.push(labels[dataType]+'读取失败')}}
    update(s=>{s.xunlian.healthSamples=mergeHealthSamples(s.xunlian.healthSamples||[],incoming);s.xunlian.healthLastSync=Date.now()});setMessage('本次读取 '+incoming.length+' 条记录。'+(failures.length?failures.join('；'):'')+' 没有记录表示来源尚未写入，不代表数值为零。')})
  return <div className="narrow feature-page"><h1>心率与健康数据</h1><Section title="小米手环 10 · 实时心率"><p className="sect-f">在手环“设置 → 心率广播”开启后连接。保持小米运动健康的原有绑定，训练时显示真实通知值；15 秒未收到新值会显示信号过期。已连接时，每 10 秒保存一个训练心率样本。</p><HeartRateCard/><Button disabled={hr.status==='connecting'} variant="primary" onClick={hr.connect}>搜索并连接心率广播</Button><Button onClick={hr.disconnect}>断开连接</Button>{hr.error&&<p className="notice">{hr.error}</p>}<a href="https://www.mi.com/tw/support/faq/details/KA-580855/" target="_blank" rel="noreferrer">小米官方心率广播说明</a></Section>
    <Section title="Health Connect · 手机运动记录"><p className="sect-f">由系统弹窗决定授权，只读取步数、心率、距离和活动能量。需要小米运动健康或其他来源 App 先向 Health Connect 同步。记录留在本机，不自动计入饮食摄入或额外增加热量目标。</p><Button disabled={busy} onClick={()=>run(async()=>{setPermissions(await NativeHealth.requestAuthorization({read:types}));setMessage('授权结果已更新，可以读取最近 7 天。')})}>授权读取健康数据</Button><Button disabled={busy} onClick={sync}>同步最近 7 天</Button>{permissions&&types.map(type=><Row key={type} title={labels[type]} value={permissions.readAuthorized.includes(type)?'已授权':'未授权'}/>)}{message&&<p className="notice">{message}</p>}</Section>
    <Section title="同步记录" footer="显示最近 50 条，保留来源和时间。重复同步不重复保存。">{(S.xunlian.healthSamples||[]).slice(-50).reverse().map(sample=><Row key={sample.id} title={labels[sample.dataType]||sample.dataType} subtitle={new Date(sample.startDate).toLocaleString()+' · '+sample.source} value={Math.round(sample.value*10)/10+' '+sample.unit}/>)}</Section><Button variant="danger" onClick={()=>update(s=>{s.xunlian.healthSamples=[];s.xunlian.healthLastSync=null})}>清除本机同步记录</Button>
  </div>
}
