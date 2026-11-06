import { factsForExam } from './documentary-evidence'
import { normalize } from './search'
import { arrivalInstruction } from './preparation-policy'
import type { Exame, PreparosFile, Profile, Source } from './types'

const medication = /medica[cç]|comprimido|gotas|\bmg\b|tomar|utilizar luftal|simeticona|polaramine|norfloxacino|suspens|suspens|suspend|suspensa/i
export function safeSentences(text: string) {
  return text.split(/(?<=[.;])\s+/).filter(s => !medication.test(s))
}

export function composeAnswer(message: string, candidates: Exame[], data: PreparosFile, profile: Profile, requestedMessage = message) {
  const q = normalize(message)
  const asked = /^(com|sem) (contraste|sedacao)[ .!]*$/.test(normalize(requestedMessage)) ? q : normalize(requestedMessage)
  // Specialized protocols must not be introduced by a generic query.
  const matched = candidates.filter(e => !/pre transplante/.test(normalize(e.nome)) || /transplante/.test(q))
  if (!matched.length) return null
  const sources: Source[] = matched.map(e => profile === 'professional' ? {nome:e.nome,sigla:e.sigla,evidenceStatus:'legacy-untraced'} : {nome:e.nome,evidenceStatus:'legacy-untraced'})
  const phoneMap = data.meta.orientacoes_gerais.telefones
  const phones = [...new Set(matched.map(e => /tomografia|ressonancia/.test(e.modalidade) ? phoneMap.tomografia_ressonancia : /ultrassonografia|densitometria/.test(e.modalidade) ? phoneMap.ultrassonografia_densitometria : /radiologia/.test(e.modalidade) ? phoneMap.raio_x_contrastado : phoneMap.imagem_geral))]
  const contact = `**Contato do setor:** ${phones.join('; ')}.`
  const ps = matched.map(e => data.preparos[e.preparo_id])
  const pending = ps.every(p => p?.status === 'pendente')
  const sedationUnknown = !/com sedacao|sem sedacao/.test(q) && matched.some(e => /com sedacao/.test(normalize(e.nome)))
  const contrastUnknown = !/com contraste|sem contraste/.test(q) && matched.some(e => /com contraste/.test(normalize(e.nome))) && matched.some(e => /sem contraste/.test(normalize(e.nome)))
  const options = [...new Set(matched.map(e => e.nome_usual))].map(name => `- ${name}`).join('\n')
  const different = new Set(matched.map(e => e.preparo_id)).size > 1
  if (pending && matched.some(exam => exam.association_review?.status === 'needs-review')) return {reply:'A associação deste procedimento com as orientações disponíveis ainda precisa de revisão. Não tenho um preparo específico documentado para apresentar com segurança; confirme com o setor antes do exame.\n\n' + contact,sources}
  if (pending) return {reply:`Não tenho o preparo específico cadastrado para informar ${/jeju/.test(q) ? 'o jejum deste exame' : 'as orientações deste exame'}. Isso não significa que o exame dispense preparo. Confirme com o setor antes do exame.${sedationUnknown ? '\n\nO pedido informa com ou sem sedação? Essa informação ajuda a identificar a variante.' : ''}\n\n${contact}`,sources}
  if (sedationUnknown || contrastUnknown || different) return {reply:`Preciso confirmar qual exame consta no pedido antes de detalhar o preparo. ${sedationUnknown ? 'É com ou sem sedação? ' : ''}${contrastUnknown ? 'É com ou sem contraste? ' : ''}${different ? 'Qual destes exames consta no pedido?\n\n' + options : ''}\n\n${contact}`,sources}
  const factSets = matched.map((exam, i) => factsForExam(exam, ps[i]))
  if (new Set(factSets.map(fs => fs.map(f => f.factId).sort().join(','))).size > 1) return {reply:'Encontrei variantes com informações diferentes. Qual delas consta no pedido?\n\n' + options + '\n\n' + contact,sources}
  const p = ps[0]
  if (!p) return null
  if (matched.some(e => e.preparo_id === 'rm_contraste') && /jeju|prepar/.test(asked)) return {
    reply: 'O cadastro herdado contém orientações de jejum que dependem do tipo de ressonância, mas a fonte dessas condições ainda não foi reconciliada. Não consigo confirmar o tempo de jejum aplicável ao seu exame. Confirme com o setor antes do exame, informando a região, o contraste e a sedação constantes no pedido.\n\n' + contact,
    sources,
  }
  if (/\bdiu\b/.test(asked) && matched.every(e => e.preparo_id === 'rx_histerossalpingografia')) return {
    reply: 'O cadastro registra uma restrição para histerossalpingografia em pessoas que usam DIU. Isso precisa ser confirmado pela equipe do hospital; o chat não pode autorizar a realização do exame. Se usa DIU, informe isso ao setor antes do exame.\n\n' + contact,
    sources,
  }
  const specificQuestion = /jeju|bexiga|antecedencia|quanto tempo.*cheg|com quanto tempo/.test(asked) && !/qual.*preparo|como.*prepar/.test(asked)
  const documented = !!p.fact_ids?.length
  let usedFacts = factSets[0] ?? []
  let sentences = documented ? usedFacts.map(f => f.text) : safeSentences(p.orientacoes)
  if (specificQuestion) {
    sentences = sentences.filter(s => (/jeju/.test(asked) && /jeju/i.test(s)) || (/bexiga/.test(asked) && /bexiga/i.test(s)) || (/cheg|antecedencia/.test(asked) && /antecedencia|chegar|comparecer/i.test(normalize(s))))
    usedFacts = usedFacts.filter(f => sentences.includes(f.text))
  }
  if (documented) sources.forEach((source,i) => {
    source.evidence = factSets[i].filter(f => usedFacts.some(used => used.factId === f.factId))
    source.evidenceStatus = source.evidence.length ? 'documentary-only' : 'legacy-untraced'
  })
  const arrival = arrivalInstruction([p.orientacoes])
  if (/cheg|antecedencia/.test(asked) && !sentences.some(s => /antecedencia|chegar ao servico/.test(normalize(s)))) sentences.push(arrival)
  if (!sentences.length) sentences.push(/bexiga/.test(asked) ? 'Não tenho uma orientação específica sobre bexiga cadastrada para este exame. Isso não permite concluir que esse cuidado seja dispensado. Confirme com o setor.' : 'Não tenho essa informação específica registrada. Confirme com o setor.')
  if (profile === 'patient') sentences = sentences.filter(s => !/aghu|apac|ubs|secretaria de saude/i.test(normalize(s)))
  const blocks = [profile === 'patient' ? `Olá! Para **${(matched.length === 1 ? matched[0].nome_usual : p.titulo).toLowerCase()}**, estas são as informações cadastradas:` : `**${p.titulo}**`, sentences.map(s => /antecedencia|chegar ao servico/i.test(normalize(s)) ? `**Quando chegar:** ${s.replace(/^Comparecer/, 'Compareça')}` : /jejum/i.test(s) ? `**Jejum:** ${s}` : `- ${s}`).join('\n\n')]
  if (!documented && !specificQuestion && p.observacoes) blocks.push(safeSentences(p.observacoes).filter(s => profile !== 'patient' || !/aghu|apac|ubs|secretaria de saude/.test(normalize(s))).join(' '))
  if (medication.test(p.orientacoes + ' ' + (p.observacoes ?? '')) && !specificQuestion) blocks.push('**Medicamentos:** orientações sobre medicamentos precisam ser confirmadas com o médico ou com a UDI; não altere seu tratamento com base no chat.')
  if (documented) blocks.push(profile === 'patient' ? '**Importante:** estas orientações ainda precisam ser confirmadas pela equipe do hospital e não representam o preparo completo. Confirme com o setor antes do exame, inclusive sobre medicamentos, se houver.' : '**Situação da informação:** trechos localizados no documento recebido, com validação da UDI pendente. Estas informações são parciais; confirme o preparo completo com o setor, inclusive orientações adicionais e sobre medicamentos, quando houver.')
  else if (p.status === 'parcial') blocks.push('O cadastro é parcial. Confirme com o setor as orientações não registradas.')
  else blocks.push('**Origem da informação:** cadastro herdado do projeto; a fonte documental deste conteúdo ainda não foi reconciliada.')
  if (profile === 'professional') blocks.push(matched.map(e => `${e.nome} (código: ${e.sigla})`).join('\n'))
  if (profile === 'patient') {
    blocks.push('**O que levar:**\n\n- Documento de identificação com foto\n- Cartão do SUS\n- Cartão do Hospital\n- Pedido médico original\n- Exames anteriores relacionados, se houver')
    if (!sentences.some(s => /antecedencia|chegar ao servico/i.test(normalize(s)))) blocks.push(`**Quando chegar:** ${arrival}`)
  }
  blocks.push(contact)
  if (profile === 'patient') blocks.push('Se tiver outra dúvida sobre o exame, pode perguntar. Estou à disposição!')
  return {reply:blocks.filter(Boolean).join('\n\n'), sources}
}
