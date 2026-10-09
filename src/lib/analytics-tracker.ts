/**
 * Unified Analytics, Meta Pixel, Google Analytics 4 (GA4) & Heatmap Tracker.
 *
 * Características e Diretrizes:
 * - Injeção segura e assíncrona do Meta Pixel (fbevents.js) com Pixel ID dinâmico.
 * - Injeção assíncrona do Google Tag (gtag.js) com Measurement ID do GA4.
 * - Injeção não bloqueante do Microsoft Clarity / Heatmap.
 * - Suporte a first-party tracking no subdomínio (app.plurifisio.com.br / plurifisio.com.br).
 * - Tratamento defensivo em ambientes SSR/Vitest e navegadores com adblockers.
 * - Deduplicação determinística de eventos com `event_id` para Meta CAPI e Google.
 */

import {
  resolveCurrentSubproduct,
  generateStructuredDataSchema,
  type SubproductConfig,
} from "./subproduct-config";
import {
  trackCompleteRegistration as sendMetaRegistration,
  trackStartTrial as sendMetaStartTrial,
  trackInitiateCheckout as sendMetaInitiateCheckout,
  trackPurchase as sendMetaPurchase,
  trackSubscribe as sendMetaSubscribe,
  generateEventId,
  type CompleteRegistrationUserData,
  type PixelProfession,
  type PlanCategory,
} from "./meta-pixel";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    clarity?: {
      (action: "identify", customId: string, customSessionId?: string, customPageId?: string, friendlyName?: string): void;
      (action: "set", key: string, value: string | string[]): void;
      (action: "event", eventName: string): void;
      (action: "consent"): void;
      (action: "upgrade", reason: string): void;
      q?: unknown[];
    };
  }
}

let isAnalyticsInitialized = false;

/**
 * Inicializa os scripts globais de rastreamento (Meta Pixel, GA4, Clarity)
 * e aplica os metadados dinâmicos de SEO/AEO e Schema.org no DOM.
 */
export function initGlobalAnalytics(subproductOverride?: SubproductConfig): SubproductConfig {
  const subproduct = subproductOverride || resolveCurrentSubproduct();

  if (typeof window === "undefined" || typeof document === "undefined") {
    return subproduct;
  }

  // 1. Atualizar Metadados de SEO / AEO no <head>
  updateDocumentSeoMetadata(subproduct);

  if (isAnalyticsInitialized) {
    return subproduct;
  }
  isAnalyticsInitialized = true;

  // 2. Injetar Google Analytics 4 (gtag.js)
  if (subproduct.gaMeasurementId && !document.getElementById("ga-gtag-script")) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer?.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", subproduct.gaMeasurementId, {
      send_page_view: false, // Controlado manualmente pelas rotas do React
      cookie_domain: "auto",
      cookie_flags: "SameSite=None;Secure",
    });

    const gaScript = document.createElement("script");
    gaScript.id = "ga-gtag-script";
    gaScript.async = true;
    gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(subproduct.gaMeasurementId)}`;
    document.head.appendChild(gaScript);
  }

  // 3. Injetar Meta Pixel (fbevents.js)
  if (subproduct.metaPixelId && !document.getElementById("meta-pixel-script")) {
    if (!window.fbq) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fbq: any = function (...args: unknown[]) {
        if (fbq.callMethod) {
          fbq.callMethod(...args);
        } else {
          fbq.queue.push(args);
        }
      };
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = "2.0";
      fbq.queue = [];
      window.fbq = fbq;
      window._fbq = fbq;
    }

    window.fbq("init", subproduct.metaPixelId);

    const metaScript = document.createElement("script");
    metaScript.id = "meta-pixel-script";
    metaScript.async = true;
    metaScript.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(metaScript);
  }

  // 4. Injetar Microsoft Clarity / Heatmap
  if (subproduct.clarityProjectId && !document.getElementById("clarity-heatmap-script")) {
    if (!window.clarity) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clarity: any = function (...args: unknown[]) {
        clarity.q = clarity.q || [];
        clarity.q.push(args);
      };
      window.clarity = clarity;
    }

    const clarityScript = document.createElement("script");
    clarityScript.id = "clarity-heatmap-script";
    clarityScript.async = true;
    clarityScript.src = `https://www.clarity.ms/tag/${encodeURIComponent(subproduct.clarityProjectId)}`;
    document.head.appendChild(clarityScript);

    // Tag de contexto do subproduto no Heatmap
    if (typeof window.clarity === "function") {
      window.clarity("set", "subproduct", subproduct.key);
      window.clarity("set", "domain", window.location.hostname);
    }
  }

  return subproduct;
}

/**
 * Atualiza tags de título, descrição, OpenGraph e Schema.org no documento HTML.
 */
export function updateDocumentSeoMetadata(subproduct: SubproductConfig, customTitle?: string): void {
  if (typeof document === "undefined") return;

  // Title
  document.title = customTitle
    ? `${customTitle} • ${subproduct.brandTitle}`
    : subproduct.seo.title;

  // Helper para atualizar ou criar meta tag
  const setMeta = (nameAttr: "name" | "property", key: string, content: string) => {
    let tag = document.querySelector(`meta[${nameAttr}="${key}"]`);
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute(nameAttr, key);
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", content);
  };

  setMeta("name", "description", subproduct.seo.description);
  setMeta("name", "keywords", subproduct.seo.keywords.join(", "));
  setMeta("name", "theme-color", subproduct.seo.themeColor);
  setMeta("property", "og:title", subproduct.seo.ogTitle);
  setMeta("property", "og:description", subproduct.seo.ogDescription);
  setMeta("property", "og:site_name", subproduct.brandTitle);
  setMeta("property", "og:image", subproduct.seo.ogImage);
  setMeta("name", "twitter:title", subproduct.seo.ogTitle);
  setMeta("name", "twitter:description", subproduct.seo.ogDescription);

  // Injetar ou atualizar Schema.org JSON-LD
  let jsonLdScript = document.getElementById("structured-data-jsonld") as HTMLScriptElement | null;
  if (!jsonLdScript) {
    jsonLdScript = document.createElement("script");
    jsonLdScript.id = "structured-data-jsonld";
    jsonLdScript.type = "application/ld+json";
    document.head.appendChild(jsonLdScript);
  }
  jsonLdScript.textContent = JSON.stringify(generateStructuredDataSchema(subproduct));
}

/**
 * Dispara evento de PageView para Meta Pixel, Google Analytics e Heatmap.
 */
export function trackPageView(path?: string, title?: string): void {
  if (typeof window === "undefined") return;

  const currentPath = path || window.location.pathname + window.location.search;
  const currentTitle = title || document.title;
  const subproduct = resolveCurrentSubproduct();

  // 1. Meta Pixel
  if (typeof window.fbq === "function") {
    window.fbq("track", "PageView");
  }

  // 2. Google Analytics 4
  if (typeof window.gtag === "function" && subproduct.gaMeasurementId) {
    window.gtag("event", "page_view", {
      page_path: currentPath,
      page_title: currentTitle,
      page_location: window.location.href,
      subproduct: subproduct.key,
    });
  }

  // 3. Microsoft Clarity
  if (typeof window.clarity === "function") {
    window.clarity("event", "page_view");
  }
}

/**
 * Rastreia o evento completo de Cadastro (Meta Pixel CompleteRegistration + GA4 sign_up & generate_lead).
 */
export async function trackRegistrationEvent(params: {
  profession: string;
  userData?: CompleteRegistrationUserData;
  eventId?: string;
}): Promise<{ eventId: string }> {
  const eventId = params.eventId || generateEventId("reg", params.userData?.email || params.profession);
  const pixelProfession: PixelProfession =
    params.profession === "terapeuta_ocupacional" ? "occupational_therapist" : "physiotherapist";

  // 1. Meta Pixel
  await sendMetaRegistration({
    profession: pixelProfession,
    userData: params.userData,
    eventId,
  });

  // 2. Google Analytics 4
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", "sign_up", {
      method: "email",
      profession: params.profession,
      event_id: eventId,
    });
    window.gtag("event", "generate_lead", {
      currency: "BRL",
      value: 0,
      lead_type: "free_account",
      profession: params.profession,
      event_id: eventId,
    });
  }

  // 3. Clarity
  if (typeof window !== "undefined" && typeof window.clarity === "function") {
    if (params.userData?.externalId || params.userData?.email) {
      window.clarity("identify", params.userData.externalId || params.userData.email, undefined, undefined, params.userData.name);
    }
    window.clarity("event", "complete_registration");
  }

  return { eventId };
}

/**
 * Rastreia o início de Teste Gratuito (Meta Pixel StartTrial + GA4 start_trial).
 */
export async function trackTrialStartEvent(params: {
  profession: string;
  userData?: CompleteRegistrationUserData;
  eventId?: string;
}): Promise<{ eventId: string }> {
  const eventId = params.eventId || generateEventId("trial", params.userData?.email || params.profession);
  const pixelProfession: PixelProfession =
    params.profession === "terapeuta_ocupacional" ? "occupational_therapist" : "physiotherapist";

  // 1. Meta Pixel
  await sendMetaStartTrial({
    profession: pixelProfession,
    userData: params.userData,
    eventId,
  });

  // 2. Google Analytics 4
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", "start_trial", {
      method: "free_7_days",
      profession: params.profession,
      event_id: eventId,
    });
  }

  // 3. Clarity
  if (typeof window !== "undefined" && typeof window.clarity === "function") {
    window.clarity("event", "start_trial");
  }

  return { eventId };
}

/**
 * Rastreia a Seleção de Plano / Início do Checkout (Meta Pixel InitiateCheckout + GA4 begin_checkout).
 */
export function trackBeginCheckoutEvent(params: {
  planKey: string;
  category: PlanCategory;
  value: number;
  valueCents?: number;
  couponCode?: string;
  eventId?: string;
}): { eventId: string } {
  const eventId = params.eventId || generateEventId("checkout", params.planKey);

  // 1. Meta Pixel
  sendMetaInitiateCheckout({
    planKey: params.planKey,
    category: params.category,
    value: params.value,
    valueCents: params.valueCents,
    currency: "BRL",
    eventId,
  });

  // 2. Google Analytics 4
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", "begin_checkout", {
      currency: "BRL",
      value: params.value,
      coupon: params.couponCode,
      event_id: eventId,
      items: [
        {
          item_id: params.planKey,
          item_name: `Plano ${params.planKey}`,
          item_category: params.category,
          price: params.value,
          quantity: 1,
        },
      ],
    });
  }

  // 3. Clarity
  if (typeof window !== "undefined" && typeof window.clarity === "function") {
    window.clarity("set", "selected_plan", params.planKey);
    window.clarity("set", "plan_category", params.category);
    window.clarity("event", "begin_checkout");
  }

  return { eventId };
}

/**
 * Rastreia a Confirmação de Pagamento / Assinatura (Meta Pixel Purchase & Subscribe + GA4 purchase).
 */
export async function trackPurchaseEvent(params: {
  planKey: string;
  category: PlanCategory;
  value: number;
  valueCents?: number;
  transactionId?: string;
  paymentMethod?: string;
  couponCode?: string;
  userData?: CompleteRegistrationUserData;
  eventId?: string;
}): Promise<{ eventId: string }> {
  const eventId = params.eventId || generateEventId("purch", params.transactionId || params.planKey);

  // 1. Meta Pixel (Purchase + Subscribe)
  await sendMetaPurchase({
    planKey: params.planKey,
    category: params.category,
    value: params.value,
    valueCents: params.valueCents,
    currency: "BRL",
    transactionId: params.transactionId,
    userData: params.userData,
    eventId,
  });

  await sendMetaSubscribe({
    planKey: params.planKey,
    category: params.category,
    value: params.value,
    valueCents: params.valueCents,
    currency: "BRL",
    transactionId: params.transactionId,
    userData: params.userData,
    eventId: generateEventId("sub", params.transactionId || params.planKey),
  });

  // 2. Google Analytics 4
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", "purchase", {
      transaction_id: params.transactionId || eventId,
      value: params.value,
      currency: "BRL",
      payment_type: params.paymentMethod || "Asaas",
      coupon: params.couponCode,
      event_id: eventId,
      items: [
        {
          item_id: params.planKey,
          item_name: `Plano ${params.planKey}`,
          item_category: params.category,
          price: params.value,
          quantity: 1,
        },
      ],
    });
  }

  // 3. Clarity
  if (typeof window !== "undefined" && typeof window.clarity === "function") {
    window.clarity("set", "purchased_plan", params.planKey);
    window.clarity("event", "purchase_completed");
  }

  return { eventId };
}
