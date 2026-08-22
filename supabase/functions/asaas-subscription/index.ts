// supabase/functions/asaas-subscription/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';
import { AsaasClient } from '../_shared/asaas-client.ts';

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
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
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
      additional_seats_count,
      billing_type,
      credit_card_data,
      coupon_code,
      cpf_cnpj,
      billing_name,
      billing_email,
    } = body;

    if (!clinic_id) {
      return new Response(JSON.stringify({ error: 'clinic_id é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Verificar se o usuário é Account Owner ou Admin da clínica
    const { data: membership, error: memError } = await supabase
      .from('clinic_memberships')
      .select('account_role, is_active, membership_status')
      .eq('clinic_id', clinic_id)
      .eq('user_id', user.id)
      .single();

    const isOwner = membership?.account_role === 'account_owner' || membership?.account_role === 'owner';
    if (memError || !membership || !isOwner || !membership.is_active || membership.membership_status !== 'active') {
      return new Response(JSON.stringify({ error: 'Apenas o responsável (Owner) da clínica pode gerenciar assinaturas.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Buscar dados da clínica e do usuário
    const { data: clinic } = await supabase.from('clinics').select('*').eq('id', clinic_id).single();
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

    if (!clinic || !profile) {
      return new Response(JSON.stringify({ error: 'Clínica ou perfil não encontrados.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const asaas = new AsaasClient();

    // Buscar assinatura atual da clínica
    const { data: subscription } = await supabase
      .from('clinic_subscriptions')
      .select('*')
      .eq('clinic_id', clinic_id)
      .single();

    // =========================================================================
    // AÇÃO 1: CREATE (Criação de Assinatura com suporte a Cupons e Pro-rata)
    // =========================================================================
    if (action === 'CREATE') {
      const selectedPlan = plan_type || 'solo';
      const extraConcurrentSeats = selectedPlan === 'clinic' ? Math.max(0, additional_seats_count || 0) : 0;
      const basePrice = selectedPlan === 'clinic' ? 60.00 : 50.00;
      const baseSubaccountLimit = selectedPlan === 'clinic' ? 30 : 1;
      const baseConcurrentLimit = selectedPlan === 'clinic' ? 2 : 1;
      const rawRecurringPrice = selectedPlan === 'clinic' ? (60.00 + (extraConcurrentSeats * 10.00)) : 50.00;

      // Tratar Validação de Cupom
      let appliedCouponId: string | null = null;
      let appliedCouponCode: string | null = null;
      let discountPercentage = 0.0;
      let discountFixedAmount = 0.0;
      let trialEndsAt: string | null = null;
      let trialDays = 0;
      let finalRecurringPrice = rawRecurringPrice;

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
          discountPercentage = Number(couponRes.discount_value || 0);
          finalRecurringPrice = Math.max(0, rawRecurringPrice * (1 - (discountPercentage / 100)));
        } else if (couponRes.discount_type === 'FIXED_AMOUNT') {
          discountFixedAmount = Number(couponRes.discount_value || 0);
          finalRecurringPrice = Math.max(0, rawRecurringPrice - discountFixedAmount);
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

      // Localizar ou Criar Customer no Asaas
      let customerId = subscription?.asaas_customer_id;
      const cleanCpfCnpj = (cpf_cnpj || clinic.cnpj || profile.cpf || '').replace(/\D/g, '');

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

      // Calcular Data de Vencimento (considerando Trial se aplicável)
      const dueDateObj = new Date();
      if (trialDays > 0) {
        dueDateObj.setDate(dueDateObj.getDate() + trialDays);
      } else {
        dueDateObj.setDate(dueDateObj.getDate() + 1);
      }
      const nextDueStr = dueDateObj.toISOString().split('T')[0];

      // Payload da Assinatura no Asaas
      const asaasSubData: Record<string, unknown> = {
        customer: customerId,
        billingType: billing_type || 'PIX',
        value: finalRecurringPrice,
        nextDueDate: nextDueStr,
        cycle: 'MONTHLY',
        description: `Pluri-Health - Plano ${selectedPlan === 'clinic' ? 'Clínica com Equipe' : 'Profissional Solo'}${appliedCouponCode ? ` (Cupom: ${appliedCouponCode})` : ''}`,
        externalReference: clinic_id,
      };

      if (discountPercentage > 0) {
        asaasSubData.discount = {
          value: discountPercentage,
          type: 'PERCENTAGE',
        };
      } else if (discountFixedAmount > 0) {
        asaasSubData.discount = {
          value: discountFixedAmount,
          type: 'FIXED',
        };
      }

      if (billing_type === 'CREDIT_CARD' && credit_card_data) {
        asaasSubData.creditCard = credit_card_data.card;
        asaasSubData.creditCardHolderInfo = credit_card_data.holder;
      }

      const asaasSub = await asaas.createSubscription(asaasSubData as any);

      // Upsert em clinic_subscriptions
      const subPayload = {
        clinic_id: clinic_id,
        account_owner_user_id: user.id,
        asaas_customer_id: customerId,
        asaas_subscription_id: asaasSub.id,
        plan_type: selectedPlan,
        billing_cycle: 'MONTHLY',
        payment_method: billing_type || 'PIX',
        base_monthly_price: basePrice,
        base_concurrent_access_count: baseConcurrentLimit,
        additional_concurrent_access_count: extraConcurrentSeats,
        additional_concurrent_access_price: 10.00,
        total_recurring_monthly_price: finalRecurringPrice,
        base_subaccount_limit: baseSubaccountLimit,
        status: trialDays > 0 ? 'BETA' : 'ACTIVE',
        next_due_date: asaasSub.nextDueDate,
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

      const { data: updatedSub, error: upsertErr } = await supabase
        .from('clinic_subscriptions')
        .upsert(subPayload, { onConflict: 'clinic_id' })
        .select()
        .single();

      if (upsertErr) {
        throw new Error(`Erro ao registrar assinatura no banco: ${upsertErr.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        subscription: updatedSub,
        asaasSubscription: asaasSub,
        couponApplied: !!appliedCouponCode,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // =========================================================================
    // AÇÃO 2: UPDATE_SEATS (Ajuste de Acessos Simultâneos Adicionais)
    // =========================================================================
    if (action === 'UPDATE_SEATS') {
      if (!subscription || !subscription.asaas_subscription_id) {
        return new Response(JSON.stringify({ error: 'Nenhuma assinatura ativa encontrada no Asaas.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const newSeatsCount = Math.max(0, additional_seats_count || 0);
      const rawPrice = 60.00 + (newSeatsCount * 10.00);
      const discountPct = Number(subscription.discount_percentage || 0);
      const discountFixed = Number(subscription.discount_fixed_amount || 0);

      let finalPrice = rawPrice;
      if (discountPct > 0) {
        finalPrice = Math.max(0, rawPrice * (1 - (discountPct / 100)));
      } else if (discountFixed > 0) {
        finalPrice = Math.max(0, rawPrice - discountFixed);
      }

      // Atualizar valor no Asaas
      await asaas.updateSubscription(subscription.asaas_subscription_id, {
        value: finalPrice,
      });

      // Atualizar localmente em clinic_subscriptions
      const { data: updatedSub, error: updateErr } = await supabase
        .from('clinic_subscriptions')
        .update({
          additional_concurrent_access_count: newSeatsCount,
          total_recurring_monthly_price: finalPrice,
          updated_at: new Date().toISOString(),
        })
        .eq('clinic_id', clinic_id)
        .select()
        .single();

      if (updateErr) {
        throw new Error(`Erro ao atualizar cotas de acessos no banco: ${updateErr.message}`);
      }

      return new Response(JSON.stringify({ success: true, subscription: updatedSub }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // =========================================================================
    // AÇÃO 3: CHANGE_PLAN (Troca de Plano Solo <-> Clínica com trava de Downgrade)
    // =========================================================================
    if (action === 'CHANGE_PLAN') {
      const targetPlan = plan_type || 'solo';

      // Validação de segurança no Downgrade para Solo: Não pode ter colaboradores ativos cadastrados
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

      const basePrice = targetPlan === 'clinic' ? 60.00 : 50.00;
      const baseSubaccountLimit = targetPlan === 'clinic' ? 30 : 1;
      const baseConcurrentLimit = targetPlan === 'clinic' ? 2 : 1;
      const extraConcurrent = targetPlan === 'solo' ? 0 : (subscription?.additional_concurrent_access_count || 0);

      const rawPrice = targetPlan === 'clinic' ? (60.00 + (extraConcurrent * 10.00)) : 50.00;
      const discountPct = Number(subscription?.discount_percentage || 0);
      const discountFixed = Number(subscription?.discount_fixed_amount || 0);

      let finalPrice = rawPrice;
      if (discountPct > 0) {
        finalPrice = Math.max(0, rawPrice * (1 - (discountPct / 100)));
      } else if (discountFixed > 0) {
        finalPrice = Math.max(0, rawPrice - discountFixed);
      }

      if (subscription?.asaas_subscription_id) {
        await asaas.updateSubscription(subscription.asaas_subscription_id, {
          value: finalPrice,
          description: `Pluri-Health - Plano ${targetPlan === 'clinic' ? 'Clínica com Equipe' : 'Profissional Solo'}`,
        });
      }

      const { data: updatedSub, error: updateErr } = await supabase
        .from('clinic_subscriptions')
        .update({
          plan_type: targetPlan,
          base_monthly_price: basePrice,
          base_subaccount_limit: baseSubaccountLimit,
          base_concurrent_access_count: baseConcurrentLimit,
          additional_concurrent_access_count: extraConcurrent,
          total_recurring_monthly_price: finalPrice,
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

    return new Response(JSON.stringify({ error: 'Ação não reconhecida.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message || 'Erro interno do servidor.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
