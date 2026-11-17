import type { SubscriptionPlan } from "@/lib/rbac";
import { DEFAULT_CONCURRENT_ACCESS_LIMIT_BY_PLAN } from "./authTypes";

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : String(message);
  }

  return String(error);
};

export const isSimultaneousAccessLimitError = (error: unknown): boolean => {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("limite de acessos simultaneos");
};

export const isForcedSignOutError = (error: unknown): boolean => {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("sessao encerrada") || message.includes("sessão encerrada");
};

export const isDuplicateSecuritySessionError = (error: unknown): boolean => {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("duplicate key value") &&
    message.includes("user_security_sessions_session_key_key")
  );
};

export const deriveConcurrentAccessLimit = (clinicSummary: {
  concurrent_access_limit?: number | null;
  subaccount_limit: number | null;
  subscription_plan: SubscriptionPlan;
}): number => {
  if (
    typeof clinicSummary.concurrent_access_limit === "number" &&
    Number.isFinite(clinicSummary.concurrent_access_limit) &&
    clinicSummary.concurrent_access_limit > 0
  ) {
    return Math.max(1, Math.trunc(clinicSummary.concurrent_access_limit));
  }

  const defaultForPlan = DEFAULT_CONCURRENT_ACCESS_LIMIT_BY_PLAN[clinicSummary.subscription_plan] ?? 1;
  if (
    clinicSummary.subscription_plan === "solo" ||
    clinicSummary.subscription_plan === "prof_basico" ||
    clinicSummary.subscription_plan === "prof_medio"
  ) {
    return defaultForPlan;
  }

  if (
    typeof clinicSummary.subaccount_limit === "number" &&
    clinicSummary.subaccount_limit > 0 &&
    clinicSummary.subaccount_limit <= 20
  ) {
    return Math.max(clinicSummary.subaccount_limit, defaultForPlan);
  }

  return defaultForPlan;
};
