import { clone, targets, validateTarget } from './nutrition.js'
import { suggestedWeekdays } from './training-recovery.js'
// Product instructions live in one place; no form defaults silently overwrite the user.
export const COACH_BRIEF_PROMPT=`先阅读 knowledge 中提炼的来源和规则，理解用户的训练和配套饮食需求，使用原话、已有个人资料和本轮回答。资料库用于推荐依据，不能替用户捏造身体信息或限制。不得重复问已知资料，不能要求用户再填一套表或勾确认。
只补问真正缺少的必要条件：运动伤病/需要避免的动作、过敏忌口/特殊饮食；身体资料缺失且不能使用已有营养目标时可合并询问。将问题合并成最多3个，条件足够就返回空questions。
健身地点、每周天数、时间优先从用户文本读取；不明确时可按目标和基础推荐可编辑安排，写入assumptions，不能声称用户指定。只说每周几天未指定星期时schedulePreference=flexible，availableDays是推荐而非固定限制，五天分散两个休息日，例如周一二四五六。明确指定哪些星期或只能工作日才设schedulePreference=fixed并提取availableDays。每周五天不代表五次重力量；需兼顾肌群恢复、基础与轻有氧。只有用户明确要低冲击才设lowImpact；不要默认禁止跑跳。年龄、身高、体重、性别不得猜。
如果已经提供本轮answers，提取其限制和偏好，不再追加问题；return questions=[]。忌口和禁止运动必须转成可用于本地筛选的短词，去掉“不吃/不能”等否定前缀；保留原话作为上下文。可同时把某食物的过敏匹配进excludedAllergens。
早餐时间、洗澡、通勤和备餐习惯等若用户已讲过直接使用；无需逐项问不影响方案的生活细节。素食/纯素、做饭时间、每日餐数、每周同菜重复上限和每日人民币原料预算若明确则提取dietStyle/cookingMinutes/mealCount/repeatMeals/dailyBudgetCny，未明确不设限制。撤销可选限制用null。预算不得猜原料价格。最新modification优先于旧回答；其他旧条件保留。不得承诺快速极端减重。目标只有lose/gain/maintain，不新增快速或正常分类。用户明确要求更快或更慢减脂时，将原话写入goalRequest，可提出requestedDeficitKcal（0–1000）；本地按体况、基础代谢与最高20%缺口校验。没有明确要求不填此字段；用户撤销加速要求设null。用户改变训练、目标或忌口时必须重新编排联动方案，解释改变了哪些安排和为什么；影响很小则保留并说明。减脂保留抗阻与循序渐进的有氧，增肌侧重抗阻和肌群恢复，维持兼顾力量与心肺；不能靠骤增运动抵消吃多的一餐，不推荐同伴辅助动作。`
export function coachProfile(stored, extracted={}) {
  const {training,target,revision,...personal}=clone(stored)
  const profile={...personal,...clone(extracted)}
  if(profile.availableDays){profile.availableDays=[...new Set(profile.availableDays)];if(profile.trainingDays==null)profile.trainingDays=profile.availableDays.length}
  if(profile.schedulePreference==='flexible'&&profile.trainingDays)profile.availableDays=suggestedWeekdays(profile.trainingDays)
  return profile
}
export function coachTarget(S,profile){
  if(S.xunlian.target&&(S.xunlian.target.basis==='manual'||(!S.xunlian.target.basis&&profile.goal===S.xunlian.profile.goal)))return validateTarget(clone(S.xunlian.target))
  // Recompute estimates from the resolved current profile, not a cached target
  // from before a weight/schedule or nutrition-policy change.
  return validateTarget(targets(profile,profile.weightKg,S.xunlian.target?.trainingEnergy?{...S.xunlian.target.trainingEnergy,deltaKcal:profile.weightKg*(S.xunlian.target.trainingEnergy.weeklyLoad-S.xunlian.target.trainingEnergy.baselineLoad)/7}:null))
}
export function validateBrief(brief,stored,{answered=false}={}){
  if(answered&&brief.questions.length)throw new Error('已回答本轮必要问题，请直接提取条件并返回空 questions，不重复追问。')
  const profile=coachProfile(stored,brief.profile)
  if(!brief.questions.length){
    if(!Number.isInteger(profile.age)||!Number.isFinite(profile.weightKg))throw new Error('身体资料缺失，首次补问请合并询问年龄和体重；回答后不要编造。')
    if(profile.availableDays&&profile.availableDays.length<profile.trainingDays)throw new Error('每周天数多于可训练星期，请保留固定限制并核对冲突，不能擅自加入不可训练日。')
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
