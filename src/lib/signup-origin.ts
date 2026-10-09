/**
 * Utilitários para rastreamento silencioso e automático de origem de cadastro (Signup Origin & UTMs).
 * 
 * Captura:
 * - document.referrer
 * - Parâmetros UTM e de tráfego: utm_source, utm_medium, utm_campaign, utm_content, utm_term, gclid, fbclid, ref
 * - Persistência em sessionStorage e localStorage para sobrevivência a recargas e redirecionamentos.
 * - Resolução amigável e legível da origem para relatórios, Backoffice e notificações do Telegram.
 */

export interface SignupOriginData {
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  gclid?: string;
  fbclid?: string;
  ref?: string;
  path?: string;
  timestamp: number;
}

export const SIGNUP_ORIGIN_STORAGE_KEY = "pluri_signup_origin";
const ORIGIN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

/**
 * Captura automaticamente a origem do usuário a partir dos parâmetros de URL atuais e do document.referrer.
 * Armazena no sessionStorage e localStorage sem sobrescrever caso uma origem de campanha já tenha sido capturada.
 */
export function captureSignupOrigin(
  customSearchParams?: URLSearchParams | string,
  customReferrer?: string
): SignupOriginData {
  let searchParams: URLSearchParams;
  if (customSearchParams instanceof URLSearchParams) {
    searchParams = customSearchParams;
  } else if (typeof customSearchParams === "string") {
    searchParams = new URLSearchParams(
      customSearchParams.startsWith("?") ? customSearchParams.slice(1) : customSearchParams
    );
  } else if (typeof window !== "undefined") {
    searchParams = new URLSearchParams(window.location.search);
  } else {
    searchParams = new URLSearchParams();
  }

  const referrer =
    customReferrer !== undefined
      ? customReferrer
      : typeof document !== "undefined"
      ? document.referrer
      : "";

  const utm_source = searchParams.get("utm_source") || undefined;
  const utm_medium = searchParams.get("utm_medium") || undefined;
  const utm_campaign = searchParams.get("utm_campaign") || undefined;
  const utm_content = searchParams.get("utm_content") || undefined;
  const utm_term = searchParams.get("utm_term") || undefined;
  const gclid = searchParams.get("gclid") || undefined;
  const fbclid = searchParams.get("fbclid") || undefined;
  const ref = searchParams.get("ref") || searchParams.get("r") || undefined;

  const hasTrackingParams = Boolean(
    utm_source || utm_medium || utm_campaign || utm_content || utm_term || gclid || fbclid || ref
  );

  const existingOrigin = getStoredSignupOrigin();

  // Se já existe uma origem armazenada com UTMs e a nova requisição não traz UTMs novas, preserva a original
  if (existingOrigin && !hasTrackingParams) {
    return existingOrigin;
  }

  const currentPath =
    typeof window !== "undefined" ? window.location.pathname : undefined;

  const newOriginData: SignupOriginData = {
    referrer: referrer || existingOrigin?.referrer || undefined,
    utm_source: utm_source || existingOrigin?.utm_source,
    utm_medium: utm_medium || existingOrigin?.utm_medium,
    utm_campaign: utm_campaign || existingOrigin?.utm_campaign,
    utm_content: utm_content || existingOrigin?.utm_content,
    utm_term: utm_term || existingOrigin?.utm_term,
    gclid: gclid || existingOrigin?.gclid,
    fbclid: fbclid || existingOrigin?.fbclid,
    ref: ref || existingOrigin?.ref,
    path: currentPath,
    timestamp: Date.now(),
  };

  saveStoredSignupOrigin(newOriginData);
  return newOriginData;
}

/**
 * Salva a origem no localStorage e sessionStorage com segurança defensiva.
 */
export function saveStoredSignupOrigin(origin: SignupOriginData): void {
  try {
    const serialized = JSON.stringify(origin);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(SIGNUP_ORIGIN_STORAGE_KEY, serialized);
    }
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(SIGNUP_ORIGIN_STORAGE_KEY, serialized);
    }
  } catch (e) {
    console.warn("[signup-origin] Falha ao persistir origem:", e);
  }
}

/**
 * Recupera os dados de origem armazenados, checando validade de expiração.
 */
export function getStoredSignupOrigin(): SignupOriginData | null {
  try {
    let raw: string | null = null;
    if (typeof sessionStorage !== "undefined") {
      raw = sessionStorage.getItem(SIGNUP_ORIGIN_STORAGE_KEY);
    }
    if (!raw && typeof localStorage !== "undefined") {
      raw = localStorage.getItem(SIGNUP_ORIGIN_STORAGE_KEY);
    }

    if (!raw) return null;

    const parsed = JSON.parse(raw) as SignupOriginData;
    if (!parsed || !parsed.timestamp) return null;

    if (Date.now() - parsed.timestamp > ORIGIN_MAX_AGE_MS) {
      clearStoredSignupOrigin();
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Limpa a origem armazenada.
 */
export function clearStoredSignupOrigin(): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(SIGNUP_ORIGIN_STORAGE_KEY);
    }
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(SIGNUP_ORIGIN_STORAGE_KEY);
    }
  } catch (e) {
    console.warn("[signup-origin] Falha ao limpar storage:", e);
  }
}

/**
 * Resolve e formata uma string amigável, clara e descritiva da origem do cadastro.
 * Exemplos:
 * - 'Instagram (Bio/Campanha)'
 * - 'Google Ads'
 * - 'Google (Busca Orgânica)'
 * - 'Facebook'
 * - 'Landing Page Oficial (plurifisio.com.br)'
 * - 'Convite de Clínica'
 * - 'Acesso Direto'
 */
export function resolveFriendlyOrigin(
  originData?: SignupOriginData | null,
  fallbackReferrer?: string
): string {
  const origin = originData || getStoredSignupOrigin();
  const rawReferrer = (origin?.referrer || fallbackReferrer || "").toLowerCase();
  const source = (origin?.utm_source || "").toLowerCase().trim();
  const medium = (origin?.utm_medium || "").toLowerCase().trim();
  const campaign = origin?.utm_campaign?.trim();
  const gclid = origin?.gclid;
  const fbclid = origin?.fbclid;
  const ref = (origin?.ref || "").toLowerCase().trim();

  // 1. Google Ads / Tráfego Pago Google
  if (gclid || (source === "google" && (medium === "cpc" || medium === "paid" || medium === "ads"))) {
    return campaign ? `Google Ads (${campaign})` : "Google Ads";
  }

  // 2. Facebook / Meta Ads
  if (fbclid || source === "facebook" || source === "fb" || source === "meta" || rawReferrer.includes("facebook.com") || rawReferrer.includes("fb.me")) {
    if (medium === "cpc" || medium === "paid" || medium === "ads" || fbclid) {
      return campaign ? `Facebook Ads (${campaign})` : "Facebook Ads";
    }
    return campaign ? `Facebook (${campaign})` : "Facebook";
  }

  // 3. Instagram
  if (
    source === "instagram" ||
    source === "ig" ||
    rawReferrer.includes("instagram.com") ||
    rawReferrer.includes("l.instagram.com")
  ) {
    if (campaign) return `Instagram (${campaign})`;
    if (medium === "bio" || medium === "social") return "Instagram (Bio/Perfil)";
    if (medium === "stories" || medium === "story") return "Instagram (Stories)";
    return "Instagram (Bio/Campanha)";
  }

  // 4. TikTok
  if (source === "tiktok" || rawReferrer.includes("tiktok.com")) {
    return campaign ? `TikTok (${campaign})` : "TikTok";
  }

  // 5. LinkedIn
  if (source === "linkedin" || rawReferrer.includes("linkedin.com") || rawReferrer.includes("lnkd.in")) {
    return campaign ? `LinkedIn (${campaign})` : "LinkedIn";
  }

  // 6. YouTube
  if (source === "youtube" || source === "yt" || rawReferrer.includes("youtube.com") || rawReferrer.includes("youtu.be")) {
    return campaign ? `YouTube (${campaign})` : "YouTube";
  }

  // 7. Google Orgânico
  if (source === "google" || rawReferrer.includes("google.com") || rawReferrer.includes("google.com.br")) {
    return "Google (Busca Orgânica)";
  }

  // 8. Convite de Clínica / Membro
  if (ref === "invite" || ref === "convite" || ref === "clinic" || source === "invite" || medium === "referral" || rawReferrer.includes("/convite")) {
    return "Convite de Clínica";
  }

  // 9. Landing Page Oficial (plurifisio.com.br / pluri.health)
  if (
    source === "landing_page" ||
    source === "site" ||
    rawReferrer.includes("plurifisio.com.br") ||
    rawReferrer.includes("pluri.health") ||
    rawReferrer.includes("plurihealth.com.br")
  ) {
    return "Landing Page Oficial (plurifisio.com.br)";
  }

  // 10. Outros parâmetros UTM genéricos
  if (source) {
    const parts = [source];
    if (medium) parts.push(medium);
    if (campaign) parts.push(`campanha: ${campaign}`);
    return `Campanha (${parts.join(" / ")})`;
  }

  // 11. Referrer genérico de outros domínios
  if (rawReferrer) {
    try {
      const urlObj = new URL(rawReferrer);
      const host = urlObj.hostname.replace(/^www\./, "");
      if (host) {
        return `Referência: ${host}`;
      }
    } catch {
      // Ignora erro de parsing
    }
  }

  // 12. Fallback padrão quando acessou digitando a URL diretamente
  return "Acesso Direto";
}
