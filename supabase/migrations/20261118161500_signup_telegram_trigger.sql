-- Blindagem server-side: garante notificação de novos cadastros (Google OAuth ou E-mail/Senha)
-- mesmo se o frontend falhar ou o usuário fechar a aba durante o redirect.
-- A idempotência distribuída no Upstash Redis evita duplicatas caso o frontend já tenha notificado.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_signup_telegram_fallback()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_supabase_url text;
  v_service_key text;
BEGIN
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_key := current_setting('app.settings.service_role_key', true);

  IF v_supabase_url IS NULL OR v_supabase_url = '' OR v_service_key IS NULL OR v_service_key = '' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/notify-admin-telegram',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := jsonb_build_object(
      'event', 'SIGNUP_COMPLETED',
      'userId', NEW.id,
      'email', NEW.email,
      'name', COALESCE(NEW.full_name, ''),
      'origin', COALESCE(NEW.signup_origin, '')
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Fail-safe estrito: nunca bloquear criação de perfil/cadastro por erro de notificação
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_signup_telegram_fallback ON public.profiles;
CREATE TRIGGER trg_notify_signup_telegram_fallback
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_signup_telegram_fallback();
