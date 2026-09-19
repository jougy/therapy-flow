-- Migration: 20260919100000_update_password_recovery_and_onboarding_put.sql
-- Descrição:
-- 1. Cria a RPC request_account_recovery_status(_identifier text) para roteamento seguro de recuperação por CPF ou E-mail.
-- 2. Atualiza a RPC handle_personal_signup para permitir atualização/sobrescrita dos dados de perfil (PUT/sobrescrita segura).
-- 3. Cria a RPC complete_unregistered_cpf_profile para completar ou atualizar perfil de usuários convidados / pendentes.
-- 4. Atualiza get_clinic_collaborator_invitation para retornar has_cpf e pending_cpf_completion.

-- ============================================================================
-- 1. RPC de Verificação e Roteamento de Recuperação: request_account_recovery_status
-- ============================================================================
CREATE OR REPLACE FUNCTION public.request_account_recovery_status(_identifier text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _trimmed text := trim(coalesce(_identifier, ''));
  _clean_digits text;
  _user_email text;
  _masked_email text;
  _profile_user_id uuid;
  _profile_cpf text;
  _at_pos int;
  _user_part text;
  _domain_part text;
  _masked_user text;
  _first_dot int;
  _domain_name text;
  _domain_tld text;
  _masked_domain text;
BEGIN
  IF _trimmed = '' THEN
    RETURN jsonb_build_object('status', 'invalid_identifier');
  END IF;

  _clean_digits := regexp_replace(_trimmed, '\D', '', 'g');

  -- Se for numérico ou tiver formato de CPF (ex: 11 dígitos numéricos ou sem @ contendo dígitos)
  IF (position('@' in _trimmed) = 0 AND _clean_digits <> '') THEN
    -- Validação básica de tamanho de CPF (deve ter 11 dígitos)
    IF length(_clean_digits) <> 11 THEN
      RETURN jsonb_build_object('status', 'invalid_cpf');
    END IF;

    -- Busca em public.profiles pelo CPF limpo
    SELECT p.id, p.email, p.cpf
    INTO _profile_user_id, _user_email, _profile_cpf
    FROM public.profiles p
    WHERE regexp_replace(coalesce(p.cpf, ''), '\D', '', 'g') = _clean_digits
    LIMIT 1;

    -- Se não achou em profiles pelo CPF
    IF _profile_user_id IS NULL THEN
      RETURN jsonb_build_object('status', 'cpf_not_found');
    END IF;

    -- Se profiles.email for nulo, busca o e-mail em auth.users
    IF _user_email IS NULL OR _user_email = '' THEN
      SELECT lower(u.email)
      INTO _user_email
      FROM auth.users u
      WHERE u.id = _profile_user_id;
    END IF;

    IF _user_email IS NULL OR _user_email = '' THEN
      RETURN jsonb_build_object('status', 'cpf_not_found');
    END IF;

    _user_email := lower(trim(_user_email));

    -- Formata e ofusca o email (ex: j***y@g***.com)
    _at_pos := position('@' in _user_email);
    IF _at_pos > 1 THEN
      _user_part := substring(_user_email from 1 for _at_pos - 1);
      _domain_part := substring(_user_email from _at_pos + 1);

      IF length(_user_part) <= 2 THEN
        _masked_user := substring(_user_part from 1 for 1) || '***';
      ELSE
        _masked_user := substring(_user_part from 1 for 1) || '***' || substring(_user_part from length(_user_part) for 1);
      END IF;

      _first_dot := position('.' in _domain_part);
      IF _first_dot > 1 THEN
        _domain_name := substring(_domain_part from 1 for _first_dot - 1);
        _domain_tld := substring(_domain_part from _first_dot);
        IF length(_domain_name) <= 2 THEN
          _masked_domain := substring(_domain_name from 1 for 1) || '***' || _domain_tld;
        ELSE
          _masked_domain := substring(_domain_name from 1 for 1) || '***' || substring(_domain_name from length(_domain_name) for 1) || _domain_tld;
        END IF;
      ELSE
        _masked_domain := '***';
      END IF;

      _masked_email := _masked_user || '@' || _masked_domain;
    ELSE
      _masked_email := '***@***.com';
    END IF;

    RETURN jsonb_build_object(
      'status', 'cpf_found',
      'email', _user_email,
      'masked_email', _masked_email
    );
  ELSE
    -- Trata como E-mail
    _user_email := lower(_trimmed);

    -- Busca em auth.users ou public.profiles
    SELECT u.id, u.email
    INTO _profile_user_id, _user_email
    FROM auth.users u
    WHERE lower(u.email) = _user_email
    LIMIT 1;

    IF _profile_user_id IS NULL THEN
      SELECT p.id, p.email
      INTO _profile_user_id, _user_email
      FROM public.profiles p
      WHERE lower(p.email) = _user_email
      LIMIT 1;
    END IF;

    IF _profile_user_id IS NULL THEN
      RETURN jsonb_build_object('status', 'email_not_found');
    END IF;

    -- Busca se profiles tem CPF preenchido com 11 dígitos
    SELECT regexp_replace(coalesce(p.cpf, ''), '\D', '', 'g')
    INTO _profile_cpf
    FROM public.profiles p
    WHERE p.id = _profile_user_id;

    IF _profile_cpf IS NOT NULL AND length(_profile_cpf) = 11 THEN
      RETURN jsonb_build_object(
        'status', 'email_found_with_cpf',
        'email', lower(_user_email)
      );
    ELSE
      RETURN jsonb_build_object(
        'status', 'email_found_without_cpf',
        'email', lower(_user_email)
      );
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.request_account_recovery_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_account_recovery_status(text) TO anon, authenticated, service_role;

-- ============================================================================
-- 2. Atualizar handle_personal_signup para suportar sobrescrita/atualização segura
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_personal_signup(
  _user_id uuid,
  _email text,
  _full_name text DEFAULT NULL,
  _cpf text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _birth_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _normalized_cpf text;
  _clean_name text;
  _clean_phone text;
BEGIN
  _normalized_cpf := NULLIF(regexp_replace(COALESCE(_cpf, ''), '\D', '', 'g'), '');
  _clean_name := NULLIF(trim(COALESCE(_full_name, '')), '');
  _clean_phone := NULLIF(trim(COALESCE(_phone, '')), '');

  INSERT INTO public.profiles (
    id,
    clinic_id,
    email,
    full_name,
    cpf,
    phone,
    birth_date,
    public_code
  )
  VALUES (
    _user_id,
    NULL,
    lower(trim(_email)),
    _clean_name,
    _normalized_cpf,
    _clean_phone,
    _birth_date,
    public.generate_profile_public_code()
  )
  ON CONFLICT (id) DO UPDATE
  SET email = lower(trim(EXCLUDED.email)),
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
      cpf = COALESCE(EXCLUDED.cpf, profiles.cpf),
      phone = COALESCE(EXCLUDED.phone, profiles.phone),
      birth_date = COALESCE(EXCLUDED.birth_date, profiles.birth_date),
      updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN jsonb_build_object(
    'user_id', _user_id,
    'has_clinic', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.handle_personal_signup(uuid, text, text, text, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_personal_signup(uuid, text, text, text, text, date) TO authenticated, anon, service_role;

-- ============================================================================
-- 3. RPC complete_unregistered_cpf_profile
-- Atualiza / sobrescreve com PUT campos full_name, cpf, phone, birth_date
-- ============================================================================
CREATE OR REPLACE FUNCTION public.complete_unregistered_cpf_profile(
  _full_name text,
  _cpf text,
  _phone text DEFAULT NULL,
  _birth_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _normalized_cpf text;
  _clean_name text;
  _clean_phone text;
  _existing_cpf_user_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  _normalized_cpf := NULLIF(regexp_replace(COALESCE(_cpf, ''), '\D', '', 'g'), '');
  _clean_name := NULLIF(trim(COALESCE(_full_name, '')), '');
  _clean_phone := NULLIF(trim(COALESCE(_phone, '')), '');

  IF _normalized_cpf IS NULL OR length(_normalized_cpf) <> 11 THEN
    RAISE EXCEPTION 'CPF inválido. Forneça um CPF com 11 dígitos.';
  END IF;

  IF _clean_name IS NULL THEN
    RAISE EXCEPTION 'Nome completo é obrigatório.';
  END IF;

  -- Verificar se outro perfil já possui este CPF
  SELECT id
  INTO _existing_cpf_user_id
  FROM public.profiles
  WHERE regexp_replace(coalesce(cpf, ''), '\D', '', 'g') = _normalized_cpf
    AND id <> _user_id
  LIMIT 1;

  IF _existing_cpf_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Este CPF já está cadastrado em outra conta.';
  END IF;

  -- Atualiza os dados no perfil existente do usuário autenticado
  UPDATE public.profiles
  SET
    full_name = _clean_name,
    cpf = _normalized_cpf,
    phone = COALESCE(_clean_phone, phone),
    birth_date = COALESCE(_birth_date, birth_date),
    updated_at = now()
  WHERE id = _user_id;

  RETURN jsonb_build_object(
    'user_id', _user_id,
    'full_name', _clean_name,
    'cpf', _normalized_cpf,
    'status', 'completed'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_unregistered_cpf_profile(text, text, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_unregistered_cpf_profile(text, text, text, date) TO authenticated, service_role;

-- ============================================================================
-- 4. Atualizar get_clinic_collaborator_invitation com has_cpf e pending_cpf_completion
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_clinic_collaborator_invitation(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _invitation public.clinic_collaborator_invitations%ROWTYPE;
  _clinic_name text;
  _is_existing_user boolean := false;
  _user_id uuid;
  _has_cpf boolean := false;
  _raw_cpf text;
BEGIN
  SELECT *
  INTO _invitation
  FROM public.clinic_collaborator_invitations
  WHERE token_hash = md5(coalesce(_token, ''))
  LIMIT 1;

  IF _invitation.id IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  IF _invitation.status = 'pending' AND _invitation.expires_at < now() THEN
    UPDATE public.clinic_collaborator_invitations
    SET status = 'expired'
    WHERE id = _invitation.id;

    _invitation.status := 'expired';
  END IF;

  SELECT name
  INTO _clinic_name
  FROM public.clinics
  WHERE id = _invitation.clinic_id;

  SELECT u.id
  INTO _user_id
  FROM auth.users u
  WHERE lower(u.email) = lower(_invitation.email)
  LIMIT 1;

  IF _user_id IS NOT NULL THEN
    _is_existing_user := true;
  ELSE
    _user_id := _invitation.existing_user_id;
    IF _user_id IS NOT NULL THEN
      _is_existing_user := true;
    END IF;
  END IF;

  IF _user_id IS NOT NULL THEN
    SELECT p.cpf
    INTO _raw_cpf
    FROM public.profiles p
    WHERE p.id = _user_id;

    IF _raw_cpf IS NOT NULL AND length(regexp_replace(_raw_cpf, '\D', '', 'g')) = 11 THEN
      _has_cpf := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id', _invitation.id,
    'clinic_id', _invitation.clinic_id,
    'clinic_name', COALESCE(_clinic_name, 'Clínica'),
    'email', _invitation.email,
    'operational_role', _invitation.operational_role,
    'job_title', _invitation.job_title,
    'specialty', _invitation.specialty,
    'status', _invitation.status,
    'existing_user', _is_existing_user,
    'has_cpf', _has_cpf,
    'pending_cpf_completion', (_is_existing_user AND NOT _has_cpf),
    'expires_at', _invitation.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_clinic_collaborator_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_clinic_collaborator_invitation(text) TO anon, authenticated, service_role;
