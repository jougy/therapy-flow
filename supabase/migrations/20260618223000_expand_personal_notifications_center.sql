CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY,
  sound_mode text NOT NULL DEFAULT 'default',
  sound_key text NOT NULL DEFAULT 'soft',
  notify_security boolean NOT NULL DEFAULT true,
  notify_clinic_access boolean NOT NULL DEFAULT true,
  notify_patient_saved boolean NOT NULL DEFAULT true,
  notify_session_activity boolean NOT NULL DEFAULT true,
  notify_event_reminders boolean NOT NULL DEFAULT true,
  notify_system boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_preferences_sound_mode_check
    CHECK (sound_mode IN ('default', 'silent')),
  CONSTRAINT notification_preferences_sound_key_check
    CHECK (sound_key IN ('soft', 'chime', 'pulse'))
);

CREATE TABLE IF NOT EXISTS public.app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  actor_user_id uuid,
  category text NOT NULL,
  event_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  action_label text,
  action_url text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_event_id uuid,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_notifications_category_check
    CHECK (category IN ('security', 'clinic_access', 'patient', 'session', 'reminder', 'system')),
  CONSTRAINT app_notifications_event_type_check
    CHECK (char_length(event_type) BETWEEN 1 AND 120),
  CONSTRAINT app_notifications_title_check
    CHECK (char_length(title) BETWEEN 1 AND 160),
  CONSTRAINT app_notifications_body_check
    CHECK (char_length(body) BETWEEN 1 AND 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_notifications_source_event_id
ON public.app_notifications(source_event_id)
WHERE source_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_app_notifications_user_visible_created
ON public.app_notifications(user_id, dismissed_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_notifications_user_created
ON public.app_notifications(user_id, created_at DESC);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users manage own notification preferences"
ON public.notification_preferences
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users read own app notifications" ON public.app_notifications;
CREATE POLICY "Users read own app notifications"
ON public.app_notifications
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own app notifications" ON public.app_notifications;
CREATE POLICY "Users update own app notifications"
ON public.app_notifications
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own app notifications" ON public.app_notifications;
CREATE POLICY "Users delete own app notifications"
ON public.app_notifications
FOR DELETE
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.touch_notification_preferences_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.touch_notification_preferences_updated_at();

CREATE OR REPLACE FUNCTION public.ensure_notification_preferences(_user_id uuid)
RETURNS public.notification_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _preferences public.notification_preferences%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao informado.';
  END IF;

  INSERT INTO public.notification_preferences (user_id)
  VALUES (_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT *
  INTO _preferences
  FROM public.notification_preferences
  WHERE user_id = _user_id;

  RETURN _preferences;
END;
$$;

CREATE OR REPLACE FUNCTION public.notification_category_enabled(
  _preferences public.notification_preferences,
  _category text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _category
    WHEN 'security' THEN _preferences.notify_security
    WHEN 'clinic_access' THEN _preferences.notify_clinic_access
    WHEN 'patient' THEN _preferences.notify_patient_saved
    WHEN 'session' THEN _preferences.notify_session_activity
    WHEN 'reminder' THEN _preferences.notify_event_reminders
    WHEN 'system' THEN _preferences.notify_system
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.trim_user_notifications(_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ranked_notifications AS (
    SELECT
      id,
      row_number() OVER (ORDER BY created_at DESC, id DESC) AS position
    FROM public.app_notifications
    WHERE user_id = _user_id
  )
  DELETE FROM public.app_notifications
  WHERE id IN (
    SELECT id
    FROM ranked_notifications
    WHERE position > 64
  );
$$;

CREATE OR REPLACE FUNCTION public.create_user_notification(
  _user_id uuid,
  _clinic_id uuid,
  _actor_user_id uuid,
  _category text,
  _event_type text,
  _title text,
  _body text,
  _action_label text DEFAULT NULL,
  _action_url text DEFAULT NULL,
  _payload jsonb DEFAULT '{}'::jsonb,
  _source_event_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _preferences public.notification_preferences%ROWTYPE;
  _notification_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF _category NOT IN ('security', 'clinic_access', 'patient', 'session', 'reminder', 'system') THEN
    RAISE EXCEPTION 'Categoria de notificacao invalida.';
  END IF;

  SELECT *
  INTO _preferences
  FROM public.ensure_notification_preferences(_user_id);

  IF NOT public.notification_category_enabled(_preferences, _category) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.app_notifications (
    user_id,
    clinic_id,
    actor_user_id,
    category,
    event_type,
    title,
    body,
    action_label,
    action_url,
    payload,
    source_event_id
  )
  VALUES (
    _user_id,
    _clinic_id,
    _actor_user_id,
    _category,
    left(btrim(_event_type), 120),
    left(btrim(_title), 160),
    left(btrim(_body), 1000),
    nullif(left(btrim(coalesce(_action_label, '')), 80), ''),
    nullif(left(btrim(coalesce(_action_url, '')), 500), ''),
    coalesce(_payload, '{}'::jsonb),
    _source_event_id
  )
  ON CONFLICT (source_event_id)
  WHERE source_event_id IS NOT NULL
  DO UPDATE SET source_event_id = EXCLUDED.source_event_id
  RETURNING id INTO _notification_id;

  PERFORM public.trim_user_notifications(_user_id);

  RETURN _notification_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_current_user_notification(
  _clinic_id uuid,
  _category text,
  _event_type text,
  _title text,
  _body text,
  _action_label text DEFAULT NULL,
  _action_url text DEFAULT NULL,
  _payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  RETURN public.create_user_notification(
    _user_id,
    _clinic_id,
    _user_id,
    _category,
    _event_type,
    _title,
    _body,
    _action_label,
    _action_url,
    _payload,
    NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_current_user_notification_preferences()
RETURNS TABLE (
  sound_mode text,
  sound_key text,
  notify_security boolean,
  notify_clinic_access boolean,
  notify_patient_saved boolean,
  notify_session_activity boolean,
  notify_event_reminders boolean,
  notify_system boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  PERFORM public.ensure_notification_preferences(_user_id);

  RETURN QUERY
  SELECT
    notification_preferences.sound_mode,
    notification_preferences.sound_key,
    notification_preferences.notify_security,
    notification_preferences.notify_clinic_access,
    notification_preferences.notify_patient_saved,
    notification_preferences.notify_session_activity,
    notification_preferences.notify_event_reminders,
    notification_preferences.notify_system
  FROM public.notification_preferences
  WHERE user_id = _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_current_user_notification_preferences(
  _sound_mode text DEFAULT NULL,
  _sound_key text DEFAULT NULL,
  _notify_security boolean DEFAULT NULL,
  _notify_clinic_access boolean DEFAULT NULL,
  _notify_patient_saved boolean DEFAULT NULL,
  _notify_session_activity boolean DEFAULT NULL,
  _notify_event_reminders boolean DEFAULT NULL,
  _notify_system boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  PERFORM public.ensure_notification_preferences(_user_id);

  UPDATE public.notification_preferences
  SET
    sound_mode = COALESCE(_sound_mode, sound_mode),
    sound_key = COALESCE(_sound_key, sound_key),
    notify_security = COALESCE(_notify_security, notify_security),
    notify_clinic_access = COALESCE(_notify_clinic_access, notify_clinic_access),
    notify_patient_saved = COALESCE(_notify_patient_saved, notify_patient_saved),
    notify_session_activity = COALESCE(_notify_session_activity, notify_session_activity),
    notify_event_reminders = COALESCE(_notify_event_reminders, notify_event_reminders),
    notify_system = COALESCE(_notify_system, notify_system)
  WHERE user_id = _user_id;

  RETURN jsonb_build_object('status', 'updated');
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_current_user_notification(_notification_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  DELETE FROM public.app_notifications
  WHERE id = _notification_id
    AND user_id = _user_id;

  RETURN jsonb_build_object('deleted', FOUND);
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_current_user_notifications()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  DELETE FROM public.app_notifications
  WHERE user_id = _user_id;

  RETURN jsonb_build_object('status', 'cleared');
END;
$$;

DROP FUNCTION IF EXISTS public.list_current_user_notifications();

CREATE OR REPLACE FUNCTION public.list_current_user_notifications()
RETURNS TABLE (
  notification_id uuid,
  created_at timestamptz,
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
  read_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  PERFORM public.ensure_notification_preferences(_user_id);

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
$$;

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
  _title text := 'Evento de segurança';
  _body text := 'Um evento de segurança foi registrado na sua conta.';
BEGIN
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
    IF _event_type = 'clinic_access_removed' THEN
      _title := 'Acesso removido';
      _body := 'Seu acesso a uma clínica foi removido ou encerrado.';
    ELSIF _event_type = 'clinic_member_left' THEN
      _title := 'Acesso encerrado';
      _body := 'Você saiu de uma clínica.';
    ELSIF _event_type = 'subaccount_status_changed' THEN
      _title := 'Status de acesso alterado';
      _body := 'O status do seu acesso operacional foi alterado.';
    ELSIF _event_type = 'subaccount_role_changed' THEN
      _title := 'Papel operacional alterado';
      _body := 'Seu papel operacional em uma clínica foi alterado.';
    ELSIF _event_type = 'password_changed' THEN
      _title := 'Senha alterada';
      _body := 'Sua senha foi alterada.';
    ELSIF _event_type IN ('other_sessions_ended', 'session_force_signed_out') THEN
      _title := 'Sessões encerradas';
      _body := 'Uma ou mais sessões da sua conta foram encerradas.';
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

INSERT INTO public.app_notifications (
  user_id,
  clinic_id,
  actor_user_id,
  category,
  event_type,
  title,
  body,
  payload,
  source_event_id,
  created_at
)
SELECT
  security_events.target_user_id,
  security_events.clinic_id,
  security_events.actor_user_id,
  'security',
  security_events.event_type,
  CASE security_events.event_type
    WHEN 'clinic_access_removed' THEN 'Acesso removido'
    WHEN 'clinic_member_left' THEN 'Acesso encerrado'
    WHEN 'subaccount_status_changed' THEN 'Status de acesso alterado'
    WHEN 'subaccount_role_changed' THEN 'Papel operacional alterado'
    WHEN 'password_changed' THEN 'Senha alterada'
    ELSE 'Evento de segurança'
  END,
  CASE security_events.event_type
    WHEN 'clinic_access_removed' THEN 'Seu acesso a uma clínica foi removido ou encerrado.'
    WHEN 'clinic_member_left' THEN 'Você saiu de uma clínica.'
    WHEN 'subaccount_status_changed' THEN 'O status do seu acesso operacional foi alterado.'
    WHEN 'subaccount_role_changed' THEN 'Seu papel operacional em uma clínica foi alterado.'
    WHEN 'password_changed' THEN 'Sua senha foi alterada.'
    ELSE 'Um evento de segurança foi registrado na sua conta.'
  END,
  security_events.payload,
  security_events.id,
  security_events.created_at
FROM public.security_events
WHERE security_events.target_user_id IS NOT NULL
  AND security_events.visibility_scope IN ('self', 'admin')
ON CONFLICT (source_event_id)
WHERE source_event_id IS NOT NULL
DO NOTHING;

CREATE OR REPLACE FUNCTION public.notify_session_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _clinic_route_key text;
  _patient_name text;
  _actor_name text;
  _recipient record;
BEGIN
  IF NEW.clinic_id IS NULL OR NEW.user_id IS NULL OR NEW.status = 'rascunho' THEN
    RETURN NEW;
  END IF;

  SELECT route_key INTO _clinic_route_key
  FROM public.clinics
  WHERE id = NEW.clinic_id;

  SELECT name INTO _patient_name
  FROM public.patients
  WHERE id = NEW.patient_id;

  SELECT full_name INTO _actor_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  FOR _recipient IN
    SELECT clinic_memberships.user_id
    FROM public.clinic_memberships
    WHERE clinic_memberships.clinic_id = NEW.clinic_id
      AND clinic_memberships.is_active = true
      AND clinic_memberships.membership_status = 'active'
      AND clinic_memberships.user_id <> NEW.user_id
  LOOP
    PERFORM public.create_user_notification(
      _recipient.user_id,
      NEW.clinic_id,
      NEW.user_id,
      'session',
      'session_created',
      'Atendimento registrado',
      COALESCE(_actor_name, 'Um usuário') || ' registrou um atendimento' ||
        CASE WHEN _patient_name IS NOT NULL THEN ' de ' || _patient_name ELSE '' END || '.',
      'Abrir atendimento',
      CASE
        WHEN _clinic_route_key IS NULL THEN NULL
        ELSE '/clinica/' || _clinic_route_key || '/pacientes/' || NEW.patient_id::text || '/sessao/' || NEW.id::text
      END,
      jsonb_build_object('session_id', NEW.id, 'patient_id', NEW.patient_id),
      NULL
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_session_created_after_insert ON public.sessions;
CREATE TRIGGER notify_session_created_after_insert
AFTER INSERT ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.notify_session_created();

CREATE OR REPLACE FUNCTION public.notify_clinic_access_session_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_name text;
  _recipient record;
BEGIN
  IF NEW.clinic_id IS NULL OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO _actor_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  FOR _recipient IN
    SELECT clinic_memberships.user_id
    FROM public.clinic_memberships
    WHERE clinic_memberships.clinic_id = NEW.clinic_id
      AND clinic_memberships.is_active = true
      AND clinic_memberships.membership_status = 'active'
      AND clinic_memberships.user_id <> NEW.user_id
      AND (
        clinic_memberships.account_role = 'account_owner'
        OR clinic_memberships.operational_role IN ('owner', 'admin')
      )
  LOOP
    PERFORM public.create_user_notification(
      _recipient.user_id,
      NEW.clinic_id,
      NEW.user_id,
      'clinic_access',
      'clinic_user_accessed',
      'Usuário acessou a clínica',
      COALESCE(_actor_name, 'Um usuário') || ' acessou a clínica.',
      NULL,
      NULL,
      jsonb_build_object('security_session_id', NEW.id, 'device_label', NEW.device_label),
      NULL
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_clinic_access_session_after_insert ON public.user_security_sessions;
CREATE TRIGGER notify_clinic_access_session_after_insert
AFTER INSERT ON public.user_security_sessions
FOR EACH ROW
EXECUTE FUNCTION public.notify_clinic_access_session_created();

CREATE OR REPLACE FUNCTION public.create_due_agenda_reminder_notifications(_lookahead interval DEFAULT interval '30 minutes')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event record;
  _created_count integer := 0;
  _notification_id uuid;
BEGIN
  FOR _event IN
    SELECT
      agenda_events.id,
      agenda_events.clinic_id,
      agenda_events.user_id,
      agenda_events.patient_id,
      agenda_events.title,
      agenda_events.scheduled_for,
      clinics.route_key,
      patients.name AS patient_name
    FROM public.agenda_events
    LEFT JOIN public.clinics ON clinics.id = agenda_events.clinic_id
    LEFT JOIN public.patients ON patients.id = agenda_events.patient_id
    WHERE agenda_events.status = 'agendado'
      AND agenda_events.scheduled_for > now()
      AND agenda_events.scheduled_for <= now() + _lookahead
  LOOP
    SELECT public.create_user_notification(
      _event.user_id,
      _event.clinic_id,
      NULL,
      'reminder',
      'agenda_event_due',
      'Evento se aproximando',
      COALESCE(_event.title, 'Evento') || ' está próximo do horário agendado.',
      'Abrir agenda',
      CASE
        WHEN _event.route_key IS NULL THEN NULL
        ELSE '/clinica/' || _event.route_key
      END,
      jsonb_build_object(
        'agenda_event_id', _event.id,
        'patient_id', _event.patient_id,
        'scheduled_for', _event.scheduled_for,
        'patient_name', _event.patient_name
      ),
      _event.id
    )
    INTO _notification_id;

    IF _notification_id IS NOT NULL THEN
      _created_count := _created_count + 1;
    END IF;
  END LOOP;

  RETURN _created_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_notification_preferences(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_user_notification(uuid, uuid, uuid, text, text, text, text, text, text, jsonb, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_current_user_notification(uuid, text, text, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_current_user_notifications() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_current_user_notification_preferences() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_current_user_notification_preferences(text, text, boolean, boolean, boolean, boolean, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_current_user_notification(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_current_user_notifications() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_due_agenda_reminder_notifications(interval) TO service_role;
