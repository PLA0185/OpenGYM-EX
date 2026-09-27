// Costs are based only on owner-entered CNY per 100g for the exact raw/cooked ID.
// No guessed national prices or silent dry-to-cooked conversion.
export function recipeCost(recipe,profile={}){
  let cost=0
  for(const i of recipe.ingredients){const price=profile.foodPrices?.[i.foodId];if(!Number.isFinite(price)||price<0||!Number.isFinite(i.grams))return null;cost+=price*i.grams/100/recipe.servings}
  return cost
}
export function budgetRecipes(recipes,profile){
  if(!(profile.dailyBudgetCny>0))return recipes
  const priced=recipes.filter(r=>recipeCost(r,profile)!=null)
  return priced.length?priced:recipes
}
