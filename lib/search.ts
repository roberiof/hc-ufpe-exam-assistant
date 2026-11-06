import type { Exame } from "./types"
import { stemToken } from "./stem"
import { expandLayTerms } from "./lay-synonyms"

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// Palavras comuns em perguntas que NÃO identificam um exame. Não pontuam sozinhas
// — evita que "me explique os documentos para levar" case com um exame aleatório.
const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "e", "o", "a", "os", "as", "um", "uma",
  "para", "por", "com", "sem", "em", "no", "na", "nos", "nas", "ao", "aos",
  "que", "qual", "quais", "quanto", "quantos", "quando", "onde", "como",
  "me", "meu", "minha", "eu", "voce", "se", "sobre", "mais", "menos", "muito",
  "explique", "explica", "explicar", "detalhado", "detalhada", "detalhe",
  "detalhes", "informacao", "informacoes", "informe", "diga", "fale", "quero",
  "saber", "gostaria", "preciso", "pode", "poderia", "favor", "obrigado",
  "exame", "exames", "documento", "documentos", "levar", "trazer", "preparo",
  "preparos", "orientacao", "orientacoes", "dia", "antes", "depois", "isso",
  "este", "esse", "esta", "essa", "isto", "tudo", "todos", "todas",
])

/**
 * Distância de Damerau-Levenshtein com early-exit por teto `max`. Retorna um
 * valor > max assim que a distância mínima possível já ultrapassa o teto
 * (barato o suficiente para o caminho de request). Pura.
 */
export function damerauLevenshtein(a: string, b: string, max: number): number {
  const la = a.length
  const lb = b.length
  if (Math.abs(la - lb) > max) return max + 1

  const prev2 = new Array<number>(lb + 1)
  const prev1 = new Array<number>(lb + 1)
  const curr = new Array<number>(lb + 1)
  for (let j = 0; j <= lb; j++) prev1[j] = j

  for (let i = 1; i <= la; i++) {
    curr[0] = i
    let rowMin = curr[0]
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(
        prev1[j] + 1, // deleção
        curr[j - 1] + 1, // inserção
        prev1[j - 1] + cost, // substituição
      )
      // transposição (ex.: "racionancia" ~ "ressonancia" class de troca)
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        v = Math.min(v, prev2[j - 2] + 1)
      }
      curr[j] = v
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
    for (let j = 0; j <= lb; j++) {
      prev2[j] = prev1[j]
      prev1[j] = curr[j]
    }
  }
  return prev1[lb]
}

/** Teto de distância tolerado, em função do tamanho do token. */
function fuzzyMaxDistance(len: number): number {
  if (len <= 3) return 0 // curto: só exato (protege siglas rm/tc/us)
  if (len <= 6) return 1
  return 2
}

/**
 * Um token de query casa um token de haystack por proximidade quando: mesma
 * primeira letra (typos raramente erram a inicial), dentro do teto de distância
 * do tamanho, e ambos com > 3 chars.
 */
function fuzzyTokenHits(qToken: string, hayTokens: string[]): boolean {
  if (qToken.length <= 3) return false
  const max = fuzzyMaxDistance(qToken.length)
  if (max === 0) return false
  for (const h of hayTokens) {
    if (h.length <= 3) continue
    if (h[0] !== qToken[0]) continue
    if (damerauLevenshtein(qToken, h, max) <= max) return true
  }
  return false
}

// Pesos de pontuação. Exato > leigo (injeção curada) > fuzzy (rede de segurança).
const W_SIGLA = 50
const W_FIELD_CONTAINS_Q = 30
const W_Q_CONTAINS_FIELD = 20
const W_TOKEN = 5
const W_LAY = 3
const W_FUZZY = 2
const FUZZY_CAP = 6 // teto de contribuição fuzzy por exame

// Índice de haystack pré-computado (a base é JSON estático — evita renormalizar
// 814 × 4 campos a cada request).
type Indexed = {
  exame: Exame
  sigla: string
  haystack: string
  hayTokens: string[]
}

let INDEX: Indexed[] | null = null
let INDEXED_FOR: Exame[] | null = null

function buildIndex(exames: Exame[]): Indexed[] {
  return exames.map((exame) => {
    const fields = [
      exame.nome,
      exame.nome_usual,
      ...exame.sinonimos,
    ].map(normalize)
    const haystack = fields.join(" ")
    return {
      exame,
      sigla: normalize(exame.sigla),
      haystack,
      hayTokens: haystack.split(" ").filter(Boolean),
    }
  })
}

function getIndex(exames: Exame[]): Indexed[] {
  // Mesma referência de array → reusa o índice. Em runtime a base é o mesmo
  // objeto importado; nos testes cada arquivo importa o mesmo JSON.
  if (INDEX && INDEXED_FOR === exames) return INDEX
  INDEX = buildIndex(exames)
  INDEXED_FOR = exames
  return INDEX
}

/**
 * Busca textual normalizada em sigla, nome, nome_usual e sinonimos.
 * Retorna até 3 candidatos ordenados por relevância.
 *
 * Camadas (query-side, aditivas — o gate de relevância no fim continua igual,
 * preservando a recusa segura para exames desconhecidos):
 * 1. match exato de sigla/campo/token (pesos altos).
 * 2. singularização do token de query (stemToken) + expansão leiga (peso médio).
 * 3. fuzzy (Damerau-Levenshtein) como rede de segurança para typos (peso baixo,
 *    com teto), sem primeira-letra diferente e sem tokens curtos.
 */
export function searchExames(query: string, exames: Exame[]): Exame[] {
  const q = normalize(query)
  if (!q) return []

  // Tokens significativos: > 1 char e não stopwords.
  const rawTokens = q
    .split(" ")
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))

  // Singulariza cada token para casar plural do usuário com o nome no singular.
  const tokens = rawTokens.map(stemToken)
  // Termos técnicos injetados a partir de linguagem leiga ("barriga" → abdomen).
  const layTokens = expandLayTerms(tokens)

  const index = getIndex(exames)
  const modalities: Array<[string, RegExp]> = [
    ["tomografia_computadorizada", /\btomografia\b|\bangiotomografia\b|\btc\b/],
    ["ressonancia_magnetica", /\bressonancia\b|\bracionancia\b|\bresonancia\b|\bangioressonancia\b|\brm\b/],
    ["ultrassonografia", /\bultrassom\b|\bultrassonografia\b|\busg\b|\bus\b/],
    ["radiologia_convencional", /\braio\s*x\b|\brx\b|\bradiografia\b|histerossalpingografia|uretrocistografia|enema opaco/],
    ["mamografia", /\bmamografia\b/],
    ["densitometria_ossea", /\bdensitometria\b/],
    ["medicina_nuclear", /\bcintilografia\b|medicina nuclear/],
  ]
  const mentioned = modalities.filter(([, re]) => re.test(tokens.join(" "))).map(([mod]) => mod)
  // More than one explicit modality is ambiguous; do not silently choose one.
  if (mentioned.length > 1) return []
  const contrast = /\bsem contraste\b/.test(q) ? false : /\bcom contraste\b/.test(q) ? true : undefined
  const sedation = /\bsem sedacao\b/.test(q) ? false : /\bcom sedacao\b/.test(q) ? true : undefined
  const child = /\bcrianca\b|\bfilh[oa]\b|\bpediatric/.test(q)
  const adult = /\badult/.test(q)
  const compatible = (name: string, attribute: string, value: boolean | undefined) =>
    value === undefined || (new RegExp(`\\b${value ? "com" : "sem"} ${attribute}\\b`).test(name) && !new RegExp(`\\b${value ? "sem" : "com"} ${attribute}\\b`).test(name))

  const scored = index
    .filter(({ exame }) => {
      const name = normalize(`${exame.nome} ${exame.nome_usual}`)
      const explicitCode = q === normalize(exame.sigla) || (/\bcodigo\b/.test(q) && q.split(' ').includes(normalize(exame.sigla)))
      // Do not introduce a specialized procedure when the question asks for a general exam.
      const specialScopes = [
        { inName: /pre transplante/, inQuery: /transplant/ },
        { inName: /peca cirurg/, inQuery: /peca|cirurg/ },
        { inName: /regulacao/, inQuery: /regulacao/ },
        { inName: /complement/, inQuery: /complement/ },
        { inName: /biops|puncao/, inQuery: /biops|puncao|agulha/ },
        { inName: /marcacao pre cirurg/, inQuery: /marcacao|cirurg/ },
      ]
      if (!explicitCode && specialScopes.some(scope => scope.inName.test(name) && !scope.inQuery.test(q))) return false
      return (!mentioned.length || mentioned.includes(exame.modalidade)) &&
        compatible(name, "contraste", contrast) && compatible(name, "sedacao", sedation) &&
        (!child || /pediatric|crianca/.test(name)) && (!adult || !/pediatric|crianca/.test(name))
    })
    .map(({ exame, sigla, haystack, hayTokens }) => {
      let score = 0

      // Correspondência exata da sigla.
      if (sigla && (q === sigla || new RegExp(`\\bcodigo(?: aghu)? (?:do exame )?${sigla}\\b`).test(q))) score += W_SIGLA

      // Correspondência de campo completo (query inteira).
      if (haystack.includes(q)) score += W_FIELD_CONTAINS_Q
      if (q.includes(haystack) && haystack) score += W_Q_CONTAINS_FIELD

      // Token significativo (singularizado): substring OU token exato do haystack.
      for (const token of tokens) {
        if (haystack.includes(token) || hayTokens.includes(token)) score += W_TOKEN
      }

      // Termos leigos injetados: peso menor — ajudam a identificar região, mas
      // sozinhos não devem produzir um match confiante (ambiguidade de modalidade).
      for (const token of layTokens) {
        if (haystack.includes(token) || hayTokens.includes(token)) score += W_LAY
      }

      // Fuzzy: só para tokens de query ainda sem match exato, com teto por exame.
      let fuzzy = 0
      for (const token of tokens) {
        if (haystack.includes(token) || hayTokens.includes(token)) continue
        if (fuzzy >= FUZZY_CAP) break
        if (fuzzyTokenHits(token, hayTokens)) fuzzy = Math.min(FUZZY_CAP, fuzzy + W_FUZZY)
      }
      score += fuzzy

      return { exame, score }
    })
    // Exige sinal real: pelo menos um token significativo ou match de campo.
    // Sem isso, "os documentos para levar" (só stopwords) não casa nada.
    .filter((s) => s.score > 0 && (tokens.length > 0 || s.score >= W_Q_CONTAINS_FIELD))
    .sort((a, b) => b.score - a.score)

  const best = scored[0]?.score ?? 0
  return scored.filter(s => s.score >= best - 2).slice(0, 3).map((s) => s.exame)
}
