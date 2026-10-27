import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';
import { WhatsAppClient, sanitizeWhatsAppNumber, sanitizeMessageInput } from '../_shared/whatsapp-client.ts';
import { TelegramClient, escapeHtml } from '../_shared/telegram-client.ts';
import {
  getNextBusinessDays,
  getAvailableWindowsForDay,
  formatAvailableWindowsText,
  validateSelectedTime,
  parseTimeToMinutes,
  generateGoogleCalendarUrl,
  ExistingMeeting,
  fetchGoogleCalendarBusySlots,
} from '../_shared/calendar-utils.ts';
import { getGlobalFeatureFlag } from '../_shared/feature-flags-client.ts';
import { verifyTotpCode } from '../_shared/totp-utils.ts';
import {
  TUTORIAL_ENTE_AUTH_NO_2FA,
  TUTORIAL_ENTE_AUTH_HOW_TO_USE,
  TUTORIAL_ACCOUNT_NOT_FOUND,
  isSessionAuthenticated,
  getNewAuthExpiresAt,
} from '../_shared/whatsapp-auth-helper.ts';
import {
  OwnerCustomerContext,
  RESTRICTED_NON_OWNER_MESSAGE,
  sendOwnerMainMenu,
  sendSupportMenu,
  sendFinanceMenu,
  handleFinancePixInvoice,
  handleFinanceNfse,
  handleFinanceUpgrade,
  handleBugReportSubmission,
  sendRecordsMenu,
  sendTermsMenu,
  handleTermsOption,
  handleQuickPatientPreRegistrationFlow,
  handleFlowPreRegistrationSubmission,
  PreRegistrationStateData,
  sendAgendaMenu,
  sendNewAppointmentTypeMenu,
  handleAgendaCreationFlow,
  handleAgendaFull,
  handleAgendaNext,
  handleAppointmentAction,
  handleAppointmentEditFlow,
  AppointmentActionType,
  AgendaStateData,
  isGlobalCancelCommand,
  isGlobalBackCommand,
} from './owner-copilot.ts';

/**
 * Interface unificada para payloads do Webhook da Meta WhatsApp Cloud API e Evolution API
 */
interface MetaWebhookEntry {
  id?: string;
  changes?: Array<{
    field?: string;
    value?: {
      messaging_product?: string;
      metadata?: {
        display_phone_number?: string;
        phone_number_id?: string;
      };
      contacts?: Array<{
        profile?: {
          name?: string;
        };
        wa_id?: string;
      }>;
      messages?: Array<{
        from?: string;
        id?: string;
        timestamp?: string;
        type?: string;
        text?: {
          body?: string;
        };
        interactive?: {
          type?: string;
          button_reply?: {
            id?: string;
            title?: string;
          };
          list_reply?: {
            id?: string;
            title?: string;
            description?: string;
          };
          nfm_reply?: {
            response_json?: string;
            body?: string;
            name?: string;
          };
        };
        button?: {
          payload?: string;
          text?: string;
        };
        image?: {
          id?: string;
          mime_type?: string;
          sha256?: string;
          caption?: string;
        };
      }>;
      statuses?: Array<{
        id?: string;
        status?: string;
        recipient_id?: string;
      }>;
    };
  }>;
}

interface WebhookPayload {
  // Meta Cloud API
  object?: string;
  entry?: MetaWebhookEntry[];

  // Evolution API
  event?: string;
  type?: string;
  instance?: string;
  data?: {
    key?: {
      remoteJid?: string;
      fromMe?: boolean;
      id?: string;
    };
    pushName?: string;
    messageType?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: {
        text?: string;
      };
      buttonsResponseMessage?: {
        selectedButtonId?: string;
        selectedDisplayText?: string;
      };
      templateButtonReplyMessage?: {
        selectedId?: string;
        selectedDisplayText?: string;
      };
      listResponseMessage?: {
        singleSelectReply?: {
          selectedRowId?: string;
        };
      };
      imageMessage?: {
        url?: string;
        mimetype?: string;
        caption?: string;
      };
    };
    messageTimestamp?: number | string;
  };
}

interface ProfileLookupRecord {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  profession?: string | null;
  council_name?: string | null;
  professional_license?: string | null;
  totp_secret?: string | null;
  totp_enabled?: boolean | null;
}

// Map de rate limiting em memória por chave (IP ou Telefone): máximo 15 requisições por minuto
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_RATE_LIMIT_MAP_SIZE = 2000;

function checkRateLimit(key: string, limit = 15, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (rateLimitMap.size > 500) {
    for (const [k, v] of rateLimitMap.entries()) {
      if (now > v.resetAt) rateLimitMap.delete(k);
    }
    // Se ainda exceder o limite de proteção de memória
    if (rateLimitMap.size > MAX_RATE_LIMIT_MAP_SIZE) {
      const firstKeys = Array.from(rateLimitMap.keys()).slice(0, 500);
      for (const k of firstKeys) rateLimitMap.delete(k);
    }
  }

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count += 1;
  return true;
}

// Comparação em tempo constante com hashing SHA-256 para mitigar timing attacks e vazamento de comprimento
async function timingSafeEqualString(a: string, b: string): Promise<boolean> {
  if (!a || !b) {
    return false;
  }
  const encoder = new TextEncoder();
  const [aDigest, bDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ]);
  const aView = new Uint8Array(aDigest);
  const bView = new Uint8Array(bDigest);
  let mismatch = 0;
  for (let i = 0; i < aView.length; i++) {
    mismatch |= aView[i] ^ bView[i];
  }
  return mismatch === 0;
}

function sanitizeInput(text?: string | null, maxLen = 500): string {
  return sanitizeMessageInput(text, maxLen);
}

function isValidEmail(email?: string | null): boolean {
  if (!email) return false;
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());
}

/**
 * Mascaramento de dados pessoais para conformidade com LGPD nos logs da aplicação
 */
function maskPhoneLgpd(phone?: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return '***';
  return `${digits.slice(0, 4)}****${digits.slice(-4)}`;
}

function maskEmailLgpd(email?: string | null): string {
  if (!email || !email.includes('@')) return '***';
  const [user, domain] = email.split('@');
  const maskedUser = user.length > 2 ? `${user[0]}***${user[user.length - 1]}` : '***';
  return `${maskedUser}@${domain}`;
}

export async function handleWhatsAppWebhookHandler(req: Request): Promise<Response> {
  // 1. Handshake de Verificação da Meta WhatsApp Business API (GET)
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    const verifyToken = (
      Deno.env.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN') ||
      Deno.env.get('META_WEBHOOK_VERIFY_TOKEN') ||
      Deno.env.get('WHATSAPP_WEBHOOK_SECRET') ||
      Deno.env.get('EVOLUTION_WEBHOOK_SECRET') ||
      ''
    ).trim();

    if (mode === 'subscribe') {
      if (verifyToken && token && (await timingSafeEqualString(token, verifyToken))) {
        console.log('[whatsapp-webhook] Handshake de verificação da Meta concluído com sucesso.');
        return new Response(challenge || '', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      console.warn('[whatsapp-webhook] Handshake da Meta rejeitado: verify_token ausente ou inválido.');
      return new Response('Verificação falhou. Token inválido.', { status: 403 });
    }

    return new Response('Webhook endpoint ativo.', {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });
  }

  // 2. CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown-ip';

  // Rate limit no IP do webhook
  if (!checkRateLimit(`ip:${clientIp}`, 60, 60_000)) {
    console.warn(`[whatsapp-webhook] Rate limit de IP excedido: ${clientIp}`);
    return new Response(JSON.stringify({ error: 'Muitas requisições. Tente novamente mais tarde.' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[whatsapp-webhook] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados.');
    return new Response(JSON.stringify({ error: 'Configuração do servidor incompleta.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Validação opcional de Secret/Token para proteção antiforjamento do webhook (Evolution ou proxy)
  const configuredSecret = (
    Deno.env.get('WHATSAPP_WEBHOOK_SECRET') ||
    Deno.env.get('EVOLUTION_WEBHOOK_SECRET') ||
    ''
  ).trim();

  // Apenas valida secret se houver um header específico de webhook (x-webhook-secret ou x-api-key)
  // Evita 401 indevido se a requisição vier com apikey/authorization padrão da anon_key ou service_role do Supabase
  const receivedWebhookSecret = (
    req.headers.get('x-webhook-secret') ||
    req.headers.get('x-api-key') ||
    ''
  ).trim();

  if (configuredSecret && receivedWebhookSecret && !(await timingSafeEqualString(receivedWebhookSecret, configuredSecret))) {
    console.warn('[whatsapp-webhook] Rejeição de webhook: Secret inválido em x-webhook-secret.');
    return new Response(JSON.stringify({ error: 'Acesso não autorizado.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const rawBody = await req.json().catch(() => null);
    const body: WebhookPayload =
      rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody) ? rawBody : {};

    // Variáveis unificadas de evento
    let rawNumber = '';
    let pushName = '';
    let selectedButtonId = '';
    let userMessageText = '';
    let imageUrl = '';
    let isFromMe = false;
    let incomingMessageId = '';
    let incomingTimestampSec = 0;
    let flowResponseJson: Record<string, unknown> | null = null;

    // A. IDENTIFICAÇÃO E PARSING DO FORMATO META WHATSAPP CLOUD API
    if (body.object === 'whatsapp_business_account' || (Array.isArray(body.entry) && body.entry.length > 0)) {
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const changeValue = change?.value;

      // Se for atualização de status de envio/leitura (statuses), retorna 200 OK graciosamente
      if (changeValue?.statuses && (!changeValue.messages || changeValue.messages.length === 0)) {
        return new Response(JSON.stringify({ success: true, ignored: true, type: 'status_update' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const metaMsg = changeValue?.messages?.[0];
      if (!metaMsg) {
        return new Response(JSON.stringify({ success: true, ignored: true, reason: 'no_messages' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      rawNumber = metaMsg.from || '';
      incomingMessageId = String(metaMsg.id || '').trim();
      incomingTimestampSec = Number(metaMsg.timestamp || 0);
      pushName = changeValue?.contacts?.[0]?.profile?.name || '';

      // Botão interativo, lista ou WhatsApp Flow na Meta API
      if (metaMsg.type === 'interactive') {
        const interactive = metaMsg.interactive;
        if (interactive?.type === 'nfm_reply' && interactive?.nfm_reply?.response_json) {
          try {
            const rawJsonStr = String(interactive.nfm_reply.response_json).trim();
            // Limite de segurança para payload do Flow (máx 64KB) para prevenir ataques de esgotamento de memória (DoS)
            if (rawJsonStr.length <= 65536) {
              const parsed = JSON.parse(rawJsonStr);
              if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                // Prevenção de prototype pollution
                const safePayload: Record<string, unknown> = Object.create(null);
                for (const [key, val] of Object.entries(parsed)) {
                  if (key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
                    safePayload[key] = val;
                  }
                }
                flowResponseJson = safePayload;
              } else {
                flowResponseJson = null;
              }
            } else {
              console.warn('[whatsapp-webhook] Rejeitado nfm_reply.response_json excedendo limite de 64KB');
              flowResponseJson = null;
            }
          } catch {
            flowResponseJson = null;
          }
          selectedButtonId = 'flow_nfm_reply';
          userMessageText = 'Formulário de Pré-Cadastro preenchido';
        } else {
          selectedButtonId =
            interactive?.button_reply?.id ||
            interactive?.list_reply?.id ||
            '';
          userMessageText =
            interactive?.button_reply?.title ||
            interactive?.list_reply?.title ||
            selectedButtonId;
        }
      } else if (metaMsg.type === 'button') {
        selectedButtonId = metaMsg.button?.payload || '';
        userMessageText = metaMsg.button?.text || selectedButtonId;
      } else if (metaMsg.type === 'text') {
        userMessageText = metaMsg.text?.body || '';
      } else if (metaMsg.type === 'image') {
        userMessageText = metaMsg.image?.caption || '';
        imageUrl = metaMsg.image?.id ? `https://graph.facebook.com/v19.0/${metaMsg.image.id}` : '';
      }
    } else {
      // B. IDENTIFICAÇÃO E PARSING DO FORMATO EVOLUTION API / GATEWAY REST
      const eventType = String(body.event || body.type || 'UNKNOWN').trim();

      // Se o evento não for de mensagem recebida (ex: connection.update, qrcode.updated, messages.update), responde 200 OK graciosamente
      if (
        eventType !== 'messages.upsert' &&
        eventType !== 'MESSAGES_UPSERT' &&
        !body.data?.message
      ) {
        return new Response(JSON.stringify({ success: true, ignored: true, event: eventType }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (eventType === 'messages.update' || eventType === 'MESSAGES_UPDATE') {
        return new Response(JSON.stringify({ success: true, ignored: true, event: eventType }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const key = body.data?.key;
      isFromMe = key?.fromMe === true;
      incomingMessageId = String(key?.id || '').trim();
      const rawEvoTs = Number(body.data?.messageTimestamp || 0);
      incomingTimestampSec = rawEvoTs > 1e11 ? Math.floor(rawEvoTs / 1000) : rawEvoTs;

      if (isFromMe) {
        return new Response(JSON.stringify({ success: true, ignored: true, reason: 'from_me' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const remoteJid = key?.remoteJid || '';
      rawNumber = remoteJid.split('@')[0]?.split(':')[0] || '';
      pushName = body.data?.pushName || '';

      const messageObj = body.data?.message || {};
      selectedButtonId =
        messageObj.buttonsResponseMessage?.selectedButtonId ||
        messageObj.templateButtonReplyMessage?.selectedId ||
        messageObj.listResponseMessage?.singleSelectReply?.selectedRowId ||
        '';

      userMessageText =
        selectedButtonId ||
        messageObj.conversation ||
        messageObj.extendedTextMessage?.text ||
        messageObj.imageMessage?.caption ||
        '';
      if (messageObj.imageMessage?.url) {
        imageUrl = messageObj.imageMessage.url;
      }
    }

    const phone = sanitizeWhatsAppNumber(rawNumber);

    if (!phone) {
      console.warn('[whatsapp-webhook] Mensagem recebida sem número de telefone válido:', rawNumber);
      return new Response(JSON.stringify({ success: true, ignored: true, reason: 'invalid_phone' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // BLOQUEIO ANTI-REPLAY / ANTI-RETENTATIVA ATRASADA:
    // Se o webhook traz um timestamp de criação > 120 segundos atrás, é retentativa atrasada da Meta/Evolution
    if (incomingTimestampSec > 1700000000) {
      const ageSeconds = Math.floor(Date.now() / 1000) - incomingTimestampSec;
      if (ageSeconds > 120) {
        console.warn(
          `[whatsapp-webhook] Ignorando webhook atrasado/retentativa (age=${ageSeconds}s, msgId=${incomingMessageId}) para ${maskPhoneLgpd(phone)}`
        );
        return new Response(
          JSON.stringify({ success: true, ignored: true, reason: 'stale_webhook_retry', ageSeconds }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Rate limiting por número de telefone de origem (máx 15 mensagens/minuto)
    if (!checkRateLimit(`phone:${phone}`, 15, 60_000)) {
      console.warn(`[whatsapp-webhook] Rate limit excedido para o telefone ${maskPhoneLgpd(phone)}`);
      return new Response(JSON.stringify({ success: false, error: 'Rate limit excedido para este número.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cleanSelectedButtonId = sanitizeInput(selectedButtonId, 60);
    const userText = sanitizeInput(userMessageText, 1000);
    const userTextLower = userText.toLowerCase();

    // Ignora eventos de protocolo, sincronização ou recibos sem texto/botão/imagem/flow
    if (!userText && !cleanSelectedButtonId && !imageUrl && !flowResponseJson) {
      return new Response(JSON.stringify({ success: true, ignored: true, reason: 'empty_message_or_protocol_sync' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(
      `[whatsapp-webhook] Mensagem recebida de ${maskPhoneLgpd(phone)} [msgId=${incomingMessageId}]: "${userText.slice(0, 100)}" (ButtonId: "${cleanSelectedButtonId}")`
    );

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const whatsAppClient = new WhatsAppClient();
    const telegramClient = new TelegramClient();
    const adminCommercialPhone = whatsAppClient.getAdminCommercialPhone();

    // 0. SEGURANÇA & ANTI-LOOP:
    // Se a mensagem originou do próprio número do Bot (+55 11 96047-4566),
    // encerra a execução imediatamente com 200 OK para prevenir loops recursivos de auto-resposta.
    // O número comercial do admin (+55 11 98011-3936) NÃO é bloqueado aqui para que o admin possa interagir e testar o bot livremente.
    if (whatsAppClient.isBotBusinessPhone(phone)) {
      console.log(`[whatsapp-webhook] Mensagem originada do número do bot (${phone}). Execução encerrada para mitigar loop recursivo.`);
      return new Response(JSON.stringify({ success: true, ignored: true, reason: 'bot_business_phone_anti_loop' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Recuperar ou criar a sessão do usuário no banco de dados
    const { data: existingSession, error: sessionErr } = await supabase
      .from('whatsapp_chat_sessions')
      .select('id, phone, user_id, clinic_id, current_step, metadata, is_authenticated, auth_expires_at, authenticated_at')
      .eq('phone', phone)
      .maybeSingle();

    if (sessionErr) {
      console.error('[whatsapp-webhook] Erro ao buscar whatsapp_chat_sessions:', sessionErr);
    }

    let session = existingSession;

    // Helper para buscar dados detalhados do cliente/profissional com Governança e Detecção de Papel
    const customer = await (async () => {
      let userId = session?.user_id || null;
      let clinicId: string | null = session?.clinic_id || null;
      let userName = sanitizeInput(pushName, 100) || 'Doutor(a)';
      let userEmail = 'Não cadastrado';
      let clinicName = 'Consultório Solo';
      let planName = 'Teste Gratuito (7 dias)';
      let professionInfo = 'Não informada';
      let isOwnerOrAdmin = false;
      let activeRole = 'guest';

      const isMasterCommercial = whatsAppClient.isAdminCommercialPhone(phone);
      if (isMasterCommercial) {
        isOwnerOrAdmin = true;
        activeRole = 'platform_admin';
      }

      // Geração abrangente de variantes numéricas e com máscara para busca no Brasil
      const digitsOnly = phone.replace(/\D/g, '');
      const nationalPhone = digitsOnly.startsWith('55') ? digitsOnly.slice(2) : digitsOnly;
      const last8Digits = digitsOnly.length >= 8 ? digitsOnly.slice(-8) : digitsOnly;

      const phoneVariants = new Set<string>();
      if (phone) phoneVariants.add(phone);
      if (digitsOnly) phoneVariants.add(digitsOnly);
      if (nationalPhone) phoneVariants.add(nationalPhone);

      // Se for celular com DDD (2 dígitos) + 9 dígitos (ex: 11980113936)
      if (nationalPhone.length === 11 && nationalPhone.charAt(2) === '9') {
        const ddd = nationalPhone.slice(0, 2);
        const numWithout9 = ddd + nationalPhone.slice(3); // 10 dígitos (sem o 9º)
        phoneVariants.add(numWithout9);
        phoneVariants.add(`55${numWithout9}`);
        phoneVariants.add(`+55${nationalPhone}`);
        phoneVariants.add(`+55${numWithout9}`);
        // Formatações com máscara comuns
        const p1 = nationalPhone.slice(2, 7);
        const p2 = nationalPhone.slice(7);
        phoneVariants.add(`(${ddd}) ${nationalPhone.slice(2, 7)}-${p2}`);
        phoneVariants.add(`(${ddd}) ${nationalPhone.slice(2)}`);
        phoneVariants.add(`+55 (${ddd}) ${p1}-${p2}`);
        phoneVariants.add(`+55 ${ddd} ${p1}-${p2}`);
        phoneVariants.add(`+55 ${ddd} ${nationalPhone.slice(2)}`);
      } else if (nationalPhone.length === 10) {
        // Celular ou fixo com 10 dígitos (DDD + 8 dígitos) -> gerar variante com 9º dígito se celular
        const ddd = nationalPhone.slice(0, 2);
        const numWith9 = ddd + '9' + nationalPhone.slice(2); // 11 dígitos
        phoneVariants.add(numWith9);
        phoneVariants.add(`55${numWith9}`);
        phoneVariants.add(`+55${nationalPhone}`);
        phoneVariants.add(`+55${numWith9}`);
        const p1 = nationalPhone.slice(2, 6);
        const p2 = nationalPhone.slice(6);
        phoneVariants.add(`(${ddd}) ${p1}-${p2}`);
        phoneVariants.add(`+55 (${ddd}) ${p1}-${p2}`);
        phoneVariants.add(`+55 ${ddd} ${p1}-${p2}`);
      }

      let profileData: ProfileLookupRecord | null = null;

      if (userId) {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone, profession, council_name, professional_license, totp_secret, totp_enabled')
          .eq('id', userId)
          .maybeSingle();
        profileData = data as ProfileLookupRecord | null;
        console.log(`[whatsapp-webhook] Profile lookup by existing userId (${userId}): found=${!!profileData}, totp_enabled=${profileData?.totp_enabled}, has_secret=${!!profileData?.totp_secret}`);
      }

      // Se não encontrou por userId ou se o userId da sessão não possui 2FA ativo,
      // busca na tabela profiles testando todas as variantes de telefone, priorizando perfis com 2FA ativo
      if ((!profileData || !profileData.totp_secret) && phoneVariants.size > 0) {
        const variantsList = Array.from(phoneVariants);
        const { data: matchedProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone, profession, council_name, professional_license, totp_secret, totp_enabled')
          .in('phone', variantsList)
          .order('totp_enabled', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(5);

        if (matchedProfiles && matchedProfiles.length > 0) {
          // Prefere perfil que tem 2FA configurado
          const with2fa = matchedProfiles.find((p) => p.totp_enabled && p.totp_secret);
          profileData = (with2fa || matchedProfiles[0]) as ProfileLookupRecord;
          console.log(`[whatsapp-webhook] Phone variants lookup: matched=${matchedProfiles.length}, chosenId=${profileData.id}, totp_enabled=${profileData.totp_enabled}, has_secret=${!!profileData.totp_secret}`);
        }
      }

      // Se ainda não encontrou e temos ao menos 8 dígitos finais, tenta ilike defensivo
      if ((!profileData || !profileData.totp_secret) && last8Digits.length >= 8) {
        const { data: ilikeProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone, profession, council_name, professional_license, totp_secret, totp_enabled')
          .ilike('phone', `%${last8Digits}`)
          .order('totp_enabled', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(5);

        if (ilikeProfiles && ilikeProfiles.length > 0) {
          const with2fa = ilikeProfiles.find((p) => p.totp_enabled && p.totp_secret);
          profileData = (with2fa || ilikeProfiles[0]) as ProfileLookupRecord;
        }
      }

      // Se ainda não encontrou por variantes normais, busca profiles com phone preenchido e compara dígitos puros
      if ((!profileData || !profileData.totp_secret) && digitsOnly.length >= 8) {
        const { data: allPhones } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone, profession, council_name, professional_license, totp_secret, totp_enabled')
          .not('phone', 'is', null)
          .order('totp_enabled', { ascending: false })
          .limit(200);

        if (allPhones && allPhones.length > 0) {
          const matched = allPhones.filter((p) => {
            if (!p.phone) return false;
            const pDigits = p.phone.replace(/\D/g, '');
            const pNational = pDigits.startsWith('55') ? pDigits.slice(2) : pDigits;
            return (
              pDigits === digitsOnly ||
              pNational === nationalPhone ||
              (pDigits.length >= 8 && digitsOnly.endsWith(pDigits.slice(-8))) ||
              (pDigits.length >= 8 && pDigits.endsWith(last8Digits))
            );
          });
          if (matched.length > 0) {
            const with2fa = matched.find((p) => p.totp_enabled && p.totp_secret);
            profileData = (with2fa || matched[0]) as ProfileLookupRecord;
          }
        }
      }

      // Se ainda não encontrou profile ou se não possui 2FA e for o admin comercial oficial:
      // Busca platform_admins priorizando quem possui 2FA ativo
      if ((!profileData || !profileData.totp_secret) && isMasterCommercial) {
        const { data: adminList } = await supabase
          .from('platform_admins')
          .select('user_id')
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(5);

        if (adminList && adminList.length > 0) {
          const adminUserIds = adminList.map((a) => a.user_id);
          const { data: adminProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, email, phone, profession, council_name, professional_license, totp_secret, totp_enabled')
            .in('id', adminUserIds);

          if (adminProfiles && adminProfiles.length > 0) {
            const with2fa = adminProfiles.find((p) => p.totp_enabled && p.totp_secret);
            profileData = (with2fa || adminProfiles[0]) as ProfileLookupRecord;
          }
        }
      }

      let memberships: Array<{ id: string; clinic_id: string; operational_role: string | null; role_key: string | null; is_active: boolean }> = [];

      if (profileData) {
        userId = profileData.id;
        if (profileData.full_name) userName = sanitizeInput(profileData.full_name, 100);
        if (profileData.email) userEmail = sanitizeInput(profileData.email, 150);

        const profParts = [profileData.profession, profileData.council_name, profileData.professional_license]
          .filter(Boolean)
          .map((p: unknown) => String(p).trim());
        if (profParts.length > 0) {
          professionInfo = sanitizeInput(profParts.join(' - '), 150);
        }

        // 1. Checar se é platform_admin
        const { data: adminRecord } = await supabase
          .from('platform_admins')
          .select('id, is_active')
          .eq('user_id', profileData.id)
          .eq('is_active', true)
          .maybeSingle();

        if (adminRecord || isMasterCommercial) {
          isOwnerOrAdmin = true;
          activeRole = 'platform_admin';
        }

        // 2. Checar clinic_memberships (operational_role = 'owner')
        const { data: userMemberships } = await supabase
          .from('clinic_memberships')
          .select('id, clinic_id, operational_role, role_key, is_active')
          .eq('user_id', profileData.id)
          .eq('is_active', true);
        memberships = (userMemberships || []) as typeof memberships;

        const ownerMembership = (memberships || []).find(
          (m) => m.operational_role === 'owner' || m.role_key === 'owner'
        );

        if (ownerMembership) {
          isOwnerOrAdmin = true;
          if (activeRole !== 'platform_admin') activeRole = 'owner';
          clinicId = ownerMembership.clinic_id;
        } else if (!isOwnerOrAdmin && memberships && memberships.length > 0) {
          // Possui membership mas NÃO é owner
          activeRole = memberships[0].operational_role || memberships[0].role_key || 'member';
          clinicId = memberships[0].clinic_id;
        }

        // 3. Checar se é titular direto na tabela clinics (account_owner_user_id)
        const { data: clinic } = await supabase
          .from('clinics')
          .select('id, name, subscription_plan')
          .eq('account_owner_user_id', profileData.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (clinic) {
          isOwnerOrAdmin = true;
          if (activeRole !== 'platform_admin') activeRole = 'owner';
          clinicId = clinic.id;
          if (clinic.name) clinicName = sanitizeInput(clinic.name, 100);
          if (clinic.subscription_plan) planName = sanitizeInput(clinic.subscription_plan, 80);
        } else if (clinicId) {
          // Busca nome e plano da clínica encontrada no membership
          const { data: foundClinic } = await supabase
            .from('clinics')
            .select('id, name, subscription_plan')
            .eq('id', clinicId)
            .maybeSingle();
          if (foundClinic) {
            if (foundClinic.name) clinicName = sanitizeInput(foundClinic.name, 100);
            if (foundClinic.subscription_plan) planName = sanitizeInput(foundClinic.subscription_plan, 80);
          }
        }
      }

      // Se for admin comercial ou platform_admin e ainda não tiver clinicId:
      // Busca a clínica mestre mais recente ativa no sistema como fallback defensivo
      if ((isMasterCommercial || activeRole === 'platform_admin') && !clinicId) {
        const { data: defaultClinic } = await supabase
          .from('clinics')
          .select('id, name, subscription_plan')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (defaultClinic) {
          clinicId = defaultClinic.id;
          if (defaultClinic.name) clinicName = sanitizeInput(defaultClinic.name, 100);
          if (defaultClinic.subscription_plan) planName = sanitizeInput(defaultClinic.subscription_plan, 80);
        }
      }

      // 4. Buscar plano mais recente em clinic_subscriptions
      if (clinicId) {
        const { data: subData } = await supabase
          .from('clinic_subscriptions')
          .select('plan_type, status, total_recurring_monthly_price')
          .eq('clinic_id', clinicId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (subData?.plan_type) {
          planName = sanitizeInput(subData.plan_type, 80);
        }
      }

      // 5. Garantia final para admin comercial oficial
      if (isMasterCommercial) {
        isOwnerOrAdmin = true;
        activeRole = 'platform_admin';
        if (!userName || userName === 'Doutor(a)') {
          userName = 'Administrador Master';
        }
      }

      const planLower = planName.toLowerCase();
      const isSoloPlan =
        planLower === 'prof_basico' ||
        planLower === 'prof_medio' ||
        planLower === 'prof_top' ||
        planLower.includes('solo') ||
        planLower.includes('prof');
      const isClinicPlan = !isSoloPlan;

      return {
        userId,
        clinicId,
        userName,
        userEmail,
        clinicName,
        planName,
        professionInfo,
        isOwnerOrAdmin,
        isSoloPlan,
        isClinicPlan,
        activeRole,
        totpEnabled: !!(profileData?.totp_enabled || profileData?.totp_secret),
        totpSecret: profileData?.totp_secret || null,
        memberships: memberships || [],
      };
    })();

    // Se a sessão ainda não existir, cria com os dados cadastrais encontrados
    if (!session) {
      const { data: newSession, error: insertErr } = await supabase
        .from('whatsapp_chat_sessions')
        .insert({
          phone,
          user_id: customer.userId,
          clinic_id: customer.clinicId,
          current_step: 'initial',
          metadata: {
            user_name: customer.userName,
            clinic_name: customer.clinicName,
            plan_name: customer.planName,
            profession_info: customer.professionInfo,
            user_email: customer.userEmail,
            is_owner: customer.isOwnerOrAdmin,
            active_role: customer.activeRole,
          },
        })
        .select()
        .single();

      if (insertErr) {
        console.error('[whatsapp-webhook] Erro ao criar whatsapp_chat_sessions:', insertErr);
      } else {
        session = newSession;
      }
    } else if (customer.userId && (session.user_id !== customer.userId || !session.clinic_id)) {
      // Se a sessão estava desatualizada ou com outro usuário sem 2FA, re-associa ao usuário correto
      await supabase
        .from('whatsapp_chat_sessions')
        .update({
          user_id: customer.userId,
          clinic_id: customer.clinicId || session.clinic_id,
        })
        .eq('phone', phone);
      session.user_id = customer.userId;
      if (customer.clinicId) session.clinic_id = customer.clinicId;
    }

    const currentStep = session?.current_step || 'initial';
    const metadata = (session?.metadata || {}) as Record<string, unknown>;

    // DEDUPLICAÇÃO PERSISTENTE POR MESSAGE_ID (Impede retentativas da Meta/Evolution de reprocessarem a mesma mensagem)
    if (incomingMessageId) {
      const processedIds = Array.isArray(metadata.processed_message_ids)
        ? (metadata.processed_message_ids as string[])
        : [];
      if (processedIds.includes(incomingMessageId)) {
        console.log(
          `[whatsapp-webhook] Mensagem duplicada ignorada via processed_message_ids (msgId=${incomingMessageId}) para ${maskPhoneLgpd(phone)}`
        );
        return new Response(
          JSON.stringify({ success: true, ignored: true, reason: 'duplicate_message_id', messageId: incomingMessageId }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      const nextProcessedIds = [...processedIds.slice(-19), incomingMessageId];
      metadata.processed_message_ids = nextProcessedIds;
      await supabase
        .from('whatsapp_chat_sessions')
        .update({
          metadata,
        })
        .eq('phone', phone);
    }

    const userName = customer.userName || sanitizeInput((metadata.user_name as string) || pushName || 'Doutor(a)', 80);
    const clinicName = customer.clinicName || sanitizeInput((metadata.clinic_name as string) || 'Consultório Solo', 80);
    const planName = customer.planName || sanitizeInput((metadata.plan_name as string) || 'Teste Gratuito (7 dias)', 60);
    const userEmail = customer.userEmail || (metadata.user_email as string) || 'Não cadastrado';
    const professionInfo = customer.professionInfo || (metadata.profession_info as string) || 'Não informada';

    // Leitura resiliente de Feature Flags com fallback
    const [
      bookingFlowEnabled,
      gcalSyncEnabled,
      smartBuffersEnabled,
      transbordoEnabled,
      whatsappFlowsEnabled,
    ] = await Promise.all([
      getGlobalFeatureFlag(supabase, 'agenda_whatsapp_booking_flow', true),
      getGlobalFeatureFlag(supabase, 'agenda_google_calendar_sync', true),
      getGlobalFeatureFlag(supabase, 'agenda_smart_blocks_buffers', true),
      getGlobalFeatureFlag(supabase, 'notifications_whatsapp_transbordo', true),
      getGlobalFeatureFlag(supabase, 'whatsapp_flows_enabled', true),
    ]);

    const ownerContext: OwnerCustomerContext = {
      userId: customer.userId,
      clinicId: customer.clinicId,
      userName,
      userEmail,
      clinicName,
      planName,
      professionInfo,
      isOwnerOrAdmin: customer.isOwnerOrAdmin,
      isSoloPlan: customer.isSoloPlan,
      isClinicPlan: customer.isClinicPlan,
      activeRole: customer.activeRole,
    };

    // ---------------------------------------------------------------------------------
    // 0. FLUXO DE AUTENTICAÇÃO VIA NÚMERO DE CELULAR E 2FA (ENTE AUTH)
    // ---------------------------------------------------------------------------------
    // Detecta se a mensagem é comando de login (isolado ou com código inline: "login 167611", "entrar\n167611")
    const loginMatch = userText.match(/^\s*(?:login|entrar)(?:[\s:\-]+(\d{6}))?\s*$/i);
    const isLoginCommand = Boolean(loginMatch) || cleanSelectedButtonId === 'btn_auth_login';
    const inlineToken = loginMatch?.[1] || null;

    const isLogoutCommand =
      userTextLower === 'sair' ||
      userTextLower === 'desconectar' ||
      cleanSelectedButtonId === 'btn_auth_logout';

    const isResetCommand =
      userTextLower === 'reset' ||
      userTextLower === 'reiniciar' ||
      userTextLower === 'destravar' ||
      userTextLower === 'limpar' ||
      cleanSelectedButtonId === 'btn_reset_session';

    const isSwitchClinicCommand =
      userTextLower === 'trocar clinica' ||
      userTextLower === 'trocar clínica' ||
      cleanSelectedButtonId === 'btn_switch_clinic';

    const isHelpCommand =
      userTextLower === 'ajuda' ||
      userTextLower === 'help';

    const isCancelOrEscape =
      isGlobalCancelCommand(userText) ||
      isGlobalBackCommand(userText) ||
      isResetCommand ||
      cleanSelectedButtonId === 'btn_cancel_flow';

    // A. Comando explícito de LOGOUT / SAIR ou RESET Global
    if (isLogoutCommand || (isResetCommand && !isSessionAuthenticated(session))) {
      await supabase
        .from('whatsapp_chat_sessions')
        .update({
          is_authenticated: false,
          authenticated_at: null,
          auth_expires_at: null,
          current_step: 'initial',
          last_message_at: new Date().toISOString(),
          metadata: { ...metadata, logged_out_at: new Date().toISOString() },
        })
        .eq('phone', phone);

      const replyMsg = isResetCommand
        ? `🔄 *Sessão reiniciada com sucesso!*\n\nQualquer fluxo pendente foi cancelado.\nPara acessar os dados da sua clínica, digite *login* ou envie diretamente *login <código>* (ex: *login 123456*).`
        : `👋 *Sessão encerrada com sucesso!*\n\nVocê foi desconectado do Bot PluriFisio.\nSeus lembretes e alertas automáticos de consulta continuarão chegando normalmente por aqui.\n\nPara interagir novamente com os comandos, basta digitar *login* ou *entrar*.`;

      await whatsAppClient.sendTextMessage(phone, replyMsg);

      return new Response(JSON.stringify({ success: true, step: isResetCommand ? 'session_reset' : 'logged_out' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Função auxiliar reutilizável para autenticar com token 2FA verificado
    const processTotpAuthentication = async (tokenCode: string) => {
      if (!customer.totpSecret) {
        return { success: false, reason: 'no_secret' };
      }
      const isValid = await verifyTotpCode(customer.totpSecret, tokenCode);
      if (!isValid) {
        return { success: false, reason: 'invalid_token' };
      }

      // Token correto! Buscar clínicas do usuário (via memberships e titularidade direta)
      const [{ data: userMemberships }, { data: ownedClinics }] = await Promise.all([
        supabase
          .from('clinic_memberships')
          .select('clinic_id, clinics(id, name, subscription_plan)')
          .eq('user_id', customer.userId)
          .eq('is_active', true),
        supabase
          .from('clinics')
          .select('id, name, subscription_plan')
          .eq('account_owner_user_id', customer.userId),
      ]);

      const clinicMap = new Map<string, { id: string; name: string }>();
      (userMemberships || []).forEach((m: any) => {
        if (m.clinics?.id) clinicMap.set(m.clinics.id, { id: m.clinics.id, name: m.clinics.name });
      });
      (ownedClinics || []).forEach((c: any) => {
        if (c.id) clinicMap.set(c.id, { id: c.id, name: c.name });
      });

      if (clinicMap.size === 0 && customer.clinicId) {
        clinicMap.set(customer.clinicId, { id: customer.clinicId, name: customer.clinicName });
      }

      const clinicsList = Array.from(clinicMap.values());
      const newExpiresAt = getNewAuthExpiresAt();

      if (clinicsList.length > 1) {
        await supabase
          .from('whatsapp_chat_sessions')
          .update({
            is_authenticated: true,
            authenticated_at: new Date().toISOString(),
            auth_expires_at: newExpiresAt,
            current_step: 'waiting_clinic_selection',
            last_message_at: new Date().toISOString(),
            metadata: {
              ...metadata,
              available_clinics: clinicsList.map((c) => ({ id: c.id, name: c.name })),
            },
          })
          .eq('phone', phone);

        let clinicSelectionText =
          `✅ *Código verificado com sucesso!*\n\n` +
          `Você possui acesso a mais de uma clínica. Digite o número correspondente para selecionar:\n\n`;

        clinicsList.forEach((c, index: number) => {
          clinicSelectionText += `*${index + 1}* - ${c.name}\n`;
        });

        clinicSelectionText += `\n💡 _Dica: Digite *cancelar* para sair._`;

        await whatsAppClient.sendTextMessage(phone, clinicSelectionText);
        return { success: true, step: 'waiting_clinic_selection' };
      } else {
        const singleClinic = clinicsList[0];
        const activeClinicId = singleClinic?.id || customer.clinicId;
        const activeClinicName = singleClinic?.name || customer.clinicName;

        await supabase
          .from('whatsapp_chat_sessions')
          .update({
            is_authenticated: true,
            authenticated_at: new Date().toISOString(),
            auth_expires_at: newExpiresAt,
            clinic_id: activeClinicId,
            current_step: 'owner_menu',
            last_message_at: new Date().toISOString(),
            metadata: {
              ...metadata,
              clinic_name: activeClinicName,
            },
          })
          .eq('phone', phone);

        await whatsAppClient.sendTextMessage(
          phone,
          `🎉 *Acesso liberado com sucesso para a clínica ${activeClinicName}!*\nSua sessão permanecerá ativa pelas próximas 5 horas de inatividade.`
        );

        await sendOwnerMainMenu(whatsAppClient, phone, {
          ...ownerContext,
          clinicId: activeClinicId,
          clinicName: activeClinicName,
        });

        return { success: true, step: 'auth_complete_single_clinic' };
      }
    };

    // B. Destravamento/Escape durante etapas de autenticação intermediárias
    if ((currentStep === 'waiting_2fa_token' || currentStep === 'waiting_clinic_selection') && isCancelOrEscape) {
      await supabase
        .from('whatsapp_chat_sessions')
        .update({
          current_step: 'initial',
          last_message_at: new Date().toISOString(),
        })
        .eq('phone', phone);

      await whatsAppClient.sendTextMessage(
        phone,
        `🔄 *Operação cancelada.*\n\nVocê retornou ao início. Para tentar se autenticar novamente, digite *login* ou *entrar*.`
      );

      return new Response(JSON.stringify({ success: true, step: 'auth_cancelled' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // C. Usuário está na etapa de validação do token 2FA
    if (currentStep === 'waiting_2fa_token') {
      // Se usuário digitou ajuda durante a etapa do token
      if (isHelpCommand) {
        await whatsAppClient.sendTextMessage(phone, TUTORIAL_ENTE_AUTH_HOW_TO_USE);
        return new Response(JSON.stringify({ success: true, step: 'waiting_2fa_token_help' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Se o usuário digitou login/entrar/oi novamente, não trata como token inválido; reenvia prompt ou reinicia
      if (isLoginCommand && userText.replace(/\D/g, '').length !== 6) {
        await whatsAppClient.sendTextMessage(
          phone,
          `entre no seu app de autenticação, copie e cole aqui o código token da pluri para realizar o seu login\n\n💡 _Dica: Digite *ajuda* para instruções ou *cancelar* para voltar ao início._`
        );
        return new Response(JSON.stringify({ success: true, step: 'waiting_2fa_token_prompt_repeated' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const cleanDigits = userText.replace(/\D/g, '');
      if (cleanDigits.length === 6 && customer.totpSecret) {
        const authResult = await processTotpAuthentication(cleanDigits);
        if (authResult.success) {
          return new Response(JSON.stringify({ success: true, step: authResult.step }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          // Token inválido ou expirado
          await whatsAppClient.sendTextMessage(
            phone,
            `❌ *Código incorreto ou expirado.*\n\nO código do Ente Auth muda a cada 30 segundos. Por favor, confira o código mais recente no app e tente novamente.\n\n💡 _Dica: Digite *ajuda* para ver o tutorial ou *cancelar* para voltar ao menu inicial._`
          );
          return new Response(JSON.stringify({ success: true, step: 'waiting_2fa_token_invalid' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        await whatsAppClient.sendTextMessage(
          phone,
          `⚠️ Por favor, envie os *6 números* do código gerado no aplicativo Ente Auth (ex: 123456).\n` +
          `Se precisar de instruções digite *ajuda*, ou digite *cancelar* para sair.`
        );
        return new Response(JSON.stringify({ success: true, step: 'waiting_2fa_token_non_digits' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    }

    // D. Usuário está na etapa de seleção de clínica
    if (currentStep === 'waiting_clinic_selection') {
      const availableClinics = (metadata.available_clinics || []) as Array<{ id: string; name: string }>;
      const selectedIndex = parseInt(userText.trim(), 10) - 1;

      if (!isNaN(selectedIndex) && availableClinics[selectedIndex]) {
        const chosenClinic = availableClinics[selectedIndex];
        const newExpiresAt = getNewAuthExpiresAt();

        await supabase
          .from('whatsapp_chat_sessions')
          .update({
            clinic_id: chosenClinic.id,
            current_step: 'owner_menu',
            auth_expires_at: newExpiresAt,
            last_message_at: new Date().toISOString(),
            metadata: {
              ...metadata,
              clinic_name: chosenClinic.name,
            },
          })
          .eq('phone', phone);

        await whatsAppClient.sendTextMessage(
          phone,
          `🏥 *Clínica selecionada: ${chosenClinic.name}!*\nContexto atualizado com sucesso.`
        );

        await sendOwnerMainMenu(whatsAppClient, phone, {
          ...ownerContext,
          clinicId: chosenClinic.id,
          clinicName: chosenClinic.name,
        });

        return new Response(JSON.stringify({ success: true, step: 'clinic_selected' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        let clinicSelectionText =
          `⚠️ Opção inválida. Por favor, digite o *número* correspondente à clínica desejada:\n\n`;
        availableClinics.forEach((c, index) => {
          clinicSelectionText += `*${index + 1}* - ${c.name}\n`;
        });
        clinicSelectionText += `\n💡 _Ou digite *cancelar* para voltar ao menu inicial._`;

        await whatsAppClient.sendTextMessage(phone, clinicSelectionText);
        return new Response(JSON.stringify({ success: true, step: 'waiting_clinic_selection_retry' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // E. Comando explícito de LOGIN ou ENTRAR
    if (isLoginCommand) {
      // 0. Se já estiver autenticado e ativo na sessão
      if (isSessionAuthenticated(session)) {
        await whatsAppClient.sendTextMessage(
          phone,
          `✅ *Você já está conectado ao Pluri-Health!*\n\nCaso queira sair ou trocar de conta, basta digitar *sair*.`
        );
        return new Response(JSON.stringify({ success: true, step: 'already_authenticated' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Trava de concorrência / Idempotência (evita mensagens duplicadas caso o webhook chegue repetido)
      const nowMs = Date.now();
      const lastLoginLock = metadata.login_lock_at ? Number(metadata.login_lock_at) : 0;
      if (lastLoginLock && nowMs - lastLoginLock < 4000) {
        console.log(`[whatsapp-webhook] Requisição concorrente de login ignorada (idempotência) para ${phone}`);
        return new Response(JSON.stringify({ success: true, step: 'login_locked_idempotent' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[whatsapp-webhook] Processing login command for phone=${phone}: userId=${customer.userId}, totpEnabled=${customer.totpEnabled}, hasSecret=${!!customer.totpSecret}`);

      // 1. Número não encontrado no sistema
      if (!customer.userId) {
        await whatsAppClient.sendTextMessage(phone, TUTORIAL_ACCOUNT_NOT_FOUND);
        return new Response(JSON.stringify({ success: true, step: 'auth_account_not_found' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 2. Número encontrado mas 2FA não está ativado
      if (!customer.totpEnabled || !customer.totpSecret) {
        await whatsAppClient.sendTextMessage(phone, TUTORIAL_ENTE_AUTH_NO_2FA);
        return new Response(JSON.stringify({ success: true, step: 'auth_2fa_not_enabled' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 3. Número encontrado com 2FA ativo
      // Se o usuário já enviou o código inline (ex: "login 167611" ou "entrar\n167611")
      if (inlineToken) {
        const authResult = await processTotpAuthentication(inlineToken);
        if (authResult.success) {
          return new Response(JSON.stringify({ success: true, step: authResult.step, inline: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          // Token inline incorreto ou expirado -> já coloca a sessão em waiting_2fa_token para facilitar retentativa imediata
          await supabase
            .from('whatsapp_chat_sessions')
            .update({
              current_step: 'waiting_2fa_token',
              last_message_at: new Date().toISOString(),
              metadata: {
                ...metadata,
                auth_requested_at: new Date().toISOString(),
                login_lock_at: nowMs,
              },
            })
            .eq('phone', phone);

          await whatsAppClient.sendTextMessage(
            phone,
            `❌ *Código incorreto ou expirado.*\n\nO código do Ente Auth muda a cada 30 segundos. Por favor, confira o código mais recente no app e envie aqui os 6 dígitos para concluir o login.\n\n💡 _Dica: Digite *ajuda* para ver o tutorial ou *cancelar* para voltar ao início._`
          );
          return new Response(JSON.stringify({ success: true, step: 'waiting_2fa_token_inline_invalid' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Se enviou apenas "login" ou "entrar" -> solicitar token
      await supabase
        .from('whatsapp_chat_sessions')
        .update({
          current_step: 'waiting_2fa_token',
          last_message_at: new Date().toISOString(),
          metadata: {
            ...metadata,
            auth_requested_at: new Date().toISOString(),
            login_lock_at: nowMs,
          },
        })
        .eq('phone', phone);

      await whatsAppClient.sendTextMessage(
        phone,
        `entre no seu app de autenticação, copie e cole aqui o código token da pluri para realizar o seu login\n\n💡 _Dica: Da próxima vez você pode enviar direto *login <código>* (ex: *login 123456*)!_`
      );

      return new Response(JSON.stringify({ success: true, step: 'waiting_2fa_token' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // F. Comando TROCAR CLÍNICA (quando autenticado)
    if (isSwitchClinicCommand) {
      if (customer.userId) {
        const [{ data: userMemberships }, { data: ownedClinics }] = await Promise.all([
          supabase
            .from('clinic_memberships')
            .select('clinic_id, clinics(id, name, subscription_plan)')
            .eq('user_id', customer.userId)
            .eq('is_active', true),
          supabase
            .from('clinics')
            .select('id, name, subscription_plan')
            .eq('account_owner_user_id', customer.userId),
        ]);

        const clinicMap = new Map<string, { id: string; name: string }>();
        (userMemberships || []).forEach((m: any) => {
          if (m.clinics?.id) clinicMap.set(m.clinics.id, { id: m.clinics.id, name: m.clinics.name });
        });
        (ownedClinics || []).forEach((c: any) => {
          if (c.id) clinicMap.set(c.id, { id: c.id, name: c.name });
        });

        const clinicsList = Array.from(clinicMap.values());

        if (clinicsList.length > 1) {
          const newExpiresAt = getNewAuthExpiresAt();
          await supabase
            .from('whatsapp_chat_sessions')
            .update({
              current_step: 'waiting_clinic_selection',
              auth_expires_at: newExpiresAt,
              last_message_at: new Date().toISOString(),
              metadata: {
                ...metadata,
                available_clinics: clinicsList.map((c) => ({ id: c.id, name: c.name })),
              },
            })
            .eq('phone', phone);

          let clinicSelectionText =
            `🔄 *Troca de Clínica*\n\nSelecione o número da clínica que deseja gerenciar agora:\n\n`;
          clinicsList.forEach((c: any, index: number) => {
            clinicSelectionText += `*${index + 1}* - ${c.name}\n`;
          });
          clinicSelectionText += `\n💡 _Ou digite *cancelar* para manter a clínica atual._`;

          await whatsAppClient.sendTextMessage(phone, clinicSelectionText);
          return new Response(JSON.stringify({ success: true, step: 'waiting_clinic_selection' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          await whatsAppClient.sendTextMessage(
            phone,
            `🏥 Você possui apenas a clínica *${customer.clinicName}* vinculada à sua conta.`
          );
          return new Response(JSON.stringify({ success: true, step: 'single_clinic_no_switch' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }


    // F. VERIFICAÇÃO DE SESSÃO ATIVA (Timeout de 5 horas de inatividade)
    const isSessionActive = isSessionAuthenticated(session);

    // Se o usuário tentar enviar comandos sem estar autenticado (ou com sessão expirada):
    if (!isSessionActive) {
      // 0. Detecção inteligente de código TOTP isolado de 6 dígitos mesmo fora de waiting_2fa_token
      const standaloneDigitsMatch = userText.trim().match(/^(\d{6})$/);
      if (standaloneDigitsMatch && customer.totpSecret) {
        const tokenCandidate = standaloneDigitsMatch[1];
        console.log(`[whatsapp-webhook] Código de 6 dígitos solto recebido de ${maskPhoneLgpd(phone)}. Tentando autenticação direta.`);
        const authResult = await processTotpAuthentication(tokenCandidate);
        if (authResult.success) {
          return new Response(JSON.stringify({ success: true, step: authResult.step, standalone_token: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Se não for comando de agendamento de lead/onboarding (Gatilhos do Onboarding público)
      const isPublicOnboardingFlow =
        cleanSelectedButtonId.startsWith('onboarding_') ||
        cleanSelectedButtonId.startsWith('slot_') ||
        cleanSelectedButtonId.startsWith('time_') ||
        currentStep.startsWith('onboarding_');

      if (!isPublicOnboardingFlow) {
        // Encerra sessão caso estivesse marcada como autenticada anteriormente mas expirou
        const nowMs = Date.now();
        const lastAuthPromptAt = metadata.last_auth_prompt_at ? Number(metadata.last_auth_prompt_at) : 0;
        const shouldThrottlePrompt = lastAuthPromptAt && nowMs - lastAuthPromptAt < 60_000; // Throttle de 1 min

        if (session?.is_authenticated) {
          await supabase
            .from('whatsapp_chat_sessions')
            .update({
              is_authenticated: false,
              authenticated_at: null,
              auth_expires_at: null,
              current_step: 'initial',
              last_message_at: new Date().toISOString(),
              metadata: {
                ...metadata,
                last_auth_prompt_at: nowMs,
              },
            })
            .eq('phone', phone);
        } else if (!shouldThrottlePrompt) {
          await supabase
            .from('whatsapp_chat_sessions')
            .update({
              last_message_at: new Date().toISOString(),
              metadata: {
                ...metadata,
                last_auth_prompt_at: nowMs,
              },
            })
            .eq('phone', phone);
        }

        if (!shouldThrottlePrompt) {
          const expiredOrNotLoggedText =
            `🔒 *Sessão não autenticada no WhatsApp*\n\n` +
            `Para acessar os dados e comandos da sua clínica, é necessário se autenticar.\n\n` +
            `👉 Digite *login* ou envie diretamente *login <código>* (ex: *login 123456* com o código do Ente Auth).`;

          await whatsAppClient.sendTextMessage(phone, expiredOrNotLoggedText);
        }

        return new Response(JSON.stringify({ success: true, step: 'auth_required', throttled: !!shouldThrottlePrompt }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Sessão autenticada ativa! Renova o timeout para mais 5 horas a cada comando executado
      const renewedExpiresAt = getNewAuthExpiresAt();
      await supabase
        .from('whatsapp_chat_sessions')
        .update({
          auth_expires_at: renewedExpiresAt,
          last_message_at: new Date().toISOString(),
        })
        .eq('phone', phone);
    }

    // ---------------------------------------------------------------------------------
    // 1. GOVERNANÇA ESTRITA DE ACESSO: Restrição para não-titulares
    // Se o remetente pertence a um usuário cadastrado que NÃO é titular/owner nem admin da plataforma:
    // Responde com mensagem cordial e restritiva, encerrando o atendimento sem abrir opções de gestão/financeiro.
    // ---------------------------------------------------------------------------------
    if (customer.userId && !customer.isOwnerOrAdmin) {
      console.warn(
        `[whatsapp-webhook] Acesso restrito acionado para ${maskPhoneLgpd(phone)}: Usuário ${customer.userId} com papel ${customer.activeRole} não é titular/admin.`
      );
      await whatsAppClient.sendTextMessage(phone, RESTRICTED_NON_OWNER_MESSAGE);
      return new Response(JSON.stringify({ success: true, restricted: true, role: customer.activeRole }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---------------------------------------------------------------------------------
    // 2. COPILOTO DO TITULAR (FASE A): ROTEAMENTO DE BOTÕES E COMANDOS
    // ---------------------------------------------------------------------------------

    // A. Abertura do Menu Principal Interativo
    const isOwnerMenuTrigger =
      cleanSelectedButtonId === 'btn_owner_menu' ||
      cleanSelectedButtonId === 'menu' ||
      userTextLower === 'menu' ||
      userTextLower === 'ajuda' ||
      userTextLower === 'opcoes' ||
      userTextLower === 'opções' ||
      userTextLower === 'iniciar' ||
      userTextLower === 'ola' ||
      userTextLower === 'olá' ||
      userTextLower === 'oi';

    if (customer.isOwnerOrAdmin && isOwnerMenuTrigger) {
      await supabase
        .from('whatsapp_chat_sessions')
        .update({
          current_step: 'owner_menu',
          last_message_at: new Date().toISOString(),
          metadata: { ...metadata, owner_menu_at: new Date().toISOString() },
        })
        .eq('phone', phone);

      await sendOwnerMainMenu(whatsAppClient, phone, ownerContext);
      return new Response(JSON.stringify({ success: true, step: 'owner_menu' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // B. Módulo Suporte Técnico: btn_menu_support
    if (cleanSelectedButtonId === 'btn_menu_support') {
      await supabase
        .from('whatsapp_chat_sessions')
        .update({
          current_step: 'owner_support_menu',
          last_message_at: new Date().toISOString(),
          metadata: { ...metadata, support_menu_at: new Date().toISOString() },
        })
        .eq('phone', phone);

      await sendSupportMenu(whatsAppClient, phone, userName);
      return new Response(JSON.stringify({ success: true, step: 'owner_support_menu' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // B1. Suporte: Reportar Erro ou Bug na Plataforma (Solicitação de descrição/print)
    if (cleanSelectedButtonId === 'support_report_bug') {
      await supabase
        .from('whatsapp_chat_sessions')
        .update({
          current_step: 'waiting_bug_report',
          last_message_at: new Date().toISOString(),
          metadata: { ...metadata, bug_report_start_at: new Date().toISOString() },
        })
        .eq('phone', phone);

      const bugPrompt =
        `Por favor, descreva o erro que está acontecendo. Se você tiver uma foto ou print da tela do erro, pode enviar aqui na conversa!`;

      await whatsAppClient.sendTextMessage(phone, bugPrompt);
      return new Response(JSON.stringify({ success: true, step: 'waiting_bug_report' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // B2. Suporte: FAQ e Dificuldades / Dúvidas de Uso
    if (cleanSelectedButtonId === 'support_faq') {
      const faqText =
        `❓ *Central de Ajuda & Dúvidas Frequentes*

` +
        `Para consultar tutoriais passo a passo sobre agendamentos, prontuários eletrônicos e modelos de evolução, acesse nossa base de conhecimento: https://app.plurifisio.com.br

` +
        `💡 *Precisa de uma demonstração individual?* Você pode agendar 15 minutos com um de nossos consultores especializados!`;

      await whatsAppClient.sendButtonsMessage(phone, faqText, {
        title: 'Central de Ajuda',
        footer: 'PluriFisio',
        buttons: [
          { id: 'btn_schedule_intro', label: '📅 Agendar 15 min' },
          { id: 'support_human', label: '💬 Falar Humano' },
          { id: 'btn_owner_menu', label: '🏠 Menu Principal' },
        ],
      });

      return new Response(JSON.stringify({ success: true, step: 'support_faq' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // B3. Suporte: Falar com Atendimento Humano
    if (cleanSelectedButtonId === 'support_human' || cleanSelectedButtonId === 'finance_human') {
      const waLink = `https://wa.me/${phone}`;
      const humanAlert =
        `💬 *SOLICITAÇÃO DE ATENDIMENTO HUMANO DO TITULAR*

` +
        `👤 *Titular:* ${userName}
` +
        `📱 *WhatsApp:* +${phone}
` +
        `🏥 *Clínica:* ${clinicName}
` +
        `📧 *E-mail:* ${userEmail}
` +
        `📦 *Plano:* ${planName}

` +
        `👉 *Iniciar conversa:* ${waLink}`;

      if (transbordoEnabled && !whatsAppClient.isAdminCommercialPhone(phone)) {
        await whatsAppClient.sendTextMessage(adminCommercialPhone, humanAlert);
      }

      await whatsAppClient.sendTextMessage(
        phone,
        `Perfeito, ${userName}! Nosso time de atendimento já foi notificado. Em instantes um especialista responderá você por aqui ou pelo WhatsApp comercial: https://wa.me/${adminCommercialPhone}`
      );

      return new Response(JSON.stringify({ success: true, step: 'support_human_notified' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // C. Módulo Financeiro: btn_menu_finance
    if (cleanSelectedButtonId === 'btn_menu_finance') {
      await supabase
        .from('whatsapp_chat_sessions')
        .update({
          current_step: 'owner_finance_menu',
          last_message_at: new Date().toISOString(),
          metadata: { ...metadata, finance_menu_at: new Date().toISOString() },
        })
        .eq('phone', phone);

      await sendFinanceMenu(whatsAppClient, phone, ownerContext);
      return new Response(JSON.stringify({ success: true, step: 'owner_finance_menu' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // C1. Financeiro: 2ª Via de Pagamento (PIX Copia e Cola / Boleto da fatura aberta)
    if (cleanSelectedButtonId === 'finance_pix_invoice') {
      await handleFinancePixInvoice(supabase, whatsAppClient, phone, ownerContext);
      return new Response(JSON.stringify({ success: true, step: 'finance_pix_invoice' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // C2. Financeiro: Notas Fiscais & Recibos Emitidos
    if (cleanSelectedButtonId === 'finance_nfse') {
      await handleFinanceNfse(supabase, whatsAppClient, phone, ownerContext);
      return new Response(JSON.stringify({ success: true, step: 'finance_nfse' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // C3. Financeiro: Trocar de Plano (Upgrade)
    if (cleanSelectedButtonId === 'finance_upgrade') {
      await handleFinanceUpgrade(whatsAppClient, phone, ownerContext);
      return new Response(JSON.stringify({ success: true, step: 'finance_upgrade' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // D. FASE B: Prontuário Rápido, Termos de Consentimento e Pré-Cadastro de Paciente
    if (cleanSelectedButtonId === 'btn_menu_records') {
      await supabase
        .from('whatsapp_chat_sessions')
        .update({
          current_step: 'owner_records_menu',
          last_message_at: new Date().toISOString(),
          metadata: { ...metadata, records_menu_at: new Date().toISOString() },
        })
        .eq('phone', phone);

      await sendRecordsMenu(whatsAppClient, phone, ownerContext);
      return new Response(JSON.stringify({ success: true, step: 'owner_records_menu' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // D1. Termos de Consentimento (Submenu ou Ação)
    if (cleanSelectedButtonId === 'records_terms') {
      await sendTermsMenu(whatsAppClient, phone, userName);
      return new Response(JSON.stringify({ success: true, step: 'records_terms_menu' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (cleanSelectedButtonId === 'terms_adult') {
      await handleTermsOption(whatsAppClient, phone, ownerContext, 'adult');
      return new Response(JSON.stringify({ success: true, step: 'terms_adult_sent' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (cleanSelectedButtonId === 'terms_pediatric') {
      await handleTermsOption(whatsAppClient, phone, ownerContext, 'pediatric');
      return new Response(JSON.stringify({ success: true, step: 'terms_pediatric_sent' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // D2. Recepção de Submissão de WhatsApp Flow (interactive.nfm_reply)
    if (cleanSelectedButtonId === 'flow_nfm_reply' && flowResponseJson) {
      console.log(`[whatsapp-webhook] Processando submissão de WhatsApp Flow de ${maskPhoneLgpd(phone)}`);
      const flowResult = await handleFlowPreRegistrationSubmission(
        supabase,
        whatsAppClient,
        phone,
        ownerContext,
        flowResponseJson
      );

      await supabase
        .from('whatsapp_chat_sessions')
        .update({
          current_step: 'initial',
          last_message_at: new Date().toISOString(),
          metadata: {
            ...metadata,
            last_flow_submission: {
              success: flowResult.success,
              patient_code: flowResult.patientCode,
              submitted_at: new Date().toISOString(),
            },
          },
        })
        .eq('phone', phone);

      return new Response(
        JSON.stringify({
          success: true,
          step: 'initial',
          flow_handled: true,
          patientCode: flowResult.patientCode,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // D3. Pré-Cadastro Rápido de Paciente (Modelo Híbrido: WhatsApp Flow + Chat Conversacional)
    if (cleanSelectedButtonId === 'records_quick_patient') {
      const metaFlowId = Deno.env.get('META_WHATSAPP_FLOW_ID') || Deno.env.get('WHATSAPP_FLOW_ID');
      
      // Se WhatsApp Flows estiver habilitado por feature flag e configurado na Meta Cloud API
      if (whatsappFlowsEnabled && whatsAppClient.getProvider() === 'meta_cloud' && metaFlowId) {
        const flowIntroText =
          `⚡ *Pré-Cadastro Rápido de Paciente*\n\n` +
          `Olá, *${userName}*! Abra o formulário interativo abaixo para cadastrar seu paciente em poucos segundos:`;

        await whatsAppClient.sendFlowMessage(phone, flowIntroText, {
          flowId: metaFlowId,
          buttonText: '⚡ Abrir Formulário',
          title: 'Pré-Cadastro de Paciente',
          footer: 'PluriFisio',
        });

        await supabase
          .from('whatsapp_chat_sessions')
          .update({
            current_step: 'precad_flow_sent',
            last_message_at: new Date().toISOString(),
            metadata: {
              ...metadata,
              precad_flow_dispatched_at: new Date().toISOString(),
            },
          })
          .eq('phone', phone);

        return new Response(
          JSON.stringify({
            success: true,
            step: 'precad_flow_sent',
            flow_dispatched: true,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Se Flow estiver desativado ou não configurado, cai imediatamente no fluxo conversacional passo a passo
      const preCadResult = await handleQuickPatientPreRegistrationFlow(
        supabase,
        whatsAppClient,
        phone,
        ownerContext,
        'precad_waiting_name',
        '',
        'records_quick_patient',
        {}
      );

      await supabase
        .from('whatsapp_chat_sessions')
        .update({
          current_step: preCadResult.nextStep,
          last_message_at: new Date().toISOString(),
          metadata: {
            ...metadata,
            precad_data: preCadResult.updatedStateData,
          },
        })
        .eq('phone', phone);

      return new Response(
        JSON.stringify({
          success: true,
          step: preCadResult.nextStep,
          precad_handled: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // D4. Fallback ou Continuação Conversacional do Pré-Cadastro
    const isFallbackToChat =
      cleanSelectedButtonId === 'btn_flow_fallback_chat' ||
      (currentStep === 'precad_flow_sent' && (userText.trim() === '1' || userTextLower.includes('chat')));

    const isPreCadStep =
      isFallbackToChat ||
      currentStep.startsWith('precad_') ||
      cleanSelectedButtonId.startsWith('precad_doc_');

    if (isPreCadStep) {
      const existingPreCadData = (metadata?.precad_data || {}) as PreRegistrationStateData;
      const initialStep = (isFallbackToChat || currentStep === 'precad_flow_sent')
        ? 'precad_waiting_name'
        : currentStep;

      const preCadResult = await handleQuickPatientPreRegistrationFlow(
        supabase,
        whatsAppClient,
        phone,
        ownerContext,
        initialStep,
        isFallbackToChat ? '' : userText,
        cleanSelectedButtonId,
        existingPreCadData
      );

      if (preCadResult.handled) {
        // LGPD e Segurança: se o fluxo foi concluído ou cancelado (nextStep === 'initial'),
        // limpa de forma atômica o precad_data do metadata da sessão para evitar vazamento em mensagens futuras
        const updatedMetadata = { ...metadata };
        if (preCadResult.nextStep === 'initial') {
          delete updatedMetadata.precad_data;
        } else {
          updatedMetadata.precad_data = preCadResult.updatedStateData;
        }

        await supabase
          .from('whatsapp_chat_sessions')
          .update({
            current_step: preCadResult.nextStep,
            last_message_at: new Date().toISOString(),
            metadata: updatedMetadata,
          })
          .eq('phone', phone);

        return new Response(
          JSON.stringify({
            success: true,
            step: preCadResult.nextStep,
            precad_handled: true,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // ---------------------------------------------------------------------------------
    // E. FASE C: AGENDA E ATENDIMENTOS NO COPILOTO DO TITULAR
    // ---------------------------------------------------------------------------------

    // E1. Submenu Agenda & Atendimentos
    if (cleanSelectedButtonId === 'btn_menu_agenda') {
      await supabase
        .from('whatsapp_chat_sessions')
        .update({
          current_step: 'owner_agenda_menu',
          last_message_at: new Date().toISOString(),
          metadata: { ...metadata, agenda_menu_at: new Date().toISOString() },
        })
        .eq('phone', phone);

      await sendAgendaMenu(whatsAppClient, phone, ownerContext);
      return new Response(JSON.stringify({ success: true, step: 'owner_agenda_menu' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // E2. Módulo Novo Agendamento (Seleção de tipo)
    if (cleanSelectedButtonId === 'agenda_new') {
      await supabase
        .from('whatsapp_chat_sessions')
        .update({
          current_step: 'agenda_select_type',
          last_message_at: new Date().toISOString(),
          metadata: { ...metadata, agenda_new_at: new Date().toISOString() },
        })
        .eq('phone', phone);

      await sendNewAppointmentTypeMenu(whatsAppClient, phone, userName);
      return new Response(JSON.stringify({ success: true, step: 'agenda_select_type' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // E3. Módulo Agenda Completa (Hoje & Próximos 7 Dias)
    if (cleanSelectedButtonId === 'agenda_full') {
      await handleAgendaFull(supabase, whatsAppClient, phone, ownerContext);
      return new Response(JSON.stringify({ success: true, step: 'agenda_full_sent' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // E4. Módulo Próximo Agendamento
    if (cleanSelectedButtonId === 'agenda_next') {
      await handleAgendaNext(supabase, whatsAppClient, phone, ownerContext);
      return new Response(JSON.stringify({ success: true, step: 'agenda_next_sent' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // E5. Ações Rápidas no Atendimento (Mudar Status e Editar)
    if (
      cleanSelectedButtonId.startsWith('appt_confirm_') ||
      cleanSelectedButtonId.startsWith('appt_cancel_') ||
      cleanSelectedButtonId.startsWith('appt_resched_') ||
      cleanSelectedButtonId.startsWith('appt_status_')
    ) {
      let action: AppointmentActionType = 'confirm';
      let eventId = '';

      if (cleanSelectedButtonId.startsWith('appt_confirm_')) {
        action = 'confirm';
        eventId = cleanSelectedButtonId.replace('appt_confirm_', '');
      } else if (cleanSelectedButtonId.startsWith('appt_cancel_')) {
        action = 'cancel';
        eventId = cleanSelectedButtonId.replace('appt_cancel_', '');
      } else if (cleanSelectedButtonId.startsWith('appt_resched_')) {
        action = 'reschedule';
        eventId = cleanSelectedButtonId.replace('appt_resched_', '');
      } else if (cleanSelectedButtonId.startsWith('appt_status_confirm_')) {
        action = 'confirm';
        eventId = cleanSelectedButtonId.replace('appt_status_confirm_', '');
      } else if (cleanSelectedButtonId.startsWith('appt_status_cancel_')) {
        action = 'cancel';
        eventId = cleanSelectedButtonId.replace('appt_status_cancel_', '');
      } else if (cleanSelectedButtonId.startsWith('appt_status_complete_')) {
        action = 'complete';
        eventId = cleanSelectedButtonId.replace('appt_status_complete_', '');
      } else if (cleanSelectedButtonId.startsWith('appt_status_awaiting_')) {
        action = 'awaiting';
        eventId = cleanSelectedButtonId.replace('appt_status_awaiting_', '');
      } else if (cleanSelectedButtonId.startsWith('appt_status_delete_')) {
        action = 'delete';
        eventId = cleanSelectedButtonId.replace('appt_status_delete_', '');
      }

      const actionRes = await handleAppointmentAction(supabase, whatsAppClient, phone, ownerContext, action, eventId);

      const nextStep = action === 'reschedule' ? 'agenda_waiting_date' : 'initial';
      const agendaDataToSave: AgendaStateData = action === 'reschedule' ? { subType: 'patient' } : {};

      await supabase
        .from('whatsapp_chat_sessions')
        .update({
          current_step: nextStep,
          last_message_at: new Date().toISOString(),
          metadata: {
            ...metadata,
            agenda_data: agendaDataToSave,
            last_appt_action: { action, eventId, success: actionRes.success, at: new Date().toISOString() },
          },
        })
        .eq('phone', phone);

      return new Response(JSON.stringify({ success: true, step: nextStep, actionHandled: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // E5.1. Fluxos de Edição de Agendamento Existente (appt_edit_*, appt_back_menu_*)
    const isApptEditTrigger =
      cleanSelectedButtonId.startsWith('appt_edit_') ||
      cleanSelectedButtonId.startsWith('appt_back_menu_') ||
      currentStep.startsWith('appt_edit_');

    if (isApptEditTrigger) {
      const existingAgendaData = (metadata?.agenda_data || {}) as AgendaStateData;
      const editResult = await handleAppointmentEditFlow(
        supabase,
        whatsAppClient,
        phone,
        ownerContext,
        currentStep,
        userText,
        cleanSelectedButtonId,
        existingAgendaData
      );

      if (editResult.handled) {
        const updatedMetadata = { ...metadata };
        if (editResult.nextStep === 'initial') {
          delete updatedMetadata.agenda_data;
        } else {
          updatedMetadata.agenda_data = editResult.updatedStateData;
        }

        await supabase
          .from('whatsapp_chat_sessions')
          .update({
            current_step: editResult.nextStep,
            last_message_at: new Date().toISOString(),
            metadata: updatedMetadata,
          })
          .eq('phone', phone);

        return new Response(
          JSON.stringify({
            success: true,
            step: editResult.nextStep,
            appt_edit_handled: true,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // E6. Fluxo Interativo de Criação de Agendamento (Passos da Máquina de Estados)
    const isAgendaTrigger =
      cleanSelectedButtonId === 'agenda_new_patient' ||
      cleanSelectedButtonId === 'agenda_new_event' ||
      cleanSelectedButtonId === 'agenda_new_meeting' ||
      cleanSelectedButtonId.startsWith('agenda_date_') ||
      cleanSelectedButtonId.startsWith('agenda_collab_') ||
      cleanSelectedButtonId === 'agenda_cancel_flow' ||
      currentStep.startsWith('agenda_');

    if (isAgendaTrigger) {
      const existingAgendaData = (metadata?.agenda_data || {}) as AgendaStateData;
      const agendaResult = await handleAgendaCreationFlow(
        supabase,
        whatsAppClient,
        phone,
        ownerContext,
        currentStep,
        userText,
        cleanSelectedButtonId,
        existingAgendaData
      );

      if (agendaResult.handled) {
        // LGPD e Segurança: se o fluxo de agendamento foi concluído ou cancelado (nextStep === 'initial'),
        // limpa de forma atômica o agenda_data do metadata da sessão para evitar vazamento de dados de pacientes/horários
        const updatedMetadata = { ...metadata };
        if (agendaResult.nextStep === 'initial') {
          delete updatedMetadata.agenda_data;
        } else {
          updatedMetadata.agenda_data = agendaResult.updatedStateData;
        }

        await supabase
          .from('whatsapp_chat_sessions')
          .update({
            current_step: agendaResult.nextStep,
            last_message_at: new Date().toISOString(),
            metadata: updatedMetadata,
          })
          .eq('phone', phone);

        return new Response(
          JSON.stringify({
            success: true,
            step: agendaResult.nextStep,
            agenda_handled: true,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // E. Submissão ativa de Bug Report (recebimento de texto ou imagem no passo 'waiting_bug_report')
    if (currentStep === 'waiting_bug_report' && (userText || imageUrl)) {
      // Se for comando de cancelamento ou retorno por texto (sem botão e sem print de imagem anexado)
      const hasButton = Boolean(cleanSelectedButtonId && cleanSelectedButtonId.trim().length > 0);
      if (!hasButton && !imageUrl && userText && (isGlobalCancelCommand(userText) || isGlobalBackCommand(userText))) {
        await supabase
          .from('whatsapp_chat_sessions')
          .update({
            current_step: 'initial',
            last_message_at: new Date().toISOString(),
          })
          .eq('phone', phone);

        await whatsAppClient.sendButtonsMessage(
          phone,
          'Relato de erro cancelado. O que você gostaria de fazer agora?',
          {
            buttons: [
              { id: 'btn_menu_support', label: '🛟 Suporte' },
              { id: 'btn_owner_menu', label: '🏠 Menu Principal' },
            ],
          }
        );

        return new Response(JSON.stringify({ success: true, step: 'initial', cancelled: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await supabase
        .from('whatsapp_chat_sessions')
        .update({
          current_step: 'initial',
          last_message_at: new Date().toISOString(),
          metadata: {
            ...metadata,
            last_bug_reported_at: new Date().toISOString(),
            last_bug_text: userText,
            last_bug_image_url: imageUrl || null,
          },
        })
        .eq('phone', phone);

      await handleBugReportSubmission(
        supabase,
        whatsAppClient,
        telegramClient,
        phone,
        ownerContext,
        userText,
        imageUrl
      );

      return new Response(JSON.stringify({ success: true, step: 'bug_reported' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Detecção de intenção de atendimento humano explícito
    const isHumanSupportIntent =
      userTextLower.includes('humano') ||
      userTextLower.includes('humana') ||
      userTextLower.includes('atendente') ||
      userTextLower.includes('suporte') ||
      userTextLower.includes('ajuda') ||
      userTextLower.includes('especialista') ||
      userTextLower.includes('falar com');

    // 2. MÁQUINA DE ESTADOS DO ONBOARDING
    // -------------------------------------------------------------
    // GATILHO A: Usuário quer Agendar Introdução
    const isScheduleTrigger =
      !isHumanSupportIntent &&
      (cleanSelectedButtonId === 'btn_schedule_intro' ||
        (currentStep === 'initial' && userTextLower === '1') ||
        userTextLower.includes('agendar') ||
        userTextLower.includes('introdução') ||
        userTextLower.includes('introducao'));

    // GATILHO B: Usuário quer Seguir por conta própria
    const isSelfExploreTrigger =
      !isHumanSupportIntent &&
      (cleanSelectedButtonId === 'btn_self_explore' ||
        (currentStep === 'initial' && userTextLower === '2') ||
        userTextLower.includes('conta própria') ||
        userTextLower.includes('conta propria') ||
        userTextLower.includes('sozinho') ||
        userTextLower.includes('explorar'));

    // GATILHO C: Usuário selecionou um dia da lista interativa ou digitou o dia
    const isDaySelectionTrigger =
      !isHumanSupportIntent &&
      !isScheduleTrigger &&
      !isSelfExploreTrigger &&
      (cleanSelectedButtonId.startsWith('day_') ||
        (currentStep === 'waiting_day' && parseTimeToMinutes(userText) === null));

    // GATILHO D: Usuário digitou o horário
    const isTimeSelectionTrigger =
      !isHumanSupportIntent &&
      !isScheduleTrigger &&
      !isSelfExploreTrigger &&
      !cleanSelectedButtonId.startsWith('day_') &&
      (currentStep === 'waiting_time' || parseTimeToMinutes(userText) !== null);

    // Se o agendamento automatizado estiver desabilitado por Feature Flag, orienta contato humano
    if (!bookingFlowEnabled && (isScheduleTrigger || isDaySelectionTrigger || isTimeSelectionTrigger)) {
      const disabledMsg =
        `Olá, ${userName}! Nosso agendamento automático de reuniões via WhatsApp está temporariamente indisponível para manutenção.\n\n` +
        `Nossa equipe terá prazer em combinar o melhor horário diretamente com você! ` +
        `Basta responder a esta mensagem com sua preferência ou chamar nosso canal direto: https://wa.me/${adminCommercialPhone}`;

      await whatsAppClient.sendTextMessage(phone, disabledMsg);

      return new Response(JSON.stringify({ success: true, booking_flow_disabled: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (isScheduleTrigger) {
      const nextDays = getNextBusinessDays(5);
      const rows = nextDays.map((d) => ({
        id: `day_${d.dateIso}`,
        title: d.fullLabel.slice(0, 24),
        description: 'Disponível 09h às 18h',
      }));

      const sections = [
        {
          title: 'Próximos dias úteis',
          rows,
        },
      ];

      // Avança para o estado 'waiting_day'
      await supabase
        .from('whatsapp_chat_sessions')
        .update({
          current_step: 'waiting_day',
          last_message_at: new Date().toISOString(),
          metadata: {
            ...metadata,
            scheduled_intent_at: new Date().toISOString(),
            available_days: nextDays,
          },
        })
        .eq('phone', phone);

      const introBody =
        `Perfeito, ${userName}! 📅\n\n` +
        `Nossa chamada de introdução tem duração de *15 minutos* para você tirar dúvidas e conhecer o *PluriFisio*.\n\n` +
        `Por favor, *selecione abaixo o melhor dia* para o seu atendimento:`;

      await whatsAppClient.sendListMessage(phone, introBody, 'Escolher dia', sections, {
        title: 'PluriFisio - Agendamento',
        footer: 'Atendimento Seg a Sex (09h-18h)',
      });

      return new Response(JSON.stringify({ success: true, step: 'waiting_day' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (isSelfExploreTrigger) {
      // Avança para o estado 'completed_self'
      await supabase
        .from('whatsapp_chat_sessions')
        .update({
          current_step: 'completed_self',
          last_message_at: new Date().toISOString(),
          metadata: {
            ...metadata,
            completed_self_at: new Date().toISOString(),
          },
        })
        .eq('phone', phone);

      const replyText =
        `Excelente! Você está no controle 🚀\n\n` +
        `Caso precise de qualquer ajuda ou surja alguma dúvida durante o uso, basta me enviar uma mensagem por aqui a qualquer momento.\n\n` +
        `👉 Acessar sistema: https://app.plurifisio.com.br\n` +
        `Bom trabalho com o *PluriFisio*!`;

      await whatsAppClient.sendTextMessage(phone, replyText);

      return new Response(JSON.stringify({ success: true, step: 'completed_self' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PASSO: Usuário selecionou ou digitou o dia
    if (isDaySelectionTrigger) {
      const nextDays = getNextBusinessDays(5);
      let selectedDayIso = '';
      let dayLabel = '';

      if (cleanSelectedButtonId.startsWith('day_')) {
        selectedDayIso = cleanSelectedButtonId.replace('day_', '').trim();
        const found = nextDays.find((d) => d.dateIso === selectedDayIso);
        dayLabel = found ? found.fullLabel : selectedDayIso;
      } else {
        // Tenta mapear o texto digitado pelo usuário (número 1-5, dia da semana ou data)
        const trimmed = userText.trim().toLowerCase();
        const numOption = parseInt(trimmed, 10);
        if (!isNaN(numOption) && numOption >= 1 && numOption <= nextDays.length) {
          selectedDayIso = nextDays[numOption - 1].dateIso;
          dayLabel = nextDays[numOption - 1].fullLabel;
        } else {
          const matchDay = nextDays.find(
            (d) =>
              trimmed.includes(d.displayDayOfWeek.toLowerCase()) ||
              trimmed.includes(d.displayDate.toLowerCase()) ||
              trimmed.includes(d.dateIso)
          );
          if (matchDay) {
            selectedDayIso = matchDay.dateIso;
            dayLabel = matchDay.fullLabel;
          } else {
            // Default: Primeiro dia útil disponível
            selectedDayIso = nextDays[0].dateIso;
            dayLabel = nextDays[0].fullLabel;
          }
        }
      }

      // Consulta reuniões já marcadas no banco e no Google Calendar (feed iCal privado em tempo real se flag ativa)
      const startOfDayUtc = new Date(`${selectedDayIso}T00:00:00-03:00`).toISOString();
      const endOfDayUtc = new Date(`${selectedDayIso}T23:59:59-03:00`).toISOString();
      const gcalUrl = (Deno.env.get('GOOGLE_CALENDAR_ICAL_URL') || '').trim();

      const [dbMeetingsRes, gcalBusySlots] = await Promise.all([
        supabase
          .from('platform_onboarding_meetings')
          .select('scheduled_at, duration_minutes, status')
          .gte('scheduled_at', startOfDayUtc)
          .lte('scheduled_at', endOfDayUtc)
          .neq('status', 'canceled'),
        gcalSyncEnabled && gcalUrl ? fetchGoogleCalendarBusySlots(gcalUrl, selectedDayIso) : Promise.resolve([]),
      ]);

      const allExistingMeetings: ExistingMeeting[] = [
        ...((dbMeetingsRes.data as ExistingMeeting[]) || []),
        ...gcalBusySlots,
      ];

      const availabilityOptions = {
        applyThursdayBlock: smartBuffersEnabled,
        bufferMinutes: smartBuffersEnabled ? 30 : 0,
      };

      const { availableWindows } = getAvailableWindowsForDay(
        selectedDayIso,
        allExistingMeetings,
        availabilityOptions
      );
      const windowsText = formatAvailableWindowsText(availableWindows);

      await supabase
        .from('whatsapp_chat_sessions')
        .update({
          current_step: 'waiting_time',
          last_message_at: new Date().toISOString(),
          metadata: {
            ...metadata,
            selected_day_iso: selectedDayIso,
            selected_day_label: dayLabel,
          },
        })
        .eq('phone', phone);

      const replyText =
        `Excelente! Para *${dayLabel}*, temos as seguintes janelas disponíveis:\n\n` +
        `📅 ${windowsText}\n\n` +
        `👉 Por favor, *digite o horário* exato que prefere no formato *HH:MM* (Ex: 10:00, 14:30, 16:00).`;

      await whatsAppClient.sendTextMessage(phone, replyText);

      return new Response(JSON.stringify({ success: true, step: 'waiting_time', day: selectedDayIso }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PASSO: Usuário digitou o horário da reunião
    if (isTimeSelectionTrigger) {
      const selectedDayIso =
        (metadata.selected_day_iso as string) || getNextBusinessDays(1)[0].dateIso;
      const dayLabel = (metadata.selected_day_label as string) || selectedDayIso;

      // Consulta reuniões existentes no banco e no Google Calendar
      const startOfDayUtc = new Date(`${selectedDayIso}T00:00:00-03:00`).toISOString();
      const endOfDayUtc = new Date(`${selectedDayIso}T23:59:59-03:00`).toISOString();
      const gcalUrl = (Deno.env.get('GOOGLE_CALENDAR_ICAL_URL') || '').trim();

      const [dbMeetingsRes, gcalBusySlots] = await Promise.all([
        supabase
          .from('platform_onboarding_meetings')
          .select('scheduled_at, duration_minutes, status')
          .gte('scheduled_at', startOfDayUtc)
          .lte('scheduled_at', endOfDayUtc)
          .neq('status', 'canceled'),
        gcalSyncEnabled && gcalUrl ? fetchGoogleCalendarBusySlots(gcalUrl, selectedDayIso) : Promise.resolve([]),
      ]);

      const allExistingMeetings: ExistingMeeting[] = [
        ...((dbMeetingsRes.data as ExistingMeeting[]) || []),
        ...gcalBusySlots,
      ];

      const availabilityOptions = {
        applyThursdayBlock: smartBuffersEnabled,
        bufferMinutes: smartBuffersEnabled ? 30 : 0,
      };

      const validation = validateSelectedTime(
        selectedDayIso,
        userText,
        allExistingMeetings,
        availabilityOptions
      );

      if (!validation.isValid || !validation.dateObj) {
        const { availableWindows } = getAvailableWindowsForDay(
          selectedDayIso,
          allExistingMeetings,
          availabilityOptions
        );
        const windowsText = formatAvailableWindowsText(availableWindows);

        const errorReply =
          `⚠️ ${validation.errorMessage || 'Horário inválido.'}\n\n` +
          `Janelas disponíveis para *${dayLabel}*:\n📅 ${windowsText}\n\n` +
          `Por favor, digite outro horário (Ex: 10:00, 14:30, 16:00).`;

        await whatsAppClient.sendTextMessage(phone, errorReply);

        return new Response(JSON.stringify({ success: false, step: 'waiting_time', error: validation.errorMessage }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Horário válido: gera link do Google Calendar
      const gCalUrl = generateGoogleCalendarUrl({
        title: `Introdução PluriFisio - ${userName} (${clinicName})`,
        details: `Reunião de introdução e primeiros passos (15 min) na plataforma PluriFisio.\nProfissional: ${userName}\nWhatsApp: +${phone}\nE-mail: ${isValidEmail(userEmail) ? userEmail : 'Não informado'}\nClínica: ${clinicName}\nPlano: ${planName}`,
        location: `Online / WhatsApp: https://wa.me/${phone}`,
        startDate: validation.dateObj,
        durationMinutes: 15,
      });

      // Proteção contra duplicação/concorrência (idempotência):
      // Verifica se já foi criada uma reunião recente para este telefone neste mesmo horário
      const { data: duplicateMeeting } = await supabase
        .from('platform_onboarding_meetings')
        .select('id')
        .eq('phone', phone)
        .eq('scheduled_at', validation.dateObj.toISOString())
        .neq('status', 'canceled')
        .maybeSingle();

      if (!duplicateMeeting) {
        // Salva no banco em platform_onboarding_meetings
        const validLeadEmail = isValidEmail(userEmail) ? userEmail.trim().toLowerCase() : null;
        const { error: meetErr } = await supabase.from('platform_onboarding_meetings').insert({
          lead_name: userName,
          email: validLeadEmail,
          phone: phone,
          clinic_name: clinicName,
          scheduled_at: validation.dateObj.toISOString(),
          duration_minutes: 15,
          status: 'scheduled',
          google_calendar_url: gCalUrl,
          notes: `Agendado via WhatsApp Bot. Profissão: ${professionInfo}. Plano: ${planName}.`,
          created_by: customer.userId || null,
        });

        if (meetErr) {
          console.error('[whatsapp-webhook] Erro ao salvar platform_onboarding_meetings:', meetErr);
        }
      }

      // Atualiza sessão do chat
      await supabase
        .from('whatsapp_chat_sessions')
        .update({
          current_step: 'completed_scheduled',
          last_message_at: new Date().toISOString(),
          metadata: {
            ...metadata,
            scheduled_time: validation.normalizedTime,
            scheduled_at: validation.dateObj.toISOString(),
            google_calendar_url: gCalUrl,
            scheduled_confirmed_at: new Date().toISOString(),
          },
        })
        .eq('phone', phone);

      // 1. Mensagem de confirmação calorosa ao usuário no WhatsApp com link da Agenda
      const confirmationText =
        `Combinado e confirmado, ${userName}! 🎉\n\n` +
        `📅 *Data:* ${dayLabel}\n` +
        `⏰ *Horário:* ${validation.normalizedTime} (Horário de Brasília)\n` +
        `⏱️ *Duração:* 15 minutos\n\n` +
        `Nossa equipe entrará em contato pontualmente com você por este número para realizar a apresentação.\n\n` +
        `🗓️ *Adicionar ao Google Agenda:*\n${gCalUrl}\n\n` +
        `Seja muito bem-vindo(a) ao PluriFisio! 🚀`;

      await whatsAppClient.sendTextMessage(phone, confirmationText, { linkPreview: true });

      // 2. Disparo de WhatsApp rico para o Administrador Comercial (+55 11 98011-3936)
      // Se quem agendou foi o próprio admin comercial ou se flag estiver desativada, não envia mensagem
      if (transbordoEnabled && !whatsAppClient.isAdminCommercialPhone(phone)) {
        try {
          const waLink = `https://wa.me/${phone}`;
          const adminWaScheduleMsg =
            `📅 *NOVO AGENDAMENTO DE ONBOARDING (15 MIN)*\n\n` +
            `👤 *Profissional:* ${userName}\n` +
            `📧 *E-mail:* ${userEmail}\n` +
            `📱 *WhatsApp:* +${phone}\n` +
            `🏥 *Clínica:* ${clinicName}\n` +
            `🩺 *Profissão:* ${professionInfo}\n` +
            `🗓️ *Data & Horário:* ${dayLabel} às ${validation.normalizedTime}\n\n` +
            `🔗 *Google Agenda:* ${gCalUrl}\n` +
            `👉 *Chamar no WhatsApp:* ${waLink}`;

          await whatsAppClient.sendTextMessage(adminCommercialPhone, adminWaScheduleMsg, { linkPreview: true });
        } catch (adminWaErr) {
          console.error('[whatsapp-webhook] Erro ao enviar agendamento de onboarding para WhatsApp do admin comercial:', adminWaErr);
        }
      } else if (!transbordoEnabled) {
        console.log('[whatsapp-webhook] Transbordo WhatsApp para admin suprimido pela Feature Flag notifications_whatsapp_transbordo.');
      } else {
        console.log('[whatsapp-webhook] Agendamento realizado pelo próprio admin comercial. Envio de WhatsApp para si mesmo suprimido.');
      }

      // 3. Notificação rica no Telegram do Admin com deep link para o WhatsApp do usuário
      try {
        const waLink = `https://wa.me/${phone}`;
        const telegramAlert =
          `📅 <b>Novo Agendamento de Introdução (WhatsApp Bot)!</b>\n\n` +
          `👤 <b>Profissional:</b> ${escapeHtml(userName)}\n` +
          `📧 <b>E-mail:</b> ${escapeHtml(userEmail)}\n` +
          `📱 <b>Telefone:</b> ${escapeHtml(phone)}\n` +
          `🗓️ <b>Dia & Horário:</b> <b>${escapeHtml(dayLabel)} às ${escapeHtml(validation.normalizedTime)}</b>\n` +
          `🏥 <b>Clínica:</b> ${escapeHtml(clinicName)}\n` +
          `📦 <b>Plano:</b> ${escapeHtml(planName)}\n\n` +
          `🔗 <a href="${gCalUrl}">Abrir no Google Calendar</a>\n` +
          `💬 <a href="${waLink}">Chamar no WhatsApp</a>`;

        await telegramClient.sendMessage(telegramAlert, {
          parseMode: 'HTML',
          replyMarkup: {
            inline_keyboard: [
              [
                {
                  text: '📅 Google Calendar',
                  url: gCalUrl,
                },
                {
                  text: '💬 Chamar no WhatsApp',
                  url: waLink,
                },
              ],
            ],
          },
        });

        // 4. Inserir notificação in-app em app_notifications para platform_admins
        const { data: activeAdmins } = await supabase
          .from('platform_admins')
          .select('user_id')
          .eq('is_active', true);

        if (activeAdmins && activeAdmins.length > 0) {
          const appNotifs = activeAdmins.map((adm) => ({
            user_id: adm.user_id,
            category: 'system',
            event_type: 'whatsapp_intro_scheduled',
            title: `Introdução Agendada: ${userName}`,
            body: `Agendou introdução para ${dayLabel} às ${validation.normalizedTime} (${phone}).`,
            action_label: 'Ver Diretório',
            action_url: '/platform/diretorio',
            payload: {
              phone,
              userName,
              clinicName,
              dayLabel,
              scheduledTime: validation.normalizedTime,
              scheduled_at: validation.dateObj!.toISOString(),
              google_calendar_url: gCalUrl,
            },
          }));

          await supabase.from('app_notifications').insert(appNotifs);
        }
      } catch (adminNotifyErr) {
        console.error('[whatsapp-webhook] Erro ao notificar admin sobre introdução agendada:', adminNotifyErr);
      }

      return new Response(JSON.stringify({ success: true, step: 'completed_scheduled' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    // PASSO: Mensagem recebida fora do fluxo ativo de onboarding ou Solicitação de Atendimento Humano (Transbordo)
    if (userText) {
      const sanitizedUserMsg = sanitizeInput(userText, 500);
      await supabase
        .from('whatsapp_chat_sessions')
        .update({
          last_message_at: new Date().toISOString(),
          metadata: {
            ...metadata,
            last_user_message: sanitizedUserMsg,
            last_user_message_at: new Date().toISOString(),
          },
        })
        .eq('phone', phone);

      const waLink = `https://wa.me/${phone}`;

      // 1. Disparo de WhatsApp para o Administrador Comercial (+55 11 98011-3936)
      // Se a mensagem for originada pelo próprio admin comercial ou se flag estiver desativada, não envia WhatsApp
      if (transbordoEnabled && !whatsAppClient.isAdminCommercialPhone(phone)) {
        try {
          const adminWaSupportMsg =
            `🚨 *SOLICITAÇÃO DE SUPORTE / ATENDIMENTO HUMANO*\n\n` +
            `👤 *Nome:* ${userName}\n` +
            `📧 *E-mail:* ${userEmail}\n` +
            `📱 *WhatsApp:* +${phone}\n` +
            `🏥 *Clínica:* ${clinicName}\n` +
            `🩺 *Profissão:* ${professionInfo}\n` +
            `📦 *Plano:* ${planName}\n` +
            `💬 *Mensagem do Cliente:* "${sanitizedUserMsg}"\n\n` +
            `👉 *Iniciar conversa direta:* ${waLink}`;

          await whatsAppClient.sendTextMessage(adminCommercialPhone, adminWaSupportMsg);
        } catch (adminWaErr) {
          console.error('[whatsapp-webhook] Erro ao enviar solicitação de suporte para WhatsApp do admin comercial:', adminWaErr);
        }
      } else if (!transbordoEnabled) {
        console.log('[whatsapp-webhook] Transbordo WhatsApp para admin suprimido pela Feature Flag notifications_whatsapp_transbordo.');
      } else {
        console.log('[whatsapp-webhook] Mensagem originada pelo próprio admin comercial. Envio de WhatsApp para si mesmo suprimido.');
      }

      // 2. Resposta acolhedora ao cliente no WhatsApp
      try {
        const userAckText =
          `Entendido! Já repassei sua mensagem para o nosso especialista humano. ` +
          `Entraremos em contato com você em instantes por aqui ou pelo nosso canal comercial. ` +
          `Se preferir, você também pode nos chamar diretamente no WhatsApp comercial: https://wa.me/${adminCommercialPhone}`;

        await whatsAppClient.sendTextMessage(phone, userAckText);
      } catch (ackErr) {
        console.error('[whatsapp-webhook] Erro ao enviar confirmação de atendimento humano para o cliente:', ackErr);
      }

      // 3. Notificar Admin no Telegram sobre mensagem do usuário para atendimento humano
      try {
        const telegramMessage =
          `💬 <b>Nova Mensagem no WhatsApp da PluriFisio!</b>\n\n` +
          `👤 <b>De:</b> ${escapeHtml(userName)} (${escapeHtml(phone)})\n` +
          `📧 <b>E-mail:</b> ${escapeHtml(userEmail)}\n` +
          `🏥 <b>Clínica:</b> ${escapeHtml(clinicName)}\n` +
          `🩺 <b>Profissão:</b> ${escapeHtml(professionInfo)}\n` +
          `📦 <b>Plano:</b> ${escapeHtml(planName)}\n` +
          `📩 <b>Mensagem:</b> <i>"${escapeHtml(sanitizedUserMsg)}"</i>\n\n` +
          `👉 <a href="${waLink}">Responder no WhatsApp</a>`;

        await telegramClient.sendMessage(telegramMessage, {
          parseMode: 'HTML',
          replyMarkup: {
            inline_keyboard: [
              [
                {
                  text: '💬 Responder no WhatsApp',
                  url: waLink,
                },
              ],
            ],
          },
        });
      } catch (tgErr) {
        console.error('[whatsapp-webhook] Erro ao notificar mensagem de suporte no Telegram:', tgErr);
      }
    }

    return new Response(JSON.stringify({ success: true, step: currentStep }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[whatsapp-webhook] Erro inesperado no processamento:', errorMsg);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

if (typeof (globalThis as any).Deno?.serve === 'function') {
  (globalThis as any).Deno.serve(handleWhatsAppWebhookHandler);
}
