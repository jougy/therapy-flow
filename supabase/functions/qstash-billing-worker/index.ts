/**
 * Edge Function: qstash-billing-worker
 *
 * Consumidor durável da fila `asaas-side-effects` e do cron `asaas-reconcile-and-trials`:
 * - process_payment_post_actions (coalescido: 1 msg/pagamento faz NFS-e + Split Afiliado + Notificações)
 * - refund_affiliate_split
 * - reconcile_pending_and_trials
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.2';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyQStashSignature } from '../_shared/qstash.ts';
import { AsaasClient } from '../_shared/asaas-client.ts';
import { handleAffiliatePaymentReceived, handleAffiliatePaymentRefunded } from '../_shared/affiliate-split.ts';
import { TelegramClient } from '../_shared/telegram-client.ts';
import { WhatsAppClient } from '../_shared/whatsapp-client.ts';
import { getGlobalFeatureFlag } from '../_shared/feature-flags-client.ts';
import { ingestToAxiom } from '../_shared/telemetry-axiom.ts';
import { reportError } from '../_shared/error-dedup.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

async function authorizeRequest(req: Request, rawBody: string, serviceRoleKey: string): Promise<boolean> {
  const authHeader = req.headers.get('Authorization') || '';
  const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (serviceRoleKey && bearer === serviceRoleKey) return true;

  const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '');
  const expectedUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/qstash-billing-worker` : undefined;
  const sig = await verifyQStashSignature(req, rawBody, expectedUrl);
  return sig.valid;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const rawBody = await req.text();

  const authorized = await authorizeRequest(req, rawBody, serviceRoleKey);
  if (!authorized) {
    return json({ error: 'Unauthorized: invalid QStash signature' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
    const action = String(body.action || '');

    if (action === 'process_payment_post_actions') {
      const payment = (body.payment || {}) as Record<string, unknown>;
      const paymentId = String(payment.id || '');
      const targetClinicId = body.targetClinicId ? String(body.targetClinicId) : null;
      const targetSubId = body.targetSubId ? String(body.targetSubId) : null;
      const eventType = String(body.eventType || 'PAYMENT_RECEIVED');

      if (!paymentId) return json({ error: 'payment.id obrigatório' }, 400);

      const asaas = new AsaasClient();

      // 1. Split de Afiliados (idempotente no banco)
      await handleAffiliatePaymentReceived({
        supabase: admin,
        asaasClient: asaas,
        payment: payment as never,
        targetSubId,
        targetClinicId,
      });

      // 2. Emissão de NFS-e (idempotente: checa asaas_invoice_id IS NULL)
      const { data: invRecord } = await admin
        .from('subscription_invoices')
        .select('id, asaas_invoice_id')
        .eq('asaas_payment_id', paymentId)
        .maybeSingle();

      if (invRecord && !invRecord.asaas_invoice_id) {
        const createdInvoice = await asaas.createInvoice({
          payment: paymentId,
          serviceDescription:
            'Prestação de serviços de suporte técnico operacional, configuração e capacitação de usuários para utilização do sistema digital Pluri Health de prontuário e gestão clínica. Referente à assinatura do período contratado.',
          effectiveDate: new Date().toISOString().split('T')[0],
        });
        if (createdInvoice?.id) {
          await admin
            .from('subscription_invoices')
            .update({ asaas_invoice_id: createdInvoice.id, nfe_status: 'PENDING' })
            .eq('id', invRecord.id);
        }
      }

      // 3. Notificações (Telegram Admin + WhatsApp + app_notifications)
      if (targetClinicId) {
        const [clinicRes, subRes, adminsRes] = await Promise.all([
          admin.from('clinics').select('name, account_owner_user_id').eq('id', targetClinicId).maybeSingle(),
          admin.from('clinic_subscriptions').select('plan_type, billing_cycle, billing_email, billing_name').eq('clinic_id', targetClinicId).maybeSingle(),
          admin.from('platform_admins').select('user_id').eq('is_active', true),
        ]);

        const clinicName = clinicRes.data?.name || 'Clínica';
        const subscriberName = subRes.data?.billing_name || 'Assinante';
        const paidValue = Number(payment.value || payment.netValue || 0);
        const amountFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(paidValue);

        await new TelegramClient().sendMessage(
          `💰 <b>Pagamento Confirmado (${eventType})</b>\n` +
            `🏥 Clínica: <b>${clinicName}</b>\n` +
            `👤 Assinante: ${subscriberName}\n` +
            `💵 Valor: <b>${amountFmt}</b>\n` +
            `🔑 Payment: <code>${paymentId}</code>`
        );

        const admins = adminsRes.data || [];
        if (admins.length > 0) {
          await admin.from('app_notifications').insert(
            admins.map((a) => ({
              user_id: a.user_id,
              clinic_id: targetClinicId,
              title: `Pagamento confirmado: ${clinicName}`,
              message: `${subscriberName} — ${amountFmt} (${eventType})`,
              type: 'billing',
              is_read: false,
            }))
          );
        }

        const waBillingEnabled = await getGlobalFeatureFlag(admin, 'notifications_whatsapp_billing', true);
        if (waBillingEnabled && clinicRes.data?.account_owner_user_id) {
          const { data: ownerProf } = await admin
            .from('profiles')
            .select('phone')
            .eq('id', clinicRes.data.account_owner_user_id)
            .maybeSingle();
          if (ownerProf?.phone) {
            await new WhatsAppClient().sendTextMessage(
              ownerProf.phone,
              `✅ Pagamento confirmado na *${clinicName}*! Valor: *${amountFmt}*. Sua assinatura Pluri-Health está ativa. Obrigado pela confiança!`
            );
          }
        }
      }

      await ingestToAxiom([
        {
          level: 'info',
          service: 'qstash-billing-worker',
          route: 'process_payment_post_actions',
          clinic_id: targetClinicId,
          message: 'Payment post-actions completed via QStash',
          metadata: { paymentId, eventType },
        },
      ]);

      return json({ ok: true, paymentId });
    }

    if (action === 'refund_affiliate_split') {
      const payment = (body.payment || {}) as Record<string, unknown>;
      await handleAffiliatePaymentRefunded({
        supabase: admin,
        payment: payment as never,
        targetClinicId: body.targetClinicId ? String(body.targetClinicId) : null,
      });
      return json({ ok: true });
    }

    if (action === 'reconcile_pending_and_trials') {
      const sinceIso = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data: pendingInvoices } = await admin
        .from('subscription_invoices')
        .select('id, clinic_id, asaas_payment_id, status')
        .eq('status', 'PENDING')
        .gte('created_at', sinceIso)
        .not('asaas_payment_id', 'is', null)
        .limit(50);

      let reconciled = 0;
      const asaas = new AsaasClient();
      for (const inv of pendingInvoices || []) {
        if (!inv.asaas_payment_id) continue;
        try {
          const remote = await asaas.getPayment(inv.asaas_payment_id);
          if (remote?.status === 'RECEIVED' || remote?.status === 'CONFIRMED') {
            await admin.rpc('confirm_asaas_subscription_payment', {
              _asaas_payment_id: inv.asaas_payment_id,
              _clinic_id: inv.clinic_id,
              _paid_value: remote.value,
              _payment_date: new Date().toISOString(),
              _billing_type: remote.billingType || 'PIX',
            });
            reconciled++;
          }
        } catch {
          // segue para próxima fatura
        }
      }

      const trialFlagEnabled = await getGlobalFeatureFlag(admin, 'qstash_trial_reminders', false);
      let trialRemindersSent = 0;
      if (trialFlagEnabled) {
        const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const in52h = new Date(Date.now() + 52 * 60 * 60 * 1000).toISOString();
        const { data: expiringTrials } = await admin
          .from('clinic_subscriptions')
          .select('clinic_id, account_owner_user_id, trial_ends_at')
          .eq('is_free_trial', true)
          .gte('trial_ends_at', in24h)
          .lte('trial_ends_at', in52h)
          .limit(30);

        for (const t of expiringTrials || []) {
          if (!t.account_owner_user_id) continue;
          const { data: prof } = await admin
            .from('profiles')
            .select('phone, full_name')
            .eq('id', t.account_owner_user_id)
            .maybeSingle();
          if (prof?.phone) {
            await new WhatsAppClient().sendTextMessage(
              prof.phone,
              `Olá, *${prof.full_name || 'Doutor(a)'}*! Seu período de teste na *Pluri-Health* termina em breve. Acesse Configurações > Assinatura para manter sua clínica ativa sem interrupções.`
            );
            trialRemindersSent++;
          }
        }
      }

      return json({ ok: true, reconciled, trialRemindersSent });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await reportError({
      service: 'qstash-billing-worker',
      level: 'critical',
      code: 'qstash_billing_worker_error',
      route: 'qstash-billing-worker',
      message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return json({ error: message }, 500);
  }
});
