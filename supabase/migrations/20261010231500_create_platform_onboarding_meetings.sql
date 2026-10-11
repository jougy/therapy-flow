-- Migration: 20261010231500_create_platform_onboarding_meetings.sql
-- Description: Tabela para gerenciar agendamentos de reuniões de onboarding (15 min) com leads e novos usuários

CREATE TABLE IF NOT EXISTS public.platform_onboarding_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    clinic_name TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 15,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'canceled', 'rescheduled', 'no_show')),
    google_calendar_url TEXT,
    meet_url TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices essenciais para consultas de disponibilidade, filtros e auditoria
CREATE INDEX IF NOT EXISTS idx_platform_onboarding_meetings_phone ON public.platform_onboarding_meetings(phone);
CREATE INDEX IF NOT EXISTS idx_platform_onboarding_meetings_scheduled_at ON public.platform_onboarding_meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_platform_onboarding_meetings_status ON public.platform_onboarding_meetings(status);
CREATE INDEX IF NOT EXISTS idx_platform_onboarding_meetings_created_by ON public.platform_onboarding_meetings(created_by);
CREATE INDEX IF NOT EXISTS idx_platform_onboarding_meetings_sched_stat ON public.platform_onboarding_meetings(scheduled_at, status);

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION public.handle_platform_onboarding_meetings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_platform_onboarding_meetings_updated_at ON public.platform_onboarding_meetings;
CREATE TRIGGER trigger_platform_onboarding_meetings_updated_at
    BEFORE UPDATE ON public.platform_onboarding_meetings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_platform_onboarding_meetings_updated_at();

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.platform_onboarding_meetings ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS:
-- 1. Service role possui acesso total (Edge Functions, Webhooks)
CREATE POLICY "Service role tem acesso total a platform_onboarding_meetings"
    ON public.platform_onboarding_meetings
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 2. Platform admins ativos possuem acesso completo de leitura, escrita e atualização
CREATE POLICY "Platform admins podem gerenciar platform_onboarding_meetings"
    ON public.platform_onboarding_meetings
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_admins pa
            WHERE pa.user_id = auth.uid()
              AND pa.is_active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.platform_admins pa
            WHERE pa.user_id = auth.uid()
              AND pa.is_active = true
        )
    );

-- 3. Usuários autenticados podem visualizar reuniões criadas por eles ou associadas ao seu telefone
CREATE POLICY "Usuarios autenticados podem visualizar suas reunioes de onboarding"
    ON public.platform_onboarding_meetings
    FOR SELECT
    TO authenticated
    USING (
        created_by = auth.uid()
    );

COMMENT ON TABLE public.platform_onboarding_meetings IS 'Armazena agendamentos de reuniões de onboarding e introdução da plataforma PluriFisio.';
