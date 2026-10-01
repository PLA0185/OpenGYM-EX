import { it, expect } from 'vitest'
import { readableUnits } from './readable-text.js'
it('keeps Chinese runs in units of at least two characters including a final punctuation mark',()=>{
  const input='默认限能量按超重；营养目标说明。',units=readableUnits(input)
  expect(units.join('')).toBe(input)
  expect(Math.max(...units.map(s=>s.length))).toBeLessThanOrEqual(4)
  expect(units.every(s=>s.replace(/[\p{P}\p{Z}]/gu,'').length>=2)).toBe(true)
})
it('never leaves a one-letter English word or a single Chinese character with punctuation alone',()=>{
  for(const input of ['This is a training plan, I agree.','轻、力量与恢复。','营养目标 2355 kcal · 蛋白质 117.8 g']){
    const units=readableUnits(input);expect(units.join('')).toBe(input)
    expect(units.filter(s=>s.trim()).every(s=>s.replace(/[\p{P}\p{Z}]/gu,'').length!==1)).toBe(true)
  }
})
