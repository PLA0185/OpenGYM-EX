import { it, expect } from 'vitest'
import { checkCoachProgram, feasibleMenu, eligibleJointPrograms } from './assistant-plan.js'
import { balanceCoachMeals } from './meal-portions.js'
import { coachProfile } from './coach-workflow.js'
import { knowledgePrograms } from './knowledge-programs.js'
import { EXDB } from './exercises-data.js'
import { KNOWLEDGE_EXERCISES } from './knowledge-exercises.js'
import { eligibleRecipes, validateMeals } from './planning-engine.js'
import { recipeNutrition } from './nutrition.js'
import { recoveryConflicts } from './training-recovery.js'
import { coachKnowledge } from './coach-knowledge.js'
import { matchesProgram } from './program-filters.js'
import recipes from '../data/recipes.json'
import foods from '../data/foods.json'
const catalog=[...EXDB,...KNOWLEDGE_EXERCISES]
const bench=EXDB.find(e=>e.n==='barbell bench press'),squat=EXDB.find(e=>e.n==='barbell full squat')
const day=(weekday,ex=bench)=>({weekday,dayName:'训练',exerciseItems:[{exerciseId:ex.id,mappingStatus:'exact',sets:3,reps:10,restSec:90}]})
const profile={trainingDays:5,availableDays:[1,2,3,4,5],trainingDuration:60}
it('joint selection resolves only the eligible version of a shared saved/preset ID',()=>{
  const edited={id:'shared',nameZh:'已编辑',days:[day(1),day(2)]}
  const preset={id:'shared',nameZh:'原预设',days:[day(1),day(4)]}
  const context={...profile,trainingDays:2,availableDays:[1,4],schedulePreference:'fixed'}
  const result=eligibleJointPrograms([edited,preset,{...preset,nameZh:'重复原预设'}],catalog,context)
  expect(result).toHaveLength(1)
  expect(result.find(p=>p.id==='shared')).toBe(preset)
})
it('rejects consecutive training of the same resistance muscle instead of filling five weekdays',()=>{
  expect(()=>checkCoachProgram({nameZh:'五天全身',days:[1,2,3,4,5].map(d=>day(d))},catalog,profile)).toThrow(/恢复/)
})
it('checks recovery across Sunday to Monday in a repeating week',()=>{
  expect(()=>checkCoachProgram({nameZh:'跨周',days:[day(0),day(1)]},catalog,{...profile,trainingDays:2,availableDays:[0,1]})).toThrow(/恢复/)
})
it('allows adjacent upper and lower days with spaced recovery for each muscle',()=>{
  expect(()=>checkCoachProgram({nameZh:'上下肢',days:[day(1),day(2,squat),day(4),day(5,squat)]},catalog,{...profile,trainingDays:4,availableDays:[1,2,4,5]})).not.toThrow()
})
it('spreads a flexible five-day preference and preserves explicitly fixed weekdays',()=>{
  const p=coachProfile({}, {...profile,schedulePreference:'flexible'})
  expect(p.availableDays).toEqual([1,2,4,5,6])
  expect(coachProfile({}, {...profile,schedulePreference:'fixed'}).availableDays).toEqual([1,2,3,4,5])
})
it('repairs repetitive default meals with different daily combinations using real nutrition',()=>{
  const target={kcal:2200,proteinG:136,fatG:68,carbsG:260},options=eligibleRecipes(recipes,foods,{})
  const dates=['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-10','2026-10-11']
  const menu=feasibleMenu(options,foods,target),original={meals:dates.flatMap(date=>menu.map(m=>({...m,date})))}
  const result=balanceCoachMeals(original,dates,options,foods,{},target,menu,()=> 'fixture')
  const combinations=dates.map(date=>result.meals.filter(m=>m.date===date).map(m=>m.recipeId).join('|'))
  expect(new Set(combinations).size).toBeGreaterThanOrEqual(5)
  const counts={};result.meals.forEach(m=>counts[m.recipeId]=(counts[m.recipeId]||0)+1)
  expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(4)
  expect(()=>validateMeals(result,dates,options,foods,{},target,()=> 'fixture')).not.toThrow()
})
it('varies fallback days too rather than replacing every day with the same menu',()=>{
  const target={kcal:2200,proteinG:136,fatG:68,carbsG:260},options=eligibleRecipes(recipes,foods,{})
  const low=options.find(r=>recipeNutrition(r,foods).nutrition.proteinG/recipeNutrition(r,foods).nutrition.kcal<.04)
  const dates=['2026-10-05','2026-10-06','2026-10-07'],menu=feasibleMenu(options,foods,target)
  const original={meals:dates.flatMap(date=>['breakfast','lunch','dinner'].map(slot=>({date,slot,recipeId:low.id,servings:1})))}
  const result=balanceCoachMeals(original,dates,options,foods,{},target,menu,()=> 'fixture')
  expect(new Set(result.meals.map(m=>m.recipeId)).size).toBeGreaterThanOrEqual(5)
})
it('prefers different dishes across meals in a day when a feasible varied combination exists',()=>{
  const target={kcal:2200,proteinG:136,fatG:68,carbsG:260},options=eligibleRecipes(recipes,foods,{})
  expect(new Set(feasibleMenu(options,foods,target).map(m=>m.recipeId)).size).toBe(3)
})
it('exposes goal, intensity, estimated duration and body-area metadata for every knowledge plan',()=>{
  for(const p of knowledgePrograms(catalog)){
    expect(p.filters?.goals?.length).toBeGreaterThan(0)
    expect(['low','moderate','high']).toContain(p.filters?.intensity)
    expect(p.filters?.minutes).toBeGreaterThan(0)
    expect(p.filters?.bodyParts?.length).toBeGreaterThan(0)
  }
})
it('keeps every preset compatible with repeating-week primary muscle recovery',()=>{
  const unsafe=knowledgePrograms(catalog).filter(p=>recoveryConflicts(p,catalog).length).map(p=>p.id)
  expect(unsafe).toEqual([])
})
it('supplies Chinese and international source rules plus real parameters within the AI input limit',()=>{
  const k=coachKnowledge(catalog,{goal:'lose',trainingDays:5})
  expect(k.sources.map(g=>g.id)).toEqual(expect.arrayContaining(['china-fitness-2017','china-weight-2024','acsm-resistance-2026','cdc-adults','activity-compendium-2024','recovery-sports-2024']))
  expect(k.presets.every(p=>p.days.every(d=>d.items.every(e=>e.sets>=1&&Number.isFinite(e.restSec))))).toBe(true)
  expect(JSON.stringify(k).length).toBeLessThan(45000)
})
it('filters real plan metadata together, including empty results instead of ignoring a criterion',()=>{
  const plans=knowledgePrograms(catalog),selected=plans.filter(p=>matchesProgram(p,{goal:'gain',body:'chest',intensity:'high',duration:'long'}))
  expect(selected.length).toBeGreaterThan(0)
  expect(selected.every(p=>p.filters.minutes>60&&p.filters.bodyParts.includes('chest')&&p.filters.intensity==='high')).toBe(true)
  expect(plans.filter(p=>matchesProgram(p,{goal:'gain',body:'cardio',intensity:'low',duration:'short'},'太极'))).toEqual([])
})
