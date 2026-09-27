import { clone, emptyXunlian, positive, validateTarget, NUTRIENTS, localDate } from './nutrition.js'
import { ProgramSchema, ReviewSchema } from './deepseek.js'
const dateValid=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(+new Date(d+'T12:00:00'))&&localDate(new Date(d+'T12:00:00'))===d
function validNutrition(n){return n&&typeof n==='object'&&!Array.isArray(n)&&NUTRIENTS.every(k=>n[k]==null||(Number.isFinite(n[k])&&n[k]>=0&&n[k]<=1000000))&&Number.isFinite(n.kcal)}
export function validateMealSnapshots(list){if(!Array.isArray(list))throw new Error('Invalid meals');for(const m of list)if(typeof m.id!=='string'||!dateValid(m.date)||!validNutrition(m.nutritionSnapshot)||(m.servings!=null&&!positive(m.servings,1000))||(m.grams!=null&&!positive(m.grams)))throw new Error('Invalid meal')}
function validateRoutines(list){list.forEach(r=>{if(typeof r.id!=='string'||typeof r.name!=='string'||!Array.isArray(r.ex))throw new Error('Invalid routine');r.ex.forEach(e=>{if(typeof e.id!=='string'||!positive(e.sets,100)||!Number.isInteger(e.sets))throw new Error('Invalid exercise')})})}
const forbidden = /^(apiKey|api_key|token|credential|credentials|authorization|secret|credentialCache)$/i
export function withoutCredentials(value) {
  if(Array.isArray(value)) return value.map(withoutCredentials)
  if(value && typeof value==='object') return Object.fromEntries(Object.entries(value).filter(([k])=>!forbidden.test(k) && !['__proto__','constructor','prototype'].includes(k)).map(([k,v])=>[k,withoutCredentials(v)]))
  return value
}
export function migrateState(state, defaults) {
  if(!state || typeof state!=='object' || Array.isArray(state)) throw new Error('Invalid backup')
  if(!Array.isArray(state.routines)||!Array.isArray(state.workouts))throw new Error('Not an openGym backup')
  if(state.schemaVersion>2 || state.xunlian?.schemaVersion>1) throw new Error('Newer backup version')
  const next = {...clone(defaults),...withoutCredentials(state)}
  next.schemaVersion=2
  next.xunlian={...emptyXunlian(),...(next.xunlian||{})}
  next.xunlian.profile={...emptyXunlian().profile,...next.xunlian.profile}
  next.xunlian.ai={...emptyXunlian().ai,...next.xunlian.ai}
  if(!Array.isArray(next.xunlian.healthSamples)||next.xunlian.healthSamples.length>10000||next.xunlian.healthSamples.some(s=>!s||typeof s.id!=='string'||!['steps','heartRate','distance','calories','weight'].includes(s.dataType)||!Number.isFinite(s.value)||s.value<0||!Number.isFinite(Date.parse(s.startDate))||!Number.isFinite(Date.parse(s.endDate))))throw new Error('Invalid health samples')
  for(const key of ['routines','workouts','bodyweight','customEx']) if(!Array.isArray(next[key]))throw new Error('Invalid '+key)
  for(const key of ['week','dayPlan']) if(!next[key] || typeof next[key]!=='object' || Array.isArray(next[key]))throw new Error('Invalid '+key)
  validateRoutines(next.routines)
  for(const b of next.bodyweight)if(!dateValid(b.d)||!positive(b.w,1000))throw new Error('Invalid body weight')
  for(const w of next.workouts)if(typeof w.id!=='string'||!dateValid(w.d)||!Array.isArray(w.entries)||w.entries.some(e=>typeof e.id!=='string'||!Array.isArray(e.sets)))throw new Error('Invalid workout')
  for(const key of ['foods','recipes','meals','logs','programs','favorites','drafts','proposals','snapshots']) if(!Array.isArray(next.xunlian[key]))throw new Error('Invalid '+key)
  for(const f of next.xunlian.foods)if(typeof f.id!=='string'||typeof f.nameZh!=='string'||!validNutrition(f.nutritionPer100g))throw new Error('Invalid custom food')
  for(const r of next.xunlian.recipes) if(typeof r.id!=='string'||!positive(r.servings,1000)||!Array.isArray(r.ingredients)||!Array.isArray(r.steps))throw new Error('Invalid recipe')
  validateMealSnapshots([...next.xunlian.meals,...next.xunlian.logs])
  for(const p of next.xunlian.programs)if(!ProgramSchema.safeParse(p).success)throw new Error('Invalid saved program')
  // Drafts intentionally allow unresolved entities and incomplete prescriptions.
  for(const d of next.xunlian.drafts){const p=d.data;if(!p||typeof p.nameZh!=='string'||(d.kind==='program'?(!Array.isArray(p.days)||p.days.some(day=>!Array.isArray(day.exerciseItems))):d.kind==='recipe'?(!Array.isArray(p.ingredients)||!Array.isArray(p.steps)):true))throw new Error('Invalid saved draft')}
  for(const p of next.xunlian.proposals){
    if(p.kind==='joint'){
      if(!ProgramSchema.safeParse(p.program).success||!Array.isArray(p.dates)||!p.dates.length||p.dates.some(d=>!dateValid(d)))throw new Error('Invalid joint proposal')
      validateMealSnapshots(p.snapshots)
      if(p.snapshots.some(m=>!p.dates.includes(m.date)))throw new Error('Invalid joint proposal dates')
      if(p.target)validateTarget(p.target)
    }else if(!ReviewSchema.safeParse(p).success)throw new Error('Invalid saved review')
    if(!Number.isInteger(p.baseRevision)||p.baseRevision<0)throw new Error('Invalid proposal revision')
  }
  for(const snap of next.xunlian.snapshots){if(snap.routines){if(!Array.isArray(snap.routines))throw new Error('Invalid snapshot');validateRoutines(snap.routines)}if(snap.meals)validateMealSnapshots(snap.meals);if(snap.target)validateTarget(snap.target)}
  if(next.xunlian.target)validateTarget(next.xunlian.target)
  return next
}
export function backupState(S) {return withoutCredentials({...S,schemaVersion:2})}
