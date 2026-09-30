// Recipe instructions are plain text. Preserve the base recipe in meal history.
export const recipeText=text=>String(text||'').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[`*]/g,'').trim()
export function recipeSnapshot(recipe){
  const keys=['id','nameZh','nameEn','servings','servingsBasis','ingredients','steps','tools','tips','image','images','notes','source','sourceUrl','license','revision','prepMinutes','prepTimeBasis','cookingBasis','safetySource','originalText','quantityText']
  return JSON.parse(JSON.stringify(Object.fromEntries(keys.filter(k=>recipe[k]!==undefined).map(k=>[k,recipe[k]]))))
}
export function recipeForMeal(meal,recipes){
  const current=recipes.find(r=>r.id===meal.recipeId)
  if(meal.recipeSnapshot&&(!current||current.revision!==meal.recipeRevision))return meal.recipeSnapshot
  if(current)return current
  if(!meal.ingredientsSnapshot?.length)return null
  return {id:meal.recipeId,nameZh:meal.nameZh,nameEn:meal.nameEn,servings:1,ingredients:meal.ingredientsSnapshot.map(i=>({...i,grams:i.grams/(meal.servings||1)})),steps:[],notes:'此旧记录没有保存做法，原菜谱已移除。食材与营养快照仍保留。',source:'餐食记录快照',revision:meal.recipeRevision}
}
