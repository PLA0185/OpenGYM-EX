import foodsSeed from '../data/foods.json'
import recipesSeed from '../data/recipes.json'
import { clone,planningContext,targets,validateTarget,localDate,monday,nutritionFits,scaleNutrition,sumNutrition,mealSnapshot } from './nutrition.js'
import { eligibleRecipes,recipeAllowed } from './planning-engine.js'
import { fitNutritionPortions } from './meal-portions.js'
import { feasibleMenu,coachCatalog } from './assistant-plan.js'
import { requiredMealSlots } from './meal-slots.js'
import { needsPartner } from './solo-exercises.js'
import { EXDB } from './exercises-data.js'
import { KNOWLEDGE_EXERCISES } from './knowledge-exercises.js'
import { analyzeProgram } from './programs.js'
import activityReference from '../data/activity-reference.json'
import { recoveryConflicts, suggestedWeekdays, resistanceWork } from './training-recovery.js'
const idx=new Map([...EXDB,...KNOWLEDGE_EXERCISES].map(e=>[e.id,e]))
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const scheduled=S=>Array.from({length:7},(_,i)=>S.routines.find(r=>r.id===S.week[i]))
// MET 02054 (3.5), 2024 Compendium. This is a relative estimate for resistance
// only. Cardio without a selected MET is not assigned an invented expenditure.
export function trainingLoad(S){return scheduled(S).reduce((sum,r)=>{
  const code=S.xunlian.programs.find(p=>p.id===r?.sourceProgramId)?.activityCode
  const met=activityReference.activities.find(a=>a.code===code)?.met??3.5
  return sum+(r?.ex||[]).reduce((a,e)=>{
  if(e.mode==='cardio'||idx.get(e.id)?.bp==='cardio')return a
  const minutes=((e.sets||0)*(e.sec||(e.reps||10)*3)+Math.max(0,(e.sets||0)-1)*(e.restSec??S.restSec??90)+60)/60
  return a+(met-1)*minutes/60
},0)},0)}
export function linkedTarget(S,profile=planningContext(S)){
  const old=S.xunlian.target,load=trainingLoad(S),baselineLoad=old?.trainingEnergy?.baselineLoad??load
  return validateTarget(targets(profile,profile.weightKg,{deltaKcal:profile.weightKg*(load-baselineLoad)/7,baselineLoad,weeklyLoad:load}))
}
function scaleMeal(m,factor){return {...clone(m),servings:(m.servings||1)*factor,nutritionSnapshot:scaleNutrition(m.nutritionSnapshot,factor),ingredientsSnapshot:m.ingredientsSnapshot?.map(i=>({...i,grams:i.grams*factor,...(i.gramsMin!=null?{gramsMin:i.gramsMin*factor,gramsMax:i.gramsMax*factor}:{})})),...(m.costSnapshotCny!=null?{costSnapshotCny:m.costSnapshotCny*factor}:{}),...(m.photoAnalysis?{photoAnalysis:{...m.photoAnalysis,kcalMin:m.photoAnalysis.kcalMin*factor,kcalMax:m.photoAnalysis.kcalMax*factor}}:{})}}
export function rebalanceDay(S,date,target,lockedIds=[]){
  const x=S.xunlian,day=x.meals.filter(m=>m.date===date),logs=x.logs.filter(m=>m.date===date&&m.status!=='skipped'),actual=sumNutrition(logs.map(m=>m.nutritionSnapshot))
  const consumed=new Set(logs.flatMap(m=>[m.plannedMealId,...day.filter(d=>d.slot===m.slot).map(d=>d.id)]).filter(Boolean))
  const remaining=day.filter(m=>!consumed.has(m.id)),effective=[...logs,...remaining]
  if(!remaining.length)return {meals:day,ok:!logs.length||nutritionFits(actual,target),note:logs.length?'今天已无待吃计划，不修改已吃记录或追加补偿训练。':''}
  const foods=[...x.foods,...foodsSeed],recipes=[...x.recipes,...recipesSeed]
  const allowed=remaining.every(m=>!m.recipeSnapshot||recipeAllowed(m.recipeSnapshot,foods,x.profile))
  const parts=effective.map(m=>({...m,...m.nutritionSnapshot,servings:1,cost:m.costSnapshotCny??null,fixed:logs.includes(m)||lockedIds.includes(m.id)}))
  if(allowed&&nutritionFits(sumNutrition(parts),target))return {meals:day,ok:true,note:''}
  const fitted=allowed?fitNutritionPortions(parts,target,x.profile):null
  if(fitted){const factors=new Map(fitted.map(m=>[m.id,m.servings]));return {meals:day.map(m=>consumed.has(m.id)?m:scaleMeal(m,factors.get(m.id))),ok:true,note:'保留刚修改的餐食与已吃记录，调整其余餐食份数。'}}
  // A fully unconsumed day may be rebuilt from actual source nutrition. Never
  // overwrite a user-edited meal, remove actual intake or invent a recipe.
  if(!logs.length&&!lockedIds.length&&requiredMealSlots(x.profile).every(slot=>day.some(m=>m.slot===slot))){
    const usage={};for(const meal of x.meals.filter(m=>m.date!==date&&monday(m.date)===monday(date)))usage[meal.recipeId]=(usage[meal.recipeId]||0)+1
    const candidates=eligibleRecipes(recipes,foods,x.profile),menu=feasibleMenu(candidates,foods,target,{profile:x.profile,usage,repeatLimit:x.profile.repeatMeals??null})
    if(menu){const meals=menu.map(p=>mealSnapshot(candidates.find(r=>r.id===p.recipeId),foods,p.servings,date,p.slot,day.find(m=>m.slot===p.slot)?.id||'balanced-'+date+'-'+p.slot));return {meals,ok:true,note:'原组合不适合新目标，已用符合忌口的完整配方重新安排。'}}
  }
  return {meals:day,ok:false,note:'保留你修改的内容；剩余餐食无法同时满足当前营养或忌口条件，请修改餐食或补充合适菜谱。不会用过量训练补偿，也不会改已吃记录。'}
}
export function dynamicBalance(before,S,{nutritionReviewed=false,balanceDeferred=false,skipBalance=false}={}){
  if(skipBalance)return
  const x=S.xunlian,b=before.xunlian,today=localDate(),changes=[]
  let targetError=false,trainingReview=false
  if(!nutritionReviewed&&!S.active){
    const goalChanged=b.profile.goal!==x.profile.goal,timeChanged=b.profile.trainingDuration!==x.profile.trainingDuration
    if(goalChanged||timeChanged){
      let altered=0
      for(const r of [...new Set(scheduled(S).filter(Boolean))]){
        const source=x.programs.find(p=>p.id===r.sourceProgramId)
        if(!/^(builtin-template|guideline-derived|ai-generated)$/.test(source?.sourceType||''))continue
        if(goalChanged)for(const e of r.ex){if(e.mode==='cardio')continue;const reps=x.profile.goal==='gain'?10:12;if(e.reps!==reps){e.reps=reps;if(e.prescription){e.prescription.reps=reps;e.prescription.repsMin=null;e.prescription.repsMax=null;e.prescription.estimatedFields=[...new Set([...(e.prescription.estimatedFields||[]),'reps'])]}altered++}}
        if(timeChanged&&Number.isFinite(x.profile.trainingDuration)){
          const duration=()=>analyzeProgram({days:[{exerciseItems:r.ex.map(e=>({exerciseId:e.id,sets:e.sets,reps:e.reps,durationSec:e.sec||e.min*60,restSec:e.restSec}))}]},EXDB).days[0].estimatedDuration
          while(r.ex.length>1&&duration()>x.profile.trainingDuration){r.ex.pop();altered++}
        }
      }
      if(altered)changes.push(`按新目标或单次时间调整 ${altered} 项应用编排的训练参数；自定义与原文导入数值保留。增肌侧重抗阻和恢复，减脂保留力量；重量不因目标变化突然加大。`)
    }
    if(b.profile.trainingDays!==x.profile.trainingDays&&Number.isInteger(x.profile.trainingDays)){
      const days=Object.keys(S.week).filter(d=>S.routines.some(r=>r.id===S.week[d])).map(Number),wanted=x.profile.trainingDays
      if(days.length&&wanted>=1&&wanted<=6){
        const fixed=x.profile.schedulePreference==='fixed'&&x.profile.availableDays?.length
        const available=fixed?x.profile.availableDays.slice(0,wanted):suggestedWeekdays(wanted)
        if(available.length<wanted)trainingReview=true
        const routines=days.map(d=>S.routines.find(r=>r.id===S.week[d])),week={},planned=[],created=[],catalog=[...idx.values(),...S.customEx],permitted=new Set(coachCatalog(catalog,x.profile).map(e=>e.id))
        const asDay=(weekday,r)=>({weekday,exerciseItems:r.ex.map(e=>({exerciseId:e.id,sets:e.sets,reps:e.reps,durationSec:e.sec,restSec:e.restSec,percent1RM:e.prescription?.percent1RM,rpe:e.prescription?.rpe,rir:e.prescription?.rir}))})
        let light=0,strength=0;const used=new Map()
        for(const d of available){
          if(trainingReview)break
          let r=[...routines].sort((a,b)=>(used.get(a.id)||0)-(used.get(b.id)||0)).find(candidate=>{
            const day=asDay(d,candidate),isStrength=resistanceWork(day,catalog).size>0
            return candidate.ex.every(e=>permitted.has(e.id))&&(!isStrength||!['inactive','occasional'].includes(x.profile.fitnessLevel)||strength<3)&&!recoveryConflicts({days:[...planned,day]},catalog).length
          })
          if(!r&&!permitted.has('knowledge-walking')){trainingReview=true;break}
          if(!r){const minutes=Math.max(5,Math.min(20,(x.profile.trainingDuration||30)-5));r={id:'linked-aerobic-'+Date.now()+'-'+d,name:'轻有氧 · 恢复安排',emoji:'dumbbell',prog:'off',ex:[{id:'knowledge-walking',sets:1,reps:0,weight:0,sec:minutes*60,min:minutes,mode:'cardio',restSec:0}]};created.push(r);light++}
          used.set(r.id,(used.get(r.id)||0)+1);const day=asDay(d,r);if(resistanceWork(day,catalog).size)strength++;planned.push(day);week[d]=r.id
        }
        if(trainingReview)changes.push('已更新每周天数，但固定星期或运动限制下无法安全补足活动日；保留原排期，标为待复核，请核对可训练星期并让AI按新条件重新编排，不强行复制重力量或加入禁止的活动。')
        else {S.routines.push(...created);S.week=week;if(!fixed)x.profile.availableDays=available;changes.push(`已按每周 ${wanted} 天安排并检查跨周肌群恢复；保留合适的原训练，${light?`增加 ${light} 天轻健步走，避免重复重力量`:'相同肌群留出恢复间隔'}。新增有氧为可编辑建议，按个人恢复调整。`)}
      }
    }
  }
  // Partner-dependent entries are removed from future routines, keeping their
  // historical workout records and the currently running workout intact.
  let removed=0
  for(const r of S.routines){const old=r.ex.length;r.ex=r.ex.filter(e=>!needsPartner(idx.get(e.id)||S.customEx.find(c=>c.id===e.id)));removed+=old-r.ex.length}
  if(removed)changes.push(`从训练计划移除 ${removed} 项需要同伴辅助的动作；历史记录保留。`)
  const planChanged=!same([trainingLoad(before),before.week,before.dayPlan],[trainingLoad(S),S.week,S.dayPlan])
  const pkeys=['age','heightCm','sex','weightKg','activity','goal','requestedDeficitKcal','specialDiet','allergies','dislikedFoods','excludedAllergens','dietStyle','mealCount','trainingDays','trainingDuration','trainingTime']
  const profileChanged=!same(pkeys.map(k=>b.profile[k]),pkeys.map(k=>x.profile[k])),weightChanged=!same(before.bodyweight,S.bodyweight)
  const mealChanged=!same(b.meals,x.meals),actualChanged=!same(b.logs,x.logs),targetChanged=!same(b.target,x.target)
  if(!removed&&!planChanged&&!profileChanged&&!weightChanged&&!mealChanged&&!actualChanged&&!targetChanged)return
  if(balanceDeferred)return
  if(nutritionReviewed){if(x.target?.nutritionPolicy&&!x.target.trainingEnergy)x.target.trainingEnergy={baselineLoad:trainingLoad(S),weeklyLoad:trainingLoad(S),deltaKcal:0};changes.push('训练与饮食已一起应用，并使用当前目标核对。')}
  else {
    const automatic=x.target?.basis&&x.target.basis!=='manual'
    if((profileChanged||weightChanged||planChanged)&&automatic){
      try{const next=linkedTarget(S),diff=next.kcal-x.target.kcal;if(Math.abs(diff)>=50||before.xunlian.profile.goal!==x.profile.goal||!same(next.macroRanges,x.target.macroRanges)||Math.abs(next.proteinG-x.target.proteinG)>=5){x.target=next;changes.push(`每日目标 ${b.target?.kcal??'—'} → ${next.kcal} kcal，蛋白质 ${b.target?.proteinG??'—'} → ${next.proteinG} g；${next.strategy}。`)}else{x.target.trainingEnergy=next.trainingEnergy;changes.push('已重新估算：变化不足50 kcal/天且蛋白质变化不足5 g，保留原营养目标。')}}catch(e){targetError=true;x.nutritionNeedsReview=true;changes.push(e.message)}
    }else if(profileChanged&&x.target?.basis==='manual')changes.push('已保留专业手动营养目标；身体或目标变化后请核对其适用性。')
    if(planChanged)changes.push('已核对训练与饮食联动；未明确MET的有氧及单日调休不猜热量。休息日也保留营养与恢复，不直接大幅减餐。')
    if(x.target&&x.meals.length){
      const dates=[...new Set(x.meals.filter(m=>m.date>=today).map(m=>m.date))],updates=new Map(),failed=[]
      const oldById=new Map(b.meals.map(m=>[m.id,m]))
      for(const date of dates){if(!profileChanged&&!weightChanged&&!planChanged&&!targetChanged&&!x.meals.some(m=>m.date===date&&!same(m,oldById.get(m.id)))&&!x.logs.some(m=>m.date===date&&!same(m,b.logs.find(l=>l.id===m.id))))continue
        const locked=x.meals.filter(m=>m.date===date&&(!oldById.has(m.id)||!same(m,oldById.get(m.id)))).map(m=>m.id)
        const result=rebalanceDay(S,date,x.target,locked)
        if(!result.ok)failed.push(date)
        else if(!same(result.meals,x.meals.filter(m=>m.date===date))){updates.set(date,result.meals);changes.push(date+'：'+result.note)}
      }
      if(updates.size)x.meals=[...x.meals.filter(m=>!updates.has(m.date)),...[...updates.values()].flat()]
      if(Number.isInteger(x.profile.repeatMeals)&&x.profile.repeatMeals>0){const counts={};for(const m of x.meals.filter(m=>m.date>=today&&m.recipeId)){const key=monday(m.date)+'|'+m.recipeId;counts[key]=(counts[key]||0)+1}if(Object.values(counts).some(n=>n>x.profile.repeatMeals)){failed.push('每周同菜重复上限');changes.push('已核对重复次数：现有餐食超出新上限，需要更换部分菜谱。')}}
      x.nutritionNeedsReview=targetError||trainingReview||failed.length>0
      if(failed.length)changes.push(failed.join('、')+'：需要补充合适餐食，当前无法自动满足全部条件；保留你的修改和实际摄入，不增加补偿训练。')
      else if(!updates.size)changes.push('餐食合计仍在当前目标容差内，保留原份数。')
    }
  }
  if(trainingReview)x.nutritionNeedsReview=true
  if(changes.length){x.balanceNotices=[{id:'balance-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),at:Date.now(),status:x.nutritionNeedsReview?'review':'balanced',changes:changes.slice(0,30),acknowledged:false},...(x.balanceNotices||[])].slice(0,20);x.revision++}
}
