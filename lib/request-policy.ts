import { normalize } from "./search"
import { wantsAggregateCount } from "./aggregate"

export function deterministicIntent(message: string): "count" | "documents" | "clarify" | undefined {
  if (wantsAggregateCount(message)) return "count"
  const q = normalize(message)
  if (/document|cartao/.test(q) && !/jejum|preparo|contraste|sedacao/.test(q)) return "documents"
  // A generic MRI request lacks an anatomical target; do not select the first exam.
  if (/jeju|preparo/.test(q) && /\b(ressonancia|rm)\b/.test(q) && !/barriga|cabeca|costas|abdome|abdomen|cranio|encefalo|torax|pelve|coluna|joelho|ombro|mama|mao|pe\b|punho|quadril|colangio|pescoco|face|orbita|perna|braco|cotovelo|tornozelo|sacro|coracao|cardiac|prostata/.test(q)) return "clarify"
  return undefined
}
