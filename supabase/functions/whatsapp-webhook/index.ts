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
  AgendaStateData,
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

      // Se o evento não for de mensagem recebida (ex: connection.update, qrcode.updated), responde 200 OK graciosamente
      if (
        eventType !== 'messages.upsert' &&
        eventType !== 'MESSAGES_UPSERT' &&
        eventType !== 'messages.update' &&
        !body.data?.message
      ) {
        return new Response(JSON.stringify({ success: true, ignored: true, event: eventType }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const key = body.data?.key;
      isFromMe = key?.fromMe === true;

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

    console.log(
      `[whatsapp-webhook] Mensagem recebida de ${maskPhoneLgpd(phone)}: "${userText.slice(0, 100)}" (ButtonId: "${cleanSelectedButtonId}")`
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
      .select('id, phone, user_id, clinic_id, current_step, metadata')
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

      const digitsOnly = phone.replace(/\D/g, '');
      const nationalPhone = digitsOnly.startsWith('55') ? digitsOnly.slice(2) : digitsOnly;

      let profileData: ProfileLookupRecord | null = null;

      if (userId) {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone, profession, council_name, professional_license')
          .eq('id', userId)
          .maybeSingle();
        profileData = data as ProfileLookupRecord | null;
      }

      if (!profileData) {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone, profession, council_name, professional_license')
          .or(`phone.eq.${phone},phone.eq.${nationalPhone}`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        profileData = data as ProfileLookupRecord | null;
      }

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

        if (adminRecord) {
          isOwnerOrAdmin = true;
          activeRole = 'platform_admin';
        }

        // 2. Checar clinic_memberships (operational_role = 'owner')
        const { data: memberships } = await supabase
          .from('clinic_memberships')
          .select('id, clinic_id, operational_role, role_key, is_active')
          .eq('user_id', profileData.id)
          .eq('is_active', true);

        const ownerMembership = (memberships || []).find(
          (m) => m.operational_role === 'owner' || m.role_key === 'owner'
        );

        if (ownerMembership) {
          isOwnerOrAdmin = true;
          activeRole = 'owner';
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
          activeRole = 'owner';
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
    }

    const currentStep = session?.current_step || 'initial';
    const metadata = (session?.metadata || {}) as Record<string, unknown>;
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
      userTextLower === 'olá';

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

    // E5. Ações Rápidas no Atendimento (Confirmar, Cancelar, Remarcar)
    if (
      cleanSelectedButtonId.startsWith('appt_confirm_') ||
      cleanSelectedButtonId.startsWith('appt_cancel_') ||
      cleanSelectedButtonId.startsWith('appt_resched_')
    ) {
      let action: 'confirm' | 'cancel' | 'reschedule' = 'confirm';
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
        await supabase
          .from('whatsapp_chat_sessions')
          .update({
            current_step: agendaResult.nextStep,
            last_message_at: new Date().toISOString(),
            metadata: {
              ...metadata,
              agenda_data: agendaResult.updatedStateData,
            },
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
