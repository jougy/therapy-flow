ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_password_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS password_temporary boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.user_security_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinics (id) ON DELETE SET NULL,
  alert_access_change boolean NOT NULL DEFAULT false,
  alert_new_login boolean NOT NULL DEFAULT true,
  alert_other_sessions_ended boolean NOT NULL DEFAULT true,
  alert_password_changed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_security_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinics (id) ON DELETE SET NULL,
  session_key text NOT NULL UNIQUE,
  browser text,
  platform text,
  device_label text,
  user_agent text,
  signed_in_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics (id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  event_type text NOT NULL,
  visibility_scope text NOT NULL DEFAULT 'self' CHECK (visibility_scope IN ('self', 'admin')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_security_sessions_user_id ON public.user_security_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_security_sessions_last_seen_at ON public.user_security_sessions (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_target_user_id ON public.security_events (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_clinic_id ON public.security_events (clinic_id, created_at DESC);

ALTER TABLE public.user_security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_security_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can read own security settings" ON public.user_security_settings;
CREATE POLICY "users can read own security settings"
ON public.user_security_settings
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users can read own security sessions" ON public.user_security_sessions;
CREATE POLICY "users can read own security sessions"
ON public.user_security_sessions
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users can read own security events" ON public.security_events;
CREATE POLICY "users can read own security events"
ON public.security_events
FOR SELECT
USING (
  actor_user_id = auth.uid()
  OR target_user_id = auth.uid()
);

DROP POLICY IF EXISTS "admins can read clinic security events" ON public.security_events;
CREATE POLICY "admins can read clinic security events"
ON public.security_events
FOR SELECT
USING (
  visibility_scope = 'admin'
  AND clinic_id = public.get_user_clinic_id(auth.uid())
  AND public.current_user_can('subaccounts.manage', clinic_id)
);

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

  RETURN _event_id;
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
  _existing_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  IF NULLIF(trim(coalesce(_session_key, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Sessao invalida.';
  END IF;

  SELECT id
  INTO _existing_id
  FROM public.user_security_sessions
  WHERE user_id = _user_id
    AND session_key = _session_key;

  IF _existing_id IS NULL THEN
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
    RETURNING id INTO _existing_id;

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
  ELSE
    UPDATE public.user_security_sessions
    SET
      browser = COALESCE(NULLIF(trim(_browser), ''), browser),
      platform = COALESCE(NULLIF(trim(_platform), ''), platform),
      device_label = COALESCE(NULLIF(trim(_device_label), ''), device_label),
      user_agent = COALESCE(NULLIF(trim(_user_agent), ''), user_agent),
      ended_at = NULL,
      last_seen_at = now(),
      updated_at = now()
    WHERE id = _existing_id;
  END IF;

  RETURN jsonb_build_object(
    'session_id', _existing_id,
    'user_id', _user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_current_user_security_settings(
  _alert_password_changed boolean DEFAULT NULL,
  _alert_new_login boolean DEFAULT NULL,
  _alert_other_sessions_ended boolean DEFAULT NULL,
  _alert_access_change boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _clinic_id uuid := public.get_user_clinic_id(_user_id);
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  INSERT INTO public.user_security_settings (
    user_id,
    clinic_id,
    alert_access_change,
    alert_new_login,
    alert_other_sessions_ended,
    alert_password_changed
  )
  VALUES (
    _user_id,
    _clinic_id,
    COALESCE(_alert_access_change, false),
    COALESCE(_alert_new_login, true),
    COALESCE(_alert_other_sessions_ended, true),
    COALESCE(_alert_password_changed, true)
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    clinic_id = EXCLUDED.clinic_id,
    alert_access_change = COALESCE(_alert_access_change, public.user_security_settings.alert_access_change),
    alert_new_login = COALESCE(_alert_new_login, public.user_security_settings.alert_new_login),
    alert_other_sessions_ended = COALESCE(_alert_other_sessions_ended, public.user_security_settings.alert_other_sessions_ended),
    alert_password_changed = COALESCE(_alert_password_changed, public.user_security_settings.alert_password_changed),
    updated_at = now();

  PERFORM public.log_security_event(
    _clinic_id,
    _user_id,
    _user_id,
    'security_alerts_updated',
    'self',
    jsonb_build_object(
      'alert_access_change', _alert_access_change,
      'alert_new_login', _alert_new_login,
      'alert_other_sessions_ended', _alert_other_sessions_ended,
      'alert_password_changed', _alert_password_changed
    )
  );

  RETURN jsonb_build_object('user_id', _user_id);
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

CREATE OR REPLACE FUNCTION public.create_clinic_subaccount(
  _email text,
  _password text,
  _full_name text,
  _operational_role public.operational_role_type DEFAULT 'professional',
  _job_title text DEFAULT NULL,
  _specialty text DEFAULT NULL,
  _clinic_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _requester_id uuid := auth.uid();
  _resolved_clinic_id uuid := COALESCE(_clinic_id, public.get_user_clinic_id(_requester_id));
  _subscription_plan public.subscription_plan;
  _subaccount_limit integer;
  _occupied_subaccounts integer;
  _new_user_id uuid := gen_random_uuid();
  _normalized_email text := lower(trim(_email));
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  IF _resolved_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Clinica nao encontrada para o usuario atual.';
  END IF;

  IF NOT public.current_user_can('subaccounts.manage', _resolved_clinic_id) THEN
    RAISE EXCEPTION 'Sem permissao para criar subcontas nesta clinica.';
  END IF;

  IF _normalized_email = '' OR position('@' IN _normalized_email) = 0 THEN
    RAISE EXCEPTION 'Informe um e-mail valido para a subconta.';
  END IF;

  IF coalesce(length(_password), 0) < 6 THEN
    RAISE EXCEPTION 'A senha da subconta precisa ter pelo menos 6 caracteres.';
  END IF;

  IF coalesce(length(trim(_full_name)), 0) = 0 THEN
    RAISE EXCEPTION 'Informe o nome completo da subconta.';
  END IF;

  IF _operational_role NOT IN ('admin', 'professional', 'assistant') THEN
    RAISE EXCEPTION 'O papel operacional da subconta deve ser admin, professional ou assistant.';
  END IF;

  SELECT subscription_plan, subaccount_limit
  INTO _subscription_plan, _subaccount_limit
  FROM public.clinics
  WHERE id = _resolved_clinic_id;

  IF _subscription_plan IS DISTINCT FROM 'clinic' THEN
    RAISE EXCEPTION 'Apenas clinicas com plano clinic podem criar subcontas.';
  END IF;

  SELECT count(*)
  INTO _occupied_subaccounts
  FROM public.clinic_memberships
  WHERE clinic_id = _resolved_clinic_id
    AND account_role IS NULL
    AND is_active = true
    AND membership_status IN ('active', 'invited');

  IF _occupied_subaccounts >= _subaccount_limit THEN
    RAISE EXCEPTION 'O limite atual de subcontas desta clinica ja foi atingido.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM auth.users
    WHERE lower(email) = _normalized_email
  ) THEN
    RAISE EXCEPTION 'Ja existe uma conta cadastrada com este e-mail.';
  END IF;

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    _new_user_id,
    'authenticated',
    'authenticated',
    _normalized_email,
    extensions.crypt(_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', trim(_full_name)),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    _new_user_id,
    jsonb_build_object('sub', _new_user_id::text, 'email', _normalized_email),
    'email',
    _normalized_email,
    now(),
    now(),
    now()
  );

  INSERT INTO public.profiles (
    id,
    clinic_id,
    email,
    full_name,
    job_title,
    specialty,
    password_temporary
  )
  VALUES (
    _new_user_id,
    _resolved_clinic_id,
    _normalized_email,
    trim(_full_name),
    NULLIF(trim(_job_title), ''),
    NULLIF(trim(_specialty), ''),
    true
  );

  INSERT INTO public.user_security_settings (user_id, clinic_id)
  VALUES (_new_user_id, _resolved_clinic_id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.clinic_memberships (
    clinic_id,
    user_id,
    account_role,
    operational_role,
    membership_status,
    is_active,
    invited_by
  )
  VALUES (
    _resolved_clinic_id,
    _new_user_id,
    NULL,
    _operational_role,
    'active',
    true,
    _requester_id
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_new_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  PERFORM public.log_security_event(
    _resolved_clinic_id,
    _requester_id,
    _new_user_id,
    'subaccount_created',
    'admin',
    jsonb_build_object(
      'email', _normalized_email,
      'operational_role', _operational_role
    )
  );

  RETURN jsonb_build_object(
    'user_id', _new_user_id,
    'email', _normalized_email,
    'operational_role', _operational_role,
    'clinic_id', _resolved_clinic_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_current_profile(
  _full_name text DEFAULT NULL,
  _social_name text DEFAULT NULL,
  _email text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _birth_date date DEFAULT NULL,
  _cpf text DEFAULT NULL,
  _professional_license text DEFAULT NULL,
  _specialty text DEFAULT NULL,
  _job_title text DEFAULT NULL,
  _bio text DEFAULT NULL,
  _working_hours text DEFAULT NULL,
  _address jsonb DEFAULT NULL,
  _new_password text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _normalized_email text;
  _normalized_cpf text;
  _current_profile public.profiles%ROWTYPE;
  _normalized_password text := NULLIF(coalesce(_new_password, ''), '');
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  SELECT *
  INTO _current_profile
  FROM public.profiles
  WHERE id = _user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil nao encontrado.';
  END IF;

  IF _full_name IS NOT NULL AND NULLIF(trim(_full_name), '') IS NULL THEN
    RAISE EXCEPTION 'O nome nao pode ficar vazio.';
  END IF;

  _normalized_email := NULLIF(lower(trim(coalesce(_email, ''))), '');

  IF _normalized_email IS NOT NULL AND EXISTS (
    SELECT 1
    FROM auth.users
    WHERE lower(email) = _normalized_email
      AND id <> _user_id
  ) THEN
    RAISE EXCEPTION 'Ja existe uma conta cadastrada com este e-mail.';
  END IF;

  IF _normalized_password IS NOT NULL AND length(_normalized_password) < 6 THEN
    RAISE EXCEPTION 'A nova senha precisa ter pelo menos 6 caracteres.';
  END IF;

  _normalized_cpf := CASE
    WHEN _cpf IS NULL THEN NULL
    ELSE NULLIF(regexp_replace(_cpf, '\D', '', 'g'), '')
  END;

  IF _job_title IS NOT NULL AND NULLIF(trim(_job_title), '') IS DISTINCT FROM _current_profile.job_title THEN
    RAISE EXCEPTION 'Cargo e gerenciado apenas pela administracao da clinica.';
  END IF;

  IF _specialty IS NOT NULL AND NULLIF(trim(_specialty), '') IS DISTINCT FROM _current_profile.specialty THEN
    RAISE EXCEPTION 'Especialidade e gerenciada apenas pela administracao da clinica.';
  END IF;

  IF _working_hours IS NOT NULL AND NULLIF(trim(_working_hours), '') IS DISTINCT FROM _current_profile.working_hours THEN
    RAISE EXCEPTION 'Horario de trabalho e gerenciado apenas pela administracao da clinica.';
  END IF;

  IF _bio IS NOT NULL AND NULLIF(trim(_bio), '') IS DISTINCT FROM _current_profile.bio THEN
    RAISE EXCEPTION 'Bio nao esta disponivel para autoedicao.';
  END IF;

  IF _full_name IS NOT NULL
    AND NULLIF(trim(_current_profile.full_name), '') IS NOT NULL
    AND NULLIF(trim(_full_name), '') IS DISTINCT FROM _current_profile.full_name THEN
    RAISE EXCEPTION 'Nome completo so pode ser preenchido uma vez; depois disso, apenas a administracao pode alterar.';
  END IF;

  IF _social_name IS NOT NULL
    AND NULLIF(trim(_current_profile.social_name), '') IS NOT NULL
    AND NULLIF(trim(_social_name), '') IS DISTINCT FROM _current_profile.social_name THEN
    RAISE EXCEPTION 'Nome social so pode ser preenchido uma vez; depois disso, apenas a administracao pode alterar.';
  END IF;

  IF _phone IS NOT NULL
    AND NULLIF(trim(_current_profile.phone), '') IS NOT NULL
    AND NULLIF(trim(_phone), '') IS DISTINCT FROM _current_profile.phone THEN
    RAISE EXCEPTION 'Telefone so pode ser preenchido uma vez; depois disso, apenas a administracao pode alterar.';
  END IF;

  IF _birth_date IS NOT NULL
    AND _current_profile.birth_date IS NOT NULL
    AND _birth_date IS DISTINCT FROM _current_profile.birth_date THEN
    RAISE EXCEPTION 'Data de nascimento so pode ser preenchida uma vez; depois disso, apenas a administracao pode alterar.';
  END IF;

  IF _normalized_cpf IS NOT NULL
    AND NULLIF(_current_profile.cpf, '') IS NOT NULL
    AND _normalized_cpf IS DISTINCT FROM _current_profile.cpf THEN
    RAISE EXCEPTION 'CPF so pode ser preenchido uma vez; depois disso, apenas a administracao pode alterar.';
  END IF;

  IF _professional_license IS NOT NULL
    AND NULLIF(trim(_current_profile.professional_license), '') IS NOT NULL
    AND NULLIF(trim(_professional_license), '') IS DISTINCT FROM _current_profile.professional_license THEN
    RAISE EXCEPTION 'Conselho regional so pode ser preenchido uma vez; depois disso, apenas a administracao pode alterar.';
  END IF;

  IF _address IS NOT NULL
    AND COALESCE(_current_profile.address, '{}'::jsonb) <> '{}'::jsonb
    AND _address IS DISTINCT FROM _current_profile.address THEN
    RAISE EXCEPTION 'Endereco so pode ser preenchido uma vez; depois disso, apenas a administracao pode alterar.';
  END IF;

  UPDATE auth.users
  SET
    email = COALESCE(_normalized_email, email),
    encrypted_password = CASE
      WHEN _normalized_password IS NOT NULL THEN extensions.crypt(_normalized_password, extensions.gen_salt('bf'))
      ELSE encrypted_password
    END,
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
      || CASE WHEN _full_name IS NOT NULL THEN jsonb_build_object('full_name', trim(_full_name)) ELSE '{}'::jsonb END
      || CASE WHEN _social_name IS NOT NULL THEN jsonb_build_object('social_name', NULLIF(trim(_social_name), '')) ELSE '{}'::jsonb END,
    updated_at = now()
  WHERE id = _user_id;

  IF _normalized_email IS NOT NULL THEN
    UPDATE auth.identities
    SET
      provider_id = _normalized_email,
      identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('email', _normalized_email),
      updated_at = now()
    WHERE user_id = _user_id
      AND provider = 'email';
  END IF;

  UPDATE public.profiles
  SET
    full_name = COALESCE(NULLIF(trim(_full_name), ''), full_name),
    social_name = CASE WHEN _social_name IS NULL THEN social_name ELSE NULLIF(trim(_social_name), '') END,
    email = COALESCE(_normalized_email, email),
    phone = CASE WHEN _phone IS NULL THEN phone ELSE NULLIF(trim(_phone), '') END,
    birth_date = COALESCE(_birth_date, birth_date),
    cpf = COALESCE(_normalized_cpf, cpf),
    professional_license = CASE WHEN _professional_license IS NULL THEN professional_license ELSE NULLIF(trim(_professional_license), '') END,
    address = COALESCE(_address, address),
    last_password_changed_at = CASE
      WHEN _normalized_password IS NOT NULL THEN now()
      ELSE last_password_changed_at
    END,
    password_temporary = CASE
      WHEN _normalized_password IS NOT NULL THEN false
      ELSE password_temporary
    END,
    updated_at = now()
  WHERE id = _user_id;

  IF _normalized_password IS NOT NULL THEN
    PERFORM public.log_security_event(
      _current_profile.clinic_id,
      _user_id,
      _user_id,
      'password_changed',
      'self',
      jsonb_build_object('by', 'self')
    );
  END IF;

  RETURN jsonb_build_object('user_id', _user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_clinic_subaccount_profile(
  _membership_id uuid,
  _full_name text DEFAULT NULL,
  _social_name text DEFAULT NULL,
  _email text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _birth_date date DEFAULT NULL,
  _cpf text DEFAULT NULL,
  _professional_license text DEFAULT NULL,
  _specialty text DEFAULT NULL,
  _job_title text DEFAULT NULL,
  _bio text DEFAULT NULL,
  _working_hours text DEFAULT NULL,
  _address jsonb DEFAULT NULL,
  _operational_role public.operational_role_type DEFAULT NULL,
  _membership_status public.membership_status_type DEFAULT NULL,
  _new_password text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _requester_id uuid := auth.uid();
  _target_membership public.clinic_memberships%ROWTYPE;
  _normalized_email text;
  _normalized_cpf text;
  _normalized_password text := NULLIF(coalesce(_new_password, ''), '');
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  SELECT *
  INTO _target_membership
  FROM public.clinic_memberships
  WHERE id = _membership_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subconta nao encontrada.';
  END IF;

  IF _target_membership.account_role = 'account_owner' THEN
    RAISE EXCEPTION 'A conta principal nao pode ser editada por este fluxo.';
  END IF;

  IF NOT public.current_user_can('subaccounts.manage', _target_membership.clinic_id) THEN
    RAISE EXCEPTION 'Sem permissao para editar subcontas nesta clinica.';
  END IF;

  IF _operational_role IS NOT NULL AND NOT public.current_user_can('subaccounts_roles.manage', _target_membership.clinic_id) THEN
    RAISE EXCEPTION 'Sem permissao para alterar a hierarquia desta subconta.';
  END IF;

  IF _operational_role = 'owner' THEN
    RAISE EXCEPTION 'O papel owner fica reservado para a conta principal.';
  END IF;

  _normalized_email := NULLIF(lower(trim(coalesce(_email, ''))), '');

  IF _normalized_email IS NOT NULL AND EXISTS (
    SELECT 1
    FROM auth.users
    WHERE lower(email) = _normalized_email
      AND id <> _target_membership.user_id
  ) THEN
    RAISE EXCEPTION 'Ja existe uma conta cadastrada com este e-mail.';
  END IF;

  IF _normalized_password IS NOT NULL AND length(_normalized_password) < 6 THEN
    RAISE EXCEPTION 'A nova senha precisa ter pelo menos 6 caracteres.';
  END IF;

  IF _full_name IS NOT NULL AND NULLIF(trim(_full_name), '') IS NULL THEN
    RAISE EXCEPTION 'O nome da subconta nao pode ficar vazio.';
  END IF;

  IF _membership_status IS NOT NULL AND _membership_status = 'invited' THEN
    RAISE EXCEPTION 'Este fluxo usa subcontas ativas; status convidado nao esta disponivel aqui.';
  END IF;

  _normalized_cpf := CASE
    WHEN _cpf IS NULL THEN NULL
    ELSE NULLIF(regexp_replace(_cpf, '\D', '', 'g'), '')
  END;

  UPDATE auth.users
  SET
    email = COALESCE(_normalized_email, email),
    encrypted_password = CASE
      WHEN _normalized_password IS NOT NULL THEN extensions.crypt(_normalized_password, extensions.gen_salt('bf'))
      ELSE encrypted_password
    END,
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
      || CASE WHEN _full_name IS NOT NULL THEN jsonb_build_object('full_name', trim(_full_name)) ELSE '{}'::jsonb END
      || CASE WHEN _social_name IS NOT NULL THEN jsonb_build_object('social_name', NULLIF(trim(_social_name), '')) ELSE '{}'::jsonb END,
    updated_at = now()
  WHERE id = _target_membership.user_id;

  IF _normalized_email IS NOT NULL THEN
    UPDATE auth.identities
    SET
      provider_id = _normalized_email,
      identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('email', _normalized_email),
      updated_at = now()
    WHERE user_id = _target_membership.user_id
      AND provider = 'email';
  END IF;

  UPDATE public.profiles
  SET
    full_name = COALESCE(NULLIF(trim(_full_name), ''), full_name),
    social_name = CASE WHEN _social_name IS NULL THEN social_name ELSE NULLIF(trim(_social_name), '') END,
    email = COALESCE(_normalized_email, email),
    phone = CASE WHEN _phone IS NULL THEN phone ELSE NULLIF(trim(_phone), '') END,
    birth_date = COALESCE(_birth_date, birth_date),
    cpf = COALESCE(_normalized_cpf, cpf),
    professional_license = CASE WHEN _professional_license IS NULL THEN professional_license ELSE NULLIF(trim(_professional_license), '') END,
    specialty = CASE WHEN _specialty IS NULL THEN specialty ELSE NULLIF(trim(_specialty), '') END,
    job_title = CASE WHEN _job_title IS NULL THEN job_title ELSE NULLIF(trim(_job_title), '') END,
    bio = CASE WHEN _bio IS NULL THEN bio ELSE NULLIF(trim(_bio), '') END,
    working_hours = CASE WHEN _working_hours IS NULL THEN working_hours ELSE NULLIF(trim(_working_hours), '') END,
    address = COALESCE(_address, address),
    last_password_changed_at = CASE
      WHEN _normalized_password IS NOT NULL THEN now()
      ELSE last_password_changed_at
    END,
    password_temporary = CASE
      WHEN _normalized_password IS NOT NULL THEN true
      ELSE password_temporary
    END,
    updated_at = now()
  WHERE id = _target_membership.user_id;

  UPDATE public.clinic_memberships
  SET
    operational_role = COALESCE(_operational_role, operational_role),
    membership_status = COALESCE(_membership_status, membership_status)
  WHERE id = _membership_id;

  IF _normalized_password IS NOT NULL THEN
    PERFORM public.log_security_event(
      _target_membership.clinic_id,
      _requester_id,
      _target_membership.user_id,
      'subaccount_password_reset',
      'admin',
      jsonb_build_object('by', 'admin')
    );
  END IF;

  IF _operational_role IS NOT NULL AND _operational_role IS DISTINCT FROM _target_membership.operational_role THEN
    PERFORM public.log_security_event(
      _target_membership.clinic_id,
      _requester_id,
      _target_membership.user_id,
      'subaccount_role_changed',
      'admin',
      jsonb_build_object(
        'from', _target_membership.operational_role,
        'to', _operational_role
      )
    );
  END IF;

  IF _membership_status IS NOT NULL AND _membership_status IS DISTINCT FROM _target_membership.membership_status THEN
    PERFORM public.log_security_event(
      _target_membership.clinic_id,
      _requester_id,
      _target_membership.user_id,
      'subaccount_status_changed',
      'admin',
      jsonb_build_object(
        'from', _target_membership.membership_status,
        'to', _membership_status
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'membership_id', _membership_id,
    'user_id', _target_membership.user_id,
    'clinic_id', _target_membership.clinic_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_security_event(uuid, uuid, uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_security_event(uuid, uuid, uuid, text, text, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.register_current_security_session(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_current_security_session(text, text, text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.upsert_current_user_security_settings(boolean, boolean, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_current_user_security_settings(boolean, boolean, boolean, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.end_other_security_sessions(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.end_other_security_sessions(text) TO authenticated;
