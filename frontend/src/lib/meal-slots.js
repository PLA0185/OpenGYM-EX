export function requiredMealSlots(profile={}){
  const count=profile.mealCount??3
  if(!Number.isInteger(count)||count<1||count>6)throw new Error('每日餐数需为1–6餐。')
  return count===1?['lunch']:count===2?['breakfast','dinner']:['breakfast','lunch','dinner','snack','pre','post'].slice(0,count)
}
