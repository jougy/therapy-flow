-- Migration: 20261030130000_optimize_disk_io_and_canonical_telemetry_matrix.sql
-- Description:
-- 1. Cria índice composto em security_events (target_user_id, event_type, created_at DESC) para mitigar seq scans.
-- 2. Adiciona coluna page_dwell_matrix jsonb em user_telemetry_summaries para matriz canônica de tempo por rota.
-- 3. Otimiza register_current_security_session com throttle de escrita (4 min), throttle de cleanup (> 10 min) e atualização de profiles.last_seen_at.
-- 4. Atualiza upsert_user_telemetry_summary para persistir e somar page_dwell_matrix, prevenindo PGRST203 via DROP prévio da assinatura anterior.

-- a) Índice composto para evitar seq scan em security_events
CREATE INDEX IF NOT EXISTS idx_security_events_target_user_type_created
  ON public.security_events (target_user_id, event_type, created_at DESC);

-- b) Nova coluna para a matriz canônica de tempo por página em public.user_telemetry_summaries
ALTER TABLE public.user_telemetry_summaries
  ADD COLUMN IF NOT EXISTS page_dwell_matrix jsonb NOT NULL DEFAULT '{}'::jsonb;

-- c) Otimização de public.register_current_security_session
CREATE OR REPLACE FUNCTION public.register_current_security_session(
  _session_key text,
  _browser text DEFAULT NULL::text,
  _platform text DEFAULT NULL::text,
  _device_label text DEFAULT NULL::text,
  _user_agent text DEFAULT NULL::text
) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
  AS $$
DECLARE
  _user_id uuid := auth.uid();
  _clinic_id uuid := public.get_user_clinic_id(_user_id);
  _existing_row public.user_security_sessions%ROWTYPE;
  _reactivated boolean := false;
  _is_different_device boolean := false;
  _should_notify boolean := false;
  _was_offline boolean := false;
  _normalized_device_label text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  IF NULLIF(trim(COALESCE(_session_key, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Sessao invalida.';
  END IF;

  _normalized_device_label := COALESCE(
    NULLIF(trim(_device_label), ''),
    NULLIF(trim(CONCAT_WS(' • ', NULLIF(trim(_browser), ''), NULLIF(trim(_platform), ''))), ''),
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

  -- Se a sessão já existe, está ativa, com mesma clínica e mesmo dispositivo, e foi vista nos últimos 4 min: pula UPDATE
  IF FOUND
     AND _existing_row.ended_at IS NULL
     AND _existing_row.force_signed_out_at IS NULL
     AND COALESCE(_existing_row.clinic_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(_clinic_id, _existing_row.clinic_id, '00000000-0000-0000-0000-000000000000'::uuid)
     AND COALESCE(_existing_row.device_label, '') = _normalized_device_label
     AND _existing_row.last_seen_at >= now() - INTERVAL '4 minutes'
  THEN
    RETURN jsonb_build_object(
      'session_id', _existing_row.id,
      'user_id', _user_id,
      'skipped_write', true
    );
  END IF;

  -- Só executa limpeza se for nova sessão (NOT FOUND), reativação ou inatividade prolongada (> 10 min)
  IF NOT FOUND OR _existing_row.ended_at IS NOT NULL OR _existing_row.last_seen_at < now() - INTERVAL '10 minutes' THEN
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
        NULLIF(trim(_browser), ''),
        NULLIF(trim(_platform), ''),
        _normalized_device_label,
        NULLIF(trim(_user_agent), '')
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

  -- Atualizar a sessão atual
  UPDATE public.user_security_sessions
  SET
    clinic_id = COALESCE(_clinic_id, clinic_id),
    browser = COALESCE(NULLIF(trim(_browser), ''), browser),
    platform = COALESCE(NULLIF(trim(_platform), ''), platform),
    device_label = COALESCE(_normalized_device_label, device_label),
    user_agent = COALESCE(NULLIF(trim(_user_agent), ''), user_agent),
    signed_in_at = CASE WHEN _reactivated THEN now() ELSE signed_in_at END,
    ended_at = NULL,
    force_signed_out_at = NULL,
    forced_out_by = NULL,
    last_seen_at = now(),
    updated_at = now()
  WHERE id = _existing_row.id
  RETURNING * INTO _existing_row;

  -- Sincroniza last_seen_at do perfil com throttle de 4 minutos
  UPDATE public.profiles
  SET last_seen_at = now()
  WHERE id = _user_id
    AND (last_seen_at IS NULL OR last_seen_at < now() - INTERVAL '4 minutes');

  -- 1. Alerta de Segurança: Notificar APENAS se for login em NOVO / OUTRO dispositivo
  IF _reactivated THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_security_sessions
      WHERE user_id = _user_id
        AND id <> _existing_row.id
        AND (
          COALESCE(platform, '') <> COALESCE(NULLIF(trim(_platform), ''), '')
          OR COALESCE(browser, '') <> COALESCE(NULLIF(trim(_browser), ''), '')
        )
    ) INTO _is_different_device;

    IF _is_different_device THEN
      SELECT NOT EXISTS (
        SELECT 1
        FROM public.security_events
        WHERE target_user_id = _user_id
          AND event_type = 'session_started'
          AND created_at > now() - INTERVAL '24 hours'
          AND (
            COALESCE(payload->>'platform', '') = COALESCE(NULLIF(trim(_platform), ''), '')
            AND COALESCE(payload->>'browser', '') = COALESCE(NULLIF(trim(_browser), ''), '')
          )
      ) INTO _should_notify;

      IF _should_notify THEN
        PERFORM public.log_security_event(
          _clinic_id,
          _user_id,
          _user_id,
          'session_started',
          'self',
          jsonb_build_object(
            'browser', NULLIF(trim(_browser), ''),
            'platform', NULLIF(trim(_platform), ''),
            'device_label', _normalized_device_label,
            'user_agent', NULLIF(trim(_user_agent), ''),
            'session_key', _session_key,
            'is_new_device', true
          )
        );
      END IF;
    END IF;
  END IF;

  -- 2. Presença de Equipe: Notificar outros membros da clínica se o usuário ficou ONLINE
  IF _clinic_id IS NOT NULL THEN
    SELECT NOT EXISTS (
      SELECT 1
      FROM public.user_security_sessions
      WHERE user_id = _user_id
        AND clinic_id = _clinic_id
        AND id <> _existing_row.id
        AND ended_at IS NULL
        AND force_signed_out_at IS NULL
        AND last_seen_at >= now() - INTERVAL '5 minutes'
    ) INTO _was_offline;

    IF _was_offline THEN
      PERFORM public.notify_clinic_collaborator_presence(_clinic_id, _user_id, 'online');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'session_id', _existing_row.id,
    'user_id', _user_id
  );
END;
$$;

-- d) Atualização de public.upsert_user_telemetry_summary
-- Drop da assinatura legada (15 parâmetros) para evitar duplicidade e erro PGRST203
DROP FUNCTION IF EXISTS public.upsert_user_telemetry_summary(uuid, text, integer, integer, integer, integer, integer, jsonb, boolean, text, integer, integer, integer, integer, jsonb);

CREATE OR REPLACE FUNCTION public.upsert_user_telemetry_summary(
  _clinic_id uuid,
  _user_name text,
  _page_views integer,
  _prints_detected integer,
  _docs_printed integer,
  _pdf_exported integer,
  _dwell_seconds integer,
  _top_routes jsonb,
  _is_spam_flagged boolean DEFAULT false,
  _spam_reason text DEFAULT NULL::text,
  _clinical_records_saved integer DEFAULT 0,
  _forms_completed integer DEFAULT 0,
  _upgrade_views integer DEFAULT 0,
  _form_validation_errors integer DEFAULT 0,
  _recent_errors jsonb DEFAULT '[]'::jsonb,
  _page_dwell_matrix jsonb DEFAULT '{}'::jsonb
) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public', 'auth', 'pg_temp'
  AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_clean_user_name TEXT := COALESCE(NULLIF(trim(_user_name), ''), 'Usuário');
  v_clean_spam_reason TEXT := NULLIF(trim(_spam_reason), '');
BEGIN
  -- Safe guard: If session is unauthenticated (e.g. race condition during logout/session teardown), return gracefully
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.user_telemetry_summaries (
    user_id,
    clinic_id,
    summary_date,
    user_name,
    page_views_count,
    prints_detected_count,
    docs_printed_count,
    pdf_exported_count,
    dwell_time_seconds,
    top_routes,
    page_dwell_matrix,
    is_spam_flagged,
    spam_reason,
    clinical_records_saved_count,
    forms_completed_count,
    upgrade_views_count,
    form_validation_errors_count,
    recent_errors,
    updated_at
  )
  VALUES (
    v_user_id,
    _clinic_id,
    CURRENT_DATE,
    v_clean_user_name,
    GREATEST(0, COALESCE(_page_views, 0)),
    GREATEST(0, COALESCE(_prints_detected, 0)),
    GREATEST(0, COALESCE(_docs_printed, 0)),
    GREATEST(0, COALESCE(_pdf_exported, 0)),
    GREATEST(0, COALESCE(_dwell_seconds, 0)),
    COALESCE(_top_routes, '{}'::jsonb),
    COALESCE(_page_dwell_matrix, '{}'::jsonb),
    COALESCE(_is_spam_flagged, false),
    LEFT(v_clean_spam_reason, 500),
    GREATEST(0, COALESCE(_clinical_records_saved, 0)),
    GREATEST(0, COALESCE(_forms_completed, 0)),
    GREATEST(0, COALESCE(_upgrade_views, 0)),
    GREATEST(0, COALESCE(_form_validation_errors, 0)),
    COALESCE(_recent_errors, '[]'::jsonb),
    now()
  )
  ON CONFLICT (user_id, clinic_id, summary_date)
  DO UPDATE SET
    user_name = EXCLUDED.user_name,
    page_views_count = user_telemetry_summaries.page_views_count + EXCLUDED.page_views_count,
    prints_detected_count = user_telemetry_summaries.prints_detected_count + EXCLUDED.prints_detected_count,
    docs_printed_count = user_telemetry_summaries.docs_printed_count + EXCLUDED.docs_printed_count,
    pdf_exported_count = user_telemetry_summaries.pdf_exported_count + EXCLUDED.pdf_exported_count,
    dwell_time_seconds = user_telemetry_summaries.dwell_time_seconds + EXCLUDED.dwell_time_seconds,
    clinical_records_saved_count = user_telemetry_summaries.clinical_records_saved_count + EXCLUDED.clinical_records_saved_count,
    forms_completed_count = user_telemetry_summaries.forms_completed_count + EXCLUDED.forms_completed_count,
    upgrade_views_count = user_telemetry_summaries.upgrade_views_count + EXCLUDED.upgrade_views_count,
    form_validation_errors_count = user_telemetry_summaries.form_validation_errors_count + EXCLUDED.form_validation_errors_count,
    recent_errors = (
      SELECT COALESCE(jsonb_agg(err_elem), '[]'::jsonb)
      FROM (
        SELECT elem AS err_elem
        FROM jsonb_array_elements(
          COALESCE(user_telemetry_summaries.recent_errors, '[]'::jsonb) ||
          COALESCE(EXCLUDED.recent_errors, '[]'::jsonb)
        ) AS elem
        ORDER BY (elem->>'timestamp') DESC NULLS LAST
        LIMIT 20
      ) sub
    ),
    top_routes = (
      SELECT COALESCE(
        jsonb_object_agg(key, sum_val),
        '{}'::jsonb
      )
      FROM (
        SELECT key, sum(value::numeric)::int AS sum_val
        FROM (
          SELECT key, value FROM jsonb_each_text(COALESCE(user_telemetry_summaries.top_routes, '{}'::jsonb))
          UNION ALL
          SELECT key, value FROM jsonb_each_text(COALESCE(EXCLUDED.top_routes, '{}'::jsonb))
        ) combined
        WHERE value ~ '^-?[0-9]+$'
        GROUP BY key
      ) summed
    ),
    page_dwell_matrix = (
      SELECT COALESCE(
        jsonb_object_agg(key, sum_val),
        '{}'::jsonb
      )
      FROM (
        SELECT key, sum(value::numeric)::int AS sum_val
        FROM (
          SELECT key, value FROM jsonb_each_text(COALESCE(user_telemetry_summaries.page_dwell_matrix, '{}'::jsonb))
          UNION ALL
          SELECT key, value FROM jsonb_each_text(COALESCE(EXCLUDED.page_dwell_matrix, '{}'::jsonb))
        ) combined
        WHERE value ~ '^-?[0-9]+$'
        GROUP BY key
      ) summed
    ),
    is_spam_flagged = user_telemetry_summaries.is_spam_flagged OR EXCLUDED.is_spam_flagged,
    spam_reason = COALESCE(EXCLUDED.spam_reason, user_telemetry_summaries.spam_reason),
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_user_telemetry_summary(uuid, text, integer, integer, integer, integer, integer, jsonb, boolean, text, integer, integer, integer, integer, jsonb, jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.upsert_user_telemetry_summary(uuid, text, integer, integer, integer, integer, integer, jsonb, boolean, text, integer, integer, integer, integer, jsonb, jsonb) TO service_role;
GRANT ALL ON FUNCTION public.upsert_user_telemetry_summary(uuid, text, integer, integer, integer, integer, integer, jsonb, boolean, text, integer, integer, integer, integer, jsonb, jsonb) TO authenticated;
