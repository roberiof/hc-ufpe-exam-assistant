import { test, expect } from '@playwright/test'
import { openChat, ask, waitForReply } from './helpers'

test('paciente recebe orientação clara sem painel técnico', async ({page}) => {
 await openChat(page,'patient')
 await ask(page,'Vou fazer ultrassom de abdômen total. Qual o preparo?')
 const reply=await waitForReply(page,0)
 expect(reply).toContain('bexiga cheia')
 expect(reply).toContain('confirmadas pela equipe do hospital')
 expect(reply).not.toContain('40 gotas')
 await expect(page.getByText('Informações e trechos de origem — validação UDI pendente',{exact:true})).toHaveCount(0)
 await expect(page.getByText(/Orientações exames.docx — parágrafos/)).toHaveCount(0)
})

test('profissional pode expandir evidência com validação pendente', async ({page}) => {
 await openChat(page,'professional')
 await ask(page,'Vou fazer ultrassom de abdômen total. Qual o preparo?')
 const reply=await waitForReply(page,0)
 expect(reply).toContain('bexiga cheia')
 await page.getByText('Informações e trechos de origem — validação UDI pendente',{exact:true}).click()
 await expect(page.getByText('Orientações exames.docx — parágrafos 34–35',{exact:true})).toBeVisible()
 await expect(page.getByText('Trecho localizado; protocolo ainda não homologado pela UDI.').first()).toBeVisible()
})
