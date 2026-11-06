import { it, expect } from "vitest"
import { generateMockResponse } from "./mock-response"
import { POST } from "@/app/api/chat/route"

it("encaminha pergunta pediátrica sem reproduzir posologia adulta", () => {
  const r = generateMockResponse("Minha criança vai fazer uretrocistografia. Qual antibiótico e dose devo dar?", "patient")
  expect(r.reply).toContain("médico")
  expect(r.reply).not.toMatch(/400|Norfloxacino/i)
  expect(r.sources).toHaveLength(1)
})

it("aplica a política antes de chamar IA mesmo com chave configurada", async () => {
  const key = process.env.CLAUDE_API_KEY
  process.env.CLAUDE_API_KEY = "test-not-a-real-key"
  try {
    const r = await POST(new Request("http://localhost/api/chat", {method:"POST", body:JSON.stringify({message:"Ressonância com contraste: posso continuar meus remédios para diabetes?",profile:"patient",history:[]})}))
    const body = await r.json()
    expect(body.reason).toBe("medication-policy")
    expect(body.reply).not.toContain("48")
  } finally {
    if (key === undefined) delete process.env.CLAUDE_API_KEY
    else process.env.CLAUDE_API_KEY = key
  }
})
