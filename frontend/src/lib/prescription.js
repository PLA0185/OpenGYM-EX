import { estimate1RM } from './onerm.js'
import { initialLoad } from './initial-load.js'

export const DEFAULT_REST_SEC = 90
const validWeight = w => Number.isFinite(w) && w >= 0 && w <= 1000
const convert = (w, from, to) => Math.round(w * (from === to ? 1 : from === 'lb' ? 0.45359237 : 1 / 0.45359237) * 100) / 100
// Only completed, comparable sets are evidence. A lifetime PR or body weight is
// not an adequate substitute for a current working load.
export function recentLoad(S, id) {
  const cutoff = Date.now() - 90 * 86400000
  for (const w of (S.workouts || []).filter(w=>typeof w.d==='string' && Array.isArray(w.entries)).sort((a,b)=>a.d.localeCompare(b.d)).reverse()) {
    if (+new Date(w.d + 'T12:00:00') < cutoff || +new Date(w.d + 'T00:00:00') > Date.now()) continue
    const e = w.entries.find(e=>e.id===id)
    const sets = e?.sets?.filter(s=>s.done && validWeight(s.w) && s.r >= 1 && s.r <= 100) || []
    if (sets.length) return { ...sets[sets.length-1], date:w.d, sets }
  }
  return null
}
export function resolvePrescription(S, item, exercise, program = {}) {
  const unit = S.unit || 'kg', explicit = item.weight != null && !(item.estimatedFields || []).includes('weight')
  let weight = null, basis = 'pending', evidence = null
  if (explicit) { weight = convert(item.weight, item.weightUnit || unit, unit); basis = 'source' }
  else if (exercise?.eq === 'body weight') { weight = 0; basis = 'bodyweight' }
  else {
    const last = recentLoad(S,item.exerciseId)
    if (item.percent1RM != null) {
      const baseline = item.baselineWeight > 0 && item.baselineReps >= 1 && item.baselineReps <= 12
        ? {w:convert(item.baselineWeight,item.baselineUnit || unit,unit),r:item.baselineReps,date:'user-baseline'} : last
      const max = baseline && estimate1RM(baseline.w,baseline.r)
      if (max > 0) { weight = Math.floor(max * item.percent1RM / 100 * 2) / 2; basis = 'percent-history'; evidence = {date:baseline.date,weight:baseline.w,reps:baseline.r,estimated1RM:max,percent:item.percent1RM} }
    } else if (item.baselineWeight > 0) { weight = convert(item.baselineWeight,item.baselineUnit || unit,unit); basis = 'user-baseline' }
    else if (last?.w > 0) { weight = last.w; basis = 'history'; evidence = {date:last.date,weight:last.w,reps:last.r} }
    if(weight==null&&item.percent1RM==null){const trial=initialLoad(S.xunlian?.profile,exercise,unit);if(trial){weight=trial.weight;basis='initial-trial';evidence={note:trial.note,fitnessLevel:S.xunlian.profile.fitnessLevel}}}
  }
  const restSec = item.restSec ?? DEFAULT_REST_SEC
  return {id:item.exerciseId,sets:item.sets,reps:item.reps ?? item.repsMax ?? item.repsMin ?? 0,repsMin:item.repsMin || 0,weight,
    ...(item.durationSec ? exercise?.bp==='cardio'?{mode:'cardio',min:item.durationSec/60,speed:item.speed||0}:{mode:'time',sec:item.durationSec} : {}),
    sg:item.supersetGroup || item.circuitGroup || '',restSec,prescription:structuredClone(item),
    prefillBasis:{sourceName:program.sourceName || program.nameZh || '训练方案',load:basis,unit,evidence,rest:item.restSec==null?'app-default':'source'}}
}
export function sessionConfig(S,cfg,exercise) {
  if (!cfg.prescription || cfg.prefillBasis?.load==='accepted-ai') return cfg
  return {...cfg,...resolvePrescription(S,cfg.prescription,exercise,{sourceName:cfg.prefillBasis?.sourceName || '已保存训练方案'})}
}
export function restSeconds(entry, fallback = DEFAULT_REST_SEC) { return entry.target?.restSec ?? fallback ?? DEFAULT_REST_SEC }

export function validateTrainingAdjustment(S, a) {
  const cfg = S.routines.find(r=>r.id===a.routineId)?.ex.find(e=>e.id===a.exerciseId)
  const last = recentLoad(S,a.exerciseId)
  if (!cfg || !last) throw new Error('AI 微调需要对应动作近 90 天的已完成记录')
  if (a.action==='sets') {
    if (!Number.isInteger(a.sets) || a.sets<1 || a.sets>20 || Math.abs(a.sets-cfg.sets)>2) throw new Error('AI 每次最多调整 2 组')
    return cfg
  }
  const baseWeight = validWeight(cfg.weight) && cfg.weight>0 ? cfg.weight : last.w
  if (a.weight!=null && (!validWeight(a.weight) || baseWeight<=0 || Math.abs(a.weight-baseWeight)>baseWeight*.1+0.00001)) throw new Error('AI 重量微调须有基线，每次不超过 10%')
  if (a.weight>baseWeight && (last.sets.length<cfg.sets || last.sets.some(s=>s.r<(cfg.reps||1) || s.rpe>9 || s.rir===0))) throw new Error('未完成目标或已有极限用力记录，不允许自动建议加重')
  if (a.reps!=null && (!Number.isInteger(a.reps) || a.reps<1 || a.reps>100 || Math.abs(a.reps-(cfg.reps||last.r))>2)) throw new Error('AI 每次最多调整 2 次')
  if (a.restSec!=null && (!Number.isFinite(a.restSec) || a.restSec<0 || a.restSec>900 || Math.abs(a.restSec-(cfg.restSec??DEFAULT_REST_SEC))>60)) throw new Error('AI 每次最多调整 60 秒休息')
  if (a.weight==null && a.reps==null && a.restSec==null) throw new Error('微调缺少参数')
  return cfg
}
export function applyTrainingAdjustment(S,a) {
  const cfg=validateTrainingAdjustment(S,a)
  const fields=a.action==='sets'?['sets']:['weight','reps','restSec']
  if(cfg.weight==null)cfg.weight=recentLoad(S,a.exerciseId).w
  for (const field of fields) if(a[field]!=null)cfg[field]=a[field]
  cfg.prog='off'
  cfg.prefillBasis={...(cfg.prefillBasis||{}),sourceName:cfg.prefillBasis?.sourceName || '个人训练方案',load:'accepted-ai',unit:S.unit||'kg',evidence:{reason:a.reason,date:recentLoad(S,a.exerciseId).date},rest:a.restSec!=null?'accepted-ai':cfg.prefillBasis?.rest||'source'}
}
