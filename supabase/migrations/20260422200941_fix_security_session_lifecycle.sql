CREATE INDEX IF NOT EXISTS idx_user_security_sessions_active_user_last_seen
ON public.user_security_sessions (user_id, last_seen_at DESC)
WHERE ended_at IS NULL;

CREATE OR REPLACE FUNCTION public.cleanup_user_security_sessions(
  _user_id uuid DEFAULT auth.uid(),
  _inactive_window interval DEFAULT interval '15 minutes',
  _retention_window interval DEFAULT interval '30 days'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _stale_count integer := 0;
  _deleted_count integer := 0;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  UPDATE public.user_security_sessions
  SET
    ended_at = COALESCE(ended_at, last_seen_at, now()),
    updated_at = now()
  WHERE user_id = _user_id
    AND ended_at IS NULL
    AND last_seen_at < now() - _inactive_window;

  GET DIAGNOSTICS _stale_count = ROW_COUNT;

  DELETE FROM public.user_security_sessions
  WHERE user_id = _user_id
    AND ended_at IS NOT NULL
    AND ended_at < now() - _retention_window;

  GET DIAGNOSTICS _deleted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'deleted_count', _deleted_count,
    'stale_count', _stale_count,
    'user_id', _user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.register_current_security_session(
  _session_key text,
  _browser text DEFAULT NULL,
  _platform text DEFAULT NULL,
  _device_label text DEFAULT NULL,
  _user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _clinic_id uuid := public.get_user_clinic_id(_user_id);
  _existing_row public.user_security_sessions%ROWTYPE;
  _reactivated boolean := false;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  IF NULLIF(trim(coalesce(_session_key, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Sessao invalida.';
  END IF;

  PERFORM public.cleanup_user_security_sessions(_user_id);

  SELECT *
  INTO _existing_row
  FROM public.user_security_sessions
  WHERE user_id = _user_id
    AND session_key = _session_key;

  IF FOUND AND _existing_row.force_signed_out_at IS NOT NULL THEN
    RAISE EXCEPTION 'Sessao encerrada pela administracao da clinica. Entre novamente para continuar.';
  END IF;

  IF NOT FOUND THEN
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
      NULLIF(trim(_device_label), ''),
      NULLIF(trim(_user_agent), '')
    )
    RETURNING * INTO _existing_row;

    _reactivated := true;
  ELSE
    _reactivated := _existing_row.ended_at IS NOT NULL;

    UPDATE public.user_security_sessions
    SET
      browser = COALESCE(NULLIF(trim(_browser), ''), browser),
      platform = COALESCE(NULLIF(trim(_platform), ''), platform),
      device_label = COALESCE(NULLIF(trim(_device_label), ''), device_label),
      user_agent = COALESCE(NULLIF(trim(_user_agent), ''), user_agent),
      signed_in_at = CASE WHEN _reactivated THEN now() ELSE signed_in_at END,
      ended_at = NULL,
      force_signed_out_at = NULL,
      forced_out_by = NULL,
      last_seen_at = now(),
      updated_at = now()
    WHERE id = _existing_row.id
    RETURNING * INTO _existing_row;
  END IF;

  IF _reactivated THEN
    PERFORM public.log_security_event(
      _clinic_id,
      _user_id,
      _user_id,
      'session_started',
      'self',
      jsonb_build_object(
        'browser', NULLIF(trim(_browser), ''),
        'platform', NULLIF(trim(_platform), ''),
        'device_label', NULLIF(trim(_device_label), '')
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'session_id', _existing_row.id,
    'user_id', _user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.end_other_security_sessions(_current_session_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _affected_count integer := 0;
  _clinic_id uuid := public.get_user_clinic_id(_user_id);
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  PERFORM public.cleanup_user_security_sessions(_user_id);

  UPDATE public.user_security_sessions
  SET
    ended_at = now(),
    updated_at = now()
  WHERE user_id = _user_id
    AND session_key IS DISTINCT FROM _current_session_key
    AND ended_at IS NULL;

  GET DIAGNOSTICS _affected_count = ROW_COUNT;

  PERFORM public.log_security_event(
    _clinic_id,
    _user_id,
    _user_id,
    'other_sessions_signed_out',
    'self',
    jsonb_build_object('ended_count', _affected_count)
  );

  RETURN jsonb_build_object(
    'ended_count', _affected_count,
    'user_id', _user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.end_current_security_session(_session_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _affected_count integer := 0;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  IF NULLIF(trim(coalesce(_session_key, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Sessao invalida.';
  END IF;

  UPDATE public.user_security_sessions
  SET
    ended_at = now(),
    updated_at = now()
  WHERE user_id = _user_id
    AND session_key = _session_key
    AND ended_at IS NULL;

  GET DIAGNOSTICS _affected_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'ended_count', _affected_count,
    'user_id', _user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_user_security_sessions(uuid, interval, interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_user_security_sessions(uuid, interval, interval) TO authenticated;

REVOKE ALL ON FUNCTION public.end_current_security_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.end_current_security_session(text) TO authenticated;
