import { it, expect } from "vitest"
import { deterministicIntent } from "./request-policy"
import { generateMockResponse } from "./mock-response"
import { wantsAggregateCount } from "./aggregate"
import exames from "@/data/exames.json"

it("distingue horas de jejum de contagem do catálogo", () => {
  expect(wantsAggregateCount("Ressonância de abdômen com contraste, jejum de quanto tempo?")).toBe(false)
  expect(wantsAggregateCount("Quantas horas de jejum para tomografia?")).toBe(false)
  expect(wantsAggregateCount("Quantos exames há na base?")).toBe(true)
  expect(generateMockResponse("Quantos exames há na base?", "professional").reply).toContain(String(exames.length))
})
it("esclarece RM genérica sem indicar horas", () => {
  expect(deterministicIntent("Vou fazer ressonância. Precisa de jejum?")).toBe("clarify")
  const result = generateMockResponse("Vou fazer ressonância. Precisa de jejum?", "patient")
  expect(result.reply).toContain("região")
  expect(result.reply).not.toMatch(/\d/)
  expect(result.sources).toEqual([])
})
it("responde documentos gerais sem exigir nome do exame", () => {
  expect(generateMockResponse("Que documentos preciso levar para meu exame?", "patient").reply).toContain("Cartão do SUS")
})
