import { it, expect } from 'vitest'
import { conversationQuery } from './conversation-query'
import { generateMockResponse } from './mock-response'
import exams from '@/data/exames.json'
import { normalize } from './search'
import type { ChatMessage } from './types'
const history: ChatMessage[] = [{role:'user',content:'Vou fazer tomografia de tórax sem contraste. Qual o jejum?'},{role:'assistant',content:'O pedido informa com ou sem sedação?'}]
it('responde esclarecimento sem perder o exame nem repetir a pergunta', () => {
 const r=generateMockResponse('Sem sedação', 'patient', history)
 expect(r.sources.length).toBeGreaterThan(0)
 expect(r.sources.every(s=>exams.some(e=>e.nome===s.nome && /torax/.test(normalize(e.nome + ' ' + e.nome_usual)) && /sem contraste/.test(normalize(e.nome + ' ' + e.nome_usual)) && /sem sedacao/.test(normalize(e.nome + ' ' + e.nome_usual)) && !/com sedacao/.test(normalize(e.nome + ' ' + e.nome_usual))))).toBe(true)
 expect(r.reply).not.toContain('com ou sem sedação')
 expect(r.reply).toContain('cadastrado')
})
it('substitui contraste anterior em vez de somar qualificadores opostos', () => {
 const q=conversationQuery('Na verdade, com contraste',history)
 expect(q).toContain('com contraste');expect(q).not.toContain('sem contraste')
})
it('novo exame limpa contraste e sedação anteriores', () => {
 const r=generateMockResponse('Agora vou fazer mamografia. Qual o preparo?', 'patient', history)
 expect(r.sources.length).toBeGreaterThan(0)
 expect(r.sources.every(s=>/MAMOGRAFIA/.test(s.nome))).toBe(true)
})
it('não usa exame antigo para pedido explícito desconhecido nem assunto aleatório', () => {
 expect(conversationQuery('Vou fazer exame xyzq',history)).toBe('Vou fazer exame xyzq')
 expect(conversationQuery('dragão de komodo',history)).toBe('dragão de komodo')
})
it('preserva correção de variante nos turnos seguintes de documentos', () => {
 const h:ChatMessage[]=[...history,{role:'user',content:'Sem sedação'}]
 const r=generateMockResponse('E quais documentos levo?', 'patient',h)
 expect(r.sources.length).toBeGreaterThan(0)
 expect(r.sources.every(s=>!/COM SEDACAO/.test(s.nome))).toBe(true)
 expect(r.reply).toContain('Cartão do SUS')
})

it('não escolhe região quando esclarecimento de sedação ainda deixa RM genérica', () => {
 const r=generateMockResponse('Sem sedação', 'patient', [{role:'user',content:'Vou fazer ressonância. Qual o preparo?'}])
 expect(r.reply).toContain('região')
 expect(r.sources).toEqual([])
})
