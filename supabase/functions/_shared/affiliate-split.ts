import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { AsaasClient, AsaasSplitItem } from './asaas-client.ts';

export interface AffiliateRecord {
  id: string;
  user_id: string;
  clinic_id: string;
  coupon_code: string;
  referral_slug: string;
  asaas_account_id: string;
  asaas_wallet_id: string | null;
  status: 'active' | 'suspended' | 'banned' | 'absorbed_by_platform';
  first_month_commission_percent: number;
  recurring_commission_percent: number;
  active_referrals_count: number;
  total_sales_count: number;
  lifetime_commission_cents: number;
  deleted_at: string | null;
}

export interface ResolveAffiliateParams {
  supabase: SupabaseClient;
  couponCode?: string | null;
  affiliateId?: string | null;
  clinicId?: string | null;
  customerUserId?: string | null;
}

export interface ResolvedAffiliateResult {
  affiliate: AffiliateRecord;
  walletId: string;
  firstMonthCommissionPercent: number;
  splitPayload: AsaasSplitItem[];
}

/**
 * Localiza e valida o afiliado associado a um cupom ou affiliateId durante o checkout.
 * Implementa verificação preventiva de auto-indicação (anti-self-referral).
 */
export async function resolveAffiliateForCheckout(
  params: ResolveAffiliateParams
): Promise<{ result?: ResolvedAffiliateResult; error?: string }> {
  const { supabase, couponCode, affiliateId, clinicId, customerUserId } = params;

  if (!couponCode && !affiliateId) {
    return {};
  }

  let affiliate: AffiliateRecord | null = null;

  // 1. Busca por ID direto do afiliado se fornecido
  if (affiliateId) {
    const { data, error } = await supabase
      .from('affiliates')
      .select('*')
      .eq('id', affiliateId)
      .is('deleted_at', null)
      .maybeSingle();

    if (!error && data) {
      affiliate = data as AffiliateRecord;
    }
  }

  // 2. Busca por cupom se ainda não encontrou
  if (!affiliate && couponCode && String(couponCode).trim() !== '') {
    const normalizedCode = String(couponCode).trim().toUpperCase();

    // 2.1 Verifica se o cupom possui affiliate_id em subscription_coupons
    const { data: couponData } = await supabase
      .from('subscription_coupons')
      .select('affiliate_id')
      .eq('code', normalizedCode)
      .maybeSingle();

    if (couponData?.affiliate_id) {
      const { data: affData } = await supabase
        .from('affiliates')
        .select('*')
        .eq('id', couponData.affiliate_id)
        .is('deleted_at', null)
        .maybeSingle();

      if (affData) {
        affiliate = affData as AffiliateRecord;
      }
    }

    // 2.2 Se ainda não encontrou, busca diretamente em affiliates por coupon_code ou referral_slug
    if (!affiliate) {
      const { data: affData } = await supabase
        .from('affiliates')
        .select('*')
        .or(`coupon_code.ilike.${normalizedCode},referral_slug.ilike.${normalizedCode.toLowerCase()}`)
        .is('deleted_at', null)
        .maybeSingle();

      if (affData) {
        affiliate = affData as AffiliateRecord;
      }
    }
  }

  if (!affiliate) {
    return {};
  }

  // Validação 1: Afiliado ativo
  if (affiliate.status !== 'active') {
    console.warn(`[affiliate-split] Afiliado ${affiliate.id} não está ativo (status: ${affiliate.status}). Split ignorado.`);
    return {};
  }

  // Validação 2: Prevenção Anti-Self-Referral (Lei Federal e Governança do Programa)
  if (customerUserId && affiliate.user_id && affiliate.user_id === customerUserId) {
    return {
      error: 'Auto-indicação proibida: Você não pode utilizar seu próprio cupom de afiliado.',
    };
  }

  if (clinicId && affiliate.clinic_id && affiliate.clinic_id === clinicId) {
    return {
      error: 'Auto-indicação proibida: A clínica titular do cupom não pode assinar utilizando o próprio benefício.',
    };
  }

  // Obter Wallet do Asaas (prioriza asaas_wallet_id, fallback asaas_account_id)
  const walletId = affiliate.asaas_wallet_id || affiliate.asaas_account_id;
  if (!walletId) {
    console.warn(`[affiliate-split] Afiliado ${affiliate.id} não possui carteira Asaas configurada. Split ignorado.`);
    return {};
  }

  const firstMonthPercent = Number(affiliate.first_month_commission_percent) || 30.00;
  const splitPayload: AsaasSplitItem[] = [
    {
      walletId,
      percentualValue: firstMonthPercent,
      description: `Comissão 1º Mês Afiliado ${affiliate.coupon_code || ''}`.trim(),
    },
  ];

  return {
    result: {
      affiliate,
      walletId,
      firstMonthCommissionPercent: firstMonthPercent,
      splitPayload,
    },
  };
}

export interface RecordConversionParams {
  supabase: SupabaseClient;
  affiliateId: string;
  customerUserId: string;
  clinicId: string;
  asaasSubscriptionId: string;
  planType: string;
  billingCycle: string;
  isTrial?: boolean;
}

/**
 * Grava o registro da conversão em public.affiliate_conversions.
 */
export async function recordAffiliateConversion(
  params: RecordConversionParams
): Promise<void> {
  const {
    supabase,
    affiliateId,
    customerUserId,
    clinicId,
    asaasSubscriptionId,
    planType,
    billingCycle,
    isTrial,
  } = params;

  try {
    const { error } = await supabase
      .from('affiliate_conversions')
      .insert({
        affiliate_id: affiliateId,
        customer_user_id: customerUserId,
        clinic_id: clinicId,
        asaas_subscription_id: asaasSubscriptionId,
        plan_type: planType,
        billing_cycle: billingCycle,
        status: isTrial ? 'trial' : 'active',
        beneficiary_type: 'affiliate',
        total_cycles_paid: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[affiliate-split] Erro ao gravar affiliate_conversions:', error);
    } else {
      console.log(`[affiliate-split] Conversão registrada com sucesso: Afiliado ${affiliateId} -> Assinatura ${asaasSubscriptionId}`);
    }
  } catch (err) {
    console.error('[affiliate-split] Exceção ao persistir affiliate_conversions:', err);
  }
}

export interface HandlePaymentReceivedParams {
  supabase: SupabaseClient;
  asaasClient: AsaasClient;
  payment: Record<string, unknown>;
  targetSubId?: string | null;
  targetClinicId?: string | null;
}

/**
 * Processa comissão e split no evento PAYMENT_RECEIVED do Asaas Webhook.
 */
export async function handleAffiliatePaymentReceived(
  params: HandlePaymentReceivedParams
): Promise<void> {
  const { supabase, asaasClient, payment, targetSubId, targetClinicId } = params;

  const paymentId = String(payment.id || '');
  if (!paymentId) return;

  // 1. Localizar conversão vinculada à assinatura ou pagamento
  let conversion: Record<string, unknown> | null = null;

  if (targetSubId) {
    const { data } = await supabase
      .from('affiliate_conversions')
      .select('*')
      .eq('asaas_subscription_id', targetSubId)
      .is('deleted_at', null)
      .maybeSingle();
    if (data) conversion = data;
  }

  if (!conversion && payment.installment) {
    const { data } = await supabase
      .from('affiliate_conversions')
      .select('*')
      .eq('asaas_subscription_id', String(payment.installment))
      .is('deleted_at', null)
      .maybeSingle();
    if (data) conversion = data;
  }

  if (!conversion && paymentId) {
    const { data } = await supabase
      .from('affiliate_conversions')
      .select('*')
      .eq('asaas_subscription_id', paymentId)
      .is('deleted_at', null)
      .maybeSingle();
    if (data) conversion = data;
  }

  if (!conversion && targetClinicId) {
    const { data } = await supabase
      .from('affiliate_conversions')
      .select('*')
      .eq('clinic_id', targetClinicId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) conversion = data;
  }

  if (!conversion) {
    // Pagamento não vinculado a nenhum afiliado
    return;
  }

  const conversionId = String(conversion.id);
  const affiliateId = String(conversion.affiliate_id);

  // 2. Idempotência: verificar se este pagamento já gerou comissão
  const { data: existingCommission } = await supabase
    .from('affiliate_commissions')
    .select('id, payment_status')
    .eq('asaas_payment_id', paymentId)
    .maybeSingle();

  if (existingCommission && existingCommission.payment_status === 'received') {
    console.log(`[affiliate-split] Pagamento ${paymentId} já processado em affiliate_commissions (${existingCommission.id}).`);
    return;
  }

  // 3. Obter dados atualizados do afiliado
  const { data: affiliateData, error: affErr } = await supabase
    .from('affiliates')
    .select('*')
    .eq('id', affiliateId)
    .is('deleted_at', null)
    .maybeSingle();

  if (affErr || !affiliateData) {
    console.warn(`[affiliate-split] Afiliado ${affiliateId} não localizado para comissão do pagamento ${paymentId}.`);
    return;
  }

  const affiliate = affiliateData as AffiliateRecord;
  const totalCyclesPaid = Number(conversion.total_cycles_paid || 0);
  const isFirstMonth = totalCyclesPaid === 0;

  // 4. Determinar percentual e valores estritamente em centavos (BIGINT)
  const commissionPercent = isFirstMonth
    ? Number(affiliate.first_month_commission_percent) || 30.00
    : Number(affiliate.recurring_commission_percent) || 10.00;

  const rawValue = payment.value || payment.netValue || 0;
  const grossAmountCents = Math.round(Number(rawValue) * 100);
  const commissionAmountCents = Math.round((grossAmountCents * commissionPercent) / 100);
  const pluriNetCents = Math.max(0, grossAmountCents - commissionAmountCents);

  const paymentDate = payment.paymentDate || payment.clientPaymentDate || new Date().toISOString();
  const paidAt = new Date(paymentDate as string).toISOString();

  // 5. Registrar comissão em public.affiliate_commissions
  const { error: commInsertErr } = await supabase
    .from('affiliate_commissions')
    .insert({
      affiliate_id: affiliate.id,
      conversion_id: conversionId,
      asaas_payment_id: paymentId,
      is_first_month: isFirstMonth,
      gross_amount_cents: grossAmountCents,
      commission_percent: commissionPercent,
      commission_amount_cents: commissionAmountCents,
      pluri_net_cents: pluriNetCents,
      payment_status: 'received',
      paid_at: paidAt,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

  if (commInsertErr) {
    console.error(`[affiliate-split] Erro ao registrar affiliate_commissions para ${paymentId}:`, commInsertErr);
  } else {
    console.log(`[affiliate-split] Comissão de ${commissionAmountCents} centavos (${commissionPercent}%) registrada para afiliado ${affiliate.id}.`);
  }

  // 6. Incrementar total_cycles_paid na conversão
  const nextCycles = totalCyclesPaid + 1;
  await supabase
    .from('affiliate_conversions')
    .update({
      total_cycles_paid: nextCycles,
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversionId);

  // 7. Atualizar contadores no afiliado
  const currentSales = Number(affiliate.total_sales_count || 0);
  const currentReferrals = Number(affiliate.active_referrals_count || 0);
  const currentLifetime = Number(affiliate.lifetime_commission_cents || 0);

  if (isFirstMonth) {
    await supabase
      .from('affiliates')
      .update({
        total_sales_count: currentSales + 1,
        active_referrals_count: currentReferrals + 1,
        lifetime_commission_cents: currentLifetime + commissionAmountCents,
        updated_at: new Date().toISOString(),
      })
      .eq('id', affiliate.id);
  } else {
    await supabase
      .from('affiliates')
      .update({
        lifetime_commission_cents: currentLifetime + commissionAmountCents,
        updated_at: new Date().toISOString(),
      })
      .eq('id', affiliate.id);
  }

  // 8. Se for o 1º pagamento, ATUALIZAR O SPLIT DA ASSINATURA NO ASAAS para as próximas cobranças recorrentes
  if (isFirstMonth && targetSubId) {
    const affiliateWalletId = affiliate.asaas_wallet_id || affiliate.asaas_account_id;
    const recurringPercent = Number(affiliate.recurring_commission_percent) || 10.00;

    if (affiliateWalletId) {
      try {
        await asaasClient.updateSubscriptionSplit(targetSubId, [
          {
            walletId: affiliateWalletId,
            percentualValue: recurringPercent,
            description: `Comissão Recorrente Afiliado ${affiliate.coupon_code || ''}`.trim(),
          },
        ]);
        console.log(`[affiliate-split] Split da assinatura ${targetSubId} atualizado no Asaas para recorrência (${recurringPercent}%).`);
      } catch (splitErr) {
        console.error(`[affiliate-split] Falha ao atualizar split recorrente no Asaas para assinatura ${targetSubId}:`, splitErr);
      }
    }
  }
}

export interface HandlePaymentRefundedParams {
  supabase: SupabaseClient;
  paymentId: string;
}

/**
 * Trata estorno / chargeback de pagamento no Asaas Webhook.
 */
export async function handleAffiliatePaymentRefunded(
  params: HandlePaymentRefundedParams
): Promise<void> {
  const { supabase, paymentId } = params;

  if (!paymentId) return;

  const { data: commission, error: findErr } = await supabase
    .from('affiliate_commissions')
    .select('id, affiliate_id, commission_amount_cents, payment_status')
    .eq('asaas_payment_id', paymentId)
    .eq('payment_status', 'received')
    .maybeSingle();

  if (findErr || !commission) {
    // Nenhuma comissão recebida vinculada a este pagamento
    return;
  }

  // 1. Atualizar status da comissão para refunded
  await supabase
    .from('affiliate_commissions')
    .update({
      payment_status: 'refunded',
      updated_at: new Date().toISOString(),
    })
    .eq('id', commission.id);

  // 2. Abater valor da comissão de lifetime_commission_cents no afiliado
  const { data: affiliate } = await supabase
    .from('affiliates')
    .select('id, lifetime_commission_cents')
    .eq('id', commission.affiliate_id)
    .maybeSingle();

  if (affiliate) {
    const currentLifetime = Number(affiliate.lifetime_commission_cents || 0);
    const refundAmount = Number(commission.commission_amount_cents || 0);
    const newLifetime = Math.max(0, currentLifetime - refundAmount);

    await supabase
      .from('affiliates')
      .update({
        lifetime_commission_cents: newLifetime,
        updated_at: new Date().toISOString(),
      })
      .eq('id', affiliate.id);

    console.log(`[affiliate-split] Estorno de ${refundAmount} centavos abatido do total do afiliado ${affiliate.id}.`);
  }
}
