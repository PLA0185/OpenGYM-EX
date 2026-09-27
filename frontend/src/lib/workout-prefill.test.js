import { describe,it,expect } from 'vitest'
import { prefillRemainingSets } from './workout-prefill.js'
import { buildSets } from './history.js'
import { EXDB,exerciseName } from './exercises.js'
const id=EXDB.find(e=>e.n==='barbell bench press').id
describe('Workout prefill and bilingual labels',()=>{
  it('copies load and reps without changing completed sets or effort',()=>{const done={w:20,r:8,done:true,rpe:8},entry={id,sets:[done,{w:15,r:10,done:false},{w:0,r:0,done:false,rir:2}]};prefillRemainingSets(entry,1);expect(entry.sets[0]).toEqual(done);expect(entry.sets[2]).toEqual({w:15,r:10,done:false,rir:2})})
  it('rejects invalid values before any set is modified',()=>{const entry={id,sets:[{w:15,r:0,done:false},{w:0,r:0,done:false}]},before=JSON.stringify(entry);expect(()=>prefillRemainingSets(entry,0)).toThrow();expect(JSON.stringify(entry)).toBe(before)})
  it('copies the correct timed/cardio fields instead of repetitions',()=>{const timed={id,target:{mode:'time'},sets:[{w:0,sec:45,done:false},{w:10,sec:30,done:false}]};prefillRemainingSets(timed,0);expect(timed.sets[1]).toEqual({w:0,sec:45,done:false});const cardio={id,target:{mode:'cardio'},sets:[{min:20,speed:6,done:false},{min:5,speed:4,done:false}]};prefillRemainingSets(cardio,0);expect(cardio.sets[1]).toEqual({min:20,speed:6,done:false})})
  it('prefills incomplete legacy reps plans and carries the previous actual session',()=>{expect(buildSets({workouts:[],exWeights:{}},{id,sets:1})).toEqual([{w:0,r:10,done:false}]);expect(buildSets({exWeights:{[id]:{w:15}},workouts:[{d:'2026-09-27',entries:[{id,sets:[{w:12,r:8,done:true}]}]}]},{id,sets:2,reps:10,weight:0})).toEqual([{w:15,r:8,done:false},{w:15,r:8,done:false}])})
  it('uses both Chinese and English for the completion label',()=>{expect(exerciseName(EXDB.find(e=>e.id===id))).toContain('杠铃卧推');expect(exerciseName(EXDB.find(e=>e.id===id))).toContain('barbell bench press')})
})
