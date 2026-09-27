import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { dailyTotals, localDate } from '../lib/nutrition.js'
import Icon from './Icon.jsx'
export function NutritionHomeCard() {
  const S=useStore(s=>s.S),nav=useNavigate(),n=dailyTotals(S.xunlian.logs,localDate())
  return <div className="card"><button className="today-row" onClick={()=>nav('/nutrition')} style={{marginTop:0}}><div><div className="lbl2">{t("Today's nutrition")}</div><div className="ttl">{n.kcal==null?'—':Math.round(n.kcal)} / {S.xunlian.target?.kcal||'—'} kcal</div><div className="small muted">{t('Protein')} {n.proteinG==null?'—':Math.round(n.proteinG)} g · {S.routines.find(r=>r.id===(Object.hasOwn(S.dayPlan,localDate())?S.dayPlan[localDate()]:S.week[new Date().getDay()]))?.name||t('Rest day')}</div></div><Icon name="chevronRight"/></button></div>
}
