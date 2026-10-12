-- Migration: 20261011190000_add_performance_indexes_whatsapp_copilot.sql
-- Description: Adiciona índices estratégicos para lookups O(1) do Copiloto do Titular (WhatsApp)
-- Garantindo performance e prevenindo table scans em clinics, subscription_invoices e profiles

-- 1. Lookup de clínicas por account_owner_user_id (verificação rápida de titularidade)
CREATE INDEX IF NOT EXISTS idx_clinics_account_owner_user_id 
    ON public.clinics(account_owner_user_id);

-- 2. Lookup composto de faturas por clínica e status com ordenação por due_date (O(1) para faturas pendentes/vencidas)
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_clinic_status_due
    ON public.subscription_invoices(clinic_id, status, due_date ASC);

-- 3. Lookup de perfis por telefone (O(1) para identificação rápida do remetente no WhatsApp)
CREATE INDEX IF NOT EXISTS idx_profiles_phone 
    ON public.profiles(phone) 
    WHERE (phone IS NOT NULL AND phone <> '');
