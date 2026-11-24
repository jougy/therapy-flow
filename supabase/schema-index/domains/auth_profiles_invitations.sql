-- ==========================================================================
-- DOMÍNIO: AUTH_PROFILES_INVITATIONS (Gerado automaticamente por npm run schema:index)
-- Fonte SSOT: supabase/schema.sql
-- ==========================================================================

-- [RPC/FUNCTION] accept_current_user_clinic_invitation (schema.sql L448-L697)
CREATE OR REPLACE FUNCTION "public"."accept_current_user_clinic_invitation"("_invitation_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _user_email text;
  _invitation public.clinic_collaborator_invitations%ROWTYPE;
  _newer_invitation public.clinic_collaborator_invitations%ROWTYPE;
  _profile_exists boolean;
  _clinic_plan text;
  _subaccount_limit integer;
  _active_collaborators_count integer;
  _clinic_route_key text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta para aceitar o convite.';
  END IF;

  _user_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF _user_email IS NULL OR _user_email = '' THEN
    SELECT lower(email)
    INTO _user_email
    FROM auth.users
    WHERE id = _user_id;
  END IF;

  SELECT *
  INTO _invitation
  FROM public.clinic_collaborator_invitations
  WHERE id = _invitation_id
  LIMIT 1;

  IF _invitation.id IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  IF _invitation.status = 'cancelled' THEN
    SELECT *
    INTO _newer_invitation
    FROM public.clinic_collaborator_invitations
    WHERE clinic_id = _invitation.clinic_id
      AND lower(email) = lower(_invitation.email)
      AND status = 'pending'
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;

    IF _newer_invitation.id IS NOT NULL THEN
      _invitation := _newer_invitation;
    END IF;
  END IF;

  IF lower(_invitation.email) IS DISTINCT FROM _user_email THEN
    RAISE EXCEPTION 'Este convite pertence a outro e-mail.';
  END IF;

  SELECT route_key
  INTO _clinic_route_key
  FROM public.clinics
  WHERE id = _invitation.clinic_id;

  -- Idempotency if already accepted
  IF _invitation.status = 'accepted' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.user_security_settings (user_id, clinic_id)
    VALUES (_user_id, _invitation.clinic_id)
    ON CONFLICT (user_id) DO UPDATE
    SET clinic_id = COALESCE(public.user_security_settings.clinic_id, EXCLUDED.clinic_id);

    INSERT INTO public.clinic_memberships (
      clinic_id,
      user_id,
      account_role,
      operational_role,
      role_key,
      membership_status,
      is_active,
      invited_by
    )
    VALUES (
      _invitation.clinic_id,
      _user_id,
      NULL,
      _invitation.operational_role,
      COALESCE(_invitation.role_key, _invitation.operational_role::text),
      'active',
      true,
      _invitation.invited_by
    )
    ON CONFLICT (clinic_id, user_id)
    DO UPDATE SET
      operational_role = COALESCE(public.clinic_memberships.operational_role, EXCLUDED.operational_role),
      role_key = COALESCE(public.clinic_memberships.role_key, EXCLUDED.role_key),
      membership_status = 'active',
      is_active = true,
      ended_at = NULL;

    INSERT INTO public.user_active_clinic_contexts (user_id, clinic_id, updated_at)
    VALUES (_user_id, _invitation.clinic_id, now())
    ON CONFLICT (user_id)
    DO UPDATE SET clinic_id = EXCLUDED.clinic_id, updated_at = now();

    RETURN jsonb_build_object(
      'clinic_id', _invitation.clinic_id,
      'clinic_route_key', _clinic_route_key,
      'status', 'accepted',
      'already_accepted', true
    );
  END IF;

  IF _invitation.expires_at < now() THEN
    UPDATE public.clinic_collaborator_invitations
    SET status = 'expired', updated_at = now()
    WHERE id = _invitation.id;
    RAISE EXCEPTION 'Este convite expirou.';
  END IF;

  IF _invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'Este convite não está mais pendente.';
  END IF;

  SELECT
    LOWER(COALESCE(subscription_plan::text, 'solo')),
    CASE
      WHEN subscription_plan::text IN ('clinica_basico', 'clinica_medio', 'clinica_top', 'clinic', 'enterprise') THEN 999999
      WHEN subscription_plan::text = 'prof_top' THEN GREATEST(COALESCE(subaccount_limit, 2), 2)
      ELSE COALESCE(subaccount_limit, 1)
    END
  INTO _clinic_plan, _subaccount_limit
  FROM public.clinics
  WHERE id = _invitation.clinic_id;

  IF _clinic_plan IN ('prof_basico', 'prof_medio', 'solo') THEN
    RAISE EXCEPTION 'Esta clínica está atualmente em um plano monoposto (apenas o titular) e não aceita novos colaboradores.';
  END IF;

  IF _subaccount_limit < 999999 THEN
    SELECT COUNT(*)::integer INTO _active_collaborators_count
    FROM public.clinic_memberships
    WHERE clinic_id = _invitation.clinic_id
      AND is_active = true
      AND membership_status = 'active'
      AND user_id <> _user_id
      AND COALESCE(account_role::text, '') NOT IN ('account_owner', 'owner')
      AND COALESCE(operational_role::text, '') <> 'owner';

    IF _active_collaborators_count >= GREATEST(1, _subaccount_limit - 1) THEN
      RAISE EXCEPTION 'O limite de membros da clínica foi atingido para o plano atual.';
    END IF;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id)
  INTO _profile_exists;

  IF _profile_exists THEN
    UPDATE public.profiles
    SET
      clinic_id = COALESCE(clinic_id, _invitation.clinic_id),
      email = COALESCE(email, _invitation.email),
      job_title = COALESCE(NULLIF(trim(_invitation.job_title), ''), job_title),
      specialty = COALESCE(NULLIF(trim(_invitation.specialty), ''), specialty),
      public_code = COALESCE(NULLIF(trim(public_code), ''), public.generate_profile_public_code())
    WHERE id = _user_id;
  ELSE
    INSERT INTO public.profiles (
      id,
      clinic_id,
      email,
      job_title,
      specialty,
      public_code
    )
    VALUES (
      _user_id,
      _invitation.clinic_id,
      _invitation.email,
      NULLIF(trim(_invitation.job_title), ''),
      NULLIF(trim(_invitation.specialty), ''),
      public.generate_profile_public_code()
    );
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_security_settings (user_id, clinic_id)
  VALUES (_user_id, _invitation.clinic_id)
  ON CONFLICT (user_id) DO UPDATE
  SET clinic_id = COALESCE(public.user_security_settings.clinic_id, EXCLUDED.clinic_id);

  INSERT INTO public.clinic_memberships (
    clinic_id,
    user_id,
    account_role,
    operational_role,
    role_key,
    membership_status,
    is_active,
    invited_by
  )
  VALUES (
    _invitation.clinic_id,
    _user_id,
    NULL,
    _invitation.operational_role,
    COALESCE(_invitation.role_key, _invitation.operational_role::text),
    'active',
    true,
    _invitation.invited_by
  )
  ON CONFLICT (clinic_id, user_id)
  DO UPDATE SET
    operational_role = CASE
      WHEN public.clinic_memberships.account_role = 'account_owner' THEN 'owner'::public.operational_role_type
      ELSE EXCLUDED.operational_role
    END,
    role_key = CASE
      WHEN public.clinic_memberships.account_role = 'account_owner' THEN 'owner'
      ELSE EXCLUDED.role_key
    END,
    membership_status = 'active',
    is_active = true,
    ended_at = NULL,
    invited_by = COALESCE(public.clinic_memberships.invited_by, EXCLUDED.invited_by);

  INSERT INTO public.user_active_clinic_contexts (user_id, clinic_id, updated_at)
  VALUES (_user_id, _invitation.clinic_id, now())
  ON CONFLICT (user_id)
  DO UPDATE SET clinic_id = EXCLUDED.clinic_id, updated_at = now();

  UPDATE public.clinic_collaborator_invitations
  SET
    status = 'accepted',
    accepted_by = _user_id,
    accepted_at = now(),
    updated_at = now()
  WHERE id = _invitation.id;

  RETURN jsonb_build_object(
    'clinic_id', _invitation.clinic_id,
    'clinic_route_key', _clinic_route_key,
    'status', 'accepted'
  );
END;
$$;

-- [RPC/FUNCTION] apply_user_punishment (schema.sql L943-L984)
CREATE OR REPLACE FUNCTION "public"."apply_user_punishment"("_user_id" "uuid", "_punishment_type" "text", "_duration_minutes" integer, "_reason" "text", "_is_manual" boolean DEFAULT true) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  v_id UUID;
  v_expires_at TIMESTAMPTZ := NULL;
BEGIN
  -- If not manual (automatic from client trigger), verify user is self or caller is platform owner
  IF _is_manual AND NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Acesso negado. Apenas administradores do Backoffice podem aplicar punições manuais.';
  END IF;

  IF _duration_minutes IS NOT NULL AND _duration_minutes > 0 THEN
    v_expires_at := now() + (_duration_minutes || ' minutes')::INTERVAL;
  END IF;

  INSERT INTO public.user_punishments (
    user_id,
    punishment_type,
    applied_by,
    applied_at,
    expires_at,
    reason,
    is_active,
    is_manual
  )
  VALUES (
    _user_id,
    _punishment_type,
    CASE WHEN _is_manual THEN auth.uid() ELSE NULL END,
    now(),
    v_expires_at,
    _reason,
    true,
    _is_manual
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- [RPC/FUNCTION] auto_accept_pending_clinic_invitation_for_current_user (schema.sql L1082-L1266)
CREATE OR REPLACE FUNCTION "public"."auto_accept_pending_clinic_invitation_for_current_user"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _user_email text;
  _invitation public.clinic_collaborator_invitations%ROWTYPE;
  _profile_exists boolean;
  _clinic_plan text;
  _subaccount_limit integer;
  _active_collaborators_count integer;
  _clinic_route_key text;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'unauthenticated');
  END IF;

  _user_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF _user_email IS NULL OR _user_email = '' THEN
    SELECT lower(email)
    INTO _user_email
    FROM auth.users
    WHERE id = _user_id;
  END IF;

  IF _user_email IS NULL OR _user_email = '' THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'email_not_found');
  END IF;

  SELECT *
  INTO _invitation
  FROM public.clinic_collaborator_invitations
  WHERE lower(email) = _user_email
    AND status = 'pending'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF _invitation.id IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'no_pending_invitation');
  END IF;

  SELECT route_key
  INTO _clinic_route_key
  FROM public.clinics
  WHERE id = _invitation.clinic_id;

  SELECT
    LOWER(COALESCE(subscription_plan::text, 'solo')),
    CASE
      WHEN subscription_plan::text IN ('clinica_basico', 'clinica_medio', 'clinica_top', 'clinic', 'enterprise') THEN 999999
      WHEN subscription_plan::text = 'prof_top' THEN GREATEST(COALESCE(subaccount_limit, 2), 2)
      ELSE COALESCE(subaccount_limit, 1)
    END
  INTO _clinic_plan, _subaccount_limit
  FROM public.clinics
  WHERE id = _invitation.clinic_id;

  IF _clinic_plan IN ('prof_basico', 'prof_medio', 'solo') THEN
    RETURN jsonb_build_object(
      'accepted', false,
      'reason', 'plan_monoposto_not_allowed',
      'clinic_id', _invitation.clinic_id,
      'clinic_route_key', _clinic_route_key
    );
  END IF;

  IF _subaccount_limit < 999999 THEN
    SELECT COUNT(*)::integer INTO _active_collaborators_count
    FROM public.clinic_memberships
    WHERE clinic_id = _invitation.clinic_id
      AND is_active = true
      AND membership_status = 'active'
      AND user_id <> _user_id
      AND COALESCE(account_role::text, '') NOT IN ('account_owner', 'owner')
      AND COALESCE(operational_role::text, '') <> 'owner';

    IF _active_collaborators_count >= GREATEST(1, _subaccount_limit - 1) THEN
      RETURN jsonb_build_object(
        'accepted', false,
        'reason', 'clinic_subaccount_limit_reached',
        'clinic_id', _invitation.clinic_id,
        'clinic_route_key', _clinic_route_key
      );
    END IF;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id)
  INTO _profile_exists;

  IF _profile_exists THEN
    UPDATE public.profiles
    SET
      clinic_id = COALESCE(clinic_id, _invitation.clinic_id),
      email = COALESCE(email, _invitation.email),
      job_title = COALESCE(NULLIF(trim(_invitation.job_title), ''), job_title),
      specialty = COALESCE(NULLIF(trim(_invitation.specialty), ''), specialty),
      public_code = COALESCE(NULLIF(trim(public_code), ''), public.generate_profile_public_code())
    WHERE id = _user_id;
  ELSE
    INSERT INTO public.profiles (
      id,
      clinic_id,
      email,
      job_title,
      specialty,
      public_code
    )
    VALUES (
      _user_id,
      _invitation.clinic_id,
      _invitation.email,
      NULLIF(trim(_invitation.job_title), ''),
      NULLIF(trim(_invitation.specialty), ''),
      public.generate_profile_public_code()
    );
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_security_settings (user_id, clinic_id)
  VALUES (_user_id, _invitation.clinic_id)
  ON CONFLICT (user_id) DO UPDATE
  SET clinic_id = COALESCE(public.user_security_settings.clinic_id, EXCLUDED.clinic_id);

  INSERT INTO public.clinic_memberships (
    clinic_id,
    user_id,
    account_role,
    operational_role,
    role_key,
    membership_status,
    is_active,
    invited_by
  )
  VALUES (
    _invitation.clinic_id,
    _user_id,
    NULL,
    _invitation.operational_role,
    COALESCE(_invitation.role_key, _invitation.operational_role::text),
    'active',
    true,
    _invitation.invited_by
  )
  ON CONFLICT (clinic_id, user_id)
  DO UPDATE SET
    operational_role = CASE
      WHEN public.clinic_memberships.account_role = 'account_owner' THEN 'owner'::public.operational_role_type
      ELSE EXCLUDED.operational_role
    END,
    role_key = CASE
      WHEN public.clinic_memberships.account_role = 'account_owner' THEN 'owner'
      ELSE EXCLUDED.role_key
    END,
    membership_status = 'active',
    is_active = true,
    ended_at = NULL,
    invited_by = COALESCE(public.clinic_memberships.invited_by, EXCLUDED.invited_by);

  INSERT INTO public.user_active_clinic_contexts (user_id, clinic_id, updated_at)
  VALUES (_user_id, _invitation.clinic_id, now())
  ON CONFLICT (user_id)
  DO UPDATE SET clinic_id = EXCLUDED.clinic_id, updated_at = now();

  UPDATE public.clinic_collaborator_invitations
  SET
    status = 'accepted',
    accepted_by = _user_id,
    accepted_at = now(),
    updated_at = now()
  WHERE id = _invitation.id;

  RETURN jsonb_build_object(
    'accepted', true,
    'clinic_id', _invitation.clinic_id,
    'clinic_route_key', _clinic_route_key,
    'invitation_id', _invitation.id,
    'status', 'accepted'
  );
END;
$$;

-- [RPC/FUNCTION] current_user_is_clinic_manager (schema.sql L3467-L3472)
CREATE OR REPLACE FUNCTION "public"."current_user_is_clinic_manager"("_clinic_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.current_user_can('subaccounts_roles.manage', _clinic_id);
$$;

-- [RPC/FUNCTION] decline_current_user_clinic_invitation (schema.sql L3522-L3573)
CREATE OR REPLACE FUNCTION "public"."decline_current_user_clinic_invitation"("_invitation_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _user_email text;
  _invitation public.clinic_collaborator_invitations%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta para recusar o convite.';
  END IF;

  SELECT lower(email)
  INTO _user_email
  FROM auth.users
  WHERE id = _user_id;

  SELECT *
  INTO _invitation
  FROM public.clinic_collaborator_invitations
  WHERE id = _invitation_id
  LIMIT 1;

  IF _invitation.id IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  IF lower(_invitation.email) IS DISTINCT FROM _user_email THEN
    RAISE EXCEPTION 'Este convite pertence a outro e-mail.';
  END IF;

  UPDATE public.clinic_collaborator_invitations
  SET status = 'cancelled'
  WHERE id = _invitation.id
    AND status = 'pending';

  UPDATE public.clinic_memberships
  SET
    membership_status = 'inactive',
    is_active = false,
    ended_at = now()
  WHERE clinic_id = _invitation.clinic_id
    AND user_id = _user_id
    AND membership_status = 'invited';

  RETURN jsonb_build_object(
    'clinic_id', _invitation.clinic_id,
    'status', 'declined'
  );
END;
$$;

-- [RPC/FUNCTION] expire_outdated_user_punishments (schema.sql L4293-L4309)
CREATE OR REPLACE FUNCTION "public"."expire_outdated_user_punishments"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE public.user_punishments up
  SET is_active = false
  WHERE up.is_active = true
    AND up.expires_at IS NOT NULL
    AND up.expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- [RPC/FUNCTION] get_user_clinic_id (schema.sql L6886-L6907)
CREATE OR REPLACE FUNCTION "public"."get_user_clinic_id"("_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER PARALLEL SAFE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with platform_context as (
    select public.get_active_platform_clinic_id(_user_id) as clinic_id
  ),
  active_context as (
    select user_active_clinic_contexts.clinic_id
    from public.user_active_clinic_contexts
    where user_active_clinic_contexts.user_id = _user_id
      and (
        public.user_has_active_clinic_membership(_user_id, user_active_clinic_contexts.clinic_id)
        or user_active_clinic_contexts.clinic_id = (select clinic_id from platform_context)
      )
    limit 1
  )
  select coalesce(
    (select clinic_id from platform_context),
    (select active_context.clinic_id from active_context)
  )
$$;

-- [RPC/FUNCTION] handle_personal_signup (schema.sql L7003-L7246)
CREATE OR REPLACE FUNCTION "public"."handle_personal_signup"("_user_id" "uuid", "_email" "text", "_full_name" "text" DEFAULT NULL::"text", "_cpf" "text" DEFAULT NULL::"text", "_phone" "text" DEFAULT NULL::"text", "_birth_date" "date" DEFAULT NULL::"date", "_profession" "text" DEFAULT NULL::"text", "_council_number" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  _normalized_cpf text;
  _clean_name text;
  _clean_phone text;
  _clean_profession text;
  _clean_council_number text;
  _existing_cpf_user_id uuid;
  v_public_code text;
  v_clinic_id uuid;
  v_route_suffix text;
  v_route_key text;
  v_clinic_name text;
  v_trial_end timestamptz;
  v_is_already_owner boolean := false;
BEGIN
  -- Higienização dos campos de entrada
  _normalized_cpf := NULLIF(regexp_replace(COALESCE(_cpf, ''), '\D', '', 'g'), '');
  _clean_name := NULLIF(trim(COALESCE(_full_name, '')), '');
  _clean_phone := NULLIF(trim(COALESCE(_phone, '')), '');
  _clean_profession := NULLIF(trim(COALESCE(_profession, '')), '');
  _clean_council_number := NULLIF(trim(COALESCE(_council_number, '')), '');

  -- Validação atômica de CPF: se já existir outro usuário com o mesmo CPF higienizado
  IF _normalized_cpf IS NOT NULL THEN
    SELECT id INTO _existing_cpf_user_id
    FROM public.profiles
    WHERE cpf = _normalized_cpf
      AND id <> _user_id
    LIMIT 1;

    IF _existing_cpf_user_id IS NOT NULL THEN
      RAISE EXCEPTION 'Este CPF já está cadastrado em outra conta.' USING ERRCODE = '23505';
    END IF;
  END IF;

  -- Obter ou gerar o ID Global do perfil (public_code)
  SELECT public_code INTO v_public_code
  FROM public.profiles
  WHERE id = _user_id;

  IF v_public_code IS NULL OR trim(v_public_code) = '' THEN
    v_public_code := public.generate_profile_public_code();
  END IF;

  -- Inserir ou atualizar perfil
  INSERT INTO public.profiles (
    id,
    clinic_id,
    email,
    full_name,
    cpf,
    phone,
    birth_date,
    public_code,
    profession,
    council_name,
    professional_license
  )
  VALUES (
    _user_id,
    NULL,
    lower(trim(_email)),
    _clean_name,
    _normalized_cpf,
    _clean_phone,
    _birth_date,
    v_public_code,
    _clean_profession,
    'CREFITO',
    _clean_council_number
  )
  ON CONFLICT (id) DO UPDATE
  SET email = lower(trim(EXCLUDED.email)),
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
      cpf = COALESCE(EXCLUDED.cpf, profiles.cpf),
      phone = COALESCE(EXCLUDED.phone, profiles.phone),
      birth_date = COALESCE(EXCLUDED.birth_date, profiles.birth_date),
      profession = COALESCE(EXCLUDED.profession, profiles.profession),
      council_name = COALESCE(EXCLUDED.council_name, profiles.council_name, 'CREFITO'),
      professional_license = COALESCE(EXCLUDED.professional_license, profiles.professional_license),
      public_code = COALESCE(profiles.public_code, EXCLUDED.public_code),
      updated_at = now();

  -- Papel básico de usuário
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Checar se o usuário já é owner de alguma clínica
  SELECT EXISTS (
    SELECT 1
    FROM public.clinic_memberships cm
    WHERE cm.user_id = _user_id
      AND cm.is_active = true
      AND (cm.account_role = 'account_owner' OR cm.operational_role = 'owner')
  ) OR EXISTS (
    SELECT 1
    FROM public.clinics c
    WHERE c.account_owner_user_id = _user_id
  ) INTO v_is_already_owner;

  -- Se NÃO for owner de nenhuma clínica, provisionar consultório solo gratuito
  IF NOT v_is_already_owner THEN
    v_trial_end := now() + interval '7 days';
    v_clinic_name := 'Consultório - ' || COALESCE(_clean_name, 'Profissional');

    -- Formatar route_key: 'consultorio-' || lower(regexp_replace(v_public_code, '^PLR-|-', '', 'g'))
    v_route_suffix := lower(regexp_replace(COALESCE(v_public_code, gen_random_uuid()::text), '^PLR-|-', '', 'g'));
    v_route_key := 'consultorio-' || v_route_suffix;

    -- Garantir unicidade do route_key caso colida por rara coincidência
    IF EXISTS (SELECT 1 FROM public.clinics WHERE route_key = v_route_key) THEN
      v_route_key := v_route_key || '-' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
    END IF;

    -- Inserir clínica solo
    INSERT INTO public.clinics (
      name,
      cnpj,
      route_key,
      subscription_plan,
      access_status,
      concurrent_access_limit,
      subaccount_limit,
      account_owner_user_id
    )
    VALUES (
      v_clinic_name,
      COALESCE(_normalized_cpf, '00000000000'),
      v_route_key,
      'prof_basico'::public.subscription_plan,
      'active',
      1,
      1,
      _user_id
    )
    RETURNING id INTO v_clinic_id;

    -- Inserir assinatura em teste gratuito (7 dias, 20 atendimentos, 1 acesso)
    INSERT INTO public.clinic_subscriptions (
      clinic_id,
      account_owner_user_id,
      plan_type,
      billing_cycle,
      payment_method,
      base_monthly_price,
      base_concurrent_access_count,
      total_recurring_monthly_price,
      base_subaccount_limit,
      status,
      is_free_trial,
      is_read_only,
      trial_ends_at,
      trial_max_attendances,
      trial_max_patients,
      trial_max_custom_forms,
      period_duration_days,
      current_period_start,
      current_period_end,
      expires_at
    )
    VALUES (
      v_clinic_id,
      _user_id,
      'prof_basico'::public.subscription_plan,
      'ANNUAL',
      'TRIAL',
      39.99,
      1,
      0,
      1,
      'TRIAL',
      true,
      false,
      v_trial_end,
      20,
      5,
      1,
      7,
      now(),
      v_trial_end,
      v_trial_end
    )
    ON CONFLICT (clinic_id) DO NOTHING;

    -- Vínculo de membership: account_owner, operational_role 'owner', role_key 'owner', status 'active'
    INSERT INTO public.clinic_memberships (
      clinic_id,
      user_id,
      account_role,
      operational_role,
      role_key,
      membership_status,
      is_active
    )
    VALUES (
      v_clinic_id,
      _user_id,
      'account_owner',
      'owner',
      'owner',
      'active',
      true
    )
    ON CONFLICT (clinic_id, user_id) DO UPDATE
    SET
      account_role = 'account_owner',
      operational_role = 'owner',
      role_key = 'owner',
      membership_status = 'active',
      is_active = true,
      updated_at = now();

    -- Definir contexto ativo inicial
    INSERT INTO public.user_active_clinic_contexts (user_id, clinic_id, updated_at)
    VALUES (_user_id, v_clinic_id, now())
    ON CONFLICT (user_id) DO UPDATE
    SET clinic_id = EXCLUDED.clinic_id, updated_at = now();

    -- Atualizar clinic_id no profile
    UPDATE public.profiles
    SET clinic_id = COALESCE(clinic_id, v_clinic_id)
    WHERE id = _user_id;

    RETURN jsonb_build_object(
      'user_id', _user_id,
      'has_clinic', true,
      'clinic_id', v_clinic_id,
      'route_key', v_route_key,
      'subscription_plan', 'prof_basico',
      'subscription_status', 'trialing'
    );
  END IF;

  RETURN jsonb_build_object(
    'user_id', _user_id,
    'has_clinic', true
  );
END;
$$;

-- [RPC/FUNCTION] handle_signup (schema.sql L7627-L7667)
CREATE OR REPLACE FUNCTION "public"."handle_signup"("_user_id" "uuid", "_email" "text", "_cnpj" "text", "_full_name" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _clinic_id uuid;
  _is_super_admin boolean := false;
BEGIN
  -- Find or create clinic by CNPJ
  SELECT id INTO _clinic_id FROM public.clinics WHERE cnpj = _cnpj;
  
  IF _clinic_id IS NULL THEN
    INSERT INTO public.clinics (cnpj, name)
    VALUES (_cnpj, 'Clínica ' || _cnpj)
    RETURNING id INTO _clinic_id;
  END IF;
  
  -- Create profile
  INSERT INTO public.profiles (id, clinic_id, email, full_name)
  VALUES (_user_id, _clinic_id, _email, _full_name)
  ON CONFLICT (id) DO NOTHING;
  
  -- Check if super admin (hardcoded email)
  -- The platform owner can change this email
  IF _email = 'admin@prontohealthfisio.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    _is_super_admin := true;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN jsonb_build_object(
    'clinic_id', _clinic_id,
    'is_super_admin', _is_super_admin
  );
END;
$$;

-- [RPC/FUNCTION] handle_signup (schema.sql L7673-L7749)
CREATE OR REPLACE FUNCTION "public"."handle_signup"("_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscription_plan" DEFAULT 'solo'::"public"."subscription_plan", "_full_name" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _clinic_id uuid;
  _is_super_admin boolean := false;
BEGIN
  SELECT id INTO _clinic_id
  FROM public.clinics
  WHERE cnpj = _cnpj;

  IF _clinic_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ja existe uma clinica cadastrada com este CNPJ.';
  END IF;

  INSERT INTO public.clinics (
    cnpj,
    name,
    subscription_plan,
    subaccount_limit
  )
  VALUES (
    _cnpj,
    'Clínica ' || _cnpj,
    _subscription_plan,
    CASE WHEN _subscription_plan = 'clinic' THEN 4 ELSE 0 END
  )
  RETURNING id INTO _clinic_id;

  INSERT INTO public.profiles (id, clinic_id, email, full_name)
  VALUES (_user_id, _clinic_id, _email, _full_name)
  ON CONFLICT (id) DO UPDATE
  SET clinic_id = EXCLUDED.clinic_id,
      email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);

  INSERT INTO public.clinic_memberships (
    clinic_id,
    user_id,
    account_role,
    operational_role,
    membership_status,
    is_active
  )
  VALUES (
    _clinic_id,
    _user_id,
    'account_owner',
    'owner',
    'active',
    true
  )
  ON CONFLICT (clinic_id, user_id) DO NOTHING;

  UPDATE public.clinics
  SET account_owner_user_id = _user_id
  WHERE id = _clinic_id;

  IF _email = 'admin@prontohealthfisio.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    _is_super_admin := true;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'clinic_id', _clinic_id,
    'subscription_plan', _subscription_plan,
    'is_super_admin', _is_super_admin
  );
END;
$$;

-- [RPC/FUNCTION] handle_signup (schema.sql L7755-L7841)
CREATE OR REPLACE FUNCTION "public"."handle_signup"("_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscription_plan" DEFAULT 'solo'::"public"."subscription_plan", "_full_name" "text" DEFAULT NULL::"text", "_clinic_name" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _clinic_id uuid;
  _is_super_admin boolean := false;
  _resolved_clinic_name text := left(nullif(trim(coalesce(_clinic_name, '')), ''), 120);
BEGIN
  SELECT id INTO _clinic_id
  FROM public.clinics
  WHERE cnpj = _cnpj;

  IF _clinic_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ja existe uma clinica cadastrada com este CNPJ.';
  END IF;

  _resolved_clinic_name := coalesce(_resolved_clinic_name, 'Clínica ' || _cnpj);

  INSERT INTO public.clinics (
    cnpj,
    email,
    legal_name,
    name,
    subscription_plan,
    subaccount_limit,
    concurrent_access_limit
  )
  VALUES (
    _cnpj,
    _email,
    _resolved_clinic_name,
    _resolved_clinic_name,
    _subscription_plan,
    CASE WHEN _subscription_plan = 'clinic' THEN 30 ELSE 0 END,
    CASE WHEN _subscription_plan = 'clinic' THEN 2 ELSE 1 END
  )
  RETURNING id INTO _clinic_id;

  INSERT INTO public.profiles (id, clinic_id, email, full_name)
  VALUES (_user_id, _clinic_id, _email, _full_name)
  ON CONFLICT (id) DO UPDATE
  SET clinic_id = EXCLUDED.clinic_id,
      email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);

  INSERT INTO public.clinic_memberships (
    clinic_id,
    user_id,
    account_role,
    operational_role,
    membership_status,
    is_active
  )
  VALUES (
    _clinic_id,
    _user_id,
    'account_owner',
    'owner',
    'active',
    true
  )
  ON CONFLICT (clinic_id, user_id) DO NOTHING;

  UPDATE public.clinics
  SET account_owner_user_id = _user_id
  WHERE id = _clinic_id;

  IF _email = 'admin@prontohealthfisio.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    _is_super_admin := true;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'clinic_id', _clinic_id,
    'clinic_name', _resolved_clinic_name,
    'subscription_plan', _subscription_plan,
    'is_super_admin', _is_super_admin
  );
END;
$$;

-- [RPC/FUNCTION] handle_signup (schema.sql L7847-L7980)
CREATE OR REPLACE FUNCTION "public"."handle_signup"("_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscription_plan" DEFAULT 'solo'::"public"."subscription_plan", "_full_name" "text" DEFAULT NULL::"text", "_clinic_name" "text" DEFAULT NULL::"text", "_allow_duplicate_cnpj" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _clinic_id uuid;
  _existing_clinic_id uuid;
  _existing_owner_user_id uuid;
  _existing_clinic_name text;
  _is_super_admin boolean := false;
  _resolved_clinic_name text := left(nullif(trim(coalesce(_clinic_name, '')), ''), 120);
  _subaccount_limit integer;
  _concurrent_limit integer;
  _plan_str text := lower(_subscription_plan::text);
BEGIN
  -- Verificar se já existe clínica cadastrada com este CNPJ
  SELECT id, account_owner_user_id, name 
  INTO _existing_clinic_id, _existing_owner_user_id, _existing_clinic_name
  FROM public.clinics
  WHERE cnpj = _cnpj
  ORDER BY created_at ASC
  LIMIT 1;

  IF _existing_clinic_id IS NOT NULL THEN
    -- Caso 1: O CNPJ pertence a OUTRO usuário na plataforma
    IF _existing_owner_user_id IS DISTINCT FROM _user_id THEN
      RAISE EXCEPTION 'CNPJ_REGISTERED_TO_OTHER_USER';
    END IF;

    -- Caso 2: O CNPJ pertence ao MESMO usuário, mas ele ainda não confirmou a duplicação
    IF NOT _allow_duplicate_cnpj THEN
      RAISE EXCEPTION 'OWNER_HAS_CLINIC_WITH_CNPJ:%', _existing_clinic_name;
    END IF;
  END IF;

  _resolved_clinic_name := coalesce(_resolved_clinic_name, 'Clínica ' || _cnpj);

  -- Definir limites iniciais de acordo com a matriz de 6 planos
  IF _plan_str IN ('clinica_top', 'enterprise') THEN
    _subaccount_limit := 999999;
    _concurrent_limit := 8;
  ELSIF _plan_str IN ('clinica_medio', 'clinic') THEN
    _subaccount_limit := 999999;
    _concurrent_limit := 4;
  ELSIF _plan_str = 'clinica_basico' THEN
    _subaccount_limit := 999999;
    _concurrent_limit := 2;
  ELSIF _plan_str = 'prof_top' THEN
    _subaccount_limit := 2;
    _concurrent_limit := 2;
  ELSE
    -- prof_basico, prof_medio, solo
    _subaccount_limit := 1;
    _concurrent_limit := 1;
  END IF;

  INSERT INTO public.clinics (
    cnpj,
    email,
    legal_name,
    name,
    subscription_plan,
    subaccount_limit,
    concurrent_access_limit,
    account_owner_user_id
  )
  VALUES (
    _cnpj,
    _email,
    _resolved_clinic_name,
    _resolved_clinic_name,
    _subscription_plan,
    _subaccount_limit,
    _concurrent_limit,
    _user_id
  )
  RETURNING id INTO _clinic_id;

  INSERT INTO public.profiles (id, clinic_id, email, full_name)
  VALUES (_user_id, _clinic_id, _email, _full_name)
  ON CONFLICT (id) DO UPDATE
  SET clinic_id = COALESCE(profiles.clinic_id, EXCLUDED.clinic_id),
      email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);

  INSERT INTO public.clinic_memberships (
    clinic_id,
    user_id,
    account_role,
    operational_role,
    role_key,
    membership_status,
    is_active
  )
  VALUES (
    _clinic_id,
    _user_id,
    'account_owner'::account_role_type,
    'owner',
    'owner',
    'active',
    true
  )
  ON CONFLICT (clinic_id, user_id) DO UPDATE
  SET account_role = 'account_owner',
      operational_role = 'owner',
      role_key = 'owner',
      membership_status = 'active',
      is_active = true,
      updated_at = now();

  UPDATE public.clinics
  SET account_owner_user_id = _user_id
  WHERE id = _clinic_id;

  IF _email = 'admin@prontohealthfisio.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    _is_super_admin := true;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'clinic_id', _clinic_id,
    'clinic_name', _resolved_clinic_name,
    'subscription_plan', _subscription_plan,
    'is_super_admin', _is_super_admin
  );
END;
$$;

-- [RPC/FUNCTION] invite_clinic_collaborator (schema.sql L8028-L8279)
CREATE OR REPLACE FUNCTION "public"."invite_clinic_collaborator"("_clinic_id" "uuid" DEFAULT NULL::"uuid", "_email" "text" DEFAULT NULL::"text", "_operational_role" "public"."operational_role_type" DEFAULT 'professional'::"public"."operational_role_type", "_job_title" "text" DEFAULT NULL::"text", "_specialty" "text" DEFAULT NULL::"text", "_role_key" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions'
    AS $_$
DECLARE
  _requester_id uuid := auth.uid();
  _resolved_clinic_id uuid;
  _normalized_email text := lower(trim(coalesce(_email, '')));
  _token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  _token_hash text := md5(_token);
  _sha256_hash text;
  _existing_user_id uuid;
  _invitation_id uuid;
  _normalized_role_key text := lower(trim(coalesce(_role_key, '')));
  _inferred_operational_role public.operational_role_type := COALESCE(_operational_role, 'professional'::public.operational_role_type);
  _custom_role record;
  _clinic_plan text;
  _subaccount_limit integer;
  _max_collaborator_slots integer;
  _active_subaccounts_count integer;
  _pending_invites_count integer;
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  _resolved_clinic_id := COALESCE(_clinic_id, public.get_user_clinic_id(_requester_id));

  IF _resolved_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Clínica não identificada.';
  END IF;

  IF NOT (public.current_user_can('subaccounts.write', _resolved_clinic_id) OR public.current_user_can('subaccounts.manage', _resolved_clinic_id)) THEN
    RAISE EXCEPTION 'Você não tem permissão para convidar colaboradores.';
  END IF;

  -- Lock clinic row to prevent race conditions
  PERFORM 1 FROM public.clinics WHERE id = _resolved_clinic_id FOR UPDATE;

  SELECT
    LOWER(COALESCE(subscription_plan::text, 'solo')),
    CASE
      WHEN subscription_plan::text IN ('clinica_basico', 'clinica_medio', 'clinica_top', 'clinic', 'enterprise') THEN 999999
      WHEN subscription_plan::text = 'prof_top' THEN GREATEST(COALESCE(subaccount_limit, 2), 2)
      ELSE COALESCE(subaccount_limit, 1)
    END
  INTO _clinic_plan, _subaccount_limit
  FROM public.clinics
  WHERE id = _resolved_clinic_id;

  -- Check 1: Single-user plans cannot invite collaborators
  IF _clinic_plan IN ('prof_basico', 'prof_medio', 'solo') THEN
    RAISE EXCEPTION 'Convites de colaboradores não estão disponíveis em planos individuais (monoposto). Faça upgrade para Profissional Top ou Plano Clínica.';
  END IF;

  -- Expire outdated pending invitations before counting slots
  UPDATE public.clinic_collaborator_invitations
  SET status = 'expired', updated_at = now()
  WHERE clinic_id = _resolved_clinic_id
    AND status = 'pending'
    AND expires_at <= now();

  -- Check 2: Collaborator slot limit (excluding the clinic owner)
  IF _subaccount_limit < 999999 THEN
    SELECT COUNT(*)::integer INTO _active_subaccounts_count
    FROM public.clinic_memberships
    WHERE clinic_id = _resolved_clinic_id
      AND is_active = true
      AND membership_status = 'active'
      AND COALESCE(account_role::text, '') NOT IN ('account_owner', 'owner')
      AND COALESCE(operational_role::text, '') <> 'owner';

    SELECT COUNT(*)::integer INTO _pending_invites_count
    FROM public.clinic_collaborator_invitations
    WHERE clinic_id = _resolved_clinic_id
      AND status = 'pending'
      AND expires_at > now()
      AND lower(email) <> _normalized_email;

    _max_collaborator_slots := CASE
      WHEN _clinic_plan = 'prof_top' THEN GREATEST(1, _subaccount_limit - 1)
      ELSE GREATEST(1, _subaccount_limit - 1)
    END;

    IF (_active_subaccounts_count + _pending_invites_count) >= _max_collaborator_slots THEN
      IF _clinic_plan = 'prof_top' THEN
        RAISE EXCEPTION 'O plano Profissional Top permite no máximo 1 colaborador de apoio (total de 2 membros). Limite atingido.';
      ELSE
        RAISE EXCEPTION 'O limite de membros da clínica foi atingido para o plano atual.';
      END IF;
    END IF;
  END IF;

  IF _normalized_email = '' OR _normalized_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'Informe um e-mail válido para o convite.';
  END IF;

  -- Normalize common Portuguese aliases for standard roles
  IF _normalized_role_key IN ('assistente', 'recepcionista', 'secretaria', 'secretária') THEN
    _normalized_role_key := 'assistant';
  ELSIF _normalized_role_key IN ('profissional', 'fisioterapeuta', 'terapeuta') THEN
    _normalized_role_key := 'professional';
  ELSIF _normalized_role_key IN ('administrador', 'administradora', 'gestor', 'gestora') THEN
    _normalized_role_key := 'admin';
  ELSIF _normalized_role_key IN ('estagiário', 'estagiaria', 'estagiária', 'intern') THEN
    _normalized_role_key := 'estagiario';
  END IF;

  IF _operational_role = 'owner' OR _normalized_role_key = 'owner' THEN
    RAISE EXCEPTION 'O papel owner não pode ser atribuído por convite operacional.';
  END IF;

  -- Ensure default roles exist for this clinic
  INSERT INTO public.clinic_operational_roles (
    clinic_id, role_key, label, description, base_operational_role, sort_order, is_system
  )
  VALUES
    (_resolved_clinic_id, 'owner', 'Proprietário(a)', 'Titular da conta com controle total da clínica.', 'owner', 10, true),
    (_resolved_clinic_id, 'professional', 'Profissional', 'Realiza atendimentos, gerencia prontuários e sua própria agenda.', 'professional', 20, true),
    (_resolved_clinic_id, 'admin', 'Administrador(a)', 'Gerencia equipe, agenda geral, pacientes e configurações da clínica.', 'admin', 30, true),
    (_resolved_clinic_id, 'assistant', 'Assistente', 'Apoia na recepção, cadastro de pacientes e gestão de agendamentos.', 'assistant', 40, true),
    (_resolved_clinic_id, 'estagiario', 'Estagiário(a)', 'Realiza atendimentos e evoluções clínicas sob supervisão.', 'estagiario', 50, true)
  ON CONFLICT (clinic_id, role_key) DO NOTHING;

  -- Resolve role_key and infer operational_role
  IF _normalized_role_key IS NOT NULL AND _normalized_role_key <> '' THEN
    IF _normalized_role_key IN ('admin', 'professional', 'assistant', 'estagiario') THEN
      _inferred_operational_role := _normalized_role_key::public.operational_role_type;
    ELSE
      SELECT *
      INTO _custom_role
      FROM public.clinic_operational_roles
      WHERE clinic_id = _resolved_clinic_id
        AND (LOWER(role_key) = _normalized_role_key OR LOWER(label) = _normalized_role_key)
      LIMIT 1;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Papel operacional inválido para esta clínica.';
      END IF;

      _normalized_role_key := _custom_role.role_key;
      _inferred_operational_role := _custom_role.base_operational_role;
    END IF;
  ELSE
    _normalized_role_key := _inferred_operational_role::text;
  END IF;

  SELECT users.id
  INTO _existing_user_id
  FROM auth.users
  WHERE lower(users.email) = _normalized_email
  LIMIT 1;

  _sha256_hash := encode(extensions.digest(_token, 'sha256'), 'hex');

  SELECT id INTO _invitation_id
  FROM public.clinic_collaborator_invitations
  WHERE clinic_id = _resolved_clinic_id
    AND lower(email) = _normalized_email
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF _invitation_id IS NOT NULL THEN
    UPDATE public.clinic_collaborator_invitations
    SET
      operational_role = _inferred_operational_role,
      role_key = NULLIF(_normalized_role_key, ''),
      job_title = NULLIF(trim(_job_title), ''),
      specialty = NULLIF(trim(_specialty), ''),
      invited_by = _requester_id,
      existing_user_id = _existing_user_id,
      token_hash = _token_hash,
      valid_token_hashes = ARRAY(
        SELECT u FROM (
          SELECT DISTINCT u
          FROM unnest(
            array_cat(
              COALESCE(valid_token_hashes, ARRAY[token_hash]),
              ARRAY[_token_hash, _sha256_hash]
            )
          ) AS u
          WHERE u IS NOT NULL AND u <> ''
        ) sub
        ORDER BY 1 DESC
        LIMIT 10
      ),
      expires_at = now() + interval '14 days',
      updated_at = now(),
      email_delivery_status = 'pending',
      email_last_error = NULL,
      email_sent_at = NULL
    WHERE id = _invitation_id;
  ELSE
    INSERT INTO public.clinic_collaborator_invitations (
      clinic_id,
      email,
      operational_role,
      role_key,
      job_title,
      specialty,
      token_hash,
      valid_token_hashes,
      invited_by,
      existing_user_id,
      status,
      email_delivery_status,
      email_last_error,
      email_sent_at
    )
    VALUES (
      _resolved_clinic_id,
      _normalized_email,
      _inferred_operational_role,
      NULLIF(_normalized_role_key, ''),
      NULLIF(trim(_job_title), ''),
      NULLIF(trim(_specialty), ''),
      _token_hash,
      ARRAY[_token_hash, _sha256_hash],
      _requester_id,
      _existing_user_id,
      'pending',
      'pending',
      NULL,
      NULL
    )
    RETURNING id INTO _invitation_id;
  END IF;

  PERFORM public.log_security_event(
    _resolved_clinic_id,
    _requester_id,
    _existing_user_id,
    'clinic_collaborator_invited',
    'admin',
    jsonb_build_object(
      'invitation_id', _invitation_id,
      'email', _normalized_email,
      'operational_role', _inferred_operational_role,
      'role_key', NULLIF(_normalized_role_key, ''),
      'job_title', _job_title,
      'specialty', _specialty
    )
  );

  RETURN jsonb_build_object(
    'invitation_id', _invitation_id,
    'token', _token,
    'status', 'pending'
  );
END;
$_$;

-- [RPC/FUNCTION] leave_current_user_clinic (schema.sql L8455-L8532)
CREATE OR REPLACE FUNCTION "public"."leave_current_user_clinic"("_clinic_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _membership public.clinic_memberships%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  SELECT *
  INTO _membership
  FROM public.clinic_memberships
  WHERE clinic_id = _clinic_id
    AND user_id = _user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acesso da clinica nao encontrado.';
  END IF;

  IF _membership.account_role = 'account_owner' OR _membership.operational_role = 'owner' THEN
    RAISE EXCEPTION 'A conta principal nao pode sair da propria clinica por este fluxo.';
  END IF;

  IF _membership.membership_status <> 'active' THEN
    RAISE EXCEPTION 'Este acesso nao esta ativo.';
  END IF;

  UPDATE public.clinic_memberships
  SET
    membership_status = 'inactive',
    is_active = false,
    ended_at = now()
  WHERE id = _membership.id;

  UPDATE public.user_security_sessions
  SET
    ended_at = now(),
    last_seen_at = now()
  WHERE clinic_id = _membership.clinic_id
    AND user_id = _user_id
    AND ended_at IS NULL;

  DELETE FROM public.user_active_clinic_contexts
  WHERE user_id = _user_id
    AND clinic_id = _membership.clinic_id;

  PERFORM public.log_security_event(
    _membership.clinic_id,
    _user_id,
    _user_id,
    'clinic_member_left',
    'admin',
    jsonb_build_object(
      'membership_id', _membership.id,
      'previous_role', _membership.operational_role,
      'initiated_by', 'member'
    )
  );

  PERFORM public.log_security_event(
    _membership.clinic_id,
    _user_id,
    _user_id,
    'clinic_access_removed',
    'self',
    jsonb_build_object(
      'membership_id', _membership.id,
      'initiated_by', 'member'
    )
  );

  RETURN jsonb_build_object('clinic_id', _membership.clinic_id, 'status', 'inactive');
END;
$$;

-- [RPC/FUNCTION] list_current_user_clinic_invitations (schema.sql L8538-L8566)
CREATE OR REPLACE FUNCTION "public"."list_current_user_clinic_invitations"() RETURNS TABLE("invitation_id" "uuid", "clinic_id" "uuid", "clinic_name" "text", "clinic_logo_url" "text", "clinic_route_key" "text", "operational_role" "public"."operational_role_type", "role_key" "text", "job_title" "text", "specialty" "text", "invited_by_name" "text", "expires_at" timestamp with time zone, "created_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
  SELECT
    invitations.id AS invitation_id,
    invitations.clinic_id,
    clinics.name AS clinic_name,
    clinics.logo_url AS clinic_logo_url,
    clinics.route_key AS clinic_route_key,
    invitations.operational_role,
    invitations.role_key,
    invitations.job_title,
    invitations.specialty,
    inviter.full_name AS invited_by_name,
    invitations.expires_at,
    invitations.created_at
  FROM public.clinic_collaborator_invitations AS invitations
  JOIN public.clinics
    ON clinics.id = invitations.clinic_id
  LEFT JOIN public.profiles AS inviter
    ON inviter.id = invitations.invited_by
  JOIN auth.users
    ON users.id = auth.uid()
  WHERE invitations.status = 'pending'
    AND invitations.expires_at > now()
    AND lower(invitations.email) = lower(users.email)
  ORDER BY invitations.created_at DESC;
$$;

-- [RPC/FUNCTION] list_current_user_clinics (schema.sql L8572-L8633)
CREATE OR REPLACE FUNCTION "public"."list_current_user_clinics"() RETURNS TABLE("membership_id" "uuid", "clinic_id" "uuid", "clinic_route_key" "text", "clinic_name" "text", "clinic_logo_url" "text", "clinic_subscription_plan" "public"."subscription_plan", "clinic_subaccount_limit" integer, "clinic_concurrent_access_limit" integer, "clinic_active_access_count" integer, "clinic_active_access_users" "jsonb", "clinic_account_owner_user_id" "uuid", "account_role" "public"."account_role_type", "operational_role" "public"."operational_role_type", "role_key" "text", "membership_status" "public"."membership_status_type", "is_active" boolean, "joined_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    clinic_memberships.id AS membership_id,
    clinics.id AS clinic_id,
    clinics.route_key AS clinic_route_key,
    clinics.name AS clinic_name,
    clinics.logo_url AS clinic_logo_url,
    clinics.subscription_plan AS clinic_subscription_plan,
    CASE
      WHEN clinics.subscription_plan::text IN ('clinica_basico', 'clinica_medio', 'clinica_top', 'clinic', 'enterprise') THEN 999999
      WHEN clinics.subscription_plan::text = 'prof_top' THEN GREATEST(COALESCE(clinics.subaccount_limit, 2), 2)
      ELSE GREATEST(COALESCE(clinics.subaccount_limit, 1), 1)
    END::integer AS clinic_subaccount_limit,
    CASE
      WHEN clinics.subscription_plan::text IN ('clinica_top', 'enterprise') THEN GREATEST(COALESCE(clinics.concurrent_access_limit, 8), 8)
      WHEN clinics.subscription_plan::text IN ('clinica_medio', 'clinic') THEN GREATEST(COALESCE(clinics.concurrent_access_limit, 4), 4)
      WHEN clinics.subscription_plan::text IN ('clinica_basico', 'prof_top') THEN GREATEST(COALESCE(clinics.concurrent_access_limit, 2), 2)
      ELSE GREATEST(COALESCE(clinics.concurrent_access_limit, 1), 1)
    END::integer AS clinic_concurrent_access_limit,
    COALESCE(active_accesses.active_access_count, 0)::integer AS clinic_active_access_count,
    COALESCE(active_accesses.active_access_users, '[]'::jsonb) AS clinic_active_access_users,
    clinics.account_owner_user_id AS clinic_account_owner_user_id,
    clinic_memberships.account_role,
    clinic_memberships.operational_role,
    clinic_memberships.role_key,
    clinic_memberships.membership_status,
    clinic_memberships.is_active,
    clinic_memberships.joined_at
  FROM public.clinic_memberships
  JOIN public.clinics ON clinics.id = clinic_memberships.clinic_id
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::integer AS active_access_count,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'user_id', active_sessions.user_id,
            'full_name', profiles.full_name,
            'email', profiles.email,
            'last_seen_at', active_sessions.last_seen_at,
            'device_label', active_sessions.device_label
          )
          ORDER BY active_sessions.last_seen_at DESC
        ) FILTER (WHERE active_sessions.id IS NOT NULL),
        '[]'::jsonb
      ) AS active_access_users
    FROM public.user_security_sessions active_sessions
    LEFT JOIN public.profiles ON profiles.id = active_sessions.user_id
    WHERE active_sessions.clinic_id = clinics.id
      AND active_sessions.ended_at IS NULL
      AND active_sessions.force_signed_out_at IS NULL
      AND active_sessions.last_seen_at >= now() - INTERVAL '15 minutes'
  ) active_accesses ON true
  WHERE clinic_memberships.user_id = (SELECT auth.uid())
    AND clinic_memberships.is_active = true
    AND clinic_memberships.membership_status = 'active'::public.membership_status_type
    AND COALESCE(clinics.access_status, 'active') IN ('active', 'payment_pending', 'trialing')
  ORDER BY clinic_memberships.joined_at ASC;
$$;

-- [RPC/FUNCTION] reconcile_legacy_users_solo_clinic (schema.sql L10820-L10975)
CREATE OR REPLACE FUNCTION "public"."reconcile_legacy_users_solo_clinic"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_rec record;
  v_provisioned_count integer := 0;
  v_public_code text;
  v_clinic_id uuid;
  v_route_suffix text;
  v_route_key text;
  v_clinic_name text;
  v_trial_end timestamptz;
BEGIN
  FOR v_rec IN
    SELECT p.id AS user_id, p.full_name, p.cpf, p.public_code
    FROM public.profiles p
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.clinic_memberships cm
      WHERE cm.user_id = p.id
        AND cm.is_active = true
        AND (cm.account_role = 'account_owner' OR cm.operational_role = 'owner')
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.clinics c
      WHERE c.account_owner_user_id = p.id
    )
    AND (auth.uid() IS NULL OR p.id = auth.uid())
  LOOP
    v_trial_end := now() + interval '7 days';
    v_public_code := COALESCE(NULLIF(trim(v_rec.public_code), ''), public.generate_profile_public_code());

    IF v_rec.public_code IS NULL OR trim(v_rec.public_code) = '' THEN
      UPDATE public.profiles SET public_code = v_public_code WHERE id = v_rec.user_id;
    END IF;

    v_clinic_name := 'Consultório - ' || COALESCE(NULLIF(trim(v_rec.full_name), ''), 'Profissional');
    v_route_suffix := lower(regexp_replace(v_public_code, '^PLR-|-', '', 'g'));
    v_route_key := 'consultorio-' || v_route_suffix;

    IF EXISTS (SELECT 1 FROM public.clinics WHERE route_key = v_route_key) THEN
      v_route_key := v_route_key || '-' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
    END IF;

    INSERT INTO public.clinics (
      name,
      cnpj,
      route_key,
      subscription_plan,
      access_status,
      concurrent_access_limit,
      subaccount_limit,
      account_owner_user_id
    )
    VALUES (
      v_clinic_name,
      COALESCE(NULLIF(regexp_replace(COALESCE(v_rec.cpf, ''), '\D', '', 'g'), ''), '00000000000'),
      v_route_key,
      'prof_basico'::public.subscription_plan,
      'active',
      1,
      1,
      v_rec.user_id
    )
    RETURNING id INTO v_clinic_id;

    INSERT INTO public.clinic_subscriptions (
      clinic_id,
      account_owner_user_id,
      plan_type,
      billing_cycle,
      payment_method,
      base_monthly_price,
      base_concurrent_access_count,
      total_recurring_monthly_price,
      base_subaccount_limit,
      status,
      is_free_trial,
      is_read_only,
      trial_ends_at,
      trial_max_attendances,
      trial_max_patients,
      trial_max_custom_forms,
      period_duration_days,
      current_period_start,
      current_period_end,
      expires_at
    )
    VALUES (
      v_clinic_id,
      v_rec.user_id,
      'prof_basico'::public.subscription_plan,
      'ANNUAL',
      'TRIAL',
      39.99,
      1,
      0,
      1,
      'TRIAL',
      true,
      false,
      v_trial_end,
      20,
      5,
      1,
      7,
      now(),
      v_trial_end,
      v_trial_end
    )
    ON CONFLICT (clinic_id) DO NOTHING;

    INSERT INTO public.clinic_memberships (
      clinic_id,
      user_id,
      account_role,
      operational_role,
      role_key,
      membership_status,
      is_active
    )
    VALUES (
      v_clinic_id,
      v_rec.user_id,
      'account_owner',
      'owner',
      'owner',
      'active',
      true
    )
    ON CONFLICT (clinic_id, user_id) DO UPDATE
    SET
      account_role = 'account_owner',
      operational_role = 'owner',
      role_key = 'owner',
      membership_status = 'active',
      is_active = true,
      updated_at = now();

    -- CRITICAL: Do NOT overwrite active clinic context if the user already has one (e.g. a third-party clinic)!
    INSERT INTO public.user_active_clinic_contexts (user_id, clinic_id, updated_at)
    VALUES (v_rec.user_id, v_clinic_id, now())
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.profiles
    SET clinic_id = COALESCE(clinic_id, v_clinic_id)
    WHERE id = v_rec.user_id;

    v_provisioned_count := v_provisioned_count + 1;
  END LOOP;

  RETURN v_provisioned_count;
END;
$$;

-- [RPC/FUNCTION] revoke_user_punishment (schema.sql L11934-L11949)
CREATE OR REPLACE FUNCTION "public"."revoke_user_punishment"("_punishment_id" "uuid", "_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
BEGIN
  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Acesso negado. Apenas administradores do Backoffice podem revogar punições.';
  END IF;

  UPDATE public.user_punishments
  SET 
    is_active = false,
    reason = reason || ' [REVOGADA MANUALMENTE: ' || _reason || ']'
  WHERE id = _punishment_id;
END;
$$;

-- [RPC/FUNCTION] set_current_user_active_clinic (schema.sql L12270-L12292)
CREATE OR REPLACE FUNCTION "public"."set_current_user_active_clinic"("_clinic_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  _user_id uuid := auth.uid();
begin
  if _user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if not public.user_has_active_clinic_membership(_user_id, _clinic_id) then
    raise exception 'Clinica indisponivel para este usuario.';
  end if;

  insert into public.user_active_clinic_contexts (user_id, clinic_id, updated_at)
  values (_user_id, _clinic_id, now())
  on conflict (user_id)
  do update set clinic_id = excluded.clinic_id, updated_at = now();

  return jsonb_build_object('clinic_id', _clinic_id);
end;
$$;

-- [RPC/FUNCTION] set_current_user_active_clinic_by_route_key (schema.sql L12298-L12316)
CREATE OR REPLACE FUNCTION "public"."set_current_user_active_clinic_by_route_key"("_route_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  _clinic_id uuid;
begin
  select clinics.id
  into _clinic_id
  from public.clinics
  where clinics.route_key = _route_key;

  if _clinic_id is null then
    raise exception 'Clinica indisponivel para este usuario.';
  end if;

  return public.set_current_user_active_clinic(_clinic_id);
end;
$$;

-- [RPC/FUNCTION] upsert_current_user_security_settings (schema.sql L14368-L14421)
CREATE OR REPLACE FUNCTION "public"."upsert_current_user_security_settings"("_alert_password_changed" boolean DEFAULT NULL::boolean, "_alert_new_login" boolean DEFAULT NULL::boolean, "_alert_other_sessions_ended" boolean DEFAULT NULL::boolean, "_alert_access_change" boolean DEFAULT NULL::boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

-- [RPC/FUNCTION] user_has_active_clinic_membership (schema.sql L14742-L14763)
CREATE OR REPLACE FUNCTION "public"."user_has_active_clinic_membership"("_user_id" "uuid", "_clinic_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinic_memberships
    JOIN public.clinics ON clinics.id = clinic_memberships.clinic_id
    WHERE clinic_memberships.user_id = _user_id
      AND clinic_memberships.clinic_id = _clinic_id
      AND clinic_memberships.is_active = true
      AND clinic_memberships.membership_status = 'active'::public.membership_status_type
      AND COALESCE(clinics.access_status, 'active') IN ('active', 'payment_pending', 'trialing')
  )
  OR EXISTS (
    SELECT 1
    FROM public.clinics
    WHERE clinics.id = _clinic_id
      AND clinics.account_owner_user_id = _user_id
      AND COALESCE(clinics.access_status, 'active') IN ('active', 'payment_pending', 'trialing')
  );
$$;

-- [RPC/FUNCTION] validate_user_clinic (schema.sql L15100-L15113)
CREATE OR REPLACE FUNCTION "public"."validate_user_clinic"("_user_id" "uuid", "_cnpj" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinic_memberships
    JOIN public.clinics ON clinics.id = clinic_memberships.clinic_id
    WHERE clinic_memberships.user_id = _user_id
      AND clinic_memberships.is_active = true
      AND clinic_memberships.membership_status = 'active'
      AND clinics.cnpj = _cnpj
  )
$$;

-- [RPC/FUNCTION] verify_password_recovery_identity (schema.sql L15119-L15144)
CREATE OR REPLACE FUNCTION "public"."verify_password_recovery_identity"("_email" "text", "_cpf" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $_$
DECLARE
  _normalized_email text := lower(trim(coalesce(_email, '')));
  _normalized_cpf text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  _matches boolean := false;
BEGIN
  IF _normalized_email = '' OR _normalized_cpf !~ '^\d{11}$' THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    JOIN public.profiles
      ON profiles.id = users.id
    WHERE lower(users.email) = _normalized_email
      AND regexp_replace(coalesce(profiles.cpf, ''), '\D', '', 'g') = _normalized_cpf
  )
  INTO _matches;

  RETURN COALESCE(_matches, false);
END;
$_$;

-- [TABLE] user_active_clinic_contexts (schema.sql L16921-L16925)
CREATE TABLE IF NOT EXISTS "public"."user_active_clinic_contexts" (
    "user_id" "uuid" NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- [TABLE] user_punishments (schema.sql L16955-L16965)
CREATE TABLE IF NOT EXISTS "public"."user_punishments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "punishment_type" "text" NOT NULL,
    "applied_by" "uuid",
    "applied_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "reason" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_manual" boolean DEFAULT false NOT NULL
);

-- [TABLE] user_security_settings (schema.sql L17016-L17025)
CREATE TABLE IF NOT EXISTS "public"."user_security_settings" (
    "user_id" "uuid" NOT NULL,
    "clinic_id" "uuid",
    "alert_access_change" boolean DEFAULT false NOT NULL,
    "alert_new_login" boolean DEFAULT true NOT NULL,
    "alert_other_sessions_ended" boolean DEFAULT true NOT NULL,
    "alert_password_changed" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- [POLICY] Platform owners can manage user punishments ON user_punishments (schema.sql L19832-L19832)
CREATE POLICY "Platform owners can manage user punishments" ON "public"."user_punishments" TO "authenticated" USING ("public"."is_platform_owner"()) WITH CHECK ("public"."is_platform_owner"());

-- [POLICY] Users can read own active punishments ON user_punishments (schema.sql L19996-L19996)
CREATE POLICY "Users can read own active punishments" ON "public"."user_punishments" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR "public"."is_platform_owner"()));

-- [POLICY] Users read own active clinic context ON user_active_clinic_contexts (schema.sql L20163-L20163)
CREATE POLICY "Users read own active clinic context" ON "public"."user_active_clinic_contexts" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));

-- [POLICY] users can read own security settings ON user_security_settings (schema.sql L20582-L20582)
CREATE POLICY "users can read own security settings" ON "public"."user_security_settings" FOR SELECT USING (("user_id" = "auth"."uid"()));
