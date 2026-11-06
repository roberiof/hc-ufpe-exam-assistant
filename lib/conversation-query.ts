import { normalize, hasExplicitModality } from './search'
import type { ChatMessage } from './types'

// Explicit new exams reset previous qualifiers, even when the catalog cannot find them.
const names = /\b(tomografia|angiotomografia|tc|ressonancia|rm|ultrassom|ultrassonografia|usg|mamografia|densitometria|cintilografia|radiografia|rx)\b|raio x|histerossalpingografia|uretrocistografia|enema|pet ct/
const region = /\b(abdomen|abdome|torax|cranio|cabeca|barriga|pelve|coluna|joelho|ombro|punho|quadril|pescoco)\b/
const qualifier = /\b(com|sem) (contraste|sedacao)\b/g

export function conversationQuery(message: string, history: ChatMessage[]): string {
  let active = ''
  for (const text of [...history.filter(m => m.role === 'user').slice(-8).map(m => m.content), message]) {
    const q = normalize(text)
    if (names.test(q) || /\b(vou fazer|outro exame|agora farei)\b/.test(q)) {
      // A short answer selecting a modality completes an anatomical-only request.
      const modalityAnswer = /^(?:e |eh |uma |um )?(?:tomografia|tc|ressonancia(?: magnetica)?|rm|raio x|radiografia|rx)(?: (?:com|sem) (?:contraste|sedacao)(?: e)?)*$/.test(q)
      active = active && !hasExplicitModality(active) && region.test(normalize(active)) && modalityAnswer
        ? `${active} ${text}` : text
      continue
    }
    if (region.test(q) && (!active || /^exame\b/.test(q))) {
      active = text
      continue
    }
    const attributes = [...q.matchAll(qualifier)]
    if (active && (attributes.length || region.test(q))) {
      let base = normalize(active)
      for (const attribute of attributes) base = base.replace(new RegExp(`\\b(com|sem) ${attribute[2]}\\b`, 'g'), '')
      active = `${base} ${text}`
    }
  }
  const q = normalize(message)
  // Only inherit context for explicit continuations or short clarification answers.
  if (names.test(q) || /\b(vou fazer|outro exame|agora farei)\b/.test(q)) return active
  if (active && (/\b(contraste|sedacao|documentos|levar|chegar|jejum|preparo|hora|horas)\b/.test(q) || region.test(q))) return active
  return message
}
