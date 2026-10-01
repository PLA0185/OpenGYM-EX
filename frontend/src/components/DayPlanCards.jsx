import { useEffect, useRef, useState } from 'react'
import { Button } from './ui.jsx'
import { resolvePrescription } from '../lib/prescription.js'

const weekdays=['周日','周一','周二','周三','周四','周五','周六']
export default function DayPlanCards({title,dates,renderDay}){
  const [index,setIndex]=useState(0),[height,setHeight]=useState(),track=useRef(null),cards=useRef([]),drag=useRef(null),settleTimer=useRef(null),selected=useRef(0)
  const current=Math.min(index,dates.length-1)
  selected.current=current
  const settle=()=>{const rail=track.current;if(!rail?.clientWidth||drag.current)return;const nearest=cards.current.reduce((best,c,i)=>c&&Math.abs(c.offsetLeft-rail.scrollLeft)<Math.abs(cards.current[best].offsetLeft-rail.scrollLeft)?i:best,0);setIndex(nearest)}
  const go=i=>{const next=Math.max(0,Math.min(dates.length-1,i)),rail=track.current;if(!rail?.clientWidth)return;rail.scrollTo({left:cards.current[next]?.offsetLeft||0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});clearTimeout(settleTimer.current);settleTimer.current=setTimeout(settle,180)}
  useEffect(()=>{
    const card=cards.current[current],rail=track.current;if(!card||!rail)return
    const observer=new ResizeObserver(()=>setHeight(card.offsetHeight+12));observer.observe(card)
    return()=>observer.disconnect()
  },[current,dates.join('|')])
  useEffect(()=>{
    const rail=track.current;let width=rail.clientWidth
    // Card-height changes must not cancel touch inertia or a smooth date change.
    const resize=new ResizeObserver(()=>{const next=rail.clientWidth;if(next&&next!==width){width=next;rail.scrollTo({left:cards.current[selected.current]?.offsetLeft||0,behavior:'instant'})}});resize.observe(rail)
    return()=>{resize.disconnect();clearTimeout(settleTimer.current)}
  },[dates.join('|')])
  const end=e=>{if(!drag.current)return;const start=drag.current;drag.current=null;track.current.style.scrollSnapType='';if(track.current.hasPointerCapture(e.pointerId))track.current.releasePointerCapture(e.pointerId);go(current+(Math.abs(start.dx)>40?(start.dx>0?1:-1):0))}
  return <section className="day-plans" aria-label={title}><h2>{title}</h2><div className="day-dates">{dates.map((date,i)=><button key={date} aria-pressed={i===current} onClick={()=>go(i)}><span>{weekdays[new Date(date+'T12:00:00').getDay()]}</span><small>{date.slice(5).replace('-','/')}</small></button>)}</div>
    <div className="day-track" ref={track} style={{height}} tabIndex={0} aria-label={title+'，左右滑动切换日期'}
      onKeyDown={e=>{if(e.target===e.currentTarget&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();go(current+(e.key==='ArrowRight'?1:-1))}}}
      onScroll={()=>{clearTimeout(settleTimer.current);settleTimer.current=setTimeout(settle,140)}} onScrollEnd={()=>{clearTimeout(settleTimer.current);settle()}}
      onPointerDown={e=>{if(e.pointerType!=='mouse'||e.button!==0||e.target.closest('button,input,textarea,select,a,summary,label'))return;drag.current={x:e.clientX,left:e.currentTarget.scrollLeft,dx:0};e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.style.scrollSnapType='none'}}
      onPointerMove={e=>{if(!drag.current)return;drag.current.dx=drag.current.x-e.clientX;e.currentTarget.scrollLeft=drag.current.left+drag.current.dx}}
      onPointerUp={end} onPointerCancel={end}>{dates.map((date,i)=><article ref={el=>cards.current[i]=el} className="day-plan-card" key={date} inert={i!==current} aria-hidden={i!==current}><h3>{date} · {weekdays[new Date(date+'T12:00:00').getDay()]}</h3>{renderDay(date)}</article>)}</div>
    <div className="day-navigation"><Button size="sm" disabled={current===0} onClick={()=>go(current-1)}>上一天</Button><span aria-live="polite">{current+1} / {dates.length}</span><Button size="sm" disabled={current===dates.length-1} onClick={()=>go(current+1)}>下一天</Button></div>
  </section>
}
export function TrainingDay({date,program,S,catalog}){
  const days=program.days.filter(d=>d.weekday===new Date(date+'T12:00:00').getDay())
  if(!days.length)return <p className="sect-f">休息日 · 按恢复情况安排日常活动和轻柔拉伸。</p>
  return days.map((day,i)=><div key={i}><p>{day.dayName}</p>{day.exerciseItems.map((item,j)=>{
    const ex=catalog.find(e=>e.id===item.exerciseId),p=resolvePrescription(S,item,ex,program),range=item.repsMin&&item.repsMax?item.repsMin+'–'+item.repsMax:item.reps??item.repsMax??item.repsMin
    return <div className="plan-exercise" key={j}><strong>{ex?.nameZh||item.originalText}</strong><small>{ex?.nameEn||ex?.n}</small><p>{p.sets} 组 × {item.durationSec?item.durationSec+' 秒':(range??'待确认')+' 次'} · {p.prefillBasis.load==='bodyweight'?'自重':p.weight==null?'重量待确认':p.weight+' '+(S.unit||'kg')} · 休息 {p.restSec} 秒</p>{p.prefillBasis.load==='initial-trial'&&<small>首次试练建议，首组确认实际重量</small>}</div>
  })}</div>)
}
