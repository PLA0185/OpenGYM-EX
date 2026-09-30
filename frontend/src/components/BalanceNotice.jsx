import { useStore } from '../store/useStore.js'
export default function BalanceNotice(){
  const S=useStore(s=>s.S),update=useStore(s=>s.update),notice=S.xunlian.balanceNotices?.find(n=>!n.acknowledged)
  if(!notice)return null
  return <aside className="balance-notice" aria-live="polite"><strong>{notice.status==='review'?'已检查联动，有餐食需要调整':'已联动核对训练与饮食'}</strong><p>{notice.changes[0]}</p><details><summary>查看调整内容与原因</summary>{notice.changes.slice(1).map((text,i)=><p key={i}>{text}</p>)}<small>只调整待执行计划，已完成训练和已吃记录保留。</small></details><button className="btn tinted" onClick={()=>update(s=>{for(const n of s.xunlian.balanceNotices)if(n.at<=notice.at)n.acknowledged=true})}>知道了</button></aside>
}
