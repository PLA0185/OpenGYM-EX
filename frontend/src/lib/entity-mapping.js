export const normalizeName = s => String(s || '').normalize('NFKC').toLowerCase().replace(/[\s_\-·]/g, '')
export function mapEntity(originalText, entities, aliases = {}) {
  const key = normalizeName(originalText), selected = aliases[key]
  const exact = entities.filter(e => [e.nameZh, e.nameEn, e.n, ...(e.aliasesZh || []), ...(e.aliasesEn || [])].some(n => n && normalizeName(n) === key))
  if (selected && entities.some(e => e.id === selected)) return { originalText, mappingStatus: 'user-resolved', selectedExerciseId: selected, candidateExerciseIds: [selected], confidence: 1, reason: 'personal-alias' }
  if (exact.length === 1) return { originalText, mappingStatus: 'exact', selectedExerciseId: exact[0].id, candidateExerciseIds: [exact[0].id], confidence: 1, reason: 'unique-name' }
  const candidates = exact.length ? exact : entities.filter(e => [e.nameZh, e.nameEn, e.n, ...(e.aliasesZh || [])].some(n => n && key && (normalizeName(n).includes(key) || key.includes(normalizeName(n)))))
  return { originalText, mappingStatus: candidates.length ? 'ambiguous' : 'unmapped', selectedExerciseId: null, candidateExerciseIds: candidates.slice(0, 12).map(e => e.id), confidence: 0, reason: candidates.length ? 'confirm-variant' : 'no-match' }
}
export function stripTranscript(text) {
  if (typeof text !== 'string' || text.length > 60000) throw new Error('Import text too large')
  return text.replace(/^WEBVTT[^\n]*$/gm, '').replace(/^\d+\s*$/gm, '').replace(/^.*\d{2}:\d{2}(?::\d{2})?[.,]\d+\s*-->.*$/gm, '').replace(/<[^>]*>/g, '').trim()
}
