import { describe,it,expect } from 'vitest'
import { recipeForMeal,recipeText } from './recipe-guide.js'
import { mealSnapshot,purchaseChecked,shoppingList,emptyXunlian } from './nutrition.js'
import { migrateState } from './xunlian-state.js'
describe('Cookable meals and saved purchasing',()=>{
  it('keeps cooking instructions and quantities after a recipe is edited or deleted',()=>{
    const recipe={id:'recipe',nameZh:'鸡蛋饭',revision:1,servings:2,ingredients:[{foodId:'rice',originalText:'熟米饭',grams:400}],steps:['米饭热透后装盘。'],tips:['按熟重称量。']}
    const foods=[{id:'rice',nutritionPer100g:{kcal:130,proteinG:2},sourceRelease:'test'}]
    const meal=mealSnapshot(recipe,foods,.5,'2026-09-30','breakfast','meal')
    recipe.steps[0]='改动后的做法';recipe.ingredients[0].grams=500
    const historical=recipeForMeal(meal,[{...recipe,revision:2}])
    expect(historical.steps[0]).toBe('米饭热透后装盘。')
    expect(historical.ingredients[0].grams).toBe(400)
    expect(recipeForMeal(meal,[])).toEqual(historical)
    expect(shoppingList([meal]).items[0].grams).toBe(100)
  })
  it('persists purchased amounts and requires rechecking when quantities change',()=>{
    const defaults={schemaVersion:2,routines:[],workouts:[],bodyweight:[],customEx:[],week:{},dayPlan:{},xunlian:emptyXunlian()}
    const state=structuredClone(defaults);state.xunlian.shoppingChecked={'2026-09-28':{rice:450}}
    const restored=migrateState(state,defaults).xunlian.shoppingChecked['2026-09-28']
    expect(purchaseChecked({foodId:'rice',grams:450},restored)).toBe(true)
    expect(purchaseChecked({foodId:'rice',grams:550},restored)).toBe(false)
    state.xunlian.shoppingChecked['2026-09-28'].rice=-3
    expect(()=>migrateState(state,defaults)).toThrow('shopping')
  })
  it('shows source wording without markdown links or executable markup',()=>{
    expect(recipeText('**中火**：[焯水](../../tips.md)，`2分钟`')).toBe('中火：焯水，2分钟')
  })
})
