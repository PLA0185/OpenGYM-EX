import { useEffect,useState } from 'react'
import { useHeartRate } from '../store/useHeartRate.js'
import { useNavigate } from 'react-router-dom'
export default function HeartRateCard(){const hr=useHeartRate(),nav=useNavigate(),[now,setNow]=useState(Date.now());useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[])
  const fresh=hr.status==='connected'&&hr.bpm!=null&&now-hr.at<=15000
  return <button className="notice" style={{width:'100%',textAlign:'left'}} onClick={()=>nav('/health')}>实时心率 · {fresh?hr.bpm+' bpm':hr.status==='connected'?'等待心率 / 信号已过期':'连接手环'}{fresh&&' · '+hr.name}</button>
}
