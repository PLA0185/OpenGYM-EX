import { recipeNutrition, mealSnapshot, dailyTotals, clone, validateTarget, positive, NUTRIENTS, foodIndex } from './nutrition.js'
import { applyProgram, validateProgram } from './programs.js'
import { validateMealSnapshots } from './xunlian-state.js'
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
  return !exclusionTerms(profile).some(term => allergenRules[term] ? allergenRules[term].test(term==='牛奶'?text.replace(/(?:peanut|almond|sunflower seed) butter/ig,''):text) : text.toLowerCase().includes(term.toLowerCase()))
}
export function eligibleRecipes(recipes, foods, profile) { return recipes.filter(r=>recipeNutrition(r,foods).complete && recipeAllowed(r,foods,profile)) }
export function validateMeals(result, dates, recipes, foods, profile, target, uid, enforceTargets = true) {
  if (!Array.isArray(result.meals) || result.meals.length > 56) throw new Error('Invalid meals')
  const unique = new Set()
  const snapshots = result.meals.map(m=>{
    const key=m.date+'|'+m.slot, r=recipes.find(r=>r.id===m.recipeId)
    if (!dates.includes(m.date)||!['breakfast','lunch','dinner','snack','pre','post'].includes(m.slot)||unique.has(key)||!r||!positive(m.servings,20)||!recipeAllowed(r,foods,profile)) throw new Error('Invalid or excluded meal reference')
    unique.add(key);return mealSnapshot(r,foods,m.servings,m.date,m.slot,uid())
  })
  dates.forEach(date=>{
    if (!['breakfast','lunch','dinner'].every(slot=>unique.has(date+'|'+slot)))throw new Error('Each day needs three main meals')
    const n=dailyTotals(snapshots,date)
    if(enforceTargets && target && (n.kcal==null||n.proteinG==null||Math.abs(n.kcal-target.kcal)>target.kcal*.2||Math.abs(n.proteinG-target.proteinG)>Math.max(20,target.proteinG*.3)))throw new Error('Daily energy must be within 20% and protein within 30% (minimum 20g tolerance) of the supplied target')
  })
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
