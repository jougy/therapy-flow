// supabase/functions/asaas-webhook/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const asaasWebhookSecretProd = Deno.env.get('ASAAS_WEBHOOK_SECRET_PRODUCTION') || Deno.env.get('ASAAS_PROD_WEBHOOK_SECRET') || '';
  const asaasWebhookSecretSandbox = Deno.env.get('ASAAS_WEBHOOK_SECRET_SANDBOX') || Deno.env.get('ASAAS_SANDBOX_WEBHOOK_SECRET') || '';
  const asaasWebhookSecretDefault = Deno.env.get('ASAAS_WEBHOOK_SECRET') || '';

  // Validar token de autenticação do Asaas Webhook se configurado
  const receivedToken = req.headers.get('asaas-access-token');
  const hasConfiguredSecrets = !!(asaasWebhookSecretProd || asaasWebhookSecretSandbox || asaasWebhookSecretDefault);
  const isValidToken =
    !hasConfiguredSecrets ||
    (asaasWebhookSecretProd && receivedToken === asaasWebhookSecretProd) ||
    (asaasWebhookSecretSandbox && receivedToken === asaasWebhookSecretSandbox) ||
    (asaasWebhookSecretDefault && receivedToken === asaasWebhookSecretDefault);

  if (!isValidToken) {
    console.warn('[asaas-webhook] Rejeição de webhook: Token de autenticação não coincide.');
    return new Response(JSON.stringify({ error: 'Token de webhook inválido.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let eventId = '';
  let eventType = '';
  let payload: Record<string, any> = {};

  try {
    payload = await req.json();
    eventId = payload.id || payload.eventId || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    eventType = payload.event || 'UNKNOWN';
    const payment = payload.payment || {};
    const subscription = payload.subscription || {};

    if (!eventId || !eventType) {
      return new Response(JSON.stringify({ error: 'Payload de webhook inválido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Registro Idempotente via RPC
    const { data: recordRes, error: recordErr } = await supabase.rpc('record_asaas_webhook_event', {
      _event_id: eventId,
      _event_type: eventType,
      _payload: payload,
      _signature: receivedToken || null,
    });

    if (!recordErr && recordRes?.already_processed) {
      console.log(`[asaas-webhook] Evento ${eventId} já processado anteriormente.`);
      return new Response(JSON.stringify({ message: 'Evento já processado anteriormente.', event_id: eventId }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Identificar a Clínica Alvo
    let targetClinicId: string | null = null;

    // Tentativa A: via externalReference do payment
    const externalRef = payment.externalReference || subscription.externalReference;
    if (externalRef) {
      try {
        if (typeof externalRef === 'string' && externalRef.startsWith('{')) {
          const parsed = JSON.parse(externalRef);
          targetClinicId = parsed.clinic_id || null;
        } else if (typeof externalRef === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(externalRef.trim())) {
          targetClinicId = externalRef.trim();
        }
      } catch (e) {
        console.warn('[asaas-webhook] Aviso ao interpretar externalReference:', e);
      }
    }

    // Tentativa B: via asaas_subscription_id ou asaas_customer_id
    const targetSubId = payment.subscription || subscription.id;
    const targetCustId = payment.customer || subscription.customer;

    if (!targetClinicId && targetSubId) {
      const { data: subData } = await supabase
        .from('clinic_subscriptions')
        .select('clinic_id')
        .eq('asaas_subscription_id', targetSubId)
        .maybeSingle();
      if (subData?.clinic_id) targetClinicId = subData.clinic_id;
    }

    if (!targetClinicId && payment.id) {
      const { data: invData } = await supabase
        .from('subscription_invoices')
        .select('clinic_id')
        .eq('asaas_payment_id', payment.id)
        .maybeSingle();
      if (invData?.clinic_id) targetClinicId = invData.clinic_id;
    }

    if (!targetClinicId && targetCustId) {
      const { data: subData } = await supabase
        .from('clinic_subscriptions')
        .select('clinic_id')
        .eq('asaas_customer_id', targetCustId)
        .maybeSingle();
      if (subData?.clinic_id) targetClinicId = subData.clinic_id;
    }

    console.log(`[asaas-webhook] Processando evento: ${eventType} | Clínica: ${targetClinicId} | Payment: ${payment.id}`);

    // 3. Processar de Acordo com o Tipo do Evento
    const isPaymentConfirmed =
      eventType === 'PAYMENT_RECEIVED' ||
      eventType === 'PAYMENT_CONFIRMED' ||
      eventType === 'PAYMENT_RECEIVED_IN_CASH' ||
      eventType === 'PAYMENT_DUNNING_RECEIVED';

    if (isPaymentConfirmed && payment.id) {
      const paymentDate = payment.paymentDate || payment.clientPaymentDate || new Date().toISOString();
      const paidValue = payment.value || payment.netValue;
      const billingType = payment.billingType || 'PIX';

      if (targetClinicId) {
        // Ativação atômica via RPC confirm_asaas_subscription_payment
        await supabase.rpc('confirm_asaas_subscription_payment', {
          _asaas_payment_id: payment.id,
          _clinic_id: targetClinicId,
          _paid_value: paidValue,
          _payment_date: new Date(paymentDate).toISOString(),
          _billing_type: billingType,
        });
      } else {
        // Se ainda não descobriu a clínica, atualiza ao menos a fatura
        await supabase
          .from('subscription_invoices')
          .update({
            status: 'RECEIVED',
            payment_date: new Date(paymentDate).toISOString(),
            paid_at: new Date(paymentDate).toISOString(),
            net_value: payment.netValue || null,
          })
          .eq('asaas_payment_id', payment.id);
      }
    } else if (eventType === 'PAYMENT_OVERDUE') {
      if (payment.id) {
        await supabase
          .from('subscription_invoices')
          .update({ status: 'OVERDUE' })
          .eq('asaas_payment_id', payment.id);
      }

      if (targetClinicId) {
        await supabase
          .from('clinic_subscriptions')
          .update({ status: 'OVERDUE', updated_at: new Date().toISOString() })
          .eq('clinic_id', targetClinicId);

        await supabase
          .from('clinics')
          .update({ access_status: 'payment_pending', updated_at: new Date().toISOString() })
          .eq('id', targetClinicId);
      }
    } else if (eventType === 'PAYMENT_REFUNDED' || eventType === 'PAYMENT_CHARGEBACK') {
      if (payment.id) {
        await supabase
          .from('subscription_invoices')
          .update({ status: 'REFUNDED', updated_at: new Date().toISOString() })
          .eq('asaas_payment_id', payment.id);
      }
    } else if (eventType === 'PAYMENT_DELETED') {
      if (payment.id) {
        await supabase
          .from('subscription_invoices')
          .update({ status: 'DELETED', updated_at: new Date().toISOString() })
          .eq('asaas_payment_id', payment.id);
      }
    } else if (eventType === 'SUBSCRIPTION_DELETED' || eventType === 'SUBSCRIPTION_DISABLED' || eventType === 'SUBSCRIPTION_CANCELED') {
      const subIdToCancel = targetSubId || subscription.id;
      if (subIdToCancel) {
        await supabase
          .from('clinic_subscriptions')
          .update({ status: 'CANCELED', updated_at: new Date().toISOString() })
          .eq('asaas_subscription_id', subIdToCancel);
      }
      if (targetClinicId) {
        await supabase
          .from('clinics')
          .update({ access_status: 'temporarily_paused', updated_at: new Date().toISOString() })
          .eq('id', targetClinicId);
      }
    }

    // 4. Marcar evento como processado com sucesso
    await supabase
      .from('asaas_webhook_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq('asaas_event_id', eventId);

    return new Response(JSON.stringify({ success: true, event_id: eventId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[asaas-webhook] Erro ao processar:', err);

    if (eventId) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      await supabase
        .from('asaas_webhook_events')
        .update({
          processed: false,
          error_message: message,
        })
        .eq('asaas_event_id', eventId);
    }

    return new Response(JSON.stringify({ error: message || 'Erro interno no processamento do webhook.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

