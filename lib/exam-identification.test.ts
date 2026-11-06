import { describe, expect, it } from 'vitest'
import exames from '@/data/exames.json'
import { generateMockResponse } from './mock-response'
import { searchExames, normalize, examTargetQuery } from './search'
import { wantsListaRaiox } from './request-policy'
import { POST } from '@/app/api/chat/route'

const answer = (message: string) => generateMockResponse(message, 'patient')

describe('regressões observadas na comparação prática', () => {
  it.each([
    ['Vou fazer ultrassom transvaginal. Qual o preparo?', /transvaginal/, /urinario/],
    ['Vou fazer histerossalpingografia. Uso DIU. Posso fazer o exame?', /histerossalpingografia/, /coluna/],
    ['Vou fazer ressonância de crânio sem contraste e sem sedação. Quais documentos e exames devo levar?', /cranio/, /punho|coxa/],
    ['Vou fazer ultrassonografia de abdomem totall. Qual o preparo?', /abdomen total/, /superior|doppler|transplante/],
  ])('preserva identidade em %s', (question, required, forbidden) => {
    const result = searchExames(question, exames)
    expect(result.length).toBeGreaterThan(0)
    for (const e of result) {
      const name = normalize(e.nome + ' ' + e.nome_usual)
      expect(name).toMatch(required)
      expect(name).not.toMatch(forbidden)
    }
  })

  it('esclarece ultrassom de barriga com opções sem introduzir parede ou Doppler', () => {
    const r = answer('Vou fazer ultrassom da barriga. Qual o preparo?')
    expect(r.reply).toContain('Qual delas consta no pedido?')
    expect(r.sources).toHaveLength(2)
    expect(r.reply).not.toMatch(/parede|doppler|urinario/i)
  })

  it('não escolhe exame arbitrário quando usuário diz que não está na lista', () => {
    const r = answer('Meu exame de ultrassom não está na lista. Posso ir sem preparo?')
    expect(r.sources).toEqual([])
    expect(r.reply).toContain('não significa que ele dispense preparo')
    expect(r.reply).toContain('3884')
  })

  it('esclarece atributos contraditórios sem escolher silenciosamente', () => {
    const message = 'Tomografia de tórax com contraste e sem contraste. Qual o preparo?'
    expect(searchExames(message, exames)).toEqual([])
    expect(answer(message).reply).toContain('atributos diferentes')
    expect(answer(message).sources).toEqual([])
  })

  it('não transforma pedido específico de RX em listagem', () => {
    const question = 'Vou fazer raio-X de tórax simples. Precisa de preparo?'
    expect(wantsListaRaiox(question)).toBe(false)
    expect(wantsListaRaiox('Quais exames de raio-X exigem preparo?')).toBe(true)
    const r = answer(question)
    expect(r.reply).not.toMatch(/São eles|HISTEROSSALPINGOGRAFIA|Exames de raio-X que exigem/)
    expect(r.sources.length).toBeGreaterThan(0)
    expect(r.sources.every(s => /torax/.test(normalize(s.nome)))).toBe(true)
    expect(r.sources.every(s => !/abdomen|fluoroscop|cateter/.test(normalize(s.nome)))).toBe(true)
    expect(r.reply).not.toContain('AGHU')
  })

  it('mantém documentos como intenção apesar de contraste e sedação', () => {
    const r = answer('Vou fazer ressonância de crânio sem contraste e sem sedação. Quais documentos e exames devo levar?')
    expect(r.reply).toContain('Cartão do SUS')
    expect(r.reply).not.toMatch(/AGHU|APAC|jejum|punho|coxa/i)
    expect((r.reply.match(/Cartão do SUS/g) || [])).toHaveLength(1)
  })

  it('não confunde uma condição pessoal com outro exame futuro', () => {
    const message = 'Fiz tomografia com contraste e tenho alergia. Qual o cuidado?'
    expect(examTargetQuery(message)).toBe(message)
  })

  it('distingue exame anterior de exame-alvo sem autorizar intervalo', () => {
    const r = answer('Fiz tomografia com contraste ontem e tenho densitometria amanhã. Posso fazer?')
    expect(r.reply).toContain('intervalo')
    expect(r.reply).toContain('3884')
    expect(r.reply).not.toMatch(/Não consegui identificar|Não localizei|48h|pode realizar/i)
    expect(r.sources.length).toBeGreaterThan(0)
    expect(r.sources.every(s => exames.some(e => e.nome === s.nome && e.modalidade === 'densitometria_ossea'))).toBe(true)
    expect(searchExames('Vou fazer tomografia e ressonância. Qual o preparo?', exames)).toEqual([])
  })

  it('não exibe jejuns concorrentes nem confirma condição de RM sem fonte reconciliada', () => {
    const r = generateMockResponse('Sem sedação.', 'patient', [
      {role:'user', content:'Vou fazer ressonância de abdômen com contraste. Qual o jejum?'},
      {role:'assistant', content:'É com ou sem sedação?'},
    ])
    expect(r.reply).toContain('não foi reconciliada')
    expect(r.reply).toContain('3873')
    expect(r.reply).not.toMatch(/\b[48]\s*h|Polaramine|tomar a medicação/)
    expect(r.sources.length).toBeGreaterThan(0)
    expect(r.sources.every(s => /abdome/.test(normalize(s.nome)))).toBe(true)
    expect(r.sources.every(s => !/angio|entero|hepatoespecific|primovist/i.test(s.nome))).toBe(true)
  })

  it('responde à pergunta de bexiga sem transformar ausência em dispensa', () => {
    const r = answer('Vou fazer ultrassom de abdômen superior. Preciso estar de bexiga cheia?')
    expect(r.reply).toContain('Não tenho uma orientação específica sobre bexiga')
    expect(r.reply).not.toMatch(/não precisa|dispensa preparo|Jejum de 4 a 6h/)
  })

  it('recupera restrição de DIU com encaminhamento sem autorização individual', () => {
    const r = answer('Vou fazer histerossalpingografia. Uso DIU. Posso fazer o exame?')
    expect(r.reply).toContain('restrição')
    expect(r.reply).toContain('não pode autorizar')
    expect(r.reply).toContain('3872')
    expect(r.reply).not.toMatch(/coluna|nome completo|comprimido|gotas/i)
  })

  it.each([
    'Vou fazer raio-X de tórax simples. Precisa de preparo?',
    'Vou fazer ressonância de crânio sem contraste e sem sedação. Quais documentos e exames devo levar?',
  ])('aplica a mesma política com chave configurada: %s', async message => {
    const original = process.env.CLAUDE_API_KEY
    process.env.CLAUDE_API_KEY = 'invalid-key-must-not-be-used'
    try {
      const response = await POST(new Request('http://localhost/api/chat', {method:'POST', body:JSON.stringify({message, profile:'patient', history:[]})}))
      const result = await response.json()
      expect(response.status).toBe(200)
      expect(result.reason).toMatch(/grounded-answer-policy|request-policy/)
      expect(result.reply).toBe(answer(message).reply)
    } finally {
      if (original === undefined) delete process.env.CLAUDE_API_KEY
      else process.env.CLAUDE_API_KEY = original
    }
  })
})
