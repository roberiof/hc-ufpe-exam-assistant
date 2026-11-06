#!/usr/bin/env node
/**
 * Ingestão de exames — parseia docs-exames-udi-aghu.md e emite data/exames.json.
 *
 * - Lê SOMENTE a planilha (markdown). Escreve SOMENTE data/exames.json.
 * - data/preparos.json é usado apenas para validar a integridade dos preparo_id (FK).
 * - Determinístico e idempotente: mesma entrada → diff zero.
 *
 * Uso:
 *   node scripts/ingest-exames.mjs           # parseia, valida, escreve
 *   node scripts/ingest-exames.mjs --check   # parseia + valida + relatório, NÃO escreve
 *
 * NOTA: normalize() abaixo espelha lib/search.ts:3-11. Manter em sincronia.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const SRC = join(ROOT, "docs-exames-udi-aghu.md")
const OUT = join(ROOT, "data", "exames.json")
const PREPAROS = join(ROOT, "data", "preparos.json")

const ASSOCIATIONS = JSON.parse(readFileSync(join(ROOT, "data", "exam-preparation-associations.json"), "utf8")).bindings

const CHECK_ONLY = process.argv.includes("--check")

// espelha lib/search.ts normalize()
function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function collapseSpaces(s) {
  return s.replace(/\s+/g, " ").trim()
}

// espelha lib/exam-options.ts MODALIDADE_ORDER
const MODALIDADE_ORDER = [
  "tomografia_computadorizada",
  "ressonancia_magnetica",
  "ultrassonografia",
  "radiologia_convencional",
  "mamografia",
  "densitometria_ossea",
  "medicina_nuclear",
]

// header da seção (texto cru, MAIÚSCULO) → enum de modalidade
function modalidadeFromHeader(header) {
  const h = normalize(header)
  if (h.includes("tomografia")) return "tomografia_computadorizada"
  if (h.includes("radiologia")) return "radiologia_convencional"
  if (h.includes("resson")) return "ressonancia_magnetica" // tolera typo "RESSONÂNIA"
  if (h.includes("ultrassonografia")) return "ultrassonografia"
  if (h.includes("medicina nuclear")) return "medicina_nuclear"
  if (h.includes("mamografia")) return "mamografia"
  if (h.includes("densitometria")) return "densitometria_ossea"
  return null
}

/**
 * Mapeia (modalidade, nome_usual) → preparo_id. Roda sobre normalize(nome_usual).
 * Primeira regra que casa vence. Padrões toleram typos conhecidos (contrate, angiotomogarfia).
 */
function mapPreparoId(modalidade, nomeUsual) {
  const n = normalize(nomeUsual)
  const hasContraste = /com contraste|com contrate/.test(n)

  switch (modalidade) {
    case "tomografia_computadorizada":
      if (hasContraste || /angiotom|angiotomogarfia|angiotomogrfia|entero/.test(n))
        return "tc_contraste"
      return "tc_simples"

    case "ressonancia_magnetica":
      if (hasContraste || /angioresson|angiorm|colangio/.test(n)) return "rm_contraste"
      return "rm_simples"

    case "ultrassonografia":
      if (/obstetric|translucencia|morfologic|perfil biofisic/.test(n))
        return "us_obstetrica"
      if (/pelvic|transvaginal|vias urinarias|aparelho urinario|prostata|renal|rins|rim/.test(n))
        return "us_pelvica_vias_urinarias"
      if (/abdomen|abdominal|abdome/.test(n)) return "us_abdômen"
      return "us_pendente"

    case "radiologia_convencional": {
      if (/histerossalping/.test(n)) return "rx_histerossalpingografia"
      if (/enema opaco/.test(n)) {
        if (/crianca|infantil|pediatric/.test(n)) return "rx_enema_opaco_crianca"
        return "rx_enema_opaco_adulto"
      }
      if (/esofago|deglut|\beed\b/.test(n)) return "rx_esofago"
      if (/urografia/.test(n)) return "rx_urografia_excretora"
      if (/uretrocistografia/.test(n)) {
        if (/crianca|infantil|pediatric/.test(n)) return "rx_uretrocistografia_crianca"
        return "rx_uretrocistografia_adulto"
      }
      if (/transito/.test(n)) return "rx_transito_intestinal"
      // outros contrastados sem preparo dedicado → pendente seguro (nunca "sem preparo")
      if (/contrastad|contraste|contrate|colangiograf|fistulograf|sialograf|dacriocisto/.test(n))
        return "rx_contrastado_pendente"
      return "radiologia_sem_preparo"
    }

    case "mamografia":
      return "mamografia"
    case "densitometria_ossea":
      return "densitometria_ossea"
    case "medicina_nuclear":
      return "medicina_nuclear_generico"
    default:
      return null
  }
}

// ── parse ──
const md = readFileSync(SRC, "utf8")
const lines = md.split(/\r?\n/)

let currentModalidade = null
let parsedRows = 0
// Chave = sigla+modalidade. A mesma sigla pode existir em modalidades diferentes
// (ex.: TCOR em TC e Medicina Nuclear); tratamos como exames distintos.
const byKey = new Map() // "sigla|modalidade" → { sigla, nome, nome_usual, modalidade, sinonimos:Set }

for (const line of lines) {
  const headerMatch = line.match(/^##\s+(.*)$/)
  if (headerMatch) {
    const header = headerMatch[1]
    // seções que NÃO são dados
    if (/resumo|duplicad/i.test(normalize(header))) {
      currentModalidade = null
      continue
    }
    currentModalidade = modalidadeFromHeader(header)
    continue
  }

  if (!currentModalidade) continue
  if (!line.trim().startsWith("|")) continue

  const cells = line.split("|").map((c) => c.trim())
  // linha começa/termina com | → cells[0] e último são vazios
  const cols = cells.slice(1, -1)
  if (cols.length < 4) continue
  const [nome, sigla, nomeUsual, sinonimo] = cols
  // pular header e separador
  if (normalize(nome) === "nome" || /^-+$/.test(nome.replace(/\s/g, ""))) continue
  if (!sigla) continue

  const siglaKey = collapseSpaces(sigla).toUpperCase()
  const key = `${siglaKey}|${currentModalidade}`
  parsedRows++

  if (!byKey.has(key)) {
    byKey.set(key, {
      sigla: siglaKey,
      nome: collapseSpaces(nome),
      nome_usual: collapseSpaces(nomeUsual),
      modalidade: currentModalidade,
      sinonimos: new Set(),
    })
  }
  const entry = byKey.get(key)
  // mescla sinônimos distintos (exceto quando == nome/nome_usual)
  const syn = collapseSpaces(sinonimo)
  if (syn) entry.sinonimos.add(syn)
}

// ── build Exame[] ──
const nomeNormSet = (e) => new Set([normalize(e.nome), normalize(e.nome_usual)])

const exames = Array.from(byKey.values()).map((e) => {
  const selfNorms = nomeNormSet(e)
  const sinonimos = Array.from(e.sinonimos)
    .filter((s) => !selfNorms.has(normalize(s)))
    // dedupe por forma normalizada, preservando 1ª grafia
    .reduce((acc, s) => {
      const nk = normalize(s)
      if (!acc._seen.has(nk)) {
        acc._seen.add(nk)
        acc.list.push(s)
      }
      return acc
    }, { _seen: new Set(), list: [] }).list

  return {
    sigla: e.sigla,
    nome: e.nome,
    nome_usual: e.nome_usual,
    sinonimos: [...new Set([...sinonimos, ...(ASSOCIATIONS[`${e.modalidade}:${e.sigla}`]?.search_aliases ?? [])])],
    modalidade: e.modalidade,
    preparo_id: ASSOCIATIONS[`${e.modalidade}:${e.sigla}`]?.preparo_id ?? mapPreparoId(e.modalidade, e.nome_usual),
    ...(ASSOCIATIONS[`${e.modalidade}:${e.sigla}`] ? { association_review: ASSOCIATIONS[`${e.modalidade}:${e.sigla}`] } : {}),
  }
})

// Reject stale/typoed explicit associations instead of silently ignoring them.
for (const key of Object.keys(ASSOCIATIONS)) {
  if (!exames.some(e => `${e.modalidade}:${e.sigla}` === key)) {
    throw new Error(`Associação explícita sem exame no catálogo: ${key}`)
  }
}

// sort estável: ordem de modalidade, depois sigla
exames.sort((a, b) => {
  const ia = MODALIDADE_ORDER.indexOf(a.modalidade)
  const ib = MODALIDADE_ORDER.indexOf(b.modalidade)
  const oa = ia === -1 ? Infinity : ia
  const ob = ib === -1 ? Infinity : ib
  if (oa !== ob) return oa - ob
  return a.sigla.localeCompare(b.sigla)
})

// ── validação de FK ──
const preparos = JSON.parse(readFileSync(PREPAROS, "utf8"))
const validIds = new Set(Object.keys(preparos.preparos))
const missing = new Map() // preparo_id → count
for (const e of exames) {
  if (!e.preparo_id || !validIds.has(e.preparo_id)) {
    missing.set(e.preparo_id ?? "(null)", (missing.get(e.preparo_id ?? "(null)") ?? 0) + 1)
  }
}

// ── relatório ──
const uniqueExames = byKey.size
const mergedDupes = parsedRows - uniqueExames

const perModalidade = {}
const perStatus = {}
for (const e of exames) {
  perModalidade[e.modalidade] = (perModalidade[e.modalidade] ?? 0) + 1
  const status = preparos.preparos[e.preparo_id]?.status ?? "pendente"
  perStatus[e.modalidade] ??= { ok: 0, parcial: 0, pendente: 0 }
  perStatus[e.modalidade][status]++
}

console.log("═══ Ingestão de exames ═══")
console.log(`Linhas parseadas : ${parsedRows}`)
console.log(`Exames únicos    : ${uniqueExames} (sigla+modalidade)`)
console.log(`Dupes mescladas  : ${mergedDupes} (mesma sigla+modalidade, sinônimos unidos)`)
console.log("\nPor modalidade (total | ok / parcial / pendente):")
for (const m of MODALIDADE_ORDER) {
  const total = perModalidade[m] ?? 0
  const s = perStatus[m] ?? { ok: 0, parcial: 0, pendente: 0 }
  console.log(
    `  ${m.padEnd(28)} ${String(total).padStart(4)} | ${s.ok} / ${s.parcial} / ${s.pendente}`
  )
}
const reais = Object.values(perStatus).reduce((a, s) => a + s.ok + s.parcial, 0)
const pend = Object.values(perStatus).reduce((a, s) => a + s.pendente, 0)
console.log(`\nCobertura: ${reais} com orientações cadastradas (ok/parcial; não é homologação), ${pend} pendente (fallback seguro)`)

if (missing.size > 0) {
  console.error("\n✗ FK inválida — preparo_id inexistente em preparos.json:")
  for (const [id, count] of missing) console.error(`   ${id} (${count} exames)`)
  console.error("\nAdicione os preparos faltando antes de rodar a ingestão.")
  process.exit(1)
}

if (CHECK_ONLY) {
  console.log("\n--check: nada escrito.")
} else {
  writeFileSync(OUT, JSON.stringify(exames, null, 2) + "\n", "utf8")
  console.log(`\n✓ Escrito ${OUT} (${exames.length} exames)`)
}
