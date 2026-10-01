import { validateProgram,analyzeProgram } from './programs.js'
import { recipeNutrition,clone, sumNutrition, scaleNutrition, nutritionFits } from './nutrition.js'
import { requiredMealSlots } from './meal-slots.js'
import { recipeCost } from './meal-cost.js'
import { needsPartner } from './solo-exercises.js'
import { validateRecovery } from './training-recovery.js'
export function coachCatalog(exercises,profile){
  exercises=exercises.filter(e=>!needsPartner(e))
  const avoids=String(profile.avoidExercises||'').split(/[、,，;；\n]+/).map(t=>t.trim().toLowerCase()).filter(s=>s&&!['无','没有','none'].includes(s))
  const home=profile.trainingPlace==='home',equipment=home?new Set(['body weight',...(profile.homeEquipment||[])]):null
  return exercises.filter(e=>(!equipment||equipment.has(e.eq))&&!avoids.some(term=>(e.nameZh+' '+(e.nameEn||e.n)).toLowerCase().includes(term))&&(!profile.lowImpact||!/jump|burpee|run|plyo|sprint|跳|跑/.test((e.nameEn+' '+e.nameZh).toLowerCase()))&&(!['inactive','occasional'].includes(profile.fitnessLevel)||!/guillotine|behind neck|planche|handstand|muscle.?up|iron cross|maltese|skin the cat|snatch|jerk|pistol|倒立|水平支撑|双力臂/.test((e.nameEn+' '+e.nameZh).toLowerCase())))
}
export function checkCoachProgram(program,candidates,profile){
  validateProgram(program,candidates)
  if(program.days.length!==profile.trainingDays)throw new Error('训练日数量与已确认的每周天数不一致。')
  if(profile.schedulePreference!=='flexible'&&program.days.some(day=>!profile.availableDays.includes(day.weekday)))throw new Error('训练日安排在不可训练的星期。')
  if(!Number.isFinite(profile.trainingDuration)||profile.trainingDuration<10||profile.trainingDuration>180)throw new Error('请设置 10–180 分钟的训练时间。')
  if(analyzeProgram(program,candidates).days.some(day=>day.estimatedDuration>profile.trainingDuration+10))throw new Error('估算训练时长超过已确认时间，请减少动作或组数。')
  return validateRecovery(program,candidates,profile)
}
export function eligibleJointPrograms(programs,catalog,profile){
  const allowedIds=new Set(coachCatalog(catalog,profile).map(e=>e.id)),seen=new Set()
  return programs.filter(p=>{
    try{
      validateRecovery(p,catalog,profile)
      if(seen.has(p.id)||!p.days.every(d=>d.exerciseItems.every(e=>allowedIds.has(e.exerciseId)))||
        (profile.trainingDays&&p.days.length!==profile.trainingDays)||
        (profile.trainingDuration&&analyzeProgram(p,catalog).days.some(d=>d.estimatedDuration>profile.trainingDuration+10))||
        (profile.schedulePreference==='fixed'&&p.days.some(d=>!profile.availableDays.includes(d.weekday))))return false
      seen.add(p.id);return true
    }catch{return false}
  })
}
export function selectCoachCandidates(candidates,preferredIds=[]){
  const result=[],seen=new Set(),groups=new Map()
  for(const id of preferredIds){const e=candidates.find(e=>e.id===id);if(e&&!seen.has(id)){result.push(e);seen.add(id)}}
  for(const e of candidates.filter(e=>e.translationSource==='manual'||e.custom)){if(!seen.has(e.id)){result.push(e);seen.add(e.id)}}
  for(const e of candidates){const key=e.bp+'|'+e.eq,used=groups.get(key)||0;if(seen.has(e.id)||used>=8)continue;result.push(e);seen.add(e.id);groups.set(key,used+1)}
  return result.slice(0,300)
}
// Give the model an actually feasible menu as evidence, rather than inventing nutrients.
export function feasibleMenu(recipes,foods,target,{usage={},repeatLimit=null,profile={}}={}){
  const slots=requiredMealSlots(profile)
  const candidates=recipes.slice(0,40).map(r=>({r,n:recipeNutrition(r,foods).nutrition})).filter(({n})=>n.kcal>0&&Number.isFinite(n.proteinG)).sort((a,b)=>(usage[a.r.id]||0)-(usage[b.r.id]||0))
  for(const distinct of [true,false])for(const a of candidates)for(const b of candidates)for(const c of candidates){
    const picks=slots.map((_,i)=>[a,b,c][i%3]),fractions=slots.length===3?[.3,.4,.3]:slots.map(()=>1/slots.length)
    if(distinct&&new Set(picks.map(p=>p.r.id)).size<Math.min(3,slots.length,candidates.length))continue
    if(repeatLimit!=null){const counts={...usage};for(const x of picks)counts[x.r.id]=(counts[x.r.id]||0)+1;if(Object.values(counts).some(n=>n>repeatLimit))continue}
    const parts=picks.map(({r,n},i)=>({recipeId:r.id,servings:Math.round(target.kcal*fractions[i]/n.kcal*100)/100,n,cost:recipeCost(r,profile)}))
    if(parts.some(p=>p.servings<.1||p.servings>20))continue
    if(profile.dailyBudgetCny>0&&parts.every(p=>p.cost!=null)&&parts.reduce((sum,p)=>sum+p.cost*p.servings,0)>profile.dailyBudgetCny)continue
    if(nutritionFits(sumNutrition(parts.map(p=>scaleNutrition(p.n,p.servings))),target))return parts.map(({n,cost,...p},i)=>({...p,slot:slots[i]}))
  }
  return null
}
export function mapCoachProgram(result,candidates,id,revision){
  const program={...clone(result),id,sourceType:'ai-generated',sourceName:'AI 个人编排（候选动作库与指南参考）',originalText:'',baseRevision:revision,progression:'off'}
  program.days=program.days.map(d=>({...d,exerciseItems:d.exerciseItems.map(item=>{
    const matches=candidates.filter(e=>item.exerciseId?e.id===item.exerciseId:(e.nameZh===item.originalText||e.nameEn===item.originalText||e.n===item.originalText))
    if(matches.length!==1)throw new Error('AI 使用了未提供或无法唯一确认的动作。')
    // New generated loads are estimates, and must not override personal history.
    const {weight:ignored,baselineWeight,baselineReps,...rest}=item
    return {...rest,exerciseId:matches[0].id,mappingStatus:'exact',weight:null,estimatedFields:[...new Set([...(item.estimatedFields||[]),'sets','reps','restSec'])]}
  })}))
  return program
}
