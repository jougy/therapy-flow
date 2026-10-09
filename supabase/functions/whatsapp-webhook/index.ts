// supabase/functions/whatsapp-webhook/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';
import { WhatsAppClient, sanitizeWhatsAppNumber, sanitizeMessageInput } from '../_shared/whatsapp-client.ts';
import { TelegramClient, escapeHtml } from '../_shared/telegram-client.ts';

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
        };
        button?: {
          payload?: string;
          text?: string;
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
    };
  };
}

// Map de rate limiting em memória por chave (IP ou Telefone): máximo 15 requisições por minuto
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limit = 15, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (rateLimitMap.size > 1000) {
    for (const [k, v] of rateLimitMap.entries()) {
      if (now > v.resetAt) rateLimitMap.delete(k);
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

serve(async (req) => {
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

  const receivedSecret = (
    req.headers.get('x-webhook-secret') ||
    req.headers.get('apikey') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    ''
  ).trim();

  if (configuredSecret && receivedSecret && !(await timingSafeEqualString(receivedSecret, configuredSecret))) {
    console.warn('[whatsapp-webhook] Rejeição de webhook: Secret inválido.');
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
    let isFromMe = false;

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

      // Botão interativo ou lista na Meta API
      if (metaMsg.type === 'interactive') {
        selectedButtonId =
          metaMsg.interactive?.button_reply?.id ||
          metaMsg.interactive?.list_reply?.id ||
          '';
        userMessageText =
          metaMsg.interactive?.button_reply?.title ||
          metaMsg.interactive?.list_reply?.title ||
          selectedButtonId;
      } else if (metaMsg.type === 'button') {
        selectedButtonId = metaMsg.button?.payload || '';
        userMessageText = metaMsg.button?.text || selectedButtonId;
      } else if (metaMsg.type === 'text') {
        userMessageText = metaMsg.text?.body || '';
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
        '';
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
      console.warn(`[whatsapp-webhook] Rate limit excedido para o telefone ${phone}`);
      return new Response(JSON.stringify({ success: false, error: 'Rate limit excedido para este número.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cleanSelectedButtonId = sanitizeInput(selectedButtonId, 60);
    const userText = sanitizeInput(userMessageText, 1000);
    const userTextLower = userText.toLowerCase();

    console.log(
      `[whatsapp-webhook] Mensagem recebida de ${phone}: "${userText.slice(0, 100)}" (ButtonId: "${cleanSelectedButtonId}")`
    );

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const whatsAppClient = new WhatsAppClient();
    const telegramClient = new TelegramClient();

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

    // Se a sessão ainda não existir, tenta associar a um perfil de usuário existente
    if (!session) {
      let linkedUserId: string | null = null;
      let linkedClinicId: string | null = null;
      let userName = sanitizeInput(pushName, 100) || '';
      let clinicName = '';
      let planName = 'Pluri Fisio';

      // Otimização Big-O O(1): Busca perfil por telefone exato ou formato sem DDI
      const digitsOnly = phone.replace(/\D/g, '');
      const nationalPhone = digitsOnly.startsWith('55') ? digitsOnly.slice(2) : digitsOnly;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .or(`phone.eq.${phone},phone.eq.${nationalPhone}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (profile) {
        linkedUserId = profile.id;
        userName = sanitizeInput(profile.full_name, 100) || userName;

        const { data: clinic } = await supabase
          .from('clinics')
          .select('id, name, subscription_plan')
          .eq('account_owner_user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (clinic) {
          linkedClinicId = clinic.id;
          clinicName = sanitizeInput(clinic.name, 100) || '';
          if (clinic.subscription_plan) planName = sanitizeInput(clinic.subscription_plan, 80);
        }
      }

      const { data: newSession, error: insertErr } = await supabase
        .from('whatsapp_chat_sessions')
        .insert({
          phone,
          user_id: linkedUserId,
          clinic_id: linkedClinicId,
          current_step: 'initial',
          metadata: {
            user_name: userName,
            clinic_name: clinicName,
            plan_name: planName,
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
    const userName = sanitizeInput((metadata.user_name as string) || pushName || 'Doutor(a)', 80);
    const clinicName = sanitizeInput((metadata.clinic_name as string) || 'Consultório Solo', 80);
    const planName = sanitizeInput((metadata.plan_name as string) || 'Pluri Fisio', 60);

    // 2. MÁQUINA DE ESTADOS DO ONBOARDING
    // -------------------------------------------------------------
    // GATILHO A: Usuário quer Agendar Introdução
    const isScheduleTrigger =
      cleanSelectedButtonId === 'btn_schedule_intro' ||
      userTextLower === '1' ||
      userTextLower.includes('agendar') ||
      userTextLower.includes('introdução') ||
      userTextLower.includes('introducao');

    // GATILHO B: Usuário quer Seguir por conta própria
    const isSelfExploreTrigger =
      cleanSelectedButtonId === 'btn_self_explore' ||
      userTextLower === '2' ||
      userTextLower.includes('conta própria') ||
      userTextLower.includes('conta propria') ||
      userTextLower.includes('sozinho') ||
      userTextLower.includes('explorar');

    if (isScheduleTrigger) {
      // Avança para o estado 'waiting_day'
      await supabase
        .from('whatsapp_chat_sessions')
        .update({
          current_step: 'waiting_day',
          last_message_at: new Date().toISOString(),
          metadata: {
            ...metadata,
            scheduled_intent_at: new Date().toISOString(),
          },
        })
        .eq('phone', phone);

      const replyText =
        `Perfeito, ${userName}! 📅\n\n` +
        `Nossas chamadas de introdução ocorrem de *segunda a sexta-feira*, entre *9h e 18h* (duração de 15 minutos).\n\n` +
        `Qual o melhor *dia da semana* ou data para você? (Ex: Segunda-feira, Amanhã, 15/10)`;

      await whatsAppClient.sendTextMessage(phone, replyText);

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

    // PASSO: Usuário está no estado 'waiting_day' (esperando o dia escolhido)
    if (currentStep === 'waiting_day') {
      const scheduledDay = sanitizeInput(userText, 60);

      await supabase
        .from('whatsapp_chat_sessions')
        .update({
          current_step: 'waiting_time',
          last_message_at: new Date().toISOString(),
          metadata: {
            ...metadata,
            scheduled_day: scheduledDay,
          },
        })
        .eq('phone', phone);

      const replyText =
        `Ótimo! Anotei o dia *${scheduledDay}*.\n\n` +
        `E qual *horário* fica melhor para você entre 9h e 18h? (Ex: 10:00, 14h30, 16h)`;

      await whatsAppClient.sendTextMessage(phone, replyText);

      return new Response(JSON.stringify({ success: true, step: 'waiting_time' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PASSO: Usuário está no estado 'waiting_time' (esperando o horário)
    if (currentStep === 'waiting_time') {
      const scheduledTime = sanitizeInput(userText, 60);
      const scheduledDay = sanitizeInput(metadata.scheduled_day as string, 60) || 'Dia a combinar';

      await supabase
        .from('whatsapp_chat_sessions')
        .update({
          current_step: 'completed_scheduled',
          last_message_at: new Date().toISOString(),
          metadata: {
            ...metadata,
            scheduled_time: scheduledTime,
            scheduled_confirmed_at: new Date().toISOString(),
          },
        })
        .eq('phone', phone);

      // 1. Mensagem de confirmação ao usuário no WhatsApp
      const confirmationText =
        `Combinado! 🎉\n\n` +
        `Agendamos sua introdução para *${scheduledDay}* às *${scheduledTime}*.\n\n` +
        `Nossa equipe entrará em contato com você por este número para realizar a chamada de 15 minutos e te apresentar tudo.\n\n` +
        `Até breve e seja muito bem-vindo(a) ao PluriFisio!`;

      await whatsAppClient.sendTextMessage(phone, confirmationText);

      // 2. Notificação rica no Telegram do Admin com deep link para o WhatsApp do usuário
      try {
        const waLink = `https://wa.me/${phone}`;
        const telegramAlert =
          `📅 <b>Novo Agendamento de Introdução (WhatsApp Bot)!</b>\n\n` +
          `👤 <b>Profissional:</b> ${escapeHtml(userName)}\n` +
          `📱 <b>Telefone:</b> ${escapeHtml(phone)}\n` +
          `🗓️ <b>Dia Escolhido:</b> <b>${escapeHtml(scheduledDay)}</b>\n` +
          `⏰ <b>Horário Escolhido:</b> <b>${escapeHtml(scheduledTime)}</b>\n` +
          `🏥 <b>Clínica:</b> ${escapeHtml(clinicName)}\n` +
          `📦 <b>Plano:</b> ${escapeHtml(planName)}\n\n` +
          `💬 <b>WhatsApp:</b> <a href="${waLink}">Abrir Conversa Direta</a>`;

        await telegramClient.sendMessage(telegramAlert, {
          parseMode: 'HTML',
          replyMarkup: {
            inline_keyboard: [
              [
                {
                  text: '💬 Chamar no WhatsApp',
                  url: waLink,
                },
              ],
            ],
          },
        });

        // 3. Inserir notificação in-app em app_notifications para platform_admins
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
            body: `Agendou introdução para ${scheduledDay} às ${scheduledTime} (${phone}).`,
            action_label: 'Ver Diretório',
            action_url: '/platform/diretorio',
            payload: {
              phone,
              userName,
              clinicName,
              scheduledDay,
              scheduledTime,
              scheduled_at: new Date().toISOString(),
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

    // PASSO: Mensagem recebida fora do fluxo ativo de onboarding (Dúvida / Atendimento Humano)
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

      // Notificar Admin no Telegram sobre mensagem do usuário para atendimento humano
      try {
        const waLink = `https://wa.me/${phone}`;
        const telegramMessage =
          `💬 <b>Nova Mensagem no WhatsApp da PluriFisio!</b>\n\n` +
          `👤 <b>De:</b> ${escapeHtml(userName)} (${escapeHtml(phone)})\n` +
          `🏥 <b>Clínica:</b> ${escapeHtml(clinicName)}\n` +
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
});
