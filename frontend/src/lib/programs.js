import { positive, clone, planningContext, dailyTotals, localDate } from './nutrition.js'
import { resolvePrescription } from './prescription.js'
import { needsPartner } from './solo-exercises.js'
import { initialLoad } from './initial-load.js'
export function prefillProgram(S,program,exercises){
  const p=clone(program)
  p.days=p.days.map(d=>({...d,exerciseItems:d.exerciseItems.map(item=>{
    const ex=exercises.find(e=>e.id===item.exerciseId),resolved=resolvePrescription(S,item,ex,p)
    if(resolved.weight!=null)return item.weight!=null?item:{...item,weight:resolved.weight,weightUnit:S.unit||'kg',estimatedFields:[...new Set([...(item.estimatedFields||[]),'weight'])]}
    const trial=initialLoad(S.xunlian.profile,ex,S.unit)
    return trial?{...item,weight:trial.weight,weightUnit:S.unit||'kg',suggestedPercent1RM:item.percent1RM??null,percent1RM:null,estimatedFields:[...new Set([...(item.estimatedFields||[]),'weight','percent1RM'])],notes:[item.notes,'缺少1RM基线，已预填轻负重试练起点；此重量不等于指南的百分比负荷。',trial.note].filter(Boolean).join(' ')}:item
  })}))
  return p
}
export function validateProgram(p, exercises) {
  if (!p.nameZh || !p.days?.length || p.days.length > 7) throw new Error('Invalid program')
  const ids = new Set(exercises.map(e => e.id))
  const weekdays = new Set()
  p.days.forEach(d => {
    if (!Number.isInteger(d.weekday) || d.weekday < 0 || d.weekday > 6 || weekdays.has(d.weekday) || !d.exerciseItems?.length) throw new Error('Invalid training day')
    weekdays.add(d.weekday)
    d.exerciseItems.forEach(e => {
      if(needsPartner(exercises.find(x=>x.id===e.exerciseId)))throw new Error('这个动作需要同伴辅助，请替换为单人可完成的动作。')
      if (!ids.has(e.exerciseId) || !['exact','high-confidence','user-resolved'].includes(e.mappingStatus)) throw new Error('Resolve exercise mapping')
      if (!positive(e.sets, 30) || !Number.isInteger(e.sets) || !(positive(e.reps ?? e.repsMax, 100) || positive(e.durationSec, 3600))) throw new Error('Complete sets and reps/time')
      if(exercises.find(x=>x.id===e.exerciseId)?.bp==='cardio' && !positive(e.durationSec,3600))throw new Error('Cardio needs duration in seconds')
      for (const k of ['reps','repsMin','repsMax']) if (e[k]!=null && (!positive(e[k],100)||!Number.isInteger(e[k]))) throw new Error('Invalid rep range')
      if (e.repsMin!=null && e.repsMax!=null && e.repsMin>e.repsMax) throw new Error('Invalid rep range')
      if (e.weight != null && (!Number.isFinite(e.weight) || e.weight < 0 || e.weight > 1000)) throw new Error('Invalid weight')
      if (e.rpe != null && (!Number.isFinite(e.rpe) || e.rpe < 1 || e.rpe > 10)) throw new Error('Invalid RPE')
      if (e.rir != null && (!Number.isFinite(e.rir) || e.rir < 0 || e.rir > 10)) throw new Error('Invalid RIR')
      if (e.restSec != null && (!Number.isFinite(e.restSec) || e.restSec < 0 || e.restSec > 900)) throw new Error('Invalid rest')
      if (e.percent1RM != null && !positive(e.percent1RM,100)) throw new Error('Invalid percentage')
      if (e.weightUnit != null && !['kg','lb'].includes(e.weightUnit)) throw new Error('Invalid weight unit')
      if (e.baselineWeight != null && (!positive(e.baselineWeight,1000) || !Number.isInteger(e.baselineReps) || !positive(e.baselineReps,12))) throw new Error('Baseline needs weight and 1–12 completed reps')
    })
  })
  return p
}
export function analyzeProgram(p, exercises) {
  const idx = new Map(exercises.map(e => [e.id,e])), muscles = {}, equipment = new Set(), assumptions = new Set()
  const days = p.days.map(d => {
    let secs = 300, sets = 0, high = 0
    d.exerciseItems.forEach(e => {
      const ex = idx.get(e.exerciseId), n = e.sets || 0; sets += n
      if (ex) { muscles[ex.tg] = (muscles[ex.tg]||0) + n; equipment.add(ex.eq) }
      if (e.rpe >= 8 || (e.rir != null && e.rir <= 2) || e.percent1RM >= 80) high++
      if (e.restSec == null) assumptions.add('restSec=90')
      if (!e.durationSec) assumptions.add('repDurationSec=3')
      secs += n * (e.durationSec || (e.reps || e.repsMax || 10) * 3) + Math.max(0,n-1) * (e.restSec ?? 90) + 60
    })
    return { ...d, estimatedDuration: Math.round(secs/60), sets, intensity: high > d.exerciseItems.length/2 ? 'high' : 'moderate', durationBasis: 'estimated', statedDuration: d.statedDuration || null }
  })
  return { days, muscles, equipment: [...equipment], estimatedWeeklyMinutes: days.reduce((a,d)=>a+d.estimatedDuration,0), assumptions: [...assumptions] }
}
export function applyProgram(S, p, exercises, uid) {
  validateProgram(p,exercises)
  if (p.baseRevision != null && p.baseRevision !== S.xunlian.revision) throw new Error('Stale proposal')
  if (S.active) throw new Error('Finish active workout first')
  const x = S.xunlian
  x.snapshots.unshift({ kind:'program', routines:clone(S.routines), week:clone(S.week), dayPlan:clone(S.dayPlan||{}), programs:clone(x.programs), at:Date.now() }); x.snapshots = x.snapshots.slice(0,3)
  const week = {}
  const routines = p.days.map(d => {
    const id = uid(); week[d.weekday] = id
    return { id, name:d.dayName, emoji:'dumbbell', prog:'off', requestedProgression:p.progression, sourceProgramId:p.id, ex:d.exerciseItems.map(e => resolvePrescription(S,e,exercises.find(x=>x.id===e.exerciseId),p)) }
  })
  S.routines.push(...routines); S.week = week
  S.dayPlan = Object.fromEntries(Object.entries(S.dayPlan||{}).filter(([date])=>date<localDate()))
  x.programs = [...x.programs.filter(v => v.id !== p.id), { ...clone(p), revision:(p.revision||0)+1, appliedAt:Date.now(), routineIds:routines.map(r=>r.id) }]
  x.nutritionNeedsReview = !!x.meals.length; x.revision++
}
export function weeklyEvidence(S, dates) {
  const x = S.xunlian, workouts = S.workouts.filter(w => dates.includes(w.d))
  return { context:planningContext(S), routines:clone(S.routines), adjustmentRules:'动作须有近90天真实已完成记录；重量每次最多10%，次数最多2次，组数最多2组，休息最多60秒；未完成目标或极限用力不得加重。action=prescription 时使用 weight/reps/restSec，单位与当前训练相同。必须解释证据；缺少记录只给 note。', workouts:workouts.slice(-20), bodyweight:S.bodyweight.slice(-14), intake:dates.map(date=>({date, records:x.logs.filter(l=>l.date===date).length, actual:dailyTotals(x.logs,date)})) }
}
// Keep the selected published activity MET or an explicitly entered user range.
export function energyEstimate(weightKg, minutes, metMin, metMax = metMin, actual = false) {
  if (![weightKg,minutes,metMin,metMax].every(n => positive(n)) || metMax < metMin) throw new Error('Invalid energy inputs')
  return { kcalMin:Math.round(metMin * 3.5 * weightKg / 200 * minutes), kcalMax:Math.round(metMax * 3.5 * weightKg / 200 * minutes), confidence:actual?'medium':'low', basis:{weightKg,minutes,metMin,metMax,duration:actual?'measured':'estimated',formula:'MET × 3.5 × kg ÷ 200 × min',kind:'gross energy; not added to TDEE'} }
}
export function builtInPrograms(exercises) {
  const ex = name => exercises.find(e => e.nameEn?.toLowerCase() === name || e.n === name)
  const item = (name, sets=3,reps=10) => { const e=ex(name); if (!e) throw new Error('Missing built-in exercise: '+name); return {exerciseId:e.id,originalText:e.nameEn||e.n,mappingStatus:'exact',sets,reps,restSec:90,estimatedFields:[]} }
  const full = [item('barbell bench press'),item('barbell full squat'),item('barbell bent over row'),item('dumbbell seated shoulder press')]
  const push = [item('barbell bench press'),item('dumbbell seated shoulder press'),item('dumbbell lateral raise'),item('cable pushdown')]
  const pull = [item('cable lat pulldown full range of motion'),item('barbell bent over row'),item('dumbbell biceps curl')]
  const legs = [item('barbell full squat'),item('barbell romanian deadlift'),item('lever leg extension'),item('lever seated calf raise')]
  const home = [item('push-up'),item('split squats'),item('forward lunge (male)'),item('3/4 sit-up')]
  const specs = [ ['全身 · 每周 2 练','Full body · 2 days',[1,4],[full,full]], ['全身 · 每周 3 练','Full body · 3 days',[1,3,5],[full,full,full]], ['上肢 / 下肢 · 每周 4 练','Upper / Lower',[1,2,4,5],[push.concat(pull),legs,push.concat(pull),legs]], ['推 / 拉 / 腿 · 每周 3 练','PPL · 3 days',[1,3,5],[push,pull,legs]], ['推 / 拉 / 腿 · 每周 6 练','PPL · 6 days',[1,2,3,4,5,6],[push,pull,legs,push,pull,legs]], ['居家全身','Home full body',[1,3,5],[home,home,home]], ['徒手训练','Bodyweight',[2,5],[home,home]], ['力量优先','Strength',[1,3,5],[full,full,full]], ['增肌优先','Hypertrophy',[1,2,4,5],[push.concat(pull),legs,push.concat(pull),legs]] ]
  return specs.map(([nameZh,nameEn,days,lists],i)=>({id:'builtin-'+i,nameZh,nameEn,sourceType:'builtin-template',sourceName:'OpenGym EX常见分化模板',creator:'Xunlian contributors',originalTitle:nameEn,originalText:'',importedAt:null,license:'AGPL-3.0',sourceUrl:'',goal:i===7?'strength':'general',level:'beginner',splitType:nameEn,progression:'off',weeks:6,deloadPolicy:'根据训练表现与恢复情况复查，默认不自动减量。',days:days.map((weekday,j)=>({weekday,dayName:nameZh+' '+(j+1),exerciseItems:clone(lists[j]).map(e=>i===7?{...e,sets:3,reps:5,restSec:180}:e)}))}))
}
export function guidelinePrograms(exercises) {
  const p=clone(builtInPrograms(exercises)[0])
  p.id='guideline-us-hhs-2days';p.nameZh='依据美国成人活动指南整理 · 全身两练';p.nameEn='Guideline-derived full body 2 days';p.sourceType='guideline-derived';p.sourceName='CDC / Physical Activity Guidelines for Americans';p.sourceUrl='https://www.cdc.gov/physical-activity-basics/guidelines/adults.html';p.originalTitle='Adult Activity: An Overview';p.license='Federal guideline principles; Xunlian-authored exercise arrangement';p.notes='指南建议每周至少 150 分钟中等强度有氧及至少两天覆盖主要肌群的力量活动。本模板只编排力量部分；另行安排每周有氧。具体动作、组次和休息是OpenGym EX编排，并非 CDC 发布的固定计划。'
  const extra=builtInPrograms(exercises)[3].days[0].exerciseItems.slice(-1)
  const abs=builtInPrograms(exercises)[6].days[0].exerciseItems.slice(-1)
  p.days=p.days.map(d=>({...d,exerciseItems:[...d.exerciseItems,...clone(extra),...clone(abs)]}))
  const strength=clone(p)
  strength.id='guideline-acsm-2026-strength';strength.nameZh='ACSM 2026 指南整理 · 力量全身两练';strength.nameEn='ACSM 2026 derived strength';strength.sourceName='ACSM 2026 抗阻训练指南（应用编排）';strength.sourceUrl='https://acsm.org/resistance-training-guidelines-update-2026/';strength.originalTitle='ACSM Unveils Landmark 2026 Resistance Training Guidelines';strength.license='Guideline facts summarized; exercise arrangement AGPL-3.0'
  strength.notes='ACSM 2026：力量目标约 80% 1RM，每动作 2–3 组，每周至少两次覆盖主要肌群。这里采用 3 组；动作选择、5 次和 180 秒休息为应用编排，非 ACSM 发布的固定课程。公斤数按近 90 天已完成记录的估算 1RM 换算；无记录时只需首次确认个人基线，不按体重猜负荷。'
  strength.days=strength.days.map(d=>({...d,exerciseItems:d.exerciseItems.map(e=>({...e,sets:3,reps:5,restSec:180,percent1RM:80,estimatedFields:['reps','restSec'],sourceFields:['sets','percent1RM']}))}))
  const china=clone(p)
  china.id='guideline-china-fitness-2017';china.nameZh='全民健身指南整理 · 全身两练';china.nameEn='China guideline-derived full body';china.sourceName='国家体育总局《全民健身指南》（应用编排）';china.sourceUrl='https://www.sport.gov.cn/n315/n20067006/c20324479/content.html';china.originalTitle='全民健身指南';china.notes='指南中等力量负荷参考：3 组、10–20 次，组间休息 1–2 分钟。这里选择 3×10、120 秒，具体动作及训练日由应用编排。公斤数不是官方统一标准：优先原文明确值、个人基线与近期记录，再使用可调整的首次试练建议。另需逐渐安排有氧活动。';china.license='Guideline facts summarized; app-authored exercise arrangement AGPL-3.0';china.days=china.days.map(d=>({...d,dayName:'全身力量 '+(d.weekday===1?'周一':'周四'),exerciseItems:d.exerciseItems.map(e=>({...e,sets:3,reps:10,repsMin:10,repsMax:20,restSec:120,estimatedFields:['reps','restSec'],sourceFields:['sets','repsMin','repsMax']}))}))
  return [china,strength,p]
}
