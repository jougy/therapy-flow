// supabase/functions/notify-admin-telegram/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';
import { TelegramClient, escapeHtml } from '../_shared/telegram-client.ts';
import { WhatsAppClient, sanitizeWhatsAppNumber } from '../_shared/whatsapp-client.ts';

// Map de rate limiting em memória por chave (IP ou e-mail): máximo 5 disparos por minuto
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limit = 5, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  // Limpeza de entradas expiradas esporadicamente para poupar memória
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[notify-admin-telegram] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados.');
    return new Response(JSON.stringify({ error: 'Configuração do servidor incompleta.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    // Validação de autenticação: aceita chamada autenticada (service_role, anon com apiKey ou JWT de usuário)
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    let authenticatedUser: { id: string; email?: string } | null = null;

    if (token) {
      if (token === supabaseServiceKey) {
        // Chamada direta com service role
        authenticatedUser = { id: 'service_role' };
      } else {
        const { data: userData, error: userError } = await adminSupabase.auth.getUser(token);
        if (!userError && userData?.user) {
          authenticatedUser = { id: userData.user.id, email: userData.user.email };
        }
      }
    }

    interface NotifyAdminTelegramPayload {
      action?: string;
      event?: string;
      templateType?: 'welcome' | 'plan_thank_you' | string;
      userId?: string;
      user_id?: string;
      email?: string;
      name?: string;
      fullName?: string;
      phone?: string;
      clinicName?: string;
      plan?: string;
      createdAt?: string;
      profession?: string;
      councilNumber?: string;
      council_number?: string;
      councilName?: string;
      council_name?: string;
      gender?: string;
      preferredPronoun?: string;
      preferred_pronoun?: string;
      origin?: string;
      signupOrigin?: string;
      signup_origin?: string;
      utmSource?: string;
      utm_source?: string;
      utmMedium?: string;
      utm_medium?: string;
      utmCampaign?: string;
      utm_campaign?: string;
      utm?: Record<string, unknown>;
      signup_utm?: Record<string, unknown>;
    }

    const payload: NotifyAdminTelegramPayload = await req.json();
    const action = payload.action || payload.event || '';
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown-ip';

    console.log(`[notify-admin-telegram] Requisição recebida. Ação: "${action}" | User Auth: ${authenticatedUser?.id || 'anon'}`);

    const isValidUuid = (id?: string | null): boolean => {
      if (!id) return false;
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim());
    };

    const sanitizeField = (val?: string | null, max = 150): string => {
      if (!val) return '';
      return String(val).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, max);
    };

    // ==========================================
    // AÇÃO 1: TEST_TELEGRAM_NOTIFICATION / SEND_TEST_NOTIFICATION
    // ==========================================
    if (action === 'SEND_TEST_NOTIFICATION' || action === 'TEST_TELEGRAM_NOTIFICATION') {
      const rateKey = `test_tg:${authenticatedUser?.id || clientIp}`;
      if (!checkRateLimit(rateKey, 5, 60_000)) {
        return new Response(JSON.stringify({ error: 'Muitos testes de notificação em curto intervalo. Aguarde um minuto.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let isPlatformAdmin = false;
      let adminUserId: string | null = null;
      let adminName = 'Platform Admin';
      let adminEmail = authenticatedUser?.email || '';

      if (authenticatedUser?.id === 'service_role') {
        isPlatformAdmin = true;
        if (payload.userId && isValidUuid(payload.userId)) {
          adminUserId = payload.userId;
        }
      } else if (authenticatedUser?.id && isValidUuid(authenticatedUser.id)) {
        const { data: paData, error: paErr } = await adminSupabase
          .from('platform_admins')
          .select('user_id, role, is_active')
          .eq('user_id', authenticatedUser.id)
          .eq('is_active', true)
          .maybeSingle();

        if (!paErr && paData) {
          isPlatformAdmin = true;
          adminUserId = authenticatedUser.id;
        }
      }

      if (!isPlatformAdmin) {
        console.warn(`[notify-admin-telegram] Acesso negado para ação ${action}. Usuário não autenticado como platform admin.`);
        return new Response(
          JSON.stringify({ error: 'Acesso não autorizado. Apenas administradores da plataforma podem disparar notificações de teste.' }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Buscar perfil do usuário solicitante se disponível e for UUID válido
      if (adminUserId && isValidUuid(adminUserId)) {
        const { data: profile } = await adminSupabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', adminUserId)
          .maybeSingle();

        if (profile) {
          if (profile.full_name) adminName = profile.full_name;
          if (profile.email) adminEmail = profile.email;
        }
      }

      if (payload.name && adminName === 'Platform Admin') adminName = sanitizeField(payload.name, 100);
      if (payload.email && !adminEmail) adminEmail = sanitizeField(payload.email, 150);

      const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

      const testMessage =
        `🔔 <b>Teste de Conexão com Telegram!</b>\n\n` +
        `✅ O Bot Pluri Health Alertas está conectado e operando com sucesso!\n` +
        `🗓️ <b>Data:</b> ${escapeHtml(dataHora)}\n` +
        `👤 <b>Solicitado por:</b> ${escapeHtml(adminName)} (${escapeHtml(adminEmail || 'admin')})\n\n` +
        `👉 <i>Se você recebeu esta mensagem, as notificações de novos cadastros e vendas de planos estão 100% ativas no seu celular!</i>`;

      const telegramClient = new TelegramClient();
      const sendResult = await telegramClient.sendMessage(testMessage, { parseMode: 'HTML' });

      if (!sendResult.success) {
        console.error('[notify-admin-telegram] Falha no teste do Telegram:', sendResult.error);
        return new Response(
          JSON.stringify({
            success: false,
            error: sendResult.error || 'Falha ao enviar mensagem para o Telegram via Bot API.',
          }),
          {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Inserir notificação de teste na tabela app_notifications
      try {
        const targetUserIds: string[] = [];
        if (adminUserId && isValidUuid(adminUserId)) {
          targetUserIds.push(adminUserId);
        } else {
          const { data: allAdmins } = await adminSupabase
            .from('platform_admins')
            .select('user_id')
            .eq('is_active', true);
          if (allAdmins) {
            allAdmins.forEach((a) => {
              if (isValidUuid(a.user_id)) targetUserIds.push(a.user_id);
            });
          }
        }

        if (targetUserIds.length > 0) {
          const notifs = targetUserIds.map((uid) => ({
            user_id: uid,
            actor_user_id: (adminUserId && isValidUuid(adminUserId)) ? adminUserId : null,
            category: 'system',
            event_type: 'admin_telegram_test',
            title: 'Teste de Notificação do Telegram',
            body: 'Disparo de teste realizado com sucesso para o Telegram.',
            action_label: 'Ver Faturamento',
            action_url: '/platform/faturamento',
            payload: {
              message_id: sendResult.messageId || null,
              sent_at: new Date().toISOString(),
              solicitado_por: adminEmail,
              admin_name: adminName,
            },
          }));

          await adminSupabase.from('app_notifications').insert(notifs);
        }
      } catch (notifErr) {
        console.error('[notify-admin-telegram] Erro ao gravar app_notifications de teste:', notifErr);
      }

      return new Response(
        JSON.stringify({
          success: true,
          messageId: sendResult.messageId,
          skipped: sendResult.skipped,
          telegram: sendResult,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // ==========================================
    // AÇÃO 2: SEND_TEST_WHATSAPP / TEST_WHATSAPP_MESSAGE
    // ==========================================
    if (action === 'SEND_TEST_WHATSAPP' || action === 'TEST_WHATSAPP_MESSAGE') {
      const rateKey = `test_wa:${authenticatedUser?.id || clientIp}`;
      if (!checkRateLimit(rateKey, 5, 60_000)) {
        return new Response(JSON.stringify({ error: 'Muitos testes de WhatsApp em curto intervalo. Aguarde um minuto.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let isPlatformAdmin = false;
      let adminUserId: string | null = null;
      let adminName = 'Platform Admin';
      let adminEmail = authenticatedUser?.email || '';

      if (authenticatedUser?.id === 'service_role') {
        isPlatformAdmin = true;
        if (payload.userId && isValidUuid(payload.userId)) {
          adminUserId = payload.userId;
        }
      } else if (authenticatedUser?.id && isValidUuid(authenticatedUser.id)) {
        const { data: paData, error: paErr } = await adminSupabase
          .from('platform_admins')
          .select('user_id, role, is_active')
          .eq('user_id', authenticatedUser.id)
          .eq('is_active', true)
          .maybeSingle();

        if (!paErr && paData) {
          isPlatformAdmin = true;
          adminUserId = authenticatedUser.id;
        }
      }

      if (!isPlatformAdmin) {
        console.warn(`[notify-admin-telegram] Acesso negado para ação ${action}. Usuário não autenticado como platform admin.`);
        return new Response(
          JSON.stringify({ error: 'Acesso não autorizado. Apenas administradores da plataforma podem disparar testes de WhatsApp.' }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const whatsAppClient = new WhatsAppClient();
      const targetPhone = String(payload.phone || whatsAppClient.getBusinessPhone()).trim();
      const cleanPhone = sanitizeWhatsAppNumber(targetPhone);

      if (!cleanPhone) {
        return new Response(
          JSON.stringify({ error: 'Número de telefone de destino inválido para teste.' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const templateType = payload.templateType || 'welcome';
      const targetName = sanitizeField(payload.name || adminName, 100);
      const targetClinic = sanitizeField(payload.clinicName || 'Consultório Fisio Saúde', 100);
      const targetPlan = sanitizeField(payload.plan || (templateType === 'plan_thank_you' ? 'Pluri Fisio Pro' : 'Degustação Gratuita (7 dias)'), 80);

      let testResult;
      if (templateType === 'plan_thank_you') {
        testResult = await whatsAppClient.sendPlanThankYouMessage({
          phone: cleanPhone,
          name: targetName,
          planName: targetPlan,
          clinicName: targetClinic,
        });
      } else {
        testResult = await whatsAppClient.sendWelcomeSequence({
          phone: cleanPhone,
          name: targetName,
          plan: targetPlan,
          clinicName: targetClinic,
        });
      }

      return new Response(
        JSON.stringify({
          success: testResult.success,
          phone: cleanPhone,
          whatsapp: testResult,
        }),
        {
          status: testResult.success || testResult.skipped ? 200 : 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // ==========================================
    // AÇÃO 2: NOTIFY_NEW_SIGNUP / SIGNUP_COMPLETED
    // ==========================================
    if (action === 'NOTIFY_NEW_SIGNUP' || action === 'SIGNUP_COMPLETED') {
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown-ip';
      const targetUserId = payload.userId || payload.user_id || authenticatedUser?.id;
      const targetEmail = (payload.email || authenticatedUser?.email || '').trim().toLowerCase().slice(0, 150);

      // 1. Rate Limiting por IP e por E-mail para mitigar flood / spam no Telegram
      const rateKey = `${clientIp}:${targetEmail || targetUserId || 'anon'}`;
      if (!checkRateLimit(rateKey, 5, 60_000)) {
        console.warn(`[notify-admin-telegram] Rate limit excedido para a chave ${rateKey}. Requisição bloqueada.`);
        return new Response(JSON.stringify({ error: 'Muitas requisições. Tente novamente mais tarde.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!targetUserId && !targetEmail) {
        return new Response(JSON.stringify({ error: 'Identificador do usuário (userId ou email) é obrigatório.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 2. Proteção contra requisições forjadas: Verificar se o usuário REALMENTE existe no banco
      let verifiedUserId: string | null = null;
      let profile: {
        full_name?: string;
        email?: string;
        phone?: string;
        created_at?: string;
        profession?: string;
        council_name?: string;
        professional_license?: string;
        gender?: string;
        preferred_pronoun?: string;
        signup_origin?: string;
        signup_utm?: Record<string, unknown>;
      } | null = null;

      if (targetUserId && isValidUuid(targetUserId)) {
        const { data: pData } = await adminSupabase
          .from('profiles')
          .select('full_name, email, phone, created_at, profession, council_name, professional_license, gender, preferred_pronoun, signup_origin, signup_utm')
          .eq('id', targetUserId)
          .maybeSingle();

        if (pData) {
          verifiedUserId = targetUserId;
          profile = pData as typeof profile;
        } else {
          // Fallback seguro: verifica existência no auth.users
          const { data: authData } = await adminSupabase.auth.admin.getUserById(targetUserId);
          if (authData?.user) {
            verifiedUserId = authData.user.id;
            profile = {
              email: authData.user.email,
              full_name: (authData.user.user_metadata?.full_name as string) || (authData.user.user_metadata?.name as string) || undefined,
              phone: (authData.user.user_metadata?.phone as string) || authData.user.phone || undefined,
              created_at: authData.user.created_at,
              profession: (authData.user.user_metadata?.profession as string) || undefined,
              gender: (authData.user.user_metadata?.gender as string) || undefined,
              preferred_pronoun: (authData.user.user_metadata?.preferred_pronoun as string) || (authData.user.user_metadata?.preferredPronoun as string) || undefined,
              signup_origin: (authData.user.user_metadata?.signup_origin as string) || (authData.user.user_metadata?.origin as string) || undefined,
              signup_utm: (authData.user.user_metadata?.signup_utm as Record<string, unknown>) || undefined,
            };
          }
        }
      }

      // Se não encontrou por ID mas tem email, busca pelo perfil
      if (!verifiedUserId && targetEmail) {
        const { data: pByEmail } = await adminSupabase
          .from('profiles')
          .select('full_name, email, phone, created_at, profession, council_name, professional_license, gender, preferred_pronoun, signup_origin, signup_utm')
          .eq('email', targetEmail)
          .maybeSingle();

        if (pByEmail) {
          profile = pByEmail as typeof profile;
          verifiedUserId = 'verified_by_profile';
        }
      }

      // Se for chamada não-service_role e o usuário não foi encontrado em nenhuma base cadastral, rejeita a requisição forjada
      if (authenticatedUser?.id !== 'service_role' && !verifiedUserId && !profile) {
        console.warn(`[notify-admin-telegram] Bloqueio de segurança: Usuário "${targetUserId || targetEmail}" não encontrado na base de dados.`);
        return new Response(JSON.stringify({ error: 'Usuário não localizado no sistema.' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const email = String(payload.email || profile?.email || targetEmail).trim().toLowerCase().slice(0, 150);
      const name = String(payload.name || payload.fullName || profile?.full_name || '').trim().slice(0, 100);
      const phone = String(payload.phone || profile?.phone || '').trim().slice(0, 30);
      const createdAt = payload.createdAt || profile?.created_at || new Date().toISOString();

      const profession = payload.profession || profile?.profession || '';
      const councilNumber = payload.councilNumber || payload.council_number || profile?.professional_license || '';
      const councilName = payload.councilName || payload.council_name || profile?.council_name || 'CREFITO';

      const gender = payload.gender || profile?.gender || '';
      const preferredPronoun = payload.preferredPronoun || payload.preferred_pronoun || profile?.preferred_pronoun || '';

      const utmObj = (payload.signup_utm || payload.utm || profile?.signup_utm || {}) as Record<string, unknown>;
      const utmSource = String(payload.utmSource || payload.utm_source || utmObj.utm_source || utmObj.source || '').trim();
      const utmMedium = String(payload.utmMedium || payload.utm_medium || utmObj.utm_medium || utmObj.medium || '').trim();
      const utmCampaign = String(payload.utmCampaign || payload.utm_campaign || utmObj.utm_campaign || utmObj.campaign || '').trim();

      const origin = payload.origin || payload.signupOrigin || payload.signup_origin || profile?.signup_origin || '';

      // REGRA: Verificar se o cadastro veio por convite (não é orgânico)
      let isInvited = false;

      if (email) {
        const { data: inviteByEmail } = await adminSupabase
          .from('clinic_collaborator_invitations')
          .select('id, status')
          .ilike('email', email)
          .limit(1);

        if (inviteByEmail && inviteByEmail.length > 0) {
          isInvited = true;
        }
      }

      if (!isInvited && targetUserId && isValidUuid(targetUserId)) {
        const { data: inviteByAcceptedUser } = await adminSupabase
          .from('clinic_collaborator_invitations')
          .select('id')
          .or(`accepted_by.eq.${targetUserId},existing_user_id.eq.${targetUserId}`)
          .limit(1);

        if (inviteByAcceptedUser && inviteByAcceptedUser.length > 0) {
          isInvited = true;
        }
      }

      if (isInvited) {
        console.log(`[notify-admin-telegram] Usuário ${email || targetUserId} é oriundo de convite de clínica. Notificação de signup orgânico ignorada.`);
        return new Response(JSON.stringify({ success: true, ignored: true, reason: 'collaborator_invite' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Buscar nome da clínica criada para o usuário (se houver)
      let clinicName = payload.clinicName ? String(payload.clinicName).slice(0, 120) : '';
      let plan = payload.plan ? String(payload.plan).slice(0, 80) : 'Degustação Gratuita (7 dias)';

      if (!clinicName && targetUserId && isValidUuid(targetUserId)) {
        const { data: clinicData } = await adminSupabase
          .from('clinics')
          .select('name, subscription_plan')
          .eq('account_owner_user_id', targetUserId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (clinicData) {
          clinicName = clinicData.name;
          if (clinicData.subscription_plan) {
            plan = `Degustação Gratuita (7 dias) - ${clinicData.subscription_plan}`;
          }
        }
      }

      const telegramClient = new TelegramClient();
      const sendResult = await telegramClient.notifyNewSignup({
        name,
        email,
        phone,
        profession,
        councilNumber,
        councilName,
        gender,
        preferredPronoun,
        origin,
        signupOrigin: origin,
        utmSource,
        utmMedium,
        utmCampaign,
        clinicName,
        plan,
        createdAt,
      });

      // Inserir notificação in-app em lote (O(1) round-trip) em app_notifications para todos os platform_admins ativos
      try {
        const { data: activeAdmins } = await adminSupabase
          .from('platform_admins')
          .select('user_id')
          .eq('is_active', true);

        if (activeAdmins && activeAdmins.length > 0) {
          const appNotifications = activeAdmins.map((admin) => ({
            user_id: admin.user_id,
            category: 'system',
            event_type: 'new_organic_signup',
            title: `Novo Cadastro: ${name || 'Profissional'}`,
            body: `Novo cadastro direto de ${email} (${clinicName || 'Consultório Solo'}).`,
            action_label: 'Ver no Diretório',
            action_url: '/platform/diretorio',
            payload: {
              email,
              name,
              phone,
              clinicName: clinicName || 'Consultório Solo',
              plan,
              createdAt,
              profession: profession || null,
              councilNumber: councilNumber || null,
              councilName: councilName || null,
              gender: gender || null,
              preferred_pronoun: preferredPronoun || null,
              signup_origin: origin || null,
              utm_source: utmSource || null,
              utm_medium: utmMedium || null,
              utm_campaign: utmCampaign || null,
              signup_utm: Object.keys(utmObj).length > 0 ? utmObj : null,
            },
          }));

          await adminSupabase.from('app_notifications').insert(appNotifications);
          console.log(`[notify-admin-telegram] ${appNotifications.length} notificações de novo cadastro criadas em app_notifications.`);
        }
      } catch (appNotifErr) {
        console.error('[notify-admin-telegram] Erro ao inserir app_notifications de novo cadastro (fail-safe):', appNotifErr);
      }

      // Disparo da sequência de boas-vindas pelo WhatsApp com fail-safe estrito
      let whatsappResult: { success: boolean; skipped?: boolean; error?: string } = { success: false, skipped: true };
      const cleanPhone = sanitizeWhatsAppNumber(phone);

      if (cleanPhone) {
        try {
          const whatsAppClient = new WhatsAppClient();
          whatsappResult = await whatsAppClient.sendWelcomeSequence({
            phone: cleanPhone,
            name,
            plan,
            clinicName: clinicName || 'Consultório Solo',
          });
          console.log(`[notify-admin-telegram] Disparo da Welcome Sequence WhatsApp para ${cleanPhone}:`, whatsappResult);

          // Criar ou atualizar a sessão interativa em whatsapp_chat_sessions
          if (whatsappResult.success || whatsappResult.skipped) {
            const userIdForSession = (verifiedUserId && isValidUuid(verifiedUserId)) ? verifiedUserId : null;
            await adminSupabase.from('whatsapp_chat_sessions').upsert(
              {
                phone: cleanPhone,
                user_id: userIdForSession,
                current_step: 'initial',
                metadata: {
                  user_name: name,
                  clinic_name: clinicName || 'Consultório Solo',
                  plan_name: plan,
                  welcome_sent_at: new Date().toISOString(),
                },
                last_message_at: new Date().toISOString(),
              },
              { onConflict: 'phone' }
            );
          }
        } catch (waErr) {
          console.error('[notify-admin-telegram] Erro ao disparar WhatsApp Welcome Sequence (fail-safe ativado):', waErr);
        }
      }

      return new Response(
        JSON.stringify({
          success: sendResult.success,
          telegram: sendResult,
          whatsapp: whatsappResult,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[notify-admin-telegram] Erro inesperado:', errorMsg);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
