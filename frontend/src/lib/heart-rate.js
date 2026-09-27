export function parseHeartRate(value){
  if(!(value instanceof DataView)||value.byteLength<2)throw new Error('Invalid heart-rate packet')
  const flags=value.getUint8(0),wide=!!(flags&1)
  if(value.byteLength<(wide?3:2))throw new Error('Truncated heart-rate packet')
  if((flags&4)&&!(flags&2))return null // supported sensor contact, no skin contact
  const bpm=wide?value.getUint16(1,true):value.getUint8(1)
  return bpm>=25&&bpm<=240?bpm:null
}
export function mergeHealthSamples(existing,incoming){
  const map=new Map(existing.map(s=>[s.id,s]))
  for(const sample of incoming){if(!['steps','heartRate','distance','calories','weight'].includes(sample.dataType)||!Number.isFinite(sample.value)||sample.value<0||!Number.isFinite(Date.parse(sample.startDate))||!Number.isFinite(Date.parse(sample.endDate)))continue
    const source=String(sample.sourceId||sample.sourceName||'Health Connect'),id=[sample.dataType,sample.startDate,sample.endDate,source,sample.value].join('|')
    map.set(id,{...sample,id,source,importedAt:Date.now()})
  }
  return [...map.values()].sort((a,b)=>a.startDate.localeCompare(b.startDate)).slice(-10000)
}
