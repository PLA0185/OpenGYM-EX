// Offline quality checks; no downloads or AI account needed.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { EXDB } from '../../frontend/src/lib/exercises-data.js'
import { recipeNutrition,NUTRIENTS } from '../../frontend/src/lib/nutrition.js'
const root=resolve(import.meta.dirname,'../..')
const read=path=>JSON.parse(readFileSync(resolve(root,path),'utf8'))
const foods=read('frontend/src/data/foods.json'),recipes=read('frontend/src/data/recipes.json'),names=read('frontend/src/data/exercise-names.json'),sources=read('data/sources.lock.json').sources
function unique(list,kind){const seen=new Set();for(const item of list){if(typeof item.id!=='string'||!item.id||seen.has(item.id))throw new Error(kind+' invalid/duplicate ID');seen.add(item.id)}}
unique(foods,'Food');unique(recipes,'Recipe')
for(const food of foods){if(typeof food.nameEn!=='string'||!food.nameZh||food.nutritionBasis!=='per100g edible portion'||!Number.isFinite(food.nutritionPer100g?.kcal))throw new Error('Invalid food '+food.id);for(const key of NUTRIENTS){const n=food.nutritionPer100g[key];if(n!=null&&(!Number.isFinite(n)||n<0))throw new Error('Invalid nutrient '+food.id+' '+key)}}
for(const recipe of recipes){if(!recipe.nameZh||!Array.isArray(recipe.ingredients)||!recipe.ingredients.length||!Array.isArray(recipe.steps)||!recipe.steps.length||recipe.steps.some(s=>typeof s!=='string'||!s.trim())||!Number.isFinite(recipe.servings)||recipe.servings<=0)throw new Error('Invalid recipe '+recipe.id);for(const i of recipe.ingredients){if(i.grams!=null&&(!Number.isFinite(i.grams)||i.grams<=0))throw new Error('Invalid grams '+recipe.id)}}
if(Object.keys(names).length!==EXDB.length)throw new Error('Exercise translation coverage mismatch')
for(const exercise of EXDB){const name=names[exercise.id];if(!name||!/[\u4e00-\u9fff]/.test(name.nameZh)||/待.*译|[a-z]/i.test(name.nameZh)||name.nameEn!==exercise.n)throw new Error('Exercise name mismatch '+exercise.id)}
for(const source of sources)if(!/^[a-f0-9]{64}$/.test(source.sha256)||!source.release||!source.license||!source.localPath.startsWith('data/raw/'))throw new Error('Invalid source lock')
const report={status:'PASS',checks:'offline seed structure, stable references, finite nutrition, source locks and complete Chinese exercise names',foods:foods.length,exactChineseFoods:foods.filter(f=>f.translationSource==='manual').length,recipes:recipes.length,cookableRecipes:recipes.filter(r=>r.ingredients.length&&r.steps.every(s=>typeof s==='string'&&s.trim())).length,planningEligibleRecipes:recipes.filter(r=>recipeNutrition(r,foods).complete).length,sourceRecipesNeedingReview:recipes.filter(r=>!recipeNutrition(r,foods).complete).length,exercises:EXDB.length,sources:sources.length}
process.stdout.write(JSON.stringify(report,null,2)+'\n')
