import { normalize } from './search'
import { arrivalInstruction } from './preparation-policy'
import type { Exame, PreparosFile, Profile, Source } from './types'

const medication = /medica[cç]|comprimido|gotas|\bmg\b|tomar|utilizar luftal|simeticona|polaramine|norfloxacino|suspens|suspens|suspend|suspensa/i
export function safeSentences(text: string) {
  return text.split(/(?<=[.;])\s+/).filter(s => !medication.test(s))
}

export function composeAnswer(message: string, candidates: Exame[], data: PreparosFile, profile: Profile) {
  const q = normalize(message)
  // Specialized protocols must not be introduced by a generic query.
  const matched = candidates.filter(e => !/pre transplante/.test(normalize(e.nome)) || /transplante/.test(q))
  if (!matched.length) return null
  const sources: Source[] = matched.map(e => profile === 'professional' ? {nome:e.nome,sigla:e.sigla} : {nome:e.nome})
  const phoneMap = data.meta.orientacoes_gerais.telefones
  const phones = [...new Set(matched.map(e => /tomografia|ressonancia/.test(e.modalidade) ? phoneMap.tomografia_ressonancia : /ultrassonografia|densitometria/.test(e.modalidade) ? phoneMap.ultrassonografia_densitometria : /radiologia/.test(e.modalidade) ? phoneMap.raio_x_contrastado : phoneMap.imagem_geral))]
  const contact = `**Contato do setor:** ${phones.join('; ')}.`
  const ps = matched.map(e => data.preparos[e.preparo_id])
  const pending = ps.every(p => p?.status === 'pendente')
  const sedationUnknown = !/com sedacao|sem sedacao/.test(q) && matched.some(e => /com sedacao/.test(normalize(e.nome)))
  const contrastUnknown = !/com contraste|sem contraste/.test(q) && matched.some(e => /com contraste/.test(normalize(e.nome))) && matched.some(e => /sem contraste/.test(normalize(e.nome)))
  const different = new Set(matched.map(e => e.preparo_id)).size > 1
  if (pending) return {reply:`Não tenho o preparo específico cadastrado para informar ${/jeju/.test(q) ? 'o jejum deste exame' : 'as orientações deste exame'}. Isso não significa que o exame dispense preparo. Confirme com o setor antes do exame.${sedationUnknown ? '\n\nO pedido informa com ou sem sedação? Essa informação ajuda a identificar a variante.' : ''}\n\n${contact}`,sources}
  if (sedationUnknown || contrastUnknown || different) return {reply:`Preciso confirmar qual exame consta no pedido antes de detalhar o preparo. ${sedationUnknown ? 'É com ou sem sedação? ' : ''}${contrastUnknown ? 'É com ou sem contraste? ' : ''}${different ? 'Informe o nome completo e, quando aplicável, região e faixa etária.' : ''}\n\n${contact}`,sources}
  const p = ps[0]
  if (!p) return null
  const specificQuestion = /jeju|antecedencia|quanto tempo.*cheg|com quanto tempo/.test(q) && !/qual.*preparo|como.*prepar/.test(q)
  let sentences = safeSentences(p.orientacoes)
  if (specificQuestion) sentences = sentences.filter(s => /jeju|antecedencia/i.test(s))
  const arrival = arrivalInstruction([p.orientacoes])
  if (/cheg|antecedencia/.test(q) && !sentences.some(s => /antecedencia/.test(normalize(s)))) sentences.push(arrival)
  if (!sentences.length) sentences.push('Não tenho essa informação específica registrada. Confirme com o setor.')
  const blocks = [profile === 'patient' ? `Olá! Para **${(matched.length === 1 ? matched[0].nome_usual : p.titulo).toLowerCase()}**, estas são as informações cadastradas:` : `**${p.titulo}**`, sentences.map(s => /antecedência/i.test(s) ? `**Quando chegar:** ${s.replace(/^Comparecer/, 'Compareça')}` : /jejum/i.test(s) ? `**Jejum:** ${s}` : `- ${s}`).join('\n\n')]
  if (!specificQuestion && p.observacoes) blocks.push(safeSentences(p.observacoes).join(' '))
  if (medication.test(p.orientacoes + ' ' + (p.observacoes ?? '')) && !specificQuestion) blocks.push('**Medicamentos:** orientações sobre medicamentos precisam ser confirmadas com o médico ou com a UDI; não altere seu tratamento com base no chat.')
  if (p.status === 'parcial') blocks.push('O cadastro é parcial. Confirme com o setor as orientações não registradas.')
  if (profile === 'professional') blocks.push(matched.map(e => `${e.nome} (código: ${e.sigla})`).join('\n'))
  if (profile === 'patient') {
    blocks.push('**O que levar:**\n\n- Documento de identificação com foto\n- Cartão do SUS\n- Cartão do Hospital\n- Pedido médico original\n- Exames anteriores relacionados, se houver')
    if (!sentences.some(s => /antecedência/i.test(s))) blocks.push(`**Quando chegar:** ${arrival}`)
  }
  blocks.push(contact)
  if (profile === 'patient') blocks.push('Se tiver outra dúvida sobre o exame, pode perguntar. Estou à disposição!')
  return {reply:blocks.filter(Boolean).join('\n\n'), sources}
}
