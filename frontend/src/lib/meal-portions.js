import { recipeNutrition } from './nutrition.js'
import { validateMeals } from './planning-engine.js'
import { feasibleMenu } from './assistant-plan.js'
import { recipeCost } from './meal-cost.js'
const fits=(parts,target,profile)=>{const kcal=parts.reduce((a,p)=>a+p.kcal*p.servings,0),protein=parts.reduce((a,p)=>a+p.proteinG*p.servings,0);return Math.abs(kcal-target.kcal)<=target.kcal*.2&&Math.abs(protein-target.proteinG)<=Math.max(20,target.proteinG*.3)&&(!(profile.dailyBudgetCny>0)||parts.some(p=>p.cost==null)||parts.reduce((sum,p)=>sum+p.cost*p.servings,0)<=profile.dailyBudgetCny+.01)}
// Solve portions using catalog nutrition, not model arithmetic. Never weaken
// exclusions/reference validation or invent nutrient data to get a passing plan.
export function fitPortions(meals,recipes,foods,target,profile={}){
  const parts=meals.map(m=>{const r=recipes.find(r=>r.id===m.recipeId);return {...m,...recipeNutrition(r,foods).nutrition,cost:recipeCost(r,profile)}})
  if(fits(parts,target,profile))return meals
  let best=null,score=Infinity
  const consider=servings=>{
    if(servings.some(s=>!Number.isFinite(s)||s<.1||s>20))return
    // Keep enough precision so rounding cannot undo a correct calculation.
    const rounded=servings.map(s=>Math.round(s*10000)/10000)
    if(!fits(parts.map((p,i)=>({...p,servings:rounded[i]})),target,profile))return
    const distance=rounded.reduce((a,s,i)=>a+Math.abs(s-parts[i].servings)/Math.max(.1,parts[i].servings),0)
    if(distance<score){score=distance;best=meals.map((m,i)=>({...m,servings:rounded[i]}))}
  }
  const sumK=parts.reduce((a,p)=>a+p.kcal*p.servings,0),scale=target.kcal/sumK
  consider(parts.map(p=>p.servings*scale))
  for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
    const a=parts[i],b=parts[j],det=a.kcal*b.proteinG-b.kcal*a.proteinG
    if(Math.abs(det)<1e-8)continue
    for(const baseScale of [1,scale,.5,1.5]){
      const portions=parts.map(p=>Math.min(20,Math.max(.1,p.servings*baseScale)))
      const other=parts.reduce((tot,p,k)=>k===i||k===j?tot:{kcal:tot.kcal+p.kcal*portions[k],protein:tot.protein+p.proteinG*portions[k]},{kcal:0,protein:0})
      const k=target.kcal-other.kcal,p=target.proteinG-other.protein
      portions[i]=(k*b.proteinG-b.kcal*p)/det;portions[j]=(a.kcal*p-k*a.proteinG)/det
      consider(portions)
    }
  }
  return best
}
export function balanceCoachMeals(result,dates,recipes,foods,profile,target,fallbackMenu,uid){
  // First reject invented IDs, duplicate slots, exclusions and incomplete days.
  validateMeals(result,dates,recipes,foods,profile,target,uid,false)
  const changed=[],replaced=[],usage={},repeatLimit=Number.isInteger(profile.repeatMeals)&&profile.repeatMeals>0?profile.repeatMeals:null
  const meals=dates.flatMap(date=>{
    const original=result.meals.filter(m=>m.date===date),fitted=fitPortions(original,recipes,foods,target,profile),dayUsage={...usage}
    for(const m of original)dayUsage[m.recipeId]=(dayUsage[m.recipeId]||0)+1
    let chosen=fitted
    if(!chosen||(repeatLimit!=null&&Object.values(dayUsage).some(n=>n>repeatLimit))){
      const fallback=repeatLimit!=null?feasibleMenu(recipes,foods,target,{usage,repeatLimit,profile}):fallbackMenu
      if(!fallback)throw new Error(date+' 没有同时满足营养与重复次数条件的组合，请补充可用菜谱或调整重复上限。')
      replaced.push(date);chosen=fallback.map(m=>({...m,date}))
    }else if(fitted.some((m,i)=>m.servings!==original[i].servings))changed.push(date)
    for(const m of chosen)usage[m.recipeId]=(usage[m.recipeId]||0)+1
    return chosen
  })
  const snapshots=validateMeals({meals},dates,recipes,foods,profile,target,uid)
  const note=[changed.length?'餐食份数已按本地食材营养数据校准。':'',replaced.length?'其中 '+replaced.join('、')+' 的原组合无法满足营养或重复条件，已替换为符合忌口的本地可行组合，可继续修改。':''].filter(Boolean).join(' ')
  const budgetNote=profile.dailyBudgetCny>0?(snapshots.some(m=>m.costSnapshotCny==null)?'预算尚未验证：原料价格未填写，不以估价声称达标。可在食材详情填写对应生熟状态的每100克价格。':'原料费用已按你填写的价格核对每日预算，不含水电、人工或外卖费用。'):''
  return {meals,snapshots,note:[note,budgetNote].filter(Boolean).join(' ')}
}
