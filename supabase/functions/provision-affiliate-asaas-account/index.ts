/**
 * Edge Function: provision-affiliate-asaas-account
 *
 * Responsabilidade:
 * - Provisionamento automatizado de subcontas Asaas para parceiros e afiliados (White-label split de pagamentos).
 * - Criação da conta filha no gateway Asaas e vinculação da `walletId` e `accountId` ao cadastro do afiliado.
 *
 * Segurança & Governança:
 * - Autenticação JWT obrigatória via Supabase Auth.
 * - Autorização RBAC: Apenas o próprio afiliado (proprietário do user_id) ou platform_admins ativos
 *   possuem permissão para provisionar ou reconfigurar dados bancários/financeiros da afiliação.
 * - Compliance e integridade: Assegura unicidade de chaves PIX e subcontas no banco.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';
import { AsaasClient, type AsaasSubAccountData } from '../_shared/asaas-client.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido.' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[provision-affiliate-asaas-account] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes.');
      return new Response(JSON.stringify({ error: 'Configuração do servidor incompleta.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Autorização ausente.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida ou expirada.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch (_err) {
      return new Response(JSON.stringify({ error: 'JSON inválido no corpo da requisição.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      affiliateId,
      name,
      email,
      cpfCnpj,
      mobilePhone,
      phone,
      address,
      addressNumber,
      complement,
      province,
      postalCode,
      pixKey,
      pixKeyType,
      companyType,
      birthDate,
    } = body as {
      affiliateId?: string;
      name?: string;
      email?: string;
      cpfCnpj?: string;
      mobilePhone?: string;
      phone?: string;
      address?: string;
      addressNumber?: string;
      complement?: string;
      province?: string;
      postalCode?: string;
      pixKey?: string;
      pixKeyType?: string;
      companyType?: 'MEI' | 'LIMITED' | 'INDIVIDUAL' | 'ASSOCIATION';
      birthDate?: string;
    };

    if (!affiliateId || !name || !email || !cpfCnpj) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios ausentes: affiliateId, name, email e cpfCnpj são necessários.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 1. Obter cadastro do afiliado
    const { data: affiliate, error: affiliateErr } = await supabase
      .from('affiliates')
      .select('id, user_id, status, asaas_account_id, asaas_wallet_id')
      .eq('id', affiliateId)
      .maybeSingle();

    if (affiliateErr || !affiliate) {
      return new Response(JSON.stringify({ error: 'Afiliado não encontrado.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Validação RBAC estrita
    let isAuthorized = affiliate.user_id === user.id;

    if (!isAuthorized) {
      const { data: platformAdmin } = await supabase
        .from('platform_admins')
        .select('role, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (platformAdmin && (platformAdmin.role === 'platform_admin' || platformAdmin.role === 'platform_owner')) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Permissão negada. Você não possui autorização para provisionar conta para este afiliado.' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Preparar payload para o Asaas
    const cleanCpfCnpj = String(cpfCnpj).replace(/\D/g, '');
    const cleanPostalCode = postalCode ? String(postalCode).replace(/\D/g, '') : undefined;
    const cleanMobile = mobilePhone ? String(mobilePhone).replace(/\D/g, '') : undefined;
    const cleanPhone = phone ? String(phone).replace(/\D/g, '') : undefined;

    const subAccountPayload: AsaasSubAccountData = {
      name: String(name).trim(),
      email: String(email).trim(),
      cpfCnpj: cleanCpfCnpj,
      ...(companyType ? { companyType } : {}),
      ...(cleanPhone ? { phone: cleanPhone } : {}),
      ...(cleanMobile ? { mobilePhone: cleanMobile } : {}),
      ...(address ? { address: String(address).trim() } : {}),
      ...(addressNumber ? { addressNumber: String(addressNumber).trim() } : {}),
      ...(complement ? { complement: String(complement).trim() } : {}),
      ...(province ? { province: String(province).trim() } : {}),
      ...(cleanPostalCode ? { postalCode: cleanPostalCode } : {}),
      ...(birthDate ? { birthDate: String(birthDate).trim() } : {}),
    };

    // 4. Provisionamento da Subconta no Asaas
    const asaas = new AsaasClient();
    let asaasRes: { id: string; apiKey?: string; walletId?: string; [key: string]: unknown };

    try {
      asaasRes = await asaas.createSubAccount(subAccountPayload);
    } catch (asaasError: any) {
      console.error('[provision-affiliate-asaas-account] Falha ao criar subconta no Asaas:', asaasError?.message || asaasError);
      return new Response(
        JSON.stringify({
          error: asaasError?.message || 'Falha ao registrar subconta no gateway Asaas.',
        }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const accountId = asaasRes.id;
    const walletId = asaasRes.walletId || asaasRes.id;

    // 5. Atualização da tabela public.affiliates com a service_role
    const updatePayload: Record<string, unknown> = {
      asaas_account_id: accountId,
      asaas_wallet_id: walletId,
      status: 'active',
      updated_at: new Date().toISOString(),
    };

    if (pixKey) {
      updatePayload.pix_key = String(pixKey).trim();
    }
    if (pixKeyType) {
      updatePayload.pix_key_type = String(pixKeyType).trim();
    }

    const { error: updateError } = await supabase
      .from('affiliates')
      .update(updatePayload)
      .eq('id', affiliateId);

    if (updateError) {
      console.error('[provision-affiliate-asaas-account] Falha ao persistir subconta no Supabase:', updateError.message);
      return new Response(
        JSON.stringify({
          error: `Subconta criada no Asaas (${accountId}), mas falhou ao atualizar cadastro do afiliado: ${updateError.message}`,
          accountId,
          walletId,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        accountId,
        walletId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('[provision-affiliate-asaas-account] Erro inesperado:', err?.message || err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Erro interno no processamento do provisionamento.' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
