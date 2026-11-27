export type ToastTelemetryMode = false | "validation" | "error";

export type DestructiveToastClassification = "skip" | "validation" | "error";

const VALIDATION_TITLE_PATTERNS = [
  "horário inválido",
  "data inválida",
  "data de início inválida",
  "horário agendado inválido",
  "horário de chegada inválido",
  "paciente obrigatório",
  "título obrigatório",
  "campos pendentes",
  "campo obrigatório",
  "campos obrigatórios",
  "dados inválidos",
  "cpf inválido",
  "e-mail inválido",
  "email inválido",
  "telefone inválido",
  "senha inválida",
  "permissão negada",
  "acesso restrito",
  "acesso de visualização apenas",
  "limite de atendimentos atingido",
  "limite atingido",
  "plano necessário",
  "selecione um paciente",
  "preencha os campos",
] as const;

const VALIDATION_DESCRIPTION_PATTERNS = [
  "para registrar um atendimento que já aconteceu",
  "informe um horário válido",
  "informe um cpf válido",
  "invalid login credentials",
  "user already registered",
  "email not confirmed",
  "você não tem permissão",
  "você não possui permissão",
  "não é possível agendar no passado",
] as const;

export interface DestructiveToastTelemetryInput {
  title?: string;
  description?: string;
  telemetry?: ToastTelemetryMode;
}

/**
 * Classifica toasts destrutivos entre validação esperada de UX/regra de negócio
 * (apenas métrica) e erro técnico real (telemetria Axiom + alertas).
 */
export function classifyDestructiveToast(
  input: DestructiveToastTelemetryInput
): DestructiveToastClassification {
  if (input.telemetry === false) {
    return "skip";
  }
  if (input.telemetry === "validation") {
    return "validation";
  }
  if (input.telemetry === "error") {
    return "error";
  }

  const titleLower = (input.title ?? "").trim().toLowerCase();
  const descLower = (input.description ?? "").trim().toLowerCase();

  if (
    VALIDATION_TITLE_PATTERNS.some((pattern) => titleLower.includes(pattern)) ||
    VALIDATION_DESCRIPTION_PATTERNS.some((pattern) => descLower.includes(pattern))
  ) {
    return "validation";
  }

  return "error";
}
