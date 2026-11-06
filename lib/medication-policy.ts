import { normalize } from "./search"

/** Questions about personal medication decisions cannot become prescriptions. */
export function asksMedicationDecision(message: string): boolean {
  const q = normalize(message)
  return /\b(remedio|remedios|medicamento|medicamentos|medicacao|antibiotico|dose|dosagem|alergia|alergico|alergica|diabetes|metformina)\b/.test(q) &&
    /\b(parar|suspender|continuar|tomar|tomo|tome|dar|dose|dosagem|qual|quais|substituir|lugar)\b/.test(q)
}

export const medicationReferral = "Não altere seu tratamento com base no chat. Para decidir sobre dose, suspensão, continuidade ou substituição de medicamentos, confirme com o médico responsável e com a equipe da UDI. As orientações cadastradas não substituem uma avaliação individual."
