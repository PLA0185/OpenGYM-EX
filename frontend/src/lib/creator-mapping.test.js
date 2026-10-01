import {it,expect} from 'vitest'
import {EXDB} from './exercises-data.js'
import {brucePlanTables} from './creator-plan-tables.js'
import {creatorPrograms,creatorMappedProgram,creatorRequest,selectedCreatorKnowledge,matchingCreatorPrograms} from './creator-programs.js'
import {prefillProgram,validateProgram} from './programs.js'
import {needsPartner} from './solo-exercises.js'
import {ProgramSchema} from './deepseek.js'
import {coachCatalog,selectCoachCandidates,mapCoachProgram} from './assistant-plan.js'
const S={unit:'kg',workouts:[],xunlian:{profile:{onboardingCompleted:true,age:24,weightKg:85,fitnessLevel:'regular',limitations:'无'}}}
it('maps all nine source tables to real solo exercises and prefills every executable weight',()=>{
 const courses=creatorPrograms.filter(p=>p.tableKey&&p.creator.includes('Bruce'))
 expect(courses).toHaveLength(9)
 for(const c of courses){const p=prefillProgram(S,creatorMappedProgram(c,EXDB),EXDB);expect(()=>validateProgram(p,EXDB)).not.toThrow();expect(p.days.flatMap(d=>d.exerciseItems).every(e=>EXDB.some(x=>x.id===e.exerciseId&&!needsPartner(x))&&Number.isFinite(e.weight)&&e.restSec>0)).toBe(true)}
})
it('turns verified dumbbell teaching into usable schedules while marking app-authored parameters',()=>{
 const courses=creatorPrograms.filter(c=>c.creator==='烧毁一切就是美')
 expect(courses).toHaveLength(3)
 for(const c of courses){const p=prefillProgram(S,creatorMappedProgram(c,EXDB),EXDB);expect(()=>validateProgram(p,EXDB)).not.toThrow();expect(p.days.flatMap(d=>d.exerciseItems).every(e=>Number.isFinite(e.weight)&&e.estimatedFields.includes('sets')&&e.estimatedFields.includes('reps'))).toBe(true)}
})
it('keeps actual source numbers apart from application replacements and defaults',()=>{
 const c=creatorPrograms.find(p=>p.tableKey==='full-1'),p=creatorMappedProgram(c,EXDB)
 expect(p.days[0].exerciseItems[0]).toMatchObject({sets:1,reps:5,percent1RM:85})
 expect(p.days[2].exerciseItems[2]).toMatchObject({sets:5,reps:5,percent1RM:75})
 expect(p.days[0].exerciseItems[0].estimatedFields).toContain('restSec')
 const two=creatorMappedProgram(creatorPrograms.find(p=>p.tableKey==='upper-lower-1'),EXDB)
 expect(two.days[2].exerciseItems.find(e=>e.originalText==='海豹划船').notes).toContain('替代')
 expect(brucePlanTables.find(t=>t.key==='full-2').days[2].rows[1].reps).toBe('力竭')
 const failure=creatorMappedProgram(creatorPrograms.find(p=>p.tableKey==='full-2'),EXDB).days[2].exerciseItems[1]
 expect(failure.estimatedFields).toContain('reps');expect(failure.notes).toContain('力竭')
})
it('passes the selected original table and real exercise IDs into generation instead of a video task',()=>{
 const c=creatorPrograms.find(p=>p.tableKey==='five'),k=selectedCreatorKnowledge(c.id,EXDB)
 expect(k.presets[0].days).toHaveLength(5)
 expect(k.presets[0].days.every(d=>d.items.every(e=>EXDB.some(x=>x.id===e.exerciseId)))).toBe(true)
 expect(creatorRequest(c)).toContain('可执行');expect(creatorRequest(c)).toContain('已有档案')
 expect(selectedCreatorKnowledge('unknown',EXDB)).toBeNull()
})
it('retains supplied IDs through AI schema parsing even when names differ in presentation',()=>{
 const raw={nameZh:'个人适配',days:[{weekday:1,dayName:'全身',exerciseItems:[{exerciseId:'0025',originalText:'作者的胸部动作',sets:2,reps:10,restSec:90}]}]}
 const parsed=ProgramSchema.parse(raw),mapped=mapCoachProgram(parsed,[EXDB.find(e=>e.id==='0025')],'test',0)
 expect(mapped.days[0].exerciseItems[0].exerciseId).toBe('0025')
 expect(()=>mapCoachProgram({...parsed,days:[{...parsed.days[0],exerciseItems:[{...parsed.days[0].exerciseItems[0],exerciseId:'unknown'}]}]},EXDB,'test',0)).toThrow()
})
it('prioritizes reference movements without bringing excluded gym equipment into a home plan',()=>{
 const allowed=coachCatalog(EXDB,{trainingPlace:'home',homeEquipment:['dumbbell'],fitnessLevel:'regular'})
 const supplied=selectCoachCandidates(allowed,['0025','0292','0292'])
 expect(supplied[0].id).toBe('0292');expect(supplied.some(e=>e.id==='0025')).toBe(false)
 expect(new Set(supplied.map(e=>e.id)).size).toBe(supplied.length)
})
it('filters mapped plans using actual local duration and body parts rather than unknown source metadata',()=>{
 const all=matchingCreatorPrograms({},'',EXDB),mapped=all.find(p=>p.tableKey==='full-1')
 expect(mapped.estimatedMinutes).toBe(true);expect(mapped.minutesMax).toBeGreaterThan(0)
 const duration=mapped.minutesMax<=30?'short':mapped.minutesMax<=60?'medium':'long'
 expect(matchingCreatorPrograms({duration,body:'lower'},'',EXDB).some(p=>p.id===mapped.id)).toBe(true)
})
