import type { Json } from "@/integrations/supabase/types";

export interface SubscriptionInvoice {
  id: string;
  clinic_id: string;
  subscription_id?: string | null;
  asaas_payment_id: string;
  asaas_invoice_id?: string | null;
  charge_type: "RECURRING_SUBSCRIPTION" | "ONE_TIME_SUBACCOUNT_EXPANSION" | string;
  status: string;
  value: number;
  net_value?: number | null;
  original_value?: number | null;
  discount_amount?: number | null;
  due_date: string;
  payment_date?: string | null;
  paid_at?: string | null;
  billing_type?: string | null;
  invoice_url?: string | null;
  bank_slip_url?: string | null;
  pix_qr_code?: string | null;
  pix_copy_paste?: string | null;
  pix_copia_e_cola?: string | null;
  pix_expiration_date?: string | null;
  installment_number?: number | null;
  total_installments?: number | null;
  asaas_customer_id?: string | null;
  asaas_subscription_id?: string | null;
  metadata?: Record<string, unknown> | Json | null;
  created_at: string;

  // Campos fiscais NFS-e Asaas
  nfe_status?: string | null;
  nfe_number?: string | null;
  nfe_pdf_url?: string | null;
  nfe_xml_url?: string | null;
  nfe_error_message?: string | null;
}
