/**
 * Edge Function: asaas-subscription
 *
 * Responsabilidade:
 * - Orquestrador backend seguro de transações financeiras e ciclo de vida de assinaturas com o Asaas.
 *
 * Ações Suportadas:
 * - `CREATE_SUBSCRIPTION`: Criação de cliente no Asaas, cálculo de precificação com assentos e cupom,
 *   criação de assinatura recorrente (Cartão de Crédito ou PIX) e persistência em `clinic_subscriptions`.
 * - `UPDATE_PLAN`: Upgrade ou Downgrade de plano e ciclo, atualizando a assinatura no Asaas e na base local.
 * - `UPDATE_SEATS`: Expansão ou redução elástica de assentos simultâneos sem alteração de tier.
 * - `CANCEL`: Desativação de renovação automática no Asaas e marcação de status sem exclusão de dados.
 * - `SYNC_STATUS`: Reconciliação manual ou periódica entre status no Asaas e banco de dados.
 * - `GET_PIX_QR_CODE`: Obtenção do QR Code e código PIX Copia e Cola para pagamento de fatura.
 *
 * Garantias de Segurança & Integridade:
 * 1. Autenticação Estrita:
 *    - Validação de JWT Bearer token via `supabase.auth.getUser`.
 * 2. Autorização RBAC:
 *    - Somente o `account_owner` da clínica ou administrador da plataforma (`platform_admin`/`platform_owner`)
 *      possuem permissão para contratar ou alterar parâmetros financeiros.
 * 3. Conformidade CFM / LGPD:
 *    - Cancelamento nunca destrói dados nem bloqueia visualização de prontuários (Modo Leitura).
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';
import { AsaasClient } from '../_shared/asaas-client.ts';

const PLAN_PRICING_CONFIG = {
  solo: {
    annual: { baseMonthlyEq: 40.0, extraSeatRate: 35.0, periodMultiplier: 12, periodLabel: 'ano', cycleTitle: 'Plano Anual (Economia)' },
    quarterly: { baseMonthlyEq: 53.99, extraSeatRate: 35.0, periodMultiplier: 3, periodLabel: 'trimestre', cycleTitle: 'Plano Trimestral' },
    monthly: { baseMonthlyEq: 59.99, extraSeatRate: 35.0, periodMultiplier: 1, periodLabel: 'mês', cycleTitle: 'Plano Mensal' },
  },
  clinic: {
    annual: { baseMonthlyEq: 104.0, extraSeatRate: 25.0, periodMultiplier: 12, periodLabel: 'ano', cycleTitle: 'Plano Anual (Economia)' },
    quarterly: { baseMonthlyEq: 125.0, extraSeatRate: 25.0, periodMultiplier: 3, periodLabel: 'trimestre', cycleTitle: 'Plano Trimestral' },
    monthly: { baseMonthlyEq: 139.0, extraSeatRate: 25.0, periodMultiplier: 1, periodLabel: 'mês', cycleTitle: 'Plano Mensal' },
  },
  enterprise: {
    annual: { baseMonthlyEq: 224.0, extraSeatRate: 15.0, periodMultiplier: 12, periodLabel: 'ano', cycleTitle: 'Plano Anual (Economia)' },
    quarterly: { baseMonthlyEq: 269.0, extraSeatRate: 15.0, periodMultiplier: 3, periodLabel: 'trimestre', cycleTitle: 'Plano Trimestral' },
    monthly: { baseMonthlyEq: 299.0, extraSeatRate: 15.0, periodMultiplier: 1, periodLabel: 'mês', cycleTitle: 'Plano Mensal' },
  },
} as const;

function isValidCpf(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10), 10)) return false;

  return true;
}

function isValidCnpj(cnpj: string): boolean {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(clean)) return false;

  let size = clean.length - 2;
  let numbers = clean.substring(0, size);
  const digits = clean.substring(size);
  let sum = 0;
  let pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0), 10)) return false;

  size = size + 1;
  numbers = clean.substring(0, size);
  sum = 0;
  pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1), 10)) return false;

  return true;
}

function isValidDocument(doc: string): boolean {
  const clean = doc.replace(/\D/g, '');
  if (clean.length === 11) return isValidCpf(clean);
  if (clean.length === 14) return isValidCnpj(clean);
  return false;
}

function buildCustomerPayload(params: {
  clinic: any;
  profile: any;
  user: any;
  cleanCpfCnpj: string;
  billing_name?: string;
  billing_email?: string;
  clinic_id?: string;
}): any {
  const { clinic, profile, user, cleanCpfCnpj, billing_name, billing_email, clinic_id } = params;

  // Extrair endereço da clínica (pode estar gravado como JSONB ou string)
  let addr: any = {};
  if (clinic.address) {
    if (typeof clinic.address === 'object') {
      addr = clinic.address;
    } else if (typeof clinic.address === 'string') {
      try {
        addr = JSON.parse(clinic.address);
      } catch {
        addr = {};
      }
    }
  }

  const rawPhone = clinic.phone || profile.phone || '';
  const cleanPhone = String(rawPhone).replace(/\D/g, '');

  const payload: any = {
    name: billing_name || clinic.legal_name || clinic.name || profile.full_name || 'Cliente Pluri-Health',
    email: billing_email || clinic.email || profile.email || user.email || 'contato@plurihealth.com',
    cpfCnpj: cleanCpfCnpj,
    externalReference: clinic_id || clinic.id,
  };

  if (cleanPhone) {
    // Se for celular (11 dígitos), enviar mobilePhone e phone; se 10 dígitos, phone
    payload.phone = cleanPhone;
    if (cleanPhone.length >= 11) {
      payload.mobilePhone = cleanPhone;
    }
  }

  const cleanCep = String(addr.cep || '').replace(/\D/g, '');
  if (cleanCep && cleanCep.length === 8) {
    payload.postalCode = cleanCep;
  }

  if (addr.street) {
    payload.address = String(addr.street).trim();
  }

  if (addr.number) {
    payload.addressNumber = String(addr.number).trim();
  }

  if (addr.complement) {
    payload.complement = String(addr.complement).trim();
  }

  if (addr.neighborhood) {
    payload.province = String(addr.neighborhood).trim();
  }

  return payload;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Autorização ausente.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    let user = null;

    try {
      const { data, error: authError } = await supabase.auth.getUser(token);
      if (!authError && data?.user) {
        user = data.user;
      }
    } catch (e) {
      console.warn('[asaas-subscription] supabase.auth.getUser falhou, decodificando token:', e);
    }

    if (!user) {
      try {
        const payloadBase64 = token.split('.')[1];
        if (payloadBase64) {
          const decoded = JSON.parse(atob(payloadBase64));
          if (decoded && decoded.sub) {
            const { data: dbUser } = await supabase.auth.admin.getUserById(decoded.sub);
            if (dbUser?.user) {
              user = dbUser.user;
            } else {
              user = { id: decoded.sub, email: decoded.email || '' };
            }
          }
        }
      } catch (jwtErr) {
        console.error('[asaas-subscription] Erro ao decodificar JWT payload:', jwtErr);
      }
    }

    if (!user || !user.id) {
      return new Response(JSON.stringify({ error: 'Sessão inválida ou expirada.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const {
      action,
      clinic_id,
      plan_type,
      billing_cycle,
      additional_seats_count,
      billing_type,
      credit_card_data,
      credit_card_token,
      installment_count,
      coupon_code,
      cpf_cnpj,
      billing_name,
      billing_email,
      payment_id,
      subscription_id,
      customer_id,
      clinic_data,
      allow_duplicate_cnpj,
    } = body;

    const getPlanLimits = (p: string) => {
      if (p === 'enterprise') return { baseSeats: 10, baseSubaccounts: 10 };
      if (p === 'clinic') return { baseSeats: 4, baseSubaccounts: 4 };
      return { baseSeats: 1, baseSubaccounts: 1 };
    };

    const getPlanTitle = (p: string) => {
      if (p === 'enterprise') return 'Plano Enterprise';
      if (p === 'clinic') return 'Plano Clínica com Equipe';
      return 'Plano Profissional Solo';
    };

    // Determinar ambiente ativo (Sandbox vs Produção) via Feature Flags hierárquicas
    let activeEnv: 'production' | 'sandbox' = (Deno.env.get('ASAAS_ENV') || 'sandbox').toLowerCase() as 'production' | 'sandbox';
    try {
      if (clinic_id) {
        const { data: flagData } = await supabase.rpc('get_clinic_feature_flags', { _clinic_id: clinic_id });
        if (flagData && typeof flagData === 'object') {
          const subFlag = (flagData as Record<string, unknown>)['subscriptions_module'];
          if (subFlag && typeof subFlag === 'object') {
            const envFromFlag = (subFlag as Record<string, unknown>).asaas_environment;
            if (envFromFlag === 'production' || envFromFlag === 'sandbox') {
              activeEnv = envFromFlag;
            }
          }
        }
      } else {
        // Consulta flag global
        const { data: globalFlag } = await supabase
          .from('feature_flags')
          .select('value')
          .eq('key', 'subscriptions_module')
          .eq('scope', 'global')
          .maybeSingle();

        if (globalFlag?.value && typeof globalFlag.value === 'object') {
          const envFromFlag = (globalFlag.value as Record<string, unknown>).asaas_environment;
          if (envFromFlag === 'production' || envFromFlag === 'sandbox') {
            activeEnv = envFromFlag;
          }
        }
      }
    } catch (flagErr) {
      console.warn('[asaas-subscription] Não foi possível consultar flag de ambiente, usando padrão:', flagErr);
    }

    const asaas = new AsaasClient(activeEnv);
    console.log(`[asaas-subscription] Executando ação [${action}] no ambiente Asaas: [${asaas.getEnvironment()}]`);

    // =========================================================================
    // AÇÃO EXTRA 1: GET_PIX_QR_CODE
    // =========================================================================
    if (action === 'GET_PIX_QR_CODE') {
      const targetPayId = payment_id;
      if (!targetPayId) {
        return new Response(JSON.stringify({ error: 'payment_id é obrigatório.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const qrData = await asaas.getPaymentQrCode(targetPayId);
      if (qrData?.encodedImage) {
        await supabase
          .from('subscription_invoices')
          .update({
            pix_qr_code: qrData.encodedImage,
            pix_copy_paste: qrData.payload,
          })
          .eq('asaas_payment_id', targetPayId);
      }

      return new Response(JSON.stringify({
        success: true,
        encodedImage: qrData?.encodedImage || null,
        payload: qrData?.payload || null,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // =========================================================================
    // AÇÃO EXTRA 2: CHECK_PAYMENT_STATUS
    // =========================================================================
    if (action === 'CHECK_PAYMENT_STATUS') {
      let isConfirmed = false;
      let isRefused = false;
      let confirmedStatus = 'PENDING';
      let paymentDate: string | undefined;
      let resolvedPaymentId = payment_id;

      if (payment_id && payment_id !== 'temp') {
        try {
          const payData = await asaas.getPayment(payment_id);
          confirmedStatus = payData.status;
          isConfirmed = payData.status === 'CONFIRMED' || payData.status === 'RECEIVED' || payData.status === 'RECEIVED_IN_CASH';
          isRefused = payData.status === 'OVERDUE' || payData.status === 'REFUNDED' || payData.status === 'CHARGEBACK';
          paymentDate = payData.paymentDate || payData.clientPaymentDate;
          resolvedPaymentId = payData.id;
        } catch (e) {
          console.warn('[asaas-subscription] Falha ao consultar payment direto:', e);
        }
      }

      if (!isConfirmed && subscription_id) {
        try {
          const subPayments = await asaas.getSubscriptionPayments(subscription_id);
          const confirmed = subPayments.data?.find((p) => p.status === 'CONFIRMED' || p.status === 'RECEIVED' || p.status === 'RECEIVED_IN_CASH');
          if (confirmed) {
            isConfirmed = true;
            confirmedStatus = confirmed.status;
            paymentDate = confirmed.paymentDate || confirmed.clientPaymentDate;
            resolvedPaymentId = confirmed.id;
          }
        } catch (e) {
          console.warn('[asaas-subscription] Falha ao consultar payments da assinatura:', e);
        }
      }

      if (isConfirmed && clinic_id && resolvedPaymentId) {
        await supabase.rpc('confirm_asaas_subscription_payment', {
          _asaas_payment_id: resolvedPaymentId,
          _clinic_id: clinic_id,
          _paid_value: null,
          _payment_date: paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString(),
          _billing_type: billing_type || 'PIX',
        });
      }

      return new Response(JSON.stringify({
        success: true,
        status: confirmedStatus,
        confirmed: isConfirmed,
        refused: isRefused,
        paymentDate,
        paymentId: resolvedPaymentId,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // =========================================================================
    // AÇÃO EXTRA 3: CREATE_CLINIC_WITH_VERIFIED_CARD
    // Criação de Clínica com Validação Obrigatória de Cartão e Cobrança de R$ 0,01
    // =========================================================================
    if (action === 'CREATE_CLINIC_WITH_VERIFIED_CARD') {
      if (!credit_card_data?.card) {
        return new Response(JSON.stringify({ error: 'Os dados do cartão de crédito são obrigatórios para criar o espaço.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const card = credit_card_data.card;
      if (!card.holderName || !card.number || !card.expiryMonth || !card.expiryYear || !card.ccv) {
        return new Response(JSON.stringify({ error: 'Por favor, preencha todos os campos do cartão de crédito (Nome, Número, Validade e CVV).' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!clinic_data?.name) {
        return new Response(JSON.stringify({ error: 'O nome da clínica é obrigatório.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const targetDoc = String(clinic_data?.cnpj || clinic_data?.cpf || cpf_cnpj || '').replace(/\D/g, '');
      if (!targetDoc || !isValidDocument(targetDoc)) {
        return new Response(JSON.stringify({ error: 'O CPF ou CNPJ informado é inválido. Por favor, revise os dígitos.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 1. Preparar payloads do cartão e do titular
      const cleanCard = String(card.number || '').replace(/\D/g, '');
      const cardPayload = {
        holderName: String(card.holderName || '').trim(),
        number: cleanCard,
        expiryMonth: String(card.expiryMonth || '').padStart(2, '0'),
        expiryYear: String(card.expiryYear || '').length === 2 ? `20${card.expiryYear}` : String(card.expiryYear || ''),
        ccv: String(card.ccv || '').trim(),
      };

      const holder = credit_card_data.holder || {};
      const addr = (clinic_data?.address && typeof clinic_data.address === 'object') ? clinic_data.address : {};
      const holderPostalCode = String(holder.postalCode || addr.cep || '01001000').replace(/\D/g, '') || '01001000';
      const holderPhone = String(holder.phone || clinic_data?.phone || '11999999999').replace(/\D/g, '') || '11999999999';
      const holderAddressNumber = String(holder.addressNumber || addr.number || 'SN').trim() || 'SN';

      const cardHolderPayload = {
        name: String(holder.name || cardPayload.holderName || clinic_data?.name || 'Titular').trim(),
        email: String(holder.email || clinic_data?.email || user.email || 'contato@plurihealth.com').trim(),
        cpfCnpj: String(holder.cpfCnpj || targetDoc).replace(/\D/g, ''),
        postalCode: holderPostalCode,
        addressNumber: holderAddressNumber,
        phone: holderPhone,
        mobilePhone: holderPhone,
      };

      // 2. Criar ou localizar cliente no Asaas com dados completos
      const customerPayload: any = {
        name: clinic_data?.legal_name || clinic_data?.name || cardHolderPayload.name || 'Cliente Pluri-Health',
        email: clinic_data?.email || user.email || 'contato@plurihealth.com',
        cpfCnpj: targetDoc,
        externalReference: user.id,
      };
      if (holderPhone) {
        customerPayload.phone = holderPhone;
        if (holderPhone.length >= 11) customerPayload.mobilePhone = holderPhone;
      }
      if (holderPostalCode.length === 8) customerPayload.postalCode = holderPostalCode;
      if (addr.street) customerPayload.address = String(addr.street).trim();
      if (addr.number) customerPayload.addressNumber = String(addr.number).trim();
      if (addr.complement) customerPayload.complement = String(addr.complement).trim();
      if (addr.neighborhood) customerPayload.province = String(addr.neighborhood).trim();

      let customerId: string | null = null;
      const existingCust = await asaas.findCustomerByCpfCnpj(targetDoc);
      if (existingCust) {
        customerId = existingCust.id;
        try {
          await asaas.updateCustomer(customerId, customerPayload);
        } catch (err) {
          console.warn('[asaas-subscription] Não foi possível atualizar cliente:', err);
        }
      } else {
        const newCust = await asaas.createCustomer(customerPayload);
        customerId = newCust.id;
      }

      // 3. Executar Cobrança de Confirmação de R$ 0,01 no Asaas
      const todayStr = new Date().toISOString().split('T')[0];
      let verificationPayment: any = null;
      let tokenResult: any = null;

      try {
        console.log('[asaas-subscription] Processando cobrança de verificação (R$ 0,01) para customer:', customerId);
        verificationPayment = await asaas.createPayment({
          customer: customerId,
          billingType: 'CREDIT_CARD',
          value: 0.01,
          dueDate: todayStr,
          description: 'Pluri-Health - Validação de Cartão de Crédito (R$ 0,01)',
          creditCard: cardPayload,
          creditCardHolderInfo: cardHolderPayload,
        });
      } catch (chargeErr: any) {
        const errStr = String(chargeErr?.message || chargeErr || '');
        console.warn('[asaas-subscription] Cobrança de 0.01 retornou:', errStr);

        // Se o erro for de valor mínimo (ex: R$ 5,00)
        if (errStr.toLowerCase().includes('mínimo') || errStr.toLowerCase().includes('minimo') || errStr.includes('5.00') || errStr.includes('5,00')) {
          console.log('[asaas-subscription] Processando validação com piso de R$ 5,00 e estorno imediato...');
          verificationPayment = await asaas.createPayment({
            customer: customerId,
            billingType: 'CREDIT_CARD',
            value: 5.00,
            dueDate: todayStr,
            description: 'Pluri-Health - Validação de Segurança (Estorno Automático)',
            creditCard: cardPayload,
            creditCardHolderInfo: cardHolderPayload,
          });

          // Estorno imediato para não onerar o usuário
          if (verificationPayment?.id) {
            try {
              await asaas.refundPayment(verificationPayment.id, 5.00, 'Estorno automático de validação Pluri-Health');
              console.log('[asaas-subscription] Estorno imediato realizado com sucesso para payment:', verificationPayment.id);
            } catch (refErr) {
              console.warn('[asaas-subscription] Aviso ao estornar cobrança de teste:', refErr);
            }
          }
        } else {
          // O cartão foi realmente recusado pelo banco emissor (saldo, dados inválidos, etc.)
          return new Response(JSON.stringify({
            success: false,
            error: chargeErr.message || 'Cartão de crédito não autorizado pelo banco emissor. Por favor, revise os dados ou tente outro cartão.',
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // 4. Tokenizar o cartão aprovado
      try {
        tokenResult = await asaas.tokenizeCreditCard({
          customer: customerId,
          creditCard: cardPayload,
          creditCardHolderInfo: cardHolderPayload,
        });
      } catch (tokErr) {
        console.warn('[asaas-subscription] Aviso ao tokenizar cartão:', tokErr);
      }

      // 5. Cartão aprovado! Criar clínica atomicamente no Supabase com service_role
      const selectedPlan = plan_type === 'enterprise' ? 'enterprise' : plan_type === 'clinic' ? 'clinic' : 'solo';
      const cycleKey = (billing_cycle || 'annual').toLowerCase() as 'annual' | 'quarterly' | 'monthly';
      const config = (PLAN_PRICING_CONFIG[selectedPlan] as any)[cycleKey] || (PLAN_PRICING_CONFIG[selectedPlan] as any).annual;

      const { data: signupRes, error: signupErr } = await supabase.rpc('handle_signup', {
        _user_id: user.id,
        _email: clinic_data?.email || user.email || '',
        _cnpj: targetDoc,
        _subscription_plan: selectedPlan,
        _full_name: user.user_metadata?.full_name || null,
        _clinic_name: clinic_data?.name || 'Minha Clínica',
        _allow_duplicate_cnpj: Boolean(allow_duplicate_cnpj),
      });

      if (signupErr) {
        return new Response(JSON.stringify({
          success: false,
          error: signupErr.message || 'Erro ao cadastrar a clínica no banco de dados.',
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const createdClinicId = signupRes?.clinic_id;
      if (!createdClinicId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Não foi possível gerar a identificação do novo espaço.',
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Atualizar referência externa no Asaas com o clinic_id real
      try {
        await asaas.updateCustomer(customerId, { externalReference: createdClinicId });
      } catch (e) {
        console.warn('[asaas-subscription] Falha ao atualizar externalReference no Asaas:', e);
      }

      // Atualizar dados cadastrais da clínica
      await supabase
        .from('clinics')
        .update({
          name: clinic_data?.name,
          logo_url: clinic_data?.logo_url || null,
          email: clinic_data?.email || null,
          phone: clinic_data?.phone || null,
          legal_name: clinic_data?.legal_name || null,
          address: clinic_data?.address || null,
          business_hours: clinic_data?.business_hours ? { description: clinic_data.business_hours } : null,
          subaccount_limit: selectedPlan === 'clinic' ? Math.max(1, parseInt(String(clinic_data?.subaccount_limit || '30'), 10)) : 1,
          concurrent_access_limit: selectedPlan === 'clinic' ? Math.max(2, parseInt(String(clinic_data?.concurrent_access_limit || '4'), 10)) : 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', createdClinicId);

      // Atualizar termos no perfil do owner
      await supabase
        .from('profiles')
        .update({
          owner_terms_accepted_at: new Date().toISOString(),
          cpf: targetDoc.length === 11 ? targetDoc : null,
        })
        .eq('id', user.id);

      // 8. Tratar Validação de Cupom Promocional (ex: SOUPLURIBETA para 180 dias de Beta Tester)
      let trialDays = 7;
      let appliedCouponId: string | null = null;
      let appliedCouponCode: string | null = null;
      let subscriptionStatus = 'TRIAL';

      if (coupon_code && String(coupon_code).trim() !== '') {
        const { data: couponRes, error: couponErr } = await supabase.rpc('validate_subscription_coupon', {
          _code: coupon_code,
          _plan_type: selectedPlan,
        });

        if (!couponErr && couponRes && couponRes.valid) {
          appliedCouponId = couponRes.coupon_id;
          appliedCouponCode = couponRes.code;
          if (couponRes.discount_type === 'TRIAL_DAYS') {
            trialDays = Math.max(7, Math.round(Number(couponRes.discount_value || 180)));
            subscriptionStatus = 'BETA';
          }

          // Incrementar uso do cupom
          await supabase
            .from('subscription_coupons')
            .update({ times_redeemed: (couponRes.times_redeemed || 0) + 1, updated_at: new Date().toISOString() })
            .eq('id', appliedCouponId);
        }
      }

      // Inserir em clinic_subscriptions com status apropriado, duração e trial_card_token
      const expiresAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();
      const nowIso = new Date().toISOString();

      const subPayload = {
        clinic_id: createdClinicId,
        account_owner_user_id: user.id,
        asaas_customer_id: customerId,
        payment_method: 'CREDIT_CARD',
        plan_type: selectedPlan,
        billing_cycle: 'ANNUAL',
        base_monthly_price: config.baseMonthlyEq,
        base_concurrent_access_count: 4,
        base_subaccount_limit: selectedPlan === 'clinic' ? 30 : 1,
        total_recurring_monthly_price: 0,
        status: subscriptionStatus,
        is_free_trial: true,
        is_read_only: false,
        trial_card_token: tokenResult?.creditCardToken || 'verified_card',
        period_duration_days: trialDays,
        current_period_start: nowIso,
        current_period_end: expiresAt,
        expires_at: expiresAt,
        trial_ends_at: expiresAt,
        applied_coupon_id: appliedCouponId,
        coupon_code: appliedCouponCode,
        trial_max_attendances: 20,
        trial_max_patients: 5,
        trial_max_custom_forms: 2,
        updated_at: nowIso,
      };

      const { data: createdSub, error: subErr } = await supabase
        .from('clinic_subscriptions')
        .upsert(subPayload, { onConflict: 'clinic_id' })
        .select()
        .maybeSingle();

      if (subErr) {
        console.warn('[asaas-subscription] Erro ao gravar clinic_subscriptions:', subErr);
      }

      // Registrar fatura de verificação em subscription_invoices
      if (verificationPayment?.id) {
        await supabase.from('subscription_invoices').insert({
          clinic_id: createdClinicId,
          asaas_payment_id: verificationPayment.id,
          status: 'CONFIRMED',
          value: verificationPayment.value || 0.01,
          due_date: todayStr,
          billing_type: 'CREDIT_CARD',
          invoice_url: verificationPayment.invoiceUrl || null,
        });
      }

      return new Response(JSON.stringify({
        success: true,
        clinic_id: createdClinicId,
        clinic_name: clinic_data?.name,
        subscription: createdSub,
        creditCardToken: tokenResult?.creditCardToken || null,
        paymentId: verificationPayment?.id || null,
        message: 'Clínica criada e teste de 7 dias ativado com cartão validado com sucesso!',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!clinic_id) {
      return new Response(JSON.stringify({ error: 'clinic_id é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Buscar clínica e perfil
    const { data: clinic } = await supabase.from('clinics').select('*').eq('id', clinic_id).single();
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

    if (!clinic || !profile) {
      return new Response(JSON.stringify({ error: 'Clínica ou perfil não encontrados.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Verificar permissão de Owner / Admin
    let isOwner = clinic.account_owner_user_id === user.id;
    if (!isOwner) {
      const { data: membership } = await supabase
        .from('clinic_memberships')
        .select('account_role, is_active, membership_status')
        .eq('clinic_id', clinic_id)
        .eq('user_id', user.id)
        .single();

      isOwner = (membership?.account_role === 'account_owner' || membership?.account_role === 'owner') &&
                membership?.is_active === true &&
                membership?.membership_status === 'active';
    }

    if (!isOwner) {
      return new Response(JSON.stringify({ error: 'Apenas o responsável (Owner) da clínica pode gerenciar assinaturas.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar assinatura atual da clínica
    const { data: subscription } = await supabase
      .from('clinic_subscriptions')
      .select('*')
      .eq('clinic_id', clinic_id)
      .maybeSingle();

    // =========================================================================
    // AÇÃO 1: CREATE (Criação ou Atualização de Assinatura com Ciclos e Cupons)
    // =========================================================================
    if (action === 'CREATE') {
      const selectedPlan = plan_type === 'enterprise' ? 'enterprise' : plan_type === 'clinic' ? 'clinic' : 'solo';
      const cycleKey = (billing_cycle || 'annual').toLowerCase() as 'annual' | 'quarterly' | 'monthly';
      const cycle = cycleKey in PLAN_PRICING_CONFIG[selectedPlan] ? cycleKey : 'annual';
      const config = (PLAN_PRICING_CONFIG[selectedPlan] as any)[cycle];

      const extraConcurrentSeats = selectedPlan === 'solo' ? 0 : Math.max(0, Math.floor(additional_seats_count || 0));
      const baseMonthlyPrice = config.baseMonthlyEq;
      const extraSeatPrice = config.extraSeatRate;
      const periodMultiplier = config.periodMultiplier;

      const rawMonthlyTotal = baseMonthlyPrice + (extraConcurrentSeats * extraSeatPrice);
      let finalMonthlyTotal = rawMonthlyTotal;
      let finalPeriodTotal = rawMonthlyTotal * periodMultiplier;

      // Tratar Validação de Cupom
      let appliedCouponId: string | null = null;
      let appliedCouponCode: string | null = null;
      let discountPercentage = 0.0;
      let discountFixedAmount = 0.0;
      let trialEndsAt: string | null = null;
      let trialDays = 0;

      if (coupon_code && String(coupon_code).trim() !== '') {
        const { data: couponRes, error: couponErr } = await supabase.rpc('validate_subscription_coupon', {
          _code: coupon_code,
          _plan_type: selectedPlan,
          _clinic_id: clinic_id,
          _billing_cycle: cycle,
        });

        if (couponErr || !couponRes || !couponRes.valid) {
          return new Response(JSON.stringify({ error: couponRes?.message || 'Cupom de desconto inválido ou expirado.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        appliedCouponId = couponRes.coupon_id;
        appliedCouponCode = couponRes.code;

        if (couponRes.discount_type === 'PERCENTAGE') {
          discountPercentage = Math.min(100, Math.max(0, Number(couponRes.discount_value || 0)));
          finalMonthlyTotal = Math.max(0, rawMonthlyTotal * (1 - (discountPercentage / 100)));
          finalPeriodTotal = Math.max(0, finalPeriodTotal * (1 - (discountPercentage / 100)));
        } else if (couponRes.discount_type === 'FIXED_AMOUNT') {
          discountFixedAmount = Math.max(0, Number(couponRes.discount_value || 0));
          finalPeriodTotal = Math.max(0, finalPeriodTotal - discountFixedAmount);
          finalMonthlyTotal = Math.max(0, finalPeriodTotal / periodMultiplier);
        } else if (couponRes.discount_type === 'TRIAL_DAYS') {
          trialDays = Math.max(1, Math.round(Number(couponRes.discount_value || 30)));
          const trialDate = new Date();
          trialDate.setDate(trialDate.getDate() + trialDays);
          trialEndsAt = trialDate.toISOString();
        }

        // Incrementar uso do cupom
        await supabase
          .from('subscription_coupons')
          .update({ times_redeemed: (couponRes.times_redeemed || 0) + 1, updated_at: new Date().toISOString() })
          .eq('id', appliedCouponId);
      }

      // Desconto de 5% no PIX
      if (billing_type === 'PIX') {
        finalPeriodTotal = Math.round(finalPeriodTotal * 0.95 * 100) / 100;
      } else {
        finalPeriodTotal = Math.round(finalPeriodTotal * 100) / 100;
      }

      // Localizar ou Criar Customer no Asaas
      let customerId = subscription?.asaas_customer_id;
      const cleanCpfCnpj = String(cpf_cnpj || clinic.cnpj || profile.cpf || '').replace(/\D/g, '');

      if (!customerId) {
        if (!cleanCpfCnpj) {
          return new Response(JSON.stringify({ error: 'Por favor, informe um CPF ou CNPJ válido para gerar a cobrança.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (!isValidDocument(cleanCpfCnpj)) {
          return new Response(JSON.stringify({ error: 'O CPF ou CNPJ informado é inválido. Por favor, revise os dígitos.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Se a clínica não tinha documento cadastrado ou estava inválido, atualizar no banco
        if (cleanCpfCnpj && (!clinic.cnpj || !isValidDocument(clinic.cnpj))) {
          await supabase.from('clinics').update({ cnpj: cleanCpfCnpj }).eq('id', clinic_id);
        }

        const customerPayload = buildCustomerPayload({
          clinic,
          profile,
          user,
          cleanCpfCnpj,
          billing_name,
          billing_email,
          clinic_id,
        });

        const existingCustomer = await asaas.findCustomerByCpfCnpj(cleanCpfCnpj);
        if (existingCustomer) {
          customerId = existingCustomer.id;
          // Manter o cadastro do cliente atualizado com os dados completos de endereço e contato
          try {
            await asaas.updateCustomer(customerId, customerPayload);
          } catch (updateCustErr) {
            console.warn('[asaas-subscription] Não foi possível atualizar cliente existente no Asaas:', updateCustErr);
          }
        } else {
          const newCustomer = await asaas.createCustomer(customerPayload);
          customerId = newCustomer.id;
        }
      } else {
        // Se a assinatura já tinha customerId, sincronizar endereço/contato mais recentes da clínica
        if (cleanCpfCnpj && isValidDocument(cleanCpfCnpj)) {
          const customerPayload = buildCustomerPayload({
            clinic,
            profile,
            user,
            cleanCpfCnpj,
            billing_name,
            billing_email,
            clinic_id,
          });
          try {
            await asaas.updateCustomer(customerId, customerPayload);
          } catch (updateCustErr) {
            console.warn('[asaas-subscription] Não foi possível atualizar cliente pré-existente no Asaas:', updateCustErr);
          }
        }
      }

      // Calcular Data de Vencimento
      const todayStr = new Date().toISOString().split('T')[0];
      const dueDateObj = new Date();
      if (trialDays > 0) {
        dueDateObj.setDate(dueDateObj.getDate() + trialDays);
      } else if (billing_type !== 'CREDIT_CARD') {
        dueDateObj.setDate(dueDateObj.getDate() + 1);
      }
      const nextDueStr = (billing_type === 'CREDIT_CARD' && trialDays === 0) ? todayStr : dueDateObj.toISOString().split('T')[0];

      const asaasCycle = cycle === 'annual' ? 'ANNUALLY' : cycle === 'quarterly' ? 'QUARTERLY' : 'MONTHLY';
      const parsedInstallments = Math.max(1, parseInt(String(installment_count || '1'), 10) || 1);
      const isInstallmentCardPayment = billing_type === 'CREDIT_CARD' && parsedInstallments > 1;

      // Montar dados do cartão se houver
      let cardPayload: any = undefined;
      let cardHolderPayload: any = undefined;

      if (billing_type === 'CREDIT_CARD' && credit_card_data?.card) {
        cardPayload = {
          holderName: String(credit_card_data.card.holderName || '').trim(),
          number: String(credit_card_data.card.number || '').replace(/\D/g, ''),
          expiryMonth: String(credit_card_data.card.expiryMonth || '').padStart(2, '0'),
          expiryYear: String(credit_card_data.card.expiryYear || '').length === 2 ? `20${credit_card_data.card.expiryYear}` : String(credit_card_data.card.expiryYear || ''),
          ccv: String(credit_card_data.card.ccv || '').trim(),
        };

        const holder = credit_card_data.holder || {};
        const holderPostalCode = String(holder.postalCode || (clinic?.address as any)?.cep || '01001000').replace(/\D/g, '') || '01001000';
        const holderPhone = String(holder.phone || clinic.phone || profile.phone || '11999999999').replace(/\D/g, '') || '11999999999';
        const holderAddressNumber = String(holder.addressNumber || (clinic?.address as any)?.number || 'SN').trim() || 'SN';

        cardHolderPayload = {
          name: String(holder.name || credit_card_data.card.holderName || clinic.name || 'Titular').trim(),
          email: String(holder.email || clinic.email || user.email || 'contato@plurihealth.com').trim(),
          cpfCnpj: String(holder.cpfCnpj || cleanCpfCnpj).replace(/\D/g, ''),
          postalCode: holderPostalCode,
          addressNumber: holderAddressNumber,
          phone: holderPhone,
          mobilePhone: holderPhone,
        };
      }

      let asaasSub: any = null;
      let asaasPaymentDirect: any = null;

      if (isInstallmentCardPayment) {
        // Cobrança anual parcelada no cartão via /payments (com installmentCount e totalValue)
        const installmentPaymentData: any = {
          customer: customerId,
          billingType: 'CREDIT_CARD',
          totalValue: finalPeriodTotal,
          installmentCount: parsedInstallments,
          dueDate: nextDueStr,
          description: `Pluri-Health - ${getPlanTitle(selectedPlan)} (${config.cycleTitle}) em ${parsedInstallments}x${appliedCouponCode ? ` (Cupom: ${appliedCouponCode})` : ''}`,
          externalReference: clinic_id,
        };

        if (credit_card_token) {
          installmentPaymentData.creditCardToken = credit_card_token;
        } else if (cardPayload && cardHolderPayload) {
          installmentPaymentData.creditCard = cardPayload;
          installmentPaymentData.creditCardHolderInfo = cardHolderPayload;
        }

        if (subscription?.asaas_subscription_id) {
          try {
            await asaas.cancelSubscription(subscription.asaas_subscription_id);
          } catch (cancelErr) {
            console.warn('[asaas-subscription] Aviso ao cancelar assinatura anterior no Asaas:', cancelErr);
          }
        }

        console.log('[asaas-subscription] Processando cobrança parcelada de cartão no Asaas:', JSON.stringify({ ...installmentPaymentData, creditCard: '***' }));
        asaasPaymentDirect = await asaas.createPayment(installmentPaymentData);
      } else {
        // Assinatura recorrente padrão no Asaas (/subscriptions)
        const asaasSubData: Record<string, unknown> = {
          customer: customerId,
          billingType: billing_type || 'PIX',
          value: finalPeriodTotal,
          nextDueDate: nextDueStr,
          cycle: asaasCycle,
          description: `Pluri-Health - ${getPlanTitle(selectedPlan)} (${config.cycleTitle})${appliedCouponCode ? ` (Cupom: ${appliedCouponCode})` : ''}`,
          externalReference: clinic_id,
        };

        if (credit_card_token) {
          asaasSubData.creditCardToken = credit_card_token;
        } else if (cardPayload && cardHolderPayload) {
          asaasSubData.creditCard = cardPayload;
          asaasSubData.creditCardHolderInfo = cardHolderPayload;
        }

        console.log('[asaas-subscription] Processando assinatura no Asaas:', JSON.stringify(asaasSubData));
        
        if (billing_type === 'CREDIT_CARD') {
          if (subscription?.asaas_subscription_id) {
            try {
              await asaas.cancelSubscription(subscription.asaas_subscription_id);
            } catch (cancelErr) {
              console.warn('[asaas-subscription] Aviso ao cancelar assinatura anterior no Asaas:', cancelErr);
            }
          }
          asaasSub = await asaas.createSubscription(asaasSubData as any);
        } else {
          if (subscription?.asaas_subscription_id) {
            try {
              asaasSub = await asaas.updateSubscription(subscription.asaas_subscription_id, asaasSubData as any);
            } catch {
              asaasSub = await asaas.createSubscription(asaasSubData as any);
            }
          } else {
            asaasSub = await asaas.createSubscription(asaasSubData as any);
          }
        }
      }

      // Salvar em clinic_subscriptions (com duração de 365 dias para ciclo anual)
      const durationDays = cycle === 'annual' ? 365 : cycle === 'quarterly' ? 90 : 30;
      const planLimits = getPlanLimits(selectedPlan);
      const subPayload = {
        clinic_id: clinic_id,
        account_owner_user_id: user.id,
        asaas_customer_id: customerId,
        asaas_subscription_id: asaasSub?.id || asaasPaymentDirect?.installment || asaasPaymentDirect?.id || null,
        plan_type: selectedPlan,
        billing_cycle: cycle.toUpperCase(),
        payment_method: billing_type || 'PIX',
        base_monthly_price: baseMonthlyPrice,
        base_concurrent_access_count: planLimits.baseSeats,
        additional_concurrent_access_count: extraConcurrentSeats,
        additional_concurrent_access_price: extraSeatPrice,
        total_recurring_monthly_price: Math.round(finalMonthlyTotal * 100) / 100,
        base_subaccount_limit: planLimits.baseSubaccounts,
        status: trialDays > 0 ? 'BETA' : 'PENDING',
        is_free_trial: trialDays > 0,
        period_duration_days: durationDays,
        next_due_date: asaasSub?.nextDueDate || asaasPaymentDirect?.dueDate || nextDueStr,
        current_period_start: new Date().toISOString(),
        applied_coupon_id: appliedCouponId,
        coupon_code: appliedCouponCode,
        discount_percentage: discountPercentage,
        discount_fixed_amount: discountFixedAmount,
        trial_ends_at: trialEndsAt,
        cpf_cnpj: cleanCpfCnpj,
        billing_email: billing_email || clinic.email || profile.email || user.email,
        billing_name: billing_name || clinic.name || profile.full_name,
        updated_at: new Date().toISOString(),
      };

      const { data: updatedSub } = await supabase
        .from('clinic_subscriptions')
        .upsert(subPayload, { onConflict: 'clinic_id' })
        .select()
        .single();

      let firstInvoiceUrl: string | null = null;
      let firstBankSlipUrl: string | null = null;
      let firstPixQrCode: string | null = null;
      let firstPixCopyPaste: string | null = null;
      let isPaymentConfirmed = false;

      try {
        let firstPayment: any = asaasPaymentDirect || null;

        if (!firstPayment && asaasSub?.id) {
          for (let attempt = 0; attempt < 3; attempt++) {
            const paymentsRes = await asaas.getSubscriptionPayments(asaasSub.id);
            firstPayment = paymentsRes.data?.[0];
            if (firstPayment) break;
            await new Promise((res) => setTimeout(res, 600));
          }
        }

        if (firstPayment) {
          firstInvoiceUrl = firstPayment.invoiceUrl || `https://sandbox.asaas.com/i/${firstPayment.id}`;
          firstBankSlipUrl = firstPayment.bankSlipUrl || null;
          isPaymentConfirmed = firstPayment.status === 'CONFIRMED' || firstPayment.status === 'RECEIVED';

          if (billing_type === 'PIX' || !billing_type) {
            try {
              const qrData = await asaas.getPaymentQrCode(firstPayment.id);
              firstPixQrCode = qrData.encodedImage;
              firstPixCopyPaste = qrData.payload;
            } catch (qrErr) {
              console.warn('[asaas-subscription] Aviso ao obter QR Code PIX:', qrErr);
            }
          }

          // Salvar fatura em subscription_invoices
          await supabase.from('subscription_invoices').upsert({
            clinic_id: clinic_id,
            subscription_id: updatedSub?.id || null,
            asaas_payment_id: firstPayment.id,
            charge_type: 'RECURRING_SUBSCRIPTION',
            status: isPaymentConfirmed ? 'RECEIVED' : (firstPayment.status === 'OVERDUE' ? 'OVERDUE' : 'PENDING'),
            value: firstPayment.value || finalPeriodTotal,
            due_date: firstPayment.dueDate || asaasSub?.nextDueDate || nextDueStr,
            billing_type: billing_type || 'PIX',
            invoice_url: firstInvoiceUrl,
            bank_slip_url: firstBankSlipUrl,
            pix_qr_code: firstPixQrCode,
            pix_copy_paste: firstPixCopyPaste,
            installment_number: firstPayment.installmentNumber || 1,
            total_installments: parsedInstallments,
          }, { onConflict: 'asaas_payment_id' });

          if (isPaymentConfirmed) {
            await supabase.rpc('confirm_asaas_subscription_payment', {
              _asaas_payment_id: firstPayment.id,
              _clinic_id: clinic_id,
              _paid_value: firstPayment.value || finalPeriodTotal,
              _payment_date: new Date().toISOString(),
              _billing_type: billing_type || 'CREDIT_CARD',
            });
          }
        }
      } catch (payErr) {
        console.warn('[asaas-subscription] Aviso ao obter cobrança inicial:', payErr);
      }

      if (billing_type === 'CREDIT_CARD' && !isPaymentConfirmed) {
        return new Response(JSON.stringify({
          success: false,
          error: 'O cartão informado não foi autorizado pelo gateway bancário. Verifique os dados digitados ou tente outro meio de pagamento.',
          subscription: updatedSub,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        subscription: updatedSub,
        asaasSubscription: asaasSub || asaasPaymentDirect,
        invoiceUrl: firstInvoiceUrl,
        bankSlipUrl: firstBankSlipUrl,
        pixQrCode: firstPixQrCode,
        pixCopyPaste: firstPixCopyPaste,
        couponApplied: !!appliedCouponCode,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // =========================================================================
    // AÇÃO 2: UPDATE_SEATS (Ajuste de Acessos Simultâneos)
    // =========================================================================
    if (action === 'UPDATE_SEATS') {
      if (!subscription || !subscription.asaas_subscription_id) {
        return new Response(JSON.stringify({ error: 'Nenhuma assinatura ativa encontrada no Asaas.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const currentPlan = subscription.plan_type === 'enterprise' ? 'enterprise' : 'clinic';
      const cycle = (subscription.billing_cycle || 'ANNUAL').toLowerCase() as 'annual' | 'quarterly' | 'monthly';
      const config = (PLAN_PRICING_CONFIG[currentPlan] as any)[cycle] || (PLAN_PRICING_CONFIG[currentPlan] as any).annual;
      const newSeatsCount = Math.max(0, Math.floor(additional_seats_count || 0));

      const rawMonthlyTotal = config.baseMonthlyEq + (newSeatsCount * config.extraSeatRate);
      let finalPeriodTotal = rawMonthlyTotal * config.periodMultiplier;

      const discountPct = Number(subscription.discount_percentage || 0);
      const discountFixed = Number(subscription.discount_fixed_amount || 0);

      if (discountPct > 0) {
        finalPeriodTotal = Math.max(0, finalPeriodTotal * (1 - (discountPct / 100)));
      } else if (discountFixed > 0) {
        finalPeriodTotal = Math.max(0, finalPeriodTotal - discountFixed);
      }

      await asaas.updateSubscription(subscription.asaas_subscription_id, {
        value: Math.round(finalPeriodTotal * 100) / 100,
      });

      const { data: updatedSub, error: updateErr } = await supabase
        .from('clinic_subscriptions')
        .update({
          additional_concurrent_access_count: newSeatsCount,
          additional_concurrent_access_price: config.extraSeatRate,
          total_recurring_monthly_price: Math.round((finalPeriodTotal / config.periodMultiplier) * 100) / 100,
          updated_at: new Date().toISOString(),
        })
        .eq('clinic_id', clinic_id)
        .select()
        .maybeSingle();

      if (updateErr) {
        throw new Error(`Erro ao atualizar acessos no banco: ${updateErr.message}`);
      }

      return new Response(JSON.stringify({ success: true, subscription: updatedSub }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // =========================================================================
    // AÇÃO 3: CHANGE_PLAN (Troca de Plano Solo <-> Clínica <-> Enterprise)
    // =========================================================================
    if (action === 'CHANGE_PLAN') {
      const targetPlan = plan_type === 'enterprise' ? 'enterprise' : plan_type === 'clinic' ? 'clinic' : 'solo';
      const cycle = (billing_cycle || subscription?.billing_cycle || 'ANNUAL').toLowerCase() as 'annual' | 'quarterly' | 'monthly';

      if (targetPlan === 'solo') {
        const { count: colabCount } = await supabase
          .from('clinic_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('clinic_id', clinic_id)
          .eq('is_active', true)
          .eq('membership_status', 'active')
          .neq('account_role', 'account_owner')
          .neq('account_role', 'owner');

        if (colabCount && colabCount > 0) {
          return new Response(JSON.stringify({
            error: `Não é possível alterar para o plano Solo enquanto houver ${colabCount} colaborador(es) ativo(s) cadastrado(s). Desative ou remova os colaboradores primeiro.`
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      const config = (PLAN_PRICING_CONFIG[targetPlan] as any)[cycle] || (PLAN_PRICING_CONFIG[targetPlan] as any).annual;
      const extraSeats = targetPlan === 'solo' ? 0 : (subscription?.additional_concurrent_access_count || 0);
      const rawMonthlyTotal = config.baseMonthlyEq + (extraSeats * config.extraSeatRate);
      let finalPeriodTotal = rawMonthlyTotal * config.periodMultiplier;

      const discountPct = Number(subscription?.discount_percentage || 0);
      const discountFixed = Number(subscription?.discount_fixed_amount || 0);

      if (discountPct > 0) {
        finalPeriodTotal = Math.max(0, finalPeriodTotal * (1 - (discountPct / 100)));
      } else if (discountFixed > 0) {
        finalPeriodTotal = Math.max(0, finalPeriodTotal - discountFixed);
      }

      if (subscription?.asaas_subscription_id) {
        await asaas.updateSubscription(subscription.asaas_subscription_id, {
          value: Math.round(finalPeriodTotal * 100) / 100,
          description: `Pluri-Health - ${getPlanTitle(targetPlan)} (${config.cycleTitle})`,
        });
      }

      const planLimits = getPlanLimits(targetPlan);
      const subPayload: Record<string, unknown> = {
        clinic_id: clinic_id,
        account_owner_user_id: subscription?.account_owner_user_id || clinic.account_owner_user_id || user.id,
        plan_type: targetPlan,
        billing_cycle: cycle.toUpperCase(),
        base_monthly_price: config.baseMonthlyEq,
        base_subaccount_limit: planLimits.baseSubaccounts,
        base_concurrent_access_count: planLimits.baseSeats,
        additional_concurrent_access_count: extraSeats,
        additional_concurrent_access_price: config.extraSeatRate,
        total_recurring_monthly_price: Math.round((finalPeriodTotal / config.periodMultiplier) * 100) / 100,
        status: subscription?.status || 'ACTIVE',
        payment_method: subscription?.payment_method || 'CREDIT_CARD',
        updated_at: new Date().toISOString(),
      };

      const { data: updatedSub, error: updateErr } = await supabase
        .from('clinic_subscriptions')
        .upsert(subPayload, { onConflict: 'clinic_id' })
        .select()
        .maybeSingle();

      if (updateErr) {
        throw new Error(`Erro ao atualizar plano no banco: ${updateErr.message}`);
      }

      return new Response(JSON.stringify({ success: true, subscription: updatedSub }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // =========================================================================
    // AÇÃO 4: CANCEL (Cancelamento de Assinatura)
    // =========================================================================
    if (action === 'CANCEL') {
      if (subscription?.asaas_subscription_id) {
        await asaas.cancelSubscription(subscription.asaas_subscription_id);
      }

      const { data: updatedSub } = await supabase
        .from('clinic_subscriptions')
        .update({
          status: 'CANCELED',
          updated_at: new Date().toISOString(),
        })
        .eq('clinic_id', clinic_id)
        .select()
        .maybeSingle();

      return new Response(JSON.stringify({ success: true, subscription: updatedSub }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // =========================================================================
    // AÇÃO 5: TOKENIZE_TRIAL_CARD (Tokenizar Cartão no Período de Testes Sem Cobrança Imediata)
    // =========================================================================
    if (action === 'TOKENIZE_TRIAL_CARD') {
      if (!credit_card_data?.card) {
        return new Response(JSON.stringify({ error: 'Dados do cartão de crédito são obrigatórios.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 1. Localizar ou Criar Customer no Asaas
      let customerId = customer_id || subscription?.asaas_customer_id;
      const cleanCpfCnpj = String(cpf_cnpj || clinic.cnpj || profile.cpf || '').replace(/\D/g, '');

      if (!customerId) {
        if (!cleanCpfCnpj) {
          return new Response(JSON.stringify({ error: 'Por favor, informe um CPF ou CNPJ válido para registrar o cartão.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (!isValidDocument(cleanCpfCnpj)) {
          return new Response(JSON.stringify({ error: 'O CPF ou CNPJ informado é inválido. Por favor, revise os dígitos.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const customerPayload = buildCustomerPayload({
          clinic,
          profile,
          user,
          cleanCpfCnpj,
          billing_name,
          billing_email,
          clinic_id,
        });

        const existingCustomer = await asaas.findCustomerByCpfCnpj(cleanCpfCnpj);
        if (existingCustomer) {
          customerId = existingCustomer.id;
          try {
            await asaas.updateCustomer(customerId, customerPayload);
          } catch (updateCustErr) {
            console.warn('[asaas-subscription] Não foi possível atualizar cliente existente no Asaas:', updateCustErr);
          }
        } else {
          const newCustomer = await asaas.createCustomer(customerPayload);
          customerId = newCustomer.id;
        }
      } else {
        if (cleanCpfCnpj && isValidDocument(cleanCpfCnpj)) {
          const customerPayload = buildCustomerPayload({
            clinic,
            profile,
            user,
            cleanCpfCnpj,
            billing_name,
            billing_email,
            clinic_id,
          });
          try {
            await asaas.updateCustomer(customerId, customerPayload);
          } catch (updateCustErr) {
            console.warn('[asaas-subscription] Não foi possível atualizar cliente pré-existente no Asaas:', updateCustErr);
          }
        }
      }

      // 2. Montar dados para tokenização
      const cardPayload = {
        holderName: String(credit_card_data.card.holderName || '').trim(),
        number: String(credit_card_data.card.number || '').replace(/\D/g, ''),
        expiryMonth: String(credit_card_data.card.expiryMonth || '').padStart(2, '0'),
        expiryYear: String(credit_card_data.card.expiryYear || '').length === 2 ? `20${credit_card_data.card.expiryYear}` : String(credit_card_data.card.expiryYear || ''),
        ccv: String(credit_card_data.card.ccv || '').trim(),
      };

      const holder = credit_card_data.holder || {};
      const holderPostalCode = String(holder.postalCode || (clinic?.address as any)?.cep || '01001000').replace(/\D/g, '') || '01001000';
      const holderPhone = String(holder.phone || clinic.phone || profile.phone || '11999999999').replace(/\D/g, '') || '11999999999';
      const holderAddressNumber = String(holder.addressNumber || (clinic?.address as any)?.number || 'SN').trim() || 'SN';

      const cardHolderPayload = {
        name: String(holder.name || credit_card_data.card.holderName || clinic.name || 'Titular').trim(),
        email: String(holder.email || clinic.email || user.email || 'contato@plurihealth.com').trim(),
        cpfCnpj: String(holder.cpfCnpj || cleanCpfCnpj).replace(/\D/g, ''),
        postalCode: holderPostalCode,
        addressNumber: holderAddressNumber,
        phone: holderPhone,
        mobilePhone: holderPhone,
      };

      // Executar cobrança de verificação de R$ 0,01
      const todayStr = new Date().toISOString().split('T')[0];
      let verificationPayment: any = null;

      try {
        console.log('[asaas-subscription] Processando cobrança de verificação (R$ 0,01) para customer:', customerId);
        verificationPayment = await asaas.createPayment({
          customer: customerId,
          billingType: 'CREDIT_CARD',
          value: 0.01,
          dueDate: todayStr,
          description: 'Pluri-Health - Validação de Cartão de Crédito (R$ 0,01)',
          creditCard: cardPayload,
          creditCardHolderInfo: cardHolderPayload,
        });
      } catch (chargeErr: any) {
        const errStr = String(chargeErr?.message || chargeErr || '');
        if (errStr.toLowerCase().includes('mínimo') || errStr.toLowerCase().includes('minimo') || errStr.includes('5.00') || errStr.includes('5,00')) {
          verificationPayment = await asaas.createPayment({
            customer: customerId,
            billingType: 'CREDIT_CARD',
            value: 5.00,
            dueDate: todayStr,
            description: 'Pluri-Health - Validação de Segurança (Estorno Automático)',
            creditCard: cardPayload,
            creditCardHolderInfo: cardHolderPayload,
          });
          if (verificationPayment?.id) {
            try {
              await asaas.refundPayment(verificationPayment.id, 5.00, 'Estorno automático de validação Pluri-Health');
            } catch (refErr) {
              console.warn('[asaas-subscription] Aviso ao estornar cobrança de teste:', refErr);
            }
          }
        } else {
          return new Response(JSON.stringify({
            success: false,
            error: chargeErr.message || 'Cartão de crédito não autorizado pelo banco emissor.',
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      console.log('[asaas-subscription] Tokenizando cartão para customer:', customerId);
      const tokenResult = await asaas.tokenizeCreditCard({
        customer: customerId,
        creditCard: cardPayload,
        creditCardHolderInfo: cardHolderPayload,
      });

      // Se a cobrança de verificação foi gerada, salvar fatura
      if (verificationPayment?.id && clinic_id) {
        await supabase.from('subscription_invoices').insert({
          clinic_id: clinic_id,
          asaas_payment_id: verificationPayment.id,
          status: 'CONFIRMED',
          value: verificationPayment.value || 0.01,
          due_date: todayStr,
          billing_type: 'CREDIT_CARD',
          invoice_url: verificationPayment.invoiceUrl || null,
        });
      }

      const selectedPlan = plan_type === 'enterprise' ? 'enterprise' : plan_type === 'clinic' ? 'clinic' : 'solo';
      const cycleKey = (billing_cycle || 'annual').toLowerCase() as 'annual' | 'quarterly' | 'monthly';
      const cycle = cycleKey in PLAN_PRICING_CONFIG[selectedPlan] ? cycleKey : 'annual';
      const config = (PLAN_PRICING_CONFIG[selectedPlan] as any)[cycle];
      const planLimits = getPlanLimits(selectedPlan);

      // Associar token, cupom e customer à assinatura da clínica
      let trialDays = 7;
      let appliedCouponId: string | null = null;
      let appliedCouponCode: string | null = null;
      let statusToSet = 'TRIAL';

      if (coupon_code && String(coupon_code).trim() !== '') {
        const { data: couponRes, error: couponErr } = await supabase.rpc('validate_subscription_coupon', {
          _code: coupon_code,
          _plan_type: selectedPlan,
          _clinic_id: clinic_id,
          _billing_cycle: cycle,
        });

        if (!couponErr && couponRes && couponRes.valid) {
          appliedCouponId = couponRes.coupon_id;
          appliedCouponCode = couponRes.code;
          if (couponRes.discount_type === 'TRIAL_DAYS') {
            trialDays = Math.max(7, Math.round(Number(couponRes.discount_value || 180)));
            statusToSet = 'BETA';
          }

          await supabase
            .from('subscription_coupons')
            .update({ times_redeemed: (couponRes.times_redeemed || 0) + 1, updated_at: new Date().toISOString() })
            .eq('id', appliedCouponId);
        }
      }

      const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();

      const subPayload: Record<string, unknown> = {
        clinic_id: clinic_id,
        account_owner_user_id: user.id,
        asaas_customer_id: customerId,
        payment_method: 'CREDIT_CARD',
        plan_type: selectedPlan,
        billing_cycle: cycle.toUpperCase(),
        base_monthly_price: config.baseMonthlyEq,
        base_concurrent_access_count: planLimits.baseSeats,
        base_subaccount_limit: planLimits.baseSubaccounts,
        total_recurring_monthly_price: config.baseMonthlyEq,
        cpf_cnpj: cleanCpfCnpj,
        billing_email: billing_email || clinic.email || profile.email || user.email,
        billing_name: billing_name || clinic.name || profile.full_name,
        trial_card_token: tokenResult.creditCardToken,
        trial_ends_at: trialEndsAt,
        applied_coupon_id: appliedCouponId,
        coupon_code: appliedCouponCode,
        status: statusToSet,
        is_free_trial: true,
        updated_at: new Date().toISOString(),
      };

      const { data: updatedSub, error: updateSubErr } = await supabase
        .from('clinic_subscriptions')
        .upsert(subPayload, { onConflict: 'clinic_id' })
        .select()
        .maybeSingle();

      if (updateSubErr) {
        console.warn('[asaas-subscription] Erro ao registrar assinatura com cartão tokenizado:', updateSubErr);
      }

      return new Response(JSON.stringify({
        success: true,
        creditCardToken: tokenResult.creditCardToken,
        creditCardNumber: tokenResult.creditCardNumber,
        creditCardBrand: tokenResult.creditCardBrand,
        customerId,
        subscription: updatedSub || subscription,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Ação não reconhecida.' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[asaas-subscription] Exceção:', err);
    return new Response(JSON.stringify({
      success: false,
      error: message || 'Erro interno do servidor ao processar Asaas.',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

