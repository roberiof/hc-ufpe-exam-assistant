import { describe, it, expect } from "vitest"
import { generateMockResponse } from "./mock-response"
import { arrivalInstruction, explicitlyNoPreparation } from "./preparation-policy"

describe("preparo e antecedência", () => {
  it("não infere ausência de preparo para densitometria", () => {
    expect(explicitlyNoPreparation("densitometria_ossea")).toBe(false)
    const result = generateMockResponse("Densitometria precisa de jejum? Com quanto tempo chego?", "patient")
    expect(result.reply).toContain("Não é necessário jejum")
    expect(result.reply).not.toContain("não exige preparo especial")
    expect(result.reply).not.toContain("30 minutos")
    expect(result.reply).toContain("uma hora")
  })
  it("sinaliza conflito entre orientações específicas", () => {
    expect(arrivalInstruction(["Chegar com uma hora de antecedência.", "Chegar com duas horas de antecedência."])).toContain("Confirme")
  })
})
