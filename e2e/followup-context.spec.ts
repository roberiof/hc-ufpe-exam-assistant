import { test, expect } from "@playwright/test"
import { openChat, ask, waitForReply, assistantBubbles } from "./helpers"

/**
 * Regressão do bug: um follow-up sem nome de exame ("me explique os documentos
 * para levar") não pode trocar o exame do contexto por um aleatório.
 * A recuperação deve herdar o exame do turno anterior.
 */
test.describe("follow-up herda contexto do exame", () => {
  test("pergunta de documentos mantém o exame do turno anterior", async ({ page }) => {
    await openChat(page, "patient")

    // Turno 1 — exame específico bem distinto (tórax).
    await ask(page, "Como me preparo para a tomografia de tórax com contraste?")
    const first = await waitForReply(page, 0)
    // Catalog spellings vary in accents; assert exam identity independently.
    const normalized = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    expect(normalized(first)).toContain("torax")

    // Turno 2 — follow-up genérico, sem citar exame.
    const before = await assistantBubbles(page).count()
    await ask(page, "me explique mais detalhado os documentos para levar")
    const second = await waitForReply(page, before)

    // Não pode ter surgido um exame não relacionado (ex.: o bug trazia pelve/endometriose).
    const lower = second.toLowerCase()
    expect(normalized(second)).toContain("torax")
    expect(normalized(second)).toContain("com contraste")
    expect(lower).not.toContain("endometriose")
    expect(lower).not.toContain("angioressonância")
    expect(lower).not.toContain("pelve")

    // Deve, sim, falar de documentos.
    expect(lower).toMatch(/documento|identidade|cart[aã]o|sus/)
  })
})
