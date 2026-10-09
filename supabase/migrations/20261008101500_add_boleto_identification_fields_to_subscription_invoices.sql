-- Migration: 20261008101500_add_boleto_identification_fields_to_subscription_invoices.sql
-- Descrição: Adiciona colunas para linha digitável e código de barras em faturas de assinatura (Boleto Bancário)

ALTER TABLE public.subscription_invoices
ADD COLUMN IF NOT EXISTS identification_field text,
ADD COLUMN IF NOT EXISTS bar_code text;

COMMENT ON COLUMN public.subscription_invoices.identification_field IS 'Linha digitável oficial do Boleto Bancário gerado pelo gateway Asaas';
COMMENT ON COLUMN public.subscription_invoices.bar_code IS 'Código de barras numérico do Boleto Bancário gerado pelo gateway Asaas';
