UPDATE auth.users
SET
  confirmation_token = COALESCE(confirmation_token, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  recovery_token = COALESCE(recovery_token, '')
WHERE confirmation_token IS NULL
   OR email_change IS NULL
   OR email_change_token_new IS NULL
   OR recovery_token IS NULL;

INSERT INTO public.user_roles (user_id, role)
SELECT clinic_memberships.user_id, 'user'::public.app_role
FROM public.clinic_memberships
LEFT JOIN public.user_roles
  ON user_roles.user_id = clinic_memberships.user_id
 AND user_roles.role = 'user'
WHERE clinic_memberships.account_role IS NULL
  AND user_roles.id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_security_settings (user_id, clinic_id)
SELECT clinic_memberships.user_id, clinic_memberships.clinic_id
FROM public.clinic_memberships
LEFT JOIN public.user_security_settings
  ON user_security_settings.user_id = clinic_memberships.user_id
WHERE clinic_memberships.account_role IS NULL
  AND user_security_settings.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

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

  IF _operational_role NOT IN ('admin', 'professional', 'assistant', 'estagiario') THEN
    RAISE EXCEPTION 'O papel operacional da subconta deve ser admin, professional, assistant ou estagiario.';
  END IF;

  SELECT subscription_plan
  INTO _subscription_plan
  FROM public.clinics
  WHERE id = _resolved_clinic_id;

  IF _subscription_plan IS DISTINCT FROM 'clinic' THEN
    RAISE EXCEPTION 'Apenas clinicas com plano clinic podem criar subcontas.';
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
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
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
    invited_by,
    is_active
  )
  VALUES (
    _resolved_clinic_id,
    _new_user_id,
    NULL,
    _operational_role,
    'active',
    _requester_id,
    true
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
    'clinic_id', _resolved_clinic_id,
    'email', _normalized_email,
    'user_id', _new_user_id
  );
END;
$$;
