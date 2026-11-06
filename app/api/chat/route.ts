import { createAnthropic } from "@ai-sdk/anthropic"
import { generateText } from "ai"
import examesData from "@/data/exames.json"
import preparosData from "@/data/preparos.json"
import { searchExames, normalize } from "@/lib/search"
import { stemQuery } from "@/lib/stem"
import {
  wantsAggregateCount,
  wantsAggregateList,
  buildAggregateContext,
  buildListContext,
} from "@/lib/aggregate"
import { prettifyExamName } from "@/lib/exam-options"
import { generateMockResponse } from "@/lib/mock-response"
import { explicitlyNoPreparation } from "@/lib/preparation-policy"
import { asksMedicationDecision } from "@/lib/medication-policy"
import { deterministicIntent } from "@/lib/request-policy"
import type { ChatMessage, Exame, PreparosFile, Profile, Source } from "@/lib/types"

export const runtime = "nodejs"

const exames = examesData as Exame[]
const preparos = preparosData as PreparosFile

const SYSTEM_PROMPTS: Record<Profile, string> = {
  patient:
    "Você é um assistente da Unidade de Diagnóstico por Imagem (UDI) do HC-UFPE. " +
    "REGRA ABSOLUTA: responda SOMENTE com informações que estão escritas textualmente no CONTEXTO abaixo. Não use nenhum conhecimento externo. " +
    "Se o CONTEXTO indicar que nenhum exame foi identificado, responda APENAS: 'Este exame não está na minha base de dados. Por favor, confirme o nome do exame ou entre em contato com o setor.' Não forneça nenhum preparo, jejum, medicação ou orientação clínica que não esteja no CONTEXTO. " +
    "Se o CONTEXTO indicar STATUS PENDENTE, responda APENAS que o preparo ainda não está cadastrado e oriente a entrar em contato com o setor. Não invente preparo algum. " +
    "NUNCA mencione números de telefone, endereços ou contatos que não estejam escritos literalmente no CONTEXTO. Copie os números exatamente como aparecem no CONTEXTO, sem reformatar. " +
    "NUNCA dê diagnóstico, recomendação clínica ou invente dosagens, jejuns, medicações ou qualquer dado que não esteja no CONTEXTO. " +
    "NUNCA exiba códigos, siglas internas (ex.: RXHSG, TCABDC), identificadores de preparo ou rótulos técnicos internos do sistema. Refira-se aos exames apenas pelo NOME. " +
    "Use linguagem simples, clara e acolhedora.",
  professional:
    "Você é um assistente da UDI do HC-UFPE. " +
    "REGRA ABSOLUTA: responda SOMENTE com informações que estão escritas textualmente no CONTEXTO abaixo. Não use nenhum conhecimento externo. " +
    "Se o CONTEXTO indicar que nenhum exame foi identificado, responda APENAS: 'Este exame não está na base de dados da UDI. Confirme o nome do exame ou consulte o setor.' Não forneça nenhum protocolo, preparo ou orientação que não esteja no CONTEXTO. " +
    "Se o CONTEXTO indicar STATUS PENDENTE, informe apenas que o preparo específico não está cadastrado e indique o setor pelo contato que aparece literalmente no CONTEXTO. " +
    "NUNCA mencione números de telefone, endereços ou contatos que não estejam escritos literalmente no CONTEXTO. Copie os números exatamente como aparecem no CONTEXTO, sem reformatar. " +
    "NUNCA invente dosagens, horários, medicamentos, protocolos ou qualquer dado que não esteja no CONTEXTO. " +
    "CÓDIGO AGHU: para cada exame identificado, informe o código AGHU (sigla) EXATAMENTE como aparece no campo 'Código AGHU' do CONTEXTO, no formato 'Nome do exame (código: XXXX)'. Se o usuário informar um código, confirme o nome do exame correspondente e repita o código. NUNCA invente um código que não esteja escrito no CONTEXTO. Não exiba identificadores de preparo internos (ex.: tc_contraste). " +
    "Use linguagem técnica e operacional.",
}

// Resolve o(s) exame(s) da conversa. Busca na mensagem atual; se ela não
// identifica exame (ex.: follow-up "me explique os documentos para levar"),
// reutiliza o contexto das últimas mensagens do usuário.
function resolveExames(message: string, history: ChatMessage[]): Exame[] {
  const direct = searchExames(message, exames)
  if (direct.length > 0) return direct

  const lastUser = history
    .filter((m) => m.role === "user")
    .slice(-3)
    .map((m) => m.content)
    .join(" ")

  if (!lastUser) return []
  return searchExames(`${lastUser} ${message}`, exames)
}

// Detecta perguntas sobre o fluxo operacional de raio-X (solicitação, AGHU, etc.)
const FLUXO_RX_REGEX =
  /\bfluxo\b|\baghu\b|solicit|maqueir|tecnic|passo a passo|como pedir|como solicitar|pedir exame|realizacao do exame|in loco/

function wantsFluxoRaiox(query: string): boolean {
  const q = stemQuery(normalize(query))
  const mentionsRaiox = /\braio\s?x\b|\brx\b|radiologia/.test(q)
  // Fluxo se cita raio-X + termo de fluxo, ou cita explicitamente AGHU/maqueiro.
  return (
    (mentionsRaiox && FLUXO_RX_REGEX.test(q)) ||
    /\baghu\b|maqueir/.test(q)
  )
}

// Detecta perguntas que pedem a LISTA de exames de raio-X que exigem preparo.
function wantsListaRaiox(query: string): boolean {
  const q = stemQuery(normalize(query))
  const mentionsRaiox = /\braio\s?x\b|\brx\b|radiologia|contrastad/.test(q)
  const isListing =
    /\bquais\b|\bque\b|lista|listar|todos|quantos|relacao|exigem|precisam|necessitam|exige|precisa de preparo|tem preparo|com preparo/.test(
      q,
    )
  return mentionsRaiox && isListing
}

// Deriva da base os exames de raio-X (radiologia convencional) que têm preparo
// contrastado cadastrado — exclui o raio-X simples, que não exige preparo.
function raioxComPreparo(): Exame[] {
  return exames.filter((e) => {
    if (e.modalidade !== "radiologia_convencional") return false
    const preparo = preparos.preparos[e.preparo_id]
    // Apenas contrastados têm preparo; o raio-X simples usa "radiologia_sem_preparo".
    return preparo && e.preparo_id !== "radiologia_sem_preparo"
  })
}

// Remove fontes repetidas (mesma sigla) — ex.: exame aparece na busca e na lista.
function dedupeSources(sources: Source[]): Source[] {
  const seen = new Set<string>()
  return sources.filter((s) => {
    if (seen.has(s.nome)) return false
    seen.add(s.nome)
    return true
  })
}

function buildContext(
  query: string,
  matched: Exame[],
  includeFluxo: boolean,
  includeLista: boolean,
  includeAggregate: boolean,
  includeAggList: boolean,
  profile: Profile,
): { context: string; sources: Source[] } {
  const isPro = profile === "professional"
  const geral = preparos.meta.orientacoes_gerais
  const telefones = geral.telefones

  // Camada 1 — sempre presente
  let context = `### CAMADA 1 — ORIENTAÇÕES GERAIS (válidas para todos os exames)\n`
  context += `${geral.titulo}\n${geral.orientacoes}\n\n`
  context += `Telefones dos setores:\n`
  for (const [setor, tel] of Object.entries(telefones)) {
    context += `- ${setor.replace(/_/g, " ")}: ${tel}\n`
  }
  context += `\n`

  const sources: Source[] = []

  // CAMADA LISTA — exames de raio-X que exigem preparo (quando solicitado).
  const appendLista = () => {
    if (!includeLista) return
    const lista = raioxComPreparo()
    if (lista.length === 0) return
    context += `\n### CAMADA LISTA — EXAMES DE RAIO-X QUE EXIGEM PREPARO\n`
    context += `INSTRUÇÃO: O usuário perguntou QUAIS exames de raio-X exigem preparo. Liste EXATAMENTE os exames abaixo (e nenhum outro), pelo NOME do exame, deixando claro que, em radiologia convencional, APENAS os exames de raio-X CONTRASTADOS exigem preparo — o raio-X simples não exige. Não inclua exames de outras modalidades (TC, RM, US etc.).${isPro ? "" : " NÃO exiba códigos/siglas internos."}\n`
    for (const e of lista) {
      context += isPro ? `- ${e.nome} (código: ${e.sigla})\n` : `- ${e.nome}\n`
      sources.push(isPro ? { nome: e.nome, sigla: e.sigla } : { nome: e.nome })
    }
    context += `Total: ${lista.length} exames de raio-X contrastados com preparo.\n`
  }

  // CAMADA FLUXO — passo a passo operacional de raio-X (quando solicitado).
  const appendFluxo = () => {
    const fluxo = preparos.meta.fluxo_raiox
    if (!includeFluxo || !fluxo) return
    context += `\n### CAMADA FLUXO — ${fluxo.titulo}\n`
    context += `INSTRUÇÃO: O usuário perguntou sobre o fluxo de solicitação/realização. Reproduza os passos abaixo EXATAMENTE, como lista numerada, sem inventar etapas. Inclua o telefone do setor ao final.\n`
    for (const passo of fluxo.passos) {
      context += `${passo}\n`
    }
    context += `Telefone do setor de Raio-X contrastado: ${fluxo.telefone}\n`
    sources.push({ nome: "Fluxo de solicitação Raio-X" })
  }

  // CAMADA AGREGAÇÃO — contagem sobre a base inteira (quando solicitado).
  const appendAggregate = () => {
    if (!includeAggregate) return
    context += buildAggregateContext(query, exames, preparos)
  }

  // CAMADA LISTAGEM — lista filtrada da base, limitada (quando solicitado).
  const appendAggList = () => {
    if (!includeAggList) return
    const { context: listCtx, matched: listed } = buildListContext(
      query,
      exames,
      preparos,
      profile,
    )
    context += listCtx
    for (const e of listed) {
      const nome = e.label_paciente ?? prettifyExamName(e.nome_usual)
      sources.push(isPro ? { nome, sigla: e.sigla } : { nome })
    }
  }

  if (matched.length === 0) {
    context += `### CAMADA 2 — PREPARO ESPECÍFICO\n`
    if (includeFluxo || includeLista || includeAggregate || includeAggList) {
      context += `Nenhum exame específico foi citado, mas há uma pergunta sobre fluxo operacional, contagem/listagem da base ou a lista de exames de raio-X (ver camadas abaixo).\n`
    } else {
      context += `⛔ EXAME NÃO ENCONTRADO NA BASE DE DADOS DA UDI.\n`
      context += `INSTRUÇÃO CRÍTICA E INVIOLÁVEL: Este exame NÃO existe na base de dados. Você NÃO tem nenhuma informação de preparo para ele. PROIBIDO fornecer qualquer orientação de preparo, jejum, medicação, contraindicação ou qualquer dado clínico — mesmo que você tenha esse conhecimento de outra fonte. Informe ao usuário que o exame não está cadastrado e peça que confirme o nome ou entre em contato com o setor.\n`
    }
    appendAggregate()
    appendAggList()
    appendLista()
    appendFluxo()
    return { context, sources: dedupeSources(sources) }
  }

  context += `### CAMADA 2 — PREPARO ESPECÍFICO DO(S) EXAME(S) IDENTIFICADO(S)\n`

  for (const exame of matched) {
    const preparo = preparos.preparos[exame.preparo_id]
    sources.push(isPro ? { nome: exame.nome, sigla: exame.sigla } : { nome: exame.nome })

    context += isPro
      ? `\n--- Exame: ${exame.nome} | Código AGHU: ${exame.sigla} | Modalidade: ${exame.modalidade} ---\n`
      : `\n--- Exame: ${exame.nome} | Modalidade: ${exame.modalidade} ---\n`
    context += `STATUS: ${preparo.status.toUpperCase()}\n`

    if (preparo.status === "pendente") {
      context += `INSTRUÇÃO OBRIGATÓRIA: Este preparo NÃO está cadastrado. NÃO diga que o exame dispensa preparo. Use exatamente esta orientação de fallback e informe o telefone:\n`
      context += `FALLBACK: ${preparo.fallback}\n`
    } else {
      context += `ORIENTAÇÕES (status ${preparo.status} — informação confirmada): ${preparo.orientacoes}\n`
      if (preparo.observacoes) {
        context += `OBSERVAÇÕES: ${preparo.observacoes}\n`
      }
      context += `REGRAS: Ausência de jejum não significa ausência de preparo. Orientação específica explícita prevalece sobre a geral no mesmo assunto. Status parcial exige informar que há lacunas e recomendar confirmação com o setor. Status ok indica cadastro preenchido, não homologação clínica.\n`
      if (preparo.status === "ok" && explicitlyNoPreparation(exame.preparo_id)) {
        context += `NOTA: Este exame COMPROVADAMENTE não exige preparo (informação confirmada na base). Deixe isso claro e tranquilo para o usuário — é diferente de "preparo não cadastrado".\n`
      }
    }
  }

  appendAggregate()
  appendAggList()
  appendLista()
  appendFluxo()
  return { context, sources: dedupeSources(sources) }
}

export async function POST(req: Request) {
  let fallbackMessage = ""
  let fallbackProfile: Profile = "patient"
  let fallbackHistory: ChatMessage[] = []
  try {
    const body = (await req.json()) as {
      message: string
      profile: Profile
      history: ChatMessage[]
    }

    const { message, profile = "patient", history = [] } = body
    fallbackMessage = message
    fallbackProfile = profile
    fallbackHistory = history

    if (!message || typeof message !== "string") {
      return Response.json({ error: "Mensagem inválida." }, { status: 400 })
    }

    if (asksMedicationDecision(message) || deterministicIntent(message)) {
      const result = generateMockResponse(message, profile, history)
      return Response.json({ reply: result.reply, sources: result.sources, mocked: true, reason: asksMedicationDecision(message) ? "medication-policy" : "request-policy" })
    }

    // Exam guidance uses the same constrained renderer with or without an AI key.
    if (resolveExames(message, history).length && !wantsAggregateList(message) && !wantsListaRaiox(message) && !wantsFluxoRaiox(message)) {
      const result = generateMockResponse(message, profile, history)
      return Response.json({ ...result, mocked: true, reason: "grounded-answer-policy" })
    }

    if (!process.env.CLAUDE_API_KEY) {
      // Sem chave configurada: usa resposta determinística a partir da base.
      const mock = generateMockResponse(message, profile, history)
      return Response.json({ reply: mock.reply, sources: mock.sources, mocked: true })
    }

    const anthropic = createAnthropic({ apiKey: process.env.CLAUDE_API_KEY })

    const isAggregate = wantsAggregateCount(message)
    const isAggList = wantsAggregateList(message)
    // Perguntas de contagem/listagem da base não são sobre um exame específico;
    // pular o match pontual evita uma CAMADA 2 com um exame casado por acaso.
    const matched = isAggregate || isAggList ? [] : resolveExames(message, history)
    const { context, sources } = buildContext(
      message,
      matched,
      wantsFluxoRaiox(message),
      wantsListaRaiox(message),
      isAggregate,
      isAggList,
      profile,
    )

    const system = `${SYSTEM_PROMPTS[profile] ?? SYSTEM_PROMPTS.patient}\n\n=== CONTEXTO ===\n${context}\n=== FIM DO CONTEXTO ===`

    const recentHistory = history.slice(-8).map((m) => ({
      role: m.role,
      content: m.content,
    }))

    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-5"),
      system,
      messages: [...recentHistory, { role: "user", content: message }],
      temperature: 0.2,
      maxOutputTokens: 1000,
    })

    return Response.json({ reply: text, sources })
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    console.log("[v0] /api/chat IA indisponível, usando fallback determinístico:", raw)

    // IA indisponível (saldo, autenticação, rede, etc.): responde a partir da base.
    if (fallbackMessage) {
      const mock = generateMockResponse(fallbackMessage, fallbackProfile, fallbackHistory)
      return Response.json({ reply: mock.reply, sources: mock.sources, mocked: true })
    }
    return Response.json(
      { error: "Erro ao processar a solicitação. Tente novamente." },
      { status: 500 },
    )
  }
}
