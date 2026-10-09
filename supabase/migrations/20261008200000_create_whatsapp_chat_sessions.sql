-- Migration: 20261008200000_create_whatsapp_chat_sessions.sql
-- Description: Tabela para gerenciar sessões e estados das conversas do WhatsApp Bot do Pluri Fisio

CREATE TABLE IF NOT EXISTS public.whatsapp_chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL UNIQUE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
    current_step TEXT NOT NULL DEFAULT 'initial',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para buscas rápidas por telefone e por usuário/clínica
CREATE INDEX IF NOT EXISTS idx_whatsapp_chat_sessions_phone ON public.whatsapp_chat_sessions(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_chat_sessions_user_id ON public.whatsapp_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_chat_sessions_clinic_id ON public.whatsapp_chat_sessions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_chat_sessions_step ON public.whatsapp_chat_sessions(current_step);

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION public.handle_whatsapp_chat_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_whatsapp_chat_sessions_updated_at ON public.whatsapp_chat_sessions;
CREATE TRIGGER trigger_whatsapp_chat_sessions_updated_at
    BEFORE UPDATE ON public.whatsapp_chat_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_whatsapp_chat_sessions_updated_at();

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.whatsapp_chat_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS:
-- 1. Service role possui acesso irrestrito
CREATE POLICY "Service role tem acesso total a whatsapp_chat_sessions"
    ON public.whatsapp_chat_sessions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 2. Platform admins ativos podem consultar sessões para auditoria e suporte
CREATE POLICY "Platform admins podem visualizar whatsapp_chat_sessions"
    ON public.whatsapp_chat_sessions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_admins pa
            WHERE pa.user_id = auth.uid()
              AND pa.is_active = true
        )
    );

-- 3. Usuários autenticados podem visualizar somente o histórico da sua própria sessão
CREATE POLICY "Usuarios autenticados podem visualizar sua propria sessao de whatsapp"
    ON public.whatsapp_chat_sessions
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
    );

COMMENT ON TABLE public.whatsapp_chat_sessions IS 'Armazena o estado das conversas interativas e agendamentos do Bot de WhatsApp da PluriFisio.';

