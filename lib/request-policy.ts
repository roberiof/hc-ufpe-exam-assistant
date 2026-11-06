import { normalize } from "./search"
import { wantsAggregateCount } from "./aggregate"

export function deterministicIntent(message: string): "count" | "documents" | "clarify" | "attributes" | "missing" | undefined {
  if (wantsAggregateCount(message)) return "count"
  const q = normalize(message)
  if (/nao (?:esta|consta) na (?:lista|base)|fora (?:da lista|do catalogo)/.test(q)) return 'missing'
  if (['contraste', 'sedacao'].some(attribute => q.includes(`com ${attribute}`) && q.includes(`sem ${attribute}`))) return 'attributes'
  if (/document|cartao/.test(q) && !/jejum|preparo|bexiga/.test(q)) return "documents"
  // A generic MRI request lacks an anatomical target; do not select the first exam.
  if (/jeju|preparo/.test(q) && /\b(ressonancia|rm)\b/.test(q) && !/barriga|cabeca|costas|abdome|abdomen|cranio|encefalo|torax|pelve|coluna|joelho|ombro|mama|mao|pe\b|punho|quadril|colangio|pescoco|face|orbita|perna|braco|cotovelo|tornozelo|sacro|coracao|cardiac|prostata/.test(q)) return "clarify"
  return undefined
}

/** A specific preparation question is not a catalog listing. */
export function wantsListaRaiox(message: string): boolean {
  const q = normalize(message)
  return /\braio x\b|\brx\b|radiologia|contrastad/.test(q) &&
    /\b(?:quais|que) (?:sao os )?exames\b|\b(?:liste|listar|lista de|todos os exames)\b/.test(q)
}
