import { conversationQuery } from "./conversation-query"
import { composeAnswer } from "./answer-composer"
import examesData from "@/data/exames.json"
import preparosData from "@/data/preparos.json"
import { searchExames, normalize, examTargetQuery } from "@/lib/search"
import { stemQuery } from "@/lib/stem"
import { asksMedicationDecision, medicationReferral } from "@/lib/medication-policy"
import { deterministicIntent, wantsListaRaiox } from "@/lib/request-policy"
import { parseFilter, classifyPreparo } from "@/lib/aggregate"
import type { ChatMessage, Exame, PreparosFile, Profile, Source } from "@/lib/types"

const exames = examesData as Exame[]
const preparos = preparosData as PreparosFile

function phoneForModalidade(modalidade: string): string {
  const tel = preparos.meta.orientacoes_gerais.telefones
  if (/tomografia|ressonancia/.test(modalidade)) return tel.tomografia_ressonancia
  if (/ultrassonografia|densitometria/.test(modalidade)) return tel.ultrassonografia_densitometria
  if (/radiologia/.test(modalidade)) return tel.raio_x_contrastado
  return tel.imagem_geral
}

const fluxoRxRegex =
  /\bfluxo\b|\baghu\b|solicit|maqueir|tecnic|passo a passo|como pedir|como solicitar|pedir exame|realizacao do exame|in loco/

function wantsFluxoRaiox(query: string): boolean {
  const q = stemQuery(normalize(query))
  const mentionsRaiox = /\braio\s?x\b|\brx\b|radiologia/.test(q)
  return (mentionsRaiox && fluxoRxRegex.test(q)) || /\baghu\b|maqueir/.test(q)
}


/** Monta a lista de exames de raio-X com preparo a partir da base. */
function listaRaioxReply(): { reply: string; sources: Source[] } | null {
  const lista = exames.filter(
    (e) =>
      e.modalidade === "radiologia_convencional" &&
      e.preparo_id !== "radiologia_sem_preparo" &&
      preparos.preparos[e.preparo_id],
  )
  if (lista.length === 0) return null
  const reply =
    `**Exames de raio-X que exigem preparo**\n\n` +
    `Em radiologia convencional, apenas os exames de raio-X **contrastados** exigem preparo (o raio-X simples não exige). São eles:\n\n` +
    lista.map((e) => `- **${e.nome}**`).join("\n") +
    `\n\nPara o preparo detalhado de cada um, informe o exame desejado.`
  const sources: Source[] = lista.map((e) => ({ nome: e.nome }))
  return { reply, sources }
}

/** Monta a resposta do fluxo operacional de raio-X a partir da base. */
function fluxoReply(): { reply: string; sources: Source[] } | null {
  const fluxo = preparos.meta.fluxo_raiox
  if (!fluxo) return null
  const reply =
    `**${fluxo.titulo}**\n\n` +
    fluxo.passos.map((p) => p).join("\n") +
    `\n\n**Telefone do setor de Raio-X contrastado:** ${fluxo.telefone}`
  return { reply, sources: [{ nome: "Fluxo de solicitação Raio-X" }] }
}

/**
 * Gera uma resposta determinística (mock) a partir dos dados dos exames,
 * respeitando as regras de segurança clínica do HC-UFPE.
 * Usada como fallback quando a IA não está disponível.
 */
/** Resolve exame na mensagem; se follow-up sem exame, usa histórico recente. */
function resolveExames(message: string, history: ChatMessage[]): Exame[] {
  return searchExames(conversationQuery(message, history), exames)
}

function buildResponse(
  message: string,
  profile: Profile,
  history: ChatMessage[] = [],
): { reply: string; sources: Source[] } {
  const geral = preparos.meta.orientacoes_gerais
  const matched = resolveExames(message, history)
  if (asksMedicationDecision(message)) {
    const phones = [...new Set(matched.map(e => phoneForModalidade(e.modalidade)))]
    return {
      reply: medicationReferral + (matched.length && matched.every(e => preparos.preparos[e.preparo_id].status === "pendente") ? " O preparo específico ainda não está cadastrado na base." : "") + `\n\nContato para confirmar: ${phones.join("; ") || geral.telefones.imagem_geral}.`,
      sources: matched.map(e => profile === "professional" ? { nome: e.nome, sigla: e.sigla } : { nome: e.nome }),
    }
  }
  const intent = deterministicIntent(message) ?? (deterministicIntent(conversationQuery(message, history)) === "clarify" ? "clarify" : undefined)
  if (intent === 'missing') return {reply:'Não tenho um preparo específico cadastrado para um exame que não foi identificado no catálogo. Isso não significa que ele dispense preparo. Confirme com o setor antes do exame.\n\nContato para confirmar: ' + phoneForModalidade(parseFilter(message).modalidade ?? '') + '.', sources:[]}
  if (intent === 'attributes') return {reply:'A mensagem menciona atributos diferentes para o exame. O pedido informa com ou sem contraste e com ou sem sedação? Confirme a variante para evitarmos misturar orientações.', sources:[]}
  if (intent === "count") {
    const filter = parseFilter(message)
    const count = exames.filter(e => (!filter.modalidade || e.modalidade === filter.modalidade) && (!filter.need || classifyPreparo(e, preparos) === filter.need)).length
    return { reply: `Total de exames na base: ${exames.length}.` + (filter.modalidade || filter.need ? `\nNo filtro solicitado: ${count}. A classificação de preparo segue o cadastro atual; informação pendente não significa dispensa de preparo.` : ""), sources: [] }
  }
  if (intent === "clarify") return { reply: "Qual região do corpo será examinada? O pedido informa com ou sem contraste e com ou sem sedação? Confirme essas informações para identificarmos o exame antes de detalhar o preparo.", sources: [] }
  if (examTargetQuery(message) !== message && matched.length) return {
    reply: 'Sua dúvida envolve o intervalo entre um exame já realizado e o próximo exame. Não consigo confirmar pelo cadastro se esse intervalo permite realizar o próximo exame. Confirme com o setor antes da data marcada, informando qual exame fez, o contraste utilizado e as datas dos dois exames.\n\nContato para confirmar: ' + phoneForModalidade(matched[0].modalidade) + '.',
    sources: matched.map(e => ({ nome: e.nome, ...(profile === 'professional' ? {sigla:e.sigla} : {}) })),
  }
  if (intent === "documents") return {
    reply: '**O que levar:**\n\n- Documento de identificação com foto\n- Cartão do SUS\n- Cartão do Hospital\n- Pedido médico original\n- Exames anteriores relacionados, se houver\n\nEsta é a lista geral do cadastro. Documentos ou exames adicionais específicos devem ser confirmados com o setor.' +
      (matched.length ? '\n\nContato do setor: ' + phoneForModalidade(matched[0].modalidade) + '.' : ''),
    sources: matched.map(e => profile === "professional" ? { nome: e.nome, sigla: e.sigla } : { nome: e.nome }),
  }
  const fluxo = wantsFluxoRaiox(message) ? fluxoReply() : null

  // Pergunta-lista ("quais exames de raio-X exigem preparo?"): responde a lista.
  if (wantsListaRaiox(message)) {
    const lista = listaRaioxReply()
    if (lista) return lista
  }

  // Pergunta de fluxo sem exame específico: responde só o fluxo.
  if (fluxo && matched.length === 0) {
    return fluxo
  }

  if (matched.length === 0) {
    const reply =
      profile === "professional"
        ? "Não consegui identificar o exame na sua solicitação. Informe o nome do exame (ex.: tomografia de tórax, ressonância de abdômen, ultrassonografia de abdômen) para que eu retorne o protocolo de preparo correspondente. Se você tem apenas o código AGHU, informe-o que retorno o nome do exame.\n\n" +
          `Em caso de dúvida sobre o cadastro, contato da Imagem Geral: ${geral.telefones.imagem_geral}.`
        : "Não localizei um exame compatível com o nome e os atributos informados. Confira o nome completo no pedido; se ele estiver correto, confirme as orientações com o setor. Exemplos de exames do catálogo: tomografia de tórax, ressonância de abdômen, ultrassonografia, mamografia, raio-X, densitometria.\n\n" +
          `Se preferir, ligue para a Imagem Geral do HC-UFPE: ${geral.telefones.imagem_geral}.`
    return { reply, sources: [] }
  }

  const composed = composeAnswer(conversationQuery(message, history), matched, preparos, profile, message)
  if (composed) return fluxo ? { reply: composed.reply + "\n\n" + fluxo.reply, sources: [...composed.sources, ...fluxo.sources] } : composed
  return {reply: "Não consegui identificar uma orientação compatível. Confirme o nome completo do exame com a UDI.", sources: []}
}

/** Keep the conversational tone independent of factual response construction. */
export function generateMockResponse(message: string, profile: Profile, history: ChatMessage[] = []) {
  const result = buildResponse(message, profile, history)
  if (profile !== "patient") return result
  let reply = result.reply
  if (history.length && reply.startsWith("Olá! ")) reply = reply.slice(5)
  if (!history.length && !reply.startsWith("Olá!")) reply = "Olá!\n\n" + reply
  if (!reply.includes("Estou à disposição!")) reply += "\n\nSe tiver outra dúvida sobre o exame, pode perguntar. Estou à disposição!"
  return { ...result, reply }
}
