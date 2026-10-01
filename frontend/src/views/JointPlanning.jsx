import { knowledgePrograms } from '../lib/knowledge-programs.js'
import { requiredMealSlots } from '../lib/meal-slots.js'
import { requireAI, aiErrorMessage } from '../lib/ai-errors.js'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { uid } from '../lib/format.js'
import { allExercises } from '../lib/exercises.js'
import { analyzeProgram } from '../lib/programs.js'
import { planningContext, planningTarget, clone, monday, dateKeys, dailyTotals } from '../lib/nutrition.js'
import { eligibleRecipes, validateMeals, applyJoint } from '../lib/planning-engine.js'
import { balanceCoachMeals } from '../lib/meal-portions.js'
import { feasibleMenu,eligibleJointPrograms } from '../lib/assistant-plan.js'
import { coachKnowledge } from '../lib/coach-knowledge.js'
import { allFoods, allRecipes, nutritionLine, recipeDetail } from './Nutrition.jsx'
import { createDeepSeek } from '../lib/deepseek.js'
import { getCredential } from '../lib/credentials.js'
import { useAIRequest } from '../lib/useAIRequest.js'
import { Section, Row, Button, Switch, TextField, TextArea, Segmented } from '../components/ui.jsx'
import DayPlanCards,{ TrainingDay } from '../components/DayPlanCards.jsx'
import Icon from '../components/Icon.jsx'
export default function JointPlanning() {
  const S=useStore(s=>s.S),update=useStore(s=>s.update),nav=useNavigate(),toast=useUI(s=>s.toast),[start,setStart]=useState(monday()),[needs,setNeeds]=useState(''),[proposal,setProposal]=useState(null),[error,setError]=useState(''),[choices,setChoices]=useState({training:true,meals:true,target:false}),[planTab,setPlanTab]=useState('training'),ai=useAIRequest()
  const dates=dateKeys(start),catalog=allExercises(S),foods=allFoods(S),programs=[...S.xunlian.programs,...knowledgePrograms(catalog)],recipes=eligibleRecipes(allRecipes(S),foods,S.xunlian.profile).slice(0,80)
  const generate=()=>ai.run(async signal=>{setError('');try{
    requireAI(S);const context=planningContext(S),target=planningTarget(S,context);context.target=target
    const knowledge=coachKnowledge(catalog,context,needs),eligible=eligibleJointPrograms(programs,catalog,context)
    if(!eligible.length)throw new Error('当前条件下没有适合的现成方案，请使用AI对话按你的限制重新编排。')
    const input={task:'First analyze the supplied knowledge sources and rules. Choose one eligible supplied programId and only supplied recipeIds. Coordinate training and seven-day nutrition, preserving the local target. Spread rest days and respect muscle recovery, fitness level and fixed availability. Every date requires requiredSlots. Prefer varied dishes across meals and days, never repeat feasibleDayMenu throughout the week. Explain source, recovery, timing and any limited variety; no fabricated nutrition, prices or source claims.',context,dates,needs,knowledge:{sources:knowledge.sources,rules:knowledge.rules},programs:eligible.map(p=>({id:p.id,name:p.nameZh,source:p.sourceGuideId||p.sourceName,notes:p.notes,days:p.days.map(d=>({weekday:d.weekday,estimatedMinutes:analyzeProgram({days:[d]},catalog).days[0].estimatedDuration,items:d.exerciseItems.map(e=>({exerciseId:e.exerciseId,sets:e.sets,reps:e.reps,durationSec:e.durationSec,restSec:e.restSec}))}))})),recipes:recipes.map(r=>({id:r.id,name:r.nameZh,ingredients:r.ingredients.map(i=>foods.find(f=>f.id===i.foodId)?.nameZh),nutrition:dailyRecipe(r)}))}
    const menu=feasibleMenu(recipes,foods,target,{profile:S.xunlian.profile});if(!menu)throw new Error('当前菜谱无法满足营养目标，请补充符合忌口的完整菜谱。');input.feasibleDayMenu=menu;input.requiredSlots=requiredMealSlots(S.xunlian.profile)
    let balanced
    const validate=result=>{if(!eligible.some(p=>p.id===result.programId))throw new Error('请选择已提供且符合限制与恢复的训练方案。');balanced=balanceCoachMeals(result,dates,recipes,foods,S.xunlian.profile,target,menu,uid)}
    const result=await createDeepSeek({credential:getCredential,model:S.xunlian.ai.model}).generateStructured('joint',input,{signal,validate})
    const p={kind:'joint',id:uid(),...result,meals:balanced.meals,explanation:[result.explanation,balanced.note].filter(Boolean).join(' '),program:clone(eligible.find(p=>p.id===result.programId)),target:clone(target),snapshots:balanced.snapshots,dates,baseRevision:S.xunlian.revision,model:S.xunlian.ai.model,createdAt:Date.now()}
    setProposal(p);update(s=>{s.xunlian.proposals.unshift(p);s.xunlian.proposals=s.xunlian.proposals.slice(0,10)})
  }catch(e){setError(aiErrorMessage(e))}})
  function dailyRecipe(r){return r.ingredients.reduce((n,i)=>{const f=foods.find(f=>f.id===i.foodId);for(const k of ['kcal','proteinG','fatG','carbsG'])n[k]=(n[k]||0)+f.nutritionPer100g[k]*i.grams/100/r.servings;return n},{})}
  const apply=()=>{try{update(s=>applyJoint(s,proposal,{...choices,target:choices.meals&&!!proposal.target.basis&&proposal.target.basis!=='manual'},allExercises(s),uid));toast(t('Joint plan applied'));setProposal(null)}catch(e){setError(t('Cannot apply: {0}',e.message))}}
  return <div className="narrow feature-page"><div className="hdr"><button className="iconbtn" onClick={()=>nav('/planning')}><Icon name="chevronLeft"/></button><h1>{t('Joint weekly planning')}</h1></div><p className="sect-f">{t('One proposal coordinates training and meals. It sends your planning profile, target, candidate programs and recipes to DeepSeek only when you press Generate.')}</p><Row title={t('Week start')}><TextField type="date" value={start} onChange={e=>{if(e.target.value){setStart(monday(e.target.value));setProposal(null)}}}/></Row><TextArea maxLength={4000} placeholder={t('Additional planning needs')} value={needs} onChange={e=>setNeeds(e.target.value)}/><Button variant="primary" disabled={ai.busy} onClick={generate}>{t(ai.busy?'Analyzing…':'Generate joint plan')}</Button>{ai.busy&&<Button onClick={ai.cancel}>{t('Cancel request')}</Button>}{error&&<p className="notice">{error}</p>}
  {proposal&&<><Section title={t('Review proposal')} footer={proposal.explanation}><Row title={proposal.program.nameZh}/><Segmented value={planTab} onChange={setPlanTab} options={[{value:"training",label:"训练计划"},{value:"food",label:"饮食计划"}]}/><div hidden={planTab!=="training"}><DayPlanCards title="训练计划" dates={proposal.dates} renderDay={date=><TrainingDay date={date} program={proposal.program} S={S} catalog={catalog}/>}/></div><div hidden={planTab!=="food"}><DayPlanCards title="饮食计划" dates={proposal.dates} renderDay={date=><><p className="plan-food-meta">{nutritionLine(dailyTotals(proposal.snapshots,date))}</p>{proposal.snapshots.filter(m=>m.date===date).map(meal=><Row key={meal.id} title={t(meal.slot)+' · '+meal.nameZh} subtitle='查看食材、用量和完整做法' accessory='chevron' onClick={()=>recipeDetail(recipes.find(r=>r.id===meal.recipeId),date,{initialServings:meal.servings,slot:meal.slot,preview:true})}/>)}</>}/></div><Row title={t('Apply training')} subtitle={t('Replaces the weekly schedule and clears future date overrides; previous routines remain in the library.')}><Switch checked={choices.training} onChange={v=>setChoices({...choices,training:v})}/></Row><Row title={t('Apply meals')}><Switch checked={choices.meals} onChange={v=>setChoices({...choices,meals:v})}/></Row></Section><Button variant="primary" disabled={!!S.active||(!choices.training&&!choices.meals)||proposal.baseRevision!==S.xunlian.revision} onClick={apply}>{t('Apply after review')}</Button><Button onClick={()=>setProposal(null)}>{t('Reject')}</Button></>}
  <Section title={t('Saved joint proposals')}>{S.xunlian.proposals.filter(p=>p.kind==='joint').map(p=><Row key={p.id} title={new Date(p.createdAt).toLocaleDateString()} subtitle={p.program.nameZh} onClick={()=>setProposal(p)}/>)}</Section><Button onClick={()=>nav('/review')}>{t('Undo latest plan change')}</Button></div>
}
