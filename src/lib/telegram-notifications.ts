/**
 * Utilitários para Notificações Administrativas e Integração WhatsApp / Telegram.
 * 
 * Regras:
 * - Higienização segura de telefone com prefixo DDI 55 do Brasil para números de 10 ou 11 dígitos.
 * - Geração de link wa.me/55... com encodeURIComponent adequado da mensagem.
 * - Tratamento defensivo e fallback gracioso quando o telefone estiver vazio ou for indefinido.
 */

export interface TelegramAdminNotificationParams {
  name?: string | null;
  email: string;
  phone?: string | null;
  profession?: string | null;
  councilNumber?: string | null;
  councilName?: string | null;
  gender?: string | null;
  preferredPronoun?: string | null;
  origin?: string | null;
  signupOrigin?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  clinicName?: string | null;
  plan?: string | null;
  createdAt?: string | null;
}

export interface PlanPurchaseNotificationParams {
  clinicName?: string | null;
  subscriberName?: string | null;
  email?: string | null;
  phone?: string | null;
  planName?: string | null;
  billingCycle?: string | null;
  amountFormatted?: string | null;
  paymentMethod?: string | null;
  paidAt?: string | null;
}

/**
 * Higieniza o número de telefone e garante o prefixo DDI 55 caso seja telefone brasileiro.
 * Trata números com DDD, sem DDI, ou com pontuação.
 */
export function sanitizePhoneNumber(rawPhone?: string | null): string {
  if (!rawPhone) return "";
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return "";

  // Se tem 10 dígitos (DDD + 8 dígitos) ou 11 dígitos (DDD + 9 dígitos), adiciona DDI 55
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  // Se tem 12 ou 13 dígitos e já começa com 55, mantém
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    return digits;
  }

  return digits;
}

/**
 * Formata amigavelmente a profissão e número de registro de classe.
 */
export function formatProfessionLabel(
  profession?: string | null,
  councilNumber?: string | null,
  councilName?: string | null
): string {
  if (!profession && !councilNumber) return "";

  const professionMap: Record<string, string> = {
    fisioterapeuta: "Fisioterapeuta",
    terapeuta_ocupacional: "Terapeuta Ocupacional",
    psicologo: "Psicólogo(a)",
    fonoaudiologo: "Fonoaudiólogo(a)",
    nutricionista: "Nutricionista",
    medico: "Médico(a)",
    educador_fisico: "Educador(a) Físico(a)",
    enfermeiro: "Enfermeiro(a)",
    outro: "Outro Profissional de Saúde",
  };

  const rawProf = (profession || "").trim().toLowerCase();
  const baseProf = professionMap[rawProf] || (profession ? profession.trim() : "Profissional de Saúde");
  const cleanCouncilNumber = (councilNumber || "").trim();
  const cleanCouncilName = (councilName || "").trim() || "CREFITO";

  if (cleanCouncilNumber) {
    return `${baseProf} (${cleanCouncilName}: ${cleanCouncilNumber})`;
  }

  return baseProf;
}

/**
 * Formata a identidade de gênero e pronome de tratamento.
 */
export function formatIdentityLabel(gender?: string | null, preferredPronoun?: string | null): string {
  const g = (gender || "").trim();
  const p = (preferredPronoun || "").trim();

  if (g && p) {
    const formattedPronoun = p.startsWith("(") && p.endsWith(")") ? p : `(${p})`;
    return `${g} ${formattedPronoun}`;
  }

  if (g) return g;
  if (p) return p.startsWith("(") && p.endsWith(")") ? p : `(${p})`;

  return "";
}

/**
 * Detecta e formata a origem do cadastro / canais de marketing / UTMs.
 */
export function formatOriginLabel(
  origin?: string | null,
  signupOrigin?: string | null,
  utmSource?: string | null,
  utmMedium?: string | null,
  utmCampaign?: string | null
): string {
  const explicitOrigin = (origin || signupOrigin || "").trim();
  const rawSource = (utmSource || "").trim().toLowerCase();
  const rawMedium = (utmMedium || "").trim().toLowerCase();
  const rawCampaign = (utmCampaign || "").trim();

  // Se o canal ou UTMs contêm Instagram
  if (
    rawSource.includes("instagram") ||
    rawSource.includes("ig") ||
    explicitOrigin.toLowerCase() === "instagram" ||
    explicitOrigin.toLowerCase() === "ig"
  ) {
    if (rawMedium.includes("cpc") || rawMedium.includes("ads") || rawMedium.includes("paid")) {
      return rawCampaign ? `Instagram Ads (Campanha: ${rawCampaign})` : "Instagram (Campanha Anúncio / Inbound)";
    }
    return rawCampaign ? `Instagram (${rawCampaign})` : "Instagram";
  }

  // Se o canal ou UTMs contêm Google
  if (rawSource.includes("google") || explicitOrigin.toLowerCase() === "google") {
    if (rawMedium.includes("cpc") || rawMedium.includes("ads") || rawMedium.includes("paid")) {
      return rawCampaign ? `Google Ads (Campanha: ${rawCampaign})` : "Google Ads";
    }
    return "Google (Busca Orgânica)";
  }

  // Se contém Facebook / Meta
  if (rawSource.includes("facebook") || rawSource.includes("meta") || explicitOrigin.toLowerCase() === "facebook") {
    return rawCampaign ? `Facebook / Meta Ads (Campanha: ${rawCampaign})` : "Facebook / Meta";
  }

  // Se contém LinkedIn
  if (rawSource.includes("linkedin") || explicitOrigin.toLowerCase() === "linkedin") {
    return rawCampaign ? `LinkedIn Ads (Campanha: ${rawCampaign})` : "LinkedIn";
  }

  // Se contém YouTube
  if (rawSource.includes("youtube") || explicitOrigin.toLowerCase() === "youtube") {
    return "YouTube";
  }

  // Se contém TikTok
  if (rawSource.includes("tiktok") || explicitOrigin.toLowerCase() === "tiktok") {
    return "TikTok";
  }

  // Se é convite de clínica
  if (
    explicitOrigin.toLowerCase() === "convite_clinica" ||
    explicitOrigin.toLowerCase() === "convite" ||
    explicitOrigin.toLowerCase() === "invite"
  ) {
    return "Convite de Clínica";
  }

  // Se é indicação
  if (
    explicitOrigin.toLowerCase() === "indicacao" ||
    explicitOrigin.toLowerCase() === "referral" ||
    explicitOrigin.toLowerCase() === "indicação"
  ) {
    return "Indicação";
  }

  // Se é landing page / orgânico padrão
  if (
    explicitOrigin.toLowerCase() === "landing_page" ||
    explicitOrigin.toLowerCase() === "landing" ||
    explicitOrigin.toLowerCase() === "organic" ||
    explicitOrigin.toLowerCase() === "organico"
  ) {
    return "Landing Page Oficial";
  }

  // Se já veio uma string customizada preenchida (ex: "Instagram (Bio/Campanha)" ou "Indicação Dr. Paulo")
  if (explicitOrigin) {
    if (rawCampaign && !explicitOrigin.includes(rawCampaign)) {
      return `${explicitOrigin} (Campanha: ${rawCampaign})`;
    }
    return explicitOrigin;
  }

  if (rawCampaign) {
    return `Campanha: ${rawCampaign}`;
  }

  return "Landing Page / Direto";
}

/**
 * Cria a URL direta wa.me com DDI 55 e mensagem devidamente codificada em URI.
 * Retorna string vazia caso o telefone esteja vazio ou inválido.
 */
export function generateWhatsAppUrl(phone?: string | null, text?: string): string {
  const sanitized = sanitizePhoneNumber(phone);
  if (!sanitized) return "";
  const encodedText = text ? encodeURIComponent(text) : "";
  return encodedText ? `https://wa.me/${sanitized}?text=${encodedText}` : `https://wa.me/${sanitized}`;
}

/**
 * Gera a mensagem predefinida de boas-vindas para novos cadastros.
 */
export function buildSignupWelcomeMessage(name?: string | null): string {
  const cleanName = name?.trim() || "Profissional";
  return `Olá ${cleanName}! Seja bem-vindo(a) ao Pluri Health. Sou da equipe de suporte e gostaria de saber se precisa de ajuda nos primeiros passos!`;
}

/**
 * Gera a mensagem predefinida para compradores de plano.
 */
export function buildPlanPurchaseMessage(subscriberName?: string | null, planName?: string | null): string {
  const cleanName = subscriberName?.trim() || "Assinante";
  const cleanPlan = planName?.trim() || "Pluri Health";
  return `Olá ${cleanName}! Parabéns pela adesão ao plano ${cleanPlan} no Pluri Health! Estamos aqui para garantir o seu melhor aproveitamento.`;
}

/**
 * Escapa caracteres HTML para exibição segura no Telegram com parse_mode: 'HTML'.
 * Previne quebra de formatação ou injeção de tags HTML maliciosas.
 */
export function escapeTelegramHtml(text?: string | null): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Gera o texto formatado para a notificação de novo cadastro (Telegram).
 */
export function formatSignupTelegramText(params: TelegramAdminNotificationParams): string {
  const name = params.name?.trim() || "Não informado";
  const email = params.email.trim();
  const phoneRaw = params.phone || "";
  const clinicName = params.clinicName?.trim() || "Consultório Solo";
  const plan = params.plan?.trim() || "Degustação Gratuita (7 dias)";
  const createdAt = params.createdAt || new Date().toISOString();

  const professionFormatted = formatProfessionLabel(params.profession, params.councilNumber, params.councilName);
  const identityFormatted = formatIdentityLabel(params.gender, params.preferredPronoun);
  const originFormatted = formatOriginLabel(
    params.origin,
    params.signupOrigin,
    params.utmSource,
    params.utmMedium,
    params.utmCampaign
  );

  let message = `🚀 <b>Novo Cadastro Realizado!</b>\n\n`;
  message += `👤 <b>Nome:</b> ${escapeTelegramHtml(name)}\n`;
  message += `📧 <b>E-mail:</b> ${escapeTelegramHtml(email)}\n`;
  message += `📱 <b>Telefone:</b> ${escapeTelegramHtml(phoneRaw || "Não informado")}\n`;

  if (professionFormatted) {
    message += `🩺 <b>Profissão:</b> ${escapeTelegramHtml(professionFormatted)}\n`;
  }

  if (identityFormatted) {
    message += `⚧️ <b>Identidade:</b> ${escapeTelegramHtml(identityFormatted)}\n`;
  }

  message += `🏥 <b>Clínica / Consultório:</b> ${escapeTelegramHtml(clinicName)}\n`;

  if (originFormatted) {
    message += `🌐 <b>Origem:</b> ${escapeTelegramHtml(originFormatted)}\n`;
  }

  message += `📦 <b>Plano:</b> ${escapeTelegramHtml(plan)}\n`;
  message += `📅 <b>Data:</b> ${escapeTelegramHtml(createdAt)}\n`;

  const waUrl = phoneRaw ? generateWhatsAppUrl(phoneRaw, buildSignupWelcomeMessage(name)) : "";
  if (waUrl) {
    message += `\n💬 <b>WhatsApp:</b> <a href="${waUrl}">Abrir Conversa</a>`;
  }

  return message;
}
