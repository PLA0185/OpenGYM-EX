import { recipeNutrition, mealSnapshot, dailyTotals, clone, validateTarget, positive, NUTRIENTS, foodIndex } from './nutrition.js'
import { applyProgram, validateProgram } from './programs.js'
import { validateMealSnapshots } from './xunlian-state.js'
import { requiredMealSlots } from './meal-slots.js'
import { recipeCost,budgetRecipes } from './meal-cost.js'
const allergenRules = {
  '花生': /peanut|花生/i, '坚果': /almond|walnut|pecan|cashew|hazelnut|pistachio|坚果|杏仁|核桃|腰果/i,
  '牛奶': /milk|cheese|yogurt|cream|butter(?!.*peanut)|牛奶|奶酪|酸奶|奶油/i,
  '鸡蛋': /\begg\b|鸡蛋|蛋清|蛋黄/i, '大豆': /soy|tofu|edamame|大豆|豆腐|毛豆|生抽|酱油/i,
  '小麦': /wheat|bread|pasta|小麦|面粉|面包|意大利面/i, '鱼': /fish|salmon|tuna|鱼/i,
  '甲壳类': /shrimp|crab|lobster|crustacean|虾|蟹|龙虾/i, '芝麻': /sesame|芝麻/i
}
export const ALLERGENS = Object.keys(allergenRules)
export function exclusionTerms(profile) {
  const free = [profile.allergies, profile.dislikedFoods].filter(Boolean).join('、').split(/[、,，;；\n/]+/).map(s=>s.trim().replace(/过敏|不能吃|不吃|忌口/g,'').trim()).filter(s=>s&&!/^(无|没有|无特殊|无忌口|none|no)$/i.test(s))
  return [...new Set([...(profile.excludedAllergens||[]),...free])]
}
export function recipeAllowed(recipe, foods, profile) {
  const index=foodIndex(foods),text = [recipe.nameZh,recipe.nameEn,...recipe.ingredients.flatMap(i=>{const f=index.get(i.foodId);return [i.originalText,f?.nameZh,f?.nameEn,...(f?.allergens||[])]})].filter(Boolean).join(' ')
  if(profile.dietStyle==='vegetarian'&&/chicken|beef|pork|turkey|fish|salmon|tuna|shrimp|crab|lobster|gelatin|鸡肉|鸡胸|牛肉|猪肉|鱼|虾|蟹|肉汤/i.test(text))return false
  if(profile.dietStyle==='vegan'&&/chicken|beef|pork|turkey|fish|salmon|tuna|shrimp|crab|lobster|gelatin|\begg\b|milk|cheese|yogurt|honey|鸡蛋|蛋清|蛋黄|牛奶|酸奶|奶酪|蜂蜜|鸡肉|鸡胸|牛肉|猪肉|鱼|虾|蟹|肉汤/i.test(text))return false
  if(Number.isFinite(profile.cookingMinutes)&&profile.cookingMinutes>0&&(!Number.isFinite(recipe.prepMinutes)||recipe.prepMinutes>profile.cookingMinutes))return false
  return !exclusionTerms(profile).some(term => allergenRules[term] ? allergenRules[term].test(term==='牛奶'?text.replace(/(?:peanut|almond|sunflower seed) butter/ig,''):text) : text.toLowerCase().includes(term.toLowerCase()))
}
export function eligibleRecipes(recipes, foods, profile) { return budgetRecipes(recipes.filter(r=>recipeNutrition(r,foods).complete && recipeAllowed(r,foods,profile)),profile) }
export function validateMeals(result, dates, recipes, foods, profile, target, uid, enforceTargets = true) {
  if (!Array.isArray(result.meals) || result.meals.length > 56) throw new Error('Invalid meals')
  const unique = new Set()
  const snapshots = result.meals.map(m=>{
    const key=m.date+'|'+m.slot, r=recipes.find(r=>r.id===m.recipeId)
    if (!dates.includes(m.date)||!['breakfast','lunch','dinner','snack','pre','post'].includes(m.slot)||unique.has(key)||!r||!positive(m.servings,20)||!recipeAllowed(r,foods,profile)) throw new Error('Invalid or excluded meal reference')
    unique.add(key);const cost=recipeCost(r,profile);return {...mealSnapshot(r,foods,m.servings,m.date,m.slot,uid()),costSnapshotCny:cost==null?null:cost*m.servings,costBasis:'user-entered CNY per100g; ingredients only'}
  })
  dates.forEach(date=>{
    if (!requiredMealSlots(profile).every(slot=>unique.has(date+'|'+slot)))throw new Error('每天须包含所选餐数对应的餐次：'+requiredMealSlots(profile).join('、'))
    const n=dailyTotals(snapshots,date)
    const day=snapshots.filter(m=>m.date===date)
    if(enforceTargets&&profile.dailyBudgetCny>0&&day.every(m=>m.costSnapshotCny!=null)&&day.reduce((sum,m)=>sum+m.costSnapshotCny,0)>profile.dailyBudgetCny+.01)throw new Error(date+' 原料费用超过每日预算 '+profile.dailyBudgetCny+' 元。')
    if(enforceTargets && target && (n.kcal==null||n.proteinG==null||Math.abs(n.kcal-target.kcal)>target.kcal*.2||Math.abs(n.proteinG-target.proteinG)>Math.max(20,target.proteinG*.3)))throw new Error(date+' 餐食合计 '+Math.round(n.kcal||0)+' kcal、蛋白质 '+Math.round(n.proteinG||0)+' g，与目标 '+target.kcal+' kcal / '+target.proteinG+' g 不符，请校准份数或更换食谱。')
  })
  if(enforceTargets&&Number.isInteger(profile.repeatMeals)&&profile.repeatMeals>0){const counts={};for(const m of result.meals)counts[m.recipeId]=(counts[m.recipeId]||0)+1;if(Object.values(counts).some(n=>n>profile.repeatMeals))throw new Error('同一道菜出现次数超过每周重复上限 '+profile.repeatMeals+' 次，请更换部分菜谱。')}
  return snapshots
}
export function mealDifference(old, replacement) {
  return Object.fromEntries(NUTRIENTS.map(k=>[k,old.nutritionSnapshot[k]==null||replacement.nutritionSnapshot[k]==null?null:replacement.nutritionSnapshot[k]-old.nutritionSnapshot[k]]))
}
export function applyJoint(S, proposal, choices, exercises, uid) {
  if (S.active) throw new Error('Finish active workout first')
  if (proposal.baseRevision !== S.xunlian.revision) throw new Error('Stale proposal')
  if (choices.training) validateProgram(proposal.program,exercises)
  if (choices.target) validateTarget(proposal.target)
  if (!choices.training&&!choices.target&&!choices.meals)throw new Error('Select at least one change')
  if (choices.meals) {
    validateMealSnapshots(proposal.snapshots)
    if (!proposal.snapshots.length||!Array.isArray(proposal.dates)||proposal.snapshots.some(m=>!proposal.dates.includes(m.date)))throw new Error('Invalid meal proposal')
  }
  const snap={kind:'joint',routines:clone(S.routines),week:clone(S.week),dayPlan:clone(S.dayPlan),programs:clone(S.xunlian.programs),profile:clone(S.xunlian.profile),target:clone(S.xunlian.target),meals:clone(S.xunlian.meals),at:Date.now()}
  const oldSnapshots=clone(S.xunlian.snapshots)
  if(choices.profile)S.xunlian.profile=clone(proposal.profile)
  if(choices.training) applyProgram(S,{...proposal.program,baseRevision:proposal.baseRevision},exercises,uid)
  if(choices.target)S.xunlian.target=clone(proposal.target)
  if(choices.meals){S.xunlian.meals=[...S.xunlian.meals.filter(m=>!proposal.dates.includes(m.date)),...clone(proposal.snapshots)];S.xunlian.nutritionNeedsReview=false}
  S.xunlian.snapshots=[snap,...oldSnapshots].slice(0,3)
  S.xunlian.revision++
}
