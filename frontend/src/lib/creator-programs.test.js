import { it,expect } from 'vitest'
import { creatorPrograms,matchingCreatorPrograms,creatorKnowledge } from './creator-programs.js'
it('filters creator courses without pretending an unknown duration or intensity matches',()=>{
  const short=matchingCreatorPrograms({duration:'short'},'')
  expect(short.some(p=>p.creator==='Pamela Reif')).toBe(true)
  expect(short.every(p=>Number.isFinite(p.minutesMax)&&p.minutesMax<=30)).toBe(true)
  expect(matchingCreatorPrograms({goal:'gain'},'Chris Heria').every(p=>p.creator==='Chris Heria'&&p.goals.includes('gain'))).toBe(true)
})
it('only includes explicitly named creator references in AI input and preserves their provenance',()=>{
  expect(creatorKnowledge('')).toEqual([])
  const sources=creatorKnowledge('我想按帕梅拉或者 chris heria 练')
  expect(new Set(sources.map(p=>p.creator))).toEqual(new Set(['Pamela Reif','Chris Heria']))
  expect(sources.every(p=>p.kind==='creator-reference'&&p.scope.includes('未核对'))).toBe(true)
  expect(sources.every(p=>!p.days&&!p.exerciseItems)).toBe(true)
})
it('keeps rejected Chinese creators out and records official sources with honest access labels',()=>{
  expect(new Set(creatorPrograms.map(p=>p.creator)).size).toBeGreaterThanOrEqual(10)
  expect(creatorPrograms.every(p=>p.url.startsWith('https://')&&p.checkedAt==='2026-10-01')).toBe(true)
  expect(new Set(creatorPrograms.filter(p=>p.region==='china').map(p=>p.creator))).toEqual(new Set(['烧毁一切就是美','北美运动学博士Bruce_PhD']))
  expect(creatorPrograms.some(p=>p.access==='paid')).toBe(true)
  expect(creatorPrograms.some(p=>p.access==='public')).toBe(true)
  expect(new Set(creatorPrograms.map(p=>p.id)).size).toBe(creatorPrograms.length)
})
