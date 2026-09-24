-- Migration: 20260923200000_add_nfse_fields_to_subscription_invoices.sql
-- Descrição: Adiciona campos para integração e emissão de NFS-e (Nota Fiscal de Serviços Eletrônica) via Asaas na tabela subscription_invoices
-- Padrão: Expand and Contract (não-destrutivo, com IF NOT EXISTS)

DO $$
BEGIN
    -- 1. Campos de controle e dados da NFS-e
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'subscription_invoices' 
          AND column_name = 'asaas_invoice_id'
    ) THEN
        ALTER TABLE public.subscription_invoices ADD COLUMN asaas_invoice_id text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'subscription_invoices' 
          AND column_name = 'nfe_status'
    ) THEN
        ALTER TABLE public.subscription_invoices ADD COLUMN nfe_status text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'subscription_invoices' 
          AND column_name = 'nfe_number'
    ) THEN
        ALTER TABLE public.subscription_invoices ADD COLUMN nfe_number text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'subscription_invoices' 
          AND column_name = 'nfe_pdf_url'
    ) THEN
        ALTER TABLE public.subscription_invoices ADD COLUMN nfe_pdf_url text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'subscription_invoices' 
          AND column_name = 'nfe_xml_url'
    ) THEN
        ALTER TABLE public.subscription_invoices ADD COLUMN nfe_xml_url text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'subscription_invoices' 
          AND column_name = 'nfe_error_message'
    ) THEN
        ALTER TABLE public.subscription_invoices ADD COLUMN nfe_error_message text;
    END IF;
END $$;

-- 2. Índice para consultas rápidas pelo ID da nota fiscal do Asaas
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_asaas_invoice_id 
    ON public.subscription_invoices USING btree (asaas_invoice_id);
