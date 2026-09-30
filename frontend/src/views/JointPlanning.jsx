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
import { builtInPrograms, guidelinePrograms, analyzeProgram } from '../lib/programs.js'
import { planningContext, planningTarget, clone, monday, dateKeys, dailyTotals } from '../lib/nutrition.js'
import { eligibleRecipes, validateMeals, applyJoint } from '../lib/planning-engine.js'
import { balanceCoachMeals } from '../lib/meal-portions.js'
import { feasibleMenu } from '../lib/assistant-plan.js'
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
    const input={task:'Generate ONE coordinated training and nutrition week. Choose a supplied programId and supplied recipeIds only. Preserve supplied nutrition target. Each date needs supplied requiredSlots. Respect context.target including nutritionPolicy and macroRanges. Daily energy within 10% for the official policy (otherwise 20%); local code verifies real-food macro ratios and protein minimum. Consider training days, time, allergies, equipment and personal needs. Explain recovery and meal timing.',context,dates,needs,programs:programs.map(p=>({id:p.id,name:p.nameZh,days:p.days,analysis:analyzeProgram(p,catalog)})),recipes:recipes.map(r=>({id:r.id,name:r.nameZh,ingredients:r.ingredients.map(i=>foods.find(f=>f.id===i.foodId)?.nameZh),nutrition:dailyRecipe(r)}))}
    const menu=feasibleMenu(recipes,foods,target,{profile:S.xunlian.profile});if(!menu)throw new Error('当前菜谱无法满足营养目标，请补充符合忌口的完整菜谱。');input.feasibleDayMenu=menu;input.requiredSlots=requiredMealSlots(S.xunlian.profile)
    let balanced
    const validate=result=>{if(!programs.some(p=>p.id===result.programId))throw new Error('Unknown training program ID');balanced=balanceCoachMeals(result,dates,recipes,foods,S.xunlian.profile,target,menu,uid)}
    const result=await createDeepSeek({credential:getCredential,model:S.xunlian.ai.model}).generateStructured('joint',input,{signal,validate})
    const p={kind:'joint',id:uid(),...result,meals:balanced.meals,explanation:[result.explanation,balanced.note].filter(Boolean).join(' '),program:clone(programs.find(p=>p.id===result.programId)),target:clone(target),snapshots:balanced.snapshots,dates,baseRevision:S.xunlian.revision,model:S.xunlian.ai.model,createdAt:Date.now()}
    setProposal(p);update(s=>{s.xunlian.proposals.unshift(p);s.xunlian.proposals=s.xunlian.proposals.slice(0,10)})
  }catch(e){setError(aiErrorMessage(e))}})
  function dailyRecipe(r){return r.ingredients.reduce((n,i)=>{const f=foods.find(f=>f.id===i.foodId);for(const k of ['kcal','proteinG','fatG','carbsG'])n[k]=(n[k]||0)+f.nutritionPer100g[k]*i.grams/100/r.servings;return n},{})}
  const apply=()=>{try{update(s=>applyJoint(s,proposal,{...choices,target:choices.meals&&!!proposal.target.basis&&proposal.target.basis!=='manual'},allExercises(s),uid));toast(t('Joint plan applied'));setProposal(null)}catch(e){setError(t('Cannot apply: {0}',e.message))}}
  return <div className="narrow feature-page"><div className="hdr"><button className="iconbtn" onClick={()=>nav('/planning')}><Icon name="chevronLeft"/></button><h1>{t('Joint weekly planning')}</h1></div><p className="sect-f">{t('One proposal coordinates training and meals. It sends your planning profile, target, candidate programs and recipes to DeepSeek only when you press Generate.')}</p><Row title={t('Week start')}><TextField type="date" value={start} onChange={e=>{if(e.target.value){setStart(monday(e.target.value));setProposal(null)}}}/></Row><TextArea maxLength={4000} placeholder={t('Additional planning needs')} value={needs} onChange={e=>setNeeds(e.target.value)}/><Button variant="primary" disabled={ai.busy} onClick={generate}>{t(ai.busy?'Analyzing…':'Generate joint plan')}</Button>{ai.busy&&<Button onClick={ai.cancel}>{t('Cancel request')}</Button>}{error&&<p className="notice">{error}</p>}
  {proposal&&<><Section title={t('Review proposal')} footer={proposal.explanation}><Row title={proposal.program.nameZh}/><Segmented value={planTab} onChange={setPlanTab} options={[{value:"training",label:"训练计划"},{value:"food",label:"饮食计划"}]}/><div hidden={planTab!=="training"}><DayPlanCards title="训练计划" dates={proposal.dates} renderDay={date=><TrainingDay date={date} program={proposal.program} S={S} catalog={catalog}/>}/></div><div hidden={planTab!=="food"}><DayPlanCards title="饮食计划" dates={proposal.dates} renderDay={date=><><p className="plan-food-meta">{nutritionLine(dailyTotals(proposal.snapshots,date))}</p>{proposal.snapshots.filter(m=>m.date===date).map(meal=><Row key={meal.id} title={t(meal.slot)+' · '+meal.nameZh} subtitle='查看食材、用量和完整做法' accessory='chevron' onClick={()=>recipeDetail(recipes.find(r=>r.id===meal.recipeId),date,{initialServings:meal.servings,slot:meal.slot,preview:true})}/>)}</>}/></div><Row title={t('Apply training')} subtitle={t('Replaces the weekly schedule and clears future date overrides; previous routines remain in the library.')}><Switch checked={choices.training} onChange={v=>setChoices({...choices,training:v})}/></Row><Row title={t('Apply meals')}><Switch checked={choices.meals} onChange={v=>setChoices({...choices,meals:v})}/></Row></Section><Button variant="primary" disabled={!!S.active||(!choices.training&&!choices.meals)||proposal.baseRevision!==S.xunlian.revision} onClick={apply}>{t('Apply after review')}</Button><Button onClick={()=>setProposal(null)}>{t('Reject')}</Button></>}
  <Section title={t('Saved joint proposals')}>{S.xunlian.proposals.filter(p=>p.kind==='joint').map(p=><Row key={p.id} title={new Date(p.createdAt).toLocaleDateString()} subtitle={p.program.nameZh} onClick={()=>setProposal(p)}/>)}</Section><Button onClick={()=>nav('/review')}>{t('Undo latest plan change')}</Button></div>
}
