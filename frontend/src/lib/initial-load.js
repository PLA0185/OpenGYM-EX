// Application-authored trial loads, not official prescriptions or strength tests.
// A weight on a machine stack is not comparable to the same number on another machine.
const levels={inactive:0,occasional:1,trained:2,regular:3}
export function initialLoad(profile,exercise,unit='kg') {
  if(!profile?.onboardingCompleted||!Number.isFinite(profile.age)||profile.age<18||profile.age>65||profile.specialDiet||!['','无','没有','none'].includes(String(profile.limitations||'').trim().toLowerCase()))return null
  const level=levels[profile.fitnessLevel]
  if(level==null)return null
  const eq=exercise?.eq||'',name=(exercise?.nameEn||exercise?.n||'').toLowerCase()
  if(/assisted|weighted|sled|olympic|smith|band|cardio|roller|wheel|rope/.test(eq))return null
  const upper=/curl|raise|fly|extension|kickback|wrist|rotation/.test(name)
  let kg
  if(eq==='dumbbell')kg=(upper?[2,3,4,5]:[3,4,6,8])[level]
  else if(eq==='kettlebell')kg=[4,6,8,10][level]
  else if(eq==='cable'||eq==='leverage machine')kg=(upper?[2.5,5,7.5,10]:[5,7.5,10,15])[level]
  else if(eq==='barbell'||eq==='ez barbell')kg=[5,7.5,10,15][level]
  else if(eq==='medicine ball')kg=[1,2,3,4][level]
  else if(eq==='stability ball'||eq==='bosu ball')kg=0
  else return null
  if(profile.age>=55)kg=Math.max(eq==='barbell'?5:1,Math.floor(kg*.75*2)/2)
  return {weight:Math.round(kg*(unit==='lb'?1/0.45359237:1)*100)/100,
    note:eq==='dumbbell'?'每只哑铃的重量；首组轻松完成、动作稳定后再调整。':eq==='barbell'||eq==='ez barbell'?'总重量，含杆。优先使用轻训练杆；若场馆只有重杆，请换轻哑铃或器械，别把重杆当作此数值。':'首次试练建议，器械刻度不代表统一阻力；不合适请减重或换动作。'}
}
