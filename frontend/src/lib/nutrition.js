// Pure nutrition mathematics. Missing measurements stay missing; source numbers are per 100 g.
import { recipeSnapshot } from './recipe-guide.js'
export const NUTRIENTS = ['kcal', 'proteinG', 'carbsG', 'fatG', 'fiberG', 'sodiumMg', 'potassiumMg', 'calciumMg', 'ironMg']
export const clone = value => JSON.parse(JSON.stringify(value))
export const positive = (n, max = 100000) => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= max
const foodIndexes=new WeakMap()
export function foodIndex(foods){let index=foodIndexes.get(foods);if(!index){index=new Map(foods.map(f=>[f.id,f]));foodIndexes.set(foods,index)}return index}
export function scaleNutrition(n, factor) {
  if (!positive(factor)) throw new Error('Invalid portion')
  return Object.fromEntries(NUTRIENTS.map(k => [k, Number.isFinite(n?.[k]) && n[k]>=0 ? n[k] * factor : null]))
}
export function sumNutrition(list) {
  return Object.fromEntries(NUTRIENTS.map(k => [k, !list.length ? 0 : list.every(n => Number.isFinite(n?.[k])) ? list.reduce((a, n) => a + n[k], 0) : null]))
}
export function recipeNutrition(recipe, foods, servings = 1) {
  if (!positive(recipe.servings, 1000) || !positive(servings, 1000)) throw new Error('Invalid servings')
  const index = foodIndex(foods)
  const unresolved = recipe.ingredients.filter(i => !index.has(i.foodId) || !positive(i.grams))
  const parts = recipe.ingredients.map(i => index.has(i.foodId) && positive(i.grams) ? scaleNutrition(index.get(i.foodId).nutritionPer100g, i.grams / 100) : {})
  return { nutrition: scaleNutrition(sumNutrition(parts), servings / recipe.servings), complete: !unresolved.length && !!parts.length && recipe.servingsBasis !== 'unknown-needs-review', unresolved,
    estimated: recipe.ingredients.some(i => i.estimated), sourceVersions: [...new Set(recipe.ingredients.map(i => index.get(i.foodId)?.sourceRelease).filter(Boolean))] }
}
export const NUTRITION_POLICY = 'china-goal-nutrition-v2'
export const NUTRITION_SOURCES = [
  {title:'成人肥胖食养指南（2024年版）',url:'https://www.cnsoc.org/activitykit5/1325302046.html',pages:'正文第5–6页、附录6第68页'},
  {title:'WS/T 578.1—2017 宏量营养素',url:'https://www.nhc.gov.cn/ewebeditor/uploadfile/2017/10/20171017152901174.pdf',pages:'第5.1–5.3节、附录B'},
  {title:'体重管理指导原则（2024年版）',url:'https://www.nhc.gov.cn/wjw/ylyjs/202412/b3d40e0141834897808ce6c9dce76a60/files/1736390749000_59785.pdf',pages:'第5–6、10页'},
  {title:'健康中国：科学增肌的饮食安排（2026）',url:'https://www.beijing.gov.cn/fuwu/bmfw/sy/jrts/202608/t20260812_4819715.html',pages:'国家体育总局运动医学研究所专家答疑'},
  {title:'福建省体育局：增肌减脂的训练与营养（2023）',url:'https://tyj.fujian.gov.cn/zwgk/xwzx/sxdt/202310/t20231017_6274171.htm',pages:'正常体重18–30岁青年，盈余300–500 kcal'}
]
// Old releases used unexplained activity multipliers. Preserve their original
// profile value, but disclose the mapping when recalculating the new policy.
export function activityLevel(value=1.5){
  const pal=({1.2:1.5,1.4:1.5,1.6:1.75,1.8:2})[value]??Number(value)
  if(![1.5,1.75,2].includes(pal))throw new Error('请选择低、中或高的全天身体活动水平。')
  return pal
}
export function targets(profile, weight, trainingEnergy=null) {
  const { age, heightCm, sex, goal = 'maintain' } = profile
  if (!Number.isInteger(age) || age < 18 || age >= 65 || !positive(heightCm, 250) || heightCm < 100 || !positive(weight, 350) || weight < 30 || !['male', 'female'].includes(sex) || profile.specialDiet) throw new Error('自动营养计算面向18–64岁、无特殊医疗或孕哺期需求的成年人，请核对档案或使用专业指导的手动目标。')
  if(!['maintain','lose','gain'].includes(goal))throw new Error('Invalid nutrition goal')
  const pal=activityLevel(profile.activity),bmi=weight/(heightCm/100)**2
  // Exact coefficients published in the NHC food guidance appendix, not a
  // measured metabolic rate. PAL already includes the whole day's activity.
  const bmr=sex==='male'?66+13.7*weight+5*heightCm-6.8*age:655+9.5*weight+1.8*heightCm-4.7*age
  const deltaKcal=trainingEnergy?Math.max(-bmr*pal*.1,Math.min(bmr*pal*.1,trainingEnergy.deltaKcal||0)):0
  const tdee=bmr*pal+deltaKcal,restricted=goal==='lose'&&bmi>=24
  const gaining=goal==='gain',surplus=gaining&&bmi<24?(age<=30&&bmi>=18.5&&['inactive','occasional'].includes(profile.fitnessLevel)?300:500):0
  // An explicit conversational request can select a deficit; it cannot bypass
  // the application's conservative 20% cap, basal floor or BMI applicability.
  const requested=restricted&&Number.isFinite(profile.requestedDeficitKcal)?Math.min(1000,tdee*.2,Math.max(0,profile.requestedDeficitKcal)):null
  const intakeFactor=restricted?(requested!=null?1-requested/tdee:(bmi>=28?.8:.85)):1,kcal=Math.round(tdee*intakeFactor+surplus)
  if(kcal<1200||bmr<=0||kcal<=bmr)throw new Error('计算结果不适合自动安排，请核对身体资料和活动水平，使用专业指导的目标。')
  const proteinMinimumG=gaining?Math.max(sex==='male'?65:55,weight*1.2):sex==='male'?65:55
  const proteinMaximumG=gaining?weight*2:null
  const proteinG=+(gaining?Math.max(proteinMinimumG,Math.min(weight*1.6,proteinMaximumG,kcal*(surplus?.2:.25)/4)):kcal*(restricted?20:15)/400).toFixed(1)
  const proteinPct=proteinG*400/kcal,carbsPct=gaining&&surplus?60:100-proteinPct-25,fatPct=100-proteinPct-carbsPct
  const fatG=+(kcal*fatPct/900).toFixed(1),carbsG=+(kcal*carbsPct/400).toFixed(1)
  if(gaining&&(proteinG>proteinMaximumG+.05||fatPct<19.95||carbsPct<49.95))throw new Error('此档案无法同时满足增肌蛋白质与均衡供能范围，请使用专业个体目标。')
  if(proteinG<(sex==='male'?65:55))throw new Error('此档案的均衡目标低于成人蛋白质推荐摄入量，请核对或使用专业个体方案。')
  const notes=['只校验能量与三大营养素；食物多样化、盐油糖及微量营养素仍需核对，不能声称整份菜单完全达标。','基础代谢和全天消耗均为预测值，实际摄入需结合体重趋势、饥饿感和训练恢复复核。','PAL包含日常活动、训练和食物热效应；不再叠加手环或MET的运动热量。','三餐默认按30% / 40% / 30%分配；训练前后加餐从全天总量中分配。']
  if(goal==='lose'&&!restricted)notes.push('BMI低于24，不自动套用超重肥胖的限能量处方；以维持参考量起步，具体减脂需求个别评估。')
  if(gaining)notes.push(surplus?`增肌参考盈余 ${surplus} kcal/天；蛋白质1.2–2.0 g/kg，应用在范围内选取约1.6 g/kg，碳水60%，余量为脂肪。这是起始安排，需结合腰围、体重趋势与抗阻训练恢复复核。`:'BMI≥24时不自动安排增重盈余，以维持能量、提高蛋白质和抗阻训练进行体态改善；BMI不能区分肌肉与脂肪，有较高肌肉量可使用专业手动目标。')
  if(requested!=null)notes.push('已使用对话中提出的热量缺口；自动编排最多采用全天消耗的20%，不因“快速”二字继续压低摄入或突然增加训练强度。')
  if(Number(profile.activity)!==pal&&profile.activity!=null)notes.push('旧版活动档位已映射至官方PAL分级，请按全天工作、生活和训练情况重新核对。')
  if(Math.abs(deltaKcal)>=1)notes.push(`训练相对活动基线改变，按抗阻MET与估算时长调整全天消耗 ${Math.round(deltaKcal)} kcal/天；只加减变化量，未重复添加整次运动。应用暂限于原消耗的±10%，大幅变化请重新选择全天PAL；差值不是测量结果。`)
  const strategy=gaining?(surplus?'增肌：能量盈余与抗阻训练':'增肌：维持能量与体态改善'):restricted?'减脂：适度缺口与肌肉保留':goal==='lose'?'减脂：先评估体成分，保留维持参考量':'维持：吃动平衡'
  return {...(trainingEnergy?{trainingEnergy:{...trainingEnergy,deltaKcal:Math.round(deltaKcal)}}:{}),bmr:Math.round(bmr),tdee:Math.round(tdee),kcal,proteinG,fatG,carbsG,proteinMinimumG,proteinMaximumG,bmi:+bmi.toFixed(2),pal,intakeFactor,deficitKcal:Math.round(tdee-kcal),surplusKcal:surplus,strategy,nutritionPolicy:NUTRITION_POLICY,macroRanges:gaining?{proteinG:[0,surplus?20:30],fatG:[20,30],carbsG:[surplus?60:50,65]}:restricted?{proteinG:[15,20],fatG:[20,30],carbsG:[50,60]}:{proteinG:[10,15],fatG:[20,30],carbsG:[50,65]},basis:strategy+'；国家卫健委预测式 × 全天PAL；默认限能量按超重85% / 肥胖80%，增肌参考官方专家指导；具体起始取值由应用选取',notes,sourceReferences:NUTRITION_SOURCES,inputs:{age,heightCm,sex,weightKg:weight,pal,goal,requestedDeficitKcal:profile.requestedDeficitKcal??null},trainingBasis:{days:profile.trainingDays??null,minutes:profile.trainingDuration??null,time:profile.trainingTime??null}}
}
export function nutritionFits(n,target){
  if(!target)return true
  const official=target.nutritionPolicy===NUTRITION_POLICY
  if(!Number.isFinite(n.kcal)||!Number.isFinite(n.proteinG)||Math.abs(n.kcal-target.kcal)>target.kcal*(official?.1:.2)||Math.abs(n.proteinG-target.proteinG)>Math.max(20,target.proteinG*.3))return false
  // Judge composition against macro energy; source kcal can include fiber and
  // specific Atwater factors. Do not rewrite food composition to force 4/4/9.
  if(official){const energy=n.proteinG*4+n.fatG*9+n.carbsG*4;if(!Number.isFinite(energy)||energy<=0||n.proteinG<target.proteinMinimumG-.05||target.proteinMaximumG!=null&&n.proteinG>target.proteinMaximumG+.05||target.surplusKcal>0&&n.kcal<=target.tdee||target.deficitKcal>0&&n.kcal>=target.tdee||n.kcal<=target.bmr)return false;for(const [key,[min,max]] of Object.entries(target.macroRanges)){const pct=n[key]*(key==='fatG'?9:4)/energy*100;if(pct<min-0.05||pct>max+0.05)return false}}
  return true
}
export function validateTarget(target) {
  if (!positive(target.kcal, 8000) || target.kcal < 800 || !['proteinG','fatG','carbsG'].every(k => typeof target[k] === 'number' && Number.isFinite(target[k]) && target[k] >= 0 && target[k] < 1000)) throw new Error('Invalid nutrition target')
  if(target.nutritionPolicy===NUTRITION_POLICY&&(!nutritionFits(target,target)||Math.abs(target.proteinG*4+target.fatG*9+target.carbsG*4-target.kcal)>2))throw new Error('官方均衡目标的供能比例或总能量不一致。')
  return target
}
export function planningTarget(S,profile){
  const old=S.xunlian.target
  if(old&&(old.basis==='manual'||!old.basis))return validateTarget(clone(old))
  return validateTarget(targets(profile,profile.weightKg,old?.trainingEnergy?{...old.trainingEnergy,deltaKcal:profile.weightKg*(old.trainingEnergy.weeklyLoad-old.trainingEnergy.baselineLoad)/7}:null))
}
export function validatePlanningProfile(profile){
  if(!profile||typeof profile!=='object'||Array.isArray(profile))throw new Error('个人档案格式不正确。')
  const ranges={age:[12,100,true],weightKg:[25,350],heightCm:[100,250],trainingDays:[1,7,true],trainingDuration:[10,180],mealCount:[1,6,true],repeatMeals:[1,42,true],cookingMinutes:[1,600],dailyBudgetCny:[1,10000]}
  if(profile.requestedDeficitKcal!=null&&(!Number.isFinite(profile.requestedDeficitKcal)||profile.requestedDeficitKcal<0||profile.requestedDeficitKcal>1000))throw new Error('对话请求的热量缺口需为0–1000 kcal，实际仍按个人适用范围限制。')
  for(const [key,[min,max,integer]] of Object.entries(ranges)){const value=profile[key];if(value!=null&&value!==''&&(!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value))))throw new Error(key+' 需为 '+min+'–'+max+(integer?' 的整数。':'。'))}
  if(profile.foodPrices!=null&&(typeof profile.foodPrices!=='object'||Array.isArray(profile.foodPrices)||Object.keys(profile.foodPrices).length>5000||Object.values(profile.foodPrices).some(p=>!Number.isFinite(p)||p<0||p>10000)))throw new Error('食材价格格式不正确。')
  return profile
}
export function mealSnapshot(recipe, foods, servings, date, slot, id) {
  const result = recipeNutrition(recipe, foods, servings)
  if (!result.complete || !Number.isFinite(result.nutrition.kcal)) throw new Error('Recipe needs ingredient mapping and grams')
  return { id, date, slot, recipeId: recipe.id, recipeRevision: recipe.revision || 1, nameZh: recipe.nameZh, nameEn: recipe.nameEn, servings, nutritionSnapshot: result.nutrition,
    ingredientsSnapshot: clone(recipe.ingredients).map(i => ({ ...i, grams: i.grams * servings / recipe.servings })), recipeSnapshot:recipeSnapshot(recipe), nutritionSourceVersion: result.sourceVersions, estimated: result.estimated }
}
export function dailyTotals(entries, date) { return sumNutrition(entries.filter(m => m.date === date && m.status !== 'skipped').map(m => m.nutritionSnapshot)) }
export const purchaseChecked=(item,checked)=>Number.isFinite(checked?.[item.foodId])&&Math.abs(checked[item.foodId]-item.grams)<.05
export function shoppingList(meals) {
  const grouped = new Map(), unresolved = []
  meals.forEach(m => (m.ingredientsSnapshot || []).forEach(i => {
    if (!i.foodId || !positive(i.grams)) { unresolved.push(i); return }
    const old = grouped.get(i.foodId) || { foodId: i.foodId, grams: 0 }
    old.grams += i.grams; grouped.set(i.foodId, old)
  }))
  return { items: [...grouped.values()], unresolved }
}
export function dateKeys(start) {
  const d = new Date(start + 'T12:00:00')
  if (!Number.isFinite(+d)) throw new Error('Invalid date')
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return localDate(x) })
}
export const localDate = (d = new Date()) => [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-')
export function monday(date = localDate()) { const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() - (d.getDay()+6)%7); return localDate(d) }
export function emptyXunlian() {
  return { schemaVersion: 1, revision: 0, profile: { goal: 'maintain', activity: 1.5, mealCount: 3, allergies: '', dislikedFoods: '', budget: '', equipment: '', limitations: '', trainingTime: '18:30', sleepSchedule: '', cookingAvailability: '' }, target: null,
    foods: [], recipes: [], meals: [], logs: [], programs: [], exerciseAliases: {}, foodAliases: {}, favorites: [], shoppingChecked: {}, drafts: [], proposals: [], snapshots: [], balanceNotices:[], healthSamples:[], healthLastSync:null, ai: { enabled: false, model: 'deepseek-flash' }, nutritionNeedsReview: false }
}
export const searchFood = (food, q) => [food.nameZh, food.nameEn, ...(food.aliasesZh||[]), ...(food.aliasesEn||[])].some(x => x?.toLowerCase().includes(q.toLowerCase().trim()))
export function planningContext(S) {
  const x = S.xunlian || emptyXunlian(), bw = S.bodyweight?.at(-1)?.w
  return { ...x.profile, weightKg: bw == null ? x.profile.weightKg : S.unit === 'lb' ? bw * .45359237 : bw, target: x.target,
    training: { week: S.week, routines: S.routines.map(r => ({ id: r.id, name: r.name, ex: r.ex.map(e=>({id:e.id,sets:e.sets,reps:e.reps,weight:e.weight,restSec:e.restSec,sec:e.sec,min:e.min,mode:e.mode,sg:e.sg})) })) }, revision: x.revision }
}
