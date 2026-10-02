// supabase/functions/_shared/telegram-client.ts

export interface SendTelegramMessageOptions {
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  replyMarkup?: {
    inline_keyboard: Array<Array<{ text: string; url?: string; callback_data?: string }>>;
  };
}

export interface NotifyNewSignupParams {
  name?: string | null;
  email: string;
  phone?: string | null;
  clinicName?: string | null;
  plan?: string | null;
  createdAt?: string | null;
}

export interface NotifyPlanPurchaseParams {
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
 */
export function sanitizePhoneNumber(rawPhone?: string | null): string {
  if (!rawPhone) return '';
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return '';

  // Se tem 10 dígitos (DDD + 8 dígitos) ou 11 dígitos (DDD + 9 dígitos), adiciona DDI 55
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  // Se tem 12 ou 13 dígitos e já começa com 55, mantém
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    return digits;
  }

  return digits;
}

/**
 * Cria o link direto para iniciar conversa no WhatsApp com mensagem predefinida.
 */
export function generateWhatsAppUrl(phone: string, text: string): string {
  const sanitized = sanitizePhoneNumber(phone);
  if (!sanitized) return '';
  return `https://wa.me/${sanitized}?text=${encodeURIComponent(text)}`;
}

/**
 * Escapa caracteres HTML para exibição segura no Telegram com parse_mode: 'HTML'.
 * Previne HTML Injection contra formatação indevida de tags na Bot API.
 */
export function escapeHtml(text?: string | null): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Cliente Telegram Bot API Fail-safe.
 */
export class TelegramClient {
  private readonly botToken: string;
  private readonly adminChatId: string;

  constructor() {
    this.botToken = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
    this.adminChatId = Deno.env.get('TELEGRAM_ADMIN_CHAT_ID') || '';
  }

  /**
   * Envia uma mensagem arbitrária para o chat configurado no Telegram.
   * Não lança exceção em caso de falha nem trava fluxos críticos (Fail-safe).
   * Timeout estrito de 5000ms para evitar chamadas bloqueantes.
   */
  async sendMessage(
    text: string,
    options?: SendTelegramMessageOptions
  ): Promise<{ success: boolean; messageId?: number; skipped?: boolean; error?: string }> {
    if (!this.botToken || !this.adminChatId) {
      console.warn(
        '[telegram-client] TELEGRAM_BOT_TOKEN ou TELEGRAM_ADMIN_CHAT_ID não configurados. Envio ignorado com sucesso gracioso.'
      );
      return { success: true, skipped: true };
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const body: Record<string, unknown> = {
        chat_id: this.adminChatId,
        text,
        parse_mode: options?.parseMode || 'HTML',
        disable_web_page_preview: false,
      };

      if (options?.replyMarkup) {
        body.reply_markup = options.replyMarkup;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });

      const responseData = await response.json();

      if (!response.ok || !responseData.ok) {
        console.error('[telegram-client] Erro retornado pela API do Telegram:', responseData);
        return {
          success: false,
          error: responseData?.description || `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        messageId: responseData.result?.message_id,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[telegram-client] Exceção de rede ao enviar mensagem para Telegram:', msg);
      return {
        success: false,
        error: msg,
      };
    }
  }

  /**
   * Notifica a equipe de administração sobre novo cadastro orgânico na plataforma.
   */
  async notifyNewSignup(params: NotifyNewSignupParams): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
    try {
      const name = params.name?.trim() || 'Não informado';
      const email = params.email.trim();
      const phoneRaw = params.phone || '';
      const clinicName = params.clinicName?.trim() || 'Consultório Solo';
      const plan = params.plan?.trim() || 'Degustação Gratuita (7 dias)';
      const createdAt = params.createdAt
        ? new Date(params.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        : new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

      const whatsappText = `Olá ${name}! Seja bem-vindo(a) ao Pluri Health. Sou da equipe de suporte e gostaria de saber se precisa de ajuda nos primeiros passos!`;
      const waUrl = phoneRaw ? generateWhatsAppUrl(phoneRaw, whatsappText) : '';

      let message = `🚀 <b>Novo Cadastro Realizado!</b>\n\n`;
      message += `👤 <b>Nome:</b> ${escapeHtml(name)}\n`;
      message += `📧 <b>E-mail:</b> ${escapeHtml(email)}\n`;
      message += `📱 <b>Telefone:</b> ${escapeHtml(phoneRaw || 'Não informado')}\n`;
      message += `🏥 <b>Clínica / Consultório:</b> ${escapeHtml(clinicName)}\n`;
      message += `📦 <b>Plano:</b> ${escapeHtml(plan)}\n`;
      message += `📅 <b>Data:</b> ${escapeHtml(createdAt)}\n`;

      if (waUrl) {
        message += `\n💬 <b>WhatsApp:</b> <a href="${waUrl}">Abrir Conversa</a>`;
      }

      const options: SendTelegramMessageOptions = {
        parseMode: 'HTML',
      };

      if (waUrl) {
        options.replyMarkup = {
          inline_keyboard: [
            [
              {
                text: '💬 Conversar no WhatsApp',
                url: waUrl,
              },
            ],
          ],
        };
      }

      return await this.sendMessage(message, options);
    } catch (err: unknown) {
      console.error('[telegram-client] Erro em notifyNewSignup (fail-safe):', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Notifica a equipe de administração sobre compra/confirmação de pagamento de plano.
   */
  async notifyPlanPurchase(params: NotifyPlanPurchaseParams): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
    try {
      const clinicName = params.clinicName?.trim() || 'Clínica';
      const subscriberName = params.subscriberName?.trim() || 'Assinante';
      const email = params.email?.trim() || 'Não informado';
      const phoneRaw = params.phone || '';
      const planName = params.planName?.trim() || 'Plano Pluri Health';
      const billingCycle = params.billingCycle?.trim() || 'Mensal';
      const amountFormatted = params.amountFormatted?.trim() || 'R$ 0,00';
      const paymentMethod = params.paymentMethod?.trim() || 'PIX / Cartão';
      const paidAt = params.paidAt
        ? new Date(params.paidAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        : new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

      const whatsappText = `Olá ${subscriberName}! Parabéns pela adesão ao plano ${planName} no Pluri Health! Estamos aqui para garantir o seu melhor aproveitamento.`;
      const waUrl = phoneRaw ? generateWhatsAppUrl(phoneRaw, whatsappText) : '';

      let message = `💰 <b>Nova Assinatura / Pagamento Confirmado!</b>\n\n`;
      message += `🏥 <b>Clínica:</b> ${escapeHtml(clinicName)}\n`;
      message += `👤 <b>Assinante:</b> ${escapeHtml(subscriberName)}\n`;
      message += `📧 <b>E-mail:</b> ${escapeHtml(email)}\n`;
      message += `📱 <b>Telefone:</b> ${escapeHtml(phoneRaw || 'Não informado')}\n`;
      message += `💎 <b>Plano:</b> ${escapeHtml(planName)}\n`;
      message += `🔄 <b>Ciclo:</b> ${escapeHtml(billingCycle)}\n`;
      message += `💵 <b>Valor Pago:</b> <b>${escapeHtml(amountFormatted)}</b>\n`;
      message += `💳 <b>Forma de Pagamento:</b> ${escapeHtml(paymentMethod)}\n`;
      message += `📅 <b>Data de Confirmação:</b> ${escapeHtml(paidAt)}\n`;

      if (waUrl) {
        message += `\n💬 <b>WhatsApp:</b> <a href="${waUrl}">Abrir Conversa</a>`;
      }

      const options: SendTelegramMessageOptions = {
        parseMode: 'HTML',
      };

      if (waUrl) {
        options.replyMarkup = {
          inline_keyboard: [
            [
              {
                text: '💬 Conversar no WhatsApp',
                url: waUrl,
              },
            ],
          ],
        };
      }

      return await this.sendMessage(message, options);
    } catch (err: unknown) {
      console.error('[telegram-client] Erro em notifyPlanPurchase (fail-safe):', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
