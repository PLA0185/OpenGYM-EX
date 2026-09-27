import { modeOf } from './history.js'

// Copy the chosen prescription only to uncompleted sets. Effort and done flags
// are actual records and must never be fabricated by a prefill action.
export function prefillRemainingSets(entry, sourceIndex) {
  const source=entry?.sets?.[sourceIndex]
  if(!source)throw new Error('Invalid source set')
  const mode=modeOf({...entry.target,id:entry.id})
  const fields=mode==='cardio'?['min','speed']:mode==='time'?['sec','w']:['w','r']
  const valid=(field,value)=>Number.isFinite(value)&&value>=0&&value<=({w:1000,r:100,sec:3600,min:360,speed:100}[field])&&(!['r','sec','min'].includes(field)||value>0)
  if(fields.some(field=>!valid(field,source[field])))throw new Error('Complete valid set values first')
  for(const set of entry.sets)if(!set.done)for(const field of fields)set[field]=source[field]
}
