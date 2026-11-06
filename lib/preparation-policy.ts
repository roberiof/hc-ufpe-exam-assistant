/** An explicit catalog group, never an inference from fasting instructions. */
export function explicitlyNoPreparation(preparoId: string): boolean {
  return preparoId === "radiologia_sem_preparo"
}

/** Reuse the recorded specific arrival instruction without adding a conflicting default. */
export function arrivalInstruction(instructions: string[]): string {
  const specific = instructions.flatMap(text => text.split(/(?<=[.;])\s+/))
    .filter(text => /anteced[eê]ncia/i.test(text))
  const unique = [...new Set(specific)]
  if (unique.length > 1) return "Há orientações de antecedência diferentes para os exames identificados. Confirme com o setor."
  return unique[0] ?? "Chegue com 30 minutos de antecedência."
}
