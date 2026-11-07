#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const SCRIPT_PATH = fileURLToPath(import.meta.url)
const ROOT = join(dirname(SCRIPT_PATH), "..")
const JSON_REPORT = join(ROOT, "evaluation", "reports", "catalog-audit.json")
const MARKDOWN_REPORT = join(ROOT, "evaluation", "reports", "catalog-audit.md")

export function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function modalityFromHeader(header) {
  const value = normalize(header)
  if (value.includes("tomografia")) return "tomografia_computadorizada"
  if (value.includes("radiologia")) return "radiologia_convencional"
  if (value.includes("resson")) return "ressonancia_magnetica"
  if (value.includes("ultrassonografia")) return "ultrassonografia"
  if (value.includes("medicina nuclear")) return "medicina_nuclear"
  if (value.includes("mamografia")) return "mamografia"
  if (value.includes("densitometria")) return "densitometria_ossea"
  return null
}

export function parseSourceCatalog(markdown) {
  const rows = []
  let modality = null

  for (const [index, line] of markdown.split(/\r?\n/).entries()) {
    const header = line.match(/^##\s+(.*)$/)
    if (header) {
      modality = /resumo|duplicad/i.test(normalize(header[1]))
        ? null
        : modalityFromHeader(header[1])
      continue
    }

    if (!modality || !line.trim().startsWith("|")) continue
    const columns = line.split("|").map((cell) => cell.trim()).slice(1, -1)
    if (columns.length < 4) continue
    const [name, code, commonName] = columns
    if (!code || normalize(name) === "nome" || /^-+$/.test(name.replace(/\s/g, ""))) continue

    rows.push({
      line: index + 1,
      code: code.replace(/\s+/g, " ").trim().toUpperCase(),
      name: name.replace(/\s+/g, " ").trim(),
      commonName: commonName.replace(/\s+/g, " ").trim(),
      modality,
    })
  }

  return rows
}

function grouped(values, keyFor) {
  const groups = new Map()
  for (const value of values) {
    const key = keyFor(value)
    const group = groups.get(key) ?? []
    group.push(value)
    groups.set(key, group)
  }
  return groups
}

function examRef(exam) {
  return {
    code: exam.sigla,
    modality: exam.modalidade,
    name: exam.nome,
    preparationId: exam.preparo_id ?? null,
  }
}

function sorted(values, keyFor = (value) => JSON.stringify(value)) {
  return [...values].sort((a, b) => keyFor(a).localeCompare(keyFor(b), "pt-BR"))
}

export function auditCatalog(exams, preparationFile, sourceRows = []) {
  const preparations = preparationFile?.preparos ?? {}
  const preparationIds = new Set(Object.keys(preparations))
  const requiredFields = ["sigla", "nome", "nome_usual", "modalidade", "preparo_id"]

  const invalidExams = exams.flatMap((exam, index) => {
    const missingFields = requiredFields.filter(
      (field) => typeof exam?.[field] !== "string" || !exam[field].trim(),
    )
    return missingFields.length ? [{ index, missingFields, exam: examRef(exam ?? {}) }] : []
  })

  const missingPreparationReferences = sorted(
    exams
      .filter((exam) => !preparationIds.has(exam.preparo_id))
      .map(examRef),
    (item) => `${item.modality}:${item.code}`,
  )

  const invalidPreparations = sorted(
    Object.entries(preparations).flatMap(([id, preparation]) => {
      const missingFields = ["titulo", "status"].filter(
        (field) => typeof preparation?.[field] !== "string" || !preparation[field].trim(),
      )
      const invalidStatus = preparation && !["ok", "parcial", "pendente"].includes(preparation.status)
      return missingFields.length || invalidStatus
        ? [{ id, missingFields, invalidStatus: invalidStatus ? preparation.status : null }]
        : []
    }),
    (item) => item.id,
  )

  const duplicateRecords = sorted(
    [...grouped(exams, (exam) => [exam.sigla, exam.modalidade, normalize(exam.nome), normalize(exam.nome_usual)].join("|")).values()]
      .filter((group) => group.length > 1)
      .map((group) => ({ count: group.length, exam: examRef(group[0]) })),
    (item) => `${item.exam.modality}:${item.exam.code}`,
  )

  const sharedCodes = sorted(
    [...grouped(exams, (exam) => exam.sigla).entries()]
      .filter(([, group]) => group.length > 1)
      .map(([code, group]) => ({ code, exams: sorted(group.map(examRef), (item) => `${item.modality}:${item.name}`) })),
    (item) => item.code,
  )

  const duplicateNames = sorted(
    [...grouped(exams, (exam) => normalize(exam.nome)).entries()]
      .filter(([name, group]) => name && group.length > 1)
      .map(([normalizedName, group]) => ({
        normalizedName,
        exams: sorted(group.map(examRef), (item) => `${item.modality}:${item.code}`),
      })),
    (item) => item.normalizedName,
  )

  const usedPreparationIds = new Set(exams.map((exam) => exam.preparo_id))
  const orphanPreparations = sorted(
    Object.keys(preparations).filter((id) => !usedPreparationIds.has(id)),
  )

  const pendingAssociations = sorted(
    exams
      .filter((exam) => exam.association_review && exam.association_review.status !== "approved")
      .map((exam) => ({
        ...examRef(exam),
        status: exam.association_review.status,
        reason: exam.association_review.reason ?? null,
      })),
    (item) => `${item.modality}:${item.code}`,
  )

  const sourceConflictingNames = sorted(
    [...grouped(sourceRows, (row) => `${row.modality}:${row.code}`).entries()]
      .map(([key, group]) => {
        const names = [...new Set(group.map((row) => normalize(row.name)))].filter(Boolean)
        if (names.length <= 1) return null
        return {
          key,
          variants: sorted(group.map((row) => ({ line: row.line, name: row.name, commonName: row.commonName })), (item) => `${item.name}:${item.line}`),
        }
      })
      .filter(Boolean),
    (item) => item.key,
  )

  const sourceKeys = new Set(sourceRows.map((row) => `${row.modality}:${row.code}`))
  const generatedKeys = new Set(exams.map((exam) => `${exam.modalidade}:${exam.sigla}`))
  const missingGeneratedEntries = sorted([...sourceKeys].filter((key) => !generatedKeys.has(key)))
  const unexpectedGeneratedEntries = sorted([...generatedKeys].filter((key) => !sourceKeys.has(key)))

  const statusCoverage = { ok: 0, parcial: 0, pendente: 0, invalid: 0 }
  for (const exam of exams) {
    const status = preparations[exam.preparo_id]?.status
    if (status in statusCoverage) statusCoverage[status]++
    else statusCoverage.invalid++
  }

  const blocking = {
    invalidExams,
    invalidPreparations,
    missingPreparationReferences,
    duplicateRecords,
    missingGeneratedEntries,
    unexpectedGeneratedEntries,
  }
  const review = {
    sharedCodes,
    duplicateNames,
    orphanPreparations,
    pendingAssociations,
    sourceConflictingNames,
  }
  const countFindings = (sections) => Object.values(sections).reduce((total, items) => total + items.length, 0)

  return {
    schemaVersion: 1,
    inputs: ["docs-exames-udi-aghu.md", "data/exames.json", "data/preparos.json"],
    summary: {
      sourceRows: sourceRows.length,
      exams: exams.length,
      preparations: Object.keys(preparations).length,
      statusCoverage,
      blockingFindings: countFindings(blocking),
      reviewFindings: countFindings(review),
    },
    blocking,
    review,
    limitations: [
      "A auditoria detecta inconsistências estruturais; não valida correção clínica.",
      "Códigos e nomes compartilhados podem ser legítimos e exigem revisão da UDI.",
      "Status ok significa cadastro preenchido, não homologação clínica.",
    ],
  }
}

function markdownEscape(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ")
}

function summaryRows(report) {
  const rows = []
  for (const [name, items] of Object.entries(report.blocking)) rows.push(["Bloqueante", name, items.length])
  for (const [name, items] of Object.entries(report.review)) rows.push(["Revisão UDI", name, items.length])
  return rows
}

export function renderMarkdown(report) {
  const lines = [
    "# Auditoria do catálogo e da ingestão",
    "",
    "Relatório determinístico da Task 12 (PRO-10). Os achados de revisão não são erros clínicos confirmados.",
    "",
    "## Resumo",
    "",
    `- Linhas na fonte: ${report.summary.sourceRows}`,
    `- Exames gerados: ${report.summary.exams}`,
    `- Preparos cadastrados: ${report.summary.preparations}`,
    `- Achados bloqueantes: ${report.summary.blockingFindings}`,
    `- Itens para revisão da UDI: ${report.summary.reviewFindings}`,
    `- Cobertura por status: ${Object.entries(report.summary.statusCoverage).map(([key, value]) => `${key}=${value}`).join(", ")}`,
    "",
    "| Classificação | Regra | Quantidade |",
    "| --- | --- | ---: |",
    ...summaryRows(report).map((row) => `| ${row.map(markdownEscape).join(" | ")} |`),
    "",
    "## Achados bloqueantes",
    "",
    "O pipeline deve corrigir estes itens antes de considerar o catálogo estruturalmente íntegro.",
    "",
    "```json",
    JSON.stringify(report.blocking, null, 2),
    "```",
    "",
    "## Itens para revisão da UDI",
    "",
    "Estes itens podem ser legítimos. A equipe técnica apenas os identifica e não decide seu significado clínico.",
    "",
    "```json",
    JSON.stringify(report.review, null, 2),
    "```",
    "",
    "## Limitações",
    "",
    ...report.limitations.map((item) => `- ${item}`),
    "",
    "## Reprodução",
    "",
    "```bash",
    "pnpm audit:catalog",
    "pnpm audit:catalog:check",
    "```",
    "",
  ]
  return lines.join("\n")
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function runCli() {
  const exams = readJson(join(ROOT, "data", "exames.json"))
  const preparations = readJson(join(ROOT, "data", "preparos.json"))
  const sourceRows = parseSourceCatalog(readFileSync(join(ROOT, "docs-exames-udi-aghu.md"), "utf8"))
  const report = auditCatalog(exams, preparations, sourceRows)
  const json = `${JSON.stringify(report, null, 2)}\n`
  const markdown = renderMarkdown(report)

  if (process.argv.includes("--check")) {
    const currentJson = readFileSync(JSON_REPORT, "utf8")
    const currentMarkdown = readFileSync(MARKDOWN_REPORT, "utf8")
    if (currentJson !== json || currentMarkdown !== markdown) {
      console.error("Relatórios de auditoria desatualizados. Execute: pnpm audit:catalog")
      process.exitCode = 1
      return
    }
  } else {
    writeFileSync(JSON_REPORT, json)
    writeFileSync(MARKDOWN_REPORT, markdown)
  }

  console.log(
    `Auditoria: ${report.summary.exams} exames, ${report.summary.blockingFindings} achados bloqueantes, ${report.summary.reviewFindings} itens para revisão.`,
  )
  if (process.argv.includes("--strict") && report.summary.blockingFindings > 0) process.exitCode = 1
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(SCRIPT_PATH)) runCli()
