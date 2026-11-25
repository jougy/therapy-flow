import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';
import { TelegramClient, escapeHtml } from '../_shared/telegram-client.ts';
import { WhatsAppClient, sanitizeWhatsAppNumber } from '../_shared/whatsapp-client.ts';
import { getGlobalFeatureFlag } from '../_shared/feature-flags-client.ts';
import { checkRateLimit, extractClientIp, rateLimitExceededResponse } from '../_shared/rate-limit.ts';
import { reportError } from '../_shared/error-dedup.ts';

Deno.serve(async (req) => {
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
    const clientIp = extractClientIp(req);

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
      if (authenticatedUser?.id !== 'service_role') {
        const rl = await checkRateLimit({
          preset: 'notify_admin_test',
          identifier: `tg:${authenticatedUser?.id || clientIp}`,
          service: 'notify-admin-telegram',
          route: action,
        });
        if (!rl.allowed) {
          return rateLimitExceededResponse(
            rl,
            corsHeaders,
            'Muitos testes de notificação em curto intervalo. Aguarde um minuto.'
          );
        }
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
      if (authenticatedUser?.id !== 'service_role') {
        const rl = await checkRateLimit({
          preset: 'notify_admin_test',
          identifier: `wa:${authenticatedUser?.id || clientIp}`,
          service: 'notify-admin-telegram',
          route: action,
        });
        if (!rl.allowed) {
          return rateLimitExceededResponse(
            rl,
            corsHeaders,
            'Muitos testes de WhatsApp em curto intervalo. Aguarde um minuto.'
          );
        }
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
      const targetPlan = sanitizeField(payload.plan || (templateType === 'plan_thank_you' ? 'Pluri Fisio Pro' : 'Teste Gratuito (7 dias)'), 80);

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
      const targetUserId = payload.userId || payload.user_id || authenticatedUser?.id;
      const targetEmail = (payload.email || authenticatedUser?.email || '').trim().toLowerCase().slice(0, 150);

      // 1. Rate Limiting distribuído por IP e e-mail (bypass service_role)
      if (authenticatedUser?.id !== 'service_role') {
        const rateKey = `${clientIp}:${targetEmail || targetUserId || 'anon'}`;
        const rl = await checkRateLimit({
          preset: 'notify_admin_public',
          identifier: rateKey,
          service: 'notify-admin-telegram',
          route: action,
        });
        if (!rl.allowed) {
          console.warn('[notify-admin-telegram] Rate limit distribuído excedido. Requisição bloqueada.');
          return rateLimitExceededResponse(rl, corsHeaders, 'Muitas requisições. Tente novamente mais tarde.');
        }
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

      // 2.5. Idempotência distribuída via Upstash Redis (evita duplicatas entre frontend + trigger server-side)
      const upstashUrl = Deno.env.get('UPSTASH_REDIS_REST_URL') || '';
      const upstashToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN') || '';
      const idempotencySubject = (targetUserId && isValidUuid(targetUserId)) ? targetUserId : email || verifiedUserId;

      if (upstashUrl && upstashToken && idempotencySubject) {
        try {
          const idempotencyKey = `pluri:signup:notified:${idempotencySubject}`;
          const redisRes = await fetch(`${upstashUrl.replace(/\/+$/, '')}/set/${encodeURIComponent(idempotencyKey)}/1/NX/EX/2592000`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${upstashToken}` },
          });
          if (redisRes.ok) {
            const redisJson = await redisRes.json();
            if (redisJson?.result === null) {
              console.log(`[notify-admin-telegram] Idempotência Upstash: signup de ${idempotencySubject} já notificado.`);
              return new Response(JSON.stringify({ success: true, deduplicated: true }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
          }
        } catch (redisErr) {
          console.warn('[notify-admin-telegram] Falha na checagem de idempotência Upstash (fail-open):', redisErr);
        }
      }

      // 2.6. Detectar provedor de autenticação (Google OAuth vs E-mail/Senha)
      let authProvider = 'email';
      if (targetUserId && isValidUuid(targetUserId)) {
        try {
          const { data: authUserRes } = await adminSupabase.auth.admin.getUserById(targetUserId);
          const u = authUserRes?.user;
          if (u) {
            const isGoogle =
              u.app_metadata?.provider === 'google' ||
              (Array.isArray(u.identities) && u.identities.some((id: { provider?: string }) => id.provider === 'google'));
            if (isGoogle) authProvider = 'google';
          }
        } catch {
          // fail-safe: mantém 'email'
        }
      }

      // 3. Verificar se o cadastro veio por convite de colaborador de outra clínica (identificando qual clínica)
      let invitedByClinicId: string | null = null;
      let invitedByClinicName: string | null = null;

      if (email) {
        const { data: inviteByEmail } = await adminSupabase
          .from('clinic_collaborator_invitations')
          .select('id, clinic_id, clinics(id, name)')
          .ilike('email', email)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (inviteByEmail) {
          invitedByClinicId = inviteByEmail.clinic_id || null;
          const clinicRel = inviteByEmail.clinics as { id?: string; name?: string } | { id?: string; name?: string }[] | null;
          invitedByClinicName = Array.isArray(clinicRel) ? clinicRel[0]?.name || null : clinicRel?.name || null;
        }
      }

      if (!invitedByClinicId && targetUserId && isValidUuid(targetUserId)) {
        const { data: inviteByAcceptedUser } = await adminSupabase
          .from('clinic_collaborator_invitations')
          .select('id, clinic_id, clinics(id, name)')
          .or(`accepted_by.eq.${targetUserId},existing_user_id.eq.${targetUserId}`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (inviteByAcceptedUser) {
          invitedByClinicId = inviteByAcceptedUser.clinic_id || null;
          const clinicRel = inviteByAcceptedUser.clinics as { id?: string; name?: string } | { id?: string; name?: string }[] | null;
          invitedByClinicName = Array.isArray(clinicRel) ? clinicRel[0]?.name || null : clinicRel?.name || null;
        }
      }

      // 3.1. Classificação padronizada da origem
      const rawOriginLower = `${origin} ${utmSource} ${utmMedium}`.toLowerCase();
      let originCategory = 'link_direto';
      if (invitedByClinicId || invitedByClinicName) {
        originCategory = 'indicacao_clinica';
      } else if (/instagram|facebook|fb|tiktok|youtube|linkedin|social/.test(rawOriginLower)) {
        originCategory = 'redes_sociais';
      } else if (/google|gclid/.test(rawOriginLower) || authProvider === 'google') {
        originCategory = 'google';
      } else if (/plurifisio|plurihealth|site|landing/.test(rawOriginLower)) {
        originCategory = 'site';
      } else if (utmObj.ref || /indicacao|ref/.test(rawOriginLower)) {
        originCategory = 'indicacao_link';
      }

      const providerBadge = authProvider === 'google' ? 'Google OAuth' : 'E-mail/Senha';
      const effectiveOrigin = invitedByClinicName
        ? `Indicação / Convite da Clínica: ${invitedByClinicName} (${providerBadge})`
        : origin
        ? `${origin} (${providerBadge})`
        : `Link Direto (${providerBadge})`;

      // Buscar nome da clínica criada para o usuário (se houver)
      let clinicName = payload.clinicName ? String(payload.clinicName).slice(0, 120) : '';
      let plan = payload.plan ? String(payload.plan).slice(0, 80) : 'Teste Gratuito (7 dias)';

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
            plan = `Teste Gratuito (7 dias) - ${clinicData.subscription_plan}`;
          }
        }
      }

      // 1. Notificação Telegram do Admin
      const telegramAdminEnabled = await getGlobalFeatureFlag(
        adminSupabase,
        'notifications_telegram_admin',
        true
      );

      let sendResult: { success: boolean; skipped?: boolean; error?: string; messageId?: number } = {
        success: false,
        skipped: true,
      };

      if (telegramAdminEnabled) {
        const telegramClient = new TelegramClient();
        sendResult = await telegramClient.notifyNewSignup({
          name,
          email,
          phone,
          profession,
          councilNumber,
          councilName,
          gender,
          preferredPronoun,
          origin: effectiveOrigin,
          signupOrigin: effectiveOrigin,
          utmSource,
          utmMedium,
          utmCampaign,
          clinicName,
          plan,
          createdAt,
        });
      } else {
        console.log('[notify-admin-telegram] Notificação Telegram do Admin ignorada: flag "notifications_telegram_admin" desativada.');
        sendResult = { success: true, skipped: true };
      }

      // 1.5. Telemetria no Upstash Redis (contadores) e Ingestão no Axiom (fail-safe)
      const telemetryTasks: Promise<unknown>[] = [];
      if (upstashUrl && upstashToken) {
        const baseUpstash = upstashUrl.replace(/\/+$/, '');
        const headers = { Authorization: `Bearer ${upstashToken}`, 'Content-Type': 'application/json' };
        telemetryTasks.push(
          fetch(`${baseUpstash}/pipeline`, {
            method: 'POST',
            headers,
            body: JSON.stringify([
              ['INCR', 'pluri:metrics:signups:total'],
              ['INCR', `pluri:metrics:signups:provider:${authProvider}`],
              ['INCR', `pluri:metrics:signups:origin:${originCategory}`],
            ]),
          })
        );
      }

      const axiomToken = Deno.env.get('AXIOM_TOKEN') || '';
      const axiomDataset = Deno.env.get('AXIOM_DATASET') || '';
      if (axiomToken && axiomDataset) {
        const rawEvent: Record<string, unknown> = {
          _time: new Date().toISOString(),
          event: 'signup_completed',
          userId: targetUserId || verifiedUserId || undefined,
          email,
          name: name || undefined,
          authProvider,
          originCategory,
          originLabel: effectiveOrigin,
          invitedByClinicId: invitedByClinicId || undefined,
          invitedByClinicName: invitedByClinicName || undefined,
          utm_source: utmSource || undefined,
          utm_medium: utmMedium || undefined,
          utm_campaign: utmCampaign || undefined,
          clinicName: clinicName || undefined,
          plan,
          telegramSent: Boolean(sendResult?.success && !sendResult?.skipped),
        };
        const compactEvent = Object.fromEntries(Object.entries(rawEvent).filter(([, v]) => v !== undefined));
        const jsonBytes = new TextEncoder().encode(JSON.stringify([compactEvent]));

        const sendAxiomCompressed = async () => {
          let body: BodyInit = jsonBytes;
          const headers: Record<string, string> = {
            Authorization: `Bearer ${axiomToken}`,
            'Content-Type': 'application/json',
          };
          if (typeof CompressionStream !== 'undefined') {
            const stream = new Blob([jsonBytes]).stream().pipeThrough(new CompressionStream('gzip'));
            body = await new Response(stream).arrayBuffer();
            headers['Content-Encoding'] = 'gzip';
          }
          return fetch(`https://api.axiom.co/v1/datasets/${encodeURIComponent(axiomDataset)}/ingest`, {
            method: 'POST',
            headers,
            body,
          });
        };

        telemetryTasks.push(sendAxiomCompressed());
      }

      if (telemetryTasks.length > 0) {
        await Promise.allSettled(telemetryTasks);
      }

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

      const whatsappOnboardingEnabled = await getGlobalFeatureFlag(
        adminSupabase,
        'notifications_whatsapp_onboarding',
        true
      );

      if (cleanPhone && whatsappOnboardingEnabled) {
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
      } else if (cleanPhone && !whatsappOnboardingEnabled) {
        console.log(`[notify-admin-telegram] Welcome Sequence do WhatsApp ignorada: flag "notifications_whatsapp_onboarding" desativada.`);
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
    await reportError({
      service: 'notify-admin-telegram',
      level: 'critical',
      code: 'edge_unhandled_500',
      route: 'notify-admin-telegram',
      message: errorMsg,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
