// supabase/functions/asaas-webhook/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const asaasWebhookSecret = Deno.env.get('ASAAS_WEBHOOK_SECRET') || '';

    // Validar token de autenticação do Asaas Webhook
    const receivedToken = req.headers.get('asaas-access-token');
    if (asaasWebhookSecret && receivedToken !== asaasWebhookSecret) {
      return new Response(JSON.stringify({ error: 'Token de webhook inválido.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json();
    const eventId = payload.id || payload.eventId;
    const eventType = payload.event;
    const payment = payload.payment;

    if (!eventId || !eventType) {
      return new Response(JSON.stringify({ error: 'Payload de webhook inválido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Verificar Idempotência em asaas_webhook_events
    const { data: existingEvent } = await supabase
      .from('asaas_webhook_events')
      .select('id, processed')
      .eq('asaas_event_id', eventId)
      .single();

    if (existingEvent && existingEvent.processed) {
      return new Response(JSON.stringify({ message: 'Evento já processado anteriormente.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Registrar inicio do log de webhook
    if (!existingEvent) {
      await supabase.from('asaas_webhook_events').insert({
        asaas_event_id: eventId,
        event_type: eventType,
        payload: payload,
        processed: false,
      });
    }

    // 2. Processar Evento de Acordo com o Tipo
    if (eventType === 'PAYMENT_RECEIVED' || eventType === 'PAYMENT_CONFIRMED') {
      const paymentId = payment.id;
      const externalReferenceRaw = payment.externalReference;
      let externalData: Record<string, unknown> = {};

      try {
        if (externalReferenceRaw && externalReferenceRaw.startsWith('{')) {
          externalData = JSON.parse(externalReferenceRaw);
        }
      } catch (e) {
        console.warn('Erro ao parsear externalReference JSON:', e);
      }

      // Atualizar fatura na tabela subscription_invoices se existir
      await supabase
        .from('subscription_invoices')
        .update({
          status: 'CONFIRMED',
          payment_date: payment.paymentDate || new Date().toISOString(),
          net_value: payment.netValue || null,
        })
        .eq('asaas_payment_id', paymentId);

      // A) Se for cobrança avulsa de vagas (ONE_TIME_SUBACCOUNT_EXPANSION)
      if (externalData.charge_type === 'ONE_TIME_SUBACCOUNT_EXPANSION' && externalData.clinic_id && externalData.quantity) {
        const clinicId = externalData.clinic_id;
        const boughtQuantity = parseInt(externalData.quantity, 10) || 0;

        const { data: currentSub } = await supabase
          .from('clinic_subscriptions')
          .select('purchased_subaccount_extra_count')
          .eq('clinic_id', clinicId)
          .single();

        const currentExtras = currentSub?.purchased_subaccount_extra_count || 0;
        const newExtras = currentExtras + boughtQuantity;

        // Atualizar assinatura (o trigger sync_clinic_limits_from_subscription atualizará subaccount_limit em clinics)
        await supabase
          .from('clinic_subscriptions')
          .update({
            purchased_subaccount_extra_count: newExtras,
            updated_at: new Date().toISOString(),
          })
          .eq('clinic_id', clinicId);
      }
      // B) Se for pagamento de Assinatura Recorrente
      else {
        const customerId = payment.customer;
        const subscriptionId = payment.subscription;

        if (subscriptionId || customerId) {
          const query = supabase.from('clinic_subscriptions').update({
            status: 'ACTIVE',
            updated_at: new Date().toISOString(),
          });

          if (subscriptionId) {
            query.eq('asaas_subscription_id', subscriptionId);
          } else {
            query.eq('asaas_customer_id', customerId);
          }

          const { data: updatedSubs } = await query.select('clinic_id');

          if (updatedSubs && updatedSubs.length > 0) {
            for (const sub of updatedSubs) {
              await supabase
                .from('clinics')
                .update({ access_status: 'active', updated_at: new Date().toISOString() })
                .eq('id', sub.clinic_id);
            }
          }
        }
      }
    } else if (eventType === 'PAYMENT_OVERDUE') {
      const customerId = payment.customer;
      const subscriptionId = payment.subscription;

      if (subscriptionId || customerId) {
        const query = supabase.from('clinic_subscriptions').update({
          status: 'OVERDUE',
          updated_at: new Date().toISOString(),
        });

        if (subscriptionId) {
          query.eq('asaas_subscription_id', subscriptionId);
        } else {
          query.eq('asaas_customer_id', customerId);
        }

        const { data: updatedSubs } = await query.select('clinic_id');

        if (updatedSubs && updatedSubs.length > 0) {
          for (const sub of updatedSubs) {
            await supabase
              .from('clinics')
              .update({ access_status: 'payment_pending', updated_at: new Date().toISOString() })
              .eq('id', sub.clinic_id);
          }
        }
      }
    } else if (eventType === 'SUBSCRIPTION_DELETED' || eventType === 'SUBSCRIPTION_DISABLED') {
      const subscriptionId = payload.subscription?.id || payment?.subscription;

      if (subscriptionId) {
        const { data: updatedSubs } = await supabase
          .from('clinic_subscriptions')
          .update({
            status: 'CANCELED',
            updated_at: new Date().toISOString(),
          })
          .eq('asaas_subscription_id', subscriptionId)
          .select('clinic_id');

        if (updatedSubs && updatedSubs.length > 0) {
          for (const sub of updatedSubs) {
            await supabase
              .from('clinics')
              .update({ access_status: 'temporarily_paused', updated_at: new Date().toISOString() })
              .eq('id', sub.clinic_id);
          }
        }
      }
    }

    // Marca o evento como processado com sucesso
    await supabase
      .from('asaas_webhook_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq('asaas_event_id', eventId);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message || 'Erro no processamento do webhook.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
