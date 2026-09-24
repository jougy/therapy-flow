// supabase/functions/asaas-webhook/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';
import { AsaasClient } from '../_shared/asaas-client.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const asaasWebhookSecretProd = Deno.env.get('ASAAS_WEBHOOK_SECRET_PRODUCTION') || Deno.env.get('ASAAS_PROD_WEBHOOK_SECRET') || '';
  const asaasWebhookSecretSandbox = Deno.env.get('ASAAS_WEBHOOK_SECRET_SANDBOX') || Deno.env.get('ASAAS_SANDBOX_WEBHOOK_SECRET') || '';
  const asaasWebhookSecretDefault = Deno.env.get('ASAAS_WEBHOOK_SECRET') || '';

  // Função para comparação em tempo constante (mitigação de timing attacks)
  const safeCompare = (a: string, b: string): boolean => {
    if (!a || !b || a.length !== b.length) {
      return false;
    }
    let mismatch = 0;
    for (let i = 0; i < a.length; i++) {
      mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return mismatch === 0;
  };

  // Validar token de autenticação do Asaas Webhook se configurado
  const receivedToken = req.headers.get('asaas-access-token') || '';
  const hasConfiguredSecrets = !!(asaasWebhookSecretProd || asaasWebhookSecretSandbox || asaasWebhookSecretDefault);
  const isValidToken =
    !hasConfiguredSecrets ||
    (Boolean(asaasWebhookSecretProd) && safeCompare(receivedToken, asaasWebhookSecretProd)) ||
    (Boolean(asaasWebhookSecretSandbox) && safeCompare(receivedToken, asaasWebhookSecretSandbox)) ||
    (Boolean(asaasWebhookSecretDefault) && safeCompare(receivedToken, asaasWebhookSecretDefault));

  if (!isValidToken) {
    console.warn('[asaas-webhook] Rejeição de webhook: Token de autenticação não coincide.');
    return new Response(JSON.stringify({ error: 'Token de webhook inválido.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let eventId = '';
  let eventType = '';
  let payload: Record<string, unknown> = {};

  try {
    payload = await req.json();
    eventId = payload.id || payload.eventId || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    eventType = payload.event || 'UNKNOWN';
    const payment = payload.payment || {};
    const subscription = payload.subscription || {};
    const invoice = payload.invoice || {};

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
    const externalRef = payment.externalReference || subscription.externalReference || invoice.externalReference;
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
    const targetCustId = payment.customer || subscription.customer || invoice.customer;

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

    console.log(`[asaas-webhook] Processando evento: ${eventType} | Clínica: ${targetClinicId} | Payment: ${payment.id || invoice.payment}`);

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

      // Tentativa de emissão de NFS-e de forma 100% isolada com fail-safe
      try {
        const { data: invRecord } = await supabase
          .from('subscription_invoices')
          .select('id, asaas_invoice_id')
          .eq('asaas_payment_id', payment.id)
          .maybeSingle();

        if (invRecord && !invRecord.asaas_invoice_id) {
          const asaas = new AsaasClient();
          const nfseEffectiveDate = new Date().toISOString().split('T')[0];
          const serviceDesc = 'Prestação de serviços de suporte técnico operacional, configuração e capacitação de usuários para utilização do sistema digital Pluri Health de prontuário e gestão clínica. Referente à assinatura do período contratado.';

          console.log(`[asaas-webhook] Solicitando emissão de NFS-e no Asaas para pagamento ${payment.id}...`);
          const createdInvoice = await asaas.createInvoice({
            payment: payment.id,
            serviceDescription: serviceDesc,
            effectiveDate: nfseEffectiveDate,
          });

          if (createdInvoice?.id) {
            await supabase
              .from('subscription_invoices')
              .update({
                asaas_invoice_id: createdInvoice.id,
                nfe_status: 'PENDING',
              })
              .eq('id', invRecord.id);

            console.log(`[asaas-webhook] NFS-e registrada com sucesso: Asaas Invoice ID ${createdInvoice.id}`);
          }
        } else if (invRecord?.asaas_invoice_id) {
          console.log(`[asaas-webhook] Fatura ${invRecord.id} já possui NFS-e vinculada (${invRecord.asaas_invoice_id}). Emissão ignorada.`);
        }
      } catch (nfseErr) {
        console.error('[asaas-webhook] Erro ao emitir NFS-e (fail-safe ativado):', nfseErr);
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
    } else if (
      eventType === 'INVOICE_CREATED' ||
      eventType === 'INVOICE_SYNCHRONIZED' ||
      eventType === 'INVOICE_AUTHORIZED' ||
      eventType === 'INVOICE_ERROR' ||
      eventType === 'INVOICE_CANCELED'
    ) {
      const invoiceId = invoice.id;
      const invoicePaymentId = invoice.payment;

      if (invoiceId || invoicePaymentId) {
        let updateData: Record<string, any> = {};

        if (eventType === 'INVOICE_CREATED') {
          updateData = {
            asaas_invoice_id: invoiceId,
            nfe_status: 'PENDING',
          };
        } else if (eventType === 'INVOICE_SYNCHRONIZED') {
          updateData = {
            asaas_invoice_id: invoiceId,
            nfe_status: invoice.status || 'SYNCHRONIZED',
          };
        } else if (eventType === 'INVOICE_AUTHORIZED') {
          updateData = {
            asaas_invoice_id: invoiceId,
            nfe_status: 'AUTHORIZED',
            nfe_number: invoice.number || null,
            nfe_pdf_url: invoice.pdfUrl || null,
            nfe_xml_url: invoice.xmlUrl || null,
            nfe_error_message: null,
          };
        } else if (eventType === 'INVOICE_ERROR') {
          updateData = {
            asaas_invoice_id: invoiceId,
            nfe_status: 'ERROR',
            nfe_error_message: invoice.errorMessage || invoice.error || 'Erro desconhecido na emissão da NFS-e',
          };
        } else if (eventType === 'INVOICE_CANCELED') {
          updateData = {
            asaas_invoice_id: invoiceId,
            nfe_status: 'CANCELED',
          };
        }

        // Tentar atualizar por asaas_invoice_id ou por asaas_payment_id
        if (invoiceId) {
          const { data: updatedRows } = await supabase
            .from('subscription_invoices')
            .update(updateData)
            .eq('asaas_invoice_id', invoiceId)
            .select('id');

          if (!updatedRows || updatedRows.length === 0) {
            if (invoicePaymentId) {
              await supabase
                .from('subscription_invoices')
                .update(updateData)
                .eq('asaas_payment_id', invoicePaymentId);
            }
          }
        } else if (invoicePaymentId) {
          await supabase
            .from('subscription_invoices')
            .update(updateData)
            .eq('asaas_payment_id', invoicePaymentId);
        }

        console.log(`[asaas-webhook] Evento de NFS-e processado: ${eventType} para Invoice: ${invoiceId} / Payment: ${invoicePaymentId}`);
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

