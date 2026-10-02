// supabase/functions/notify-admin-telegram/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';
import { TelegramClient } from '../_shared/telegram-client.ts';

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
      userId?: string;
      user_id?: string;
      email?: string;
      name?: string;
      fullName?: string;
      phone?: string;
      clinicName?: string;
      plan?: string;
      createdAt?: string;
    }

    const payload: NotifyAdminTelegramPayload = await req.json();
    const action = payload.action || payload.event || '';

    console.log(`[notify-admin-telegram] Requisição recebida. Ação: "${action}" | User Auth: ${authenticatedUser?.id || 'anon'}`);

    if (action === 'NOTIFY_NEW_SIGNUP' || action === 'SIGNUP_COMPLETED') {
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown-ip';
      const targetUserId = payload.userId || payload.user_id || authenticatedUser?.id;
      const targetEmail = (payload.email || authenticatedUser?.email || '').trim().toLowerCase();

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
      // Busca em profiles ou auth.users (via admin API) para garantir legitimidade do cadastro
      let verifiedUserId: string | null = null;
      let profile: { full_name?: string; email?: string; phone?: string; created_at?: string } | null = null;

      if (targetUserId && targetUserId !== 'service_role') {
        const { data: pData } = await adminSupabase
          .from('profiles')
          .select('full_name, email, phone, created_at')
          .eq('id', targetUserId)
          .maybeSingle();

        if (pData) {
          verifiedUserId = targetUserId;
          profile = pData;
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
            };
          }
        }
      }

      // Se não encontrou por ID mas tem email, busca pelo perfil ou auth
      if (!verifiedUserId && targetEmail) {
        const { data: pByEmail } = await adminSupabase
          .from('profiles')
          .select('full_name, email, phone, created_at')
          .eq('email', targetEmail)
          .maybeSingle();

        if (pByEmail) {
          profile = pByEmail;
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

      const email = (payload.email || profile?.email || targetEmail).trim().toLowerCase();
      const name = payload.name || payload.fullName || profile?.full_name || '';
      const phone = payload.phone || profile?.phone || '';
      const createdAt = payload.createdAt || profile?.created_at || new Date().toISOString();

      // REGRA: Verificar se o cadastro veio por convite (não é orgânico)
      // Se existir convite em clinic_collaborator_invitations para este e-mail (ou aceito por este userId), ignorar notificação de novo signup
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

      if (!isInvited && targetUserId && targetUserId !== 'service_role') {
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
      let clinicName = payload.clinicName || '';
      let plan = payload.plan || 'Degustação Gratuita (7 dias)';

      if (!clinicName && targetUserId && targetUserId !== 'service_role') {
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
        clinicName,
        plan,
        createdAt,
      });

      return new Response(JSON.stringify({ success: sendResult.success, telegram: sendResult }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[notify-admin-telegram] Erro inesperado:', errorMsg);
    // Retorno gracioso para evitar crash no client
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
