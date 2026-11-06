import { readFileSync, writeFileSync } from "node:fs"
const before = JSON.parse(readFileSync("evaluation/reports/baseline-fallback.json", "utf8"))
const after = JSON.parse(readFileSync("evaluation/reports/fallback.json", "utf8"))
for (const path of ["evaluation/cases.json", "evaluation/rules.ts"]) {
  if (before.hashes[path] !== after.hashes[path]) throw new Error(`Referências/regras diferentes: ${path}; comparação direta inválida`)
}
const improved = [], regressed = [], unchanged = []
for (const old of before.results) {
  const current = after.results.find(r => r.id === old.id)
  if (!current) throw new Error(`Caso ausente: ${old.id}`)
  if (old.screening !== current.screening) (current.failedChecks.length ? regressed : improved).push(old.id)
  else unchanged.push(old.id)
}
const markdown = ["# Comparação com o baseline", "", `Modo: fallback. Referências e regras idênticas por SHA-256.`, "", `Casos sem falhas objetivas: ${before.summary.checksPassed}/32 → ${after.summary.checksPassed}/32.`, `Casos para revisão: ${before.summary.needsReview}/32 → ${after.summary.needsReview}/32.`, "", `Melhoraram na triagem: ${improved.join(", ") || "nenhum"}.`, `Regrediram na triagem: ${regressed.join(", ") || "nenhum"}.`, "", "Essa comparação não demonstra homologação clínica nem ausência de regressões fora das verificações cadastradas. O modelo de IA não foi avaliado. Os detalhes por verificação e as respostas completas estão nos relatórios JSON."]
writeFileSync("evaluation/reports/comparison.md", markdown.join("\n") + "\n")
console.log(markdown.join("\n"))
