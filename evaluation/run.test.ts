import { test, expect } from "vitest"
import { mkdirSync, writeFileSync, readFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { POST } from "@/app/api/chat/route"
import dataset from "./cases.json"
import exames from "@/data/exames.json"
import preparos from "@/data/preparos.json"
import { rules, expectedPreparos } from "./rules"

function normalized(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[*_`]/g, "").replace(/\s+/g, " ")
}

test("as regras detectam contradições e omissões representativas", () => {
  const contradiction = rules["GT-21"].find(r => r.label === "Não garante dispensa de preparo")!
  expect(new RegExp(contradiction.pattern).test(normalized("Não exige preparo especial"))).toBe(true)
  expect(new RegExp(contradiction.pattern).test(normalized("Não é necessário jejum"))).toBe(false)
  const dose = rules["GT-19"].find(r => r.forbidden)!
  expect(new RegExp(dose.pattern).test(normalized("Norfloxacino 400 mg"))).toBe(true)
  expect(new RegExp(dose.pattern).test(normalized("Confirme a dose com o médico"))).toBe(false)
  expect(dataset.cases).toHaveLength(32)
  expect(new Set(dataset.cases.map(c => c.id)).size).toBe(32)
  expect(dataset.cases.every(c => c.profile && c.question && c.expected && c.prohibited && rules[c.id])).toBe(true)
  expect(Object.values(expectedPreparos).every(id => id in preparos.preparos)).toBe(true)
})

test("registra os 32 casos pela API real sem navegador", async () => {
  const mode = process.env.EVAL_MODE ?? "fallback"
  if (!["fallback", "llm"].includes(mode)) throw new Error("EVAL_MODE deve ser fallback ou llm")
  const key = process.env.CLAUDE_API_KEY
  if (mode === "llm" && !key) throw new Error("Modo llm exige CLAUDE_API_KEY no ambiente")
  if (mode === "fallback") delete process.env.CLAUDE_API_KEY
  const results = []
  try {
    for (const c of dataset.cases) {
      const start = performance.now()
      const response = await POST(new Request("http://localhost/api/chat", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: c.question, profile: c.profile, history: c.history }),
      }))
      const body = await response.json()
      if (response.status !== 200 || typeof body.reply !== "string" || !Array.isArray(body.sources)) throw new Error(`${c.id}: resposta inválida da API`)
      if (mode === "llm" && body.mocked && !["medication-policy", "request-policy", "grounded-answer-policy"].includes(body.reason)) throw new Error(`${c.id}: IA indisponível; fallback não conta como avaliação LLM`)
      if (mode === "fallback" && body.mocked !== true) throw new Error(`${c.id}: caminho fallback não confirmado`)
      const text = normalized(body.reply)
      const checks = rules[c.id].map(r => ({ label: r.label, passed: new RegExp(r.pattern, "i").test(text) !== !!r.forbidden }))
      const recovered = body.sources.flatMap((source: { nome: string }) => exames.filter(e => e.nome === source.nome))
      const preparoIds = [...new Set(recovered.map((e: { preparo_id: string }) => e.preparo_id))]
      const expected = expectedPreparos[c.id]
      if (expected) checks.push({ label: `Fontes correspondem ao preparo ${expected}`, passed: preparoIds.length === 1 && preparoIds[0] === expected })
      if (c.profile === "patient") checks.push({ label: "Não expõe códigos nas fontes ou em campo de código", passed: body.sources.every((s: {sigla?: string}) => !s.sigla) && !/codigo\s*:/.test(text) })
      if (c.id === "GT-26") checks.push({ label: "Código AGHU corresponde ao exame nas fontes", passed: recovered.some((e: {sigla: string; preparo_id: string}) => e.preparo_id === expected && text.includes(`codigo: ${e.sigla.toLowerCase()}`)) })
      if (c.id === "GT-29") checks.push({ label: `Contagem atual ${exames.length}`, passed: new RegExp(`\\b${exames.length}\\b`).test(text) })
      const failedChecks = checks.filter(ch => !ch.passed).map(ch => ch.label)
      results.push({ id: c.id, question: c.question, profile: c.profile, history: c.history, validation: c.validation, expected: c.expected, prohibited: c.prohibited, reply: body.reply, sources: body.sources, recoveredPreparoIds: preparoIds, mocked: !!body.mocked, responsePath: body.reason ?? (body.mocked ? "fallback" : "llm"), durationMs: Math.round(performance.now() - start), checks, failedChecks, screening: failedChecks.length ? "needs-review" : "checks-passed" })
    }
  } finally {
    if (key === undefined) delete process.env.CLAUDE_API_KEY
    else process.env.CLAUDE_API_KEY = key
  }
  const hash = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex")
  const passed = results.filter(r => !r.failedChecks.length).length
  const report = { generatedAt: new Date().toISOString(), mode, commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), workingTree: execFileSync("git", ["status", "--short"], { encoding: "utf8" }).trim(), datasetSource: dataset.source, hashes: Object.fromEntries(["data/exames.json", "data/preparos.json", "evaluation/cases.json", "evaluation/rules.ts", "app/api/chat/route.ts", "lib/mock-response.ts", "lib/search.ts", "lib/aggregate.ts", "lib/answer-composer.ts", "lib/preparation-policy.ts", "lib/medication-policy.ts", "lib/request-policy.ts"].map(path => [path, hash(path)])), summary: { total: results.length, checksPassed: passed, needsReview: results.length - passed, clinicallyApproved: 0 }, results }
  mkdirSync("evaluation/reports", { recursive: true })
  writeFileSync(`evaluation/reports/${mode}.json`, JSON.stringify(report, null, 2) + "\n")
  const md = [`# Avaliação inicial do assistente UDI`, "", `Modo: ${mode}. Commit: ${report.commit}.`, "", `32 referências provisórias: ${passed} casos passaram pelas verificações objetivas e ${32 - passed} exigem revisão. Nenhum caso está homologado clinicamente por esta execução.`, "", "As verificações textuais são uma triagem: podem produzir falsos positivos ou negativos. Aprovação automática não comprova correção clínica, qualidade linguística ou fundamentação completa. Tempos são locais, sem medição de custo. IA não avaliada quando o modo é fallback.", "", "| Caso | Triagem | Verificações que falharam |", "|---|---|---|", ...results.map(r => `| ${r.id} | ${r.screening === "checks-passed" ? "Verificações passaram" : "Revisar"} | ${r.failedChecks.join("; ") || "—"} |`), "", "Respostas integrais, fontes, histórico de entrada, verificações e hashes estão no JSON ao lado."]
  writeFileSync(`evaluation/reports/${mode}.md`, md.join("\n") + "\n")
  console.log(`Triagem ${mode}: ${passed}/32 sem falhas objetivas; ${32 - passed}/32 para revisão. Relatórios: evaluation/reports/${mode}.{json,md}`)
  expect(results).toHaveLength(32)
  // Baseline intentionally records existing failures without treating them as an infrastructure error.
  if (process.env.EVAL_STRICT === "1") expect(results.filter(r => r.failedChecks.length).map(r => r.id)).toEqual([])
})
