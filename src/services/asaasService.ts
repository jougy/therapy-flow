// src/services/asaasService.ts
import { supabase } from "@/integrations/supabase/client";

export interface ProcessPaymentOptions {
  action: "CREATE" | "UPDATE_SEATS" | "CHANGE_PLAN" | "CANCEL";
  clinic_id: string;
  plan_type: "solo" | "clinic";
  billing_cycle?: "annual" | "quarterly" | "monthly";
  billing_type: "PIX" | "CREDIT_CARD" | "BOLETO";
  installment_count?: number;
  cpf_cnpj?: string;
  billing_name?: string;
  billing_email?: string;
  coupon_code?: string;
  additional_seats_count?: number;
  credit_card_data?: {
    card: {
      holderName: string;
      number: string;
      expiryMonth: string;
      expiryYear: string;
      ccv: string;
    };
    holder: {
      name: string;
      email: string;
      cpfCnpj: string;
      postalCode: string;
      addressNumber: string;
      phone: string;
    };
  };
}

export interface AsaasServiceResult {
  success: boolean;
  error?: string;
  subscription?: any;
  invoice?: any;
  invoiceUrl?: string | null;
  bankSlipUrl?: string | null;
  pixQrCode?: string | null;
  pixCopyPaste?: string | null;
  rawResponse?: any;
  source: "EDGE_FUNCTION";
}

export async function processAsaasPayment(opts: ProcessPaymentOptions): Promise<AsaasServiceResult> {
  try {
    const { data, error } = await supabase.functions.invoke("asaas-subscription", {
      body: opts,
    });

    if (error) {
      return {
        success: false,
        error: error.message || "Erro ao comunicar com o servidor de pagamentos.",
        source: "EDGE_FUNCTION",
      };
    }

    if (data?.success === false || data?.error) {
      return {
        success: false,
        error: data.error || "Falha no processamento do pagamento.",
        source: "EDGE_FUNCTION",
        rawResponse: data,
      };
    }

    return {
      success: true,
      subscription: data.subscription,
      invoice: data.invoice,
      invoiceUrl: data.invoiceUrl || data.invoice?.invoice_url || null,
      bankSlipUrl: data.bankSlipUrl || data.invoice?.bank_slip_url || null,
      pixQrCode: data.pixQrCode || data.invoice?.pix_qr_code || null,
      pixCopyPaste: data.pixCopyPaste || data.invoice?.pix_copy_paste || null,
      rawResponse: data,
      source: "EDGE_FUNCTION",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: msg || "Erro inesperado ao processar pagamento.",
      source: "EDGE_FUNCTION",
    };
  }
}

export async function getPixQrCode(paymentId: string, clinicId?: string): Promise<{ encodedImage: string; payload: string } | null> {
  try {
    // 1. Verificar primeiro no banco de dados se já temos o QR Code em cache
    if (paymentId) {
      const { data: inv } = await supabase
        .from("subscription_invoices")
        .select("pix_qr_code, pix_copy_paste")
        .eq("asaas_payment_id", paymentId)
        .maybeSingle();

      if (inv?.pix_qr_code && inv?.pix_copy_paste) {
        return {
          encodedImage: inv.pix_qr_code,
          payload: inv.pix_copy_paste,
        };
      }
    }

    // 2. Chamar Edge Function segura para buscar o QR Code no Asaas
    const { data, error } = await supabase.functions.invoke("asaas-subscription", {
      body: {
        action: "GET_PIX_QR_CODE",
        payment_id: paymentId,
        clinic_id: clinicId,
      },
    });

    if (!error && data?.encodedImage && data?.payload) {
      return {
        encodedImage: data.encodedImage,
        payload: data.payload,
      };
    }

    return null;
  } catch (err) {
    console.warn("Aviso ao buscar QR Code PIX via Edge Function:", err);
    return null;
  }
}

export async function checkAsaasPaymentStatus(
  paymentId?: string | null,
  subscriptionId?: string | null,
  customerId?: string | null,
  clinicId?: string | null
): Promise<{
  status: string;
  confirmed: boolean;
  refused: boolean;
  paymentDate?: string;
  paymentId?: string;
  raw?: any;
}> {
  try {
    // 1. Verificar status local no Supabase
    if (paymentId && paymentId !== "temp") {
      const { data: inv } = await supabase
        .from("subscription_invoices")
        .select("status, paid_at, asaas_payment_id")
        .eq("asaas_payment_id", paymentId)
        .maybeSingle();

      if (inv && (inv.status === "RECEIVED" || inv.status === "CONFIRMED" || inv.status === "RECEIVED_IN_CASH")) {
        return {
          status: inv.status,
          confirmed: true,
          refused: false,
          paymentDate: inv.paid_at || undefined,
          paymentId: inv.asaas_payment_id,
          raw: inv,
        };
      }
    }

    // 2. Chamar Edge Function para sincronizar e checar status
    const { data, error } = await supabase.functions.invoke("asaas-subscription", {
      body: {
        action: "CHECK_PAYMENT_STATUS",
        payment_id: paymentId,
        subscription_id: subscriptionId,
        customer_id: customerId,
        clinic_id: clinicId,
      },
    });

    if (!error && data) {
      return {
        status: data.status || "PENDING",
        confirmed: Boolean(data.confirmed),
        refused: Boolean(data.refused),
        paymentDate: data.paymentDate,
        paymentId: data.paymentId || paymentId || undefined,
        raw: data.raw,
      };
    }

    return {
      status: "PENDING",
      confirmed: false,
      refused: false,
    };
  } catch (err) {
    console.warn("Erro ao checar status de pagamento via Edge Function:", err);
    return {
      status: "UNKNOWN",
      confirmed: false,
      refused: false,
    };
  }
}

