// supabase/functions/asaas-subscription/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';
import { AsaasClient } from '../_shared/asaas-client.ts';

const PLAN_PRICING_CONFIG = {
  solo: {
    annual: { baseMonthlyEq: 40.0, extraSeatRate: 0.0, periodMultiplier: 12, periodLabel: 'ano', cycleTitle: 'Plano Anual (Economia de 25%)' },
    quarterly: { baseMonthlyEq: 48.0, extraSeatRate: 0.0, periodMultiplier: 3, periodLabel: 'trimestre', cycleTitle: 'Plano Trimestral (-10% OFF)' },
    monthly: { baseMonthlyEq: 52.0, extraSeatRate: 0.0, periodMultiplier: 1, periodLabel: 'mês', cycleTitle: 'Plano Mensal' },
  },
  clinic: {
    annual: { baseMonthlyEq: 60.0, extraSeatRate: 10.0, periodMultiplier: 12, periodLabel: 'ano', cycleTitle: 'Plano Anual (Economia de 25%)' },
    quarterly: { baseMonthlyEq: 72.0, extraSeatRate: 12.0, periodMultiplier: 3, periodLabel: 'trimestre', cycleTitle: 'Plano Trimestral (-10% OFF)' },
    monthly: { baseMonthlyEq: 78.0, extraSeatRate: 13.0, periodMultiplier: 1, periodLabel: 'mês', cycleTitle: 'Plano Mensal' },
  },
} as const;

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
      installment_count,
      coupon_code,
      cpf_cnpj,
      billing_name,
      billing_email,
      payment_id,
      subscription_id,
      customer_id,
    } = body;

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
      const selectedPlan = plan_type === 'clinic' ? 'clinic' : 'solo';
      const cycleKey = (billing_cycle || 'annual').toLowerCase() as 'annual' | 'quarterly' | 'monthly';
      const cycle = cycleKey in PLAN_PRICING_CONFIG[selectedPlan] ? cycleKey : 'annual';
      const config = PLAN_PRICING_CONFIG[selectedPlan][cycle];

      const extraConcurrentSeats = selectedPlan === 'clinic' ? Math.max(0, Math.floor(additional_seats_count || 0)) : 0;
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
          return new Response(JSON.stringify({ error: 'CPF ou CNPJ válido é obrigatório para registrar cobranças.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const existingCustomer = await asaas.findCustomerByCpfCnpj(cleanCpfCnpj);
        if (existingCustomer) {
          customerId = existingCustomer.id;
        } else {
          const newCustomer = await asaas.createCustomer({
            name: billing_name || clinic.legal_name || clinic.name || profile.full_name || 'Cliente Pluri-Health',
            email: billing_email || clinic.email || profile.email || user.email,
            cpfCnpj: cleanCpfCnpj,
            phone: clinic.phone || profile.phone,
            externalReference: clinic_id,
          });
          customerId = newCustomer.id;
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
      const nextDueStr = billing_type === 'CREDIT_CARD' ? todayStr : dueDateObj.toISOString().split('T')[0];

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
          description: `Pluri-Health - Plano ${selectedPlan === 'clinic' ? 'Clínica com Equipe' : 'Profissional Solo'} (${config.cycleTitle}) em ${parsedInstallments}x${appliedCouponCode ? ` (Cupom: ${appliedCouponCode})` : ''}`,
          externalReference: clinic_id,
          creditCard: cardPayload,
          creditCardHolderInfo: cardHolderPayload,
        };

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
          description: `Pluri-Health - Plano ${selectedPlan === 'clinic' ? 'Clínica com Equipe' : 'Profissional Solo'} (${config.cycleTitle})${appliedCouponCode ? ` (Cupom: ${appliedCouponCode})` : ''}`,
          externalReference: clinic_id,
        };

        if (cardPayload && cardHolderPayload) {
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
      const subPayload = {
        clinic_id: clinic_id,
        account_owner_user_id: user.id,
        asaas_customer_id: customerId,
        asaas_subscription_id: asaasSub?.id || asaasPaymentDirect?.installment || asaasPaymentDirect?.id || null,
        plan_type: selectedPlan,
        billing_cycle: cycle.toUpperCase(),
        payment_method: billing_type || 'PIX',
        base_monthly_price: baseMonthlyPrice,
        base_concurrent_access_count: selectedPlan === 'clinic' ? 2 : 1,
        additional_concurrent_access_count: extraConcurrentSeats,
        additional_concurrent_access_price: extraSeatPrice,
        total_recurring_monthly_price: Math.round(finalMonthlyTotal * 100) / 100,
        base_subaccount_limit: selectedPlan === 'clinic' ? 30 : 1,
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

      const cycle = (subscription.billing_cycle || 'ANNUAL').toLowerCase() as 'annual' | 'quarterly' | 'monthly';
      const config = PLAN_PRICING_CONFIG.clinic[cycle] || PLAN_PRICING_CONFIG.clinic.annual;
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
        .single();

      if (updateErr) {
        throw new Error(`Erro ao atualizar acessos no banco: ${updateErr.message}`);
      }

      return new Response(JSON.stringify({ success: true, subscription: updatedSub }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // =========================================================================
    // AÇÃO 3: CHANGE_PLAN (Troca de Plano Solo <-> Clínica)
    // =========================================================================
    if (action === 'CHANGE_PLAN') {
      const targetPlan = plan_type === 'clinic' ? 'clinic' : 'solo';
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

      const config = PLAN_PRICING_CONFIG[targetPlan][cycle] || PLAN_PRICING_CONFIG[targetPlan].annual;
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
          description: `Pluri-Health - Plano ${targetPlan === 'clinic' ? 'Clínica com Equipe' : 'Profissional Solo'} (${config.cycleTitle})`,
        });
      }

      const { data: updatedSub, error: updateErr } = await supabase
        .from('clinic_subscriptions')
        .update({
          plan_type: targetPlan,
          billing_cycle: cycle.toUpperCase(),
          base_monthly_price: config.baseMonthlyEq,
          base_subaccount_limit: targetPlan === 'clinic' ? 30 : 1,
          base_concurrent_access_count: targetPlan === 'clinic' ? 2 : 1,
          additional_concurrent_access_count: extraSeats,
          additional_concurrent_access_price: config.extraSeatRate,
          total_recurring_monthly_price: Math.round((finalPeriodTotal / config.periodMultiplier) * 100) / 100,
          updated_at: new Date().toISOString(),
        })
        .eq('clinic_id', clinic_id)
        .select()
        .single();

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
        .single();

      return new Response(JSON.stringify({ success: true, subscription: updatedSub }), {
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

