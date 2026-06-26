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
      _title := 'Novo login registrado';
      _body := 'Uma nova sessão foi iniciada na sua conta.';
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

WITH security_notification_messages AS (
  SELECT
    security_events.id,
    CASE security_events.event_type
      WHEN 'session_started' THEN 'Novo login registrado'
      WHEN 'security_alerts_updated' THEN 'Preferências de segurança atualizadas'
      WHEN 'other_sessions_signed_out' THEN 'Outras sessões encerradas'
      WHEN 'other_sessions_ended' THEN 'Outras sessões encerradas'
      WHEN 'session_force_signed_out' THEN 'Sessão encerrada pela clínica'
      WHEN 'subaccount_signed_out' THEN 'Sessão encerrada pela clínica'
      WHEN 'subaccount_created' THEN 'Acesso criado na clínica'
      WHEN 'subaccount_password_reset' THEN 'Senha provisória definida'
      WHEN 'subaccount_status_changed' THEN 'Status de acesso alterado'
      WHEN 'subaccount_role_changed' THEN 'Papel operacional alterado'
      WHEN 'clinic_member_access_revoked' THEN 'Acesso de colaborador removido'
      WHEN 'clinic_access_removed' THEN 'Acesso à clínica removido'
      WHEN 'clinic_member_left' THEN 'Saída da clínica registrada'
      WHEN 'password_changed' THEN 'Senha alterada'
      ELSE 'Atividade de segurança registrada'
    END AS title,
    CASE security_events.event_type
      WHEN 'session_started' THEN 'Uma nova sessão foi iniciada na sua conta.'
      WHEN 'security_alerts_updated' THEN 'Suas preferências de alertas de segurança foram atualizadas.'
      WHEN 'other_sessions_signed_out' THEN 'As outras sessões abertas da sua conta foram encerradas.'
      WHEN 'other_sessions_ended' THEN 'As outras sessões abertas da sua conta foram encerradas.'
      WHEN 'session_force_signed_out' THEN 'Uma sessão da sua conta foi encerrada por um administrador da clínica.'
      WHEN 'subaccount_signed_out' THEN 'Uma sessão da sua conta foi encerrada por um administrador da clínica.'
      WHEN 'subaccount_created' THEN 'Seu acesso operacional foi criado' || CASE WHEN clinics.name IS NULL THEN '.' ELSE ' na clínica ' || clinics.name || '.' END
      WHEN 'subaccount_password_reset' THEN 'Um administrador definiu uma senha provisória para o seu acesso.'
      WHEN 'subaccount_status_changed' THEN 'O status do seu acesso operacional foi alterado' || CASE WHEN clinics.name IS NULL THEN '.' ELSE ' na clínica ' || clinics.name || '.' END
      WHEN 'subaccount_role_changed' THEN 'Seu papel operacional foi alterado' || CASE WHEN clinics.name IS NULL THEN '.' ELSE ' na clínica ' || clinics.name || '.' END
      WHEN 'clinic_member_access_revoked' THEN 'Um acesso operacional foi removido' || CASE WHEN clinics.name IS NULL THEN '.' ELSE ' da clínica ' || clinics.name || '.' END
      WHEN 'clinic_access_removed' THEN 'Seu acesso foi removido ou encerrado' || CASE WHEN clinics.name IS NULL THEN '.' ELSE ' na clínica ' || clinics.name || '.' END
      WHEN 'clinic_member_left' THEN 'Sua saída foi registrada' || CASE WHEN clinics.name IS NULL THEN '.' ELSE ' na clínica ' || clinics.name || '.' END
      WHEN 'password_changed' THEN 'Sua senha foi alterada.'
      ELSE 'Uma atividade de segurança foi registrada na sua conta.'
    END AS body
  FROM public.security_events
  LEFT JOIN public.clinics
    ON clinics.id = security_events.clinic_id
)
UPDATE public.app_notifications
SET
  title = security_notification_messages.title,
  body = security_notification_messages.body
FROM security_notification_messages
WHERE app_notifications.source_event_id = security_notification_messages.id
  AND app_notifications.category = 'security';

GRANT EXECUTE ON FUNCTION public.log_security_event(uuid, uuid, uuid, text, text, jsonb) TO authenticated;
