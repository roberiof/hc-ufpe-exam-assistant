import { test, expect } from '@playwright/test'
import { openChat, ask, waitForReply } from './helpers'

test('abdômen total exibe bexiga cheia e trechos com validação pendente', async ({page}) => {
 await openChat(page,'patient')
 await ask(page,'Vou fazer ultrassom de abdômen total. Qual o preparo?')
 const reply=await waitForReply(page,0)
 expect(reply).toContain('bexiga cheia')
 expect(reply).not.toContain('40 gotas')
 await page.getByText('Informações e trechos de origem — validação UDI pendente',{exact:true}).click()
 await expect(page.getByText('Orientações exames.docx — parágrafos 34–35',{exact:true})).toBeVisible()
 await expect(page.getByText('Trecho localizado; protocolo ainda não homologado pela UDI.').first()).toBeVisible()
})
