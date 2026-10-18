-- Migration: 20261018110000_reset_stuck_whatsapp_sessions.sql
-- Description: Destrava e reseta com segurança todas as sessões ativas do bot de WhatsApp que ficaram presas em waiting_2fa_token ou estados intermediários

UPDATE public.whatsapp_chat_sessions
SET 
    current_step = 'initial',
    is_authenticated = false,
    auth_expires_at = NULL,
    authenticated_at = NULL,
    updated_at = now()
WHERE current_step IN ('waiting_2fa_token', 'waiting_clinic_selection')
   OR (is_authenticated = false AND current_step != 'initial');

-- Função administrativa de suporte para resetar a sessão de um número ou de todos os usuários
CREATE OR REPLACE FUNCTION public.reset_whatsapp_chat_sessions(
    _phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _affected_rows INTEGER;
BEGIN
    IF _phone IS NOT NULL AND trim(_phone) <> '' THEN
        UPDATE public.whatsapp_chat_sessions
        SET 
            current_step = 'initial',
            is_authenticated = false,
            auth_expires_at = NULL,
            authenticated_at = NULL,
            updated_at = now()
        WHERE phone = trim(_phone);
        GET DIAGNOSTICS _affected_rows = ROW_COUNT;
    ELSE
        UPDATE public.whatsapp_chat_sessions
        SET 
            current_step = 'initial',
            is_authenticated = false,
            auth_expires_at = NULL,
            authenticated_at = NULL,
            updated_at = now();
        GET DIAGNOSTICS _affected_rows = ROW_COUNT;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'affected_sessions', _affected_rows,
        'reset_at', now()
    );
END;
$$;

REVOKE ALL ON FUNCTION public.reset_whatsapp_chat_sessions(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_whatsapp_chat_sessions(TEXT) TO service_role;
