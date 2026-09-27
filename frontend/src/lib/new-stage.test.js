import { describe,it,expect } from 'vitest'
import { initialLoad } from './initial-load.js'
import { resolvePrescription } from './prescription.js'
import { parseHeartRate,mergeHealthSamples } from './heart-rate.js'
import { createKitchenAPI,kitchenRecipe,kitchenBase } from './howtocook-api.js'
import { feasibleMenu,coachCatalog,checkCoachProgram,mapCoachProgram,selectCoachCandidates } from './assistant-plan.js'
import { emptyXunlian,recipeNutrition } from './nutrition.js'
import { createDeepSeek } from './deepseek.js'
import { requireAI } from './ai-errors.js'
import { EXDB } from './exercises-data.js'
import names from '../data/exercise-names.json'
import foods from '../data/foods.json'
import recipes from '../data/recipes.json'
import { applyJoint,eligibleRecipes,validateMeals } from './planning-engine.js'
const profile={onboardingCompleted:true,age:30,weightKg:70,fitnessLevel:'inactive'},ex={id:'curl',eq:'dumbbell',n:'dumbbell biceps curl'},item={exerciseId:'curl',sets:3,reps:10},state={unit:'kg',workouts:[],xunlian:{profile}}
describe('initial prescriptions',()=>{
  it('uses exercise and confirmed experience, never treats body weight as strength',()=>{expect(initialLoad(profile,ex).weight).toBe(2);expect(initialLoad({...profile,weightKg:140},ex).weight).toBe(2);expect(initialLoad({...profile,fitnessLevel:'regular'},ex).weight).toBeGreaterThan(2)})
  it('preserves explicit imported loads, percentages needing a baseline, and vulnerable-profile missingness',()=>{expect(resolvePrescription(state,{...item,weight:40},ex).weight).toBe(40);expect(resolvePrescription(state,{...item,percent1RM:80},ex).weight).toBeNull();expect(initialLoad({...profile,age:15},ex)).toBeNull();expect(initialLoad({...profile,limitations:'肩部受伤'},ex)).toBeNull()})
  it('converts suggested load to lb and keeps transparent evidence',()=>{const cfg=resolvePrescription({...state,unit:'lb'},item,ex);expect(cfg.weight).toBeCloseTo(4.41,2);expect(cfg.prefillBasis.load).toBe('initial-trial');expect(cfg.prefillBasis.evidence.note).toContain('每只')})
})
describe('heart-rate measurements and historical sync',()=>{
  it('decodes both Bluetooth formats and little-endian 16-bit values',()=>{expect(parseHeartRate(new DataView(Uint8Array.from([0,120]).buffer))).toBe(120);expect(parseHeartRate(new DataView(Uint8Array.from([1,180,0]).buffer))).toBe(180)})
  it('rejects truncated, no-contact and invalid measurements',()=>{expect(()=>parseHeartRate(new DataView(Uint8Array.from([1,180]).buffer))).toThrow();expect(parseHeartRate(new DataView(Uint8Array.from([4,120]).buffer))).toBeNull();expect(parseHeartRate(new DataView(Uint8Array.from([0,0]).buffer))).toBeNull()})
  it('deduplicates repeated sync while preserving different sources',()=>{const sample={dataType:'steps',value:100,unit:'count',startDate:'2026-09-27T00:00:00Z',endDate:'2026-09-27T01:00:00Z',sourceId:'mi'};const once=mergeHealthSamples([], [sample]);expect(mergeHealthSamples(once,[sample])).toHaveLength(1);expect(mergeHealthSamples(once,[{...sample,sourceId:'other'}])).toHaveLength(2);expect(mergeHealthSamples([], [{...sample,value:NaN}])).toHaveLength(0)})
})
describe('HowToCook compatible API',()=>{
  it('sends only encoded public queries, no credentials or profile',async()=>{let call;const api=createKitchenAPI('https://example.org/api',{fetcher:async(url,options)=>{call={url,options};return{ok:true,text:async()=>JSON.stringify({data:[{id:'r',title:'鸡蛋'}]})}}});await api.search('鸡蛋&盐');expect(call.url).toContain('q=%E9%B8%A1%E8%9B%8B%26%E7%9B%90');expect(call.options.credentials).toBe('omit');expect(call.options.headers.Authorization).toBeUndefined()})
  it('does not turn approximate ingredients into exact nutritional values',()=>{const r=kitchenRecipe({id:'r',title:'鸡蛋',ingredients:[{raw:'鸡蛋适量'}],steps:['煮熟']},'https://example.org');expect(r.ingredients[0]).toMatchObject({foodId:null,grams:null});expect(recipeNutrition(r,foods).complete).toBe(false);expect(r.servingsBasis).toBe('unknown-needs-review')})
  it('rejects insecure remote bases and malformed endpoint payloads',async()=>{expect(()=>kitchenBase('http://example.org')).toThrow();expect(kitchenBase('http://127.0.0.1:3000/api')).toBe('http://127.0.0.1:3000');await expect(createKitchenAPI('https://example.org',{fetcher:async()=>({ok:true,text:async()=>'{"html":"not an API"}'})}).health()).rejects.toThrow('格式')})
})
describe('personal assistant uses the real catalog',()=>{
  const catalog=EXDB.map(e=>({...e,...names[e.id]})),p={...profile,trainingPlace:'home',homeEquipment:['dumbbell'],lowImpact:true,avoidExercises:'深蹲',trainingDays:1,availableDays:[1],trainingDuration:45}
  it('all 1324 names contain Chinese and no unresolved English or placeholders',()=>{expect(Object.keys(names)).toHaveLength(1324);for(const n of Object.values(names)){expect(n.nameZh).toMatch(/[\u4e00-\u9fff]/);expect(n.nameZh).not.toMatch(/待.*译|[a-z]/i)}expect(names['0025'].nameZh).toBe('杠铃卧推');expect(names['3220'].nameZh).toContain('开合跳')})
  it('filters equipment, forbidden movements and impact before providing candidates',()=>{const list=coachCatalog(catalog,p);expect(list.length).toBeGreaterThan(10);expect(list.every(e=>['body weight','dumbbell'].includes(e.eq))).toBe(true);expect(list.every(e=>!e.nameZh.includes('深蹲')&&!/jump|run|burpee|跳|跑/i.test(e.nameEn+' '+e.nameZh))).toBe(true);expect(selectCoachCandidates(coachCatalog(catalog,{...p,trainingPlace:'gym'})).some(e=>e.eq==='dumbbell')).toBe(true)})
  it('rejects fabricated names and schedule mismatch, discards ungrounded AI weights',()=>{const program={nameZh:'个人计划',days:[{weekday:1,dayName:'周一',exerciseItems:[{originalText:'dumbbell biceps curl',sets:2,reps:10,weight:99}]}]};const mapped=mapCoachProgram(program,catalog,'p',0);expect(mapped.days[0].exerciseItems[0].weight).toBeNull();expect(checkCoachProgram(mapped,catalog,p)).toBe(mapped);expect(()=>checkCoachProgram(mapped,catalog,{...p,availableDays:[2]})).toThrow();expect(()=>mapCoachProgram({...program,days:[{...program.days[0],exerciseItems:[{originalText:'invented',sets:3,reps:10}]}]},catalog,'p',0)).toThrow()})
  it('provides a numerically valid meal example from actual food values',()=>{const target={kcal:2200,proteinG:112},options=eligibleRecipes(recipes,foods,{allergies:'无',dislikedFoods:'没有'}),menu=feasibleMenu(options,foods,target);expect(menu).not.toBeNull();const meals=menu.map(m=>({...m,date:'2026-09-27'}));expect(validateMeals({meals},['2026-09-27'],options,foods,{},target,()=> 'id')).toHaveLength(3)})
  it('distinguishes disabled AI and missing nutrition targets',()=>{const S={xunlian:emptyXunlian()};expect(()=>requireAI(S)).toThrow('disabled');S.xunlian.ai.enabled=true;expect(()=>requireAI(S,{target:true})).toThrow('target')})
  it('structured coach protocol supplies both training and meals',async()=>{let request;const provider=createDeepSeek({credential:async()=> 'synthetic',fetcher:async(_url,options)=>{request=JSON.parse(options.body);return{ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({questions:['有什么忌口？'],summary:'确认限制'})}}]})}}});const response=await provider.generateStructured('intake',{request:'我要减脂'});expect(response.questions).toHaveLength(1);expect(request.messages[0].content).toContain('questions')})
})

// Full provider-to-application flow with real local nutrition and exercise entities.
it('applies a generated seven-day coach plan with presets and a reversible snapshot',async()=>{
  const catalog=EXDB.map(e=>({...e,...names[e.id]})),target={kcal:2200,proteinG:112,fatG:70,carbsG:280},dates=Array.from({length:7},(_,i)=>'2026-09-'+String(21+i));
  const options=eligibleRecipes(recipes,foods,{allergies:'无',dislikedFoods:'无'}),menu=feasibleMenu(options,foods,target);
  const data={program:{nameZh:'个人训练',days:[{weekday:1,dayName:'周一',exerciseItems:[{originalText:'dumbbell biceps curl',sets:2,reps:10,restSec:120,weight:null}]}]},meals:dates.flatMap(date=>menu.map(m=>({...m,date}))),explanation:'真实候选与营养值'};
  const provider=createDeepSeek({credential:async()=> 'synthetic',fetcher:async()=>({ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(data)}}]})})});
  const result=await provider.generateStructured('coach',{dates,target});
  const program=mapCoachProgram(result.program,catalog,'coach-fixture',0),snapshots=validateMeals(result,dates,options,foods,{allergies:'无'},target,()=> 'meal-id');
  const S={unit:'kg',active:null,routines:[],week:{},dayPlan:{},workouts:[],exWeights:{},xunlian:emptyXunlian()};S.xunlian.profile=profile;let nextId=0;
  applyJoint(S,{program,target,dates,snapshots,profile,baseRevision:0},{training:true,target:true,meals:true,profile:true},catalog,()=>String(++nextId));
  expect(S.xunlian.meals).toHaveLength(21);expect(S.routines).toHaveLength(1);expect(S.routines[0].ex[0].weight).toBeGreaterThan(0);expect(S.xunlian.snapshots[0].routines).toHaveLength(0);expect(S.xunlian.snapshots[0].profile).toEqual(profile);
});
