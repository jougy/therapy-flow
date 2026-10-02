/**
 * Meta Pixel (Facebook Pixel) & Conversions API (CAPI) Client Helper.
 *
 * Directrizes e Arquitetura:
 * - Suporta eventos padrão: CompleteRegistration, StartTrial e InitiateCheckout.
 * - Advanced Matching seguro no client com SHA-256 (e-mail, telefone, primeiro/último nome).
 * - Geração determinística ou rastreável de `event_id` para deduplicação server-side / CAPI.
 * - Suporte a fallback defensivo em ambientes sem Web Crypto ou SSR/Node test environments.
 * - Validação estrita TypeScript sem uso de `any`.
 */

declare global {
  interface Window {
    fbq?: {
      (
        action: "init",
        pixelId: string,
        advancedMatching?: Record<string, string>
      ): void;
      (
        action: "track" | "trackCustom",
        eventName: string,
        parameters?: Record<string, unknown>,
        options?: { eventID?: string }
      ): void;
      push?: (...args: unknown[]) => void;
      loaded?: boolean;
      version?: string;
      queue?: unknown[];
    };
    _fbq?: unknown;
  }
}

export type PixelProfession = "physiotherapist" | "occupational_therapist";

export type PlanCategory = "Solo" | "Equipe";

export interface CompleteRegistrationUserData {
  email?: string;
  phone?: string;
  name?: string;
  externalId?: string;
}

export interface CompleteRegistrationParams {
  profession: PixelProfession;
  userData?: CompleteRegistrationUserData;
  eventId?: string;
}

export interface StartTrialParams {
  profession: PixelProfession;
  userData?: CompleteRegistrationUserData;
  eventId?: string;
}

export interface InitiateCheckoutParams {
  planKey: string;
  category: PlanCategory;
  value: number; // Em reais ou centavos dependendo da precisão informada
  valueCents?: number;
  currency?: "BRL";
  eventId?: string;
}

/**
 * Normaliza e-mail de acordo com as especificações da Meta:
 * minúsculo, sem espaços nas extremidades.
 */
export function normalizeEmailForMatching(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normaliza número de telefone segundo a especificação da Meta:
 * Apenas dígitos, adicionando código DDI do Brasil (55) caso ausente.
 */
export function normalizePhoneForMatching(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

/**
 * Normaliza nome pessoal:
 * Converte para minúsculas e remove espaços múltiplos.
 */
export function normalizeNameForMatching(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Computa hash SHA-256 em hexadecimal a partir de uma string UTF-8.
 * Compatível com Web Crypto API (browser moderno) e com fallback síncrono simples/crypto nativo.
 */
export async function sha256Hex(value: string): Promise<string> {
  const normalized = value.trim();
  if (!normalized) return "";

  if (typeof window !== "undefined" && window.crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Fallback em Node/Vitest se Web Crypto não estiver em window
  try {
    const nodeCrypto = await import("crypto");
    return nodeCrypto.createHash("sha256").update(normalized).digest("hex");
  } catch {
    return "";
  }
}

/**
 * Prepara o objeto de Advanced Matching com valores criptografados em SHA-256.
 */
export async function hashUserDataForAdvancedMatching(
  userData?: CompleteRegistrationUserData
): Promise<Record<string, string>> {
  if (!userData) return {};
  const matchingData: Record<string, string> = {};

  if (userData.email) {
    const normEmail = normalizeEmailForMatching(userData.email);
    if (normEmail) {
      const hashed = await sha256Hex(normEmail);
      if (hashed) matchingData.em = hashed;
    }
  }

  if (userData.phone) {
    const normPhone = normalizePhoneForMatching(userData.phone);
    if (normPhone) {
      const hashed = await sha256Hex(normPhone);
      if (hashed) matchingData.ph = hashed;
    }
  }

  if (userData.name) {
    const normName = normalizeNameForMatching(userData.name);
    const parts = normName.split(" ").filter(Boolean);
    if (parts.length > 0) {
      const fn = parts[0];
      const ln = parts.slice(1).join(" ");
      const hashedFn = await sha256Hex(fn);
      if (hashedFn) matchingData.fn = hashedFn;
      if (ln) {
        const hashedLn = await sha256Hex(ln);
        if (hashedLn) matchingData.ln = hashedLn;
      }
    }
  }

  if (userData.externalId) {
    const hashedExternalId = await sha256Hex(userData.externalId.trim());
    if (hashedExternalId) matchingData.external_id = hashedExternalId;
  }

  return matchingData;
}

/**
 * Gera um event_id determinístico ou único para deduplicação entre Meta Pixel e Conversions API (CAPI).
 * Formato: evt_<prefix>_<scope>_<timestamp>_<random>
 */
export function generateEventId(prefix: string, scope?: string): string {
  const timestamp = Date.now();
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, "");
  const cleanScope = scope ? scope.replace(/[^a-zA-Z0-9_-]/g, "") : "";
  const random = Math.random().toString(36).substring(2, 9);
  return ["evt", cleanPrefix, cleanScope, timestamp, random]
    .filter(Boolean)
    .join("_");
}

/**
 * Dispara evento seguro para o fbq caso disponível no contexto global.
 */
function sendPixelEvent(
  eventName: string,
  parameters: Record<string, unknown>,
  eventId?: string
): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") {
    return;
  }

  if (eventId) {
    window.fbq("track", eventName, parameters, { eventID: eventId });
  } else {
    window.fbq("track", eventName, parameters);
  }
}

/**
 * Rastreia o evento CompleteRegistration:
 * - Envia `profession` ('physiotherapist' | 'occupational_therapist') nos metadados.
 * - Suporta Advanced Matching com SHA-256 no client para e-mail, telefone e nome.
 * - Gera `event_id` determinístico se não fornecido para deduplicação com CAPI.
 */
export async function trackCompleteRegistration(
  params: CompleteRegistrationParams
): Promise<{ eventId: string; hashedUserData: Record<string, string> }> {
  const eventId =
    params.eventId ||
    generateEventId("reg", params.userData?.email || params.profession);

  const hashedUserData = await hashUserDataForAdvancedMatching(params.userData);

  const eventMetadata: Record<string, unknown> = {
    profession: params.profession,
    status: true,
    content_name: "Cadastro de Conta",
    currency: "BRL",
    ...hashedUserData,
  };

  sendPixelEvent("CompleteRegistration", eventMetadata, eventId);

  return { eventId, hashedUserData };
}

/**
 * Rastreia o evento StartTrial:
 * - Envia `profession` ('physiotherapist' | 'occupational_therapist') nos metadados.
 * - Suporta Advanced Matching com SHA-256 no client para e-mail, telefone e nome.
 * - Gera `event_id` para deduplicação com CAPI.
 */
export async function trackStartTrial(
  params: StartTrialParams
): Promise<{ eventId: string; hashedUserData: Record<string, string> }> {
  const eventId =
    params.eventId ||
    generateEventId("trial", params.userData?.email || params.profession);

  const hashedUserData = await hashUserDataForAdvancedMatching(params.userData);

  const eventMetadata: Record<string, unknown> = {
    profession: params.profession,
    status: true,
    content_name: "Teste Gratuito 7 dias",
    currency: "BRL",
    ...hashedUserData,
  };

  sendPixelEvent("StartTrial", eventMetadata, eventId);

  return { eventId, hashedUserData };
}

/**
 * Rastreia o evento InitiateCheckout:
 * - Envia `planKey`, `category` (Solo vs Equipe), valor em centavos / reais e moeda 'BRL'.
 * - Suporta `event_id` para deduplicação com CAPI.
 */
export function trackInitiateCheckout(
  params: InitiateCheckoutParams
): { eventId: string; payload: Record<string, unknown> } {
  const eventId = params.eventId || generateEventId("checkout", params.planKey);

  const valueInReais =
    typeof params.value === "number" && !Number.isNaN(params.value)
      ? params.value
      : 0;

  const valueInCents =
    typeof params.valueCents === "number" && !Number.isNaN(params.valueCents)
      ? params.valueCents
      : Math.round(valueInReais * 100);

  const payload: Record<string, unknown> = {
    planKey: params.planKey,
    category: params.category,
    value: valueInReais,
    value_cents: valueInCents,
    currency: params.currency || "BRL",
    content_type: "product",
    content_ids: [params.planKey],
    content_name: `Plano ${params.planKey} (${params.category})`,
  };

  sendPixelEvent("InitiateCheckout", payload, eventId);

  return { eventId, payload };
}
