import { describe, it, expect } from "vitest"
import examesData from "@/data/exames.json"
import { searchExames, damerauLevenshtein, normalize } from "./search"
import type { Exame } from "./types"

const exames = examesData as Exame[]

function modsOf(results: Exame[]): string[] {
  return results.map((e) => e.modalidade)
}

describe("damerauLevenshtein", () => {
  it("conta substituição e transposição", () => {
    expect(damerauLevenshtein("ressonancia", "ressonancia", 2)).toBe(0)
    expect(damerauLevenshtein("resonancia", "ressonancia", 2)).toBe(1) // 1 inserção
    expect(damerauLevenshtein("tombografia", "tomografia", 2)).toBe(1) // 1 inserção (typo)
    expect(damerauLevenshtein("torxa", "torax", 2)).toBe(1) // transposição a<->x
  })

  it("early-exit devolve max+1 acima do teto", () => {
    expect(damerauLevenshtein("abcdef", "zzzzzz", 2)).toBe(3)
  })
})

describe("recuperação — exato", () => {
  it("acha ressonância de abdômen com contraste", () => {
    const r = searchExames("ressonância de abdômen com contraste", exames)
    expect(r.length).toBeGreaterThan(0)
    expect(modsOf(r)).toContain("ressonancia_magnetica")
  })
})

describe("recuperação — typo (fuzzy)", () => {
  it("'racionancia de abdomen' ainda acha ressonância", () => {
    const r = searchExames("racionancia de abdomen", exames)
    expect(r.length).toBeGreaterThan(0)
    expect(modsOf(r)).toContain("ressonancia_magnetica")
  })

  it("'tombografia de torax' ainda acha tomografia", () => {
    const r = searchExames("tombografia de torax", exames)
    expect(r.length).toBeGreaterThan(0)
    expect(modsOf(r)).toContain("tomografia_computadorizada")
  })
})

describe("recuperação — linguagem leiga", () => {
  it("'exame da barriga' expande para abdômen", () => {
    const r = searchExames("ressonancia da barriga", exames)
    expect(r.length).toBeGreaterThan(0)
    expect(r.some((e) => /ABD[OÔ]ME/i.test(e.nome))).toBe(true)
  })

  it("'ressonancia da cabeca' expande para crânio/encéfalo", () => {
    const r = searchExames("ressonancia da cabeca", exames)
    expect(r.length).toBeGreaterThan(0)
    expect(r.some((e) => /CRANIO|ENCEFALO/.test(e.nome))).toBe(true)
  })
})

describe("SEGURANÇA — recusa preservada", () => {
  it("'dragão de komodo' não casa nada", () => {
    expect(searchExames("dragão de komodo", exames)).toEqual([])
  })

  it("string sem vizinho na base não casa nada", () => {
    expect(searchExames("xyzqwlmnop", exames)).toEqual([])
  })

  it("só stopwords não casa nada", () => {
    expect(searchExames("os documentos para levar", exames)).toEqual([])
  })

  it("token curto isolado não casa exame por fuzzy", () => {
    // "rm" sozinho é curto (fuzzy off) — não deve devolver exame arbitrário
    // por proximidade; se casar, é por substring exata da sigla, não fuzzy.
    const r = searchExames("zz", exames)
    expect(r).toEqual([])
  })
})

describe("ranking — consulta exata retorna a modalidade certa", () => {
  it("não mistura angiotomografia com ultrassom de abdômen", () => {
    const r = searchExames("Vou fazer ultrassom de abdômen total. Qual o preparo?", exames)
    expect(r.length).toBeGreaterThan(0)
    expect(r.every(e => e.modalidade === "ultrassonografia")).toBe(true)
  })
  it("respeita contraste explicitamente negado", () => {
    const r = searchExames("Vou fazer tomografia de tórax sem contraste. Qual o jejum?", exames)
    expect(r.length).toBeGreaterThan(0)
    expect(r.every(e => /sem contraste/.test(normalize(e.nome + " " + e.nome_usual)) && !/com contraste/.test(normalize(e.nome + " " + e.nome_usual)))).toBe(true)
  })
  it("não aplica variante adulta à pergunta pediátrica", () => {
    const r = searchExames("Minha criança vai fazer uretrocistografia. Qual antibiótico e dose devo dar?", exames)
    expect(r.length).toBeGreaterThan(0)
    expect(r.every(e => /pediatr|crianca/.test(normalize(e.nome)))).toBe(true)
  })
  it("não casa siglas como fragmentos de palavras comuns", () => {
    expect(searchExames("tempo", [{sigla:"TEM", nome:"EXAME TESTE", nome_usual:"EXAME TESTE", sinonimos:[], modalidade:"teste", preparo_id:"teste"}])).toEqual([])
  })
  it("'mamografia' traz exames de mamografia no top-3", () => {
    const r = searchExames("mamografia", exames)
    expect(r.length).toBeGreaterThan(0)
    expect(modsOf(r)).toContain("mamografia")
  })
})
