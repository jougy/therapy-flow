-- Migration: 20261015103000_whatsapp_bot_2fa_and_auth_sessions.sql
-- Description: Adiciona suporte a 2FA TOTP (Ente Auth) por perfil e gestão de autenticação de sessão do WhatsApp Bot com inatividade de 5h

-- 1. Campos de 2FA TOTP no perfil do usuário
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS totp_secret TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS totp_enabled_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Campos de autenticação e expiração em whatsapp_chat_sessions
ALTER TABLE public.whatsapp_chat_sessions
ADD COLUMN IF NOT EXISTS authenticated_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS auth_expires_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_authenticated BOOLEAN NOT NULL DEFAULT false;

-- Índice para busca rápida de sessões ativas autenticadas
CREATE INDEX IF NOT EXISTS idx_whatsapp_chat_sessions_auth ON public.whatsapp_chat_sessions(phone, is_authenticated, auth_expires_at);

-- 3. Função RPC para o usuário gerenciar seu 2FA nas configurações pessoais
CREATE OR REPLACE FUNCTION public.setup_user_totp(
    _totp_secret TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

    UPDATE public.profiles
    SET 
        totp_secret = trim(_totp_secret),
        totp_enabled = true,
        totp_enabled_at = now(),
        updated_at = now()
    WHERE id = _current_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.setup_user_totp(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.setup_user_totp(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.setup_user_totp(TEXT) TO service_role;

-- 4. Função RPC para desativar 2FA (opcional nas configurações pessoais)
CREATE OR REPLACE FUNCTION public.disable_user_totp()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _current_user_id UUID := auth.uid();
BEGIN
    IF _current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
    END IF;

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

REVOKE ALL ON FUNCTION public.disable_user_totp() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.disable_user_totp() TO authenticated;
GRANT EXECUTE ON FUNCTION public.disable_user_totp() TO service_role;

-- 5. Função RPC segura para obter status de 2FA do usuário atual
CREATE OR REPLACE FUNCTION public.get_user_totp_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _current_user_id UUID := auth.uid();
    _enabled BOOLEAN := false;
    _enabled_at TIMESTAMPTZ := NULL;
    _phone TEXT := NULL;
BEGIN
    IF _current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
    END IF;

    SELECT totp_enabled, totp_enabled_at, phone
    INTO _enabled, _enabled_at, _phone
    FROM public.profiles
    WHERE id = _current_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'totp_enabled', COALESCE(_enabled, false),
        'totp_enabled_at', _enabled_at,
        'phone', _phone
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_totp_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_totp_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_totp_status() TO service_role;
