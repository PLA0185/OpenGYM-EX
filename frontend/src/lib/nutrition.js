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
export function targets(profile, weight) {
  const { age, heightCm, sex, activity = 1.4, goal = 'maintain' } = profile
  if (!positive(age, 100) || age < 18 || !positive(heightCm, 250) || heightCm < 100 || !positive(weight, 350) || weight < 30 || !['male', 'female'].includes(sex) || profile.specialDiet) throw new Error('Complete adult profile or set manual targets')
  if (![1.2, 1.4, 1.6, 1.8].includes(Number(activity))) throw new Error('Invalid activity factor')
  const bmr = 10 * weight + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161)
  const tdee = bmr * Number(activity)
  const kcal = Math.round(tdee * (goal === 'lose' ? .9 : goal === 'gain' ? 1.08 : 1))
  const proteinG = Math.round(weight * 1.6), fatG = Math.round(weight * .8)
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, proteinG, fatG, carbsG: Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4)), basis: 'Mifflin-St Jeor; activity factor; estimated, not measured' }
}
export function validateTarget(target) {
  if (!positive(target.kcal, 8000) || target.kcal < 800 || !['proteinG','fatG','carbsG'].every(k => typeof target[k] === 'number' && Number.isFinite(target[k]) && target[k] >= 0 && target[k] < 1000)) throw new Error('Invalid nutrition target')
  return target
}
export function validatePlanningProfile(profile){
  if(!profile||typeof profile!=='object'||Array.isArray(profile))throw new Error('个人档案格式不正确。')
  const ranges={age:[12,100,true],weightKg:[25,350],heightCm:[100,250],trainingDays:[1,7,true],trainingDuration:[10,180],mealCount:[1,6,true],repeatMeals:[1,42,true],cookingMinutes:[1,600],dailyBudgetCny:[1,10000]}
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
  return { schemaVersion: 1, revision: 0, profile: { goal: 'maintain', activity: 1.4, mealCount: 3, allergies: '', dislikedFoods: '', budget: '', equipment: '', limitations: '', trainingTime: '18:30', sleepSchedule: '', cookingAvailability: '' }, target: null,
    foods: [], recipes: [], meals: [], logs: [], programs: [], exerciseAliases: {}, foodAliases: {}, favorites: [], shoppingChecked: {}, drafts: [], proposals: [], snapshots: [], healthSamples:[], healthLastSync:null, ai: { enabled: false, model: 'deepseek-flash' }, nutritionNeedsReview: false }
}
export const searchFood = (food, q) => [food.nameZh, food.nameEn, ...(food.aliasesZh||[]), ...(food.aliasesEn||[])].some(x => x?.toLowerCase().includes(q.toLowerCase().trim()))
export function planningContext(S) {
  const x = S.xunlian || emptyXunlian(), bw = S.bodyweight?.at(-1)?.w
  return { ...x.profile, weightKg: bw == null ? x.profile.weightKg : S.unit === 'lb' ? bw * .45359237 : bw, target: x.target,
    training: { week: S.week, routines: S.routines.map(r => ({ id: r.id, name: r.name, ex: r.ex.map(e=>({id:e.id,sets:e.sets,reps:e.reps,weight:e.weight,restSec:e.restSec,sec:e.sec,min:e.min,mode:e.mode,sg:e.sg})) })) }, revision: x.revision }
}
