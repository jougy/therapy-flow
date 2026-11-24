-- Migration: Estancamento de Disk I/O no Heartbeat de Sessão e Notificações
-- 1. Corrige bug _was_offline em register_current_security_session + amplia SKIP WRITE para 15 min + remove fan-out de presença no Postgres
-- 2. Remove write-on-read (ensure_notification_preferences) de list_current_user_notifications()
-- 3. Fixa search_path = '' em ambas as funções

CREATE OR REPLACE FUNCTION public.register_current_security_session(
  _session_key text,
  _browser text DEFAULT NULL::text,
  _platform text DEFAULT NULL::text,
  _device_label text DEFAULT NULL::text,
  _user_agent text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _clinic_id uuid := public.get_user_clinic_id(_user_id);
  _existing_row public.user_security_sessions%ROWTYPE;
  _prev_last_seen_at timestamptz;
  _reactivated boolean := false;
  _is_different_device boolean := false;
  _should_notify boolean := false;
  _normalized_device_label text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  IF NULLIF(pg_catalog.btrim(COALESCE(_session_key, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Sessao invalida.';
  END IF;

  _normalized_device_label := COALESCE(
    NULLIF(pg_catalog.btrim(_device_label), ''),
    NULLIF(pg_catalog.btrim(pg_catalog.concat_ws(' • ', NULLIF(pg_catalog.btrim(_browser), ''), NULLIF(pg_catalog.btrim(_platform), ''))), ''),
    'Dispositivo desconhecido'
  );

  SELECT *
  INTO _existing_row
  FROM public.user_security_sessions
  WHERE session_key = _session_key
  LIMIT 1;

  IF FOUND AND _existing_row.user_id <> _user_id THEN
    RAISE EXCEPTION 'Sessao invalida.';
  END IF;

  IF FOUND AND _existing_row.force_signed_out_at IS NOT NULL THEN
    RAISE EXCEPTION 'Sessao encerrada pela administracao da clinica. Entre novamente para continuar.';
  END IF;

  _prev_last_seen_at := _existing_row.last_seen_at;

  -- Skip write em disco se a sessão já existe, está ativa, mesma clínica/dispositivo e vista nos últimos 15 min
  IF FOUND
     AND _existing_row.ended_at IS NULL
     AND _existing_row.force_signed_out_at IS NULL
     AND COALESCE(_existing_row.clinic_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(_clinic_id, _existing_row.clinic_id, '00000000-0000-0000-0000-000000000000'::uuid)
     AND COALESCE(_existing_row.device_label, '') = _normalized_device_label
     AND _existing_row.last_seen_at >= pg_catalog.now() - INTERVAL '15 minutes'
  THEN
    RETURN pg_catalog.jsonb_build_object(
      'session_id', _existing_row.id,
      'user_id', _user_id,
      'skipped_write', true
    );
  END IF;

  -- Só executa limpeza se for nova sessão, reativação ou inatividade prolongada (> 15 min)
  IF NOT FOUND OR _existing_row.ended_at IS NOT NULL OR _prev_last_seen_at < pg_catalog.now() - INTERVAL '15 minutes' THEN
    PERFORM public.cleanup_user_security_sessions(_user_id);
  END IF;

  IF NOT FOUND THEN
    BEGIN
      INSERT INTO public.user_security_sessions (
        user_id,
        clinic_id,
        session_key,
        browser,
        platform,
        device_label,
        user_agent
      )
      VALUES (
        _user_id,
        _clinic_id,
        _session_key,
        NULLIF(pg_catalog.btrim(_browser), ''),
        NULLIF(pg_catalog.btrim(_platform), ''),
        _normalized_device_label,
        NULLIF(pg_catalog.btrim(_user_agent), '')
      )
      RETURNING * INTO _existing_row;

      _reactivated := true;
    EXCEPTION
      WHEN unique_violation THEN
        SELECT *
        INTO _existing_row
        FROM public.user_security_sessions
        WHERE session_key = _session_key
        LIMIT 1;

        IF NOT FOUND OR _existing_row.user_id <> _user_id THEN
          RAISE EXCEPTION 'Sessao invalida.';
        END IF;

        _reactivated := _existing_row.ended_at IS NOT NULL;
    END;
  ELSE
    _reactivated := _existing_row.ended_at IS NOT NULL;
  END IF;

  UPDATE public.user_security_sessions
  SET
    clinic_id = COALESCE(_clinic_id, clinic_id),
    browser = COALESCE(NULLIF(pg_catalog.btrim(_browser), ''), browser),
    platform = COALESCE(NULLIF(pg_catalog.btrim(_platform), ''), platform),
    device_label = COALESCE(_normalized_device_label, device_label),
    user_agent = COALESCE(NULLIF(pg_catalog.btrim(_user_agent), ''), user_agent),
    signed_in_at = CASE WHEN _reactivated THEN pg_catalog.now() ELSE signed_in_at END,
    ended_at = NULL,
    force_signed_out_at = NULL,
    forced_out_by = NULL,
    last_seen_at = pg_catalog.now(),
    updated_at = pg_catalog.now()
  WHERE id = _existing_row.id
  RETURNING * INTO _existing_row;

  -- Sincroniza last_seen_at do perfil com throttle de 15 minutos
  UPDATE public.profiles
  SET last_seen_at = pg_catalog.now()
  WHERE id = _user_id
    AND (last_seen_at IS NULL OR last_seen_at < pg_catalog.now() - INTERVAL '15 minutes');

  -- Alerta de Segurança: Notificar APENAS se for login em NOVO / OUTRO dispositivo
  IF _reactivated THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_security_sessions
      WHERE user_id = _user_id
        AND id <> _existing_row.id
        AND (
          COALESCE(platform, '') <> COALESCE(NULLIF(pg_catalog.btrim(_platform), ''), '')
          OR COALESCE(browser, '') <> COALESCE(NULLIF(pg_catalog.btrim(_browser), ''), '')
        )
    ) INTO _is_different_device;

    IF _is_different_device THEN
      SELECT NOT EXISTS (
        SELECT 1
        FROM public.security_events
        WHERE target_user_id = _user_id
          AND event_type = 'session_started'
          AND created_at > pg_catalog.now() - INTERVAL '24 hours'
          AND (
            COALESCE(payload->>'platform', '') = COALESCE(NULLIF(pg_catalog.btrim(_platform), ''), '')
            AND COALESCE(payload->>'browser', '') = COALESCE(NULLIF(pg_catalog.btrim(_browser), ''), '')
          )
      ) INTO _should_notify;

      IF _should_notify THEN
        PERFORM public.log_security_event(
          _clinic_id,
          _user_id,
          _user_id,
          'session_started',
          'self',
          pg_catalog.jsonb_build_object(
            'browser', NULLIF(pg_catalog.btrim(_browser), ''),
            'platform', NULLIF(pg_catalog.btrim(_platform), ''),
            'device_label', _normalized_device_label,
            'user_agent', NULLIF(pg_catalog.btrim(_user_agent), ''),
            'session_key', _session_key,
            'is_new_device', true
          )
        );
      END IF;
    END IF;
  END IF;

  -- Presença online em tempo real foi migrada para Upstash Redis (via platform-observability)
  -- para eliminar write amplification de WAL em app_notifications.

  RETURN pg_catalog.jsonb_build_object(
    'session_id', _existing_row.id,
    'user_id', _user_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_current_user_notifications()
RETURNS TABLE(
  notification_id uuid,
  created_at timestamp with time zone,
  category text,
  event_type text,
  title text,
  body text,
  clinic_id uuid,
  clinic_name text,
  actor_user_id uuid,
  actor_name text,
  action_label text,
  action_url text,
  payload jsonb,
  read_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  RETURN QUERY
  SELECT
    app_notifications.id AS notification_id,
    app_notifications.created_at,
    app_notifications.category,
    app_notifications.event_type,
    app_notifications.title,
    app_notifications.body,
    app_notifications.clinic_id,
    clinics.name AS clinic_name,
    app_notifications.actor_user_id,
    actor_profile.full_name AS actor_name,
    app_notifications.action_label,
    app_notifications.action_url,
    app_notifications.payload,
    app_notifications.read_at
  FROM public.app_notifications
  LEFT JOIN public.clinics
    ON clinics.id = app_notifications.clinic_id
  LEFT JOIN public.profiles AS actor_profile
    ON actor_profile.id = app_notifications.actor_user_id
  WHERE app_notifications.user_id = _user_id
    AND app_notifications.dismissed_at IS NULL
  ORDER BY app_notifications.created_at DESC, app_notifications.id DESC
  LIMIT 64;
END;
$function$;
