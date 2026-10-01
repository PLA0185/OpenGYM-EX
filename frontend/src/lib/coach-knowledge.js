import guides from '../data/china-guides.json'
import { knowledgePrograms } from './knowledge-programs.js'
import { RECOVERY_SOURCE, suggestedWeekdays } from './training-recovery.js'
import { NUTRITION_SOURCES } from './nutrition.js'
import { creatorKnowledge } from './creator-programs.js'
export const COACH_PLAN_PROMPT=`先分析 knowledge 中的来源要点、适用范围、相关预设参数和恢复规则，再根据用户原话、已知资料及本轮回答编排，不能把例子或模型习惯当成用户条件。
每周几天表示活动次数，不等于几次重力量，也不等于连续周一到周五。未指定星期参考 suggestedWeekdays 分散休息；固定星期尊重限制，必要时轻有氧穿插抗阻。同一主要肌群抗阻至少隔一天；高努力抗阻至少隔两天，含周日到下周一。新手/偶尔运动最多2–3次抗阻，其余可用已掌握的轻有氧。五天保留两个休息日，不把有氧活动指南误读成每天全身重力量。
具体组数、次数/时长和休息参考与目标、基础相符的 knowledge.presets，说明应用选择的部分。只用提供的动作，originalText 精确匹配nameZh/nameEn，重量null，由本地个人记录或初次试练预填。遵守伤病、忌口、时间、场地，不安排同伴辅助动作。技能活动必须已有基础，不冒充专项教学。
用真实候选 recipeId 安排完整七天饮食。不同天及同天餐次优先不同组合，不能七天照抄 feasibleDayMenu；它只是可行性证据。本地校准份数，不能编造营养或价格，不能为变化违反忌口、预算和营养约束。遵守 context.target 与用户目标，休息日也需要营养恢复；快一点的要求仅在本地安全目标内调整，无快速/正常目标分类。
用户修改条件时联动训练和饮食，说明改了什么、保留什么及原因；不靠过量运动补偿饮食。先直接出完整结果，不重复追问。结合已给的通勤/洗澡/吃饭安排，不重新问已知生活细节。
explanation 简短说明知识来源、星期与休息理由、训练饮食联动及菜式变化。referenceGuideIds 填实际使用的 knowledge.sources 中的id，不编造来源，不声称应用课程为机构发布的原始课程。`
export function coachKnowledge(catalog,profile,request=''){
  const plans=knowledgePrograms(catalog),sources=[...guides.map(g=>({...g,scope:g.id.startsWith('military-')?'公开军体原则参考，不能作为普通新手默认训练强度。':'按自身健康与运动基础选取，具体训练日由应用编排。'})),
    {id:'acsm-resistance-2026',title:'ACSM 2026 抗阻训练指南',url:'https://acsm.org/resistance-training-guidelines-update-2026/',summary:'主要肌群每周至少两次；力量约80%1RM、2–3组；增肌每肌群约10组/周；爆发力30–70%1RM。',scope:'百分比需已知个人基线，初学者先规范动作和建立习惯；不是所有人必须高强度。'},
    {id:'cdc-adults',title:'成人活动指南',url:'https://www.cdc.gov/physical-activity-basics/guidelines/adults.html',summary:'每周至少150分钟中等有氧与至少两天主要肌群力量，逐渐达到；不能把所有力量时长当有氧。'},
    {id:'activity-compendium-2024',title:'2024 活动能耗参考',url:'https://pacompendium.com/conditioning-exercise/',summary:'MET是人群估计；抗阻3.5、较高努力6、循环训练因类型5–7.5。不能当个人实测或重复加进已含训练的PAL。'},
    {id:'recovery-sports-2024',...RECOVERY_SOURCE,summary:RECOVERY_SOURCE.rule},...creatorKnowledge(request)]
  const presets=[]
  for(const source of sources){
    const related=plans.filter(p=>p.sourceGuideId===source.id&&p.filters.goals.includes(profile.goal||'maintain'))
    related.sort((a,b)=>Math.abs(a.days.length-profile.trainingDays)-Math.abs(b.days.length-profile.trainingDays)||a.filters.minutes-b.filters.minutes)
    for(const p of related.slice(0,2))presets.push({id:p.id,sourceGuideId:p.sourceGuideId,name:p.nameZh,category:p.knowledgeCategory,intensity:p.filters.intensity,estimatedMaxMinutes:p.filters.minutes,notes:p.notes,days:p.days.map(d=>({weekday:d.weekday,items:d.exerciseItems.map(e=>({name:catalog.find(x=>x.id===e.exerciseId)?.nameZh||e.originalText,sets:e.sets,reps:e.reps,repsMin:e.repsMin,repsMax:e.repsMax,durationSec:e.durationSec,restSec:e.restSec,percent1RM:e.percent1RM}))}))})
  }
  return {sources,presets,nutritionSources:NUTRITION_SOURCES,suggestedWeekdays:suggestedWeekdays(profile.trainingDays),rules:{minimumResistanceGapDays:2,highEffortGapDays:3,beginnerResistanceDaysMax:3,flexibleFiveDaysRestDays:2,restDayNutrition:'保持营养恢复，本地目标不因单日休息大幅减餐。',applicationArrangement:'要点与参数来源可核对；具体动作组合、星期和首次试练公斤数由应用编排，不能冒充原始官方课程。'}}
}
