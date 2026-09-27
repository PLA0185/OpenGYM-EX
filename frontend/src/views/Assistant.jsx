import { requiredMealSlots } from '../lib/meal-slots.js'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { allExercises,exerciseName } from '../lib/exercises.js'
import { allFoods,allRecipes,nutritionLine } from './Nutrition.jsx'
import { clone,planningContext,monday,dateKeys,recipeNutrition,dailyTotals } from '../lib/nutrition.js'
import { eligibleRecipes,validateMeals,applyJoint } from '../lib/planning-engine.js'
import { coachCatalog,checkCoachProgram,feasibleMenu,mapCoachProgram,selectCoachCandidates } from '../lib/assistant-plan.js'
import { COACH_BRIEF_PROMPT,coachProfile,coachTarget,validateBrief,briefFallback } from '../lib/coach-workflow.js'
import { balanceCoachMeals } from '../lib/meal-portions.js'
import { createDeepSeek } from '../lib/deepseek.js'
import { getCredential } from '../lib/credentials.js'
import { requireAI,aiErrorMessage } from '../lib/ai-errors.js'
import { useAIRequest } from '../lib/useAIRequest.js'
import { uid } from '../lib/format.js'
import guides from '../data/china-guides.json'
import { Section,Row,Button,TextArea,NumberField,SelectRow } from '../components/ui.jsx'
import { ProgramReview } from './Programs.jsx'
export default function Assistant(){
  const S=useStore(s=>s.S),update=useStore(s=>s.update),nav=useNavigate(),ai=useAIRequest()
  const saved=S.xunlian.proposals.find(p=>p.origin==='assistant')
  const [request,setRequest]=useState(saved?.request||''),[intake,setIntake]=useState(saved?.brief||null),[answers,setAnswers]=useState({}),[profile,setProfile]=useState(clone(saved?.profile||planningContext(S))),[proposal,setProposal]=useState(saved||null),[error,setError]=useState(''),[modification,setModification]=useState('')
  const foods=allFoods(S),recipes=eligibleRecipes(allRecipes(S),foods,profile).slice(0,40),candidates=coachCatalog(allExercises(S),profile),dates=proposal?.dates||dateKeys(monday())
  const provider=()=>createDeepSeek({credential:getCredential,model:S.xunlian.ai.model})
  async function buildProposal(signal,resolved,brief,conversation,previous=null){
    if(!Number.isInteger(resolved.age)||resolved.age<18||resolved.age>65)throw new Error('自动编排面向18–65岁成年人，请使用手动或专业指导方案。')
    if(resolved.specialDiet)throw new Error('特殊医疗或孕期需求请使用专业指导方案。')
    const target=coachTarget(S,resolved),allowedRecipes=eligibleRecipes(allRecipes(S),foods,resolved).slice(0,40),catalog=coachCatalog(allExercises(S),resolved),supplied=selectCoachCandidates(catalog)
    if(!allowedRecipes.length||!supplied.length)throw new Error('当前限制下没有足够的动作或营养完整菜谱，请补充数据或修改条件。')
    const menu=feasibleMenu(allowedRecipes,foods,target,{profile:resolved})
    if(!menu)throw new Error('当前菜谱在忌口、餐数和已知价格预算条件下没有可行组合，需要补充菜谱或原料价格。')
    const input={task:'Create a new editable training program and seven-day meals from the user request and answers. Preserve user schedule, injuries and food exclusions. Do not ask more questions. Only supplied exercises, exact nameEn or nameZh in originalText, new loads null. Respect availableDays, trainingDays and trainingDuration. Meals use supplied IDs; choose varied practical meals and portions. Local code recalculates portions from real nutrition; feasibleDayMenu is a verified fallback, not a requirement to repeat every day. Explain workout/meal timing for commute, shower and work when mentioned; distinguish suggested arrangements from user requirements. No extreme rapid weight-loss promises.',request,answers:conversation,requiredSlots:requiredMealSlots(resolved),context:{...resolved,target},assumptions:brief.assumptions,dates,exercises:supplied.map(e=>({nameEn:e.nameEn||e.n,nameZh:e.nameZh,equipment:e.eq,muscle:e.tg,type:e.bp})),recipes:allowedRecipes.map(r=>({id:r.id,name:r.nameZh,ingredients:r.ingredients.map(i=>foods.find(f=>f.id===i.foodId)?.nameZh),nutrition:recipeNutrition(r,foods).nutrition})),feasibleDayMenu:menu,guides,previous,modification}
    let program,balanced
    const result=await provider().generateStructured('coach',input,{signal,validate:data=>{program=mapCoachProgram(data.program,supplied,uid(),S.xunlian.revision);checkCoachProgram(program,catalog,resolved);balanced=balanceCoachMeals(data,dates,allowedRecipes,foods,resolved,target,menu,uid)}})
    const next={kind:'joint',origin:'assistant',id:uid(),...result,program,meals:balanced.meals,explanation:[result.explanation,...brief.assumptions,balanced.note].filter(Boolean).join('\n'),target,snapshots:balanced.snapshots,dates,profile:clone(resolved),baseRevision:S.xunlian.revision,createdAt:Date.now(),model:S.xunlian.ai.model,conversation,request,brief}
    setProfile(resolved);setIntake(brief);setProposal(next);setModification('');update(s=>{s.xunlian.proposals=[clone(next),...s.xunlian.proposals.filter(p=>p.origin!=='assistant')].slice(0,10)})
  }
  const ask=()=>ai.run(async signal=>{setError('');setProposal(null);setIntake(null);setAnswers({});try{
    requireAI(S);const stored=planningContext(S)
    const brief=await provider().generateStructured('brief',{task:COACH_BRIEF_PROMPT,request,existingProfile:stored},{signal,validate:data=>validateBrief(data,stored)})
    const resolved=coachProfile(stored,brief.profile);setProfile(resolved);setIntake(brief)
    if(!brief.questions.length)await buildProposal(signal,resolved,brief,[])
  }catch(e){if(e.code==='schema'){const fallback=briefFallback(planningContext(S));setIntake(fallback);setProfile(planningContext(S));if(!fallback.questions.length)setError('AI条件提取格式异常，请重试；没有重复资料需要填写。')}else setError(e.code?aiErrorMessage(e):e.message)}})
  const generate=()=>ai.run(async signal=>{setError('');try{
    requireAI(S)
    const conversation=proposal?.conversation||intake.questions.map((question,i)=>({question,answer:answers[i]||''}))
    if(!proposal&&intake.questions.some((_,i)=>!answers[i]?.trim()))throw new Error('请回答剩下的必要问题。')
    const stored=proposal?profile:planningContext(S),brief=await provider().generateStructured('brief',{task:COACH_BRIEF_PROMPT,request,existingProfile:stored,previousSummary:intake.summary,answers:conversation,modification},{signal,validate:data=>validateBrief(data,stored,{answered:true})})
    await buildProposal(signal,coachProfile(stored,brief.profile),brief,conversation,proposal?{program:proposal.program,meals:proposal.meals}:null)
  }catch(e){setError(e.code?aiErrorMessage(e):e.message)}})
  const apply=()=>{setError('');try{checkCoachProgram(proposal.program,candidates,profile);const snapshots=validateMeals(proposal,proposal.dates,recipes,foods,profile,proposal.target,uid);update(s=>{applyJoint(s,{...proposal,snapshots,profile:{...proposal.profile,onboardingCompleted:true}},{training:true,meals:true,target:true,profile:true},allExercises(s),uid)});useUI.getState().toast('训练与饮食计划已应用');nav('/plan')}catch(e){setError(e.message)}}
  return <div className="narrow feature-page"><h1>AI 训练与饮食教练</h1><p className="sect-f">说出目标与条件，已有资料自动使用，只补问缺少的必要信息。生成后可直接查看和修改，应用时才替换当前计划。</p><TextArea maxLength={3000} value={request} placeholder="例如：我想减脂，每周五天，早上六点半到健身房，九点上班，给我训练和配套饮食" onChange={e=>setRequest(e.target.value)}/><Button variant="primary" disabled={ai.busy||!request.trim()} onClick={ask}>生成训练与饮食方案</Button><Button onClick={()=>nav('/settings')}>AI 连接设置</Button>
    {intake&&!proposal&&<><p className="sect-f">{intake.summary}</p>{intake.questions.length>0&&<><Section title="只需补充这些">{intake.questions.map((question,i)=><div className="card" key={i}><p>{question}</p><TextArea maxLength={1500} value={answers[i]||''} placeholder="已有条件不用重填，没有限制请写无" onChange={e=>setAnswers({...answers,[i]:e.target.value})}/></div>)}</Section><Button variant="primary" disabled={ai.busy||intake.questions.some((_,i)=>!answers[i]?.trim())} onClick={generate}>回答完了，直接生成</Button></>}</>}
    {ai.busy&&<p className="sect-f" role="status">正在整理你的条件并编排训练与饮食…</p>}{ai.busy&&<Button onClick={ai.cancel}>取消请求</Button>}{error&&<p className="notice">{error}</p>}
    {proposal&&<>{proposal.baseRevision!==S.xunlian.revision&&<p className="notice">这是保存的方案，当前计划已改变。可查看，重新生成后才能应用。</p>}<Section title="审核训练与饮食" footer={proposal.explanation}><Row title={proposal.program.nameZh} subtitle={proposal.program.days.map(d=>d.dayName+'：'+d.exerciseItems.map(item=>exerciseName(candidates.find(e=>e.id===item.exerciseId))).join('、')).join('\n')}/><Button onClick={()=>useUI.getState().openSheet(close=><ProgramReview initial={proposal.program} close={close} onConfirm={program=>setProposal({...proposal,program})}/>)}>编辑动作、组次、重量和休息</Button><Row title="营养目标" value={proposal.target.kcal+' kcal · 蛋白质 '+proposal.target.proteinG+' g'}/><Button onClick={()=>{try{const menu=feasibleMenu(recipes,foods,proposal.target,{profile}),balanced=balanceCoachMeals(proposal,proposal.dates,recipes,foods,profile,proposal.target,menu,uid);setProposal({...proposal,meals:balanced.meals,snapshots:balanced.snapshots});setError('');useUI.getState().toast(balanced.note||'当前份数符合营养目标')}catch(e){setError(e.message)}}}>按营养目标校准餐食份数</Button>
      {proposal.dates.map(date=><Section key={date} title={date} footer={nutritionLine(dailyTotals(proposal.snapshots,date))}>{proposal.meals.filter(m=>m.date===date).map(meal=><div className="card" key={date+meal.slot}><SelectRow title={{breakfast:'早餐',lunch:'午餐',dinner:'晚餐',snack:'加餐',pre:'训练前',post:'训练后'}[meal.slot]} value={meal.recipeId} options={recipes.map(r=>({value:r.id,label:r.nameZh}))} onChange={v=>{const meals=proposal.meals.map(m=>m===meal?{...m,recipeId:v}:m);setProposal({...proposal,meals,snapshots:validateMeals({meals},proposal.dates,recipes,foods,profile,proposal.target,uid,false)})}}/><Row title="份数"><NumberField value={meal.servings} onChange={v=>{if(v<.1||v>20)return;const meals=proposal.meals.map(m=>m===meal?{...m,servings:v}:m);setProposal({...proposal,meals,snapshots:validateMeals({meals},proposal.dates,recipes,foods,profile,proposal.target,uid,false)})}}/></Row></div>)}</Section>)}</Section><TextArea maxLength={2000} value={modification} placeholder="继续修改，例如：周五换成上肢，晚餐不想吃鸡肉" onChange={e=>setModification(e.target.value)}/><Button disabled={ai.busy||!modification.trim()} onClick={generate}>按这句话修改方案</Button><Button variant="primary" disabled={ai.busy||!!S.active||proposal.baseRevision!==S.xunlian.revision} onClick={apply}>应用这份训练和饮食</Button></>}
  </div>
}
