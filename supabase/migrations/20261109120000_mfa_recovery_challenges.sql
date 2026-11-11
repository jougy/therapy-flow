-- Migration: 20261109120000_mfa_recovery_challenges.sql
-- Tabela de desafios de contingência MFA (OTP de 6 dígitos via WhatsApp ou E-mail)

CREATE TABLE IF NOT EXISTS public.mfa_recovery_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
    target_masked TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_address TEXT DEFAULT NULL,
    user_agent TEXT DEFAULT NULL
);

-- Índices para buscas rápidas e limpezas
CREATE INDEX IF NOT EXISTS idx_mfa_recovery_challenges_user_active 
    ON public.mfa_recovery_challenges (user_id, expires_at) 
    WHERE verified_at IS NULL;

-- RLS: Acesso estrito apenas via service_role (Edge Function)
ALTER TABLE public.mfa_recovery_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages mfa recovery challenges" ON public.mfa_recovery_challenges;
CREATE POLICY "Service role manages mfa recovery challenges"
    ON public.mfa_recovery_challenges
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Revogar qualquer acesso público ou anônimo
REVOKE ALL ON TABLE public.mfa_recovery_challenges FROM PUBLIC;
REVOKE ALL ON TABLE public.mfa_recovery_challenges FROM anon;
REVOKE ALL ON TABLE public.mfa_recovery_challenges FROM authenticated;
GRANT ALL ON TABLE public.mfa_recovery_challenges TO service_role;
