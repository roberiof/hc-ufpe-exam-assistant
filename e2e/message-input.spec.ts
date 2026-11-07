import { test, expect } from "@playwright/test"
import { openChat } from "./helpers"

test.describe("campo de mensagem", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ reply: "Resposta de teste.", sources: [] }),
      })
    })
  })

  test("cresce até o limite, ganha rolagem e volta à altura inicial", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openChat(page, "patient")

    const input = page.getByRole("textbox", { name: "Mensagem" })
    const initialBox = await input.boundingBox()
    expect(initialBox).not.toBeNull()

    await input.fill("linha 1\nlinha 2\nlinha 3")
    const expandedBox = await input.boundingBox()
    expect(expandedBox!.height).toBeGreaterThan(initialBox!.height)

    await input.fill(Array.from({ length: 20 }, (_, index) => `linha ${index + 1}`).join("\n"))
    const limitedBox = await input.boundingBox()
    expect(limitedBox!.height).toBeLessThanOrEqual(128)
    await expect(input).toHaveCSS("overflow-y", "auto")

    await page.getByLabel("Enviar mensagem").click()
    await expect(input).toHaveValue("")
    await expect.poll(async () => (await input.boundingBox())!.height).toBe(initialBox!.height)
    await expect(input).toHaveCSS("overflow-y", "hidden")
  })

  test("Shift+Enter cria linha e Enter envia", async ({ page }) => {
    await openChat(page, "patient")

    const input = page.getByRole("textbox", { name: "Mensagem" })
    await input.fill("primeira linha")
    await input.press("Shift+Enter")
    await input.type("segunda linha")
    await expect(input).toHaveValue("primeira linha\nsegunda linha")

    await input.press("Enter")
    await expect(input).toHaveValue("")
    const sentMessage = page.locator(".justify-end p").last()
    await expect(sentMessage).toContainText("primeira linha")
    await expect(sentMessage).toContainText("segunda linha")
    await expect(page.getByText("Resposta de teste.")).toBeVisible()
  })
})
