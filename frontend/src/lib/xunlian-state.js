import { clone, emptyXunlian, positive, validateTarget, validatePlanningProfile,NUTRIENTS, localDate } from './nutrition.js'
import { ProgramSchema, ReviewSchema } from './deepseek.js'
const dateValid=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(+new Date(d+'T12:00:00'))&&localDate(new Date(d+'T12:00:00'))===d
function validNutrition(n){return n&&typeof n==='object'&&!Array.isArray(n)&&NUTRIENTS.every(k=>n[k]==null||(Number.isFinite(n[k])&&n[k]>=0&&n[k]<=1000000))&&Number.isFinite(n.kcal)}
function validateRecipe(r){
  if(!r||typeof r.id!=='string'||typeof r.nameZh!=='string'||!positive(r.servings,1000)||!Array.isArray(r.ingredients)||r.ingredients.length>300||!Array.isArray(r.steps)||r.steps.length>1000||r.steps.some(s=>typeof s!=='string'||s.length>200000))throw new Error('Invalid recipe')
  for(const key of ['tools','tips','images'])if(r[key]!=null&&(!Array.isArray(r[key])||r[key].length>1000||r[key].some(s=>typeof s!=='string'||s.length>20000)))throw new Error('Invalid recipe '+key)
  for(const i of r.ingredients)if(!i||typeof i!=='object'||(i.grams!=null&&!positive(i.grams,1000000)))throw new Error('Invalid recipe ingredient')
}
export function validateMealSnapshots(list){if(!Array.isArray(list))throw new Error('Invalid meals');for(const m of list)if(typeof m.id!=='string'||!dateValid(m.date)||!validNutrition(m.nutritionSnapshot)||(m.servings!=null&&!positive(m.servings,1000))||(m.grams!=null&&!positive(m.grams))||(m.costSnapshotCny!=null&&(!Number.isFinite(m.costSnapshotCny)||m.costSnapshotCny<0||m.costSnapshotCny>1000000)))throw new Error('Invalid meal');for(const m of list){if(m.recipeSnapshot)validateRecipe(m.recipeSnapshot);if(m.photoAnalysis){const a=m.photoAnalysis;if(m.estimated!==true||!positive(a.kcalMin,10000)||!positive(a.kcalMax,10000)||a.kcalMin>m.nutritionSnapshot.kcal||a.kcalMax<m.nutritionSnapshot.kcal||!['low','medium'].includes(a.confidence)||typeof a.analysisId!=='string'||typeof a.description!=='string'||a.description.length>1500||!Array.isArray(a.notes)||a.notes.length>10||a.notes.some(n=>typeof n!=='string'||n.length>600)||!Array.isArray(m.ingredientsSnapshot)||m.ingredientsSnapshot.some(i=>!positive(i.gramsMin)||i.gramsMin>i.grams||i.gramsMax<i.grams||!positive(i.gramsMax)))throw new Error('Invalid photo meal')}}}
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
  validatePlanningProfile(next.xunlian.profile)
  if(!Array.isArray(next.xunlian.balanceNotices)||next.xunlian.balanceNotices.length>20||next.xunlian.balanceNotices.some(n=>typeof n.id!=='string'||!Number.isFinite(n.at)||!['review','balanced'].includes(n.status)||!Array.isArray(n.changes)||n.changes.length>30||n.changes.some(c=>typeof c!=='string'||c.length>10000)))throw new Error('Invalid balance notices')
  const shopping=next.xunlian.shoppingChecked
  if(!shopping||typeof shopping!=='object'||Array.isArray(shopping)||Object.keys(shopping).length>520||Object.entries(shopping).some(([date,items])=>!dateValid(date)||!items||typeof items!=='object'||Array.isArray(items)||Object.keys(items).length>5000||Object.values(items).some(g=>!positive(g,1000000))))throw new Error('Invalid shopping checklist')
  next.xunlian.ai={...emptyXunlian().ai,...next.xunlian.ai}
  if(!Array.isArray(next.xunlian.healthSamples)||next.xunlian.healthSamples.length>10000||next.xunlian.healthSamples.some(s=>!s||typeof s.id!=='string'||!['steps','heartRate','distance','calories','weight'].includes(s.dataType)||!Number.isFinite(s.value)||s.value<0||!Number.isFinite(Date.parse(s.startDate))||!Number.isFinite(Date.parse(s.endDate))))throw new Error('Invalid health samples')
  for(const key of ['routines','workouts','bodyweight','customEx']) if(!Array.isArray(next[key]))throw new Error('Invalid '+key)
  for(const key of ['week','dayPlan']) if(!next[key] || typeof next[key]!=='object' || Array.isArray(next[key]))throw new Error('Invalid '+key)
  validateRoutines(next.routines)
  for(const b of next.bodyweight)if(!dateValid(b.d)||!positive(b.w,1000))throw new Error('Invalid body weight')
  for(const w of next.workouts)if(typeof w.id!=='string'||!dateValid(w.d)||!Array.isArray(w.entries)||w.entries.some(e=>typeof e.id!=='string'||!Array.isArray(e.sets)))throw new Error('Invalid workout')
  for(const key of ['foods','recipes','meals','logs','programs','favorites','drafts','proposals','snapshots']) if(!Array.isArray(next.xunlian[key]))throw new Error('Invalid '+key)
  for(const f of next.xunlian.foods)if(typeof f.id!=='string'||typeof f.nameZh!=='string'||!validNutrition(f.nutritionPer100g))throw new Error('Invalid custom food')
  for(const r of next.xunlian.recipes)validateRecipe(r)
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
