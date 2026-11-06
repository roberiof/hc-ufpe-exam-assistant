"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  X,
  Search,
  ScanLine,
  Brain,
  Waves,
  Radiation,
  Bone,
  Activity,
  Stethoscope,
  ChevronRight,
} from "lucide-react"
import {
  getModalidades,
  getExamsForModalidade,
  modalidadeLabel,
} from "@/lib/exam-options"
import {
  groupExams,
  type ExamGroup,
  type ExamVariant,
  type VariantAxis,
} from "@/lib/exam-grouping"
import { normalize } from "@/lib/search"
import { cn } from "@/lib/utils"

const MODALIDADE_ICONS: Record<string, typeof ScanLine> = {
  tomografia_computadorizada: ScanLine,
  ressonancia_magnetica: Brain,
  ultrassonografia: Waves,
  radiologia_convencional: Radiation,
  mamografia: Activity,
  densitometria_ossea: Bone,
  medicina_nuclear: Stethoscope,
}

type Step = "modality" | "base" | "variant"

// Ordem fixa das perguntas de acompanhamento (roteiro Karol: contraste → sedação → lado).
const AXIS_ORDER: VariantAxis[] = ["contraste", "sedacao", "lado"]
const AXIS_QUESTION: Record<VariantAxis, string> = {
  contraste: "Com contraste ou sem contraste?",
  sedacao: "Com sedação ou sem sedação?",
  lado: "Qual lado?",
}
const AXIS_CHOICES: Record<VariantAxis, { value: string; label: string }[]> = {
  contraste: [
    { value: "com", label: "Com contraste" },
    { value: "sem", label: "Sem contraste" },
  ],
  sedacao: [
    { value: "com", label: "Com sedação" },
    { value: "sem", label: "Sem sedação" },
  ],
  lado: [
    { value: "direito", label: "Direito" },
    { value: "esquerdo", label: "Esquerdo" },
  ],
}

const CHIP_CLASS =
  "flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground transition-colors hover:border-azure hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure/40"

export function GuidedExamPicker({
  onSubmit,
  onClose,
}: {
  onSubmit: (query: string, sigla?: string) => void
  onClose?: () => void
}) {
  const [step, setStep] = useState<Step>("modality")
  const [modalidade, setModalidade] = useState<string | null>(null)
  const [group, setGroup] = useState<ExamGroup | null>(null)
  const [selection, setSelection] = useState<Partial<Record<VariantAxis, string>>>({})
  const [filter, setFilter] = useState("")
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Move o foco para o título a cada troca de passo (acessibilidade).
  useEffect(() => {
    headingRef.current?.focus()
  }, [step])

  const modalidades = useMemo(() => getModalidades(), [])
  const groups = useMemo(
    () => (modalidade ? groupExams(getExamsForModalidade(modalidade)) : []),
    [modalidade]
  )
  const filteredGroups = useMemo(() => {
    const q = normalize(filter)
    if (!q) return groups
    return groups.filter((g) => normalize(g.baseLabel).includes(q))
  }, [groups, filter])

  function handleModalidade(m: string, single?: { query: string; sigla: string }) {
    if (single) {
      onSubmit(single.query, single.sigla)
      return
    }
    setModalidade(m)
    setFilter("")
    setStep("base")
  }

  function handleBase(g: ExamGroup) {
    // Grupo sem variantes divergentes → vai direto ao único exame.
    if (g.axes.length === 0) {
      onSubmit(g.variants[0].exam.query, g.variants[0].exam.sigla)
      return
    }
    setGroup(g)
    setSelection({})
    setStep("variant")
  }

  // Aplica uma escolha de eixo; se resolver a uma variante única, envia.
  function chooseAxis(axis: VariantAxis, value: string) {
    if (!group) return
    const next = { ...selection, [axis]: value }
    setSelection(next)

    const remaining = group.variants.filter((v) =>
      group.axes.every((ax) => next[ax] === undefined || v[ax] === next[ax])
    )
    if (remaining.length === 1) {
      onSubmit(remaining[0].exam.query, remaining[0].exam.sigla)
    }
  }

  const pendingAxes = group
    ? AXIS_ORDER.filter((ax) => group.axes.includes(ax) && selection[ax] === undefined)
    : []
  const currentAxis = pendingAxes[0]

  // Variantes ainda compatíveis com as escolhas feitas (para não oferecer opção inexistente).
  const compatibleVariants: ExamVariant[] = group
    ? group.variants.filter((v) =>
        group.axes.every((ax) => selection[ax] === undefined || v[ax] === selection[ax])
      )
    : []
  const availableChoices = currentAxis
    ? AXIS_CHOICES[currentAxis].filter((c) =>
        compatibleVariants.some((v) => v[currentAxis] === c.value)
      )
    : []

  const heading =
    step === "modality"
      ? "Que tipo de exame você vai fazer?"
      : step === "base"
        ? `Qual exame? (${modalidadeLabel(modalidade!)})`
        : currentAxis
          ? AXIS_QUESTION[currentAxis]
          : group?.baseLabel ?? ""

  return (
    <div className="mt-4 w-full rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="font-serif text-base text-ink outline-none"
        >
          {heading}
        </h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar perguntas guiadas"
            className="shrink-0 rounded-lg p-1 text-steel transition-colors hover:bg-mist hover:text-azure-deep"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <p className="mt-1 text-xs leading-relaxed text-steel">
        {step === "modality"
          ? "Não precisa saber o nome exato. Escolha a opção que combina com o seu pedido médico."
          : step === "base"
            ? "Escolha o exame pelo nome do dia a dia."
            : "Responda para encontrarmos a orientação certa."}
      </p>

      {/* PASSO 1 — modalidade */}
      {step === "modality" && (
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {modalidades.map((m) => {
            const Icon = MODALIDADE_ICONS[m.modalidade] ?? Stethoscope
            const single = m.singleExam
            return (
              <button
                key={m.modalidade}
                type="button"
                onClick={() => handleModalidade(m.modalidade, single)}
                className={CHIP_CLASS}
              >
                <Icon className="size-5 shrink-0 text-azure" aria-hidden="true" />
                <span className="flex-1">{single ? single.label : m.label}</span>
                {!single && (
                  <ChevronRight className="size-4 shrink-0 text-steel" aria-hidden="true" />
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* PASSO 2 — exame base (com busca + rolagem) */}
      {step === "base" && (
        <>
          <div className="relative mt-4">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-steel"
              aria-hidden="true"
            />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Buscar exame nesta categoria…"
              aria-label="Buscar exame"
              className="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-steel focus-visible:border-azure focus-visible:ring-2 focus-visible:ring-azure/40"
            />
          </div>

          <div className="mt-3 grid max-h-[50vh] gap-2.5 overflow-y-auto pr-1">
            {filteredGroups.length === 0 ? (
              <p className="py-4 text-sm text-steel">
                Nenhum exame encontrado com esse nome nesta categoria.
              </p>
            ) : (
              filteredGroups.map((g) => (
                <button
                  key={g.baseKey}
                  type="button"
                  onClick={() => handleBase(g)}
                  className={cn(CHIP_CLASS, "justify-between")}
                >
                  <span className="flex-1">{g.baseLabel}</span>
                  {g.axes.length > 0 && (
                    <ChevronRight className="size-4 shrink-0 text-steel" aria-hidden="true" />
                  )}
                </button>
              ))
            )}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setStep("modality")
                setModalidade(null)
              }}
              aria-label="Voltar para os tipos de exame"
              className="inline-flex items-center gap-1.5 text-sm text-azure transition-colors hover:text-azure-deep"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Voltar
            </button>
          </div>
        </>
      )}

      {/* PASSO 3 — eixos de variante (contraste / sedação / lado) */}
      {step === "variant" && group && currentAxis && (
        <>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {availableChoices.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => chooseAxis(currentAxis, c.value)}
                className={CHIP_CLASS}
              >
                <span className="flex-1">{c.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-steel">{group.baseLabel}</p>
          <button
            type="button"
            onClick={() => {
              // volta um passo dentro da variante ou para a lista base
              const answered = AXIS_ORDER.filter(
                (ax) => group.axes.includes(ax) && selection[ax] !== undefined
              )
              if (answered.length > 0) {
                const last = answered[answered.length - 1]
                const { [last]: _removed, ...rest } = selection
                setSelection(rest)
              } else {
                setStep("base")
                setGroup(null)
              }
            }}
            aria-label="Voltar"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-azure transition-colors hover:text-azure-deep"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Voltar
          </button>
        </>
      )}
    </div>
  )
}
