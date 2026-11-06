import { test, expect } from '@playwright/test'
import { openChat, ask, waitForReply } from './helpers'

test('região → modalidade → atributos preserva crânio sem fonte prematura', async ({page}) => {
  await openChat(page, 'patient')
  await ask(page, 'exame de crânio')
  const first = await waitForReply(page, 0)
  expect(first).toContain('Tomografia')
  expect(first).toContain('Ressonância magnética')
  expect(first).toContain('Raio-X')
  expect(first).not.toContain('preparo específico cadastrado')
  expect(first).not.toContain('FONTE')

  await ask(page, 'Tomografia')
  const second = await waitForReply(page, 1)
  expect(second.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()).toContain('cranio')
  expect(second).not.toContain('Qual destes aparece no seu pedido?')

  await ask(page, 'Sem contraste e sem sedação')
  const third = await waitForReply(page, 2)
  const normalized = third.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  expect(normalized).toContain('cranio')
  expect(normalized).not.toMatch(/torax|com sedacao|com contraste/)
})

test('escolha de RM preserva crânio e não reabre jejum não reconciliado', async ({page}) => {
  await openChat(page, 'patient')
  await ask(page, 'exame de crânio')
  await waitForReply(page, 0)
  await ask(page, 'Ressonância')
  await waitForReply(page, 1)
  await ask(page, 'Com contraste e sem sedação')
  const reply = await waitForReply(page, 2)
  expect(reply).toContain('não foi reconciliada')
  expect(reply).not.toMatch(/\b[48]\s*h|Polaramine/)
  expect(reply.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()).toContain('cranio')
})
