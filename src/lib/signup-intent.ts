/**
 * Gerenciamento centralizado de intenção de cadastro (Signup Intent).
 * Permite que usuários vindos da Landing Page (plurifisio.com.br) ou links externos
 * persistam sua escolha de plano, ciclo e teste gratuito durante o processo de
 * cadastro de conta, confirmação de e-mail e login.
 */

import { PlanType, BillingCycle, parsePlanType } from "@/utils/subscriptionPricing";

export interface SignupIntent {
  plan: PlanType;
  cycle: BillingCycle | "annual";
  trial?: boolean;
  coupon?: string;
  timestamp: number;
}

export const SIGNUP_INTENT_STORAGE_KEY = "pluri_signup_intent";
const INTENT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Salva a intenção de cadastro no localStorage do navegador.
 */
export function saveSignupIntent(intent: {
  plan?: string | null;
  cycle?: string | null;
  trial?: boolean | string | null;
  coupon?: string | null;
}): void {
  try {
    if (!intent.plan && !intent.trial) return;

    const normalizedPlan: PlanType = intent.plan ? parsePlanType(intent.plan) : "prof_basico";
    const rawCycle = (intent.cycle || "annual").toLowerCase();
    const normalizedCycle: BillingCycle =
      rawCycle === "monthly" || rawCycle === "quarterly" || rawCycle === "annual"
        ? (rawCycle as BillingCycle)
        : "annual";

    const isTrial = intent.trial === true || intent.trial === "true";

    const payload: SignupIntent = {
      plan: normalizedPlan,
      cycle: normalizedCycle,
      trial: isTrial,
      coupon: intent.coupon ? intent.coupon.trim().toUpperCase() : undefined,
      timestamp: Date.now(),
    };

    localStorage.setItem(SIGNUP_INTENT_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("Falha ao salvar intenção de cadastro no localStorage:", err);
  }
}

/**
 * Recupera a intenção de cadastro salva, caso ainda esteja dentro da validade (24h).
 */
export function getSignupIntent(): SignupIntent | null {
  try {
    const raw = localStorage.getItem(SIGNUP_INTENT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as SignupIntent;
    if (!parsed || !parsed.timestamp) {
      clearSignupIntent();
      return null;
    }

    if (Date.now() - parsed.timestamp > INTENT_MAX_AGE_MS) {
      clearSignupIntent();
      return null;
    }

    return parsed;
  } catch {
    clearSignupIntent();
    return null;
  }
}

/**
 * Remove a intenção de cadastro após ser processada com sucesso.
 */
export function clearSignupIntent(): void {
  try {
    localStorage.removeItem(SIGNUP_INTENT_STORAGE_KEY);
  } catch (err) {
    console.warn("Falha ao limpar intenção de cadastro:", err);
  }
}

/**
 * Constrói a querystring de intenção para propagar em links internos.
 */
export function buildIntentQueryString(intent?: SignupIntent | null): string {
  if (!intent) return "";
  const params = new URLSearchParams();
  if (intent.plan) params.set("plan", intent.plan);
  if (intent.cycle) params.set("cycle", intent.cycle);
  if (intent.trial) params.set("trial", "true");
  if (intent.coupon) params.set("coupon", intent.coupon);
  const str = params.toString();
  return str ? `?${str}` : "";
}
