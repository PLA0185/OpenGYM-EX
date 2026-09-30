import { describe, it, expect, vi } from 'vitest'
import { NUTRIENTS, recipeNutrition, sumNutrition, mealSnapshot, dailyTotals, shoppingList, targets, emptyXunlian, clone, dateKeys } from './nutrition.js'
import { mapEntity, stripTranscript } from './entity-mapping.js'
import { applyProgram, builtInPrograms, energyEstimate } from './programs.js'
import { EXDB } from './exercises-data.js'
import { backupState, migrateState } from './xunlian-state.js'
import { createDeepSeek, DEEPSEEK_URL } from './deepseek.js'
const nutrient = Object.fromEntries(NUTRIENTS.map(k=>[k,10]))
const foods=[{id:'a',nutritionPer100g:{...nutrient,kcal:100},sourceRelease:'v1'}]
const recipe={id:'r',nameZh:'测试',servings:2,ingredients:[{foodId:'a',grams:200}],steps:['做法'],revision:1}
const state=()=>({routines:[],workouts:[],bodyweight:[],customEx:[],week:{},dayPlan:{},xunlian:emptyXunlian()})
describe('Nutrition fact boundaries',()=>{
  it('scales per100g and servings exactly',()=>expect(recipeNutrition(recipe,foods,3).nutrition.kcal).toBe(300))
  it('keeps missing micronutrients unknown',()=>expect(sumNutrition([{...nutrient,ironMg:null},nutrient]).ironMg).toBeNull())
  it('rejects unknown foods as complete nutrition',()=>{const n=recipeNutrition({...recipe,ingredients:[{foodId:'missing',grams:100}]},foods);expect(n.complete).toBe(false);expect(n.nutrition.kcal).toBeNull()})
  it('rejects NaN and invalid portions',()=>{expect(()=>recipeNutrition(recipe,foods,NaN)).toThrow();expect(()=>recipeNutrition(recipe,foods,-1)).toThrow()})
  it('historical snapshots survive recipe edits',()=>{const r=clone(recipe),m=mealSnapshot(r,foods,1,'2026-09-27','lunch','log');r.ingredients[0].grams=500;expect(m.nutritionSnapshot.kcal).toBe(100);expect(m.ingredientsSnapshot[0].grams).toBe(100)})
  it('plans and actual logs are independent',()=>{const planned=mealSnapshot(recipe,foods,1,'2026-09-27','lunch','m');expect(dailyTotals([],planned.date).kcal).toBe(0);expect(dailyTotals([planned],planned.date).kcal).toBe(100)})
  it('shopping totals use scaled snapshot ingredients',()=>{const a=mealSnapshot(recipe,foods,2,'2026-09-27','lunch','a');expect(shoppingList([a,a]).items[0].grams).toBe(400)})
  it('adult equation has a reproducible result and rejects unsupported age',()=>{const p={age:30,heightCm:175,sex:'male',activity:1.4};expect(targets(p,70).bmr).toBe(1696);expect(()=>targets({...p,age:16},70)).toThrow();expect(()=>targets({...p,specialDiet:true},70)).toThrow()})
  it('date arithmetic survives month boundaries',()=>expect(dateKeys('2026-09-28').at(-1)).toBe('2026-10-04'))
})
describe('Mapping and executable training',()=>{
  const entities=[{id:'1',nameZh:'器械推胸',nameEn:'machine chest press'},{id:'2',nameZh:'器械推胸',nameEn:'incline machine chest press'}]
  it('never silently chooses duplicate exact aliases',()=>{const m=mapEntity('器械推胸',entities);expect(m.mappingStatus).toBe('ambiguous');expect(m.selectedExerciseId).toBeNull()})
  it('partial variant matching always needs confirmation',()=>{const m=mapEntity('窄握器械推胸',entities);expect(m.selectedExerciseId).toBeNull()})
  it('valid personal mappings win and deleted ids are ignored',()=>{expect(mapEntity('器械推胸',entities,{'器械推胸':'2'}).selectedExerciseId).toBe('2');expect(mapEntity('器械推胸',entities,{'器械推胸':'gone'}).selectedExerciseId).toBeNull()})
  it('removes subtitle metadata without losing narration',()=>expect(stripTranscript('WEBVTT\n1\n00:00:00.000 --> 00:00:03.000\n卧推四组')).toBe('卧推四组'))
  it('all 9 templates resolve to upstream IDs',()=>{const templates=builtInPrograms(EXDB);expect(templates).toHaveLength(9);templates.forEach(p=>{const s=state();applyProgram(s,p,EXDB,()=>Math.random().toString());expect(Object.keys(s.week)).toHaveLength(p.days.length)})})
  it('unresolved exercises block the entire Apply before mutation',()=>{const s=state(),p=clone(builtInPrograms(EXDB)[0]);p.days[0].exerciseItems[0].exerciseId='missing';expect(()=>applyProgram(s,p,EXDB,()=> 'id')).toThrow();expect(s.routines).toEqual([]);expect(s.xunlian.snapshots).toEqual([])})
  it('duplicate weekdays and stale proposals are rejected',()=>{const s=state(),p=clone(builtInPrograms(EXDB)[0]);p.days[1].weekday=p.days[0].weekday;expect(()=>applyProgram(s,p,EXDB,()=> 'id')).toThrow();p.days[1].weekday=4;p.baseRevision=2;expect(()=>applyProgram(s,p,EXDB,()=> 'id')).toThrow()})
  it('training changes mark existing meals for review and preserve history',()=>{const s=state();s.xunlian.meals=[{id:'meal'}];s.workouts=[{id:'history'}];applyProgram(s,builtInPrograms(EXDB)[0],EXDB,()=>Math.random().toString());expect(s.xunlian.nutritionNeedsReview).toBe(true);expect(s.workouts).toEqual([{id:'history'}])})
  it('calculates deterministic gross energy, with confidence and input guard',()=>{expect(energyEstimate(70,60,3.5,6,true)).toMatchObject({kcalMin:257,kcalMax:441,confidence:'medium'});expect(()=>energyEstimate(70,0,3.5)).toThrow()})
})
describe('Backups',()=>{
  it('migrates legacy state without inventing logs',()=>expect(migrateState(state(),state()).xunlian.logs).toEqual([]))
  it('rejects future schema and malformed payloads without mutation',()=>{expect(()=>migrateState({schemaVersion:99},state())).toThrow();expect(()=>migrateState({...state(),routines:{}},state())).toThrow();expect(()=>migrateState({...state(),xunlian:{...emptyXunlian(),logs:[{}]}},state())).toThrow()})
  it('removes credentials recursively from backup',()=>{const s=state();s.xunlian.ai.apiKey='private';s.token='private';s.xunlian.drafts=[{data:{credential:'private'}}];expect(JSON.stringify(backupState(s))).not.toContain('private')})
})
const reply=(content,finish_reason='stop')=>({ok:true,json:async()=>({choices:[{finish_reason,message:{content}}]})})
describe('DeepSeek provider contract',()=>{
  const example={nameZh:'菜',servings:1,ingredients:[{originalText:'鸡蛋',foodName:'egg',grams:100,estimated:false,confidence:'high'}],steps:['熟制']}
  it('uses official endpoint, Bearer, model, non-thinking and JSON Output',async()=>{const fetcher=vi.fn(async()=>reply(JSON.stringify(example))),p=createDeepSeek({credential:async()=> 'test-key',fetcher});await p.generateStructured('recipe',{text:'data'});const [url,options]=fetcher.mock.calls[0];expect(url).toBe(DEEPSEEK_URL);expect(options.headers.Authorization).toBe('Bearer test-key');expect(JSON.parse(options.body)).toMatchObject({model:'deepseek-flash',thinking:{type:'disabled'},stream:false,response_format:{type:'json_object'}})})
  it.each([400,401,402,422])('does not retry permanent status %i',async(status)=>{const fetcher=vi.fn(async()=>({ok:false,status}));await expect(createDeepSeek({credential:async()=> 'x',fetcher}).healthCheck()).rejects.toMatchObject({code:status});expect(fetcher).toHaveBeenCalledTimes(1)})
  it.each([429,500,503])('limits retries for transient status %i',async(status)=>{const fetcher=vi.fn(async()=>({ok:false,status}));await expect(createDeepSeek({credential:async()=> 'x',fetcher,sleep:async()=>{}}).healthCheck()).rejects.toMatchObject({code:status});expect(fetcher).toHaveBeenCalledTimes(3)})
  it('repairs malformed schema once then fails without accepting it',async()=>{const fetcher=vi.fn(async()=>reply('{}'));await expect(createDeepSeek({credential:async()=> 'x',fetcher}).generateStructured('recipe',{})).rejects.toMatchObject({code:'schema'});expect(fetcher).toHaveBeenCalledTimes(2)})
  it('repairs malformed JSON and accepts only validated result',async()=>{const fetcher=vi.fn().mockResolvedValueOnce(reply('{')).mockResolvedValueOnce(reply(JSON.stringify(example)));expect((await createDeepSeek({credential:async()=> 'x',fetcher}).generateStructured('recipe',{})).nameZh).toBe('菜')})
  it.each([['','empty'],['{}','truncated']])('rejects empty or truncated responses',async(content,code)=>{const fetcher=async()=>reply(content,code==='truncated'?'length':'stop');await expect(createDeepSeek({credential:async()=> 'x',fetcher}).healthCheck()).rejects.toMatchObject({code})})
  it('times out and redacts raw network errors',async()=>{const fetcher=(_,o)=>new Promise((resolve,reject)=>o.signal.addEventListener('abort',()=>reject(Object.assign(new Error('private key'),{name:'AbortError'}))));await expect(createDeepSeek({credential:async()=> 'x',fetcher,timeoutMs:5}).healthCheck()).rejects.toMatchObject({code:'timeout'});await expect(createDeepSeek({credential:async()=> '',fetcher}).healthCheck()).rejects.toMatchObject({code:'credential'})})
})
