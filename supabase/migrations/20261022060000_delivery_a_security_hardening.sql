-- Migration: 20261022060000_delivery_a_security_hardening.sql
-- Description: Entrega A - Hardening de Segurança, Proteção de Profiles/MFA, Imutabilidade de Histórico Clínico e RLS de Telemetria

-- ==============================================================================
-- 1. ISOLAMENTO DE SEGREDOS MFA TOTP FORA DE PROFILES
-- ==============================================================================

-- Tabela privada para credenciais sensíveis de MFA/TOTP (1 por usuário)
CREATE TABLE IF NOT EXISTS public.user_mfa_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    totp_secret TEXT NOT NULL,
    totp_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_mfa_credentials_user UNIQUE (user_id)
);

-- Habilitar RLS estrito
ALTER TABLE public.user_mfa_credentials ENABLE ROW LEVEL SECURITY;

-- Ninguém acessa diretamente via REST público/anon
DROP POLICY IF EXISTS "Users can only read own MFA credentials" ON public.user_mfa_credentials;
CREATE POLICY "Users can only read own MFA credentials"
    ON public.user_mfa_credentials
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Inserção/atualização permitida apenas via RPC segura (ou próprio dono)
DROP POLICY IF EXISTS "Users can manage own MFA credentials" ON public.user_mfa_credentials;
CREATE POLICY "Users can manage own MFA credentials"
    ON public.user_mfa_credentials
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Migração de dados legados existentes em profiles para a nova tabela
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'profiles' 
          AND column_name = 'totp_secret'
    ) THEN
        INSERT INTO public.user_mfa_credentials (user_id, totp_secret, totp_enabled, created_at, updated_at)
        SELECT 
            id AS user_id, 
            totp_secret, 
            COALESCE(totp_enabled, true),
            COALESCE(totp_enabled_at, now()),
            now()
        FROM public.profiles
        WHERE totp_secret IS NOT NULL AND trim(totp_secret) <> ''
        ON CONFLICT (user_id) DO UPDATE
        SET totp_secret = EXCLUDED.totp_secret,
            totp_enabled = EXCLUDED.totp_enabled,
            updated_at = now();

        -- Limpar os segredos da tabela profiles para não vazarem em SELECT *
        UPDATE public.profiles
        SET totp_secret = NULL
        WHERE totp_secret IS NOT NULL;
    END IF;
END $$;

-- Atualizar setup_user_totp para salvar na tabela isolada
CREATE OR REPLACE FUNCTION public.setup_user_totp(
    _totp_secret TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    _current_user_id UUID := auth.uid();
BEGIN
    IF _current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
    END IF;

    IF _totp_secret IS NULL OR length(trim(_totp_secret)) < 16 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Segredo TOTP inválido');
    END IF;

    -- Salvar na tabela isolada
    INSERT INTO public.user_mfa_credentials (user_id, totp_secret, totp_enabled, updated_at)
    VALUES (_current_user_id, trim(_totp_secret), true, now())
    ON CONFLICT (user_id) DO UPDATE
    SET totp_secret = EXCLUDED.totp_secret,
        totp_enabled = true,
        updated_at = now();

    -- Atualizar flag pública/não sensível de status no profile
    UPDATE public.profiles
    SET 
        totp_secret = NULL, -- Garante limpeza contínua
        totp_enabled = true,
        totp_enabled_at = now(),
        updated_at = now()
    WHERE id = _current_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Atualizar disable_user_totp para remover da tabela isolada
CREATE OR REPLACE FUNCTION public.disable_user_totp()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    _current_user_id UUID := auth.uid();
BEGIN
    IF _current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
    END IF;

    DELETE FROM public.user_mfa_credentials
    WHERE user_id = _current_user_id;

    UPDATE public.profiles
    SET 
        totp_secret = NULL,
        totp_enabled = false,
        totp_enabled_at = NULL,
        updated_at = now()
    WHERE id = _current_user_id;

    -- Desconectar sessões ativas do WhatsApp associadas a este usuário
    UPDATE public.whatsapp_chat_sessions
    SET 
        is_authenticated = false,
        authenticated_at = NULL,
        auth_expires_at = NULL,
        current_step = 'initial',
        updated_at = now()
    WHERE user_id = _current_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Privilégios explícitos das RPCs de TOTP
REVOKE ALL ON FUNCTION public.setup_user_totp(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.setup_user_totp(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.setup_user_totp(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.setup_user_totp(TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.disable_user_totp() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.disable_user_totp() FROM anon;
GRANT EXECUTE ON FUNCTION public.disable_user_totp() TO authenticated;
GRANT EXECUTE ON FUNCTION public.disable_user_totp() TO service_role;


-- ==============================================================================
-- 2. CORREÇÃO DA POLÍTICA DE AUDITORIA CLÍNICA (session_edit_history)
-- ==============================================================================

-- Remover brecha de "OR true" na inserção
DROP POLICY IF EXISTS "Users insert clinic session edit history" ON public.session_edit_history;

CREATE POLICY "Users insert clinic session edit history" ON public.session_edit_history
  FOR INSERT TO authenticated
  WITH CHECK (
    -- O editor deve ser o próprio usuário autenticado
    editor_user_id = auth.uid()
    AND (
      -- E a clínica deve ser uma em que ele possui vínculo ativo
      clinic_id IN (
        SELECT cm.clinic_id 
        FROM public.clinic_memberships cm 
        WHERE cm.user_id = auth.uid() 
          AND cm.status = 'active'
      )
      -- Ou o usuário é um super_admin
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    )
  );

-- Garantir que session_edit_history seja estritamente imutável (sem UPDATE e sem DELETE por usuários comuns)
DROP POLICY IF EXISTS "No user updates on session edit history" ON public.session_edit_history;
DROP POLICY IF EXISTS "Super admins manage all session edit history" ON public.session_edit_history;

-- Super admin pode auditar/ler, mas não alterar histórico forense
CREATE POLICY "Super admins view all session edit history" ON public.session_edit_history
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


-- ==============================================================================
-- 3. RESTRINGIR E BLINDAR INSERÇÃO EM telemetry_events
-- ==============================================================================

DROP POLICY IF EXISTS "Authenticated users can insert telemetry events" ON public.telemetry_events;

CREATE POLICY "Authenticated users can insert telemetry events"
  ON public.telemetry_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- O evento deve pertencer ao usuário logado
    user_id = auth.uid()
    AND (
      clinic_id IS NULL
      OR clinic_id IN (
        SELECT cm.clinic_id 
        FROM public.clinic_memberships cm 
        WHERE cm.user_id = auth.uid() 
          AND cm.status = 'active'
      )
    )
  );


-- ==============================================================================
-- 4. HARDENING DE search_path E PERMISSÕES NAS FUNÇÕES CRÍTICAS
-- ==============================================================================

-- Função de auditoria interna
ALTER FUNCTION public.log_session_edit_history() SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.log_session_edit_history() FROM anon;

-- Funções administrativas de telemetria
ALTER FUNCTION public.list_platform_telemetry_events(UUID, INT) SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.list_platform_telemetry_events(UUID, INT) FROM anon;

ALTER FUNCTION public.cleanup_old_telemetry_events(INT, INT) SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_telemetry_events(INT, INT) FROM anon;

ALTER FUNCTION public.list_platform_user_telemetry_events(UUID, INT) SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.list_platform_user_telemetry_events(UUID, INT) FROM anon;
