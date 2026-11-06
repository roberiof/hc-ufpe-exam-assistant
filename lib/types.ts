export type Profile = "patient" | "professional"

export type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

export type PreparoStatus = "ok" | "parcial" | "pendente"

export type Exame = {
  sigla: string
  nome: string
  nome_usual: string
  /** Nome amigável ao paciente, com acentos e capitalização corretos. */
  label_paciente?: string
  sinonimos: string[]
  modalidade: string
  association_review?: { preparo_id: string; status: string; reason: string }
  preparo_id: string
}

export type EvidenceReference = {
  factId: string
  text: string
  topic: string
  sourceTitle: string
  sourceHash: string
  locator: string
  quote: string
  validation: "pending-udi"
}

export type Preparo = {
  fact_ids?: string[]
  titulo: string
  orientacoes: string
  status: PreparoStatus
  observacoes?: string
  fallback?: string
}

export type FluxoRaiox = {
  titulo: string
  passos: string[]
  telefone: string
}

export type PreparosFile = {
  meta: {
    orientacoes_gerais: {
      titulo: string
      orientacoes: string
      telefones: Record<string, string>
    }
    fluxo_raiox?: FluxoRaiox
  }
  preparos: Record<string, Preparo>
}

export type Source = {
  evidence?: EvidenceReference[]
  evidenceStatus?: "documentary-only" | "legacy-untraced"

  nome: string
  /** Código AGHU (sigla). Exposto SOMENTE no perfil profissional. */
  sigla?: string
}

export type StoredMessage = ChatMessage & {
  sources?: Source[]
}

export type ChatSession = {
  id: string
  profile: Profile
  title: string
  messages: StoredMessage[]
  createdAt: number
  updatedAt: number
}
