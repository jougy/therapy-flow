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
    const { action, clinic_id, plan_type, additional_seats_count, billing_type, credit_card_data } = body;

    if (!clinic_id) {
      return new Response(JSON.stringify({ error: 'clinic_id é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar se o usuário é Account Owner da clínica
    const { data: membership, error: memError } = await supabase
      .from('clinic_memberships')
      .select('account_role, is_active, membership_status')
      .eq('clinic_id', clinic_id)
      .eq('user_id', user.id)
      .single();

    if (memError || !membership || membership.account_role !== 'owner' || !membership.is_active || membership.membership_status !== 'active') {
      return new Response(JSON.stringify({ error: 'Apenas o titular (Owner) da clínica pode gerenciar assinaturas.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar dados da clínica e do titular
    const { data: clinic, error: clinicErr } = await supabase
      .from('clinics')
      .select('*')
      .eq('id', clinic_id)
      .single();

    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (clinicErr || profErr || !clinic || !profile) {
      return new Response(JSON.stringify({ error: 'Clínica ou perfil não encontrados.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const asaas = new AsaasClient();

    // Buscar ou criar registro em clinic_subscriptions
    let { data: subscription } = await supabase
      .from('clinic_subscriptions')
      .select('*')
      .eq('clinic_id', clinic_id)
      .single();

    // 1. AÇÃO: CREATE (Inicia nova assinatura)
    if (action === 'CREATE') {
      const selectedPlan = plan_type || 'solo';
      const seatsCount = selectedPlan === 'clinic' ? (additional_seats_count || 0) : 0;
      const basePrice = selectedPlan === 'clinic' ? 60.00 : 50.00;
      const totalRecurringPrice = selectedPlan === 'clinic' ? (60.00 + (seatsCount * 10.00)) : 50.00;
      const baseSubaccountLimit = selectedPlan === 'clinic' ? 30 : 1;
      const baseConcurrentLimit = selectedPlan === 'clinic' ? 2 : 1;

      // 1.1 Criar ou localizar Customer no Asaas
      let customerId = subscription?.asaas_customer_id;
      if (!customerId) {
        const cpfCnpj = (clinic.cnpj || profile.cpf || '').replace(/\D/g, '');
        if (!cpfCnpj) {
          return new Response(JSON.stringify({ error: 'CPF ou CNPJ obrigatório para gerar assinatura.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const existingCustomer = await asaas.findCustomerByCpfCnpj(cpfCnpj);
        if (existingCustomer) {
          customerId = existingCustomer.id;
        } else {
          const newCustomer = await asaas.createCustomer({
            name: clinic.legal_name || clinic.name || profile.full_name || 'Cliente Pluri-Health',
            email: clinic.email || profile.email || user.email,
            cpfCnpj: cpfCnpj,
            phone: clinic.phone || profile.phone,
            externalReference: clinic_id,
          });
          customerId = newCustomer.id;
        }
      }

      // 1.2 Criar Assinatura no Asaas
      const today = new Date();
      const nextDue = new Date(today.setDate(today.getDate() + 1)).toISOString().split('T')[0];

      const asaasSubData: any = {
        customer: customerId,
        billingType: billing_type || 'PIX',
        value: totalRecurringPrice,
        nextDueDate: nextDue,
        cycle: 'MONTHLY',
        description: `Pluri-Health - Plano ${selectedPlan === 'clinic' ? 'Clínica com Equipe' : 'Profissional Solo'}`,
        externalReference: clinic_id,
      };

      if (billing_type === 'CREDIT_CARD' && credit_card_data) {
        asaasSubData.creditCard = credit_card_data.card;
        asaasSubData.creditCardHolderInfo = credit_card_data.holder;
      }

      const asaasSub = await asaas.createSubscription(asaasSubData);

      // 1.3 Upsert em clinic_subscriptions
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
        additional_concurrent_access_count: seatsCount,
        additional_concurrent_access_price: 10.00,
        total_recurring_monthly_price: totalRecurringPrice,
        base_subaccount_limit: baseSubaccountLimit,
        status: 'ACTIVE',
        next_due_date: asaasSub.nextDueDate,
        current_period_start: new Date().toISOString(),
      };

      const { data: updatedSub, error: upsertErr } = await supabase
        .from('clinic_subscriptions')
        .upsert(subPayload, { onConflict: 'clinic_id' })
        .select()
        .single();

      if (upsertErr) {
        throw new Error(`Erro ao registrar assinatura no banco: ${upsertErr.message}`);
      }

      return new Response(JSON.stringify({ success: true, subscription: updatedSub, asaasSubscription: asaasSub }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. AÇÃO: UPDATE_SEATS (Ajustar acessos simultâneos adicionais)
    if (action === 'UPDATE_SEATS') {
      if (!subscription || !subscription.asaas_subscription_id) {
        return new Response(JSON.stringify({ error: 'Nenhuma assinatura ativa encontrada no Asaas.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const newSeatsCount = Math.max(0, additional_seats_count || 0);
      const newTotalRecurringPrice = 60.00 + (newSeatsCount * 10.00);

      // Atualizar valor no Asaas
      await asaas.updateSubscription(subscription.asaas_subscription_id, {
        value: newTotalRecurringPrice,
      });

      // Atualizar localmente
      const { data: updatedSub, error: updateErr } = await supabase
        .from('clinic_subscriptions')
        .update({
          additional_concurrent_access_count: newSeatsCount,
          total_recurring_monthly_price: newTotalRecurringPrice,
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

    // 3. AÇÃO: CANCEL
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

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Erro interno do servidor.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
