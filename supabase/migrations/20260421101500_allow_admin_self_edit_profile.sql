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
  _has_profile_admin_access boolean := false;
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

  SELECT EXISTS (
    SELECT 1
    FROM public.clinic_memberships
    WHERE user_id = _user_id
      AND clinic_id = _current_profile.clinic_id
      AND ended_at IS NULL
      AND is_active = true
      AND membership_status = 'active'
      AND (
        account_role = 'account_owner'
        OR operational_role IN ('owner', 'admin')
      )
  )
  INTO _has_profile_admin_access;

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

  IF NOT _has_profile_admin_access
    AND _full_name IS NOT NULL
    AND NULLIF(trim(_current_profile.full_name), '') IS NOT NULL
    AND NULLIF(trim(_full_name), '') IS DISTINCT FROM _current_profile.full_name THEN
    RAISE EXCEPTION 'Nome completo so pode ser preenchido uma vez; depois disso, apenas a administracao pode alterar.';
  END IF;

  IF NOT _has_profile_admin_access
    AND _social_name IS NOT NULL
    AND NULLIF(trim(_current_profile.social_name), '') IS NOT NULL
    AND NULLIF(trim(_social_name), '') IS DISTINCT FROM _current_profile.social_name THEN
    RAISE EXCEPTION 'Nome social so pode ser preenchido uma vez; depois disso, apenas a administracao pode alterar.';
  END IF;

  IF NOT _has_profile_admin_access
    AND _phone IS NOT NULL
    AND NULLIF(trim(_current_profile.phone), '') IS NOT NULL
    AND NULLIF(trim(_phone), '') IS DISTINCT FROM _current_profile.phone THEN
    RAISE EXCEPTION 'Telefone so pode ser preenchido uma vez; depois disso, apenas a administracao pode alterar.';
  END IF;

  IF NOT _has_profile_admin_access
    AND _birth_date IS NOT NULL
    AND _current_profile.birth_date IS NOT NULL
    AND _birth_date IS DISTINCT FROM _current_profile.birth_date THEN
    RAISE EXCEPTION 'Data de nascimento so pode ser preenchida uma vez; depois disso, apenas a administracao pode alterar.';
  END IF;

  IF NOT _has_profile_admin_access
    AND _normalized_cpf IS NOT NULL
    AND NULLIF(_current_profile.cpf, '') IS NOT NULL
    AND _normalized_cpf IS DISTINCT FROM _current_profile.cpf THEN
    RAISE EXCEPTION 'CPF so pode ser preenchido uma vez; depois disso, apenas a administracao pode alterar.';
  END IF;

  IF NOT _has_profile_admin_access
    AND _professional_license IS NOT NULL
    AND NULLIF(trim(_current_profile.professional_license), '') IS NOT NULL
    AND NULLIF(trim(_professional_license), '') IS DISTINCT FROM _current_profile.professional_license THEN
    RAISE EXCEPTION 'Conselho regional so pode ser preenchido uma vez; depois disso, apenas a administracao pode alterar.';
  END IF;

  IF NOT _has_profile_admin_access
    AND _address IS NOT NULL
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
