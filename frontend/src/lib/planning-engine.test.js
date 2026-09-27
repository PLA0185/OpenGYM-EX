import { describe,it,expect } from 'vitest'
import { eligibleRecipes,validateMeals,applyJoint,mealDifference } from './planning-engine.js'
import { emptyXunlian,clone } from './nutrition.js'
import { migrateState } from './xunlian-state.js'
import { createDeepSeek } from './deepseek.js'
import { applyProgram } from './programs.js'
const food={id:'f',nameZh:'花生',nameEn:'Peanuts',nutritionPer100g:{kcal:600,proteinG:20,fatG:40,carbsG:20}}
const recipe={id:'r',nameZh:'花生碗',servings:1,ingredients:[{foodId:'f',grams:100}],steps:['取食']}
const day='2026-09-27',profile={},target={kcal:1800,proteinG:60,fatG:120,carbsG:60}
const input={meals:['breakfast','lunch','dinner'].map(slot=>({date:day,slot,recipeId:'r',servings:1}))}
const state=()=>({routines:[],week:{},dayPlan:{},workouts:[],bodyweight:[],customEx:[],xunlian:emptyXunlian()})
describe('Coordinated planning boundaries',()=>{
  it('excludes allergens in Chinese and English food labels',()=>{expect(eligibleRecipes([recipe],[food],{excludedAllergens:['花生']})).toEqual([]);expect(eligibleRecipes([recipe],[food],{allergies:'花生过敏'})).toEqual([])})
  it('requires three main meals and unique date-slot references',()=>{expect(()=>validateMeals(input,[day],[recipe],[food],profile,target,()=> 'id')).not.toThrow();expect(()=>validateMeals({...input,meals:input.meals.slice(1)},[day],[recipe],[food],profile,target,()=> 'id')).toThrow();expect(()=>validateMeals({...input,meals:[...input.meals,input.meals[0]]},[day],[recipe],[food],profile,target,()=> 'id')).toThrow()})
  it('rejects unknown IDs, excluded foods and daily target violations',()=>{expect(()=>validateMeals(input,[day],[recipe],[food],{allergies:'花生'},target,()=> 'id')).toThrow();expect(()=>validateMeals(input,[day],[],[food],profile,target,()=> 'id')).toThrow();expect(()=>validateMeals(input,[day],[recipe],[food],profile,{...target,kcal:800},()=> 'id')).toThrow()})
  it('joint application validates before any change and rejects stale proposals',()=>{const s=state(),before=clone(s);expect(()=>applyJoint(s,{baseRevision:0,program:{nameZh:'bad',days:[]}},{training:true},[],()=> 'id')).toThrow();expect(s).toEqual(before);expect(()=>applyJoint(s,{baseRevision:9},{meals:true},[],()=> 'id')).toThrow()})
  it('supports a nutrition-only joint proposal with reversible snapshot',()=>{const s=state(),snapshots=validateMeals(input,[day],[recipe],[food],profile,target,()=> 'id');applyJoint(s,{baseRevision:0,dates:[day],snapshots},{meals:true},[],()=> 'id');expect(s.xunlian.meals).toHaveLength(3);expect(s.xunlian.snapshots[0].meals).toEqual([]);expect(s.routines).toEqual([])})
  it('shows unknown differences rather than fabricating zeros',()=>expect(mealDifference({nutritionSnapshot:{kcal:100,ironMg:null}},{nutritionSnapshot:{kcal:200,ironMg:5}})).toMatchObject({kcal:100,ironMg:null}))
  it('rejects damaged restored joint snapshots before any mutation',()=>{const s=state(),before=clone(s);expect(()=>applyJoint(s,{baseRevision:0,dates:[day],snapshots:[{id:'x',date:day,nutritionSnapshot:{kcal:-1}}]},{meals:true},[],()=> 'id')).toThrow();expect(s).toEqual(before)})
  it('preserves native cardio minutes rather than treating them as strength seconds',()=>{const ex=[{id:'cardio',bp:'cardio'}],s=state(),p={id:'p',nameZh:'有氧',days:[{weekday:1,dayName:'骑行',exerciseItems:[{exerciseId:'cardio',mappingStatus:'exact',sets:1,durationSec:1200}]}]};applyProgram(s,p,ex,()=> 'routine');expect(s.routines[0].ex[0]).toMatchObject({mode:'cardio',min:20});const invalid=clone(p);delete invalid.days[0].exerciseItems[0].durationSec;invalid.days[0].exerciseItems[0].reps=10;expect(()=>applyProgram(state(),invalid,ex,()=> 'id')).toThrow()})
  it('does not classify peanut butter as milk while excluding real milk',()=>{const pb={...food,nameZh:'花生酱',nameEn:'Peanut butter'},milk={...food,nameZh:'牛奶',nameEn:'Milk'};expect(eligibleRecipes([recipe],[pb],{excludedAllergens:['牛奶']})).toHaveLength(1);expect(eligibleRecipes([recipe],[milk],{excludedAllergens:['牛奶']})).toHaveLength(0)})
})
describe('Restore and provider domain repairs',()=>{
  it('rejects arbitrary JSON and impossible dates before restore',()=>{expect(()=>migrateState({},state())).toThrow();const s=state();s.xunlian.logs=[{id:'x',date:'2026-02-30',nutritionSnapshot:{kcal:100}}];expect(()=>migrateState(s,state())).toThrow()})
  it('rejects corrupted nutrient values and snapshots',()=>{const s=state();s.xunlian.logs=[{id:'x',date:day,nutritionSnapshot:{kcal:-1}}];expect(()=>migrateState(s,state())).toThrow();s.xunlian.logs=[];s.xunlian.snapshots=[{routines:[{}]}];expect(()=>migrateState(s,state())).toThrow()})
  it('performs exactly one repair for a domain-invalid AI result',async()=>{let count=0;const fetcher=async()=>{count++;return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({recipeId:'unknown',servings:1,explanation:'x'})}}]})}};await expect(createDeepSeek({credential:async()=> 'test',fetcher}).generateStructured('swap',{}, {validate:()=>{throw new Error('Unknown ID')}})).rejects.toMatchObject({code:'domain'});expect(count).toBe(2)})
  it('handles empty JSON content with one repair',async()=>{let count=0;const fetcher=async()=>{count++;return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:count===1?'':JSON.stringify({recipeId:'r',servings:1,explanation:'x'})}}]})}};expect((await createDeepSeek({credential:async()=> 'test',fetcher}).generateStructured('swap',{})).recipeId).toBe('r');expect(count).toBe(2)})
  it('rejects malformed saved reviews and programs during restore',()=>{const s=state();s.xunlian.proposals=[{baseRevision:0,summary:'bad'}];expect(()=>migrateState(s,state())).toThrow();s.xunlian.proposals=[];s.xunlian.programs=[{days:[]}];expect(()=>migrateState(s,state())).toThrow()})
})
