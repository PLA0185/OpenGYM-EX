import { linkedTarget,rebalanceDay } from '../lib/dynamic-balance.js'
import { applyProgram } from '../lib/programs.js'
import { requiredMealSlots } from '../lib/meal-slots.js'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { allExercises,exerciseName } from '../lib/exercises.js'
import { allFoods,allRecipes,nutritionLine,recipeDetail } from './Nutrition.jsx'
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
import { coachKnowledge,COACH_PLAN_PROMPT } from '../lib/coach-knowledge.js'
import { Section,Row,Button,TextArea,NumberField,SelectRow,Segmented } from '../components/ui.jsx'
import DayPlanCards,{ TrainingDay } from '../components/DayPlanCards.jsx'
import { ProgramReview } from './Programs.jsx'
export default function Assistant(){
  const S=useStore(s=>s.S),update=useStore(s=>s.update),nav=useNavigate(),ai=useAIRequest()
  const saved=S.xunlian.proposals.find(p=>p.origin==='assistant')
  const [request,setRequest]=useState(saved?.request||''),[intake,setIntake]=useState(saved?.brief||null),[answers,setAnswers]=useState({}),[profile,setProfile]=useState(clone(saved?.profile||planningContext(S))),[proposal,setProposal]=useState(saved||null),[error,setError]=useState(''),[modification,setModification]=useState(''),[planTab,setPlanTab]=useState('training')
  const foods=allFoods(S),recipes=eligibleRecipes(allRecipes(S),foods,profile).slice(0,40),candidates=coachCatalog(allExercises(S),profile),dates=proposal?.dates||dateKeys(monday())
  const provider=()=>createDeepSeek({credential:getCredential,model:S.xunlian.ai.model})
  const briefInput=stored=>{const k=coachKnowledge(allExercises(S),stored);return {task:COACH_BRIEF_PROMPT,request,existingProfile:stored,knowledge:{sources:k.sources,rules:k.rules}}}
  async function buildProposal(signal,resolved,brief,conversation,previous=null){
    if(!Number.isInteger(resolved.age)||resolved.age<18||resolved.age>64)throw new Error('当前自动营养编排面向18–64岁成年人，请使用手动或专业指导方案。')
    if(resolved.specialDiet)throw new Error('特殊医疗或孕期需求请使用专业指导方案。')
    let target=coachTarget(S,resolved);const allowedRecipes=eligibleRecipes(allRecipes(S),foods,resolved).slice(0,40),catalog=coachCatalog(allExercises(S),resolved),supplied=selectCoachCandidates(catalog)
    if(!allowedRecipes.length||!supplied.length)throw new Error('当前限制下没有足够的动作或营养完整菜谱，请补充数据或修改条件。')
    const menu=feasibleMenu(allowedRecipes,foods,target,{profile:resolved})
    if(!menu)throw new Error('当前菜谱在忌口、餐数和已知价格预算条件下没有可行组合，需要补充菜谱或原料价格。')
    const knowledge=coachKnowledge(allExercises(S),resolved)
    const input={task:COACH_PLAN_PROMPT,request,answers:conversation,requiredSlots:requiredMealSlots(resolved),context:{...resolved,target},assumptions:brief.assumptions,dates,exercises:supplied.map(e=>({nameEn:e.nameEn||e.n,nameZh:e.nameZh,equipment:e.eq,muscle:e.tg,type:e.bp})),recipes:allowedRecipes.map(r=>({id:r.id,name:r.nameZh,ingredients:r.ingredients.map(i=>foods.find(f=>f.id===i.foodId)?.nameZh),nutrition:recipeNutrition(r,foods).nutrition})),feasibleDayMenu:menu,knowledge,previous,modification}
    let program,balanced
    const result=await provider().generateStructured('coach',input,{signal,validate:data=>{if(data.referenceGuideIds?.some(id=>!knowledge.sources.some(g=>g.id===id)))throw new Error('使用了未提供的知识来源，请仅引用 knowledge.sources。');program=mapCoachProgram(data.program,supplied,uid(),S.xunlian.revision);checkCoachProgram(program,catalog,resolved);if(target.nutritionPolicy){const prospective=clone(S);prospective.active=null;prospective.xunlian.profile=resolved;prospective.xunlian.target=target;applyProgram(prospective,program,catalog,uid);target=linkedTarget(prospective,resolved)}balanced=balanceCoachMeals(data,dates,allowedRecipes,foods,resolved,target,feasibleMenu(allowedRecipes,foods,target,{profile:resolved}),uid)}})
    const references=knowledge.sources.filter(g=>result.referenceGuideIds?.includes(g.id))
    const next={knowledgeSources:knowledge.sources,referenceGuides:references,kind:'joint',origin:'assistant',id:uid(),...result,program,meals:balanced.meals,explanation:[result.explanation,...brief.assumptions,balanced.note].filter(Boolean).join('\n'),target,snapshots:balanced.snapshots,dates,profile:clone(resolved),baseRevision:S.xunlian.revision,createdAt:Date.now(),model:S.xunlian.ai.model,conversation,request,brief}
    setProfile(resolved);setIntake(brief);setProposal(next);setModification('');update(s=>{s.xunlian.proposals=[clone(next),...s.xunlian.proposals.filter(p=>p.origin!=='assistant')].slice(0,10)})
  }
  const ask=()=>ai.run(async signal=>{setError('');setProposal(null);setIntake(null);setAnswers({});try{
    requireAI(S);const stored=planningContext(S)
    const brief=await provider().generateStructured('brief',briefInput(stored),{signal,validate:data=>validateBrief(data,stored)})
    const resolved=coachProfile(stored,brief.profile);setProfile(resolved);setIntake(brief)
    if(!brief.questions.length)await buildProposal(signal,resolved,brief,[])
  }catch(e){if(e.code==='schema'){const fallback=briefFallback(planningContext(S));setIntake(fallback);setProfile(planningContext(S));if(!fallback.questions.length)setError('AI条件提取格式异常，请重试；没有重复资料需要填写。')}else setError(e.code?aiErrorMessage(e):e.message)}})
  const generate=()=>ai.run(async signal=>{setError('');try{
    requireAI(S)
    const conversation=proposal?.conversation||intake.questions.map((question,i)=>({question,answer:answers[i]||''}))
    if(!proposal&&intake.questions.some((_,i)=>!answers[i]?.trim()))throw new Error('请回答剩下的必要问题。')
    const stored=proposal?profile:planningContext(S),brief=await provider().generateStructured('brief',{...briefInput(stored),previousSummary:intake.summary,answers:conversation,modification},{signal,validate:data=>validateBrief(data,stored,{answered:true})})
    await buildProposal(signal,coachProfile(stored,brief.profile),brief,conversation,proposal?{program:proposal.program,meals:proposal.meals}:null)
  }catch(e){setError(e.code?aiErrorMessage(e):e.message)}})
  function saveProposal(next){setProposal(next);update(s=>{s.xunlian.proposals=[clone(next),...s.xunlian.proposals.filter(p=>p.id!==next.id&&p.origin!=='assistant')].slice(0,10)})}
  function adjustProposal(program=proposal.program,meals=proposal.meals,changed=null){
    try{
      const scheduleEdited=program.days.map(d=>d.weekday).sort().join(',')!==proposal.program.days.map(d=>d.weekday).sort().join(',')
      const adjustedProfile={...profile,...(scheduleEdited?{schedulePreference:'fixed',availableDays:program.days.map(d=>d.weekday)}:{}),trainingDays:program.days.length}
      const prospective=clone(S);prospective.active=null;prospective.xunlian.profile=adjustedProfile;prospective.xunlian.target=proposal.target;prospective.xunlian.logs=[]
      applyProgram(prospective,program,candidates,uid)
      const target=proposal.target.nutritionPolicy?linkedTarget(prospective,adjustedProfile):proposal.target
      prospective.xunlian.meals=validateMeals({meals},proposal.dates,recipes,foods,adjustedProfile,target,uid,false)
      let pending=false;const notes=[]
      const snapshots=proposal.dates.flatMap(date=>{const lock=changed?prospective.xunlian.meals.filter(m=>m.date===changed.date&&m.slot===changed.slot).map(m=>m.id):[];const balanced=rebalanceDay(prospective,date,target,lock);if(!balanced.ok)pending=true;if(balanced.note)notes.push(date+'：'+balanced.note);return balanced.meals})
      setProfile(adjustedProfile);saveProposal({...proposal,profile:adjustedProfile,program,target,snapshots,meals:snapshots.map(m=>({date:m.date,slot:m.slot,recipeId:m.recipeId,servings:m.servings})),balancePending:pending,explanation:[proposal.explanation,'已重新核对训练与饮食；'+(notes.join(' ')||'差异在目标容差内，保留原餐食份数。')].join('\n')})
      setError(pending?'已保留你的修改；当前餐食组合不能满足所有条件，请换菜、校准或继续告诉AI如何调整。':'');useUI.getState().toast('已联动核对方案，查看调整说明')
    }catch(e){saveProposal({...proposal,program,meals,balancePending:true});setError(e.message)}
  }
  const apply=()=>{setError('');try{checkCoachProgram(proposal.program,candidates,profile);const snapshots=validateMeals(proposal,proposal.dates,recipes,foods,profile,proposal.target,uid);update(s=>{return applyJoint(s,{...proposal,snapshots,profile:{...proposal.profile,onboardingCompleted:true}},{training:true,meals:true,target:true,profile:true},allExercises(s),uid)});useUI.getState().toast('训练与饮食计划已应用');nav('/plan')}catch(e){setError(e.message)}}
  return <div className="narrow feature-page"><h1>AI 训练与饮食教练</h1><p className="sect-f">说出目标与条件，已有资料自动使用，只补问缺少的必要信息。生成后可直接查看和修改，应用时才替换当前计划。</p><TextArea maxLength={3000} value={request} placeholder="例如：我想减脂，每周五天，早上六点半到健身房，九点上班，给我训练和配套饮食" onChange={e=>setRequest(e.target.value)}/><Button variant="primary" disabled={ai.busy||!request.trim()} onClick={ask}>生成训练与饮食方案</Button><Button onClick={()=>nav('/settings')}>AI 连接设置</Button>
    {intake&&!proposal&&<><p className="sect-f">{intake.summary}</p>{intake.questions.length>0&&<><Section title="只需补充这些">{intake.questions.map((question,i)=><div className="card" key={i}><p>{question}</p><TextArea maxLength={1500} value={answers[i]||''} placeholder="已有条件不用重填，没有限制请写无" onChange={e=>setAnswers({...answers,[i]:e.target.value})}/></div>)}</Section><Button variant="primary" disabled={ai.busy||intake.questions.some((_,i)=>!answers[i]?.trim())} onClick={generate}>回答完了，直接生成</Button></>}</>}
    {ai.busy&&<p className="sect-f" role="status">正在整理你的条件并编排训练与饮食…</p>}{ai.busy&&<Button onClick={ai.cancel}>取消请求</Button>}{error&&<p className="notice">{error}</p>}
    {proposal&&<>{proposal.baseRevision!==S.xunlian.revision&&<p className="notice">这是保存的方案，当前计划已改变。可查看，重新生成后才能应用。</p>}<h2>审核训练与饮食</h2><details><summary>方案说明与安排依据</summary><p className="sect-f" style={{whiteSpace:'pre-line'}}>{proposal.explanation}</p></details><details className="knowledge-basis"><summary>本次输入的知识库参考</summary><p className="sect-f">先提炼来源要点，再按你的条件编排；具体动作、星期和公斤数属于应用方案。</p>{(proposal.knowledgeSources||[]).map(g=><p className="sect-f" key={g.id}><a href={g.url} target="_blank" rel="noreferrer">{g.title}</a>：{g.summary}</p>)}{proposal.referenceGuides?.length>0&&<p className="sect-f">AI 声明使用：{proposal.referenceGuides.map(g=>g.title).join('、')}</p>}</details><p>{proposal.program.nameZh}</p>
      <Segmented value={planTab} onChange={setPlanTab} options={[{value:"training",label:"训练计划"},{value:"food",label:"饮食计划"}]}/><div hidden={planTab!=="training"}><DayPlanCards title="训练计划" dates={proposal.dates} renderDay={date=><TrainingDay date={date} program={proposal.program} S={{...S,xunlian:{...S.xunlian,profile}}} catalog={candidates}/>}/><Button onClick={()=>useUI.getState().openSheet(close=><ProgramReview initial={proposal.program} close={close} onConfirm={program=>adjustProposal(program)}/>)}>编辑动作、组次、重量和休息</Button></div>
      <div hidden={planTab!=="food"}><DayPlanCards title="饮食计划" dates={proposal.dates} renderDay={date=><><p className="plan-food-meta">{nutritionLine(dailyTotals(proposal.snapshots,date))} · 目标 {proposal.target.kcal} kcal</p>{proposal.meals.filter(m=>m.date===date).map(meal=><div className="card" key={meal.slot}><small>{({breakfast:'早餐',lunch:'午餐',dinner:'晚餐',snack:'加餐',pre:'训练前',post:'训练后'})[meal.slot]}</small><p className="plan-food-name">{recipes.find(r=>r.id===meal.recipeId)?.nameZh||meal.recipeId}</p><p className="plan-food-meta">{Math.round(meal.servings*100)/100} 份 · {nutritionLine(proposal.snapshots.find(m=>m.date===date&&m.slot===meal.slot)?.nutritionSnapshot)}</p><div className="plan-card-actions"><Button size="sm" onClick={()=>recipeDetail(recipes.find(r=>r.id===meal.recipeId),date,{initialServings:meal.servings,slot:meal.slot,preview:true})}>食材与完整做法</Button><Button size="sm" onClick={()=>useUI.getState().openSheet(close=><ProposalMealEdit meal={meal} recipes={recipes} close={close} onSave={next=>{const meals=proposal.meals.map(m=>m.date===meal.date&&m.slot===meal.slot?{...m,...next}:m);adjustProposal(proposal.program,meals,meal)}}/>)}>换菜 / 份数</Button></div></div>)}</>}/></div>
      <details><summary>营养目标的计算依据</summary>{proposal.target.notes?.map(note=><p className="sect-f" key={note}>{note}</p>)}<p className="sect-f">基础代谢预测 {proposal.target.bmr??'—'}，全天消耗预测 {proposal.target.tdee??'—'} kcal/天，已包含训练。每周安排变更后应核对全天活动档位，不能按训练次数直接猜消耗。</p><Button onClick={()=>nav('/planning')}>查看官方来源与档案</Button></details><section className="nutrition-target" aria-label="营养目标"><h3>每日营养目标</h3><div className="target-numbers"><span><b>{proposal.target.kcal}</b> kcal</span><span>蛋白质 <b>{proposal.target.proteinG}</b> g</span></div><p className="target-basis">{proposal.target.basis||'手动目标'}</p></section><Button onClick={()=>{try{const menu=feasibleMenu(recipes,foods,proposal.target,{profile}),balanced=balanceCoachMeals(proposal,proposal.dates,recipes,foods,profile,proposal.target,menu,uid);saveProposal({...proposal,meals:balanced.meals,snapshots:balanced.snapshots,balancePending:false});setError('');useUI.getState().toast(balanced.note||'当前份数符合营养目标')}catch(e){setError(e.message)}}}>按营养目标校准餐食份数</Button>
      <TextArea maxLength={2000} value={modification} placeholder="继续修改，例如：周五换成上肢，晚餐不想吃鸡肉" onChange={e=>setModification(e.target.value)}/><Button disabled={ai.busy||!modification.trim()} onClick={generate}>按这句话修改方案</Button><Button variant="primary" disabled={ai.busy||proposal.balancePending||!!S.active||proposal.baseRevision!==S.xunlian.revision} onClick={apply}>应用这份训练和饮食</Button></>}
  </div>
}

function ProposalMealEdit({meal,recipes,close,onSave}){
  const [recipeId,setRecipeId]=useState(meal.recipeId),[servings,setServings]=useState(meal.servings)
  return <><h2>调整这餐</h2><SelectRow title="菜谱" value={recipeId} options={recipes.map(r=>({value:r.id,label:r.nameZh}))} onChange={setRecipeId}/><Row title="份数"><NumberField value={servings} onChange={setServings}/></Row><Button variant="primary" disabled={servings<.1||servings>20} onClick={()=>{onSave({recipeId,servings});close()}}>保存这餐</Button></>
}
