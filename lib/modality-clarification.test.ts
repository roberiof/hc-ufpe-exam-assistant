import { expect, it } from 'vitest'
import exames from '@/data/exames.json'
import { examModalityChoices, normalize } from './search'
import { generateMockResponse } from './mock-response'
import { POST } from '@/app/api/chat/route'
import type { ChatMessage } from './types'

it.each(['exame de crânio', 'exame da cabeça', 'crânio', 'Qual o preparo do exame de crânio?', 'exame de crânio sem contraste e sem sedação'])('esclarece modalidade antes de preparo: %s', message => {
  const r = generateMockResponse(message, 'patient')
  expect(r.reply).toContain('Tomografia')
  expect(r.reply).toContain('Ressonância magnética')
  expect(r.reply).toContain('Raio-X')
  expect(r.reply).not.toMatch(/preparo específico cadastrado|com ou sem sedação|jejum de \d/i)
  expect(r.sources).toEqual([])
})

it.each(['exame de abdômen', 'exame de tórax', 'exame de joelho'])('generaliza regiões com mais de uma modalidade: %s', message => {
  expect(examModalityChoices(message, exames).length).toBeGreaterThan(1)
  expect(generateMockResponse(message, 'patient').reply).toContain('Qual destes aparece no seu pedido?')
})

it('não inventa opções para nome desconhecido, código ou modalidade explícita', () => {
  expect(examModalityChoices('dragão de komodo', exames)).toEqual([])
  expect(examModalityChoices('código TCCR1', exames)).toEqual([])
  expect(examModalityChoices('tomografia de crânio', exames)).toEqual([])
  expect(examModalityChoices('tenho dor de cabeça', exames)).toEqual([])
})

it('verifica modalidades no catálogo antes do corte top-3', () => {
  const catalog = [
    ...Array.from({length:5},(_,i) => ({sigla:`T${i}`,nome:'CRANIO',nome_usual:'TOMOGRAFIA CRANIO',sinonimos:[],modalidade:'tomografia_computadorizada',preparo_id:'tc_simples'})),
    {sigla:'R',nome:'CRANIO',nome_usual:'RESSONANCIA CRANIO',sinonimos:[],modalidade:'ressonancia_magnetica',preparo_id:'rm_simples'},
  ]
  expect(examModalityChoices('exame de crânio', catalog)).toEqual(['tomografia_computadorizada','ressonancia_magnetica'])
})

it('resposta curta escolhe modalidade mantendo região e continuação', () => {
  const h: ChatMessage[] = [{role:'user', content:'exame de crânio'}, {role:'assistant',content:'Qual tipo de exame consta no pedido?'}]
  const r = generateMockResponse('Tomografia', 'patient', h)
  expect(r.sources.length).toBeGreaterThan(0)
  expect(r.sources.every(s => /cranio/.test(normalize(s.nome)))).toBe(true)
  expect(r.reply).not.toContain('Qual destes aparece no seu pedido?')
  const next = generateMockResponse('Sem contraste e sem sedação', 'patient', [...h,{role:'user',content:'Tomografia'}])
  expect(next.sources.length).toBeGreaterThan(0)
  expect(next.sources.every(s => !/ouvido|seios|atm|orbita|sela/i.test(s.nome))).toBe(true)
  expect(next.sources.every(s => /cranio/.test(normalize(s.nome)) && !/com sedacao/.test(normalize(s.nome)))).toBe(true)
})

it('novo nome completo troca a região e modalidade anteriores', () => {
  const r = generateMockResponse('Agora vou fazer mamografia', 'patient', [{role:'user',content:'exame de crânio'}])
  expect(r.sources.length).toBeGreaterThan(0)
  expect(r.sources.every(s => /mamografia/i.test(s.nome))).toBe(true)
})

it('novo pedido anatômico não herda tomografia de conversa anterior', () => {
  const r = generateMockResponse('exame de crânio', 'patient', [{role:'user',content:'tomografia de tórax sem contraste'}])
  expect(r.reply).toContain('Qual destes aparece no seu pedido?')
  expect(r.sources).toEqual([])
})

it('documentos gerais não exigem escolher modalidade e não mostram fontes arbitrárias', () => {
  const r = generateMockResponse('Que documentos levo para exame de crânio?', 'patient')
  expect(r.reply).toContain('Cartão do SUS')
  expect(r.reply).not.toContain('Qual destes aparece no seu pedido?')
  expect(r.sources).toEqual([])
})

it('usa esclarecimento determinístico também com chave configurada', async () => {
  const old=process.env.CLAUDE_API_KEY;process.env.CLAUDE_API_KEY='must-not-call-model'
  try {
    const r=await POST(new Request('http://localhost/api/chat',{method:'POST',body:JSON.stringify({message:'exame de crânio',profile:'patient',history:[]})}))
    const b=await r.json()
    expect(b.reason).toBe('request-policy')
    expect(b.reply).toContain('Ressonância magnética')
    expect(b.sources).toEqual([])
  } finally { if(old===undefined)delete process.env.CLAUDE_API_KEY;else process.env.CLAUDE_API_KEY=old }
})

it('continuação de RM sem pergunta literal de preparo preserva bloqueio de jejum não reconciliado', () => {
  const r = generateMockResponse('Com contraste e sem sedação', 'patient', [
    {role:'user',content:'exame de crânio'}, {role:'user',content:'Ressonância'},
  ])
  expect(r.reply).toContain('não foi reconciliada')
  expect(r.reply).not.toMatch(/\b[48]\s*h|Polaramine|tomar a medicação/)
  expect(r.sources.every(s => /cranio/.test(normalize(s.nome)))).toBe(true)
})
