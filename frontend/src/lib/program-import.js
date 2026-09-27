import { mapEntity } from './entity-mapping.js'
// A conservative offline reader for explicit prescriptions. Free-form plans can
// use the AI reader, but ambiguous numeric rows must still be reviewed.
export function parseProgramText(text, catalog, aliases = {}) {
  const days=[], weekdayNames={'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'日':0,'天':0}
  let day=null
  for (const raw of text.split(/\r?\n/)) {
    const line=raw.trim();if(!line)continue
    const weekday=line.match(/(?:周|星期)([一二三四五六日天])/)
    if(weekday){const wd=weekdayNames[weekday[1]];day=days.find(d=>d.weekday===wd);if(!day){day={weekday:wd,dayName:weekday[0],exerciseItems:[]};days.push(day)}if(!/\d+\s*(?:组|sets?|[x×*])/i.test(line))continue}
    const count=line.match(/(\d+)\s*组(?:\s*[×x*]?\s*(\d+)\s*次)?/i) || line.match(/(\d+)\s*[x×*]\s*(\d+)/i) || line.match(/(\d+)\s*sets?/i)
    if(!count)continue
    const weights=[...line.matchAll(/(\d+(?:\.\d+)?)\s*(公斤|千克|kg|磅|lbs?)/ig)]
    if(weights.length>1)throw new Error('逐组使用不同重量的行请拆成独立动作条目，或使用 AI 解析后逐项确认')
    const rest=line.match(/(?:组间\s*)?(?:休息|rest)\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(分钟|分|min(?:utes?)?|秒|s(?:ec(?:onds?)?)?)/i)
    const percent=line.match(/(\d+(?:\.\d+)?)\s*%\s*(?:1\s*RM)?/i)
    const reps=count[2] || line.match(/(\d+)\s*(?:次|reps?)/i)?.[1]
    const repRange=line.match(/(\d+)\s*[-–~至到]\s*(\d+)\s*(?:次|reps?)/i)
    const duration=line.match(/(?:每组|持续|动作时间|[×x*])\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(分钟|分|min(?:utes?)?|秒|s(?:ec(?:onds?)?)?)/i)
    const rpe=line.match(/\bRPE\s*[:：=]?\s*(\d+(?:\.\d+)?)/i),rir=line.match(/\bRIR\s*[:：=]?\s*(\d+(?:\.\d+)?)/i)
    const tempo=line.match(/(?:tempo|节奏)\s*[:：=]?\s*([\dXx]+(?:[-–][\dXx]+){2,3})/i)
    const firstNumber=line.search(/\d/), name=line.slice(0,firstNumber).replace(/^[#\-\s\d.)、]+/,'').replace(/(?:周|星期)[一二三四五六日天]/,'').replace(/[:：,，·\s]+$/,'').trim()
    if(!name)throw new Error('动作名须写在训练参数前，例如：杠铃卧推 40kg 3组×8次 休息120秒')
    const mapping=mapEntity(name,catalog,aliases)
    if(!day){day={weekday:1,dayName:'周一（可修改）',exerciseItems:[]};days.push(day)}
    day.exerciseItems.push({...mapping,sourceLine:line,notes:line,exerciseId:mapping.selectedExerciseId,sets:Number(count[1]),...(repRange?{reps:null,repsMin:Number(repRange[1]),repsMax:Number(repRange[2])}:reps?{reps:Number(reps)}:{}),...(duration?{durationSec:Number(duration[1])*(/分|min/i.test(duration[2])?60:1)}:{}),...(rpe?{rpe:Number(rpe[1])}:{}),...(rir?{rir:Number(rir[1])}:{}),...(tempo?{tempo:tempo[1]}:{}),...(weights[0]?{weight:Number(weights[0][1]),weightUnit:/磅|lb/i.test(weights[0][2])?'lb':'kg'}:{}),...(rest?{restSec:Number(rest[1])*(/分|min/i.test(rest[2])?60:1)}:{}),...(percent?{percent1RM:Number(percent[1])}:{}),estimatedFields:[]})
  }
  if(!days.some(d=>d.exerciseItems.length))throw new Error('未读到明确的组数；请用“杠铃卧推 40kg 3组×8次 休息120秒”格式，或使用 AI 解析')
  return {nameZh:'导入训练方案',nameEn:'',progression:'off',days:days.filter(d=>d.exerciseItems.length)}
}
