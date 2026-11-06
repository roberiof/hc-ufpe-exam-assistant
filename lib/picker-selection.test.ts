import { test, expect } from "vitest"
import { POST } from "@/app/api/chat/route"
import exames from "@/data/exames.json"
import preparos from "@/data/preparos.json"
import { buildQuery } from "@/lib/exam-options"
import type { Exame } from "@/lib/types"

const all = exames as Exame[]
const P = (preparos as any).preparos
const ask = async (e: Exame) => {
  delete process.env.CLAUDE_API_KEY
  const r = await POST(new Request("http://x/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: buildQuery(e), profile: "patient", history: [], examSigla: e.sigla }) }))
  return r.json()
}

test("clique no seletor nunca devolve pergunta de esclarecimento nem perde o exame", async () => {
  const visible = all.filter((e) => P[e.preparo_id].status !== "pendente")
  const bad: string[] = []
  for (const e of visible) {
    const b = await ask(e)
    if (b.reason !== "picker-selection" || /qual regi[aã]o|qual destes|preciso confirmar qual exame/i.test(b.reply)) bad.push(e.nome)
  }
  expect(bad).toEqual([])
}, 120000)

test("sigla desconhecida cai no caminho antigo", async () => {
  const r = await POST(new Request("http://x/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "ultrassom de abdômen total", profile: "patient", history: [], examSigla: "NAOEXISTE" }) }))
  expect((await r.json()).reason).not.toBe("picker-selection")
})
