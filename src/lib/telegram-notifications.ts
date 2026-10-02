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

  let message = `🚀 <b>Novo Cadastro Realizado!</b>\n\n`;
  message += `👤 <b>Nome:</b> ${escapeTelegramHtml(name)}\n`;
  message += `📧 <b>E-mail:</b> ${escapeTelegramHtml(email)}\n`;
  message += `📱 <b>Telefone:</b> ${escapeTelegramHtml(phoneRaw || "Não informado")}\n`;
  message += `🏥 <b>Clínica / Consultório:</b> ${escapeTelegramHtml(clinicName)}\n`;
  message += `📦 <b>Plano:</b> ${escapeTelegramHtml(plan)}\n`;
  message += `📅 <b>Data:</b> ${escapeTelegramHtml(createdAt)}\n`;

  const waUrl = phoneRaw ? generateWhatsAppUrl(phoneRaw, buildSignupWelcomeMessage(name)) : "";
  if (waUrl) {
    message += `\n💬 <b>WhatsApp:</b> <a href="${waUrl}">Abrir Conversa</a>`;
  }

  return message;
}
