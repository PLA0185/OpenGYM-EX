// Conservative app scheduling rules derived from the cited recovery guidance.
// Muscle labels and weekdays are estimates, not an individual recovery test.
export const RECOVERY_SOURCE={title:'中国体育报 · 这些坏习惯易导致肌肉流失（武汉市体育局）',url:'https://tyj.wuhan.gov.cn/ggfwsx_14800/tyjs/202409/t20240908_2451536.html',rule:'原文建议肌群恢复48–72小时。结合指南渐进原则，应用安排相同主要肌群抗阻至少隔一天、高努力至少隔两天；按实际恢复调整。轻有氧和舒适拉伸不等同于重力量。'}
export const suggestedWeekdays=n=>({1:[3],2:[1,4],3:[1,3,5],4:[1,2,4,5],5:[1,2,4,5,6],6:[1,2,3,4,5,6],7:[0,1,2,3,4,5,6]}[n]||[])
const group=t=>/lats|upper back|traps/.test(t)?'back':/quads|hamstrings|glutes|adductors|abductors/.test(t)?'upper legs':/delts/.test(t)?'shoulders':t
export function resistanceWork(day,catalog){
  const result=new Map(),idx=new Map(catalog.map(e=>[e.id,e]))
  for(const item of day.exerciseItems){const ex=idx.get(item.exerciseId)
    if(!ex||ex.bp==='cardio'||/stretch|牵拉|拉伸/.test((ex.nameEn||ex.n||'')+' '+ex.nameZh))continue
    const muscle=group(ex.tg||ex.bp),hard=item.percent1RM>=80||item.rpe>=8||(item.rir!=null&&item.rir<=2)
    result.set(muscle,Math.max(result.get(muscle)||0,hard?3:2))
  }
  return result
}
export function recoveryConflicts(program,catalog){
  const work=program.days.map(d=>({...d,work:resistanceWork(d,catalog)})),conflicts=[]
  for(let i=0;i<work.length;i++)for(let j=i+1;j<work.length;j++){
    const a=work[i],b=work[j],distance=Math.min((a.weekday-b.weekday+7)%7,(b.weekday-a.weekday+7)%7)
    for(const [muscle,minGap] of a.work)if(b.work.has(muscle)&&distance<Math.max(minGap,b.work.get(muscle)))conflicts.push({muscle,weekdays:[a.weekday,b.weekday],minDays:Math.max(minGap,b.work.get(muscle))})
  }
  return conflicts
}
export function validateRecovery(program,catalog,profile={}){
  const conflicts=recoveryConflicts(program,catalog)
  if(conflicts.length)throw new Error('肌群恢复不足：星期 '+conflicts[0].weekdays.join(' / ')+' 重复训练 '+conflicts[0].muscle+'，需要相隔至少 '+conflicts[0].minDays+' 天（跨周也检查）；请分化肌群或换成轻有氧、恢复日。')
  const strengthDays=program.days.filter(d=>resistanceWork(d,catalog).size).length
  if(['inactive','occasional'].includes(profile.fitnessLevel)&&strengthDays>3)throw new Error('初期力量日过多：每周五天可用2–3次抗阻搭配轻有氧，不应给缺少基础的用户安排五次重力量。')
  if(profile.schedulePreference==='flexible'&&program.days.length===5){
    const weekdays=new Set(program.days.map(d=>d.weekday));let run=0
    for(let i=0;i<14;i++){run=weekdays.has(i%7)?run+1:0;if(run>3)throw new Error('每周五天未指定星期，应把两个休息日分散，不能默认连续周一至周五。')}
  }
  return program
}
