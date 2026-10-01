import { analyzeProgram } from './programs.js'
export const goalLabels={lose:'减脂',gain:'增肌',maintain:'健康与维持'}
export const intensityLabels={low:'低强度',moderate:'中等强度',high:'高强度'}
export const bodyLabels={full:'全身',upper:'上肢',lower:'下肢',chest:'胸部',back:'背部',shoulders:'肩部',arms:'手臂',waist:'核心',cardio:'心肺',mobility:'柔韧与平衡'}
export function programFilters(program,catalog){
  const idx=new Map(catalog.map(e=>[e.id,e])),items=program.days.flatMap(d=>d.exerciseItems),ex=items.map(e=>idx.get(e.exerciseId)).filter(Boolean)
  const parts=new Set(ex.map(e=>e.bp)),resistance=ex.some(e=>e.bp!=='cardio'&&!/stretch/i.test(e.n)),mobility=/柔韧|拉伸|平衡|瑜伽/.test(program.nameZh)
  const bodyParts=new Set()
  for(const part of parts){
    if(['upper arms','lower arms'].includes(part))bodyParts.add('arms')
    else if(['upper legs','lower legs'].includes(part))bodyParts.add('lower')
    else if(Object.hasOwn(bodyLabels,part))bodyParts.add(part)
    if(['chest','back','shoulders','upper arms','lower arms'].includes(part))bodyParts.add('upper')
  }
  if(mobility)bodyParts.add('mobility')
  if(mobility||program.knowledgeCategory==='中国传统体育'||program.knowledgeCategory==='球类与协调')bodyParts.add('full')
  if(ex.some(e=>/knowledge-(walking|jogging|running|hiking|stairs|cycling|fast-cycling)$/.test(e.id)))bodyParts.add('lower')
  if(bodyParts.has('upper')&&bodyParts.has('lower'))bodyParts.add('full')
  const high=items.some(e=>e.rpe>=8||(e.rir!=null&&e.rir<=2)||e.percent1RM>=80)||/爆发力|最大力量|增肌训练量|力量优先|进阶骑行|持续跑/.test(program.nameZh)||['02050','02040','02057'].includes(program.activityCode)
  const low=mobility||/初期|太极|八段锦|五禽戏|易筋经|六字诀|木兰/.test(program.nameZh)
  const analysis=analyzeProgram(program,catalog)
  return {goals:program.sourceGuideId==='china-weight-2024'?['lose','maintain']:resistance?['lose','gain','maintain']:mobility?['maintain']:['lose','maintain'],intensity:high?'high':low?'low':'moderate',minutes:Math.max(...analysis.days.map(d=>d.estimatedDuration)),bodyParts:[...bodyParts]}
}
export function matchesProgram(p,filters,search=''){
  const m=p.filters
  return (!filters.goal||m.goals.includes(filters.goal))&&(!filters.intensity||m.intensity===filters.intensity)&&(!filters.body||m.bodyParts.includes(filters.body))&&(!filters.duration||(filters.duration==='short'?m.minutes<=30:filters.duration==='medium'?m.minutes>30&&m.minutes<=60:m.minutes>60))&&(!search.trim()||[p.nameZh,p.nameEn,p.sourceName,p.knowledgeCategory].join(' ').toLowerCase().includes(search.trim().toLowerCase()))
}
