-- Migration: Fix login notifications and add real-time collaborator presence notifications (online/offline)
-- 1. Disparar notificação de segurança apenas quando houver login em NOVO dispositivo diferente do histórico do usuário.
-- 2. Notificar outros membros da clínica quando um colaborador ficar online ou offline (com debounce e sem spam).
-- 3. Limpar notificações repetitivas legadas de "Novo login registrado".

-- Função auxiliar para notificar presença de colaboradores na clínica
CREATE OR REPLACE FUNCTION public.notify_clinic_collaborator_presence(
  _clinic_id uuid,
  _user_id uuid,
  _status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_name text;
  _clinic_name text;
  _title text;
  _body text;
  _event_type text;
  _target_member record;
  _recent_notification_exists boolean := false;
BEGIN
  IF _clinic_id IS NULL OR _user_id IS NULL OR _status NOT IN ('online', 'offline') THEN
    RETURN;
  END IF;

  -- 1. Obter nome do colaborador
  SELECT COALESCE(NULLIF(trim(full_name), ''), NULLIF(trim(social_name), ''), NULLIF(trim(email), ''), 'Um colaborador')
  INTO _user_name
  FROM public.profiles
  WHERE id = _user_id;

  -- 2. Obter nome da clínica
  SELECT name
  INTO _clinic_name
  FROM public.clinics
  WHERE id = _clinic_id;

  _event_type := CASE WHEN _status = 'online' THEN 'collaborator_online' ELSE 'collaborator_offline' END;

  -- 3. Debounce para evitar oscilações rápidas (flapping)
  SELECT EXISTS (
    SELECT 1
    FROM public.app_notifications
    WHERE clinic_id = _clinic_id
      AND actor_user_id = _user_id
      AND event_type = _event_type
      AND created_at > now() - (CASE WHEN _status = 'online' THEN interval '10 minutes' ELSE interval '5 minutes' END)
  ) INTO _recent_notification_exists;

  IF _recent_notification_exists THEN
    RETURN;
  END IF;

  IF _status = 'online' THEN
    _title := 'Colaborador online';
    _body := _user_name || ' ficou online' || CASE WHEN _clinic_name IS NOT NULL THEN ' na clínica ' || _clinic_name ELSE '' END || '.';
  ELSE
    _title := 'Colaborador offline';
    _body := _user_name || ' ficou offline' || CASE WHEN _clinic_name IS NOT NULL THEN ' da clínica ' || _clinic_name ELSE '' END || '.';
  END IF;

  -- 4. Criar notificação para todos os OUTROS membros ativos da clínica
  FOR _target_member IN
    SELECT cm.user_id
    FROM public.clinic_memberships cm
    WHERE cm.clinic_id = _clinic_id
      AND cm.user_id <> _user_id
      AND cm.is_active = true
      AND cm.membership_status = 'active'
  LOOP
    PERFORM public.create_user_notification(
      _target_member.user_id,
      _clinic_id,
      _user_id,
      'clinic_access',
      _event_type,
      _title,
      _body,
      NULL,
      NULL,
      jsonb_build_object(
        'collaborator_id', _user_id,
        'collaborator_name', _user_name,
        'status', _status
      ),
      NULL
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_clinic_collaborator_presence(uuid, uuid, text) TO authenticated, service_role;

-- Atualizar register_current_security_session com controle inteligente de novo dispositivo e presença
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

  PERFORM public.cleanup_user_security_sessions(_user_id);

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

GRANT EXECUTE ON FUNCTION public.register_current_security_session(text, text, text, text, text) TO authenticated;

-- Atualizar end_current_security_session com presença offline
CREATE OR REPLACE FUNCTION public.end_current_security_session(_session_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _affected_count integer := 0;
  _session_row public.user_security_sessions%ROWTYPE;
  _clinic_id uuid;
  _is_completely_offline boolean := false;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  IF NULLIF(trim(COALESCE(_session_key, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Sessao invalida.';
  END IF;

  SELECT *
  INTO _session_row
  FROM public.user_security_sessions
  WHERE user_id = _user_id
    AND session_key = _session_key
  LIMIT 1;

  UPDATE public.user_security_sessions
  SET
    ended_at = now(),
    updated_at = now()
  WHERE user_id = _user_id
    AND session_key = _session_key
    AND ended_at IS NULL;

  GET DIAGNOSTICS _affected_count = ROW_COUNT;

  -- Presença: Se o usuário não tem mais nenhuma sessão ativa nessa clínica, notificar offline
  _clinic_id := COALESCE(_session_row.clinic_id, public.get_user_clinic_id(_user_id));
  IF _clinic_id IS NOT NULL THEN
    SELECT NOT EXISTS (
      SELECT 1
      FROM public.user_security_sessions
      WHERE user_id = _user_id
        AND clinic_id = _clinic_id
        AND session_key <> _session_key
        AND ended_at IS NULL
        AND force_signed_out_at IS NULL
        AND last_seen_at >= now() - INTERVAL '5 minutes'
    ) INTO _is_completely_offline;

    IF _is_completely_offline THEN
      PERFORM public.notify_clinic_collaborator_presence(_clinic_id, _user_id, 'offline');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ended_count', _affected_count,
    'user_id', _user_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.end_current_security_session(text) TO authenticated;

-- Atualizar cleanup_user_security_sessions com notificação offline para timeouts de inatividade
CREATE OR REPLACE FUNCTION public.cleanup_user_security_sessions(
  _user_id uuid DEFAULT auth.uid(),
  _inactive_window interval DEFAULT INTERVAL '15 minutes',
  _retention_window interval DEFAULT INTERVAL '30 days'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _stale_count integer := 0;
  _deleted_count integer := 0;
  _stale_session record;
  _clinic_id uuid;
  _has_other_active boolean;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  -- Identificar sessões que estão expirando agora por inatividade
  FOR _stale_session IN
    SELECT id, clinic_id, session_key
    FROM public.user_security_sessions
    WHERE user_id = _user_id
      AND ended_at IS NULL
      AND last_seen_at < now() - _inactive_window
  LOOP
    UPDATE public.user_security_sessions
    SET
      ended_at = COALESCE(last_seen_at, now()),
      updated_at = now()
    WHERE id = _stale_session.id;

    _stale_count := _stale_count + 1;

    -- Verificar se o usuário ficou totalmente offline na clínica
    _clinic_id := _stale_session.clinic_id;
    IF _clinic_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.user_security_sessions
        WHERE user_id = _user_id
          AND clinic_id = _clinic_id
          AND ended_at IS NULL
          AND force_signed_out_at IS NULL
          AND last_seen_at >= now() - INTERVAL '5 minutes'
      ) INTO _has_other_active;

      IF NOT _has_other_active THEN
        PERFORM public.notify_clinic_collaborator_presence(_clinic_id, _user_id, 'offline');
      END IF;
    END IF;
  END LOOP;

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

GRANT EXECUTE ON FUNCTION public.cleanup_user_security_sessions(uuid, interval, interval) TO authenticated;

-- Atualizar log_security_event para mensagens com nome do dispositivo
CREATE OR REPLACE FUNCTION public.log_security_event(
  _clinic_id uuid,
  _actor_user_id uuid,
  _target_user_id uuid,
  _event_type text,
  _visibility_scope text DEFAULT 'self',
  _payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event_id uuid := gen_random_uuid();
  _title text := 'Atividade de segurança registrada';
  _body text := 'Uma atividade de segurança foi registrada na sua conta.';
  _clinic_name text;
  _device_desc text;
BEGIN
  SELECT name
  INTO _clinic_name
  FROM public.clinics
  WHERE id = _clinic_id;

  INSERT INTO public.security_events (
    id,
    clinic_id,
    actor_user_id,
    target_user_id,
    event_type,
    visibility_scope,
    payload
  )
  VALUES (
    _event_id,
    _clinic_id,
    _actor_user_id,
    _target_user_id,
    _event_type,
    CASE WHEN _visibility_scope IN ('self', 'admin') THEN _visibility_scope ELSE 'self' END,
    COALESCE(_payload, '{}'::jsonb)
  );

  IF _target_user_id IS NOT NULL THEN
    IF _event_type = 'session_started' THEN
      _device_desc := COALESCE(
        NULLIF(trim(_payload->>'device_label'), ''),
        NULLIF(trim(CONCAT_WS(' • ', NULLIF(trim(_payload->>'browser'), ''), NULLIF(trim(_payload->>'platform'), ''))), ''),
        'Novo dispositivo'
      );
      _title := 'Novo dispositivo conectado';
      _body := 'Sua conta foi acessada a partir de um novo dispositivo: ' || _device_desc || '. Se não reconhecer este acesso, revise suas sessões ativas.';
    ELSIF _event_type = 'security_alerts_updated' THEN
      _title := 'Preferências de segurança atualizadas';
      _body := 'Suas preferências de alertas de segurança foram atualizadas.';
    ELSIF _event_type IN ('other_sessions_signed_out', 'other_sessions_ended') THEN
      _title := 'Outras sessões encerradas';
      _body := 'As outras sessões abertas da sua conta foram encerradas.';
    ELSIF _event_type IN ('session_force_signed_out', 'subaccount_signed_out') THEN
      _title := 'Sessão encerrada pela clínica';
      _body := 'Uma sessão da sua conta foi encerrada por um administrador da clínica.';
    ELSIF _event_type = 'subaccount_created' THEN
      _title := 'Acesso criado na clínica';
      _body := 'Seu acesso operacional foi criado' || CASE WHEN _clinic_name IS NULL THEN '.' ELSE ' na clínica ' || _clinic_name || '.' END;
    ELSIF _event_type = 'subaccount_password_reset' THEN
      _title := 'Senha provisória definida';
      _body := 'Um administrador definiu uma senha provisória para o seu acesso.';
    ELSIF _event_type = 'subaccount_status_changed' THEN
      _title := 'Status de acesso alterado';
      _body := 'O status do seu acesso operacional foi alterado' || CASE WHEN _clinic_name IS NULL THEN '.' ELSE ' na clínica ' || _clinic_name || '.' END;
    ELSIF _event_type = 'subaccount_role_changed' THEN
      _title := 'Papel operacional alterado';
      _body := 'Seu papel operacional foi alterado' || CASE WHEN _clinic_name IS NULL THEN '.' ELSE ' na clínica ' || _clinic_name || '.' END;
    ELSIF _event_type = 'clinic_member_access_revoked' THEN
      _title := 'Acesso de colaborador removido';
      _body := 'Um acesso operacional foi removido' || CASE WHEN _clinic_name IS NULL THEN '.' ELSE ' da clínica ' || _clinic_name || '.' END;
    ELSIF _event_type = 'clinic_access_removed' THEN
      _title := 'Acesso à clínica removido';
      _body := 'Seu acesso foi removido ou encerrado' || CASE WHEN _clinic_name IS NULL THEN '.' ELSE ' na clínica ' || _clinic_name || '.' END;
    ELSIF _event_type = 'clinic_member_left' THEN
      _title := 'Saída da clínica registrada';
      _body := 'Sua saída foi registrada' || CASE WHEN _clinic_name IS NULL THEN '.' ELSE ' na clínica ' || _clinic_name || '.' END;
    ELSIF _event_type = 'password_changed' THEN
      _title := 'Senha alterada';
      _body := 'Sua senha foi alterada.';
    END IF;

    PERFORM public.create_user_notification(
      _target_user_id,
      _clinic_id,
      _actor_user_id,
      'security',
      _event_type,
      _title,
      _body,
      NULL,
      NULL,
      COALESCE(_payload, '{}'::jsonb),
      _event_id
    );
  END IF;

  RETURN _event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_security_event(uuid, uuid, uuid, text, text, jsonb) TO authenticated;

-- Limpar notificações legadas repetitivas de "Novo login registrado"
DELETE FROM public.app_notifications
WHERE category = 'security'
  AND event_type = 'session_started'
  AND title = 'Novo login registrado';
