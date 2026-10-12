// supabase/functions/_shared/whatsapp-client.ts

/**
 * Utilitário e Cliente para Integração com WhatsApp
 * Suporte nativo à Meta WhatsApp Cloud API (Graph API v19.0+) e Evolution API com fail-safe,
 * botões interativos, fallback resiliente e mensagens transacionais do Pluri Fisio.
 */

export type WhatsAppProvider = 'meta_cloud' | 'evolution';

export const DEFAULT_ADMIN_COMMERCIAL_PHONE = '5511980113936';

export interface WhatsAppClientConfig {
  provider?: WhatsAppProvider;
  apiUrl?: string;
  apiKey?: string;
  phoneNumberId?: string;
  graphApiVersion?: string;
  instanceName?: string;
  businessPhone?: string;
  adminCommercialPhone?: string;
}

export interface SendTextMessageOptions {
  delay?: number;
  linkPreview?: boolean;
}

export interface WhatsAppButton {
  id: string;
  label: string;
}

export interface WhatsAppListRow {
  id: string;
  title: string;
  description?: string;
}

export interface WhatsAppListSection {
  title?: string;
  rows: WhatsAppListRow[];
}

export interface SendListOptions {
  title?: string;
  footer?: string;
}

export interface SendButtonsOptions {
  title?: string;
  footer?: string;
  buttons: WhatsAppButton[];
}

export interface SendFlowMessageOptions {
  flowId?: string;
  flowToken?: string;
  buttonText?: string; // ex: "⚡ Abrir Formulário" (máx 20 chars para Meta)
  screenId?: string; // default "SCREEN_PATIENT_INFO"
  flowActionPayload?: Record<string, unknown>;
  title?: string;
  footer?: string;
  includeFallbackNotice?: boolean;
}

export interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'button';
  sub_type?: 'quick_reply' | 'url';
  index?: number | string;
  parameters?: Array<{
    type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
    text?: string;
    [key: string]: unknown;
  }>;
}

export interface SendTemplateOptions {
  languageCode?: string;
  components?: WhatsAppTemplateComponent[];
}

export interface WhatsAppWelcomeSequenceParams {
  phone: string;
  name?: string | null;
  plan?: string | null;
  clinicName?: string | null;
}

export interface WhatsAppPlanThankYouParams {
  phone: string;
  name?: string | null;
  planName?: string | null;
  clinicName?: string | null;
}

export interface WhatsAppResponse {
  success: boolean;
  skipped?: boolean;
  messageId?: string;
  error?: string;
  data?: unknown;
}

/**
 * Higieniza e padroniza números de telefone brasileiros no formato internacional E.164 (55 + DDD + 8 ou 9 dígitos).
 * Rejeita entradas com caracteres maliciosos ou comprimentos anômalos.
 */
export function sanitizeWhatsAppNumber(rawPhone?: string | null): string {
  if (!rawPhone) return '';
  // Remove tudo exceto dígitos
  let digits = String(rawPhone).replace(/\D/g, '');
  if (!digits || digits.length < 10 || digits.length > 15) return '';

  // Remove 0 inicial de DDD se houver (ex: 011999999999 -> 11999999999)
  if (digits.startsWith('0') && (digits.length === 11 || digits.length === 12)) {
    digits = digits.slice(1);
  }

  // Se tem 10 dígitos (DDD + 8 dígitos) ou 11 dígitos (DDD + 9 dígitos), adiciona DDI 55
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  // Se tem 12 ou 13 dígitos e já inicia com 55, mantém
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    return digits;
  }

  // Se tem entre 10 e 15 dígitos internacional
  if (digits.length >= 10 && digits.length <= 15) {
    return digits;
  }

  return '';
}

/**
 * Remove caracteres de controle perigosos, zero-width, bidi overrides e limita comprimento máximo.
 */
export function sanitizeMessageInput(input?: string | null, maxLength = 2000): string {
  if (!input) return '';
  return String(input)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // remove ASCII control characters
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '') // remove zero-width & bidi control overrides
    .trim()
    .slice(0, maxLength);
}

/**
 * Cliente Resiliente de WhatsApp para Pluri Fisio
 */
export class WhatsAppClient {
  private readonly provider: WhatsAppProvider;
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly phoneNumberId: string;
  private readonly graphApiVersion: string;
  private readonly instanceName: string;
  private readonly businessPhone: string;
  private readonly adminCommercialPhone: string;

  constructor(config?: WhatsAppClientConfig) {
    // Determinação do Provedor (Meta Cloud API por padrão, compatível com Evolution)
    const envProvider = (
      Deno.env.get('WHATSAPP_API_PROVIDER') ||
      Deno.env.get('WHATSAPP_PROVIDER') ||
      ''
    ).toLowerCase();

    if (config?.provider) {
      this.provider = config.provider;
    } else if (envProvider === 'evolution') {
      this.provider = 'evolution';
    } else {
      // Default: meta_cloud se houver token da Meta ou se for o padrão
      this.provider = 'meta_cloud';
    }

    this.graphApiVersion = (
      config?.graphApiVersion ||
      Deno.env.get('META_GRAPH_API_VERSION') ||
      'v19.0'
    ).trim();

    this.phoneNumberId = (
      config?.phoneNumberId ||
      Deno.env.get('META_PHONE_NUMBER_ID') ||
      Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ||
      ''
    ).trim();

    this.apiKey = (
      config?.apiKey ||
      Deno.env.get('META_WHATSAPP_TOKEN') ||
      Deno.env.get('WHATSAPP_API_KEY') ||
      Deno.env.get('EVOLUTION_API_KEY') ||
      ''
    ).trim();

    const rawUrl =
      config?.apiUrl ||
      Deno.env.get('WHATSAPP_API_URL') ||
      Deno.env.get('EVOLUTION_API_URL') ||
      (this.provider === 'meta_cloud'
        ? `https://graph.facebook.com/${this.graphApiVersion}`
        : '');
    this.apiUrl = rawUrl.replace(/\/+$/, '');

    this.instanceName = (
      config?.instanceName ||
      Deno.env.get('WHATSAPP_INSTANCE_NAME') ||
      Deno.env.get('EVOLUTION_INSTANCE_NAME') ||
      'plurifisio'
    ).trim();

    this.businessPhone = sanitizeWhatsAppNumber(
      config?.businessPhone ||
      Deno.env.get('WHATSAPP_BUSINESS_PHONE') ||
      '5511960474566'
    ) || '5511960474566';

    this.adminCommercialPhone = sanitizeWhatsAppNumber(
      config?.adminCommercialPhone ||
      Deno.env.get('ADMIN_COMMERCIAL_PHONE') ||
      Deno.env.get('WHATSAPP_ADMIN_RECIPIENT_PHONE') ||
      DEFAULT_ADMIN_COMMERCIAL_PHONE
    ) || DEFAULT_ADMIN_COMMERCIAL_PHONE;
  }

  /**
   * Identifica se as credenciais do WhatsApp estão devidamente configuradas para o provedor selecionado.
   */
  public isConfigured(): boolean {
    if (this.provider === 'meta_cloud') {
      return Boolean(this.apiKey && this.phoneNumberId);
    }
    return Boolean(this.apiUrl && this.apiKey);
  }

  /**
   * Obtém o número de telefone de contato oficial da plataforma.
   */
  public getBusinessPhone(): string {
    return this.businessPhone;
  }

  /**
   * Obtém o número de WhatsApp comercial do administrador/especialista humano para transbordo.
   */
  public getAdminCommercialPhone(): string {
    return this.adminCommercialPhone;
  }

  /**
   * Verifica se determinado número corresponde ao WhatsApp comercial de transbordo (Anti-Loop).
   */
  public isAdminCommercialPhone(phone?: string | null): boolean {
    const clean = sanitizeWhatsAppNumber(phone);
    return Boolean(clean && clean === this.adminCommercialPhone);
  }

  /**
   * Verifica se determinado número corresponde ao WhatsApp do próprio Bot/Plataforma (Anti-Loop).
   */
  public isBotBusinessPhone(phone?: string | null): boolean {
    const clean = sanitizeWhatsAppNumber(phone);
    return Boolean(clean && clean === this.businessPhone);
  }

  /**
   * Verifica se o número de telefone é interno da plataforma (Admin Comercial ou Bot) para prevenir loops.
   */
  public isInternalPlatformPhone(phone?: string | null): boolean {
    return this.isAdminCommercialPhone(phone) || this.isBotBusinessPhone(phone);
  }

  /**
   * Obtém o provedor ativo configurado.
   */
  public getProvider(): WhatsAppProvider {
    return this.provider;
  }

  /**
   * Envia uma mensagem de texto individual com suporte a delay e preview de links.
   * Fail-safe: Não lança exceção fatal se o serviço estiver indisponível.
   */
  async sendTextMessage(
    to: string,
    text: string,
    options?: SendTextMessageOptions
  ): Promise<WhatsAppResponse> {
    const cleanNumber = sanitizeWhatsAppNumber(to);
    if (!cleanNumber) {
      return { success: false, error: 'Número de telefone inválido ou fora dos padrões E.164.' };
    }

    const cleanText = sanitizeMessageInput(text, 4000);
    if (!cleanText) {
      return { success: false, error: 'Conteúdo da mensagem não pode ser vazio.' };
    }

    if (!this.isConfigured()) {
      console.warn(
        `[whatsapp-client] Credenciais de WhatsApp (${this.provider}) não configuradas. Envio de texto para ${cleanNumber} ignorado com fail-safe.`
      );
      return { success: false, skipped: true, error: 'Credenciais de WhatsApp não configuradas.' };
    }

    try {
      if (this.provider === 'meta_cloud') {
        const url = `${this.apiUrl}/${encodeURIComponent(this.phoneNumberId)}/messages`;
        const payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanNumber,
          type: 'text',
          text: {
            preview_url: options?.linkPreview ?? true,
            body: cleanText,
          },
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8000),
        });

        const responseData = await response.json().catch(() => null);

        if (!response.ok) {
          const errorDetail =
            responseData?.error?.message ||
            responseData?.error?.error_user_msg ||
            `HTTP ${response.status}`;
          console.error(`[whatsapp-client] Erro HTTP ${response.status} na Meta Cloud API:`, errorDetail);
          return {
            success: false,
            error: sanitizeMessageInput(errorDetail, 200),
            data: responseData,
          };
        }

        const messageId = responseData?.messages?.[0]?.id || undefined;
        return {
          success: true,
          messageId,
          data: responseData,
        };
      }

      // Provedor: Evolution API / Gateway REST
      const url = `${this.apiUrl}/message/sendText/${encodeURIComponent(this.instanceName)}`;
      const payload = {
        number: cleanNumber,
        text: cleanText,
        options: {
          delay: Math.min(Math.max(options?.delay ?? 1200, 0), 10000),
          presence: 'composing',
          linkPreview: options?.linkPreview ?? true,
        },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.apiKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });

      const responseData = await response.json().catch(() => null);

      if (!response.ok) {
        console.error(
          `[whatsapp-client] Erro HTTP ${response.status} retornado pela Evolution API:`,
          responseData?.message || responseData?.error || `HTTP ${response.status}`
        );
        return {
          success: false,
          error: sanitizeMessageInput(responseData?.message || responseData?.error || `HTTP ${response.status}`, 200),
          data: responseData,
        };
      }

      const messageId =
        responseData?.key?.id ||
        responseData?.id ||
        responseData?.messageId ||
        undefined;

      return {
        success: true,
        messageId,
        data: responseData,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[whatsapp-client] Exceção ao enviar mensagem de texto para ${cleanNumber}:`, errorMsg);
      return {
        success: false,
        error: sanitizeMessageInput(errorMsg, 200),
      };
    }
  }

  /**
   * Envia uma mensagem com botões interativos de resposta rápida.
   * Se o envio de botões não for suportado pelo canal do destinatário ou falhar,
   * aciona fallback transparente enviando texto formatado com instruções enumeradas.
   */
  async sendButtonsMessage(
    to: string,
    messageText: string,
    options: SendButtonsOptions
  ): Promise<WhatsAppResponse> {
    const cleanNumber = sanitizeWhatsAppNumber(to);
    if (!cleanNumber) {
      return { success: false, error: 'Número de telefone inválido ou fora dos padrões E.164.' };
    }

    const cleanText = sanitizeMessageInput(messageText, 4000);
    if (!cleanText) {
      return { success: false, error: 'Conteúdo da mensagem não pode ser vazio.' };
    }

    if (!this.isConfigured()) {
      console.warn(
        `[whatsapp-client] Credenciais de WhatsApp (${this.provider}) não configuradas. Envio de botões para ${cleanNumber} ignorado com fail-safe.`
      );
      return { success: false, skipped: true, error: 'Credenciais de WhatsApp não configuradas.' };
    }

    // 1. Envio de botões interativos
    if (this.provider === 'meta_cloud') {
      try {
        const url = `${this.apiUrl}/${encodeURIComponent(this.phoneNumberId)}/messages`;
        
        // Meta Cloud API suporta até 3 quick reply buttons com título de no máx 20 caracteres
        const metaButtons = (options.buttons || []).slice(0, 3).map((btn) => ({
          type: 'reply' as const,
          reply: {
            id: sanitizeMessageInput(btn.id, 256),
            title: sanitizeMessageInput(btn.label, 20),
          },
        }));

        const interactivePayload: Record<string, unknown> = {
          type: 'button',
          body: {
            text: cleanText,
          },
          action: {
            buttons: metaButtons,
          },
        };

        if (options.title) {
          interactivePayload.header = {
            type: 'text',
            text: sanitizeMessageInput(options.title, 60),
          };
        }

        if (options.footer) {
          interactivePayload.footer = {
            text: sanitizeMessageInput(options.footer, 60),
          };
        }

        const payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanNumber,
          type: 'interactive',
          interactive: interactivePayload,
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8000),
        });

        const responseData = await response.json().catch(() => null);

        if (response.ok && responseData?.messages?.[0]?.id) {
          return {
            success: true,
            messageId: responseData.messages[0].id,
            data: responseData,
          };
        }

        console.warn(
          `[whatsapp-client] Envio de botões Meta Cloud API falhou (${response.status}):`,
          responseData?.error?.message || 'Erro desconhecido. Ativando fallback para texto...'
        );
      } catch (metaErr) {
        console.warn('[whatsapp-client] Exceção no envio de botões Meta Cloud API. Ativando fallback:', metaErr);
      }
    } else {
      // Provedor Evolution API
      try {
        const url = `${this.apiUrl}/message/sendButtons/${encodeURIComponent(this.instanceName)}`;
        const evolutionButtons = (options.buttons || []).slice(0, 3).map((btn) => ({
          type: 'reply',
          displayText: sanitizeMessageInput(btn.label, 50),
          id: sanitizeMessageInput(btn.id, 50),
        }));

        const payload = {
          number: cleanNumber,
          title: sanitizeMessageInput(options.title || 'Pluri Fisio', 100),
          description: cleanText,
          footer: sanitizeMessageInput(options.footer || 'Selecione uma das opções abaixo:', 100),
          buttons: evolutionButtons,
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: this.apiKey,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8000),
        });

        const responseData = await response.json().catch(() => null);

        if (response.ok && (responseData?.key?.id || responseData?.status === 'SUCCESS' || responseData?.id)) {
          return {
            success: true,
            messageId: responseData?.key?.id || responseData?.id,
            data: responseData,
          };
        }

        console.warn(
          `[whatsapp-client] Envio de botões Evolution não respondeu com sucesso (${response.status}). Aplicando fallback de texto...`
        );
      } catch (btnErr) {
        console.warn('[whatsapp-client] Exceção no envio de botões Evolution. Ativando fallback para texto formatado:', btnErr);
      }
    }

    // 2. Fallback Resiliente Universal: Mensagem com numeração de opções em texto
    let fallbackText = cleanText + '\n\n';
    options.buttons.forEach((btn, idx) => {
      fallbackText += `*${idx + 1}* - ${sanitizeMessageInput(btn.label, 50)}\n`;
    });
    fallbackText += '\n_(Responda com o número ou nome da opção desejada)_';

    return await this.sendTextMessage(cleanNumber, fallbackText);
  }

  /**
   * Envia uma mensagem com lista interativa de opções (Menu / List Message da Meta Cloud API).
   * Se o envio da lista falhar ou não for suportado, aciona fallback resiliente enviando texto formatado com numeração.
   */
  async sendListMessage(
    to: string,
    bodyText: string,
    buttonText: string,
    sections: WhatsAppListSection[],
    options?: SendListOptions
  ): Promise<WhatsAppResponse> {
    const cleanNumber = sanitizeWhatsAppNumber(to);
    if (!cleanNumber) {
      return { success: false, error: 'Número de telefone inválido ou fora dos padrões E.164.' };
    }

    const cleanBody = sanitizeMessageInput(bodyText, 1024);
    if (!cleanBody) {
      return { success: false, error: 'Corpo da mensagem não pode ser vazio.' };
    }

    const cleanButtonText = sanitizeMessageInput(buttonText, 20) || 'Ver opções';

    if (!this.isConfigured()) {
      console.warn(
        `[whatsapp-client] Credenciais de WhatsApp (${this.provider}) não configuradas. Envio de lista para ${cleanNumber} ignorado com fail-safe.`
      );
      return { success: false, skipped: true, error: 'Credenciais de WhatsApp não configuradas.' };
    }

    // 1. Envio de Lista na Meta Cloud API
    if (this.provider === 'meta_cloud') {
      try {
        const url = `${this.apiUrl}/${encodeURIComponent(this.phoneNumberId)}/messages`;

        // Higieniza e formata seções (Meta suporta até 10 seções e 10 itens no total)
        const formattedSections = (sections || []).slice(0, 10).map((sec, idx) => ({
          title: sanitizeMessageInput(sec.title || `Opções ${idx + 1}`, 24),
          rows: (sec.rows || []).slice(0, 10).map((r) => ({
            id: sanitizeMessageInput(r.id, 200),
            title: sanitizeMessageInput(r.title, 24),
            ...(r.description ? { description: sanitizeMessageInput(r.description, 72) } : {}),
          })),
        }));

        const interactivePayload: Record<string, unknown> = {
          type: 'list',
          body: {
            text: cleanBody,
          },
          action: {
            button: cleanButtonText,
            sections: formattedSections,
          },
        };

        if (options?.title) {
          interactivePayload.header = {
            type: 'text',
            text: sanitizeMessageInput(options.title, 60),
          };
        }

        if (options?.footer) {
          interactivePayload.footer = {
            text: sanitizeMessageInput(options.footer, 60),
          };
        }

        const payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanNumber,
          type: 'interactive',
          interactive: interactivePayload,
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8000),
        });

        const responseData = await response.json().catch(() => null);

        if (response.ok && responseData?.messages?.[0]?.id) {
          return {
            success: true,
            messageId: responseData.messages[0].id,
            data: responseData,
          };
        }

        console.warn(
          `[whatsapp-client] Envio de lista Meta Cloud API falhou (${response.status}):`,
          responseData?.error?.message || 'Erro desconhecido. Ativando fallback para texto...'
        );
      } catch (metaListErr) {
        console.warn('[whatsapp-client] Exceção no envio de lista Meta Cloud API. Ativando fallback:', metaListErr);
      }
    } else {
      // Provedor Evolution API
      try {
        const url = `${this.apiUrl}/message/sendList/${encodeURIComponent(this.instanceName)}`;
        const evolutionSections = (sections || []).map((sec, idx) => ({
          title: sanitizeMessageInput(sec.title || `Opções ${idx + 1}`, 24),
          rows: (sec.rows || []).map((r) => ({
            title: sanitizeMessageInput(r.title, 24),
            description: r.description ? sanitizeMessageInput(r.description, 72) : '',
            rowId: sanitizeMessageInput(r.id, 200),
          })),
        }));

        const payload = {
          number: cleanNumber,
          title: sanitizeMessageInput(options?.title || 'Pluri Fisio', 100),
          description: cleanBody,
          buttonText: cleanButtonText,
          footerText: sanitizeMessageInput(options?.footer || '', 100),
          sections: evolutionSections,
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: this.apiKey,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8000),
        });

        const responseData = await response.json().catch(() => null);

        if (response.ok && (responseData?.key?.id || responseData?.status === 'SUCCESS' || responseData?.id)) {
          return {
            success: true,
            messageId: responseData?.key?.id || responseData?.id,
            data: responseData,
          };
        }

        console.warn(
          `[whatsapp-client] Envio de lista Evolution não respondeu com sucesso (${response.status}). Aplicando fallback de texto...`
        );
      } catch (listErr) {
        console.warn('[whatsapp-client] Exceção no envio de lista Evolution. Ativando fallback para texto formatado:', listErr);
      }
    }

    // 2. Fallback Resiliente Universal: Mensagem de Texto com Numeração de Opções
    let fallbackText = cleanBody + '\n\n';
    let optionCounter = 1;
    for (const section of sections || []) {
      if (section.title && (sections || []).length > 1) {
        fallbackText += `*${sanitizeMessageInput(section.title, 50)}:*\n`;
      }
      for (const row of section.rows || []) {
        fallbackText += `*${optionCounter}* - ${sanitizeMessageInput(row.title, 50)}`;
        if (row.description) {
          fallbackText += ` _(${sanitizeMessageInput(row.description, 70)})_`;
        }
        fallbackText += '\n';
        optionCounter++;
      }
      fallbackText += '\n';
    }
    fallbackText += '_(Responda digitando o número ou o dia desejado)_';

    return await this.sendTextMessage(cleanNumber, fallbackText.trim());
  }

  /**
   * Envia uma mensagem com WhatsApp Flow interativo (Meta WhatsApp Cloud API v19.0+ Flows v3.0 / v3.1)
   * Suporta modelo híbrido: texto já inclui instrução de fallback para o chat.
   * Se o envio do Flow falhar ou o provedor for Evolution, dispara fallback automático
   * com botões ou texto guiado.
   */
  async sendFlowMessage(
    to: string,
    messageText: string,
    options?: SendFlowMessageOptions
  ): Promise<WhatsAppResponse> {
    const cleanNumber = sanitizeWhatsAppNumber(to);
    if (!cleanNumber) {
      return { success: false, error: 'Número de telefone inválido ou fora dos padrões E.164.' };
    }

    const flowId =
      options?.flowId ||
      Deno.env.get('META_WHATSAPP_FLOW_ID') ||
      Deno.env.get('WHATSAPP_FLOW_ID') ||
      '';

    const flowToken =
      options?.flowToken ||
      `flow_token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const buttonText = sanitizeMessageInput(options?.buttonText || '⚡ Abrir Formulário', 20);
    const screenId = options?.screenId || 'SCREEN_PATIENT_INFO';
    const flowActionPayload = options?.flowActionPayload || { screen: screenId };

    // Modelo Híbrido: instrução clara de fallback no corpo da mensagem
    let finalBodyText = sanitizeMessageInput(messageText, 4000);
    const fallbackNotice =
      '\n\n💡 _Se o formulário não abrir no seu WhatsApp, toque no botão abaixo ou responda *1* para preencher conversando diretamente no chat!_';

    if (options?.includeFallbackNotice !== false && !finalBodyText.includes('não abrir no seu WhatsApp')) {
      finalBodyText += fallbackNotice;
    }

    if (!this.isConfigured()) {
      console.warn(
        `[whatsapp-client] Credenciais de WhatsApp (${this.provider}) não configuradas. Envio de Flow para ${cleanNumber} ignorado com fail-safe.`
      );
      return { success: false, skipped: true, error: 'Credenciais de WhatsApp não configuradas.' };
    }

    // 1. Envio de Flow nativo na Meta Cloud API
    if (this.provider === 'meta_cloud' && flowId) {
      try {
        const url = `${this.apiUrl}/${encodeURIComponent(this.phoneNumberId)}/messages`;

        const interactivePayload: Record<string, unknown> = {
          type: 'flow',
          body: {
            text: finalBodyText,
          },
          action: {
            name: 'flow',
            parameters: {
              flow_message_version: '3',
              flow_token: flowToken,
              flow_id: flowId,
              flow_cta: buttonText,
              flow_action: 'navigate',
              flow_action_payload: flowActionPayload,
            },
          },
        };

        if (options?.title) {
          interactivePayload.header = {
            type: 'text',
            text: sanitizeMessageInput(options.title, 60),
          };
        }

        if (options?.footer) {
          interactivePayload.footer = {
            text: sanitizeMessageInput(options.footer, 60),
          };
        }

        const payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanNumber,
          type: 'interactive',
          interactive: interactivePayload,
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8000),
        });

        const responseData = await response.json().catch(() => null);

        if (response.ok && responseData?.messages?.[0]?.id) {
          return {
            success: true,
            messageId: responseData.messages[0].id,
            data: responseData,
          };
        }

        console.warn(
          `[whatsapp-client] Envio de WhatsApp Flow falhou (${response.status}):`,
          responseData?.error?.message || 'Erro desconhecido. Ativando fallback para chat...'
        );
      } catch (flowErr) {
        console.warn('[whatsapp-client] Exceção ao enviar Flow da Meta. Ativando fallback conversacional:', flowErr);
      }
    }

    // 2. Fallback Híbrido Resiliente: Se Flow não estiver configurado ou falhar, envia botões de contingência
    return await this.sendButtonsMessage(cleanNumber, finalBodyText, {
      title: options?.title || 'Pré-Cadastro de Paciente',
      footer: options?.footer || 'PluriFisio',
      buttons: [
        { id: 'btn_flow_fallback_chat', label: '💬 Preencher no Chat' },
        { id: 'btn_owner_menu', label: '🏠 Menu Principal' },
      ],
    });
  }

  /**
   * Envia uma mensagem baseada em Template pré-aprovado da Meta WhatsApp Business API.
   */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    options?: SendTemplateOptions
  ): Promise<WhatsAppResponse> {
    const cleanNumber = sanitizeWhatsAppNumber(to);
    if (!cleanNumber) {
      return { success: false, error: 'Número de telefone inválido.' };
    }

    const cleanTemplateName = sanitizeMessageInput(templateName, 100);
    if (!cleanTemplateName) {
      return { success: false, error: 'Nome do template não pode ser vazio.' };
    }

    if (!this.isConfigured() || this.provider !== 'meta_cloud') {
      console.warn(
        `[whatsapp-client] Template message requer provedor meta_cloud devidamente configurado.`
      );
      return { success: false, skipped: true, error: 'Provedor Meta Cloud não configurado.' };
    }

    try {
      const url = `${this.apiUrl}/${encodeURIComponent(this.phoneNumberId)}/messages`;
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanNumber,
        type: 'template',
        template: {
          name: cleanTemplateName,
          language: {
            code: options?.languageCode || 'pt_BR',
          },
          ...(options?.components && options.components.length > 0
            ? { components: options.components }
            : {}),
        },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });

      const responseData = await response.json().catch(() => null);

      if (!response.ok) {
        const errorDetail =
          responseData?.error?.message ||
          responseData?.error?.error_user_msg ||
          `HTTP ${response.status}`;
        console.error(`[whatsapp-client] Erro HTTP ${response.status} no template Meta Cloud API:`, errorDetail);
        return {
          success: false,
          error: sanitizeMessageInput(errorDetail, 200),
          data: responseData,
        };
      }

      return {
        success: true,
        messageId: responseData?.messages?.[0]?.id,
        data: responseData,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[whatsapp-client] Exceção ao enviar template para ${cleanNumber}:`, errorMsg);
      return {
        success: false,
        error: sanitizeMessageInput(errorMsg, 200),
      };
    }
  }

  /**
   * Dispara a sequência de boas-vindas do Pluri Fisio com apresentação, acolhimento e botões de onboarding.
   */
  async sendWelcomeSequence(
    params: WhatsAppWelcomeSequenceParams
  ): Promise<WhatsAppResponse> {
    const cleanNumber = sanitizeWhatsAppNumber(params.phone);
    if (!cleanNumber) {
      return { success: false, error: 'Telefone inválido ou não informado.' };
    }

    const rawName = sanitizeMessageInput(params.name, 100);
    const firstName = rawName.split(' ')[0] || '';
    const displayName = firstName ? ` ${firstName}` : '';
    const planName = sanitizeMessageInput(params.plan, 80) || 'Teste Gratuito (7 dias)';

    // Mensagem de acolhimento e introdução estruturada do Pluri Fisio
    const welcomeText =
      `Olá${displayName}, tudo bem? Sou seu assistente da *PluriFisio*! 👋\n\n` +
      `Vimos que você criou sua conta no plano *${planName}*.\n` +
      `Seja muito bem-vindo(a)!\n\n` +
      `Sei que o dia a dia na clínica é corrido, então passei para me colocar 100% à sua disposição.\n\n` +
      `Se você quiser, posso fazer uma chamada rápida de 15 minutinhos com você para te mostrar os primeiros passos. ` +
      `Ou, se preferir explorar por conta própria e surgir qualquer pergunta, é só me mandar uma mensagem por aqui.`;

    // Títulos de botões com no máx 20 caracteres para conformidade rigorosa com a Meta API
    const buttons: WhatsAppButton[] = [
      { id: 'btn_schedule_intro', label: 'Agendar Introdução' },
      { id: 'btn_self_explore', label: 'Explorar sozinho' },
    ];

    return await this.sendButtonsMessage(cleanNumber, welcomeText, {
      title: 'PluriFisio - Boas-vindas',
      footer: 'Como prefere começar?',
      buttons,
    });
  }

  /**
   * Dispara confirmação e agradecimento de assinatura/upgrade do Pluri Fisio.
   */
  async sendPlanThankYouMessage(
    params: WhatsAppPlanThankYouParams
  ): Promise<WhatsAppResponse> {
    const cleanNumber = sanitizeWhatsAppNumber(params.phone);
    if (!cleanNumber) {
      return { success: false, error: 'Telefone inválido ou não informado.' };
    }

    const rawName = sanitizeMessageInput(params.name, 100);
    const firstName = rawName.split(' ')[0] || '';
    const displayName = firstName ? firstName : 'Doutor(a)';
    const planName = sanitizeMessageInput(params.planName, 80) || 'Pluri Fisio Pro';
    const clinicName = sanitizeMessageInput(params.clinicName, 100) || 'sua clínica';

    const thankYouText =
      `Parabéns, ${displayName}! 🎉\n\n` +
      `Confirmamos com sucesso a ativação do seu plano *${planName}* no *Pluri Fisio*.\n\n` +
      `Seus novos recursos e capacidade já foram liberados instantaneamente na sua clínica (*${clinicName}*).\n\n` +
      `Muito obrigado pela confiança em nossa plataforma! Se precisar de suporte prioritário, conte conosco por este canal.\n\n` +
      `👉 Acessar sistema: https://app.plurifisio.com.br`;

    return await this.sendTextMessage(cleanNumber, thankYouText, {
      delay: 1000,
      linkPreview: true,
    });
  }
}
