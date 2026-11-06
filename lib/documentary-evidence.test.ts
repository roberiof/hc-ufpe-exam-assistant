import { it, expect } from 'vitest'
import { generateMockResponse } from './mock-response'
import { factsForExam } from './documentary-evidence'
import registry from '@/data/documentary-evidence.json'
import exams from '@/data/exames.json'
import preparationData from '@/data/preparos.json'
import { composeAnswer } from './answer-composer'
import type { PreparosFile } from './types'
const preparations = preparationData as PreparosFile

it('corrige abdômen total com bexiga cheia e evidência por informação', () => {
 const r=generateMockResponse('Vou fazer ultrassom de abdômen total. Qual o preparo?', 'patient')
 expect(r.reply).toContain('bexiga cheia')
 expect(r.reply).toContain('Jejum de 4 a 6h')
 expect(r.reply).toContain('confirmadas pela equipe do hospital')
 const facts=r.sources.flatMap(s=>s.evidence??[])
 expect(facts.some(f=>f.factId==='us-full-abdomen-bladder' && f.locator==='parágrafos 34–35')).toBe(true)
 expect(facts.every(f=>f.validation==='pending-udi' && f.sourceHash.length===64)).toBe(true)
 expect(r.reply).not.toMatch(/40 gotas|simeticona|suspend/i)
})
it('não transfere bexiga cheia de total para superior nem mistura candidatos de fatos diferentes', () => {
 const e=exams.find(e=>e.sigla==='USABD')!
 const r=composeAnswer('Ultrassom abdominal superior', [e], preparations,'patient')!
 expect(r.reply).not.toContain('bexiga cheia')
 expect(r.sources.flatMap(s=>s.evidence??[]).map(f=>f.factId)).toEqual(['us-abdomen-fasting'])
 const both=composeAnswer('Ultrassom de abdômen', [e,exams.find(e=>e.sigla==='USABT')!], preparations,'patient')!
 expect(both.reply).toContain('nome completo')
 expect(both.reply).not.toContain('Jejum de')
})
it('Doppler renal tem o próprio trecho de jejum, sem virar preparo urinário', () => {
 const e=exams.find(e=>e.sigla==='USAR')!
 expect(e.preparo_id).toBe('us_doppler_arterias_renais')
 const r=composeAnswer('Doppler de artérias renais', [e], preparations,'patient')!
 expect(r.reply).toContain('8h')
 expect(r.reply).not.toContain('bexiga cheia')
 expect(r.sources[0].evidence?.[0].locator).toBe('parágrafos 24–25')
})
it('biópsias, transvaginal, parede abdominal e peça cirúrgica não herdam preparo genérico', () => {
 for(const code of ['BPGUS','USBI1','USBI6','USPTV','USTDC','USGPA']) {
  const e=exams.find(e=>e.sigla===code)!
  expect(e.preparo_id).toBe('us_pendente')
  expect(e.association_review!.status).toBe('needs-review')
  const r=composeAnswer(e.nome_usual,[e],preparations,'patient')!
  expect(r.reply).not.toMatch(/bexiga cheia|Jejum de/)
  expect(r.reply).toMatch(/confirme/i)
 }
 expect(exams.find(e=>e.sigla==='MAMPC')!.preparo_id).toBe('mamografia_pendente')
})
it('fatos existentes têm fonte, aplicação exata e nenhuma aprovação clínica implícita', () => {
 expect(new Set(registry.facts.map(f=>f.id)).size).toBe(registry.facts.length)
 for(const fact of registry.facts) {
  expect(fact.validation).toBe('pending-udi')
  expect(fact.quote.length).toBeGreaterThan(10)
  expect(fact.appliesTo.every(code=>exams.some(e=>e.sigla===code))).toBe(true)
 }
 for(const e of exams) {
  const p=preparations.preparos[e.preparo_id]
  const selected=factsForExam(e,p)
  expect(selected.every(f=>registry.facts.find(original=>original.id===f.factId)!.appliesTo.includes(e.sigla))).toBe(true)
 }
})
it('pergunta somente sobre jejum não atribui a uma fonte fato que não foi apresentado', () => {
 const e=exams.find(e=>e.sigla==='USABT')!
 const r=composeAnswer('Ultrassom de abdômen total, qual o jejum?', [e], preparations, 'patient')!
 expect(r.sources.flatMap(s=>s.evidence??[]).map(f=>f.factId)).toEqual(['us-abdomen-fasting'])
})

it('pedido genérico não recupera procedimentos especializados; pedido explícito mantém o encaminhamento', () => {
 const generic=generateMockResponse('Mamografia: posso passar desodorante?', 'patient')
 expect(generic.sources.some(s=>/PEÇA|PECA/.test(s.nome))).toBe(false)
 const e=exams.find(e=>e.sigla==='MAMPC')!
 const explicit=generateMockResponse(e.nome_usual, 'professional')
 expect(explicit.reply).not.toMatch(/Não utilizar desodorante|Não utilizar talco/)
 expect(explicit.reply).toMatch(/associação|confirme/i)
})
it('vias urinárias recupera o exame geral correto mesmo após retirar a associação de regulação', () => {
 const r=generateMockResponse('Meu ultrassom é de vias urinárias. Preciso chegar de bexiga cheia?', 'patient')
 expect(r.reply).toContain('bexiga cheia')
 expect(r.sources.every(s=>s.nome==='APARELHO URINÁRIO')).toBe(true)
 expect(r.sources.flatMap(s=>s.evidence??[]).some(f=>f.factId==='us-full-abdomen-bladder')).toBe(true)
})

it('muda a apresentação por perfil sem eliminar a evidência ou inventar validação', () => {
 const patient=generateMockResponse('Vou fazer ultrassom de abdômen total. Qual o preparo?', 'patient')
 const professional=generateMockResponse('Vou fazer ultrassom de abdômen total. Qual o preparo?', 'professional')
 expect(patient.reply).not.toMatch(/parágrafos|SHA-256|validação da UDI pendente/)
 expect(patient.reply).toContain('não representam o preparo completo')
 expect(professional.reply).toContain('validação da UDI pendente')
 expect(patient.sources.flatMap(s=>s.evidence??[])).toEqual(professional.sources.flatMap(s=>s.evidence??[]))
})
