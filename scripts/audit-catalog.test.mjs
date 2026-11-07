import { describe, expect, it } from "vitest"
import { auditCatalog, parseSourceCatalog, renderMarkdown } from "./audit-catalog.mjs"

const preparations = {
  preparos: {
    prep_ok: { titulo: "Preparo", status: "ok", orientacoes: "Orientação" },
    orphan: { titulo: "Sem exame", status: "pendente", orientacoes: "" },
  },
}

describe("auditoria do catálogo", () => {
  it("separa erros estruturais de itens para revisão", () => {
    const exams = [
      { sigla: "ABC", nome: "Exame A", nome_usual: "Exame A", modalidade: "mod_a", preparo_id: "prep_ok", sinonimos: [] },
      { sigla: "ABC", nome: "Exame B", nome_usual: "Exame B", modalidade: "mod_b", preparo_id: "ausente", sinonimos: [] },
    ]
    const source = [
      { line: 10, code: "ABC", name: "Exame A", commonName: "Exame A", modality: "mod_a" },
      { line: 11, code: "ABC", name: "Exame B", commonName: "Exame B", modality: "mod_b" },
    ]

    const report = auditCatalog(exams, preparations, source)

    expect(report.blocking.missingPreparationReferences).toHaveLength(1)
    expect(report.review.sharedCodes).toHaveLength(1)
    expect(report.review.orphanPreparations).toEqual(["orphan"])
    expect(report.summary.blockingFindings).toBe(1)
  })

  it("detecta nomes contraditórios na mesma chave da fonte", () => {
    const markdown = `## TOMOGRAFIA\n| Nome | Sigla | Nome usual | Sinônimo |\n| --- | --- | --- | --- |\n| Exame A | ABC | Exame A | |\n| Exame B | ABC | Exame B | |`
    const source = parseSourceCatalog(markdown)
    const exams = [
      { sigla: "ABC", nome: "Exame A", nome_usual: "Exame A", modalidade: "tomografia_computadorizada", preparo_id: "prep_ok", sinonimos: [] },
    ]

    const report = auditCatalog(exams, preparations, source)

    expect(report.review.sourceConflictingNames).toHaveLength(1)
    expect(report.review.sourceConflictingNames[0].variants).toHaveLength(2)
  })

  it("gera Markdown determinístico com instruções de reprodução", () => {
    const report = auditCatalog([], { preparos: {} }, [])
    const first = renderMarkdown(report)
    expect(renderMarkdown(report)).toBe(first)
    expect(first).toContain("pnpm audit:catalog:check")
  })
})
