// supabase/functions/asaas-one-time-charge/index.ts

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
    const { clinic_id, quantity_spaces_to_buy, billing_type, credit_card_data } = body;

    const spacesCount = Math.max(1, quantity_spaces_to_buy || 1);
    const unitPrice = 5.00;
    const totalAmount = spacesCount * unitPrice;

    if (!clinic_id) {
      return new Response(JSON.stringify({ error: 'clinic_id é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar se a clínica existe e o usuário tem acesso
    const { data: membership } = await supabase
      .from('clinic_memberships')
      .select('is_active, membership_status')
      .eq('clinic_id', clinic_id)
      .eq('user_id', user.id)
      .single();

    if (!membership || !membership.is_active || membership.membership_status !== 'active') {
      return new Response(JSON.stringify({ error: 'Permissão negada para esta clínica.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar assinatura atual ou criar Customer no Asaas se necessário
    const { data: subscription } = await supabase
      .from('clinic_subscriptions')
      .select('*')
      .eq('clinic_id', clinic_id)
      .single();

    const asaas = new AsaasClient();
    let customerId = subscription?.asaas_customer_id;

    if (!customerId) {
      const { data: clinic } = await supabase.from('clinics').select('*').eq('id', clinic_id).single();
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

      const cpfCnpj = (clinic?.cnpj || profile?.cpf || '').replace(/\D/g, '');
      if (!cpfCnpj) {
        return new Response(JSON.stringify({ error: 'CPF ou CNPJ necessário para emitir a cobrança.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const existingCustomer = await asaas.findCustomerByCpfCnpj(cpfCnpj);
      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const newCustomer = await asaas.createCustomer({
          name: clinic?.legal_name || clinic?.name || profile?.full_name || 'Cliente Pluri-Health',
          email: clinic?.email || profile?.email || user.email,
          cpfCnpj: cpfCnpj,
          externalReference: clinic_id,
        });
        customerId = newCustomer.id;
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const paymentData: Record<string, unknown> = {
      customer: customerId,
      billingType: billing_type || 'PIX',
      value: totalAmount,
      dueDate: today,
      description: `Pluri-Health - Expansão de ${spacesCount} vagas adicionais de colaboradores (Avulso R$ 5,00/cada)`,
      externalReference: JSON.stringify({ clinic_id, quantity: spacesCount, charge_type: 'ONE_TIME_SUBACCOUNT_EXPANSION' }),
    };

    if (billing_type === 'CREDIT_CARD' && credit_card_data) {
      paymentData.creditCard = credit_card_data.card;
      paymentData.creditCardHolderInfo = credit_card_data.holder;
    }

    // Criar Cobrança Avulsa no Asaas
    const paymentResponse = await asaas.createPayment(paymentData);

    let pixQrCode = null;
    let pixCopyPaste = null;

    if (billing_type === 'PIX') {
      try {
        const qrData = await asaas.getPaymentQrCode(paymentResponse.id);
        pixQrCode = qrData.encodedImage;
        pixCopyPaste = qrData.payload;
      } catch (qrErr) {
        console.error('Erro ao buscar QR Code PIX:', qrErr);
      }
    }

    // Salvar na tabela subscription_invoices
    const { data: invoiceRecord, error: invErr } = await supabase
      .from('subscription_invoices')
      .insert({
        clinic_id: clinic_id,
        subscription_id: subscription?.id || null,
        asaas_payment_id: paymentResponse.id,
        charge_type: 'ONE_TIME_SUBACCOUNT_EXPANSION',
        status: paymentResponse.status === 'CONFIRMED' || paymentResponse.status === 'RECEIVED' ? 'RECEIVED' : 'PENDING',
        value: totalAmount,
        net_value: paymentResponse.netValue || null,
        due_date: paymentResponse.dueDate,
        billing_type: billing_type || 'PIX',
        invoice_url: paymentResponse.invoiceUrl || null,
        bank_slip_url: paymentResponse.bankSlipUrl || null,
        pix_qr_code: pixQrCode,
        pix_copy_paste: pixCopyPaste,
        metadata: {
          quantity_spaces_bought: spacesCount,
          unit_price: unitPrice,
        },
      })
      .select()
      .single();

    if (invErr) {
      throw new Error(`Erro ao salvar fatura no banco: ${invErr.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      invoice: invoiceRecord,
      asaasPayment: paymentResponse,
      pixQrCode,
      pixCopyPaste,
    }), {
      status: 200,
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
