import registry from '@/data/documentary-evidence.json'
import type { EvidenceReference, Exame, Preparo } from './types'

/** Each fact is bound to explicit exam identifiers, never inferred from a shared preparation. */
export function factsForExam(exam: Exame, preparation: Preparo): EvidenceReference[] {
  const selected = new Set(preparation.fact_ids ?? [])
  return registry.facts.filter(f => selected.has(f.id) && f.modality === exam.modalidade && f.appliesTo.includes(exam.sigla)).map(f => {
    const source = registry.sources[f.sourceId as keyof typeof registry.sources]
    return {factId:f.id,text:f.text,topic:f.topic,sourceTitle:source.title,sourceHash:source.sha256,locator:f.locator,quote:f.quote,validation:'pending-udi'}
  })
}
