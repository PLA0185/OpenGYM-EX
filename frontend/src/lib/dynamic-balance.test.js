import { it,expect } from 'vitest'
import { clone,emptyXunlian,targets,localDate,nutritionFits,dailyTotals,mealSnapshot } from './nutrition.js'
import { dynamicBalance,linkedTarget,trainingLoad } from './dynamic-balance.js'
import { feasibleMenu } from './assistant-plan.js'
import { eligibleRecipes } from './planning-engine.js'
import { builtInPrograms,prefillProgram,applyProgram,validateProgram } from './programs.js'
import { knowledgePrograms } from './knowledge-programs.js'
import { EXDB } from './exercises-data.js'
import { KNOWLEDGE_EXERCISES } from './knowledge-exercises.js'
import { needsPartner } from './solo-exercises.js'
import guides from '../data/china-guides.json'
import foods from '../data/foods.json'
import recipes from '../data/recipes.json'
const profile={age:24,heightCm:172,sex:'male',weightKg:75,activity:1.5,goal:'lose',fitnessLevel:'inactive',onboardingCompleted:true,limitations:'无'}
const catalog=[...EXDB,...KNOWLEDGE_EXERCISES],date=localDate()
function setup(){const s={routines:[],week:{},dayPlan:{},workouts:[],bodyweight:[],customEx:[],unit:'kg',xunlian:{...emptyXunlian(),profile}};s.xunlian.target=targets(profile,75);const menu=feasibleMenu(eligibleRecipes(recipes,foods,profile),foods,s.xunlian.target,{profile});s.xunlian.meals=menu.map(m=>mealSnapshot(recipes.find(r=>r.id===m.recipeId),foods,m.servings,date,m.slot,m.slot));return s}
it('keeps only the three goals and interprets a conversational deficit within local limits',()=>{
  const ordinary=targets(profile,75),request=targets({...profile,requestedDeficitKcal:1000,goalRequest:'想减脂快一点'},75)
  expect(request.kcal).toBeLessThan(ordinary.kcal);expect(request.inputs.goal).toBe('lose');expect(request.deficitKcal).toBeLessThanOrEqual(Math.ceil(request.tdee*.2));expect(request.kcal).toBeGreaterThan(request.bmr)
})
it('distinguishes gain, maintenance and fat loss using goal-specific energy and protein rules',()=>{
  const p={...profile,weightKg:65},maintain=targets({...p,goal:'maintain'},65),gain=targets({...p,goal:'gain'},65)
  expect(gain.kcal-maintain.kcal).toBe(300);expect(gain.proteinMinimumG).toBeCloseTo(78);expect(gain.proteinMaximumG).toBe(130);expect(gain.carbsG*4/gain.kcal).toBeCloseTo(.6)
  const withBase=targets({...p,goal:'gain',fitnessLevel:'trained'},65);expect(withBase.surplusKcal).toBe(500)
  const overweight=targets({...profile,goal:'gain'},75);expect(overweight.surplusKcal).toBe(0);expect(overweight.proteinG).toBeGreaterThan(targets({...profile,goal:'maintain'},75).proteinG)
  expect(nutritionFits({...gain,kcal:gain.tdee},gain)).toBe(false)
})
it('rebalances after changing weight and notifies the user without rewriting actual history',()=>{
  const before=setup(),s=clone(before);s.bodyweight.push({d:date,w:80});dynamicBalance(before,s)
  expect(s.xunlian.target.inputs.weightKg).toBe(80);expect(nutritionFits(dailyTotals(s.xunlian.meals,date),s.xunlian.target)).toBe(true);expect(s.xunlian.logs).toEqual([]);expect(s.xunlian.balanceNotices[0].changes.join()).toContain('每日目标')
})
it('keeps small differences unchanged, preserves a changed meal and adjusts the others',()=>{
  const before=setup(),small=clone(before);small.bodyweight.push({d:date,w:75.1});dynamicBalance(before,small);expect(small.xunlian.target.kcal).toBe(before.xunlian.target.kcal)
  const s=clone(before),meal=s.xunlian.meals[1];meal.servings*=1.4;for(const key of ['kcal','proteinG','carbsG','fatG'])meal.nutritionSnapshot[key]*=1.4;const locked=clone(meal);dynamicBalance(before,s)
  expect(s.xunlian.meals.find(m=>m.id===meal.id)).toEqual(locked);expect(s.xunlian.balanceNotices).toHaveLength(1)
  if(!s.xunlian.nutritionNeedsReview)expect(nutritionFits(dailyTotals(s.xunlian.meals,date),s.xunlian.target)).toBe(true)
})
it('does not mutate consumed meals and does not rebalance photos before the replacement decision',()=>{
  const before=setup(),s=clone(before),m=s.xunlian.meals[0];s.xunlian.logs=[{...clone(m),id:'actual',plannedMealId:m.id,recordedAt:1}];const log=clone(s.xunlian.logs);dynamicBalance(before,s);expect(s.xunlian.logs).toEqual(log);expect(s.xunlian.meals.find(x=>x.id===m.id)).toEqual(m)
  const photo=clone(before);photo.xunlian.logs=[{...clone(m),id:'photo'}];dynamicBalance(before,photo,{balanceDeferred:true});expect(photo.xunlian.meals).toEqual(before.xunlian.meals)
})
it('handles changing the training schedule as a net difference, never adding the whole workout twice',()=>{
  const s=setup();applyProgram(s,builtInPrograms(catalog)[0],catalog,()=>Math.random().toString());s.xunlian.target=linkedTarget(s);const before=clone(s);s.week[3]=s.week[1];s.week[6]=s.week[1];s.week[5]=s.week[1];s.routines.forEach(r=>r.ex.forEach(e=>{e.sets=6;e.restSec=180}));dynamicBalance(before,s);expect(s.xunlian.target.trainingEnergy.deltaKcal).toBeGreaterThan(0);const retained=clone(s);dynamicBalance(retained,s);expect(s.xunlian.target).toEqual(retained.xunlian.target)
})
it('uses the selected published resistance MET instead of keeping the general estimate',()=>{
  const s=setup(),program=builtInPrograms(catalog)[0];program.activityCode='02054';applyProgram(s,program,catalog,()=>Math.random().toString())
  const general=trainingLoad(s);s.xunlian.programs[0].activityCode='02050';expect(trainingLoad(s)/general).toBeCloseTo(2)
})
it('covers every loaded guide, presets numeric loads for standard adult profiles and excludes partners',()=>{
  const plans=knowledgePrograms(catalog),s=setup();expect(plans.length).toBeGreaterThan(12)
  for(const guide of guides)expect(plans.some(p=>p.sourceGuideId===guide.id)).toBe(true)
  expect(new Set(plans.map(p=>p.id)).size).toBe(plans.length)
  for(const ex of KNOWLEDGE_EXERCISES)expect(plans.some(p=>p.days.some(d=>d.exerciseItems.some(e=>e.exerciseId===ex.id)))).toBe(true)
  for(const code of ['02054','02050','02035','02040','02056','02057'])expect(plans.some(p=>p.activityCode===code)).toBe(true)
  for(const phase of ['initial','middle','stable'])expect(plans.some(p=>p.id==='knowledge-china-fitness-2017-'+phase)).toBe(true)
  for(const p of plans){validateProgram(p,catalog);const filled=prefillProgram(s,p,catalog);for(const item of filled.days.flatMap(d=>d.exerciseItems)){expect(Number.isFinite(item.weight)).toBe(true);expect(needsPartner(catalog.find(e=>e.id===item.exerciseId))).toBe(false)}}
  expect(needsPartner(EXDB.find(e=>e.id==='0016'))).toBe(true);expect(needsPartner(EXDB.find(e=>e.id==='0009'))).toBe(false)
  const helper=clone(plans[0]);helper.days[0].exerciseItems[0].exerciseId='0016';expect(()=>validateProgram(helper,catalog)).toThrow('同伴')
})
