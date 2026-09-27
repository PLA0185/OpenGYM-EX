import { positive, clone, planningContext, dailyTotals, localDate } from './nutrition.js'
export function validateProgram(p, exercises) {
  if (!p.nameZh || !p.days?.length || p.days.length > 7) throw new Error('Invalid program')
  const ids = new Set(exercises.map(e => e.id))
  const weekdays = new Set()
  p.days.forEach(d => {
    if (!Number.isInteger(d.weekday) || d.weekday < 0 || d.weekday > 6 || weekdays.has(d.weekday) || !d.exerciseItems?.length) throw new Error('Invalid training day')
    weekdays.add(d.weekday)
    d.exerciseItems.forEach(e => {
      if (!ids.has(e.exerciseId) || !['exact','high-confidence','user-resolved'].includes(e.mappingStatus)) throw new Error('Resolve exercise mapping')
      if (!positive(e.sets, 30) || !Number.isInteger(e.sets) || !(positive(e.reps ?? e.repsMax, 100) || positive(e.durationSec, 3600))) throw new Error('Complete sets and reps/time')
      if(exercises.find(x=>x.id===e.exerciseId)?.bp==='cardio' && !positive(e.durationSec,3600))throw new Error('Cardio needs duration in seconds')
      for (const k of ['reps','repsMin','repsMax']) if (e[k]!=null && (!positive(e[k],100)||!Number.isInteger(e[k]))) throw new Error('Invalid rep range')
      if (e.repsMin!=null && e.repsMax!=null && e.repsMin>e.repsMax) throw new Error('Invalid rep range')
      if (e.weight != null && (!Number.isFinite(e.weight) || e.weight < 0 || e.weight > 1000)) throw new Error('Invalid weight')
      if (e.rpe != null && (!Number.isFinite(e.rpe) || e.rpe < 1 || e.rpe > 10)) throw new Error('Invalid RPE')
      if (e.rir != null && (!Number.isFinite(e.rir) || e.rir < 0 || e.rir > 10)) throw new Error('Invalid RIR')
      if (e.restSec != null && (!Number.isFinite(e.restSec) || e.restSec < 0 || e.restSec > 900)) throw new Error('Invalid rest')
      // Percent loads must be converted with an explicit tested max; never silently discard them.
      if (e.percent1RM != null && !positive(e.weight)) throw new Error('Set a weight for percentage prescription')
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
    return { id, name:d.dayName, emoji:'dumbbell', prog:['off','linear','greyskull','double','time'].includes(p.progression) ? p.progression : 'off', sourceProgramId:p.id, ex:d.exerciseItems.map(e => ({ id:e.exerciseId, sets:e.sets, reps:e.reps || e.repsMax || 0, repsMin:e.repsMin || 0, weight:e.weight || 0, ...(e.durationSec ? exercises.find(x=>x.id===e.exerciseId)?.bp==='cardio'?{mode:'cardio',min:e.durationSec/60,speed:e.speed||0}:{mode:'time', sec:e.durationSec} : {}), sg:e.supersetGroup || e.circuitGroup || '', restSec:e.restSec, prescription:clone(e) })) }
  })
  S.routines.push(...routines); S.week = week
  S.dayPlan = Object.fromEntries(Object.entries(S.dayPlan||{}).filter(([date])=>date<localDate()))
  x.programs = [...x.programs.filter(v => v.id !== p.id), { ...clone(p), revision:(p.revision||0)+1, appliedAt:Date.now(), routineIds:routines.map(r=>r.id) }]
  x.nutritionNeedsReview = !!x.meals.length; x.revision++
}
export function weeklyEvidence(S, dates) {
  const x = S.xunlian, workouts = S.workouts.filter(w => dates.includes(w.d))
  return { context:planningContext(S), workouts:workouts.slice(-20), bodyweight:S.bodyweight.slice(-14), intake:dates.map(date=>({date, records:x.logs.filter(l=>l.date===date).length, actual:dailyTotals(x.logs,date)})) }
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
  const specs = [ ['全身 · 每周 2 练','Full body · 2 days',[1,4],[full,full]], ['全身 · 每周 3 练','Full body · 3 days',[1,3,5],[full,full,full]], ['上肢 / 下肢 · 每周 4 练','Upper / Lower',[1,2,4,5],[push.concat(pull),legs,push.concat(pull),legs]], ['推 / 拉 / 腿 · 每周 3 练','PPL · 3 days',[1,3,5],[push,pull,legs]], ['推 / 拉 / 腿 · 每周 6 练','PPL · 6 days',[1,2,3,4,5,6],[push,pull,legs,push,pull,legs]], ['居家全身','Home full body',[1,3,5],[home,home,home]], ['徒手训练','Bodyweight',[2,5],[home,home]], ['力量优先','Strength',[1,3,5],[full,full,full]], ['增肌优先','Hypertrophy',[1,2,4,5],[push,pull,legs,full]] ]
  return specs.map(([nameZh,nameEn,days,lists],i)=>({id:'builtin-'+i,nameZh,nameEn,sourceType:'builtin-template',sourceName:'循练常见分化模板',creator:'Xunlian contributors',originalTitle:nameEn,originalText:'',importedAt:null,license:'AGPL-3.0',sourceUrl:'',goal:i===7?'strength':'general',level:'beginner',splitType:nameEn,progression:'off',weeks:6,deloadPolicy:'根据训练表现与恢复情况复查，默认不自动减量。',days:days.map((weekday,j)=>({weekday,dayName:nameZh+' '+(j+1),exerciseItems:clone(lists[j]).map(e=>i===7?{...e,sets:3,reps:5,restSec:180}:e)}))}))
}
export function guidelinePrograms(exercises) {
  const p=clone(builtInPrograms(exercises)[0])
  p.id='guideline-us-hhs-2days';p.nameZh='依据美国成人活动指南整理 · 全身两练';p.nameEn='Guideline-derived full body 2 days';p.sourceType='guideline-derived';p.sourceName='CDC / Physical Activity Guidelines for Americans';p.sourceUrl='https://www.cdc.gov/physical-activity-basics/guidelines/adults.html';p.originalTitle='Adult Activity: An Overview';p.license='Federal guideline principles; Xunlian-authored exercise arrangement';p.notes='指南建议每周至少 150 分钟中等强度有氧及至少两天覆盖主要肌群的力量活动。本模板只编排力量部分；另行安排每周有氧。具体动作、组次和休息是循练编排，并非 CDC 发布的固定计划。'
  const extra=builtInPrograms(exercises)[3].days[0].exerciseItems.slice(-1)
  const abs=builtInPrograms(exercises)[6].days[0].exerciseItems.slice(-1)
  p.days=p.days.map(d=>({...d,exerciseItems:[...d.exerciseItems,...clone(extra),...clone(abs)]}))
  return [p]
}
