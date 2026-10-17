-- ==========================================================================
-- DOMÍNIO: CLINICS_RBAC (Gerado automaticamente por npm run schema:index)
-- Fonte SSOT: supabase/schema.sql
-- ==========================================================================

-- [RPC/FUNCTION] accept_clinic_collaborator_invitation (schema.sql L157-L330)
CREATE OR REPLACE FUNCTION "public"."accept_clinic_collaborator_invitation"("_token" "text", "_full_name" "text" DEFAULT NULL::"text") RETURNS "jsonb"
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
  _active_members_count integer;
  _token_clean text := trim(coalesce(_token, ''));
  _sha256_hash text;
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

  BEGIN
    _sha256_hash := encode(extensions.digest(_token_clean, 'sha256'), 'hex');
  EXCEPTION WHEN OTHERS THEN
    _sha256_hash := NULL;
  END;

  SELECT *
  INTO _invitation
  FROM public.clinic_collaborator_invitations
  WHERE token_hash = md5(_token_clean)
     OR (_sha256_hash IS NOT NULL AND token_hash = _sha256_hash)
  LIMIT 1;

  IF _invitation.id IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  IF _invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'Este convite não está mais pendente.';
  END IF;

  IF _invitation.expires_at < now() THEN
    UPDATE public.clinic_collaborator_invitations
    SET status = 'expired', updated_at = now()
    WHERE id = _invitation.id;
    RAISE EXCEPTION 'Este convite expirou.';
  END IF;

  IF _user_email IS DISTINCT FROM lower(_invitation.email) THEN
    RAISE EXCEPTION 'Entre com o e-mail convidado para aceitar este acesso.';
  END IF;

  -- Validação de cota do plano da clínica antes de admitir novo membro
  SELECT LOWER(COALESCE(subscription_plan::text, 'solo')), COALESCE(subaccount_limit, 1)
  INTO _clinic_plan, _subaccount_limit
  FROM public.clinics
  WHERE id = _invitation.clinic_id;

  IF _clinic_plan IN ('prof_basico', 'prof_medio', 'solo') THEN
    RAISE EXCEPTION 'Esta clínica está atualmente em um plano monoposto (apenas o titular) e não aceita novos colaboradores.';
  END IF;

  IF _subaccount_limit < 999999 THEN
    SELECT COUNT(*)::integer INTO _active_members_count
    FROM public.clinic_memberships
    WHERE clinic_id = _invitation.clinic_id
      AND is_active = true
      AND membership_status = 'active'
      AND user_id <> _user_id;

    IF _active_members_count >= _subaccount_limit THEN
      RAISE EXCEPTION 'O limite de membros da clínica foi atingido para o plano atual.';
    END IF;
  END IF;

  -- Atualizar ou criar perfil
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id)
  INTO _profile_exists;

  IF _profile_exists THEN
    UPDATE public.profiles
    SET
      clinic_id = COALESCE(clinic_id, _invitation.clinic_id),
      email = COALESCE(email, _invitation.email),
      full_name = COALESCE(NULLIF(trim(full_name), ''), NULLIF(trim(coalesce(_full_name, '')), '')),
      job_title = COALESCE(NULLIF(trim(_invitation.job_title), ''), job_title),
      specialty = COALESCE(NULLIF(trim(_invitation.specialty), ''), specialty),
      public_code = COALESCE(NULLIF(trim(public_code), ''), public.generate_profile_public_code())
    WHERE id = _user_id;
  ELSE
    INSERT INTO public.profiles (
      id,
      clinic_id,
      email,
      full_name,
      job_title,
      specialty,
      public_code
    )
    VALUES (
      _user_id,
      _invitation.clinic_id,
      _invitation.email,
      NULLIF(trim(coalesce(_full_name, '')), ''),
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
    _invitation.role_key,
    'active',
    true,
    _invitation.invited_by
  )
  ON CONFLICT (clinic_id, user_id)
  DO UPDATE SET
    operational_role = EXCLUDED.operational_role,
    role_key = EXCLUDED.role_key,
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
    'status', 'accepted'
  );
END;
$$;

-- [RPC/FUNCTION] accept_current_user_clinic_invitation (schema.sql L336-L496)
CREATE OR REPLACE FUNCTION "public"."accept_current_user_clinic_invitation"("_invitation_id" "uuid") RETURNS "jsonb"
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
  _active_members_count integer;
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

  IF _invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'Este convite não está mais pendente.';
  END IF;

  IF _invitation.expires_at < now() THEN
    UPDATE public.clinic_collaborator_invitations
    SET status = 'expired', updated_at = now()
    WHERE id = _invitation.id;
    RAISE EXCEPTION 'Este convite expirou.';
  END IF;

  IF lower(_invitation.email) IS DISTINCT FROM _user_email THEN
    RAISE EXCEPTION 'Este convite pertence a outro e-mail.';
  END IF;

  -- Validação de cota do plano da clínica antes de admitir novo membro
  SELECT LOWER(COALESCE(subscription_plan::text, 'solo')), COALESCE(subaccount_limit, 1)
  INTO _clinic_plan, _subaccount_limit
  FROM public.clinics
  WHERE id = _invitation.clinic_id;

  IF _clinic_plan IN ('prof_basico', 'prof_medio', 'solo') THEN
    RAISE EXCEPTION 'Esta clínica está atualmente em um plano monoposto (apenas o titular) e não aceita novos colaboradores.';
  END IF;

  IF _subaccount_limit < 999999 THEN
    SELECT COUNT(*)::integer INTO _active_members_count
    FROM public.clinic_memberships
    WHERE clinic_id = _invitation.clinic_id
      AND is_active = true
      AND membership_status = 'active'
      AND user_id <> _user_id;

    IF _active_members_count >= _subaccount_limit THEN
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
    _invitation.role_key,
    'active',
    true,
    _invitation.invited_by
  )
  ON CONFLICT (clinic_id, user_id)
  DO UPDATE SET
    operational_role = EXCLUDED.operational_role,
    role_key = EXCLUDED.role_key,
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
    'status', 'accepted'
  );
END;
$$;

-- [RPC/FUNCTION] auto_accept_pending_clinic_invitation_for_current_user (schema.sql L502-L656)
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
  _active_members_count integer;
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

  -- Validação de cota do plano da clínica antes de admitir novo membro
  SELECT LOWER(COALESCE(subscription_plan::text, 'solo')), COALESCE(subaccount_limit, 1)
  INTO _clinic_plan, _subaccount_limit
  FROM public.clinics
  WHERE id = _invitation.clinic_id;

  IF _clinic_plan IN ('prof_basico', 'prof_medio', 'solo') THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'plan_monoposto_not_allowed', 'clinic_id', _invitation.clinic_id);
  END IF;

  IF _subaccount_limit < 999999 THEN
    SELECT COUNT(*)::integer INTO _active_members_count
    FROM public.clinic_memberships
    WHERE clinic_id = _invitation.clinic_id
      AND is_active = true
      AND membership_status = 'active'
      AND user_id <> _user_id;

    IF _active_members_count >= _subaccount_limit THEN
      RETURN jsonb_build_object('accepted', false, 'reason', 'clinic_subaccount_limit_reached', 'clinic_id', _invitation.clinic_id);
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
    _invitation.role_key,
    'active',
    true,
    _invitation.invited_by
  )
  ON CONFLICT (clinic_id, user_id)
  DO UPDATE SET
    operational_role = EXCLUDED.operational_role,
    role_key = EXCLUDED.role_key,
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
    'invitation_id', _invitation.id,
    'status', 'accepted'
  );
END;
$$;

-- [RPC/FUNCTION] acknowledge_current_user_release_notes (schema.sql L662-L721)
CREATE OR REPLACE FUNCTION "public"."acknowledge_current_user_release_notes"("_release_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  _user_id uuid := auth.uid();
  _release public.platform_releases%rowtype;
begin
  if _user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if _release_id is null then
    select *
    into _release
    from public.platform_releases
    where is_active = true
    order by version_order desc
    limit 1;
  else
    select *
    into _release
    from public.platform_releases
    where id = _release_id
      and is_active = true;
  end if;

  if _release.id is null then
    raise exception 'Versao de atualizacao indisponivel.';
  end if;

  insert into public.user_release_note_states (
    user_id,
    last_seen_release_id,
    last_seen_release_order,
    last_seen_at
  )
  values (
    _user_id,
    _release.id,
    _release.version_order,
    now()
  )
  on conflict (user_id)
  do update set
    last_seen_release_id = excluded.last_seen_release_id,
    last_seen_release_order = greatest(
      user_release_note_states.last_seen_release_order,
      excluded.last_seen_release_order
    ),
    last_seen_at = now(),
    updated_at = now();

  return jsonb_build_object(
    'acknowledged', true,
    'release_id', _release.id,
    'version', _release.version
  );
end;
$$;

-- [RPC/FUNCTION] activate_clinic_free_trial (schema.sql L727-L885)
CREATE OR REPLACE FUNCTION "public"."activate_clinic_free_trial"("_clinic_id" "uuid", "_plan_type" "text" DEFAULT 'clinic'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_current_user_id uuid := auth.uid();
  v_owner_user_id uuid;
  v_is_authorized boolean := false;
  v_typed_plan public.subscription_plan;
  v_trial_duration_days integer := 7;
  v_expires_at timestamptz := now() + interval '7 days';
  v_has_card boolean := false;
BEGIN
  IF _clinic_id IS NULL THEN
    RAISE EXCEPTION 'clinic_id é obrigatório para ativar o teste gratuito.';
  END IF;

  -- Regra Comercial: O teste gratuito de 7 dias é exclusivamente concedido na
  -- modalidade equivalente ao "Clínica Pro" (4 acessos simultâneos para equipes).
  v_typed_plan := 'clinic'::public.subscription_plan;

  -- 1. Buscar o account_owner_user_id da clínica
  SELECT account_owner_user_id INTO v_owner_user_id
  FROM public.clinics
  WHERE id = _clinic_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Clínica não encontrada.';
  END IF;

  -- 2. Validação de segurança: verificar se auth.uid() é account_owner ou admin
  IF v_current_user_id IS NOT NULL THEN
    IF v_owner_user_id = v_current_user_id THEN
      v_is_authorized := true;
    ELSIF EXISTS (
      SELECT 1 FROM public.clinic_memberships cm
      WHERE cm.clinic_id = _clinic_id
        AND cm.user_id = v_current_user_id
        AND cm.account_role = 'account_owner'
        AND cm.is_active = true
        AND cm.membership_status = 'active'
    ) THEN
      v_is_authorized := true;
    ELSIF EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = v_current_user_id
        AND pa.is_active = true
    ) THEN
      v_is_authorized := true;
    END IF;
  ELSE
    -- Chamadas executadas com service_role (ex: Edge Functions)
    v_is_authorized := true;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Acesso negado: apenas o responsável pela clínica (account_owner) ou administrador pode ativar o teste gratuito.';
  END IF;

  -- 3. Validação de Garantia: verificar se a clínica possui cartão registrado em clinic_subscriptions
  SELECT (trial_card_token IS NOT NULL AND trim(trial_card_token) <> '') INTO v_has_card
  FROM public.clinic_subscriptions
  WHERE clinic_id = _clinic_id;

  IF NOT COALESCE(v_has_card, false) THEN
    RAISE EXCEPTION 'É obrigatório registrar um cartão de crédito como garantia para ativar o teste gratuito.';
  END IF;

  v_owner_user_id := COALESCE(v_owner_user_id, v_current_user_id);

  -- 4. Realizar UPSERT seguro em public.clinic_subscriptions com parâmetros do Clínica Pro
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
    trial_max_attendances,
    trial_max_patients,
    trial_max_custom_forms,
    period_duration_days,
    current_period_start,
    current_period_end,
    expires_at,
    updated_at
  )
  VALUES (
    _clinic_id,
    v_owner_user_id,
    'clinic'::public.subscription_plan,
    'ANNUAL',
    'CREDIT_CARD',
    104.00, -- Base de referência Clínica Pro
    4,      -- 4 acessos simultâneos no teste gratuito
    0,
    30,     -- Limite de até 30 colaboradores base
    'TRIAL',
    true,
    false,
    20,
    5,
    2,      -- 2 formulários editáveis
    v_trial_duration_days,
    now(),
    v_expires_at,
    v_expires_at,
    now()
  )
  ON CONFLICT (clinic_id) DO UPDATE
  SET
    account_owner_user_id = COALESCE(clinic_subscriptions.account_owner_user_id, EXCLUDED.account_owner_user_id),
    plan_type = 'clinic'::public.subscription_plan,
    billing_cycle = 'ANNUAL',
    payment_method = 'CREDIT_CARD',
    base_monthly_price = 104.00,
    base_concurrent_access_count = 4,
    total_recurring_monthly_price = 0,
    base_subaccount_limit = 30,
    status = 'TRIAL',
    is_free_trial = true,
    is_read_only = false,
    trial_max_attendances = 20,
    trial_max_patients = 5,
    trial_max_custom_forms = 2,
    period_duration_days = v_trial_duration_days,
    current_period_start = now(),
    current_period_end = v_expires_at,
    expires_at = v_expires_at,
    updated_at = now();

  -- 5. Atualizar a clínica em public.clinics
  UPDATE public.clinics
  SET
    subscription_plan = 'clinic'::public.subscription_plan,
    concurrent_access_limit = 4,
    subaccount_limit = 30,
    updated_at = now()
  WHERE id = _clinic_id;

  RETURN jsonb_build_object(
    'success', true,
    'clinic_id', _clinic_id,
    'plan_type', 'clinic',
    'status', 'TRIAL',
    'is_free_trial', true,
    'concurrent_access_limit', 4,
    'trial_max_custom_forms', 2,
    'expires_at', v_expires_at,
    'message', 'Teste gratuito de 7 dias ativado com sucesso.'
  );
END;
$$;

-- [RPC/FUNCTION] activate_clinic_free_trial (schema.sql L891-L896)
CREATE OR REPLACE FUNCTION "public"."activate_clinic_free_trial"("_clinic_id" "uuid", "_plan_type" "public"."subscription_plan") RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.activate_clinic_free_trial(_clinic_id, _plan_type::text);
$$;

-- [RPC/FUNCTION] apply_user_punishment (schema.sql L902-L943)
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

-- [RPC/FUNCTION] assign_profile_public_code (schema.sql L949-L960)
CREATE OR REPLACE FUNCTION "public"."assign_profile_public_code"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NULLIF(trim(COALESCE(NEW.public_code, '')), '') IS NULL THEN
    NEW.public_code := public.generate_profile_public_code();
  END IF;

  RETURN NEW;
END;
$$;

-- [RPC/FUNCTION] buy_clinic_subaccount_extra_spaces (schema.sql L966-L1049)
CREATE OR REPLACE FUNCTION "public"."buy_clinic_subaccount_extra_spaces"("_clinic_id" "uuid", "_quantity" integer, "_billing_type" "text" DEFAULT 'PIX'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_current_user_id uuid := auth.uid();
  v_sub_record public.clinic_subscriptions%rowtype;
  v_unit_price numeric(10,2) := 5.00;
  v_total_price numeric(10,2);
  v_payment_id text;
  v_invoice_id uuid;
begin
  if not public.is_clinic_subscription_manager(v_current_user_id, _clinic_id) then
    raise exception 'Acesso negado: apenas o responsável pela clínica pode adquirir vagas extras.';
  end if;

  if coalesce(_quantity, 0) <= 0 then
    raise exception 'Quantidade de vagas inválida. Informe um valor maior que zero.';
  end if;

  v_total_price := _quantity * v_unit_price;

  -- Garante que existe registro de assinatura
  select * into v_sub_record from public.clinic_subscriptions where clinic_id = _clinic_id;
  if v_sub_record.id is null then
    insert into public.clinic_subscriptions (clinic_id, account_owner_user_id, plan_type, base_monthly_price, base_subaccount_limit, base_concurrent_access_count, status)
    values (_clinic_id, v_current_user_id, 'clinic', 60.00, 30, 2, 'BETA')
    returning * into v_sub_record;
  end if;

  if v_sub_record.plan_type = 'solo' then
    raise exception 'Não é possível comprar vagas extras no plano Solo. Faça upgrade para o plano Clínica primeiro.';
  end if;

  -- Incrementa vagas compradas em clinic_subscriptions
  update public.clinic_subscriptions
  set
    purchased_subaccount_extra_count = coalesce(purchased_subaccount_extra_count, 0) + _quantity,
    updated_at = now()
  where clinic_id = _clinic_id
  returning * into v_sub_record;

  -- Registra a fatura avulsa
  v_payment_id := 'EXP_' || replace(gen_random_uuid()::text, '-', '');

  insert into public.subscription_invoices (
    clinic_id,
    subscription_id,
    asaas_payment_id,
    charge_type,
    status,
    value,
    due_date,
    payment_date,
    billing_type,
    metadata
  )
  values (
    _clinic_id,
    v_sub_record.id,
    v_payment_id,
    'ONE_TIME_SUBACCOUNT_EXPANSION',
    'CONFIRMED',
    v_total_price,
    current_date,
    now(),
    _billing_type,
    jsonb_build_object(
      'purchased_quantity', _quantity,
      'unit_price', v_unit_price,
      'description', 'Compra avulsa de ' || _quantity || ' vagas de colaboradores'
    )
  )
  returning id into v_invoice_id;

  return jsonb_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'purchased_quantity', _quantity,
    'total_price', v_total_price,
    'new_subaccount_limit', v_sub_record.base_subaccount_limit + v_sub_record.purchased_subaccount_extra_count
  );
end;
$$;

-- [RPC/FUNCTION] can_read_clinic_data (schema.sql L1212-L1271)
CREATE OR REPLACE FUNCTION "public"."can_read_clinic_data"("_clinic_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sub record;
  v_is_owner boolean := false;
BEGIN
  IF v_uid IS NULL OR _clinic_id IS NULL THEN
    RETURN false;
  END IF;

  -- Platform admin bypass
  IF EXISTS (
    SELECT 1 FROM public.platform_admins pa
    WHERE pa.user_id = v_uid AND pa.is_active = true
  ) THEN
    RETURN true;
  END IF;

  -- Verificar se é owner
  IF EXISTS (
    SELECT 1 FROM public.clinics c
    WHERE c.id = _clinic_id AND c.account_owner_user_id = v_uid
  ) OR EXISTS (
    SELECT 1 FROM public.clinic_memberships cm
    WHERE cm.clinic_id = _clinic_id
      AND cm.user_id = v_uid
      AND cm.account_role = 'account_owner'
      AND cm.is_active = true
      AND cm.membership_status = 'active'
  ) THEN
    v_is_owner := true;
  END IF;

  -- Checar status da assinatura
  SELECT status, is_free_trial, expires_at, current_period_end INTO v_sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = _clinic_id
  LIMIT 1;

  IF FOUND THEN
    -- Se o status for TRIAL_EXPIRED e não for owner, bloqueia leitura completamente
    IF v_sub.status = 'TRIAL_EXPIRED' AND NOT v_is_owner THEN
      RETURN false;
    END IF;

    -- Se for trial expirado sem assinatura ativa e não for owner, bloqueia
    IF (v_sub.status = 'TRIAL' OR COALESCE(v_sub.is_free_trial, false) = true) AND NOT v_is_owner THEN
      IF COALESCE(v_sub.expires_at, v_sub.current_period_end) IS NOT NULL
         AND COALESCE(v_sub.expires_at, v_sub.current_period_end) < now() THEN
        RETURN false;
      END IF;
    END IF;
  END IF;

  RETURN true;
END;
$$;

-- [RPC/FUNCTION] cancel_clinic_collaborator_invitation (schema.sql L1360-L1408)
CREATE OR REPLACE FUNCTION "public"."cancel_clinic_collaborator_invitation"("_invitation_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _requester_id uuid := auth.uid();
  _invitation public.clinic_collaborator_invitations%ROWTYPE;
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT *
  INTO _invitation
  FROM public.clinic_collaborator_invitations
  WHERE id = _invitation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  IF NOT (
    public.current_user_can('subaccounts.delete', _invitation.clinic_id)
    OR public.current_user_can('subaccounts.write', _invitation.clinic_id)
    OR public.current_user_can('subaccounts.manage', _invitation.clinic_id)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para cancelar este convite.';
  END IF;

  IF _invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'Apenas convites pendentes podem ser cancelados.';
  END IF;

  UPDATE public.clinic_collaborator_invitations
  SET status = 'cancelled', updated_at = now()
  WHERE id = _invitation_id;

  PERFORM public.log_security_event(
    _invitation.clinic_id,
    _requester_id,
    _invitation.existing_user_id,
    'clinic_collaborator_invite_cancelled',
    'admin',
    jsonb_build_object('invitation_id', _invitation_id, 'email', _invitation.email)
  );

  RETURN jsonb_build_object('invitation_id', _invitation_id, 'status', 'cancelled');
END;
$$;

-- [RPC/FUNCTION] check_clinic_plan_quota (schema.sql L1414-L1514)
CREATE OR REPLACE FUNCTION "public"."check_clinic_plan_quota"("p_clinic_id" "uuid", "p_feature_type" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_sub record;
  v_count integer := 0;
  v_allowed boolean := true;
  v_limit integer := 0;
  v_is_trial boolean := false;
  v_message text := '';
  v_plan_text text;
BEGIN
  -- Buscar assinatura da clínica
  SELECT * INTO v_sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = p_clinic_id
  LIMIT 1;

  -- Se não encontrou ou se for trial / beta
  IF v_sub IS NULL OR v_sub.status = 'TRIAL' OR COALESCE(v_sub.is_free_trial, false) = true OR v_sub.status = 'BETA' THEN
    v_is_trial := true;
  END IF;

  v_plan_text := LOWER(COALESCE(v_sub.plan_type::text, 'clinica_medio'));

  -- Checagem de Atendimentos (Sessões)
  IF p_feature_type = 'attendances' THEN
    SELECT COUNT(*) INTO v_count
    FROM public.sessions
    WHERE clinic_id = p_clinic_id
      AND status NOT IN ('cancelado', 'rascunho');

    IF v_is_trial THEN
      v_limit := COALESCE(v_sub.trial_max_attendances, 20);
      IF v_count >= v_limit THEN
        v_allowed := false;
        v_message := 'Você atingiu o limite de ' || v_limit || ' atendimentos do seu período de teste grátis. Faça o upgrade para continuar evoluindo seus pacientes.';
      END IF;
    ELSE
      -- Ilimitado em todos os planos pagos
      v_limit := -1;
      v_allowed := true;
    END IF;

  -- Checagem de Pacientes
  ELSIF p_feature_type = 'patients' THEN
    SELECT COUNT(*) INTO v_count
    FROM public.patients
    WHERE clinic_id = p_clinic_id
      AND is_active = true;

    IF v_is_trial THEN
      v_limit := COALESCE(v_sub.trial_max_patients, 5);
      IF v_count >= v_limit THEN
        v_allowed := false;
        v_message := 'Você atingiu o limite de ' || v_limit || ' pacientes do seu período de teste grátis. Faça o upgrade para cadastrar novos pacientes.';
      END IF;
    ELSE
      -- Ilimitado em todos os planos pagos
      v_limit := -1;
      v_allowed := true;
    END IF;

  -- Checagem de Modelos de Formulário Personalizados
  ELSIF p_feature_type = 'custom_forms' THEN
    SELECT COUNT(*) INTO v_count
    FROM public.anamnesis_form_templates
    WHERE clinic_id = p_clinic_id
      AND is_system_default = false
      AND is_active = true;

    IF v_is_trial THEN
      v_limit := COALESCE(v_sub.trial_max_custom_forms, 1);
      IF v_count >= v_limit THEN
        v_allowed := false;
        v_message := 'O plano de teste grátis permite 1 modelo de formulário personalizado ativo. Faça o upgrade para criar modelos ilimitados.';
      END IF;
    ELSIF v_plan_text = 'prof_basico' THEN
      -- prof_basico tem cota de 1 formulário customizado complementar ativo
      v_limit := 1;
      IF v_count >= v_limit THEN
        v_allowed := false;
        v_message := 'O Plano Profissional Básico permite 1 modelo customizado ativo complementar ao formulário padrão universal. Faça upgrade para formulários ilimitados.';
      END IF;
    ELSE
      -- Todos os outros planos têm formulários customizados ilimitados (-1)
      v_limit := -1;
      v_allowed := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'current_count', v_count,
    'max_limit', v_limit,
    'is_free_trial', v_is_trial,
    'message', v_message
  );
END;
$$;

-- [RPC/FUNCTION] clear_current_user_notifications (schema.sql L1628-L1644)
CREATE OR REPLACE FUNCTION "public"."clear_current_user_notifications"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

-- [RPC/FUNCTION] create_clinic_subaccount (schema.sql L1719-L1895)
CREATE OR REPLACE FUNCTION "public"."create_clinic_subaccount"("_email" "text", "_password" "text", "_full_name" "text", "_operational_role" "public"."operational_role_type" DEFAULT 'professional'::"public"."operational_role_type", "_job_title" "text" DEFAULT NULL::"text", "_specialty" "text" DEFAULT NULL::"text", "_clinic_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

-- [RPC/FUNCTION] create_current_user_notification (schema.sql L1901-L1926)
CREATE OR REPLACE FUNCTION "public"."create_current_user_notification"("_clinic_id" "uuid", "_category" "text", "_event_type" "text", "_title" "text", "_body" "text", "_action_label" "text" DEFAULT NULL::"text", "_action_url" "text" DEFAULT NULL::"text", "_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

-- [RPC/FUNCTION] create_user_notification (schema.sql L2084-L2143)
CREATE OR REPLACE FUNCTION "public"."create_user_notification"("_user_id" "uuid", "_clinic_id" "uuid", "_actor_user_id" "uuid", "_category" "text", "_event_type" "text", "_title" "text", "_body" "text", "_action_label" "text" DEFAULT NULL::"text", "_action_url" "text" DEFAULT NULL::"text", "_payload" "jsonb" DEFAULT '{}'::"jsonb", "_source_event_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

-- [RPC/FUNCTION] current_user_can (schema.sql L2149-L2436)
CREATE OR REPLACE FUNCTION "public"."current_user_can"("_capability" "text", "_clinic_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _resolved_clinic_id uuid;
  _account_role public.account_role_type;
  _operational_role public.operational_role_type;
  _role_key text;
  _membership_status public.membership_status_type;
  _is_active boolean;
  _subscription_plan public.subscription_plan;
  _clinic_owner_id uuid;
  _override_enabled boolean;
  _sub record;
  _is_subscription_expired boolean := false;
  _is_read_only boolean := false;
  _is_owner boolean := false;
  _canonical_capability text := _capability;
  _is_clinic_tier boolean := false;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Normalização de capacidades sinônimas/canônicas
  IF _capability IN ('patient_groups.write', 'patients_groups.write') THEN
    _canonical_capability := 'patients.manage_groups';
  ELSIF _capability IN ('patient_groups.read') THEN
    _canonical_capability := 'patients_groups.read';
  ELSIF _capability = 'agenda.read' THEN
    _canonical_capability := 'schedule.read';
  ELSIF _capability = 'agenda.write' THEN
    _canonical_capability := 'schedule.write';
  END IF;

  _resolved_clinic_id := COALESCE(_clinic_id, public.get_user_clinic_id(_user_id));

  -- Bypass para Platform Owner em contexto ativo
  IF _resolved_clinic_id IS NOT NULL
    AND public.is_platform_owner(_user_id)
    AND public.get_active_platform_clinic_id(_user_id) = _resolved_clinic_id THEN
    RETURN true;
  END IF;

  SELECT
    clinic_memberships.account_role,
    clinic_memberships.operational_role,
    clinic_memberships.role_key,
    clinic_memberships.membership_status,
    clinic_memberships.is_active,
    clinics.subscription_plan,
    clinics.account_owner_user_id
  INTO
    _account_role,
    _operational_role,
    _role_key,
    _membership_status,
    _is_active,
    _subscription_plan,
    _clinic_owner_id
  FROM public.clinic_memberships
  JOIN public.clinics ON clinics.id = clinic_memberships.clinic_id
  WHERE clinic_memberships.user_id = _user_id
    AND clinic_memberships.clinic_id = _resolved_clinic_id
  LIMIT 1;

  IF _resolved_clinic_id IS NULL
    OR _is_active IS DISTINCT FROM true
    OR _membership_status IS DISTINCT FROM 'active' THEN
    RETURN false;
  END IF;

  _is_owner := (_account_role = 'account_owner' OR _operational_role = 'owner' OR _clinic_owner_id = _user_id);
  _is_clinic_tier := (_subscription_plan::text IN ('clinic', 'enterprise', 'clinica_basico', 'clinica_medio', 'clinica_top', 'prof_top'));

  -- 1. Checagem de Assinatura e Read-Only
  SELECT * INTO _sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = _resolved_clinic_id
  LIMIT 1;

  IF _sub IS NOT NULL THEN
    -- A. Bloqueio completo de colaboradores que NÃO sejam o owner quando status for TRIAL_EXPIRED
    IF _sub.status = 'TRIAL_EXPIRED' AND NOT _is_owner THEN
      RETURN false;
    END IF;

    -- B. Checagem de status TRIAL que expirou
    IF public.is_clinic_read_only(_resolved_clinic_id) THEN
      _is_read_only := true;
      -- Se for colaborador não-owner e o trial já expirou, bloqueia o acesso
      IF (_sub.status = 'TRIAL_EXPIRED' OR _sub.status = 'TRIAL' OR COALESCE(_sub.is_free_trial, false) = true) AND NOT _is_owner THEN
        RETURN false;
      END IF;
    END IF;

    -- C. Checagem de expiração regular (não-trial e não-cortesia)
    IF _sub.status NOT IN ('BETA', 'TRIAL', 'COURTESY') AND COALESCE(_sub.is_courtesy, false) = false THEN
      IF _sub.expires_at IS NOT NULL AND _sub.expires_at < now() THEN
        _is_subscription_expired := true;
      ELSIF _sub.status IN ('EXPIRED', 'SUSPENDED') THEN
        _is_subscription_expired := true;
      END IF;
    END IF;
  END IF;

  -- Se a clínica estiver em modo read-only ou com assinatura expirada:
  IF _is_read_only OR _is_subscription_expired THEN
    -- Owner pode gerenciar cobrança/assinatura para regularizar
    IF _capability = 'subscription_billing.manage' AND _is_owner THEN
      RETURN true;
    END IF;

    -- Permite APENAS permissões de leitura (.read)
    IF _capability IN (
      'patients.read',
      'schedule.read',
      'schedule.read_all',
      'agenda.read',
      'sessions.read',
      'sessions.read_all',
      'patient_groups.read',
      'patients_groups.read',
      'subaccounts_analytics.read',
      'subaccounts.read',
      'subaccounts_roles.read',
      'clinic_profile.read',
      'forms.read',
      'anamnesis_forms.read',
      'treasury.read',
      'subscription_billing.read'
    ) OR _canonical_capability IN (
      'patients.read',
      'schedule.read',
      'schedule.read_all',
      'agenda.read',
      'sessions.read',
      'sessions.read_all',
      'patient_groups.read',
      'patients_groups.read',
      'subaccounts_analytics.read',
      'subaccounts.read',
      'subaccounts_roles.read',
      'clinic_profile.read',
      'forms.read',
      'anamnesis_forms.read',
      'treasury.read',
      'subscription_billing.read'
    ) THEN
      RETURN true;
    END IF;

    -- Qualquer escrita ou deleção é ESTRITAMENTE bloqueada
    RETURN false;
  END IF;

  -- Se a clínica estiver normal e não expirada, o owner possui acesso pleno:
  IF _is_owner THEN
    RETURN true;
  END IF;

  IF _capability = 'subscription_billing.manage' THEN
    RETURN false;
  END IF;

  -- 2. Checagem de Override na tabela clinic_operational_role_capabilities
  -- Prioridade 1: checar pelo role_key específico (se existir)
  IF _role_key IS NOT NULL AND _role_key <> '' THEN
    SELECT enabled
    INTO _override_enabled
    FROM public.clinic_operational_role_capabilities
    WHERE clinic_id = _resolved_clinic_id
      AND operational_role = _role_key
      AND capability IN (_capability, _canonical_capability)
    ORDER BY (capability = _canonical_capability) DESC
    LIMIT 1;

    IF FOUND THEN
      RETURN _override_enabled;
    END IF;
  END IF;

  -- Prioridade 2: checar pelo operational_role padrão
  SELECT enabled
  INTO _override_enabled
  FROM public.clinic_operational_role_capabilities
  WHERE clinic_id = _resolved_clinic_id
    AND operational_role = _operational_role::text
    AND capability IN (_capability, _canonical_capability)
    ORDER BY (capability = _canonical_capability) DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN _override_enabled;
  END IF;

  -- 3. Matriz Padrão Canônica de Permissões
  CASE _capability
    WHEN 'clinic_profile.read' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'clinic_profile.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'clinic_terms.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'forms.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    WHEN 'forms.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.read' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.write' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.manage' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.delete' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_roles.read' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_roles.manage' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'subscription_billing.read' THEN
      RETURN _is_owner;
    WHEN 'team_development.manage' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'treasury.read' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'treasury.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'agenda.delete_events' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_analytics.read' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'patients.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
    WHEN 'patients.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
    WHEN 'patients.delete' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'patients.manage_groups', 'patient_groups.write', 'patients_groups.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
    WHEN 'patient_groups.read', 'patients_groups.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
    WHEN 'agenda.read', 'schedule.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    WHEN 'schedule.read_all' THEN
      RETURN _operational_role IN ('owner', 'admin', 'assistant');
    WHEN 'agenda.write', 'schedule.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    WHEN 'schedule.write_others' THEN
      RETURN _operational_role IN ('owner', 'admin', 'assistant');
    WHEN 'sessions.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'estagiario');
    WHEN 'sessions.read_all' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'sessions.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'estagiario');
    WHEN 'sessions.write_others' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'sessions.share' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    WHEN 'sessions.delete' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'session.delete_draft' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    WHEN 'system.print' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    ELSE
      -- Fallback para conferir capacidade canônica caso informada como alias
      IF _canonical_capability <> _capability THEN
        CASE _canonical_capability
          WHEN 'patients.manage_groups' THEN
            RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
          WHEN 'patients_groups.read' THEN
            RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
          WHEN 'schedule.read' THEN
            RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
          WHEN 'schedule.write' THEN
            RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
          ELSE
            RETURN false;
        END CASE;
      END IF;
      RETURN false;
  END CASE;
END;
$$;

-- [RPC/FUNCTION] current_user_is_clinic_manager (schema.sql L2442-L2447)
CREATE OR REPLACE FUNCTION "public"."current_user_is_clinic_manager"("_clinic_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.current_user_can('subaccounts_roles.manage', _clinic_id);
$$;

-- [RPC/FUNCTION] decline_current_user_clinic_invitation (schema.sql L2453-L2504)
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

-- [RPC/FUNCTION] delete_current_user_notification (schema.sql L2510-L2527)
CREATE OR REPLACE FUNCTION "public"."delete_current_user_notification"("_notification_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

-- [RPC/FUNCTION] enforce_clinic_membership_integrity (schema.sql L2738-L2770)
CREATE OR REPLACE FUNCTION "public"."enforce_clinic_membership_integrity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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
      OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id
      OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'A conta principal nao pode ser alterada por este fluxo.';
    END IF;
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

-- [RPC/FUNCTION] ensure_team_development_profile (schema.sql L3055-L3109)
CREATE OR REPLACE FUNCTION "public"."ensure_team_development_profile"("_clinic_id" "uuid", "_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _profile_id uuid;
  _last_seen_at timestamptz;
  _operational_role public.operational_role_type;
BEGIN
  SELECT id
  INTO _profile_id
  FROM public.team_development_profiles
  WHERE clinic_id = _clinic_id
    AND user_id = _user_id;

  IF _profile_id IS NOT NULL THEN
    RETURN _profile_id;
  END IF;

  SELECT last_seen_at
  INTO _last_seen_at
  FROM public.profiles
  WHERE id = _user_id;

  SELECT operational_role
  INTO _operational_role
  FROM public.clinic_memberships
  WHERE clinic_id = _clinic_id
    AND user_id = _user_id
  ORDER BY created_at ASC
  LIMIT 1;

  INSERT INTO public.team_development_profiles (
    clinic_id,
    user_id,
    development_status,
    internal_level
  )
  VALUES (
    _clinic_id,
    _user_id,
    CASE
      WHEN _last_seen_at IS NULL THEN 'onboarding'
      ELSE 'em_evolucao'
    END,
    CASE
      WHEN _operational_role IN ('owner', 'admin') THEN 'senior'
      ELSE 'junior'
    END
  )
  RETURNING id INTO _profile_id;

  RETURN _profile_id;
END;
$$;

-- [RPC/FUNCTION] ensure_team_development_profile_from_membership (schema.sql L3115-L3123)
CREATE OR REPLACE FUNCTION "public"."ensure_team_development_profile_from_membership"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.ensure_team_development_profile(NEW.clinic_id, NEW.user_id);
  RETURN NEW;
END;
$$;

-- [RPC/FUNCTION] generate_profile_public_code (schema.sql L3298-L3318)
CREATE OR REPLACE FUNCTION "public"."generate_profile_public_code"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _candidate text;
  _exists boolean;
BEGIN
  LOOP
    _candidate := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    SELECT EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE public_code = _candidate
    ) INTO _exists;
    EXIT WHEN NOT _exists;
  END LOOP;

  RETURN _candidate;
END;
$$;

-- [RPC/FUNCTION] generate_profile_public_code_for_clinic (schema.sql L3324-L3331)
CREATE OR REPLACE FUNCTION "public"."generate_profile_public_code_for_clinic"("_clinic_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN public.generate_profile_public_code();
END;
$$;

-- [RPC/FUNCTION] get_clinic_collaborator_invitation (schema.sql L3388-L3475)
CREATE OR REPLACE FUNCTION "public"."get_clinic_collaborator_invitation"("_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions'
    AS $$
DECLARE
  _invitation public.clinic_collaborator_invitations%ROWTYPE;
  _clinic_name text;
  _is_existing_user boolean := false;
  _user_id uuid;
  _has_cpf boolean := false;
  _raw_cpf text;
  _token_clean text := trim(coalesce(_token, ''));
  _sha256_hash text;
BEGIN
  BEGIN
    _sha256_hash := encode(extensions.digest(_token_clean, 'sha256'), 'hex');
  EXCEPTION WHEN OTHERS THEN
    _sha256_hash := NULL;
  END;

  SELECT *
  INTO _invitation
  FROM public.clinic_collaborator_invitations
  WHERE token_hash = md5(_token_clean)
     OR (_sha256_hash IS NOT NULL AND token_hash = _sha256_hash)
  LIMIT 1;

  IF _invitation.id IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  IF _invitation.status = 'pending' AND _invitation.expires_at < now() THEN
    UPDATE public.clinic_collaborator_invitations
    SET status = 'expired', updated_at = now()
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
    'role_key', _invitation.role_key,
    'job_title', _invitation.job_title,
    'specialty', _invitation.specialty,
    'status', _invitation.status,
    'email_delivery_status', _invitation.email_delivery_status,
    'existing_user', _is_existing_user,
    'has_cpf', _has_cpf,
    'pending_cpf_completion', (_is_existing_user AND NOT _has_cpf),
    'expires_at', _invitation.expires_at
  );
END;
$$;

-- [RPC/FUNCTION] get_clinic_dashboard_analytics (schema.sql L3481-L3964)
CREATE OR REPLACE FUNCTION "public"."get_clinic_dashboard_analytics"("_clinic_id" "uuid", "_year" integer DEFAULT NULL::integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _target_year int := COALESCE(_year, EXTRACT(YEAR FROM now())::int);
  _result jsonb;

  _total_sessions int := 0;
  _canceled_sessions int := 0;
  _paid_sessions int := 0;
  _today_sessions int := 0;
  _week_sessions int := 0;
  _month_sessions int := 0;
  _year_sessions int := 0;

  _financial_paid bigint := 0;
  _financial_credit bigint := 0;
  _financial_open bigint := 0;
  _forecast_revenue_cents bigint := 0;

  _payment_status_counts jsonb;
  _payment_method_counts jsonb;
  _patient_status_counts jsonb;

  _total_patients int := 0;
  _recurring_patients int := 0;

  _agenda_late int := 0;
  _agenda_confirmed int := 0;
  _agenda_awaiting int := 0;
  _agenda_total int := 0;

  _monthly_revenue jsonb;
  _last_30_days jsonb;
  _weekday_distribution jsonb;
  _top_groups jsonb;
  _collaborators jsonb;

  -- Packages metrics
  _packages_total int := 0;
  _packages_in_progress int := 0;
  _packages_completed int := 0;
  _packages_canceled int := 0;
  _packages_total_revenue_cents bigint := 0;
  _packages_paid_revenue_cents bigint := 0;
  _packages_open_revenue_cents bigint := 0;
  _packages_total_sessions_contracted int := 0;
  _packages_total_sessions_used int := 0;
  _packages_total_sessions_remaining int := 0;
  _packages_status_counts jsonb;
  _packages_list jsonb;

  _is_platform_actor boolean := false;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  -- Verifica se é platform owner ou tem sessão ativa de suporte/simulação
  _is_platform_actor := (
    public.is_platform_owner(_user_id) OR
    public.is_platform_owner_mfa_verified(_user_id) OR
    EXISTS (
      SELECT 1
      FROM public.platform_clinic_access_sessions
      WHERE actor_user_id = _user_id
        AND clinic_id = _clinic_id
        AND ended_at IS NULL
    )
  );

  IF NOT (
    _is_platform_actor OR
    public.current_user_can('treasury.manage', _clinic_id) OR
    public.current_user_can('sessions.read', _clinic_id) OR
    public.current_user_can('patients.read', _clinic_id)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para visualizar estatísticas desta clínica.';
  END IF;

  -- 1. Sessões: Contagens gerais e períodos
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE status = 'cancelado')::int,
    COUNT(*) FILTER (WHERE COALESCE(amount_charged_cents, 0) > 0 AND COALESCE(amount_paid_cents, 0) >= COALESCE(amount_charged_cents, 0))::int,
    COUNT(*) FILTER (WHERE session_date::date = CURRENT_DATE)::int,
    COUNT(*) FILTER (WHERE session_date >= date_trunc('week', now()))::int,
    COUNT(*) FILTER (WHERE session_date >= date_trunc('month', now()))::int,
    COUNT(*) FILTER (WHERE session_date >= date_trunc('year', now()))::int,
    COALESCE(SUM(CASE WHEN payment_status <> 'cortesia' THEN LEAST(COALESCE(amount_paid_cents, 0), COALESCE(amount_charged_cents, 0)) ELSE 0 END), 0)::bigint,
    COALESCE(SUM(CASE WHEN payment_status <> 'cortesia' THEN GREATEST(0, COALESCE(amount_paid_cents, 0) - COALESCE(amount_charged_cents, 0)) ELSE 0 END), 0)::bigint,
    COALESCE(SUM(CASE WHEN payment_status <> 'cortesia' THEN GREATEST(0, COALESCE(amount_charged_cents, 0) - COALESCE(amount_paid_cents, 0)) ELSE 0 END), 0)::bigint
  INTO
    _total_sessions,
    _canceled_sessions,
    _paid_sessions,
    _today_sessions,
    _week_sessions,
    _month_sessions,
    _year_sessions,
    _financial_paid,
    _financial_credit,
    _financial_open
  FROM public.sessions
  WHERE clinic_id = _clinic_id;

  _forecast_revenue_cents := _financial_paid + _financial_credit + _financial_open;

  -- 2. Status de Pagamento (Contagens)
  SELECT jsonb_build_object(
    'cortesia', COUNT(*) FILTER (WHERE payment_status = 'cortesia')::int,
    'credit', COUNT(*) FILTER (WHERE COALESCE(payment_status, '') <> 'cortesia' AND COALESCE(amount_paid_cents, 0) > COALESCE(amount_charged_cents, 0))::int,
    'debt', COUNT(*) FILTER (WHERE COALESCE(payment_status, '') <> 'cortesia' AND COALESCE(amount_charged_cents, 0) > 0 AND COALESCE(amount_paid_cents, 0) > 0 AND COALESCE(amount_paid_cents, 0) < COALESCE(amount_charged_cents, 0))::int,
    'pending', COUNT(*) FILTER (WHERE COALESCE(payment_status, '') <> 'cortesia' AND COALESCE(amount_charged_cents, 0) > 0 AND COALESCE(amount_paid_cents, 0) <= 0)::int,
    'paid', COUNT(*) FILTER (WHERE COALESCE(payment_status, '') <> 'cortesia' AND COALESCE(amount_charged_cents, 0) > 0 AND COALESCE(amount_paid_cents, 0) >= COALESCE(amount_charged_cents, 0))::int,
    'notCharged', COUNT(*) FILTER (WHERE COALESCE(payment_status, '') <> 'cortesia' AND COALESCE(amount_charged_cents, 0) <= 0 AND COALESCE(amount_paid_cents, 0) <= 0)::int
  )
  INTO _payment_status_counts
  FROM public.sessions
  WHERE clinic_id = _clinic_id;

  -- 3. Métodos de Pagamento (Agrupados)
  SELECT COALESCE(jsonb_object_agg(sub.method_key, sub.cnt), '{}'::jsonb)
  INTO _payment_method_counts
  FROM (
    SELECT
      CASE
        WHEN payment_status = 'cortesia' THEN 'cortesia'
        WHEN payment_method IS NOT NULL AND payment_method <> '' THEN payment_method
        ELSE 'nao_informado'
      END AS method_key,
      COUNT(*)::int AS cnt
    FROM public.sessions
    WHERE clinic_id = _clinic_id
    GROUP BY 1
  ) sub;

  -- 4. Pacientes (Status e Recorrência)
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE (recurring_weekdays IS NOT NULL AND cardinality(recurring_weekdays) > 0) OR is_recurring = true)::int
  INTO
    _total_patients,
    _recurring_patients
  FROM public.patients
  WHERE clinic_id = _clinic_id;

  SELECT COALESCE(jsonb_object_agg(COALESCE(ps.status, 'ativo'), ps.cnt), '{}'::jsonb)
  INTO _patient_status_counts
  FROM (
    SELECT COALESCE(status, 'ativo') AS status, COUNT(*)::int AS cnt
    FROM public.patients
    WHERE clinic_id = _clinic_id
    GROUP BY COALESCE(status, 'ativo')
  ) ps;

  -- 5. Agenda de Atendimentos
  SELECT
    COUNT(*) FILTER (WHERE status <> 'cancelado' AND scheduled_for < now())::int,
    COUNT(*) FILTER (WHERE status = 'confirmado' AND scheduled_for >= now())::int,
    COUNT(*) FILTER (WHERE status <> 'cancelado' AND status <> 'confirmado' AND scheduled_for >= now())::int,
    COUNT(*) FILTER (WHERE status <> 'cancelado')::int
  INTO
    _agenda_late,
    _agenda_confirmed,
    _agenda_awaiting,
    _agenda_total
  FROM public.agenda_events
  WHERE clinic_id = _clinic_id;

  -- 6. Receita Mensal do Ano Selecionado (12 meses garantidos)
  WITH months AS (
    SELECT m_idx FROM generate_series(1, 12) AS m_idx
  ),
  month_names AS (
    SELECT ARRAY['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] AS names
  ),
  monthly_agg AS (
    SELECT
      EXTRACT(MONTH FROM session_date)::int AS m_idx,
      COALESCE(SUM(CASE WHEN payment_status <> 'cortesia' THEN LEAST(COALESCE(amount_paid_cents, 0), COALESCE(amount_charged_cents, 0)) ELSE 0 END), 0)::numeric / 100.0 AS pago,
      COALESCE(SUM(CASE WHEN payment_status <> 'cortesia' THEN GREATEST(0, COALESCE(amount_charged_cents, 0) - COALESCE(amount_paid_cents, 0)) ELSE 0 END), 0)::numeric / 100.0 AS em_aberto,
      COUNT(*)::int AS atendimentos
    FROM public.sessions
    WHERE clinic_id = _clinic_id
      AND EXTRACT(YEAR FROM session_date)::int = _target_year
    GROUP BY EXTRACT(MONTH FROM session_date)::int
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'label', (SELECT names[m.m_idx] FROM month_names),
      'pago', COALESCE(ma.pago, 0),
      'emAberto', COALESCE(ma.em_aberto, 0),
      'atendimentos', COALESCE(ma.atendimentos, 0)
    ) ORDER BY m.m_idx ASC
  )
  INTO _monthly_revenue
  FROM months m
  LEFT JOIN monthly_agg ma ON ma.m_idx = m.m_idx;

  -- 7. Atendimentos nos Últimos 30 Dias (30 dias garantidos)
  WITH days AS (
    SELECT (CURRENT_DATE - (29 - d_idx) * interval '1 day')::date AS day_date
    FROM generate_series(0, 29) AS d_idx
  ),
  daily_agg AS (
    SELECT
      session_date::date AS d_date,
      COUNT(*)::int AS atendimentos
    FROM public.sessions
    WHERE clinic_id = _clinic_id
      AND session_date::date >= (CURRENT_DATE - interval '29 days')::date
    GROUP BY session_date::date
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'label', to_char(d.day_date, 'DD/MM'),
      'atendimentos', COALESCE(da.atendimentos, 0)
    ) ORDER BY d.day_date ASC
  )
  INTO _last_30_days
  FROM days d
  LEFT JOIN daily_agg da ON da.d_date = d.day_date;

  -- 8. Distribuição por Dia da Semana (0=Dom a 6=Sáb)
  WITH weekdays AS (
    SELECT dow_idx FROM generate_series(0, 6) AS dow_idx
  ),
  weekday_names AS (
    SELECT ARRAY['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] AS names
  ),
  weekday_agg AS (
    SELECT
      EXTRACT(DOW FROM session_date)::int AS dow,
      COUNT(*)::int AS atendimentos
    FROM public.sessions
    WHERE clinic_id = _clinic_id
    GROUP BY EXTRACT(DOW FROM session_date)::int
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'label', (SELECT names[w.dow_idx + 1] FROM weekday_names),
      'atendimentos', COALESCE(wa.atendimentos, 0)
    ) ORDER BY w.dow_idx ASC
  )
  INTO _weekday_distribution
  FROM weekdays w
  LEFT JOIN weekday_agg wa ON wa.dow = w.dow_idx;

  -- 9. Top Grupos / Linhas de Cuidado (Mais Atendidos)
  WITH resolved_sessions AS (
    SELECT
      s.id,
      COALESCE(
        s.group_id,
        (
          SELECT pg2.id
          FROM public.patient_groups pg2
          WHERE pg2.patient_id = s.patient_id
          ORDER BY pg2.is_default DESC, pg2.created_at ASC
          LIMIT 1
        )
      ) AS resolved_group_id
    FROM public.sessions s
    WHERE s.clinic_id = _clinic_id
  ),
  group_counts AS (
    SELECT
      COALESCE(pg.name, 'Sem grupo') AS group_name,
      COALESCE(cs.color_hex, pg.color, '#64748b') AS group_color,
      COUNT(*)::int AS total
    FROM resolved_sessions rs
    LEFT JOIN public.patient_groups pg ON pg.id = rs.resolved_group_id
    LEFT JOIN public.clinic_group_color_slots cs ON cs.id = pg.clinic_color_slot_id
    GROUP BY COALESCE(pg.name, 'Sem grupo'), COALESCE(cs.color_hex, pg.color, '#64748b')
    ORDER BY total DESC
    LIMIT 8
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', gc.group_name,
        'color', gc.group_color,
        'total', gc.total
      )
    ),
    '[]'::jsonb
  )
  INTO _top_groups
  FROM group_counts gc;

  -- 10. Produtividade por Colaborador
  WITH collab_sessions AS (
    SELECT
      COALESCE(s.provider_id, s.user_id, '00000000-0000-0000-0000-000000000000'::uuid) AS collaborator_id,
      CASE WHEN s.payment_status <> 'cortesia' THEN LEAST(COALESCE(s.amount_paid_cents, 0), COALESCE(s.amount_charged_cents, 0)) ELSE 0 END AS paid_cents
    FROM public.sessions s
    WHERE s.clinic_id = _clinic_id
  ),
  collab_agg AS (
    SELECT
      cs.collaborator_id,
      COUNT(*)::int AS total,
      SUM(cs.paid_cents)::numeric / 100.0 AS receita
    FROM collab_sessions cs
    GROUP BY cs.collaborator_id
    ORDER BY total DESC
    LIMIT 8
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'label', COALESCE(
          NULLIF(trim(p.full_name), ''),
          NULLIF(trim(p.social_name), ''),
          CASE
            WHEN p.job_title IS NOT NULL AND p.public_code IS NOT NULL THEN p.job_title || ' (' || p.public_code || ')'
            WHEN p.public_code IS NOT NULL THEN 'Colaborador ' || p.public_code
            WHEN p.email IS NOT NULL THEN p.email
            ELSE 'Colaborador'
          END
        ),
        'total', ca.total,
        'receita', ca.receita
      )
    ),
    '[]'::jsonb
  )
  INTO _collaborators
  FROM collab_agg ca
  LEFT JOIN public.profiles p ON p.id = ca.collaborator_id;

  -- 11. Estatísticas de Pacotes de Atendimentos (patient_payment_plans)
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE payment_status <> 'cancelado' AND used_sessions < total_sessions)::int,
    COUNT(*) FILTER (WHERE payment_status <> 'cancelado' AND used_sessions >= total_sessions)::int,
    COUNT(*) FILTER (WHERE payment_status = 'cancelado')::int,
    COALESCE(SUM(total_amount_cents), 0)::bigint,
    COALESCE(SUM(CASE 
      WHEN payment_status = 'pago' THEN total_amount_cents
      WHEN payment_status = 'parcial' THEN (total_amount_cents / 2)
      ELSE 0 
    END), 0)::bigint,
    COALESCE(SUM(CASE 
      WHEN payment_status = 'pendente' THEN total_amount_cents
      WHEN payment_status = 'parcial' THEN (total_amount_cents - (total_amount_cents / 2))
      ELSE 0 
    END), 0)::bigint,
    COALESCE(SUM(total_sessions), 0)::int,
    COALESCE(SUM(used_sessions), 0)::int,
    COALESCE(SUM(GREATEST(0, total_sessions - used_sessions)), 0)::int
  INTO
    _packages_total,
    _packages_in_progress,
    _packages_completed,
    _packages_canceled,
    _packages_total_revenue_cents,
    _packages_paid_revenue_cents,
    _packages_open_revenue_cents,
    _packages_total_sessions_contracted,
    _packages_total_sessions_used,
    _packages_total_sessions_remaining
  FROM public.patient_payment_plans
  WHERE clinic_id = _clinic_id;

  SELECT jsonb_build_object(
    'pago', COUNT(*) FILTER (WHERE payment_status = 'pago')::int,
    'parcial', COUNT(*) FILTER (WHERE payment_status = 'parcial')::int,
    'pendente', COUNT(*) FILTER (WHERE payment_status = 'pendente')::int,
    'cancelado', COUNT(*) FILTER (WHERE payment_status = 'cancelado')::int
  )
  INTO _packages_status_counts
  FROM public.patient_payment_plans
  WHERE clinic_id = _clinic_id;

  -- Lista de pacotes com dados do paciente para visualização direta
  WITH plans_with_patient AS (
    SELECT
      ppp.id,
      ppp.patient_id,
      p.name AS patient_name,
      p.patient_code,
      ppp.name AS plan_name,
      ppp.total_sessions,
      ppp.used_sessions,
      GREATEST(0, ppp.total_sessions - ppp.used_sessions) AS remaining_sessions,
      CASE 
        WHEN ppp.total_sessions > 0 THEN LEAST(100, ROUND((ppp.used_sessions::numeric / ppp.total_sessions::numeric) * 100.0, 1))
        ELSE 0
      END AS progress_percentage,
      ppp.total_amount_cents,
      ppp.payment_status,
      ppp.payment_method,
      ppp.payment_installments,
      (ppp.used_sessions >= ppp.total_sessions) AS is_completed,
      ppp.start_date,
      ppp.created_at
    FROM public.patient_payment_plans ppp
    LEFT JOIN public.patients p ON p.id = ppp.patient_id
    WHERE ppp.clinic_id = _clinic_id
    ORDER BY ppp.created_at DESC
    LIMIT 30
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', pwp.id,
        'patientId', pwp.patient_id,
        'patientName', COALESCE(pwp.patient_name, 'Paciente não identificado'),
        'patientCode', pwp.patient_code,
        'planName', pwp.plan_name,
        'totalSessions', pwp.total_sessions,
        'usedSessions', pwp.used_sessions,
        'remainingSessions', pwp.remaining_sessions,
        'progressPercentage', pwp.progress_percentage,
        'totalAmountCents', pwp.total_amount_cents,
        'paymentStatus', pwp.payment_status,
        'paymentMethod', pwp.payment_method,
        'paymentInstallments', pwp.payment_installments,
        'isCompleted', pwp.is_completed,
        'startDate', pwp.start_date,
        'createdAt', pwp.created_at
      )
    ),
    '[]'::jsonb
  )
  INTO _packages_list
  FROM plans_with_patient pwp;

  -- 12. Montagem do Resultado Final Consolidado
  _result := jsonb_build_object(
    'year', _target_year,
    'totalSessions', _total_sessions,
    'paidSessions', _paid_sessions,
    'canceledSessions', _canceled_sessions,
    'cancellationRate', CASE WHEN _total_sessions > 0 THEN ROUND((_canceled_sessions::numeric / _total_sessions::numeric) * 100.0, 1) ELSE 0 END,
    'todaySessions', _today_sessions,
    'weekSessions', _week_sessions,
    'monthSessions', _month_sessions,
    'yearSessions', _year_sessions,
    'financialTotals', jsonb_build_object(
      'paid', _financial_paid,
      'credit', _financial_credit,
      'open', _financial_open,
      'forecastRevenueCents', _forecast_revenue_cents
    ),
    'paymentStatusCounts', COALESCE(_payment_status_counts, '{}'::jsonb),
    'paymentMethodCounts', COALESCE(_payment_method_counts, '{}'::jsonb),
    'patientStatusCounts', COALESCE(_patient_status_counts, '{}'::jsonb),
    'totalPatients', COALESCE(_total_patients, 0),
    'recurringPatients', COALESCE(_recurring_patients, 0),
    'agendaCounts', jsonb_build_object(
      'late', _agenda_late,
      'confirmed', _agenda_confirmed,
      'awaiting', _agenda_awaiting,
      'total', _agenda_total
    ),
    'monthlyRevenue', COALESCE(_monthly_revenue, '[]'::jsonb),
    'last30Days', COALESCE(_last_30_days, '[]'::jsonb),
    'weekdayDistribution', COALESCE(_weekday_distribution, '[]'::jsonb),
    'topGroups', COALESCE(_top_groups, '[]'::jsonb),
    'collaborators', COALESCE(_collaborators, '[]'::jsonb),
    'packageAnalytics', jsonb_build_object(
      'total', _packages_total,
      'inProgress', _packages_in_progress,
      'completed', _packages_completed,
      'canceled', _packages_canceled,
      'totalRevenueCents', _packages_total_revenue_cents,
      'paidRevenueCents', _packages_paid_revenue_cents,
      'openRevenueCents', _packages_open_revenue_cents,
      'totalSessionsContracted', _packages_total_sessions_contracted,
      'totalSessionsUsed', _packages_total_sessions_used,
      'totalSessionsRemaining', _packages_total_sessions_remaining,
      'statusCounts', COALESCE(_packages_status_counts, '{}'::jsonb),
      'plansList', COALESCE(_packages_list, '[]'::jsonb)
    )
  );

  RETURN _result;
END;
$$;

-- [RPC/FUNCTION] get_clinic_feature_flags (schema.sql L3970-L4022)
CREATE OR REPLACE FUNCTION "public"."get_clinic_feature_flags"("_clinic_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  _user_id uuid := auth.uid();
  _result jsonb;
begin
  if _user_id is null then
    return '{}'::jsonb;
  end if;

  -- Verificar se usuario tem acesso (platform owner na visao ou membro da clinica)
  -- NOTA: O platform owner acessando via "start_platform_clinic_access" ja fica 
  -- com membership_status = 'active' em "clinic_memberships" (ver is_platform_owner em useAuth / membership simulada), 
  -- mas apenas localmente. Entao, ou ele eh platform owner MFA verified, ou tem membership.
  if not (
    public.is_platform_owner_mfa_verified(_user_id) or 
    exists (
      select 1 from public.clinic_memberships 
      where user_id = _user_id and clinic_id = _clinic_id and membership_status = 'active' and is_active = true
    )
  ) then
    return '{}'::jsonb;
  end if;

  select coalesce(jsonb_object_agg(sub.key, sub.value), '{}'::jsonb)
  into _result
  from (
    select distinct on (key)
      key,
      value
    from public.feature_flags
    where (
      scope = 'global'
      or (scope = 'clinic' and clinic_id = _clinic_id)
      or (scope = 'tag' and tag_id in (
        select tag_id from public.clinic_tag_relations where clinic_id = _clinic_id
      ))
    )
    and (starts_at is null or starts_at <= now())
    and (expires_at is null or expires_at > now())
    order by key,
      case scope
        when 'clinic' then 1
        when 'tag' then 2
        when 'global' then 3
      end
  ) sub;

  return _result;
end;
$$;

-- [RPC/FUNCTION] get_clinic_pending_collaborator_invitations (schema.sql L4028-L4082)
CREATE OR REPLACE FUNCTION "public"."get_clinic_pending_collaborator_invitations"("_clinic_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  _requester_id uuid := auth.uid();
  _invitations jsonb;
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF NOT (
    public.current_user_can('subaccounts.manage', _clinic_id) OR
    public.current_user_can('subaccounts_roles.manage', _clinic_id) OR
    public.is_platform_owner_mfa_verified(_requester_id)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para visualizar convites desta clínica.';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'clinic_id', i.clinic_id,
      'email', i.email,
      'operational_role', i.operational_role,
      'job_title', i.job_title,
      'specialty', i.specialty,
      'token_hash', i.token_hash,
      'status', i.status,
      'created_at', i.created_at,
      'last_resent_at', i.last_resent_at,
      'expires_at', i.expires_at,
      'existing_user_id', i.existing_user_id,
      'account_state', CASE
        WHEN u.id IS NOT NULL AND u.email_confirmed_at IS NULL THEN 'registered_unconfirmed'
        WHEN u.id IS NOT NULL AND u.email_confirmed_at IS NOT NULL THEN 'registered_confirmed_pending_acceptance'
        ELSE 'invite_sent'
      END,
      'pending_reason', CASE
        WHEN u.id IS NOT NULL AND u.email_confirmed_at IS NULL THEN 'Conta criada no sistema. Aguardando confirmação do e-mail cadastrado.'
        WHEN u.id IS NOT NULL AND u.email_confirmed_at IS NOT NULL THEN 'E-mail verificado! Aguardando login para ativar o acesso à clínica.'
        ELSE 'Convite enviado por e-mail. Aguardando abertura do link e cadastro da senha.'
      END
    ) ORDER BY i.created_at DESC
  )
  INTO _invitations
  FROM public.clinic_collaborator_invitations i
  LEFT JOIN auth.users u ON lower(u.email) = lower(i.email)
  WHERE i.clinic_id = _clinic_id
    AND i.status = 'pending';

  RETURN COALESCE(_invitations, '[]'::jsonb);
END;
$$;

-- [RPC/FUNCTION] get_clinic_share_collaborators (schema.sql L4088-L4116)
CREATE OR REPLACE FUNCTION "public"."get_clinic_share_collaborators"("_clinic_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH resolved AS (
    SELECT COALESCE(_clinic_id, public.get_user_clinic_id(auth.uid())) AS clinic_id
  )
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'id', profiles.id,
        'full_name', profiles.full_name,
        'email', profiles.email,
        'job_title', profiles.job_title,
        'operational_role', clinic_memberships.operational_role
      )
      ORDER BY profiles.full_name NULLS LAST, profiles.email
    ),
    '[]'::json
  )
  FROM resolved
  JOIN public.clinic_memberships
    ON clinic_memberships.clinic_id = resolved.clinic_id
    AND clinic_memberships.is_active = true
    AND clinic_memberships.membership_status = 'active'
  JOIN public.profiles
    ON profiles.id = clinic_memberships.user_id
  WHERE public.current_user_can('sessions.read', resolved.clinic_id);
$$;

-- [RPC/FUNCTION] get_clinic_active_terms (schema.sql L4122-L4175)
CREATE OR REPLACE FUNCTION "public"."get_clinic_active_terms"("p_clinic_id" "uuid") RETURNS TABLE("term_type" "text", "is_custom" boolean, "id" "uuid", "clinic_id" "uuid", "original_filename" "text", "content_markdown" "text", "b2_object_key" "text", "byte_size" integer, "compressed_byte_size" integer, "storage_encoding" "text", "version" integer, "uploaded_by" "uuid", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_has_access boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Acesso não autenticado' USING ERRCODE = '42501';
  END IF;

  -- Checa se o usuário tem permissão para ler dados desta clínica
  IF public.get_user_clinic_id(v_user_id) = p_clinic_id
     OR public.is_platform_owner(v_user_id)
     OR EXISTS (
       SELECT 1 FROM public.clinic_memberships cm
       WHERE cm.clinic_id = p_clinic_id
         AND cm.user_id = v_user_id
         AND cm.is_active = true
         AND cm.membership_status = 'active'
     ) THEN
    v_has_access := true;
  END IF;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Acesso não autorizado para esta clínica' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH requested_types AS (
    SELECT unnest(ARRAY['adult_consent', 'minor_consent']) AS expected_type
  )
  SELECT
    rt.expected_type AS term_type,
    (ct.id IS NOT NULL) AS is_custom,
    ct.id,
    p_clinic_id AS clinic_id,
    COALESCE(ct.original_filename, rt.expected_type || '_padrao.md') AS original_filename,
    COALESCE(ct.content_markdown, '') AS content_markdown,
    COALESCE(ct.b2_object_key, '') AS b2_object_key,
    COALESCE(ct.byte_size, 0) AS byte_size,
    COALESCE(ct.compressed_byte_size, 0) AS compressed_byte_size,
    COALESCE(ct.storage_encoding, 'gzip') AS storage_encoding,
    COALESCE(ct.version, 1) AS version,
    ct.uploaded_by,
    ct.created_at,
    ct.updated_at
  FROM requested_types rt
  LEFT JOIN public.clinic_terms ct
    ON ct.clinic_id = p_clinic_id
   AND ct.term_type = rt.expected_type;
END;
$$;

-- [RPC/FUNCTION] get_clinic_subscription_summary (schema.sql L4180-L4262)
CREATE OR REPLACE FUNCTION "public"."get_clinic_subscription_summary"("_clinic_id" "uuid") RETURNS TABLE("subscription_id" "uuid", "clinic_id" "uuid", "account_owner_user_id" "uuid", "plan_type" "public"."subscription_plan", "status" "text", "billing_cycle" "text", "payment_method" "text", "base_monthly_price" numeric, "total_recurring_monthly_price" numeric, "base_subaccount_limit" integer, "purchased_subaccount_extra_count" integer, "total_subaccount_limit" integer, "base_concurrent_access_count" integer, "additional_concurrent_access_count" integer, "total_concurrent_access_limit" integer, "next_due_date" "date", "current_period_start" timestamp with time zone, "current_period_end" timestamp with time zone, "expires_at" timestamp with time zone, "period_duration_days" integer, "auto_renew" boolean, "days_remaining" integer, "is_expired" boolean, "asaas_customer_id" "text", "asaas_subscription_id" "text", "applied_coupon_id" "uuid", "coupon_code" "text", "discount_percentage" numeric, "discount_fixed_amount" numeric, "trial_ends_at" timestamp with time zone, "override_reason" "text", "override_by_user_id" "uuid", "override_at" timestamp with time zone, "cpf_cnpj" "text", "billing_email" "text", "billing_name" "text", "billing_due_window" "text", "billing_due_window_updated_at" timestamp with time zone, "can_change_billing_window" boolean, "next_allowed_billing_window_change" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.clinic_memberships cm
      WHERE cm.clinic_id = _clinic_id
        AND cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.membership_status = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid()
        AND pa.is_active = true
    )
  ) THEN
    RAISE EXCEPTION 'Acesso negado: você não tem permissão para visualizar a assinatura desta clínica.';
  END IF;

  RETURN QUERY
  SELECT
    cs.id AS subscription_id,
    cs.clinic_id,
    cs.account_owner_user_id,
    cs.plan_type,
    cs.status,
    cs.billing_cycle,
    cs.payment_method,
    cs.base_monthly_price,
    cs.total_recurring_monthly_price,
    cs.base_subaccount_limit,
    cs.purchased_subaccount_extra_count,
    (CASE 
      WHEN cs.plan_type::text IN ('prof_basico', 'prof_medio', 'solo') THEN 1
      WHEN cs.plan_type::text = 'prof_top' THEN 2
      ELSE 999999
    END)::integer AS total_subaccount_limit,
    cs.base_concurrent_access_count,
    cs.additional_concurrent_access_count,
    (CASE 
      WHEN cs.plan_type::text IN ('prof_basico', 'prof_medio', 'solo') THEN 1 
      WHEN cs.plan_type::text = 'prof_top' THEN 2
      WHEN cs.plan_type::text = 'clinica_basico' THEN (2 + COALESCE(cs.additional_concurrent_access_count, 0))
      WHEN cs.plan_type::text IN ('clinica_top', 'enterprise') THEN (COALESCE(cs.base_concurrent_access_count, 8) + COALESCE(cs.additional_concurrent_access_count, 0))
      ELSE (COALESCE(cs.base_concurrent_access_count, 4) + COALESCE(cs.additional_concurrent_access_count, 0)) 
    END)::integer AS total_concurrent_access_limit,
    cs.next_due_date,
    cs.current_period_start,
    cs.current_period_end,
    COALESCE(cs.expires_at, cs.current_period_end, cs.current_period_start + interval '30 days') AS expires_at,
    COALESCE(cs.period_duration_days, 30) AS period_duration_days,
    COALESCE(cs.auto_renew, true) AS auto_renew,
    GREATEST(0, EXTRACT(DAY FROM (COALESCE(cs.expires_at, cs.current_period_end, cs.current_period_start + interval '30 days') - now()))::integer) AS days_remaining,
    (CASE WHEN COALESCE(cs.expires_at, cs.current_period_end) < now() AND cs.status NOT IN ('BETA', 'TRIAL', 'COURTESY') THEN true ELSE false END) AS is_expired,
    cs.asaas_customer_id,
    cs.asaas_subscription_id,
    cs.applied_coupon_id,
    cs.coupon_code,
    cs.discount_percentage,
    cs.discount_fixed_amount,
    cs.trial_ends_at,
    cs.override_reason,
    cs.override_by_user_id,
    cs.override_at,
    cs.cpf_cnpj,
    cs.billing_email,
    cs.billing_name,
    COALESCE(cs.billing_due_window, 'DAY_1_TO_5') AS billing_due_window,
    cs.billing_due_window_updated_at,
    (CASE 
      WHEN cs.billing_due_window_updated_at IS NULL THEN true
      WHEN EXTRACT(DAY FROM (clock_timestamp() - cs.billing_due_window_updated_at)) >= 30 THEN true
      ELSE false
    END) AS can_change_billing_window,
    (COALESCE(cs.billing_due_window_updated_at, clock_timestamp()) + interval '30 days') AS next_allowed_billing_window_change
  FROM public.clinic_subscriptions cs
  WHERE cs.clinic_id = _clinic_id
  LIMIT 1;
END;
$$;

-- [RPC/FUNCTION] update_clinic_billing_due_window (schema.sql L4267-L4393)
CREATE OR REPLACE FUNCTION "public"."update_clinic_billing_due_window"("_clinic_id" "uuid", "_window" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_sub record;
  v_is_owner boolean;
  v_is_admin boolean;
  v_last_updated timestamptz;
  v_now timestamptz := clock_timestamp();
  v_days_since_last_update integer;
  v_next_allowed_at timestamptz;
  v_target_day integer;
  v_current_next_due date;
  v_new_next_due date;
BEGIN
  -- Validar parâmetro de entrada
  IF _window NOT IN ('DAY_1_TO_5', 'DAY_10_TO_15', 'DAY_25_TO_30') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Janela de vencimento inválida. Opções permitidas: DAY_1_TO_5, DAY_10_TO_15, DAY_25_TO_30.'
    );
  END IF;

  -- Verificar autorização: proprietário da clínica ou platform_admin
  SELECT (cm.account_role = 'account_owner' AND cm.is_active = true)
  INTO v_is_owner
  FROM public.clinic_memberships cm
  WHERE cm.clinic_id = _clinic_id AND cm.user_id = v_user_id;

  SELECT (pa.is_active = true)
  INTO v_is_admin
  FROM public.platform_admins pa
  WHERE pa.user_id = v_user_id;

  IF NOT (COALESCE(v_is_owner, false) OR COALESCE(v_is_admin, false)) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Apenas o proprietário da clínica ou administrador pode alterar as preferências de cobrança.'
    );
  END IF;

  -- Buscar assinatura atual
  SELECT * INTO v_sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = _clinic_id;

  IF v_sub.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Assinatura da clínica não encontrada.'
    );
  END IF;

  -- Se já for a mesma janela, apenas retornar sucesso
  IF v_sub.billing_due_window = _window THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'A janela de vencimento informada já está ativa.',
      'billing_due_window', _window,
      'billing_due_window_updated_at', v_sub.billing_due_window_updated_at
    );
  END IF;

  -- Validar se já houve alteração nos últimos 30 dias (Regra: 1 vez por mês)
  v_last_updated := v_sub.billing_due_window_updated_at;
  IF v_last_updated IS NOT NULL THEN
    v_days_since_last_update := EXTRACT(DAY FROM (v_now - v_last_updated))::integer;
    v_next_allowed_at := v_last_updated + interval '30 days';
    
    -- Se tiver sido alterado há menos de 30 dias e não for a primeira configuração
    IF v_days_since_last_update < 30 AND v_sub.billing_due_window IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('A janela de vencimento só pode ser alterada uma vez a cada 30 dias. Próxima alteração permitida em %s.', to_char(v_next_allowed_at, 'DD/MM/YYYY')),
        'next_allowed_at', v_next_allowed_at,
        'days_remaining', (30 - v_days_since_last_update)
      );
    END IF;
  END IF;

  -- Mapear dia de vencimento alvo da janela escolhida
  v_target_day := CASE 
    WHEN _window = 'DAY_1_TO_5' THEN 5
    WHEN _window = 'DAY_10_TO_15' THEN 15
    WHEN _window = 'DAY_25_TO_30' THEN 30
    ELSE 5
  END;

  -- Calcular o vencimento para o próximo ciclo subsequente
  v_current_next_due := COALESCE(v_sub.next_due_date, CURRENT_DATE + interval '30 days');
  -- Ajustar para o dia alvo mantendo ou projetando para o mês seguinte
  v_new_next_due := make_date(
    EXTRACT(YEAR FROM v_current_next_due)::integer,
    EXTRACT(MONTH FROM v_current_next_due)::integer,
    LEAST(v_target_day, EXTRACT(DAY FROM (date_trunc('month', v_current_next_due) + interval '1 month - 1 day'))::integer)
  );

  IF v_new_next_due <= CURRENT_DATE THEN
    v_new_next_due := make_date(
      EXTRACT(YEAR FROM v_current_next_due + interval '1 month')::integer,
      EXTRACT(MONTH FROM v_current_next_due + interval '1 month')::integer,
      LEAST(v_target_day, EXTRACT(DAY FROM (date_trunc('month', v_current_next_due + interval '1 month') + interval '1 month - 1 day'))::integer)
    );
  END IF;

  -- Atualizar registro na base local
  UPDATE public.clinic_subscriptions
  SET 
    billing_due_window = _window,
    billing_due_window_updated_at = v_now,
    next_due_date = v_new_next_due,
    updated_at = v_now
  WHERE clinic_id = _clinic_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Janela de vencimento atualizada com sucesso para os próximos ciclos.',
    'billing_due_window', _window,
    'billing_due_window_updated_at', v_now,
    'target_due_day', v_target_day,
    'next_due_date', v_new_next_due,
    'next_allowed_at', v_now + interval '30 days'
  );
END;
$$;

-- [RPC/FUNCTION] get_current_user_pending_release_notes (schema.sql L4414-L4541)
CREATE OR REPLACE FUNCTION "public"."get_current_user_pending_release_notes"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  _user_id uuid := auth.uid();
  _latest public.platform_releases%rowtype;
  _state public.user_release_note_states%rowtype;
  _releases jsonb := '[]'::jsonb;
  _categories jsonb := '[]'::jsonb;
begin
  if _user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  select *
  into _latest
  from public.platform_releases
  where is_active = true
  order by version_order desc
  limit 1;

  if _latest.id is null then
    return jsonb_build_object('should_show', false, 'reason', 'no_active_release');
  end if;

  select *
  into _state
  from public.user_release_note_states
  where user_id = _user_id;

  if _state.user_id is null then
    insert into public.user_release_note_states (
      user_id,
      last_seen_release_id,
      last_seen_release_order,
      last_seen_at
    )
    values (
      _user_id,
      _latest.id,
      _latest.version_order,
      now()
    );

    return jsonb_build_object(
      'should_show', false,
      'reason', 'first_access_initialized',
      'latest_release_id', _latest.id,
      'latest_version', _latest.version
    );
  end if;

  if _state.last_seen_release_order >= _latest.version_order then
    return jsonb_build_object(
      'should_show', false,
      'reason', 'up_to_date',
      'latest_release_id', _latest.id,
      'latest_version', _latest.version
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', pending_releases.id,
        'version', pending_releases.version,
        'version_order', pending_releases.version_order,
        'title', pending_releases.title,
        'summary', pending_releases.summary,
        'published_at', pending_releases.published_at,
        'items', coalesce(items.items, '[]'::jsonb)
      )
      order by pending_releases.version_order asc
    ),
    '[]'::jsonb
  )
  into _releases
  from public.platform_releases pending_releases
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', platform_release_note_items.id,
        'category', platform_release_note_items.category,
        'title', platform_release_note_items.title,
        'body', platform_release_note_items.body,
        'sort_order', platform_release_note_items.sort_order
      )
      order by platform_release_note_items.category, platform_release_note_items.sort_order, platform_release_note_items.created_at
    ) as items
    from public.platform_release_note_items
    where platform_release_note_items.release_id = pending_releases.id
  ) items on true
  where pending_releases.is_active = true
    and pending_releases.version_order > _state.last_seen_release_order
    and pending_releases.version_order <= _latest.version_order;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'category', counted.category,
        'count', counted.item_count
      )
      order by counted.category
    ),
    '[]'::jsonb
  )
  into _categories
  from (
    select platform_release_note_items.category, count(*)::integer as item_count
    from public.platform_releases pending_releases
    join public.platform_release_note_items on platform_release_note_items.release_id = pending_releases.id
    where pending_releases.is_active = true
      and pending_releases.version_order > _state.last_seen_release_order
      and pending_releases.version_order <= _latest.version_order
    group by platform_release_note_items.category
  ) counted;

  return jsonb_build_object(
    'should_show', jsonb_array_length(_releases) > 0,
    'latest_release_id', _latest.id,
    'latest_version', _latest.version,
    'previous_release_order', _state.last_seen_release_order,
    'releases', _releases,
    'categories', _categories
  );
end;
$$;

-- [RPC/FUNCTION] get_user_active_governance (schema.sql L5405-L5435)
CREATE OR REPLACE FUNCTION "public"."get_user_active_governance"("_user_id" "uuid") RETURNS TABLE("punishment_id" "uuid", "punishment_type" "text", "applied_at" timestamp with time zone, "expires_at" timestamp with time zone, "reason" "text", "is_manual" boolean, "applied_by_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
#variable_conflict use_column
BEGIN
  -- Auto-expire outdated punishments first
  UPDATE public.user_punishments up
  SET is_active = false
  WHERE up.user_id = _user_id
    AND up.is_active = true
    AND up.expires_at IS NOT NULL
    AND up.expires_at < now();

  RETURN QUERY
  SELECT 
    p.id AS punishment_id,
    p.punishment_type,
    p.applied_at,
    p.expires_at,
    p.reason,
    p.is_manual,
    COALESCE(prof.full_name, prof.email, 'Sistema Automático') AS applied_by_name
  FROM public.user_punishments p
  LEFT JOIN public.profiles prof ON prof.id = p.applied_by
  WHERE p.user_id = _user_id
    AND p.is_active = true
    AND (p.expires_at IS NULL OR p.expires_at > now())
  ORDER BY p.applied_at DESC;
END;
$$;

-- [RPC/FUNCTION] get_user_clinic_id (schema.sql L5441-L5462)
CREATE OR REPLACE FUNCTION "public"."get_user_clinic_id"("_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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

-- [RPC/FUNCTION] has_role (schema.sql L6062-L6070)
CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- [RPC/FUNCTION] invite_clinic_collaborator (schema.sql L6091-L6268)
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
  _existing_user_id uuid;
  _invitation_id uuid;
  _normalized_role_key text := NULLIF(trim(_role_key), '');
  _inferred_operational_role public.operational_role_type := _operational_role;
  _custom_role record;
  _clinic_plan text;
  _subaccount_limit integer;
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

  -- Obter plano e limites canônicos da clínica
  SELECT LOWER(COALESCE(subscription_plan::text, 'solo')), COALESCE(subaccount_limit, 1)
  INTO _clinic_plan, _subaccount_limit
  FROM public.clinics
  WHERE id = _resolved_clinic_id;

  -- Trava 1: Planos Monoposto (prof_basico, prof_medio, solo) não permitem colaboradores
  IF _clinic_plan IN ('prof_basico', 'prof_medio', 'solo') THEN
    RAISE EXCEPTION 'Convites de colaboradores não estão disponíveis em planos individuais (monoposto). Faça upgrade para Profissional Top ou Plano Clínica.';
  END IF;

  -- Trava 2: Plano Profissional Top (prof_top): máximo de 1 colaborador de apoio (total 2 membros)
  IF _clinic_plan = 'prof_top' OR _subaccount_limit = 2 THEN
    SELECT COUNT(*)::integer INTO _active_subaccounts_count
    FROM public.clinic_memberships
    WHERE clinic_id = _resolved_clinic_id
      AND is_active = true
      AND membership_status = 'active'
      AND account_role NOT IN ('account_owner', 'owner');

    SELECT COUNT(*)::integer INTO _pending_invites_count
    FROM public.clinic_collaborator_invitations
    WHERE clinic_id = _resolved_clinic_id
      AND status = 'pending'
      AND lower(email) <> _normalized_email;

    IF (_active_subaccounts_count + _pending_invites_count) >= 1 THEN
      RAISE EXCEPTION 'O plano Profissional Top permite no máximo 1 colaborador de apoio (total de 2 membros). Limite atingido.';
    END IF;
  ELSIF _subaccount_limit < 999999 THEN
    -- Verificação genérica para outros planos limitados
    SELECT COUNT(*)::integer INTO _active_subaccounts_count
    FROM public.clinic_memberships
    WHERE clinic_id = _resolved_clinic_id
      AND is_active = true
      AND membership_status = 'active'
      AND account_role NOT IN ('account_owner', 'owner');

    SELECT COUNT(*)::integer INTO _pending_invites_count
    FROM public.clinic_collaborator_invitations
    WHERE clinic_id = _resolved_clinic_id
      AND status = 'pending'
      AND lower(email) <> _normalized_email;

    IF (_active_subaccounts_count + _pending_invites_count) >= GREATEST(0, _subaccount_limit - 1) THEN
      RAISE EXCEPTION 'O limite de membros da clínica foi atingido para o plano atual.';
    END IF;
  END IF;

  IF _normalized_email = '' OR _normalized_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'Informe um e-mail válido para o convite.';
  END IF;

  IF _operational_role = 'owner' OR _normalized_role_key = 'owner' THEN
    RAISE EXCEPTION 'O papel owner não pode ser atribuído por convite operacional.';
  END IF;

  -- Validar role_key em clinic_operational_roles se informado
  IF _normalized_role_key IS NOT NULL THEN
    SELECT *
    INTO _custom_role
    FROM public.clinic_operational_roles
    WHERE clinic_id = _resolved_clinic_id
      AND role_key = _normalized_role_key
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Papel operacional inválido para esta clínica.';
    END IF;

    IF _operational_role IS NULL OR _operational_role = 'professional'::public.operational_role_type THEN
      _inferred_operational_role := _custom_role.base_operational_role;
    END IF;
  END IF;

  SELECT users.id
  INTO _existing_user_id
  FROM auth.users
  WHERE lower(users.email) = _normalized_email
  LIMIT 1;

  -- Cancelar convites pendentes anteriores para o mesmo e-mail na mesma clínica
  UPDATE public.clinic_collaborator_invitations
  SET status = 'cancelled',
      updated_at = now()
  WHERE clinic_id = _resolved_clinic_id
    AND lower(email) = _normalized_email
    AND status = 'pending';

  INSERT INTO public.clinic_collaborator_invitations (
    clinic_id,
    email,
    operational_role,
    role_key,
    job_title,
    specialty,
    token_hash,
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
    _normalized_role_key,
    NULLIF(trim(_job_title), ''),
    NULLIF(trim(_specialty), ''),
    _token_hash,
    _requester_id,
    _existing_user_id,
    'pending',
    'pending',
    NULL,
    NULL
  )
  RETURNING id INTO _invitation_id;

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
      'role_key', _normalized_role_key,
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

-- [RPC/FUNCTION] is_active_clinic_member (schema.sql L6274-L6286)
CREATE OR REPLACE FUNCTION "public"."is_active_clinic_member"("_clinic_id" "uuid", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinic_memberships
    WHERE clinic_memberships.clinic_id = _clinic_id
      AND clinic_memberships.user_id = _user_id
      AND clinic_memberships.is_active = true
      AND clinic_memberships.membership_status = 'active'
  );
$$;

-- [RPC/FUNCTION] is_clinic_read_only (schema.sql L6292-L6344)
CREATE OR REPLACE FUNCTION "public"."is_clinic_read_only"("_clinic_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_sub record;
BEGIN
  IF _clinic_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT
    status,
    is_read_only,
    is_free_trial,
    is_courtesy,
    expires_at,
    current_period_end
  INTO v_sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = _clinic_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Se flag explícita estiver marcada
  IF COALESCE(v_sub.is_read_only, false) = true THEN
    RETURN true;
  END IF;

  -- Se o status for TRIAL_EXPIRED
  IF v_sub.status = 'TRIAL_EXPIRED' THEN
    RETURN true;
  END IF;

  -- Cortesia parceira ativa nunca fica read-only
  IF COALESCE(v_sub.is_courtesy, false) = true OR v_sub.status = 'COURTESY' THEN
    RETURN false;
  END IF;

  -- Se for TRIAL ou marcado como is_free_trial e expirou sem assinatura ativa
  IF (v_sub.status = 'TRIAL' OR COALESCE(v_sub.is_free_trial, false) = true) THEN
    IF COALESCE(v_sub.expires_at, v_sub.current_period_end) IS NOT NULL
       AND COALESCE(v_sub.expires_at, v_sub.current_period_end) < now() THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

-- [RPC/FUNCTION] is_clinic_subscription_manager (schema.sql L6350-L6372)
CREATE OR REPLACE FUNCTION "public"."is_clinic_subscription_manager"("_user_id" "uuid", "_clinic_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinics c
    WHERE c.id = _clinic_id
      AND c.account_owner_user_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.clinic_memberships cm
    WHERE cm.clinic_id = _clinic_id
      AND cm.user_id = _user_id
      AND (cm.account_role = 'account_owner' OR cm.operational_role = 'owner')
      AND cm.is_active = true
      AND cm.membership_status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.platform_admins pa
    WHERE pa.user_id = _user_id
      AND pa.is_active = true
  );
$$;

-- [RPC/FUNCTION] leave_current_user_clinic (schema.sql L6423-L6500)
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

-- [RPC/FUNCTION] list_current_user_clinic_invitations (schema.sql L6506-L6533)
CREATE OR REPLACE FUNCTION "public"."list_current_user_clinic_invitations"() RETURNS TABLE("invitation_id" "uuid", "clinic_id" "uuid", "clinic_name" "text", "clinic_logo_url" "text", "clinic_route_key" "text", "operational_role" "public"."operational_role_type", "job_title" "text", "specialty" "text", "invited_by_name" "text", "expires_at" timestamp with time zone, "created_at" timestamp with time zone)
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
    AND invitations.expires_at >= now()
    AND lower(invitations.email) = lower(users.email)
  ORDER BY invitations.created_at DESC;
$$;

-- [RPC/FUNCTION] list_current_user_clinics (schema.sql L6539-L6591)
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
    COALESCE(clinics.subaccount_limit, CASE WHEN clinics.subscription_plan = 'clinic' THEN 30 ELSE 0 END)::integer AS clinic_subaccount_limit,
    COALESCE(clinics.concurrent_access_limit, CASE WHEN clinics.subscription_plan = 'clinic' THEN 2 ELSE 1 END)::integer AS clinic_concurrent_access_limit,
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
    AND clinic_memberships.membership_status = 'active'
    AND clinics.access_status IN ('active', 'payment_pending')
  ORDER BY clinic_memberships.joined_at ASC;
$$;

-- [RPC/FUNCTION] list_current_user_notification_preferences (schema.sql L6597-L6623)
CREATE OR REPLACE FUNCTION "public"."list_current_user_notification_preferences"() RETURNS TABLE("sound_mode" "text", "sound_key" "text", "notify_security" boolean, "notify_clinic_access" boolean, "notify_patient_saved" boolean, "notify_session_activity" boolean, "notify_event_reminders" boolean, "notify_system" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

-- [RPC/FUNCTION] list_current_user_notifications (schema.sql L6629-L6668)
CREATE OR REPLACE FUNCTION "public"."list_current_user_notifications"() RETURNS TABLE("notification_id" "uuid", "created_at" timestamp with time zone, "category" "text", "event_type" "text", "title" "text", "body" "text", "clinic_id" "uuid", "clinic_name" "text", "actor_user_id" "uuid", "actor_name" "text", "action_label" "text", "action_url" "text", "payload" "jsonb", "read_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

-- [RPC/FUNCTION] complete_unregistered_cpf_profile (schema.sql L7470-L7524)
CREATE OR REPLACE FUNCTION "public"."complete_unregistered_cpf_profile"("_full_name" "text", "_cpf" "text", "_phone" "text" DEFAULT NULL::"text", "_birth_date" "date" DEFAULT NULL::"date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
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

  SELECT id
  INTO _existing_cpf_user_id
  FROM public.profiles
  WHERE regexp_replace(coalesce(cpf, ''), '\D', '', 'g') = _normalized_cpf
    AND id <> _user_id
  LIMIT 1;

  IF _existing_cpf_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Este CPF já está cadastrado em outra conta.';
  END IF;

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

-- [RPC/FUNCTION] manage_clinic_subscription_plan (schema.sql L7726-L7931)
CREATE OR REPLACE FUNCTION "public"."manage_clinic_subscription_plan"("_clinic_id" "uuid", "_new_plan" "public"."subscription_plan", "_billing_cycle" "text" DEFAULT 'annual'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_current_user_id uuid := auth.uid();
  v_active_subaccounts_count integer;
  v_owner_user_id uuid;
  v_sub_record public.clinic_subscriptions%ROWTYPE;
  v_cycle text := LOWER(COALESCE(_billing_cycle, 'annual'));
  v_base_price numeric(10,2);
  v_extra_price numeric(10,2);
  v_base_subaccounts integer;
  v_base_concurrent integer;
  v_current_extra_seats integer := 0;
  v_plan_str text := LOWER(_new_plan::text);
BEGIN
  IF NOT public.is_clinic_subscription_manager(v_current_user_id, _clinic_id) THEN
    RAISE EXCEPTION 'Acesso negado: apenas o responsável pela clínica (account_owner) pode alterar o plano.';
  END IF;

  SELECT account_owner_user_id INTO v_owner_user_id
  FROM public.clinics
  WHERE id = _clinic_id;

  v_owner_user_id := COALESCE(v_owner_user_id, v_current_user_id);

  -- Validação no Downgrade para planos individuais (prof_basico, prof_medio, solo):
  -- Não pode ter colaboradores ativos cadastrados
  IF v_plan_str IN ('prof_basico', 'prof_medio', 'solo') THEN
    SELECT COUNT(*)::integer INTO v_active_subaccounts_count
    FROM public.clinic_memberships
    WHERE clinic_id = _clinic_id
      AND is_active = true
      AND membership_status = 'active'
      AND account_role NOT IN ('account_owner', 'owner');

    IF v_active_subaccounts_count > 0 THEN
      RAISE EXCEPTION 'Não é possível alterar para plano individual enquanto houver % colaborador(es) ativo(s) cadastrado(s). Desative ou remova os colaboradores primeiro.', v_active_subaccounts_count;
    END IF;
  ELSIF v_plan_str = 'prof_top' THEN
    -- prof_top permite no máximo 1 colaborador adicional de apoio (total 2 membros com o titular)
    SELECT COUNT(*)::integer INTO v_active_subaccounts_count
    FROM public.clinic_memberships
    WHERE clinic_id = _clinic_id
      AND is_active = true
      AND membership_status = 'active'
      AND account_role NOT IN ('account_owner', 'owner');

    IF v_active_subaccounts_count > 1 THEN
      RAISE EXCEPTION 'O plano Profissional Top permite no máximo 1 colaborador de apoio (total de 2 membros). Atualmente há % colaboradores ativos.', v_active_subaccounts_count;
    END IF;
  END IF;

  -- Matriz Oficial de Preços e Cotas por Ciclo:
  -- Mensal: base
  -- Trimestral: 10% OFF
  -- Anual: 25% OFF
  IF v_plan_str = 'prof_basico' THEN
    v_base_price := CASE
      WHEN v_cycle = 'monthly' THEN 39.99
      WHEN v_cycle = 'quarterly' THEN 35.99  -- ~10% OFF
      ELSE 29.99                           -- ~25% OFF
    END;
    v_extra_price := 0.00;
    v_base_subaccounts := 1;
    v_base_concurrent := 1;
    v_current_extra_seats := 0;

  ELSIF v_plan_str IN ('prof_medio', 'solo') THEN
    v_base_price := CASE
      WHEN v_cycle = 'monthly' THEN 59.99
      WHEN v_cycle = 'quarterly' THEN 53.99  -- ~10% OFF
      ELSE 44.99                           -- ~25% OFF
    END;
    v_extra_price := 0.00;
    v_base_subaccounts := 1;
    v_base_concurrent := 1;
    v_current_extra_seats := 0;

  ELSIF v_plan_str = 'prof_top' THEN
    v_base_price := CASE
      WHEN v_cycle = 'monthly' THEN 89.99
      WHEN v_cycle = 'quarterly' THEN 80.99  -- ~10% OFF
      ELSE 67.49                           -- ~25% OFF
    END;
    v_extra_price := 0.00;
    v_base_subaccounts := 2;
    v_base_concurrent := 2;
    v_current_extra_seats := 0;

  ELSIF v_plan_str = 'clinica_basico' THEN
    v_base_price := CASE
      WHEN v_cycle = 'monthly' THEN 99.00
      WHEN v_cycle = 'quarterly' THEN 89.10  -- 10% OFF
      ELSE 74.25                           -- 25% OFF
    END;
    v_extra_price := 25.00;
    v_base_subaccounts := 999999;
    v_base_concurrent := 2;

    SELECT additional_concurrent_access_count INTO v_current_extra_seats
    FROM public.clinic_subscriptions
    WHERE clinic_id = _clinic_id;
    v_current_extra_seats := COALESCE(v_current_extra_seats, 0);

  ELSIF v_plan_str IN ('clinica_medio', 'clinic') THEN
    v_base_price := CASE
      WHEN v_cycle = 'monthly' THEN 139.00
      WHEN v_cycle = 'quarterly' THEN 125.10 -- 10% OFF
      ELSE 104.25                          -- 25% OFF
    END;
    v_extra_price := 25.00;
    v_base_subaccounts := 999999;
    v_base_concurrent := 4;

    SELECT additional_concurrent_access_count INTO v_current_extra_seats
    FROM public.clinic_subscriptions
    WHERE clinic_id = _clinic_id;
    v_current_extra_seats := COALESCE(v_current_extra_seats, 0);

  ELSIF v_plan_str IN ('clinica_top', 'enterprise') THEN
    v_base_price := CASE
      WHEN v_cycle = 'monthly' THEN 199.00
      WHEN v_cycle = 'quarterly' THEN 179.10 -- 10% OFF
      ELSE 149.25                          -- 25% OFF
    END;
    v_extra_price := 25.00;
    v_base_subaccounts := 999999;
    v_base_concurrent := 8;

    SELECT additional_concurrent_access_count INTO v_current_extra_seats
    FROM public.clinic_subscriptions
    WHERE clinic_id = _clinic_id;
    v_current_extra_seats := COALESCE(v_current_extra_seats, 0);

  ELSE
    RAISE EXCEPTION 'Plano de assinatura desconhecido: %', _new_plan;
  END IF;

  -- Upsert em clinic_subscriptions
  INSERT INTO public.clinic_subscriptions (
    clinic_id,
    account_owner_user_id,
    plan_type,
    billing_cycle,
    base_monthly_price,
    base_subaccount_limit,
    base_concurrent_access_count,
    additional_concurrent_access_count,
    additional_concurrent_access_price,
    total_recurring_monthly_price,
    status
  )
  VALUES (
    _clinic_id,
    v_owner_user_id,
    _new_plan,
    UPPER(v_cycle),
    v_base_price,
    v_base_subaccounts,
    v_base_concurrent,
    v_current_extra_seats,
    v_extra_price,
    v_base_price + (v_current_extra_seats * v_extra_price),
    'ACTIVE'
  )
  ON CONFLICT (clinic_id) DO UPDATE
  SET
    account_owner_user_id = COALESCE(clinic_subscriptions.account_owner_user_id, EXCLUDED.account_owner_user_id),
    plan_type = EXCLUDED.plan_type,
    billing_cycle = EXCLUDED.billing_cycle,
    base_monthly_price = EXCLUDED.base_monthly_price,
    base_subaccount_limit = EXCLUDED.base_subaccount_limit,
    base_concurrent_access_count = EXCLUDED.base_concurrent_access_count,
    additional_concurrent_access_count = CASE
      WHEN EXCLUDED.plan_type::text IN ('prof_basico', 'prof_medio', 'prof_top', 'solo') THEN 0
      ELSE clinic_subscriptions.additional_concurrent_access_count
    END,
    additional_concurrent_access_price = EXCLUDED.additional_concurrent_access_price,
    total_recurring_monthly_price = EXCLUDED.base_monthly_price + (
      CASE
        WHEN EXCLUDED.plan_type::text IN ('prof_basico', 'prof_medio', 'prof_top', 'solo') THEN 0
        ELSE clinic_subscriptions.additional_concurrent_access_count
      END * EXCLUDED.additional_concurrent_access_price
    ),
    updated_at = now()
  RETURNING * INTO v_sub_record;

  -- Assegurar que clinics.account_owner_user_id permanece consistente
  UPDATE public.clinics
  SET account_owner_user_id = COALESCE(account_owner_user_id, v_owner_user_id)
  WHERE id = _clinic_id;

  RETURN jsonb_build_object(
    'success', true,
    'clinic_id', _clinic_id,
    'plan_type', v_sub_record.plan_type,
    'billing_cycle', v_sub_record.billing_cycle,
    'base_subaccount_limit', v_sub_record.base_subaccount_limit,
    'base_concurrent_access_count', v_sub_record.base_concurrent_access_count,
    'additional_concurrent_access_count', v_sub_record.additional_concurrent_access_count,
    'total_recurring_monthly_price', v_sub_record.total_recurring_monthly_price
  );
END;
$$;

-- [RPC/FUNCTION] change_clinic_subscription_plan (schema.sql L7937-L7944)
CREATE OR REPLACE FUNCTION "public"."change_clinic_subscription_plan"("_clinic_id" "uuid", "_new_plan" "public"."subscription_plan", "_billing_cycle" "text" DEFAULT 'annual'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN public.manage_clinic_subscription_plan(_clinic_id, _new_plan, _billing_cycle);
END;
$$;

-- [RPC/FUNCTION] notify_clinic_collaborator_presence (schema.sql L8035-L8116)
CREATE OR REPLACE FUNCTION "public"."notify_clinic_collaborator_presence"("_clinic_id" "uuid", "_user_id" "uuid", "_status" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

-- [RPC/FUNCTION] resend_clinic_collaborator_invitation (schema.sql L8659-L8748)
CREATE OR REPLACE FUNCTION "public"."resend_clinic_collaborator_invitation"("_invitation_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  _requester_id uuid := auth.uid();
  _invitation public.clinic_collaborator_invitations%ROWTYPE;
  _token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  _token_hash text := md5(_token);
  _remaining_seconds integer;
  _account_state text := 'invite_sent';
  _existing_user auth.users%ROWTYPE;
  _clinic_route_key text;
  _is_service_role boolean := (coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role');
BEGIN
  -- Se não for service_role, requer autenticação do chamador
  IF NOT _is_service_role THEN
    IF _requester_id IS NULL THEN
      RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;
  END IF;

  SELECT * INTO _invitation
  FROM public.clinic_collaborator_invitations
  WHERE id = _invitation_id
  LIMIT 1;

  IF _invitation.id IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  -- Se não for service_role, verifica permissões de clínica ou platform owner
  IF NOT _is_service_role THEN
    IF NOT (
      public.current_user_can('subaccounts.manage', _invitation.clinic_id) OR
      public.is_platform_owner_mfa_verified(_requester_id)
    ) THEN
      RAISE EXCEPTION 'Sem permissão para reenviar convites desta clínica.';
    END IF;
  END IF;

  -- 30-second rate-limiting check
  IF _invitation.last_resent_at IS NOT NULL AND (now() - _invitation.last_resent_at) < interval '30 seconds' THEN
    _remaining_seconds := 30 - extract(epoch from (now() - _invitation.last_resent_at))::integer;
    RAISE EXCEPTION 'Aguarde % segundos antes de reenviar o convite novamente.', GREATEST(_remaining_seconds, 1);
  END IF;

  -- Update status to pending (caso estivesse cancelled ou expired), token e resend timestamp
  UPDATE public.clinic_collaborator_invitations
  SET status = 'pending',
      token_hash = _token_hash,
      last_resent_at = now(),
      updated_at = now(),
      expires_at = now() + interval '14 days',
      email_delivery_status = 'pending',
      email_last_error = NULL,
      email_sent_at = NULL
  WHERE id = _invitation_id;

  -- Check user status in auth.users
  SELECT * INTO _existing_user
  FROM auth.users
  WHERE lower(users.email) = lower(_invitation.email)
  LIMIT 1;

  IF _existing_user.id IS NOT NULL THEN
    IF _existing_user.email_confirmed_at IS NULL THEN
      _account_state := 'registered_unconfirmed';
    ELSE
      _account_state := 'registered_confirmed_pending_acceptance';
    END IF;
  END IF;

  SELECT route_key INTO _clinic_route_key
  FROM public.clinics
  WHERE id = _invitation.clinic_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', _invitation.id,
    'token', _token,
    'path', '/convite/' || _token,
    'email', _invitation.email,
    'clinic_id', _invitation.clinic_id,
    'clinic_route_key', _clinic_route_key,
    'account_state', _account_state,
    'remaining_cooldown', 30
  );
END;
$$;

-- [RPC/FUNCTION] revoke_clinic_member_access (schema.sql L8754-L8827)
CREATE OR REPLACE FUNCTION "public"."revoke_clinic_member_access"("_membership_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _requester_id uuid := auth.uid();
  _target_membership public.clinic_memberships%ROWTYPE;
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  SELECT *
  INTO _target_membership
  FROM public.clinic_memberships
  WHERE id = _membership_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Colaborador nao encontrado.';
  END IF;

  IF _target_membership.account_role = 'account_owner' OR _target_membership.operational_role = 'owner' THEN
    RAISE EXCEPTION 'A conta principal nao pode ser removida da clinica.';
  END IF;

  IF _target_membership.user_id = _requester_id THEN
    RAISE EXCEPTION 'Use o fluxo do espaco pessoal para remover seu proprio acesso.';
  END IF;

  IF NOT (
    public.current_user_can('subaccounts.delete', _target_membership.clinic_id)
    OR public.current_user_can('subaccounts.manage', _target_membership.clinic_id)
  ) THEN
    RAISE EXCEPTION 'Sem permissao para remover colaboradores desta clinica.';
  END IF;

  UPDATE public.clinic_memberships
  SET
    membership_status = 'inactive',
    is_active = false,
    ended_at = now()
  WHERE id = _membership_id;

  UPDATE public.user_security_sessions
  SET
    ended_at = now(),
    force_signed_out_at = now(),
    forced_out_by = _requester_id,
    last_seen_at = now()
  WHERE clinic_id = _target_membership.clinic_id
    AND user_id = _target_membership.user_id
    AND ended_at IS NULL;

  DELETE FROM public.user_active_clinic_contexts
  WHERE user_id = _target_membership.user_id
    AND clinic_id = _target_membership.clinic_id;

  PERFORM public.log_security_event(
    _target_membership.clinic_id,
    _requester_id,
    _target_membership.user_id,
    'clinic_member_access_revoked',
    'admin',
    jsonb_build_object(
      'membership_id', _membership_id,
      'previous_status', _target_membership.membership_status,
      'previous_role', _target_membership.operational_role,
      'initiated_by', 'clinic'
    )
  );

  RETURN jsonb_build_object('membership_id', _membership_id, 'status', 'inactive');
END;
$$;

-- [RPC/FUNCTION] revoke_user_punishment (schema.sql L8867-L8882)
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

-- [RPC/FUNCTION] set_clinic_subscriptions_updated_at (schema.sql L8888-L8895)
CREATE OR REPLACE FUNCTION "public"."set_clinic_subscriptions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

-- [RPC/FUNCTION] set_current_user_active_clinic (schema.sql L8901-L8923)
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

-- [RPC/FUNCTION] set_current_user_active_clinic_by_route_key (schema.sql L8929-L8947)
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

-- [RPC/FUNCTION] sync_clinic_limits_from_subscription (schema.sql L9449-L9497)
CREATE OR REPLACE FUNCTION "public"."sync_clinic_limits_from_subscription"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_effective_subaccount_limit integer;
  v_effective_concurrent_access_limit integer;
  v_base_subaccounts integer;
  v_base_concurrent integer;
  v_plan text := LOWER(NEW.plan_type::text);
BEGIN
  IF v_plan IN ('prof_basico', 'prof_medio', 'solo') THEN
    v_base_subaccounts := 1;
    v_base_concurrent := 1;
  ELSIF v_plan = 'prof_top' THEN
    v_base_subaccounts := 2; -- Titular + 1 Apoio
    v_base_concurrent := 2;
  ELSIF v_plan = 'clinica_basico' THEN
    v_base_subaccounts := 999999; -- Colaboradores ilimitados no cadastro
    v_base_concurrent := 2;
  ELSIF v_plan IN ('clinica_medio', 'clinic') THEN
    v_base_subaccounts := 999999; -- Colaboradores ilimitados no cadastro
    v_base_concurrent := 4;
  ELSIF v_plan IN ('clinica_top', 'enterprise') THEN
    v_base_subaccounts := 999999; -- Colaboradores ilimitados no cadastro
    v_base_concurrent := COALESCE(NEW.base_concurrent_access_count, 8);
  ELSE
    v_base_subaccounts := COALESCE(NEW.base_subaccount_limit, 999999);
    v_base_concurrent := COALESCE(NEW.base_concurrent_access_count, 4);
  END IF;

  v_effective_subaccount_limit := CASE
    WHEN v_base_subaccounts >= 999999 THEN 999999
    ELSE v_base_subaccounts + COALESCE(NEW.purchased_subaccount_extra_count, 0)
  END;

  v_effective_concurrent_access_limit := v_base_concurrent + COALESCE(NEW.additional_concurrent_access_count, 0);

  UPDATE public.clinics
  SET
    subscription_plan = NEW.plan_type,
    subaccount_limit = v_effective_subaccount_limit,
    concurrent_access_limit = v_effective_concurrent_access_limit,
    updated_at = now()
  WHERE id = NEW.clinic_id;

  RETURN NEW;
END;
$$;

-- [RPC/FUNCTION] trim_user_notifications (schema.sql L9638-L9655)
CREATE OR REPLACE FUNCTION "public"."trim_user_notifications"("_user_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

-- [RPC/FUNCTION] update_clinic_collaborator_invitation (schema.sql L9661-L9705)
CREATE OR REPLACE FUNCTION "public"."update_clinic_collaborator_invitation"("_invitation_id" "uuid", "_operational_role" "public"."operational_role_type" DEFAULT 'professional'::"public"."operational_role_type", "_job_title" "text" DEFAULT NULL::"text", "_specialty" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  _requester_id uuid := auth.uid();
  _invitation public.clinic_collaborator_invitations%ROWTYPE;
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT * INTO _invitation
  FROM public.clinic_collaborator_invitations
  WHERE id = _invitation_id
  LIMIT 1;

  IF _invitation.id IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  IF _invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'Apenas convites pendentes podem ser editados.';
  END IF;

  IF NOT public.current_user_can('subaccounts.manage', _invitation.clinic_id) THEN
    RAISE EXCEPTION 'Sem permissão para editar convites desta clínica.';
  END IF;

  UPDATE public.clinic_collaborator_invitations
  SET operational_role = _operational_role,
      job_title = NULLIF(trim(coalesce(_job_title, '')), ''),
      specialty = NULLIF(trim(coalesce(_specialty, '')), ''),
      updated_at = now()
  WHERE id = _invitation_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', _invitation_id,
    'operational_role', _operational_role,
    'job_title', _job_title,
    'specialty', _specialty
  );
END;
$$;

-- [RPC/FUNCTION] update_clinic_concurrent_accesses (schema.sql L9711-L9787)
CREATE OR REPLACE FUNCTION "public"."update_clinic_concurrent_accesses"("_clinic_id" "uuid", "_extra_concurrent" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_current_user_id uuid := auth.uid();
  v_sub_record public.clinic_subscriptions%ROWTYPE;
  v_extra_seat_price numeric(10,2) := 25.00;
  v_base_monthly_price numeric(10,2);
  v_cycle text;
  v_plan_str text;
BEGIN
  IF NOT public.is_clinic_subscription_manager(v_current_user_id, _clinic_id) THEN
    RAISE EXCEPTION 'Acesso negado: apenas o responsável pela clínica pode ajustar os acessos simultâneos.';
  END IF;

  IF COALESCE(_extra_concurrent, 0) < 0 THEN
    RAISE EXCEPTION 'Quantidade de acessos extras inválida.';
  END IF;

  SELECT * INTO v_sub_record FROM public.clinic_subscriptions WHERE clinic_id = _clinic_id;
  IF v_sub_record.id IS NULL THEN
    INSERT INTO public.clinic_subscriptions (
      clinic_id, account_owner_user_id, plan_type, billing_cycle,
      base_monthly_price, base_subaccount_limit, base_concurrent_access_count, status
    )
    VALUES (_clinic_id, v_current_user_id, 'clinica_medio', 'ANNUAL', 104.25, 999999, 4, 'PENDING')
    RETURNING * INTO v_sub_record;
  END IF;

  v_plan_str := LOWER(v_sub_record.plan_type::text);

  IF v_plan_str IN ('prof_basico', 'prof_medio', 'prof_top', 'solo') THEN
    RAISE EXCEPTION 'Não é possível adicionar acessos simultâneos extras nos planos individuais. Faça upgrade para um plano Clínica primeiro.';
  END IF;

  v_cycle := LOWER(COALESCE(v_sub_record.billing_cycle, 'annual'));

  -- Preço base do plano no ciclo atual
  IF v_plan_str = 'clinica_basico' THEN
    v_base_monthly_price := CASE
      WHEN v_cycle = 'monthly' THEN 99.00
      WHEN v_cycle = 'quarterly' THEN 89.10
      ELSE 74.25
    END;
  ELSIF v_plan_str IN ('clinica_top', 'enterprise') THEN
    v_base_monthly_price := CASE
      WHEN v_cycle = 'monthly' THEN 199.00
      WHEN v_cycle = 'quarterly' THEN 179.10
      ELSE 149.25
    END;
  ELSE -- clinica_medio, clinic
    v_base_monthly_price := CASE
      WHEN v_cycle = 'monthly' THEN 139.00
      WHEN v_cycle = 'quarterly' THEN 125.10
      ELSE 104.25
    END;
  END IF;

  UPDATE public.clinic_subscriptions
  SET
    additional_concurrent_access_count = _extra_concurrent,
    additional_concurrent_access_price = v_extra_seat_price,
    base_monthly_price = v_base_monthly_price,
    total_recurring_monthly_price = v_base_monthly_price + (_extra_concurrent * v_extra_seat_price),
    updated_at = now()
  WHERE clinic_id = _clinic_id
  RETURNING * INTO v_sub_record;

  RETURN jsonb_build_object(
    'success', true,
    'additional_concurrent_access_count', _extra_concurrent,
    'total_concurrent_access_limit', v_sub_record.base_concurrent_access_count + _extra_concurrent,
    'total_recurring_monthly_price', v_sub_record.total_recurring_monthly_price
  );
END;
$$;

-- [RPC/FUNCTION] update_clinic_member_operational_fields (schema.sql L9793-L9915)
CREATE OR REPLACE FUNCTION "public"."update_clinic_member_operational_fields"("_membership_id" "uuid", "_job_title" "text" DEFAULT NULL::"text", "_specialty" "text" DEFAULT NULL::"text", "_working_hours" "text" DEFAULT NULL::"text", "_operational_role" "public"."operational_role_type" DEFAULT NULL::"public"."operational_role_type", "_membership_status" "public"."membership_status_type" DEFAULT NULL::"public"."membership_status_type", "_role_key" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _requester_id uuid := auth.uid();
  _target_membership public.clinic_memberships%ROWTYPE;
  _normalized_role_key text := NULLIF(trim(_role_key), '');
  _inferred_operational_role public.operational_role_type := _operational_role;
  _custom_role record;
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  SELECT *
  INTO _target_membership
  FROM public.clinic_memberships
  WHERE id = _membership_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Colaborador nao encontrado.';
  END IF;

  IF _target_membership.account_role = 'account_owner' THEN
    RAISE EXCEPTION 'A conta principal nao pode ser editada por este fluxo.';
  END IF;

  IF NOT (
    public.current_user_can('subaccounts.manage', _target_membership.clinic_id)
    OR public.current_user_can('subaccounts.write', _target_membership.clinic_id)
  ) THEN
    RAISE EXCEPTION 'Sem permissao para editar colaboradores nesta clinica.';
  END IF;

  IF (_operational_role IS NOT NULL OR _role_key IS NOT NULL) AND NOT public.current_user_can('subaccounts_roles.manage', _target_membership.clinic_id) THEN
    RAISE EXCEPTION 'Sem permissao para alterar a hierarquia deste colaborador.';
  END IF;

  IF _operational_role = 'owner' OR _normalized_role_key = 'owner' THEN
    RAISE EXCEPTION 'O papel owner fica reservado para a conta principal.';
  END IF;

  IF _membership_status IS NOT NULL AND _membership_status = 'invited' THEN
    RAISE EXCEPTION 'Status convidado e controlado pelo fluxo de convites.';
  END IF;

  -- Validação de role_key em clinic_operational_roles se informada
  IF _normalized_role_key IS NOT NULL THEN
    SELECT *
    INTO _custom_role
    FROM public.clinic_operational_roles
    WHERE clinic_id = _target_membership.clinic_id
      AND role_key = _normalized_role_key
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Papel operacional inválido para esta clínica.';
    END IF;

    IF _inferred_operational_role IS NULL THEN
      _inferred_operational_role := _custom_role.base_operational_role;
    END IF;
  END IF;

  UPDATE public.profiles
  SET
    job_title = CASE WHEN _job_title IS NULL THEN job_title ELSE NULLIF(trim(_job_title), '') END,
    specialty = CASE WHEN _specialty IS NULL THEN specialty ELSE NULLIF(trim(_specialty), '') END,
    working_hours = CASE WHEN _working_hours IS NULL THEN working_hours ELSE NULLIF(trim(_working_hours), '') END,
    updated_at = now()
  WHERE id = _target_membership.user_id;

  UPDATE public.clinic_memberships
  SET
    operational_role = COALESCE(_inferred_operational_role, operational_role),
    role_key = CASE WHEN _role_key IS NULL THEN role_key ELSE _normalized_role_key END,
    membership_status = COALESCE(_membership_status, membership_status),
    is_active = CASE
      WHEN COALESCE(_membership_status, membership_status) = 'active' THEN true
      ELSE false
    END,
    ended_at = CASE
      WHEN COALESCE(_membership_status, membership_status) = 'active' THEN NULL
      WHEN ended_at IS NULL THEN now()
      ELSE ended_at
    END
  WHERE id = _membership_id;

  IF (_inferred_operational_role IS NOT NULL AND _inferred_operational_role IS DISTINCT FROM _target_membership.operational_role)
     OR (_role_key IS NOT NULL AND _normalized_role_key IS DISTINCT FROM _target_membership.role_key) THEN
    PERFORM public.log_security_event(
      _target_membership.clinic_id,
      _requester_id,
      _target_membership.user_id,
      'subaccount_role_changed',
      'admin',
      jsonb_build_object(
        'from_operational_role', _target_membership.operational_role,
        'to_operational_role', COALESCE(_inferred_operational_role, _target_membership.operational_role),
        'from_role_key', _target_membership.role_key,
        'to_role_key', CASE WHEN _role_key IS NULL THEN _target_membership.role_key ELSE _normalized_role_key END
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

  RETURN jsonb_build_object('membership_id', _membership_id);
END;
$$;

-- [RPC/FUNCTION] update_clinic_subaccount (schema.sql L9921-L10037)
CREATE OR REPLACE FUNCTION "public"."update_clinic_subaccount"("_membership_id" "uuid", "_full_name" "text" DEFAULT NULL::"text", "_email" "text" DEFAULT NULL::"text", "_cpf" "text" DEFAULT NULL::"text", "_professional_license" "text" DEFAULT NULL::"text", "_phone" "text" DEFAULT NULL::"text", "_specialty" "text" DEFAULT NULL::"text", "_job_title" "text" DEFAULT NULL::"text", "_operational_role" "public"."operational_role_type" DEFAULT NULL::"public"."operational_role_type", "_membership_status" "public"."membership_status_type" DEFAULT NULL::"public"."membership_status_type", "_new_password" "text" DEFAULT NULL::"text", "_working_hours" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _requester_id uuid := auth.uid();
  _target_membership public.clinic_memberships%ROWTYPE;
  _normalized_email text;
  _normalized_cpf text;
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

  IF NULLIF(coalesce(_new_password, ''), '') IS NOT NULL AND length(_new_password) < 6 THEN
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
      WHEN NULLIF(coalesce(_new_password, ''), '') IS NOT NULL THEN extensions.crypt(_new_password, extensions.gen_salt('bf'))
      ELSE encrypted_password
    END,
    raw_user_meta_data = CASE
      WHEN _full_name IS NOT NULL THEN coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', trim(_full_name))
      ELSE raw_user_meta_data
    END,
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
    email = COALESCE(_normalized_email, email),
    cpf = COALESCE(_normalized_cpf, cpf),
    professional_license = CASE WHEN _professional_license IS NULL THEN professional_license ELSE NULLIF(trim(_professional_license), '') END,
    phone = CASE WHEN _phone IS NULL THEN phone ELSE NULLIF(trim(_phone), '') END,
    specialty = CASE WHEN _specialty IS NULL THEN specialty ELSE NULLIF(trim(_specialty), '') END,
    job_title = CASE WHEN _job_title IS NULL THEN job_title ELSE NULLIF(trim(_job_title), '') END,
    working_hours = CASE WHEN _working_hours IS NULL THEN working_hours ELSE NULLIF(trim(_working_hours), '') END,
    updated_at = now()
  WHERE id = _target_membership.user_id;

  UPDATE public.clinic_memberships
  SET
    operational_role = COALESCE(_operational_role, operational_role),
    membership_status = COALESCE(_membership_status, membership_status)
  WHERE id = _membership_id;

  RETURN jsonb_build_object(
    'membership_id', _membership_id,
    'user_id', _target_membership.user_id,
    'clinic_id', _target_membership.clinic_id
  );
END;
$$;

-- [RPC/FUNCTION] update_clinic_subaccount_profile (schema.sql L10043-L10210)
CREATE OR REPLACE FUNCTION "public"."update_clinic_subaccount_profile"("_membership_id" "uuid", "_full_name" "text" DEFAULT NULL::"text", "_social_name" "text" DEFAULT NULL::"text", "_email" "text" DEFAULT NULL::"text", "_phone" "text" DEFAULT NULL::"text", "_birth_date" "date" DEFAULT NULL::"date", "_cpf" "text" DEFAULT NULL::"text", "_professional_license" "text" DEFAULT NULL::"text", "_specialty" "text" DEFAULT NULL::"text", "_job_title" "text" DEFAULT NULL::"text", "_bio" "text" DEFAULT NULL::"text", "_working_hours" "text" DEFAULT NULL::"text", "_address" "jsonb" DEFAULT NULL::"jsonb", "_operational_role" "public"."operational_role_type" DEFAULT NULL::"public"."operational_role_type", "_membership_status" "public"."membership_status_type" DEFAULT NULL::"public"."membership_status_type", "_new_password" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

-- [RPC/FUNCTION] update_current_profile (schema.sql L10216-L10337)
CREATE OR REPLACE FUNCTION "public"."update_current_profile"("_full_name" "text" DEFAULT NULL::"text", "_social_name" "text" DEFAULT NULL::"text", "_email" "text" DEFAULT NULL::"text", "_phone" "text" DEFAULT NULL::"text", "_birth_date" "date" DEFAULT NULL::"date", "_cpf" "text" DEFAULT NULL::"text", "_professional_license" "text" DEFAULT NULL::"text", "_specialty" "text" DEFAULT NULL::"text", "_job_title" "text" DEFAULT NULL::"text", "_bio" "text" DEFAULT NULL::"text", "_working_hours" "text" DEFAULT NULL::"text", "_address" "jsonb" DEFAULT NULL::"jsonb", "_new_password" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

-- [RPC/FUNCTION] update_current_user_notification_preferences (schema.sql L10343-L10370)
CREATE OR REPLACE FUNCTION "public"."update_current_user_notification_preferences"("_sound_mode" "text" DEFAULT NULL::"text", "_sound_key" "text" DEFAULT NULL::"text", "_notify_security" boolean DEFAULT NULL::boolean, "_notify_clinic_access" boolean DEFAULT NULL::boolean, "_notify_patient_saved" boolean DEFAULT NULL::boolean, "_notify_session_activity" boolean DEFAULT NULL::boolean, "_notify_event_reminders" boolean DEFAULT NULL::boolean, "_notify_system" boolean DEFAULT NULL::boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

-- [RPC/FUNCTION] update_team_development_profile (schema.sql L10376-L10442)
CREATE OR REPLACE FUNCTION "public"."update_team_development_profile"("_user_id" "uuid", "_development_status" "text" DEFAULT NULL::"text", "_internal_level" "text" DEFAULT NULL::"text", "_goals" "text" DEFAULT NULL::"text", "_review_notes" "text" DEFAULT NULL::"text", "_last_review_at" "date" DEFAULT NULL::"date", "_next_review_at" "date" DEFAULT NULL::"date", "_onboarding_flow_read" boolean DEFAULT NULL::boolean, "_onboarding_initial_training" boolean DEFAULT NULL::boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _requester_id uuid := auth.uid();
  _clinic_id uuid := public.get_user_clinic_id(_requester_id);
  _target_profile public.profiles%ROWTYPE;
  _development_id uuid;
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  IF _clinic_id IS NULL THEN
    RAISE EXCEPTION 'Clinica nao encontrada para o usuario atual.';
  END IF;

  IF NOT public.current_user_can('subaccounts_analytics.read', _clinic_id) THEN
    RAISE EXCEPTION 'Sem permissao para editar desenvolvimento da equipe nesta clinica.';
  END IF;

  SELECT *
  INTO _target_profile
  FROM public.profiles
  WHERE id = _user_id
    AND clinic_id = _clinic_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Colaborador nao encontrado nesta clinica.';
  END IF;

  IF _development_status IS NOT NULL
    AND _development_status NOT IN ('onboarding', 'em_evolucao', 'consolidado', 'precisa_supervisao', 'em_pausa') THEN
    RAISE EXCEPTION 'Status de desenvolvimento invalido.';
  END IF;

  IF _internal_level IS NOT NULL
    AND _internal_level NOT IN ('estagiario', 'junior', 'pleno', 'senior', 'referencia') THEN
    RAISE EXCEPTION 'Nivel interno invalido.';
  END IF;

  IF _next_review_at IS NOT NULL AND _last_review_at IS NOT NULL AND _next_review_at < _last_review_at THEN
    RAISE EXCEPTION 'A proxima revisao nao pode ficar antes da ultima revisao.';
  END IF;

  _development_id := public.ensure_team_development_profile(_clinic_id, _user_id);

  UPDATE public.team_development_profiles
  SET
    development_status = COALESCE(_development_status, development_status),
    internal_level = COALESCE(_internal_level, internal_level),
    goals = CASE WHEN _goals IS NULL THEN goals ELSE NULLIF(trim(_goals), '') END,
    review_notes = CASE WHEN _review_notes IS NULL THEN review_notes ELSE NULLIF(trim(_review_notes), '') END,
    last_review_at = COALESCE(_last_review_at, last_review_at),
    next_review_at = COALESCE(_next_review_at, next_review_at),
    onboarding_flow_read = COALESCE(_onboarding_flow_read, onboarding_flow_read),
    onboarding_initial_training = COALESCE(_onboarding_initial_training, onboarding_initial_training)
  WHERE id = _development_id;

  RETURN jsonb_build_object(
    'clinic_id', _clinic_id,
    'development_profile_id', _development_id,
    'user_id', _user_id
  );
END;
$$;

-- [RPC/FUNCTION] upsert_current_user_security_settings (schema.sql L10462-L10515)
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

-- [RPC/FUNCTION] upsert_user_telemetry_summary (schema.sql L10757-L10855)
CREATE OR REPLACE FUNCTION "public"."upsert_user_telemetry_summary"("_clinic_id" "uuid", "_user_name" "text", "_page_views" integer, "_prints_detected" integer, "_docs_printed" integer, "_pdf_exported" integer, "_dwell_seconds" integer, "_top_routes" "jsonb", "_is_spam_flagged" boolean DEFAULT false, "_spam_reason" "text" DEFAULT NULL::"text", "_clinical_records_saved" integer DEFAULT 0, "_forms_completed" integer DEFAULT 0, "_upgrade_views" integer DEFAULT 0, "_form_validation_errors" integer DEFAULT 0, "_recent_errors" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_temp'
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_clean_user_name TEXT := COALESCE(NULLIF(trim(_user_name), ''), 'Usuário');
  v_clean_spam_reason TEXT := NULLIF(trim(_spam_reason), '');
BEGIN
  -- Safe guard: If session is unauthenticated (e.g. race condition during logout/session teardown), return gracefully
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.user_telemetry_summaries (
    user_id,
    clinic_id,
    summary_date,
    user_name,
    page_views_count,
    prints_detected_count,
    docs_printed_count,
    pdf_exported_count,
    dwell_time_seconds,
    top_routes,
    is_spam_flagged,
    spam_reason,
    clinical_records_saved_count,
    forms_completed_count,
    upgrade_views_count,
    form_validation_errors_count,
    recent_errors,
    updated_at
  )
  VALUES (
    v_user_id,
    _clinic_id,
    CURRENT_DATE,
    v_clean_user_name,
    GREATEST(0, COALESCE(_page_views, 0)),
    GREATEST(0, COALESCE(_prints_detected, 0)),
    GREATEST(0, COALESCE(_docs_printed, 0)),
    GREATEST(0, COALESCE(_pdf_exported, 0)),
    GREATEST(0, COALESCE(_dwell_seconds, 0)),
    COALESCE(_top_routes, '{}'::jsonb),
    COALESCE(_is_spam_flagged, false),
    LEFT(v_clean_spam_reason, 500),
    GREATEST(0, COALESCE(_clinical_records_saved, 0)),
    GREATEST(0, COALESCE(_forms_completed, 0)),
    GREATEST(0, COALESCE(_upgrade_views, 0)),
    GREATEST(0, COALESCE(_form_validation_errors, 0)),
    COALESCE(_recent_errors, '[]'::jsonb),
    now()
  )
  ON CONFLICT (user_id, clinic_id, summary_date)
  DO UPDATE SET
    user_name = EXCLUDED.user_name,
    page_views_count = user_telemetry_summaries.page_views_count + EXCLUDED.page_views_count,
    prints_detected_count = user_telemetry_summaries.prints_detected_count + EXCLUDED.prints_detected_count,
    docs_printed_count = user_telemetry_summaries.docs_printed_count + EXCLUDED.docs_printed_count,
    pdf_exported_count = user_telemetry_summaries.pdf_exported_count + EXCLUDED.pdf_exported_count,
    dwell_time_seconds = user_telemetry_summaries.dwell_time_seconds + EXCLUDED.dwell_time_seconds,
    clinical_records_saved_count = user_telemetry_summaries.clinical_records_saved_count + EXCLUDED.clinical_records_saved_count,
    forms_completed_count = user_telemetry_summaries.forms_completed_count + EXCLUDED.forms_completed_count,
    upgrade_views_count = user_telemetry_summaries.upgrade_views_count + EXCLUDED.upgrade_views_count,
    form_validation_errors_count = user_telemetry_summaries.form_validation_errors_count + EXCLUDED.form_validation_errors_count,
    recent_errors = (
      SELECT COALESCE(jsonb_agg(err_elem), '[]'::jsonb)
      FROM (
        SELECT elem AS err_elem
        FROM jsonb_array_elements(
          COALESCE(user_telemetry_summaries.recent_errors, '[]'::jsonb) ||
          COALESCE(EXCLUDED.recent_errors, '[]'::jsonb)
        ) AS elem
        ORDER BY (elem->>'timestamp') DESC NULLS LAST
        LIMIT 20
      ) sub
    ),
    top_routes = (
      SELECT COALESCE(
        jsonb_object_agg(key, sum_val),
        '{}'::jsonb
      )
      FROM (
        SELECT key, sum(value::numeric)::int AS sum_val
        FROM (
          SELECT key, value FROM jsonb_each_text(COALESCE(user_telemetry_summaries.top_routes, '{}'::jsonb))
          UNION ALL
          SELECT key, value FROM jsonb_each_text(COALESCE(EXCLUDED.top_routes, '{}'::jsonb))
        ) combined
        WHERE value ~ '^-?[0-9]+$'
        GROUP BY key
      ) summed
    ),
    is_spam_flagged = user_telemetry_summaries.is_spam_flagged OR EXCLUDED.is_spam_flagged,
    spam_reason = COALESCE(EXCLUDED.spam_reason, user_telemetry_summaries.spam_reason),
    updated_at = now();
END;
$$;

-- [RPC/FUNCTION] user_has_active_clinic_membership (schema.sql L10861-L10875)
CREATE OR REPLACE FUNCTION "public"."user_has_active_clinic_membership"("_user_id" "uuid", "_clinic_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.clinic_memberships
    join public.clinics on clinics.id = clinic_memberships.clinic_id
    where clinic_memberships.user_id = _user_id
      and clinic_memberships.clinic_id = _clinic_id
      and clinic_memberships.is_active = true
      and clinic_memberships.membership_status = 'active'
      and clinics.access_status in ('active', 'payment_pending')
  )
$$;

-- [RPC/FUNCTION] validate_user_clinic (schema.sql L11248-L11261)
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

-- [TABLE] clinic_collaborator_invitations (schema.sql L11391-L11414)
CREATE TABLE IF NOT EXISTS "public"."clinic_collaborator_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "operational_role" "public"."operational_role_type" DEFAULT 'professional'::"public"."operational_role_type" NOT NULL,
    "role_key" "text",
    "job_title" "text",
    "specialty" "text",
    "token_hash" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "invited_by" "uuid",
    "existing_user_id" "uuid",
    "accepted_by" "uuid",
    "accepted_at" timestamp with time zone,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '14 days'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_resent_at" timestamp with time zone,
    "email_delivery_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "email_last_error" "text",
    "email_sent_at" timestamp with time zone,
    CONSTRAINT "clinic_collaborator_invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'cancelled'::"text", 'expired'::"text"]))),
    CONSTRAINT "clinic_collaborator_invitations_email_delivery_status_check" CHECK (("email_delivery_status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text"])))
);

-- [TABLE] clinic_group_color_slots (schema.sql L11420-L11431)
CREATE TABLE IF NOT EXISTS "public"."clinic_group_color_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "slot_index" integer NOT NULL,
    "color_hex" "text" NOT NULL,
    "alpha" integer DEFAULT 100 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "clinic_group_color_slots_alpha_check" CHECK ((("alpha" >= 0) AND ("alpha" <= 100))),
    CONSTRAINT "clinic_group_color_slots_color_hex_check" CHECK (("color_hex" ~ '^#[0-9A-Fa-f]{6}$'::"text")),
    CONSTRAINT "clinic_group_color_slots_slot_index_check" CHECK ((("slot_index" >= 0) AND ("slot_index" < 21)))
);

-- [TABLE] clinic_memberships (schema.sql L11437-L11451)
CREATE TABLE IF NOT EXISTS "public"."clinic_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "account_role" "public"."account_role_type",
    "operational_role" "public"."operational_role_type" DEFAULT 'professional'::"public"."operational_role_type" NOT NULL,
    "role_key" "text",
    "membership_status" "public"."membership_status_type" DEFAULT 'active'::"public"."membership_status_type" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "invited_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- [TABLE] clinic_operational_role_capabilities (schema.sql L11457-L11467)
CREATE TABLE IF NOT EXISTS "public"."clinic_operational_role_capabilities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "operational_role" "text" NOT NULL,
    "capability" "text" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "clinic_operational_role_capabilities_known" CHECK (("capability" = ANY (ARRAY['clinic_profile.read'::"text", 'clinic_profile.manage'::"text", 'forms.read'::"text", 'forms.manage'::"text", 'subaccounts.read'::"text", 'subaccounts.write'::"text", 'subaccounts.manage'::"text", 'subaccounts.delete'::"text", 'subaccounts_roles.read'::"text", 'subaccounts_roles.manage'::"text", 'subscription_billing.read'::"text", 'subscription_billing.manage'::"text", 'treasury.read'::"text", 'treasury.manage'::"text", 'agenda.delete_events'::"text", 'subaccounts_analytics.read'::"text", 'team_development.manage'::"text", 'patients.read'::"text", 'patients.write'::"text", 'patients.delete'::"text", 'patients_groups.read'::"text", 'patients.manage_groups'::"text", 'schedule.read'::"text", 'schedule.read_all'::"text", 'schedule.write'::"text", 'schedule.write_others'::"text", 'sessions.read'::"text", 'sessions.write'::"text", 'sessions.read_all'::"text", 'sessions.write_others'::"text", 'sessions.share'::"text", 'sessions.delete'::"text", 'session.delete_draft'::"text", 'system.print'::"text"]))),
    CONSTRAINT "clinic_operational_role_capabilities_no_owner" CHECK (("operational_role" <> 'owner'::"text"))
);

-- [TABLE] clinic_operational_roles (schema.sql L11475-L11489)
CREATE TABLE IF NOT EXISTS "public"."clinic_operational_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "role_key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "description" "text",
    "base_operational_role" "public"."operational_role_type" DEFAULT 'professional'::"public"."operational_role_type" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "is_system" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "clinic_operational_roles_key_shape" CHECK (("role_key" ~ '^[a-z][a-z0-9_]{1,39}$'::"text")),
    CONSTRAINT "clinic_operational_roles_label_not_blank" CHECK (("btrim"("label") <> ''::"text")),
    CONSTRAINT "clinic_operational_roles_no_custom_owner" CHECK ((("is_system" = true) OR ("role_key" <> 'owner'::"text")))
);

-- [TABLE] clinic_subscriptions (schema.sql L11497-L11549)
CREATE TABLE IF NOT EXISTS "public"."clinic_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "account_owner_user_id" "uuid" NOT NULL,
    "asaas_customer_id" "text",
    "asaas_subscription_id" "text",
    "plan_type" "public"."subscription_plan" DEFAULT 'solo'::"public"."subscription_plan" NOT NULL,
    "billing_cycle" "text" DEFAULT 'MONTHLY'::"text" NOT NULL,
    "payment_method" "text" DEFAULT 'FREE_BETA'::"text" NOT NULL,
    "base_monthly_price" numeric(10,2) DEFAULT 60.00 NOT NULL,
    "base_concurrent_access_count" integer DEFAULT 2 NOT NULL,
    "additional_concurrent_access_count" integer DEFAULT 0 NOT NULL,
    "additional_concurrent_access_price" numeric(10,2) DEFAULT 10.00 NOT NULL,
    "total_recurring_monthly_price" numeric(10,2) DEFAULT 60.00 NOT NULL,
    "base_subaccount_limit" integer DEFAULT 30 NOT NULL,
    "purchased_subaccount_extra_count" integer DEFAULT 0 NOT NULL,
    "purchased_subaccount_unit_price" numeric(10,2) DEFAULT 5.00 NOT NULL,
    "status" "text" DEFAULT 'BETA'::"text" NOT NULL,
    "next_due_date" "date",
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applied_coupon_id" "uuid",
    "coupon_code" "text",
    "discount_percentage" numeric(5,2) DEFAULT 0.00,
    "discount_fixed_amount" numeric(10,2) DEFAULT 0.00,
    "trial_ends_at" timestamp with time zone,
    "override_reason" "text",
    "override_by_user_id" "uuid",
    "override_at" timestamp with time zone,
    "cpf_cnpj" "text",
    "billing_email" "text",
    "billing_name" "text",
    "is_free_trial" boolean DEFAULT false,
    "trial_max_attendances" integer DEFAULT 20,
    "trial_max_patients" integer DEFAULT 5,
    "trial_max_custom_forms" integer DEFAULT 1,
    "installment_count" integer DEFAULT 1,
    "auto_renew" boolean DEFAULT true,
    "period_duration_days" integer DEFAULT 30,
    "expires_at" timestamp with time zone,
    "is_courtesy" boolean DEFAULT false NOT NULL,
    "courtesy_reason" "text",
    "trial_card_token" "text",
    "is_read_only" boolean DEFAULT false,
    "billing_due_window" "text" DEFAULT 'DAY_1_TO_5'::"text",
    "billing_due_window_updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "clinic_subscriptions_discount_fixed_amount_check" CHECK (("discount_fixed_amount" >= (0)::numeric)),
    CONSTRAINT "clinic_subscriptions_discount_percentage_check" CHECK ((("discount_percentage" >= (0)::numeric) AND ("discount_percentage" <= (100)::numeric))),
    CONSTRAINT "clinic_subscriptions_status_check" CHECK (("status" = ANY (ARRAY['ACTIVE'::"text", 'PENDING'::"text", 'TRIAL'::"text", 'TRIAL_EXPIRED'::"text", 'BETA'::"text", 'OVERDUE'::"text", 'PAUSED'::"text", 'CANCELED'::"text", 'SUSPENDED'::"text", 'EXPIRED'::"text", 'COURTESY'::"text"]))),
    CONSTRAINT "clinic_subscriptions_billing_due_window_check" CHECK (("billing_due_window" = ANY (ARRAY['DAY_1_TO_5'::"text", 'DAY_10_TO_15'::"text", 'DAY_25_TO_30'::"text"])))
);

-- [TABLE] clinic_tag_relations (schema.sql L11555-L11560)
CREATE TABLE IF NOT EXISTS "public"."clinic_tag_relations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);

-- [TABLE] clinic_tags (schema.sql L11566-L11572)
CREATE TABLE IF NOT EXISTS "public"."clinic_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#808080'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

-- [TABLE] clinic_terms (schema.sql L11578-L11593)
CREATE TABLE IF NOT EXISTS "public"."clinic_terms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "term_type" "text" NOT NULL,
    "original_filename" "text" NOT NULL,
    "content_markdown" "text" NOT NULL,
    "b2_object_key" "text" NOT NULL,
    "byte_size" integer DEFAULT 0 NOT NULL,
    "compressed_byte_size" integer DEFAULT 0 NOT NULL,
    "storage_encoding" "text" DEFAULT 'gzip'::"text" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "clinic_terms_term_type_check" CHECK (("term_type" = ANY (ARRAY['adult_consent'::"text", 'minor_consent'::"text"])))
);

-- [TABLE] clinics (schema.sql L11599-L11629)
CREATE TABLE IF NOT EXISTS "public"."clinics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cnpj" "text" NOT NULL,
    "name" "text" DEFAULT ''::"text" NOT NULL,
    "logo_url" "text",
    "theme" "jsonb" DEFAULT '{"accent": "210 40% 96.1%", "primary": "221.2 83.2% 53.3%", "secondary": "210 40% 96.1%"}'::"jsonb",
    "custom_fields" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "anamnesis_base_schema" "jsonb" DEFAULT "jsonb_build_array"("jsonb_build_object"('id', 'section_initial', 'label', 'Contexto inicial', 'type', 'section', 'helpText', 'Use esta área para orientar o preenchimento da ficha.'), "jsonb_build_object"('id', 'main_complaint', 'label', 'Queixa principal', 'type', 'long_text', 'required', true)) NOT NULL,
    "legal_name" "text",
    "email" "text",
    "phone" "text",
    "address" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "business_hours" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "subscription_plan" "public"."subscription_plan" DEFAULT 'solo'::"public"."subscription_plan" NOT NULL,
    "account_owner_user_id" "uuid",
    "subaccount_limit" integer DEFAULT 0 NOT NULL,
    "route_key" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(12), 'hex'::"text") NOT NULL,
    "access_status" "text" DEFAULT 'active'::"text" NOT NULL,
    "concurrent_access_limit" integer,
    "is_hibernated" boolean DEFAULT false NOT NULL,
    "hibernated_at" timestamp with time zone,
    "last_accessed_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "clinics_access_status_check" CHECK (("access_status" = ANY (ARRAY['active'::"text", 'payment_pending'::"text", 'temporarily_paused'::"text", 'banned'::"text"]))),
    CONSTRAINT "clinics_anamnesis_base_schema_shape_check" CHECK ((("jsonb_typeof"("anamnesis_base_schema") = 'array'::"text") AND
CASE
    WHEN ("jsonb_typeof"("anamnesis_base_schema") = 'array'::"text") THEN ("jsonb_array_length"("anamnesis_base_schema") <= 200)
    ELSE false
END))
);

-- [TABLE] profiles (schema.sql L12061-L12090)
CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "clinic_id" "uuid",
    "full_name" "text",
    "email" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "social_name" "text",
    "phone" "text",
    "birth_date" "date",
    "job_title" "text",
    "specialty" "text",
    "specialties" "jsonb",
    "professional_license" "text",
    "bio" "text",
    "avatar_url" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cpf" "text",
    "last_seen_at" timestamp with time zone,
    "working_hours" "text",
    "public_code" "text" NOT NULL,
    "address" "jsonb",
    "last_password_changed_at" timestamp with time zone,
    "password_temporary" boolean DEFAULT false NOT NULL,
    "owner_terms_accepted_at" timestamp with time zone,
    "profession" "text",
    "council_name" "text" DEFAULT 'CREFITO'::"text",
    "totp_secret" "text",
    "totp_enabled" boolean DEFAULT false NOT NULL,
    "totp_enabled_at" timestamp with time zone
);

-- [TABLE] team_development_profiles (schema.sql L12281-L12297)
CREATE TABLE IF NOT EXISTS "public"."team_development_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "development_status" "text" DEFAULT 'onboarding'::"text" NOT NULL,
    "internal_level" "text" DEFAULT 'junior'::"text" NOT NULL,
    "goals" "text",
    "review_notes" "text",
    "last_review_at" "date",
    "next_review_at" "date",
    "onboarding_flow_read" boolean DEFAULT false NOT NULL,
    "onboarding_initial_training" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "team_development_profiles_development_status_check" CHECK (("development_status" = ANY (ARRAY['onboarding'::"text", 'em_evolucao'::"text", 'consolidado'::"text", 'precisa_supervisao'::"text", 'em_pausa'::"text"]))),
    CONSTRAINT "team_development_profiles_internal_level_check" CHECK (("internal_level" = ANY (ARRAY['estagiario'::"text", 'junior'::"text", 'pleno'::"text", 'senior'::"text", 'referencia'::"text"])))
);

-- [TABLE] user_active_clinic_contexts (schema.sql L12320-L12324)
CREATE TABLE IF NOT EXISTS "public"."user_active_clinic_contexts" (
    "user_id" "uuid" NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- [TABLE] user_governance_overrides (schema.sql L12330-L12335)
CREATE TABLE IF NOT EXISTS "public"."user_governance_overrides" (
    "user_id" "uuid" NOT NULL,
    "max_actions" integer DEFAULT 150 NOT NULL,
    "time_window_minutes" integer DEFAULT 5 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- [TABLE] user_punishments (schema.sql L12341-L12351)
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

-- [TABLE] user_release_note_states (schema.sql L12357-L12364)
CREATE TABLE IF NOT EXISTS "public"."user_release_note_states" (
    "user_id" "uuid" NOT NULL,
    "last_seen_release_id" "uuid",
    "last_seen_release_order" integer DEFAULT 0 NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- [TABLE] user_roles (schema.sql L12370-L12374)
CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL
);

-- [TABLE] user_security_settings (schema.sql L12402-L12411)
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

-- [TABLE] user_telemetry_summaries (schema.sql L12417-L12437)
CREATE TABLE IF NOT EXISTS "public"."user_telemetry_summaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "clinic_id" "uuid",
    "summary_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "user_name" "text",
    "page_views_count" integer DEFAULT 0 NOT NULL,
    "prints_detected_count" integer DEFAULT 0 NOT NULL,
    "docs_printed_count" integer DEFAULT 0 NOT NULL,
    "pdf_exported_count" integer DEFAULT 0 NOT NULL,
    "dwell_time_seconds" integer DEFAULT 0 NOT NULL,
    "top_routes" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_spam_flagged" boolean DEFAULT false NOT NULL,
    "spam_reason" "text",
    "clinical_records_saved_count" integer DEFAULT 0 NOT NULL,
    "forms_completed_count" integer DEFAULT 0 NOT NULL,
    "upgrade_views_count" integer DEFAULT 0 NOT NULL,
    "form_validation_errors_count" integer DEFAULT 0 NOT NULL,
    "recent_errors" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- [POLICY] Managers insert clinic memberships ON clinic_memberships (schema.sql L14087-L14089)
CREATE POLICY "Managers insert clinic memberships" ON "public"."clinic_memberships" FOR INSERT TO "authenticated" WITH CHECK (("public"."current_user_can"('subaccounts.manage'::"text", "clinic_id") AND (EXISTS ( SELECT 1
   FROM "public"."clinics"
  WHERE (("clinics"."id" = "clinic_memberships"."clinic_id") AND ("clinics"."subscription_plan" = 'clinic'::"public"."subscription_plan"))))));

-- [POLICY] Managers read clinic collaborator invitations ON clinic_collaborator_invitations (schema.sql L14093-L14093)
CREATE POLICY "Managers read clinic collaborator invitations" ON "public"."clinic_collaborator_invitations" FOR SELECT TO "authenticated" USING ("public"."current_user_can"('subaccounts.manage'::"text", "clinic_id"));

-- [POLICY] Managers update clinic memberships ON clinic_memberships (schema.sql L14097-L14097)
CREATE POLICY "Managers update clinic memberships" ON "public"."clinic_memberships" FOR UPDATE TO "authenticated" USING ("public"."current_user_can"('subaccounts.manage'::"text", "clinic_id")) WITH CHECK ("public"."current_user_can"('subaccounts.manage'::"text", "clinic_id"));

-- [POLICY] Managers update clinic profiles ON profiles (schema.sql L14101-L14101)
CREATE POLICY "Managers update clinic profiles" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ("public"."current_user_can"('subaccounts.manage'::"text", "clinic_id")) WITH CHECK ("public"."current_user_can"('subaccounts.manage'::"text", "clinic_id"));

-- [POLICY] Owners e gestores podem ver a assinatura ON clinic_subscriptions (schema.sql L14105-L14107)
CREATE POLICY "Owners e gestores podem ver a assinatura" ON "public"."clinic_subscriptions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."clinic_memberships" "cm"
  WHERE (("cm"."clinic_id" = "clinic_subscriptions"."clinic_id") AND ("cm"."user_id" = "auth"."uid"()) AND ("cm"."is_active" = true) AND ("cm"."membership_status" = 'active'::"public"."membership_status_type") AND (("cm"."account_role" = 'account_owner'::"public"."account_role_type") OR "public"."current_user_can"('subscription_billing.read'::"text", "clinic_subscriptions"."clinic_id"))))));

-- [POLICY] Platform admins podem ver todas as clinicas ON clinics (schema.sql L14123-L14125)
CREATE POLICY "Platform admins podem ver todas as clinicas" ON "public"."clinics" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."platform_admins" "pa"
  WHERE (("pa"."user_id" = "auth"."uid"()) AND ("pa"."is_active" = true)))));

-- [POLICY] Platform admins podem ver todas as assinaturas ON clinic_subscriptions (schema.sql L14129-L14131)
CREATE POLICY "Platform admins podem ver todas as assinaturas" ON "public"."clinic_subscriptions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."platform_admins" "pa"
  WHERE (("pa"."user_id" = "auth"."uid"()) AND ("pa"."is_active" = true)))));

-- [POLICY] Platform owners can manage governance overrides ON user_governance_overrides (schema.sql L14151-L14151)
CREATE POLICY "Platform owners can manage governance overrides" ON "public"."user_governance_overrides" TO "authenticated" USING ("public"."is_platform_owner"()) WITH CHECK ("public"."is_platform_owner"());

-- [POLICY] Platform owners can manage user punishments ON user_punishments (schema.sql L14159-L14159)
CREATE POLICY "Platform owners can manage user punishments" ON "public"."user_punishments" TO "authenticated" USING ("public"."is_platform_owner"()) WITH CHECK ("public"."is_platform_owner"());

-- [POLICY] Platform owners can view all summaries ON user_telemetry_summaries (schema.sql L14163-L14163)
CREATE POLICY "Platform owners can view all summaries" ON "public"."user_telemetry_summaries" FOR SELECT TO "authenticated" USING ("public"."is_platform_owner"());

-- [POLICY] Platform owners manage clinic_tag_relations ON clinic_tag_relations (schema.sql L14171-L14171)
CREATE POLICY "Platform owners manage clinic_tag_relations" ON "public"."clinic_tag_relations" USING ("public"."is_platform_owner"("auth"."uid"()));

-- [POLICY] Platform owners manage clinic_tags ON clinic_tags (schema.sql L14175-L14175)
CREATE POLICY "Platform owners manage clinic_tags" ON "public"."clinic_tags" USING ("public"."is_platform_owner"("auth"."uid"()));

-- [POLICY] Super admins manage all clinics ON clinics (schema.sql L14223-L14223)
CREATE POLICY "Super admins manage all clinics" ON "public"."clinics" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));

-- [POLICY] Super admins manage all profiles ON profiles (schema.sql L14243-L14243)
CREATE POLICY "Super admins manage all profiles" ON "public"."profiles" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));

-- [POLICY] Super admins manage all roles ON user_roles (schema.sql L14247-L14247)
CREATE POLICY "Super admins manage all roles" ON "public"."user_roles" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));

-- [POLICY] Users can insert own profile ON profiles (schema.sql L14263-L14263)
CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));

-- [POLICY] Users can read own active punishments ON user_punishments (schema.sql L14267-L14267)
CREATE POLICY "Users can read own active punishments" ON "public"."user_punishments" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR "public"."is_platform_owner"()));

-- [POLICY] Users can read own overrides ON user_governance_overrides (schema.sql L14271-L14271)
CREATE POLICY "Users can read own overrides" ON "public"."user_governance_overrides" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR "public"."is_platform_owner"()));

-- [POLICY] Users can upsert own summary row ON user_telemetry_summaries (schema.sql L14275-L14275)
CREATE POLICY "Users can upsert own summary row" ON "public"."user_telemetry_summaries" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

-- [POLICY] Users delete clinic terms ON clinic_terms (schema.sql L14297-L14297)
CREATE POLICY "Users delete clinic terms" ON "public"."clinic_terms" FOR DELETE TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('clinic_terms.manage'::"text", "clinic_id")));

-- [POLICY] Users insert clinic terms ON clinic_terms (schema.sql L14321-L14321)
CREATE POLICY "Users insert clinic terms" ON "public"."clinic_terms" FOR INSERT TO "authenticated" WITH CHECK ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('clinic_terms.manage'::"text", "clinic_id")));

-- [POLICY] Users read clinic memberships ON clinic_memberships (schema.sql L14349-L14349)
CREATE POLICY "Users read clinic memberships" ON "public"."clinic_memberships" FOR SELECT TO "authenticated" USING (("clinic_id" = "public"."get_user_clinic_id"("auth"."uid"())));

-- [POLICY] Users read clinic profiles ON profiles (schema.sql L14365-L14368)
CREATE POLICY "Users read clinic profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role") AS "has_role") OR (("clinic_id" IS NOT NULL) AND ("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id"))) OR (EXISTS ( SELECT 1
   FROM ("public"."clinic_memberships" "requester_membership"
     JOIN "public"."clinic_memberships" "target_membership" ON (("target_membership"."clinic_id" = "requester_membership"."clinic_id")))
  WHERE (("requester_membership"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("requester_membership"."is_active" = true) AND ("target_membership"."user_id" = "profiles"."id"))))));

-- [POLICY] Users read clinic terms ON clinic_terms (schema.sql L14382-L14382)
CREATE POLICY "Users read clinic terms" ON "public"."clinic_terms" FOR SELECT TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND "public"."can_read_clinic_data"("clinic_id") AND ("public"."current_user_can"('patients.read'::"text", "clinic_id") OR "public"."current_user_can"('clinic_terms.manage'::"text", "clinic_id") OR "public"."current_user_can"('clinic_profile.read'::"text", "clinic_id"))));

-- [POLICY] Users read clinic_group_color_slots ON clinic_group_color_slots (schema.sql L14386-L14386)
CREATE POLICY "Users read clinic_group_color_slots" ON "public"."clinic_group_color_slots" FOR SELECT TO "authenticated" USING ((("clinic_id" = "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid"))) AND "public"."current_user_can"('patients.read'::"text", "clinic_id")));

-- [POLICY] Users read own active clinic context ON user_active_clinic_contexts (schema.sql L14390-L14390)
CREATE POLICY "Users read own active clinic context" ON "public"."user_active_clinic_contexts" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));

-- [POLICY] Users read own clinic ON clinics (schema.sql L14398-L14398)
CREATE POLICY "Users read own clinic" ON "public"."clinics" FOR SELECT TO "authenticated" USING (("id" = "public"."get_user_clinic_id"("auth"."uid"())));

-- [POLICY] Users read own release note state ON user_release_note_states (schema.sql L14406-L14406)
CREATE POLICY "Users read own release note state" ON "public"."user_release_note_states" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));

-- [POLICY] Users read own roles ON user_roles (schema.sql L14410-L14410)
CREATE POLICY "Users read own roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));

-- [POLICY] Users update clinic terms ON clinic_terms (schema.sql L14442-L14442)
CREATE POLICY "Users update clinic terms" ON "public"."clinic_terms" FOR UPDATE TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('clinic_terms.manage'::"text", "clinic_id"))) WITH CHECK ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('clinic_terms.manage'::"text", "clinic_id")));

-- [POLICY] Users update managed clinic ON clinics (schema.sql L14446-L14446)
CREATE POLICY "Users update managed clinic" ON "public"."clinics" FOR UPDATE TO "authenticated" USING ("public"."current_user_can"('clinic_profile.manage'::"text", "id")) WITH CHECK ("public"."current_user_can"('clinic_profile.manage'::"text", "id"));

-- [POLICY] Users update own profile ON profiles (schema.sql L14454-L14454)
CREATE POLICY "Users update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));

-- [POLICY] Users write clinic_group_color_slots ON clinic_group_color_slots (schema.sql L14486-L14486)
CREATE POLICY "Users write clinic_group_color_slots" ON "public"."clinic_group_color_slots" TO "authenticated" USING ((("clinic_id" = "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid"))) AND "public"."current_user_can"('patients.write'::"text", "clinic_id"))) WITH CHECK ((("clinic_id" = "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid"))) AND "public"."current_user_can"('patients.write'::"text", "clinic_id")));

-- [POLICY] operational roles are manageable by role admins ON clinic_operational_roles (schema.sql L14558-L14558)
CREATE POLICY "operational roles are manageable by role admins" ON "public"."clinic_operational_roles" USING ("public"."current_user_can"('subaccounts_roles.manage'::"text", "clinic_id")) WITH CHECK ("public"."current_user_can"('subaccounts_roles.manage'::"text", "clinic_id"));

-- [POLICY] operational roles are readable by clinic members ON clinic_operational_roles (schema.sql L14562-L14562)
CREATE POLICY "operational roles are readable by clinic members" ON "public"."clinic_operational_roles" FOR SELECT USING ("public"."user_has_active_clinic_membership"("auth"."uid"(), "clinic_id"));

-- [POLICY] platform owners can manage all clinic operational role capabili ON clinic_operational_role_capabilities (schema.sql L14590-L14590)
CREATE POLICY "platform owners can manage all clinic operational role capabili" ON "public"."clinic_operational_role_capabilities" USING ("public"."is_platform_owner"("auth"."uid"())) WITH CHECK ("public"."is_platform_owner"("auth"."uid"()));

-- [POLICY] platform owners can manage all clinic operational roles ON clinic_operational_roles (schema.sql L14594-L14594)
CREATE POLICY "platform owners can manage all clinic operational roles" ON "public"."clinic_operational_roles" USING ("public"."is_platform_owner"("auth"."uid"())) WITH CHECK ("public"."is_platform_owner"("auth"."uid"()));

-- [POLICY] platform owners can read all clinic operational role capabiliti ON clinic_operational_role_capabilities (schema.sql L14598-L14598)
CREATE POLICY "platform owners can read all clinic operational role capabiliti" ON "public"."clinic_operational_role_capabilities" FOR SELECT USING ("public"."is_platform_owner"("auth"."uid"()));

-- [POLICY] platform owners can read all clinic operational roles ON clinic_operational_roles (schema.sql L14602-L14602)
CREATE POLICY "platform owners can read all clinic operational roles" ON "public"."clinic_operational_roles" FOR SELECT USING ("public"."is_platform_owner"("auth"."uid"()));

-- [POLICY] role capabilities are manageable by role admins ON clinic_operational_role_capabilities (schema.sql L14630-L14630)
CREATE POLICY "role capabilities are manageable by role admins" ON "public"."clinic_operational_role_capabilities" USING ("public"."current_user_can"('subaccounts_roles.manage'::"text", "clinic_id")) WITH CHECK ("public"."current_user_can"('subaccounts_roles.manage'::"text", "clinic_id"));

-- [POLICY] role capabilities are readable by clinic members ON clinic_operational_role_capabilities (schema.sql L14634-L14634)
CREATE POLICY "role capabilities are readable by clinic members" ON "public"."clinic_operational_role_capabilities" FOR SELECT USING ("public"."user_has_active_clinic_membership"("auth"."uid"(), "clinic_id"));

-- [POLICY] team development readable by clinic admins or self ON team_development_profiles (schema.sql L14656-L14656)
CREATE POLICY "team development readable by clinic admins or self" ON "public"."team_development_profiles" FOR SELECT USING ((("clinic_id" = "public"."get_user_clinic_id"("auth"."uid"())) AND ("public"."current_user_can"('subaccounts_analytics.read'::"text", "clinic_id") OR ("user_id" = "auth"."uid"()))));

-- [POLICY] users can read own security settings ON user_security_settings (schema.sql L14698-L14698)
CREATE POLICY "users can read own security settings" ON "public"."user_security_settings" FOR SELECT USING (("user_id" = "auth"."uid"()));

-- [RPC/FUNCTION] get_clinic_storage_usage (schema.sql L16159-L16165)
CREATE OR REPLACE FUNCTION public.get_clinic_storage_usage(_clinic_id uuid)
RETURNS TABLE (
  total_bytes bigint,
  total_files bigint
) 
LANGUAGE sql
SECURITY DEFINER
