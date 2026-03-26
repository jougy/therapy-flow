CREATE OR REPLACE FUNCTION public.enforce_clinic_membership_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.account_role = 'account_owner' AND NEW.operational_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'A conta compradora precisa manter o papel operacional owner.';
  END IF;

  IF NEW.account_role IS NULL AND NEW.operational_role = 'owner' THEN
    RAISE EXCEPTION 'O papel operacional owner fica reservado para a conta principal.';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.account_role = 'account_owner' THEN
    IF NEW.account_role IS DISTINCT FROM OLD.account_role
      OR NEW.operational_role IS DISTINCT FROM OLD.operational_role
      OR NEW.membership_status IS DISTINCT FROM OLD.membership_status
      OR NEW.is_active IS DISTINCT FROM OLD.is_active
      OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id
      OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'A conta principal nao pode ser alterada por este fluxo.';
    END IF;
  END IF;

  IF NEW.account_role = 'account_owner' THEN
    NEW.membership_status := 'active';
    NEW.is_active := true;
    NEW.ended_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.membership_status IN ('active', 'invited') THEN
    NEW.is_active := true;
    NEW.ended_at := NULL;
  ELSE
    NEW.is_active := false;
    NEW.ended_at := COALESCE(NEW.ended_at, now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_clinic_membership_integrity ON public.clinic_memberships;
CREATE TRIGGER enforce_clinic_membership_integrity
BEFORE INSERT OR UPDATE ON public.clinic_memberships
FOR EACH ROW
EXECUTE FUNCTION public.enforce_clinic_membership_integrity();

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
    specialty
  )
  VALUES (
    _new_user_id,
    _resolved_clinic_id,
    _normalized_email,
    trim(_full_name),
    NULLIF(trim(_job_title), ''),
    NULLIF(trim(_specialty), '')
  );

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

  RETURN jsonb_build_object(
    'user_id', _new_user_id,
    'email', _normalized_email,
    'operational_role', _operational_role,
    'clinic_id', _resolved_clinic_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_clinic_subaccount(text, text, text, public.operational_role_type, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_clinic_subaccount(text, text, text, public.operational_role_type, text, text, uuid) TO authenticated;
