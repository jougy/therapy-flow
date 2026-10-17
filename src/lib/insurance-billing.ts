/**
 * Lógica modular para faturamento de convênios e reembolso.
 * Todos os valores monetários são estritamente manipulados em centavos (bigint / number inteiro).
 */

export type InsuranceMode = "none" | "direct_billing" | "reimbursement";

export interface InsuranceDirectCopayInput {
  sessionUnitAmountCents: number;
  copayAmountCents: number;
  totalSessions: number;
}

export interface InsuranceDirectCopayResult {
  patientTotalCents: number;
  insuranceTotalCents: number;
  grandTotalCents: number;
}

export const calculateSessionUnitAmountCents = (
  totalAmountCents: number,
  totalSessions: number
): number => {
  if (totalSessions <= 0 || totalAmountCents <= 0) {
    return 0;
  }
  return Math.round(totalAmountCents / totalSessions);
};

export const calculateInsuranceDirectCopay = ({
  sessionUnitAmountCents,
  copayAmountCents,
  totalSessions,
}: InsuranceDirectCopayInput): InsuranceDirectCopayResult => {
  const safeSessions = Math.max(0, totalSessions);
  const safeUnitCents = Math.max(0, sessionUnitAmountCents);
  const safeCopayCents = Math.min(safeUnitCents, Math.max(0, copayAmountCents));

  const patientTotalCents = safeCopayCents * safeSessions;
  const grandTotalCents = safeUnitCents * safeSessions;
  const insuranceTotalCents = Math.max(0, grandTotalCents - patientTotalCents);

  return {
    patientTotalCents,
    insuranceTotalCents,
    grandTotalCents,
  };
};

export const formatInsuranceModeLabel = (mode: InsuranceMode): string => {
  switch (mode) {
    case "direct_billing":
      return "Credenciamento Direto";
    case "reimbursement":
      return "Reembolso (Livre Escolha)";
    case "none":
    default:
      return "Particular";
  }
};

export interface ValidateAuthorizationInput {
  totalSessions: number;
  authorizedSessions?: number | null;
  expirationDateStr?: string | null;
}

export interface ValidateAuthorizationResult {
  isValid: boolean;
  reason?: string;
}

export const validateInsuranceAuthorization = ({
  totalSessions,
  authorizedSessions,
  expirationDateStr,
}: ValidateAuthorizationInput): ValidateAuthorizationResult => {
  if (authorizedSessions != null && totalSessions > authorizedSessions) {
    return {
      isValid: false,
      reason: `A quantidade de sessões (${totalSessions}) é superior ao autorizado na guia (${authorizedSessions}).`,
    };
  }

  if (expirationDateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expirationDateStr + "T00:00:00");

    if (!isNaN(exp.getTime()) && exp < today) {
      return {
        isValid: false,
        reason: "A guia / autorização do convênio está vencida.",
      };
    }
  }

  return { isValid: true };
};
