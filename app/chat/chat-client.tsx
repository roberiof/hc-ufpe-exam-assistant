"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Send,
  Stethoscope,
  User,
  Info,
  FileText,
  PanelLeft,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { GuidedExamPicker } from "@/components/guided-exam-picker"
import { ChatSidebar } from "@/components/chat-sidebar"
import { useChatSessions } from "@/hooks/use-chat-sessions"
import type { Profile, Source, StoredMessage } from "@/lib/types"
import { cn } from "@/lib/utils"

type DisplayMessage = StoredMessage

const SUGGESTIONS: Record<Profile, string[]> = {
  patient: [
    "Preciso de jejum para ressonância com contraste?",
    "Como me preparo para o ultrassom de abdômen?",
    "Quais documentos levo no dia do exame?",
    "Como devo me preparar para a mamografia?",
  ],
  professional: [
    "Qual o código AGHU da tomografia de abdômen com contraste?",
    "Qual o fluxo de solicitação e realização de raio-X pelo AGHU?",
    "Qual o preparo para ressonância de abdômen com contraste?",
    "Quais exames de raio-X exigem preparo?",
  ],
}

const PROFILE_META: Record<
  Profile,
  { label: string; icon: typeof User; badgeClass: string }
> = {
  patient: {
    label: "Paciente",
    icon: User,
    badgeClass: "bg-mist text-azure border-transparent",
  },
  professional: {
    label: "Profissional",
    icon: Stethoscope,
    badgeClass: "bg-professional-bg text-azure-deep border-transparent",
  },
}

type ChatRequest = {
  message: string
  profile: Profile
  history: { role: StoredMessage["role"]; content: string }[]
  examSigla?: string
}

// Erro de rede/conectividade: o fetch nem chegou ao servidor.
class NetworkError extends Error {}

const REQUEST_TIMEOUT_MS = 30_000
const MAX_ATTEMPTS = 2
const MAX_INPUT_HEIGHT_PX = 128

async function postChatMessage(payload: ChatRequest) {
  let lastNetworkError: unknown

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    let res: Response
    try {
      res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
    } catch (err) {
      // "Failed to fetch" (offline, servidor fora, DNS) ou abort por timeout.
      lastNetworkError = err
      clearTimeout(timeout)
      continue
    } finally {
      clearTimeout(timeout)
    }

    const data = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(data?.error ?? "Erro ao processar a solicitação.")
    }
    return data as { reply: string; sources?: Source[] }
  }

  throw new NetworkError(String(lastNetworkError))
}

function describeChatError(err: unknown): string {
  if (err instanceof NetworkError) {
    return "Não consegui me conectar ao servidor. Verifique sua conexão com a internet e tente novamente."
  }
  if (err instanceof Error && err.message) {
    return err.message
  }
  return "Desculpe, ocorreu um erro ao processar sua pergunta. Por favor, tente novamente em instantes."
}

export function ChatClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const profile: Profile =
    searchParams.get("profile") === "professional" ? "professional" : "patient"

  const {
    sessions,
    activeId,
    activeMessages,
    hydrated,
    newChat,
    selectChat,
    deleteChat,
    commitMessages,
  } = useChatSessions()

  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // Trava de envio em andamento — bloqueia envios em sequência no mesmo tick,
  // antes de o estado isLoading ser aplicado (sugestões/picker não são desativados).
  const sendingRef = useRef(false)

  // Mensagens derivam da sessão ativa (fonte única de verdade).
  const messages = activeMessages

  // Cada fluxo (paciente/profissional) vê apenas as próprias conversas.
  const visibleSessions = sessions.filter((s) => s.profile === profile)

  const meta = PROFILE_META[profile]
  const ProfileIcon = meta.icon

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [messages, isLoading])

  useLayoutEffect(() => {
    const textarea = inputRef.current
    if (!textarea) return

    // Recalcula a partir da altura mínima para também encolher ao apagar/enviar.
    textarea.style.height = "auto"
    const contentHeight = textarea.scrollHeight
    textarea.style.height = `${Math.min(contentHeight, MAX_INPUT_HEIGHT_PX)}px`
    textarea.style.overflowY =
      contentHeight > MAX_INPUT_HEIGHT_PX ? "auto" : "hidden"
  }, [input])

  function switchProfile() {
    const next = profile === "patient" ? "professional" : "patient"
    router.replace(`/chat?profile=${next}`)
  }

  function handleNewChat() {
    newChat()
    setSidebarOpen(false)
  }

  function handleSelectChat(id: string) {
    selectChat(id)
    setSidebarOpen(false)
    // Continua a conversa no seu próprio perfil para manter o tom das respostas.
    const selected = sessions.find((s) => s.id === id)
    if (selected && selected.profile !== profile) {
      router.replace(`/chat?profile=${selected.profile}`)
    }
  }

  async function sendMessage(text: string, examSigla?: string) {
    const trimmed = text.trim()
    if (!trimmed || sendingRef.current) return
    sendingRef.current = true

    const history = messages.map(({ role, content }) => ({ role, content }))
    const afterUser: DisplayMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ]
    commitMessages(afterUser, profile)
    setInput("")
    setIsLoading(true)

    try {
      const data = await postChatMessage({ message: trimmed, profile, history, examSigla })

      commitMessages(
        [
          ...afterUser,
          { role: "assistant", content: data.reply, sources: data.sources },
        ],
        profile,
      )
    } catch (err) {
      commitMessages(
        [
          ...afterUser,
          {
            role: "assistant",
            content: describeChatError(err),
          },
        ],
        profile,
      )
    } finally {
      setIsLoading(false)
      sendingRef.current = false
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      <ChatSidebar
        sessions={visibleSessions}
        activeId={activeId}
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        onNewChat={handleNewChat}
        onSelect={handleSelectChat}
        onDelete={deleteChat}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="shrink-0 border-b border-border bg-card/85 backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-steel transition-colors hover:bg-mist hover:text-azure-deep md:hidden"
                aria-label="Abrir histórico de conversas"
              >
                <PanelLeft className="size-5" />
              </button>
              <Link
                href="/"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-steel transition-colors hover:bg-mist hover:text-azure-deep"
                aria-label="Voltar ao início"
              >
                <ArrowLeft className="size-5" />
              </Link>
              <div className="min-w-0">
                <h1 className="truncate font-serif text-lg leading-tight text-ink">
                  Assistente UDI HC-UFPE
                </h1>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-steel">
                  Preparo de exames de imagem
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={switchProfile}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                meta.badgeClass,
              )}
              aria-label={`Perfil ativo: ${meta.label}. Clique para trocar.`}
            >
              <ProfileIcon className="size-3.5" aria-hidden="true" />
              {meta.label}
            </button>
          </div>
        </header>

        {/* Warning banner */}
        <div className="shrink-0 border-b border-border bg-mist/60">
          <div className="flex items-start gap-2.5 px-5 py-3 sm:px-8">
            <Info
              className="mt-0.5 size-4 shrink-0 text-azure"
              aria-hidden="true"
            />
            <p className="max-w-3xl text-xs leading-relaxed text-azure-deep">
              Orientações de apoio com base na documentação oficial da
              UDI/HC-UFPE. Não substitui a orientação da equipe de saúde.
            </p>
          </div>
        </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-6 flex flex-col gap-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center text-center py-10">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-mist text-azure">
                <ProfileIcon className="size-8" aria-hidden="true" />
              </div>
              <h2 className="mt-5 font-serif text-2xl text-ink">
                Como posso ajudar?
              </h2>
              <p className="mt-2 text-sm text-steel max-w-sm leading-relaxed">
                {profile === "professional"
                  ? "Consulte protocolos, contraindicações, fluxo de agendamento e preparos específicos."
                  : "Selecione seu exame abaixo — ou, se já souber o nome, digite na caixa de mensagem."}
              </p>

              {profile === "professional" ? (
                <div className="mt-7 grid w-full gap-2.5 sm:grid-cols-2">
                  {SUGGESTIONS.professional.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => sendMessage(s)}
                      className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground transition-colors hover:border-azure hover:bg-mist"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : (
                <GuidedExamPicker onSubmit={(q, sigla) => sendMessage(q, sigla)} />
              )}
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} profile={profile} />
          ))}

          {isLoading && <TypingIndicator />}
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border bg-card">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-2xl items-end gap-2 px-4 py-3"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
            placeholder="Digite sua pergunta sobre o exame..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-azure focus:ring-2 focus:ring-azure/25 max-h-32"
            aria-label="Mensagem"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !input.trim()}
            className="size-11 shrink-0 rounded-xl"
            aria-label="Enviar mensagem"
          >
            <Send className="size-5" />
          </Button>
        </form>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message, profile }: { message: DisplayMessage; profile: Profile }) {
  const isUser = message.role === "user"
  const hasSources = !isUser && message.sources && message.sources.length > 0

  if (isUser) {
    return (
      <div className="flex w-full justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground">
          <FormattedContent text={message.content} isUser />
        </div>
      </div>
    )
  }

  // Assistant
  return (
    <div className="flex w-full justify-start">
      <div className="max-w-[88%] rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3 text-sm leading-relaxed text-card-foreground">
        <FormattedContent text={message.content} isUser={false} />

        {profile === "professional" && hasSources && message.sources!.some(src => src.evidence?.length) && (
          <details className="mt-3 rounded-lg border border-border p-3 text-xs">
            <summary className="cursor-pointer font-medium">Informações e trechos de origem — validação UDI pendente</summary>
            <p className="mt-2">Referências dos itens documentados. Contatos, documentos gerais e outras informações herdadas do cadastro ainda não têm proveniência completa reconciliada.</p>
            {Array.from(new Map(message.sources!.flatMap(src => src.evidence ?? []).map(fact => [fact.factId, fact])).values()).map(fact => (
              <div key={fact.factId} className="mt-3 border-t border-border pt-2">
                <p className="font-medium">{fact.text}</p>
                <p>{fact.sourceTitle} — {fact.locator}</p>
                <blockquote className="mt-1 border-l-2 border-border pl-2">{fact.quote}</blockquote>
                <p className="mt-1">Trecho localizado; protocolo ainda não homologado pela UDI.</p>
              </div>
            ))}
          </details>
        )}

        {hasSources && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2.5">
            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
              <FileText className="size-3" aria-hidden="true" />
              Fonte
            </span>
            {message.sources!.map((src, i) => (
              <Badge
                key={`${src.nome}-${i}`}
                variant="secondary"
                className="bg-mist text-[10px] font-normal text-azure-deep"
              >
                {src.sigla ? `${src.nome} · ${src.sigla}` : src.nome}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FormattedContent({ text, isUser }: { text: string; isUser: boolean }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => (
          <p className="mb-1 last:mb-0 leading-relaxed">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="opacity-80">{children}</em>
        ),
        ul: ({ children }) => (
          <ul className="my-1.5 flex flex-col gap-0.5 pl-4 list-disc marker:opacity-60">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="my-1.5 flex flex-col gap-0.5 pl-5 list-decimal marker:opacity-60">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="leading-relaxed pl-0.5">{children}</li>
        ),
        h1: ({ children }) => (
          <h1 className="text-base font-bold mb-1 mt-2">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-sm font-bold mb-1 mt-2">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold mb-1 mt-2">{children}</h3>
        ),
        hr: () => (
          <hr
            className={cn(
              "my-2 border-t",
              isUser ? "border-primary-foreground/30" : "border-border",
            )}
          />
        ),
        code: ({ children }) => (
          <code className="rounded bg-black/10 px-1 py-0.5 text-xs font-mono">
            {children}
          </code>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  )
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-border bg-card px-5 py-4">
        <span className="sr-only">Assistente digitando</span>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-2.5 rounded-full bg-azure/70 animate-bounce"
            style={{ animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </div>
    </div>
  )
}
