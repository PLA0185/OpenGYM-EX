import { clone, targets, validateTarget } from './nutrition.js'
// Product instructions live in one place; no form defaults silently overwrite the user.
export const COACH_BRIEF_PROMPT=`理解用户的训练和配套饮食需求，先使用原话、已有个人资料和本轮回答。不得重复问已知资料，不能要求用户再填一套表或勾确认。
只补问真正缺少的必要条件：运动伤病/需要避免的动作、过敏忌口/特殊饮食；身体资料缺失且不能使用已有营养目标时可合并询问。将问题合并成最多3个，条件足够就返回空questions。
健身地点、每周天数、时间优先从用户文本读取；不明确时可按目标和基础推荐可编辑安排，写入assumptions，不能声称用户指定。只有用户明确要低冲击才设lowImpact；不要默认禁止跑跳。年龄、身高、体重、性别不得猜。
如果已经提供本轮answers，提取其限制和偏好，不再追加问题；return questions=[]。忌口和禁止运动必须转成可用于本地筛选的短词，去掉“不吃/不能”等否定前缀；保留原话作为上下文。可同时把某食物的过敏匹配进excludedAllergens。
早餐时间、洗澡、通勤和备餐习惯等若用户已讲过直接使用；无需逐项问不影响方案的生活细节。素食/纯素、做饭时间、每日餐数、每周同菜重复上限和每日人民币原料预算若明确则提取dietStyle/cookingMinutes/mealCount/repeatMeals/dailyBudgetCny，未明确不设限制。撤销可选限制用null。预算不得猜原料价格。最新modification优先于旧回答；其他旧条件保留。不得承诺快速极端减重。`
export function coachProfile(stored, extracted={}) {
  const {training,target,revision,...personal}=clone(stored)
  const profile={...personal,...clone(extracted)}
  if(profile.availableDays){profile.availableDays=[...new Set(profile.availableDays)];if(profile.trainingDays==null)profile.trainingDays=profile.availableDays.length}
  return profile
}
export function coachTarget(S,profile){
  if(S.xunlian.target?.basis==='manual')return validateTarget(clone(S.xunlian.target))
  if(S.xunlian.target&&profile.goal===S.xunlian.profile.goal&&['age','heightCm','sex','weightKg','activity'].every(k=>profile[k]===S.xunlian.profile[k]))return validateTarget(clone(S.xunlian.target))
  return validateTarget(targets(profile,profile.weightKg))
}
export function validateBrief(brief,stored,{answered=false}={}){
  if(answered&&brief.questions.length)throw new Error('已回答本轮必要问题，请直接提取条件并返回空 questions，不重复追问。')
  const profile=coachProfile(stored,brief.profile)
  if(!brief.questions.length){
    if(!Number.isInteger(profile.age)||!Number.isFinite(profile.weightKg))throw new Error('身体资料缺失，首次补问请合并询问年龄和体重；回答后不要编造。')
    if(profile.availableDays&&profile.availableDays.length!==profile.trainingDays)throw new Error('每周天数与可训练星期数量不一致，请按用户回答修复。')
    if(!profile.availableDays||!profile.trainingDays||!profile.trainingDuration)throw new Error('请按用户时间条件给出可编辑的每周训练星期、天数和单次分钟；未明确的安排在 assumptions 中注明为建议。')
    if(!String(profile.limitations||'').trim()||!String(profile.allergies||'').trim())throw new Error('运动限制或过敏忌口仍未说明：首次只补问缺少的这一项；已有原话说明“无”时请提取为无，不要重复问。回答后请提取实际回答。')
  }
  return profile
}
export function briefFallback(profile){
  const questions=[]
  if(!profile.limitations||!profile.allergies)questions.push('有哪些伤病或需要避开的动作？有什么过敏、忌口或特殊饮食要求？没有请写“无”。')
  if(!profile.age||!profile.weightKg||(!profile.target&&(!profile.heightCm||!profile.sex)))questions.push('请补充尚未填写的年龄、身高、体重和性别，用于训练与营养估算。')
  return {questions,profile:{},assumptions:[],summary:'本地必要补问：AI 返回格式异常，仅补充缺少的身体资料和限制；已有条件继续保留。'}
}
