import { describe,it,expect } from 'vitest'
import { resolvePrescription, sessionConfig, restSeconds, validateTrainingAdjustment, applyTrainingAdjustment } from './prescription.js'
import { parseProgramText } from './program-import.js'
import { applyProgram, guidelinePrograms } from './programs.js'
import { buildSets } from './history.js'
import { emptyXunlian } from './nutrition.js'
import { EXDB } from './exercises-data.js'
import { buildPlanBundle, mergePlan } from './plan-share.js'
const ex={id:'bench',nameZh:'杠铃卧推',nameEn:'barbell bench press',eq:'barbell'}
const date=new Date().toISOString().slice(0,10)
const state=()=>({unit:'kg',exWeights:{bench:{w:100}},routines:[],week:{},dayPlan:{},bodyweight:[],xunlian:emptyXunlian(),workouts:[{d:date,entries:[{id:'bench',sets:[{w:50,r:8,done:true},{w:50,r:8,done:true},{w:50,r:8,done:true},{w:99,r:99,done:false}]}]}]})
const item={exerciseId:'bench',sets:3,reps:8,restSec:120,mappingStatus:'exact'}
describe('Source-driven prescriptions',()=>{
  it('reads explicit kg, sets, reps and rest without an AI credential',()=>{const p=parseProgramText('周一\n杠铃卧推 40公斤 3组×8次 组间休息120秒',[ex]);expect(p.days[0].exerciseItems[0]).toMatchObject({exerciseId:'bench',weight:40,weightUnit:'kg',sets:3,reps:8,restSec:120,mappingStatus:'exact'})})
  it('converts minutes to seconds and preserves pound unit',()=>{const p=parseProgramText('杠铃卧推 100lb 4×6 休息2分钟',[ex]);expect(p.days[0].exerciseItems[0]).toMatchObject({weight:100,weightUnit:'lb',sets:4,reps:6,restSec:120})})
  it('never invents a missing load or missing repetitions',()=>{const p=parseProgramText('杠铃卧推 3组',[ex]);expect(p.days[0].exerciseItems[0].weight).toBeUndefined();expect(p.days[0].exerciseItems[0].reps).toBeUndefined()})
  it('rejects rows with mixed per-set weights instead of losing them',()=>expect(()=>parseProgramText('杠铃卧推 3组×8次 40kg / 50kg',[ex])).toThrow())
  it('source load wins over history and lifetime confirmed best',()=>{const cfg=resolvePrescription(state(),{...item,weight:40},ex);expect(buildSets(state(),cfg)).toEqual(Array.from({length:3},()=>({w:40,r:8,done:false})))})
  it('source weight is converted to profile unit explicitly',()=>{expect(resolvePrescription(state(),{...item,weight:100,weightUnit:'lb'},ex).weight).toBe(45.36)})
  it('missing rest uses a labeled preset; explicit zero stays zero',()=>{const a=resolvePrescription(state(),{...item,restSec:undefined},ex);expect(a.restSec).toBe(90);expect(a.prefillBasis.rest).toBe('app-default');expect(restSeconds({target:{restSec:0}},120)).toBe(0)})
  it('uses completed recent working sets, never unchecked values or best load',()=>{const cfg=resolvePrescription(state(),item,ex);expect(cfg.weight).toBe(50);expect(cfg.prefillBasis.evidence.date).toBe(date)})
  it('keeps unknown weights blank; only bodyweight has an explicit zero',()=>{const s={...state(),workouts:[]};expect(resolvePrescription(s,item,ex).weight).toBeNull();expect(resolvePrescription(s,item,{...ex,eq:'body weight'}).weight).toBe(0);expect(buildSets(s,resolvePrescription(s,item,ex))[0].w).toBeNull()})
  it('does not accept AI-inferred weights as source facts',()=>expect(resolvePrescription({...state(),workouts:[]},{...item,weight:35,estimatedFields:['weight']},ex).weight).toBeNull())
  it('converts a percentage from recorded personal baseline',()=>{const cfg=resolvePrescription(state(),{...item,percent1RM:80},ex);expect(cfg.weight).toBe(50.5);expect(cfg.prefillBasis.evidence).toMatchObject({weight:50,reps:8,percent:80,estimated1RM:63.3})})
  it('allows a once-entered baseline shared by the program',()=>{const cfg=resolvePrescription({...state(),workouts:[]},{...item,percent1RM:80,baselineWeight:50,baselineReps:8,baselineUnit:'kg'},ex);expect(cfg.weight).toBe(50.5)})
  it('rejects stale / future evidence and high-rep percentage estimates',()=>{const s=state();s.workouts[0].d='2000-01-01';expect(resolvePrescription(s,item,ex).weight).toBeNull();s.workouts[0].d='2099-01-01';expect(resolvePrescription(s,item,ex).weight).toBeNull();s.workouts[0].d=date;s.workouts[0].entries[0].sets=[{w:50,r:20,done:true}];expect(resolvePrescription(s,{...item,percent1RM:80},ex).weight).toBeNull()})
  it('applying and restarting a source plan preserves its numeric prescription',()=>{const s=state();applyProgram(s,{id:'source',nameZh:'导入',days:[{weekday:1,dayName:'周一',exerciseItems:[{...item,weight:40}]}]},[ex],()=> 'routine');const cfg=sessionConfig(s,s.routines[0].ex[0],ex);expect(cfg.weight).toBe(40);expect(cfg.restSec).toBe(120);expect(buildSets(s,cfg)[0]).toMatchObject({w:40,r:8,done:false});expect(s.workouts[0].entries[0].sets[0].w).toBe(50)})
  it('official-derived template keeps proportional load and authored fields distinct',()=>{const p=guidelinePrograms(EXDB)[0];expect(p.sourceUrl).toContain('acsm.org');expect(p.days[0].exerciseItems[0]).toMatchObject({sets:3,percent1RM:80,estimatedFields:['reps','restSec']})})
  it('sharing and importing a native plan preserves per-exercise rest and source priority',()=>{const s=state();s.routines=[{id:'r',name:'分享',ex:[{id:'bench',sets:3,reps:8,weight:40,restSec:120}]}];const bundle=buildPlanBundle(s,'来源文件');expect(bundle.routines[0].ex[0].restSec).toBe(120);const receiver=state();mergePlan(receiver,bundle);expect(buildSets(receiver,receiver.routines[0].ex[0])[0].w).toBe(40);expect(receiver.routines[0].ex[0].restSec).toBe(120)})
})
describe('Evidence-based accepted AI adjustments',()=>{
  const setup=()=>{const s=state();s.routines=[{id:'r',ex:[resolvePrescription(s,{...item,weight:50},ex)]}];return s}
  const a={action:'prescription',routineId:'r',exerciseId:'bench',weight:52.5,reps:8,restSec:150,reason:'完成三组目标，微调5%'}
  it('accepted changes prefill next workout and preserve source and history',()=>{const s=setup();applyTrainingAdjustment(s,a);const cfg=sessionConfig(s,s.routines[0].ex[0],ex);expect(buildSets(s,cfg)[0].w).toBe(52.5);expect(cfg.restSec).toBe(150);expect(cfg.prescription.weight).toBe(50);expect(s.workouts[0].entries[0].sets[0].w).toBe(50)})
  it('rejects fabricated exercise references or absent evidence',()=>{expect(()=>validateTrainingAdjustment(setup(),{...a,exerciseId:'missing'})).toThrow();const s=setup();s.workouts=[];expect(()=>validateTrainingAdjustment(s,a)).toThrow()})
  it.each([{weight:60},{reps:15},{restSec:500}])('rejects unbounded parameter jumps %o',patch=>expect(()=>validateTrainingAdjustment(setup(),{...a,...patch})).toThrow())
  it('blocks increases on failed targets or logged near-limit effort',()=>{const s=setup();s.workouts[0].entries[0].sets[0].r=6;expect(()=>validateTrainingAdjustment(s,a)).toThrow();s.workouts[0].entries[0].sets[0].r=8;s.workouts[0].entries[0].sets[0].rir=0;expect(()=>validateTrainingAdjustment(s,a)).toThrow()})
  it('sets-only adjustments cannot smuggle an unchecked load',()=>{const s=setup();applyTrainingAdjustment(s,{...a,action:'sets',sets:4,weight:900});expect(s.routines[0].ex[0].weight).toBe(50);expect(s.routines[0].ex[0].sets).toBe(4)})
})
