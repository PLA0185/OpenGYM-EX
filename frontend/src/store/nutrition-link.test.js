import { it,expect,vi } from 'vitest'
import { targets,clone } from '../lib/nutrition.js'
import { applyJoint } from '../lib/planning-engine.js'
import { builtInPrograms } from '../lib/programs.js'
import { EXDB } from '../lib/exercises-data.js'
vi.stubGlobal('document',{addEventListener(){}})
const values=new Map()
vi.stubGlobal('localStorage',{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)})
const {useStore,DEF}=await import('./useStore.js')
it('marks meals for review after weight or training changes, but not after coordinated application',()=>{
  const S=clone(DEF);S.xunlian.profile={age:24,heightCm:172,weightKg:85,sex:'male',goal:'lose',activity:1.5};S.xunlian.target=targets(S.xunlian.profile,85)
  const date='2026-10-01',meal={id:'meal',date,slot:'lunch',nutritionSnapshot:{kcal:700},servings:1}
  S.xunlian.meals=[meal];useStore.setState({S,user:null})
  useStore.getState().update(s=>{s.bodyweight.push({d:date,w:83})},false)
  expect(useStore.getState().S.xunlian.nutritionNeedsReview).toBe(true)
  useStore.getState().update(s=>{s.xunlian.nutritionNeedsReview=false;s.week[1]='changed'},false)
  expect(useStore.getState().S.xunlian.nutritionNeedsReview).toBe(true)
  const proposal={program:builtInPrograms(EXDB)[0],target:targets(S.xunlian.profile,83),snapshots:[meal],dates:[date],baseRevision:useStore.getState().S.xunlian.revision}
  useStore.getState().update(s=>applyJoint(s,proposal,{training:true,meals:true,target:true},EXDB,()=>Math.random().toString()),false)
  expect(useStore.getState().S.xunlian.nutritionNeedsReview).toBe(false)
})
