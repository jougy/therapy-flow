/**
 * Utilitários para regras de negócio de Teste Gratuito (Free Trial).
 *
 * Centraliza os cálculos de tempo restante, status de expiração e formatação de badges,
 * garantindo tipagem TypeScript estrita (sem 'any') e reutilização em páginas e componentes.
 */

export interface TrialTimeRemaining {
  daysRemaining: number | null;
  hoursRemaining: number | null;
  isExpired: boolean;
}

export interface ClinicTrialStatusInput {
  status?: string | null;
  isFreeTrial?: boolean | null;
  trialEndsAt?: string | null;
  expiresAt?: string | null;
  currentPeriodEnd?: string | null;
}

export interface ClinicTrialEvaluation {
  hasTrial: boolean;
  isTrialExpired: boolean;
  daysRemaining: number | null;
  hoursRemaining: number | null;
  badgeLabel: string;
  badgeVariantClass: string;
  noticeText: string;
  noticeVariantClass: string;
}

/**
 * Calcula os dias e horas restantes com base em uma data ISO ou timestamp.
 */
export function calculateTrialRemainingTime(
  endDateInput: string | Date | null | undefined,
  nowTimestamp: number = Date.now()
): TrialTimeRemaining {
  if (!endDateInput) {
    return {
      daysRemaining: null,
      hoursRemaining: null,
      isExpired: false,
    };
  }

  const endMs = typeof endDateInput === "string" ? new Date(endDateInput).getTime() : endDateInput.getTime();
  const msRemaining = endMs - nowTimestamp;

  if (Number.isNaN(endMs)) {
    return {
      daysRemaining: null,
      hoursRemaining: null,
      isExpired: false,
    };
  }

  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
  const hoursRemaining = Math.ceil(msRemaining / (1000 * 60 * 60));
  const isExpired = msRemaining <= 0;

  return {
    daysRemaining,
    hoursRemaining,
    isExpired,
  };
}

/**
 * Avalia o status completo de teste gratuito de uma clínica para apresentação em cards e listas.
 */
export function evaluateClinicTrialStatus(
  input: ClinicTrialStatusInput,
  nowTimestamp: number = Date.now()
): ClinicTrialEvaluation {
  const rawStatus = (input.status || "").toLowerCase();
  const isTrialStatus = rawStatus === "trialing" || rawStatus === "trial" || Boolean(input.isFreeTrial);
  const trialEndsAtDate = input.trialEndsAt || input.expiresAt || input.currentPeriodEnd || null;
  const hasTrial = isTrialStatus || Boolean(trialEndsAtDate);

  const timeResult = calculateTrialRemainingTime(trialEndsAtDate, nowTimestamp);
  const isTrialExpired = timeResult.isExpired || rawStatus === "trial_expired";
  const daysRemaining = timeResult.daysRemaining;

  let badgeVariantClass = "border-blue-500/40 text-blue-400 bg-blue-500/10";
  let noticeVariantClass = "text-muted-foreground";

  if (isTrialExpired) {
    badgeVariantClass = "border-red-500/40 text-red-400 bg-red-500/10";
    noticeVariantClass = "text-red-400 font-medium";
  } else if (daysRemaining !== null && daysRemaining <= 2) {
    badgeVariantClass = "border-amber-500/40 text-amber-400 bg-amber-500/10";
    noticeVariantClass = "text-amber-400 font-medium";
  }

  let badgeLabel = "Teste Gratuito";
  if (isTrialExpired) {
    badgeLabel = "Período de teste encerrado";
  } else if (daysRemaining !== null) {
    const plural = daysRemaining === 1 ? "" : "s";
    badgeLabel = `Teste Gratuito: ${daysRemaining} dia${plural} restante${plural}`;
  }

  let noticeText = "Período de teste gratuito ativo";
  if (isTrialExpired) {
    noticeText = "Período de teste encerrado (somente leitura)";
  } else if (daysRemaining !== null) {
    const plural = daysRemaining === 1 ? "" : "s";
    noticeText = `${daysRemaining} dia${plural} de teste gratuito restante${plural}`;
  }

  return {
    hasTrial,
    isTrialExpired,
    daysRemaining,
    hoursRemaining: timeResult.hoursRemaining,
    badgeLabel,
    badgeVariantClass,
    noticeText,
    noticeVariantClass,
  };
}
