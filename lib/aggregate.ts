import { normalize } from "./search"
import { stemQuery } from "./stem"
import { modalidadeLabel, prettifyExamName } from "./exam-options"
import type { Exame, PreparosFile, Profile } from "./types"

/**
 * Camada de AGREGAÇÃO — responde perguntas sobre a TOTALIDADE da base
 * (contagens, listagens, filtros por modalidade/preparo), que a busca
 * pontual (searchExames → top-3) não consegue atender.
 *
 * A busca por exame monta o CONTEXTO só com os exames que casaram; perguntas
 * como "quantos exames precisam de preparo?" ou "liste exames de tomografia"
 * ficavam sem dados. Aqui derivamos os números/listas da base inteira e
 * injetamos como uma nova CAMADA no CONTEXTO.
 */

/** Teto de itens exibidos numa listagem — nunca despejar ~800 nomes. */
export const LIST_CAP = 15

export type PreparoNeed = "needs" | "none" | "unknown"

/**
 * Classifica se um exame PRECISA de preparo, segundo o produto:
 * - `pendente` (ou preparo_id ausente) → "unknown" (não cadastrado).
 * - `radiologia_sem_preparo` → "none" (comprovadamente dispensa preparo).
 * - qualquer outro preparo cadastrado (ok/parcial) → "needs".
 */
export function classifyPreparo(exame: Exame, preparos: PreparosFile): PreparoNeed {
  const p = preparos.preparos[exame.preparo_id]
  if (!p || p.status === "pendente") return "unknown"
  if (exame.preparo_id === "radiologia_sem_preparo") return "none"
  return "needs"
}

// ---- Detecção de intenção -------------------------------------------------

// A query chega STEMMIZADA (ver parseFilter/wantsAggregate*): "quantos"→"quanto",
// "quantas"→"quanta". Usamos o radical "quant" para cobrir todas as flexões.
const COUNT_REGEX =
  /\bquant|\bnumero\b|\bn de\b|\btotal de\b/
const LIST_REGEX =
  /\bliste\b|\blistar\b|\blista\b|\bmostre\b|\bmostrar\b|\bquais\b|\brelacione\b|\brelacao de\b|\bexemplos de\b|\balguns\b|\bexiba\b/

// Uma pergunta é "de base" (agregação/listagem) quando fala de exames em geral,
// não de um exame específico. Sinais: menção a "base", "todos", "cadastr", ou
// filtro por modalidade/preparo junto de contagem/listagem.
const BASE_HINT_REGEX =
  /\bbase\b|\btodos\b|\btodas\b|\bcadastr\b|\bexistem\b|\bha na\b|\bpossui\b|\bcatalogo\b|\bacervo\b/

/** Palavras que indicam filtro por necessidade de preparo. */
function needFilter(q: string): PreparoNeed | undefined {
  const wantsNone = /\bsem preparo\b|nao (precisa|precisam|exige|exigem|necessita|necessitam|requer)|\bdispensa\b/.test(q)
  // Remove os verbos negados ("nao precisam") antes de testar o lado positivo,
  // para "nao precisam" não casar como "precisam".
  const qPos = q.replace(/nao (precisa|precisam|exige|exigem|necessita|necessitam|requer|requerem)/g, " ")
  const wantsNeeds = /\bcom preparo\b|\bprecisa\b|\bprecisam\b|\bexige\b|\bexigem\b|\bnecessita\b|\bnecessitam\b|\brequer\b|\brequerem\b|tem preparo|com jejum/.test(qPos)
  // Pergunta pelos DOIS lados ("quantos precisam e quantos não precisam") →
  // sem filtro único; o detalhamento por status responde os dois de uma vez.
  if (wantsNone && wantsNeeds) return undefined
  if (wantsNone) return "none"
  if (wantsNeeds) return "needs"
  return undefined
}

/** Modalidades reconhecidas por termos livres na pergunta. */
const MODALIDADE_TERMS: Array<{ modalidade: string; re: RegExp }> = [
  { modalidade: "tomografia_computadorizada", re: /\btomografia\b|\btc\b|\bangiotomografia\b/ },
  { modalidade: "ressonancia_magnetica", re: /\bressonancia\b|\brm\b|\bangioressonancia\b/ },
  { modalidade: "ultrassonografia", re: /\bultrassom\b|\bultrassonografia\b|\bus\b|\becografia\b|\bdoppler\b/ },
  { modalidade: "radiologia_convencional", re: /\braio\s?x\b|\brx\b|radiografia|\bradiologia\b/ },
  { modalidade: "mamografia", re: /\bmamografia\b|\bmamografico\b/ },
  { modalidade: "densitometria_ossea", re: /\bdensitometria\b/ },
  { modalidade: "medicina_nuclear", re: /medicina nuclear|\bcintilografia\b/ },
]

function modalidadeFilter(q: string): string | undefined {
  for (const { modalidade, re } of MODALIDADE_TERMS) {
    if (re.test(q)) return modalidade
  }
  return undefined
}

export type AggregateFilter = {
  modalidade?: string
  need?: PreparoNeed
}

/** Extrai filtros (modalidade + necessidade de preparo) da pergunta. */
export function parseFilter(query: string): AggregateFilter {
  // Stemiza para que plurais ("ressonâncias", "tomografias") casem os regex,
  // que são escritos no singular. Ver lib/stem.ts.
  const q = stemQuery(normalize(query))
  return { modalidade: modalidadeFilter(q), need: needFilter(q) }
}

/**
 * Pergunta de CONTAGEM sobre a base — "quantos exames...", "qual a quantidade
 * de...". Exige um verbo de contagem + um sinal de escopo de base (menção
 * genérica a exames/base/todos, ou um filtro por modalidade/preparo).
 */
export function wantsAggregateCount(query: string): boolean {
  const q = stemQuery(normalize(query))
  if (/\b(hora|minuto|tempo|dia|dose|agua)\b/.test(q)) return false
  if (!COUNT_REGEX.test(q)) return false
  const f = parseFilter(query)
  return (
    BASE_HINT_REGEX.test(q) ||
    /\bexames?\b/.test(q) ||
    f.modalidade !== undefined ||
    f.need !== undefined
  )
}

/**
 * Pergunta de LISTAGEM da base — "liste exames de tomografia", "quais exames
 * não precisam de preparo". Exige verbo de listagem + escopo de base/filtro.
 * (Difere de `wantsListaRaiox` no route, que é específico de raio-X contrastado.)
 */
export function wantsAggregateList(query: string): boolean {
  const q = stemQuery(normalize(query))
  if (!LIST_REGEX.test(q)) return false
  const f = parseFilter(query)
  return (
    BASE_HINT_REGEX.test(q) ||
    f.modalidade !== undefined ||
    f.need !== undefined
  )
}

// ---- Filtragem da base ----------------------------------------------------

function applyFilter(exames: Exame[], preparos: PreparosFile, f: AggregateFilter): Exame[] {
  return exames.filter((e) => {
    if (f.modalidade && e.modalidade !== f.modalidade) return false
    if (f.need && classifyPreparo(e, preparos) !== f.need) return false
    return true
  })
}

/** Descrição legível do filtro, para instruir o modelo. */
function describeFilter(f: AggregateFilter): string {
  const parts: string[] = []
  if (f.modalidade) parts.push(`modalidade ${modalidadeLabel(f.modalidade)}`)
  if (f.need === "needs") parts.push("que PRECISAM de preparo")
  if (f.need === "none") parts.push("que NÃO precisam de preparo")
  if (f.need === "unknown") parts.push("com preparo não cadastrado")
  return parts.length ? parts.join(", ") : "de toda a base"
}

// ---- Construção das camadas de contexto -----------------------------------

/**
 * CAMADA AGREGAÇÃO — contagem. Responde só ao que foi perguntado (respeitando
 * o filtro) e sempre informa o total da base como referência.
 */
export function buildAggregateContext(
  query: string,
  exames: Exame[],
  preparos: PreparosFile,
): string {
  const f = parseFilter(query)
  const filtered = applyFilter(exames, preparos, f)

  let ctx = `\n### CAMADA AGREGAÇÃO — CONTAGEM NA BASE\n`
  ctx += `INSTRUÇÃO: O usuário perguntou uma CONTAGEM sobre a base de exames. Use EXATAMENTE os números abaixo, sem recalcular nem inventar. Responda diretamente ao que foi perguntado. NÃO liste os exames um a um (a pergunta é de contagem).\n`

  if (f.modalidade || f.need) {
    ctx += `Contagem para exames ${describeFilter(f)}: ${filtered.length}\n`
  }
  ctx += `Total de exames na base: ${exames.length}\n`

  // Quando não há filtro de necessidade, oferece o detalhamento por status de
  // preparo — útil se o usuário fez a pergunta original (precisam/não precisam).
  if (!f.need) {
    const scope = f.modalidade ? applyFilter(exames, preparos, { modalidade: f.modalidade }) : exames
    let needs = 0
    let none = 0
    let unknown = 0
    for (const e of scope) {
      const c = classifyPreparo(e, preparos)
      if (c === "needs") needs++
      else if (c === "none") none++
      else unknown++
    }
    const label = f.modalidade ? `${modalidadeLabel(f.modalidade)}` : "base"
    ctx += `Detalhamento por preparo (${label}): ${needs} PRECISAM de preparo, ${none} NÃO precisam de preparo, ${unknown} com preparo não cadastrado (status desconhecido). Deixe claro que "não cadastrado" é diferente de "não precisa".\n`
  }

  return ctx
}

/**
 * CAMADA LISTAGEM — lista filtrada, limitada a LIST_CAP. Se houver mais itens,
 * mostra só os primeiros e informa o total (nunca despeja a base inteira).
 */
export function buildListContext(
  query: string,
  exames: Exame[],
  preparos: PreparosFile,
  profile: Profile,
): { context: string; matched: Exame[] } {
  const isPro = profile === "professional"
  const f = parseFilter(query)
  const filtered = applyFilter(exames, preparos, f)
  const shown = filtered.slice(0, LIST_CAP)

  let ctx = `\n### CAMADA LISTAGEM — EXAMES DA BASE\n`
  ctx += `INSTRUÇÃO: O usuário pediu uma LISTA de exames ${describeFilter(f)}. Liste EXATAMENTE os exames abaixo, pelo NOME${isPro ? " e código AGHU" : ""}, e nenhum outro.`

  if (filtered.length > shown.length) {
    ctx += ` A base tem ${filtered.length} exames nesse filtro; mostre estes ${shown.length} como amostra e diga claramente ao usuário que há ${filtered.length} no total, sugerindo que ele refine a busca (ex.: por modalidade) ou consulte o setor para a lista completa. NÃO invente outros nomes.`
  } else {
    ctx += ` São ${filtered.length} exames no total para esse filtro.`
  }
  if (!isPro) ctx += ` NÃO exiba códigos/siglas internos.`
  ctx += `\n`

  for (const e of shown) {
    const nome = e.label_paciente ?? prettifyExamName(e.nome_usual)
    ctx += isPro ? `- ${nome} (código: ${e.sigla})\n` : `- ${nome}\n`
  }
  ctx += filtered.length > shown.length
    ? `Mostrando ${shown.length} de ${filtered.length} exames.\n`
    : `Total: ${filtered.length} exames.\n`

  return { context: ctx, matched: shown }
}
