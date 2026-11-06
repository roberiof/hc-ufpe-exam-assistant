import { it, expect } from 'vitest'
import { generateMockResponse } from './mock-response'
import { POST } from '@/app/api/chat/route'

it('abdômen tem uma orientação, sem variante pré-transplante nem dose', () => {
 const r=generateMockResponse('Vou fazer ultrassom de abdômen total. Qual o preparo?', 'patient')
 expect(r.sources.some(s=>/transplante/i.test(s.nome))).toBe(false)
 expect((r.reply.match(/Jejum de 4 a 6h/g)||[])).toHaveLength(1)
 expect(r.reply).not.toMatch(/40 gotas|simeticona|Luftal/i)
 expect(r.reply).toContain('medicamentos')
})
it('densitometria responde apenas jejum e chegada, uma vez', () => {
 const r=generateMockResponse('Densitometria precisa de jejum? Com quanto tempo chego?', 'patient')
 expect((r.reply.match(/Não é necessário jejum/g)||[])).toHaveLength(1)
 expect((r.reply.match(/uma hora/g)||[])).toHaveLength(1)
 expect(r.reply).not.toMatch(/suspens|suspend|cálcio|30 minutos|48h/i)
})
it('TC desconhecida não inventa jejum e explicita sedação', () => {
 const r=generateMockResponse('Vou fazer tomografia de tórax sem contraste. Qual o jejum?', 'patient')
 expect(r.reply).toContain('cadastrado')
 expect(r.reply).toContain('com ou sem sedação')
 expect(r.reply).not.toMatch(/NÃO presuma|[0-9]+\s*h/)
})
it('com chave mantém renderização restrita sem chamar o modelo', async () => {
 const old=process.env.CLAUDE_API_KEY; process.env.CLAUDE_API_KEY='not-a-real-key'
 try {
 const r=await POST(new Request('http://localhost/api/chat',{method:'POST',body:JSON.stringify({message:'Densitometria precisa de jejum? Com quanto tempo chego?',profile:'patient',history:[]})}))
 const b=await r.json();expect(b.reason).toBe('grounded-answer-policy');expect(b.reply).not.toMatch(/cálcio|30 minutos/)
 } finally {if(old===undefined)delete process.env.CLAUDE_API_KEY;else process.env.CLAUDE_API_KEY=old}
})
