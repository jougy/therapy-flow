-- ==========================================================================
-- DOMÍNIO: CORE_MISC (Gerado automaticamente por npm run schema:index)
-- Fonte SSOT: supabase/schema.sql
-- ==========================================================================

-- [RPC/FUNCTION] batch_sync_push (schema.sql L1272-L1421)
CREATE OR REPLACE FUNCTION "public"."batch_sync_push"("_mutations" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  _item jsonb;
  _table text;
  _action text;
  _id uuid;
  _expected_version integer;
  _current_version integer;
  _data jsonb;
  _results jsonb := '[]'::jsonb;
  _user_id uuid := auth.uid();
  _applied_count integer := 0;
  _conflict_count integer := 0;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF _mutations IS NULL OR jsonb_typeof(_mutations) <> 'array' THEN
    RAISE EXCEPTION 'Payload inválido: array esperado.';
  END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(_mutations)
  LOOP
    _table := _item->>'table';
    _action := _item->>'action'; -- 'upsert' ou 'delete'
    _id := (_item->>'id')::uuid;
    _expected_version := (_item->>'expected_version')::integer;
    _data := COALESCE(_item->'data', '{}'::jsonb);

    IF _table = 'sessions' THEN
      IF _action = 'delete' THEN
        UPDATE public.sessions
        SET deleted_at = now(), deleted_by_user_id = _user_id
        WHERE id = _id AND deleted_at IS NULL;

        _applied_count := _applied_count + 1;
        _results := _results || jsonb_build_object('id', _id, 'status', 'deleted');
      ELSE
        -- Checagem de versão concorrente
        SELECT version INTO _current_version FROM public.sessions WHERE id = _id;

        IF _current_version IS NOT NULL AND _expected_version IS NOT NULL AND _current_version > _expected_version THEN
          _conflict_count := _conflict_count + 1;
          _results := _results || jsonb_build_object('id', _id, 'status', 'conflict', 'server_version', _current_version);
        ELSE
          -- Executar update ou insert seguro
          IF _current_version IS NOT NULL THEN
            UPDATE public.sessions
            SET
              notes = COALESCE(_data->>'notes', notes),
              status = COALESCE(_data->>'status', status),
              pain_score = COALESCE((_data->>'pain_score')::integer, pain_score),
              anamnesis = CASE WHEN _data ? 'anamnesis' THEN _data->'anamnesis' ELSE anamnesis END,
              treatment = CASE WHEN _data ? 'treatment' THEN _data->'treatment' ELSE treatment END,
              updated_at = now()
            WHERE id = _id;
          ELSE
            INSERT INTO public.sessions (
              id,
              user_id,
              patient_id,
              clinic_id,
              session_date,
              notes,
              status,
              pain_score,
              anamnesis,
              treatment
            )
            VALUES (
              _id,
              _user_id,
              (_data->>'patient_id')::uuid,
              (_data->>'clinic_id')::uuid,
              COALESCE((_data->>'session_date')::timestamptz, now()),
              _data->>'notes',
              COALESCE(_data->>'status', 'rascunho'),
              COALESCE((_data->>'pain_score')::integer, 0),
              _data->'anamnesis',
              _data->'treatment'
            );
          END IF;

          _applied_count := _applied_count + 1;
          _results := _results || jsonb_build_object('id', _id, 'status', 'applied');
        END IF;
      END IF;

    ELSIF _table = 'agenda_events' THEN
      IF _action = 'delete' THEN
        DELETE FROM public.agenda_events WHERE id = _id;
        _applied_count := _applied_count + 1;
        _results := _results || jsonb_build_object('id', _id, 'status', 'deleted');
      ELSE
        SELECT version INTO _current_version FROM public.agenda_events WHERE id = _id;

        IF _current_version IS NOT NULL AND _expected_version IS NOT NULL AND _current_version > _expected_version THEN
          _conflict_count := _conflict_count + 1;
          _results := _results || jsonb_build_object('id', _id, 'status', 'conflict', 'server_version', _current_version);
        ELSE
          IF _current_version IS NOT NULL THEN
            UPDATE public.agenda_events
            SET
              title = COALESCE(_data->>'title', title),
              scheduled_for = COALESCE((_data->>'scheduled_for')::timestamptz, scheduled_for),
              status = COALESCE(_data->>'status', status),
              updated_at = now()
            WHERE id = _id;
          ELSE
            INSERT INTO public.agenda_events (
              id,
              user_id,
              clinic_id,
              patient_id,
              title,
              scheduled_for,
              event_type,
              status
            )
            VALUES (
              _id,
              _user_id,
              (_data->>'clinic_id')::uuid,
              (_data->>'patient_id')::uuid,
              COALESCE(_data->>'title', 'Consulta'),
              COALESCE((_data->>'scheduled_for')::timestamptz, now()),
              COALESCE(_data->>'event_type', 'atendimento'),
              COALESCE(_data->>'status', 'agendado')
            );
          END IF;

          _applied_count := _applied_count + 1;
          _results := _results || jsonb_build_object('id', _id, 'status', 'applied');
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'applied_count', _applied_count,
    'conflict_count', _conflict_count,
    'results', _results
  );
END;
$$;

-- [RPC/FUNCTION] custom_access_token_hook (schema.sql L3226-L3264)
CREATE OR REPLACE FUNCTION "public"."custom_access_token_hook"("event" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  _user_id uuid;
  _claims jsonb;
  _active_clinic_id uuid;
  _role text;
  _is_owner boolean := false;
BEGIN
  _user_id := (event->>'user_id')::uuid;
  _claims := COALESCE(event->'claims', '{}'::jsonb);

  IF _user_id IS NOT NULL THEN
    _active_clinic_id := public.get_user_clinic_id(_user_id);

    IF _active_clinic_id IS NOT NULL THEN
      SELECT 
        operational_role::text,
        (account_role = 'account_owner' OR operational_role = 'owner')
      INTO _role, _is_owner
      FROM public.clinic_memberships
      WHERE user_id = _user_id 
        AND clinic_id = _active_clinic_id
        AND is_active = true
        AND membership_status = 'active'
      LIMIT 1;

      _claims := jsonb_set(_claims, '{active_clinic_id}', to_jsonb(_active_clinic_id::text));
      _claims := jsonb_set(_claims, '{operational_role}', to_jsonb(COALESCE(_role, 'professional')));
      _claims := jsonb_set(_claims, '{is_clinic_owner}', to_jsonb(COALESCE(_is_owner, false)));
    END IF;
  END IF;

  event := jsonb_set(event, '{claims}', _claims);
  RETURN event;
END;
$$;

-- [RPC/FUNCTION] finalize_overdue_agenda_events (schema.sql L4038-L4150)
CREATE OR REPLACE FUNCTION "public"."finalize_overdue_agenda_events"("_batch_size" integer DEFAULT 500, "_timezone" "text" DEFAULT 'America/Sao_Paulo'::"text") RETURNS TABLE("cancelled_count" integer, "deleted_event_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _safe_batch_size integer := LEAST(GREATEST(COALESCE(_batch_size, 500), 1), 5000);
  _today_start timestamptz;
BEGIN
  _today_start := date_trunc('day', timezone(_timezone, now())) AT TIME ZONE _timezone;

  RETURN QUERY
  WITH due_events AS (
    SELECT agenda_events.*
    FROM public.agenda_events
    WHERE agenda_events.event_type = 'atendimento'
      AND agenda_events.patient_id IS NOT NULL
      AND agenda_events.status <> 'cancelado'
      AND agenda_events.scheduled_for < _today_start
    ORDER BY agenda_events.scheduled_for ASC
    LIMIT _safe_batch_size
    FOR UPDATE SKIP LOCKED
  ),
  ensure_cancelled_groups AS (
    INSERT INTO public.patient_groups (
      user_id,
      patient_id,
      clinic_id,
      name,
      color,
      status,
      is_default,
      group_kind
    )
    SELECT DISTINCT
      due_events.user_id,
      due_events.patient_id,
      due_events.clinic_id,
      'Cancelados',
      'rose',
      'cancelado',
      false,
      'cancelados'
    FROM due_events
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.patient_groups
      WHERE patient_groups.patient_id = due_events.patient_id
        AND patient_groups.group_kind = 'cancelados'
    )
    ON CONFLICT DO NOTHING
    RETURNING id
  ),
  cancelled_groups AS (
    SELECT patient_groups.patient_id, patient_groups.id
    FROM public.patient_groups
    JOIN due_events ON due_events.patient_id = patient_groups.patient_id
    WHERE patient_groups.group_kind = 'cancelados'
  ),
  inserted_sessions AS (
    INSERT INTO public.sessions (
      user_id,
      patient_id,
      group_id,
      session_date,
      status,
      anamnesis,
      treatment,
      pain_score,
      complexity_score,
      notes,
      clinic_id,
      provider_id,
      scheduled_start_at,
      patient_arrived_at,
      payment_status,
      amount_charged_cents,
      amount_paid_cents,
      amount_original_cents
    )
    SELECT
      due_events.user_id,
      due_events.patient_id,
      cancelled_groups.id,
      due_events.scheduled_for,
      'cancelado',
      '{}'::jsonb,
      '{}'::jsonb,
      0,
      0,
      'Atendimento cancelado automaticamente porque o agendamento passou do fim do dia sem intervenção do usuário.',
      due_events.clinic_id,
      due_events.user_id,
      due_events.scheduled_for,
      NULL,
      'nao_cobrado',
      0,
      0,
      0
    FROM due_events
    LEFT JOIN cancelled_groups ON cancelled_groups.patient_id = due_events.patient_id
    RETURNING id
  ),
  deleted_events AS (
    DELETE FROM public.agenda_events
    USING due_events
    WHERE agenda_events.id = due_events.id
    RETURNING agenda_events.id
  )
  SELECT
    (SELECT COUNT(*)::integer FROM inserted_sessions),
    (SELECT COUNT(*)::integer FROM deleted_events);
END;
$$;

-- [RPC/FUNCTION] handle_personal_signup (schema.sql L6583-L6826)
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

-- [RPC/FUNCTION] handle_signup (schema.sql L6845-L6885)
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

-- [RPC/FUNCTION] handle_signup (schema.sql L6891-L6967)
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

-- [RPC/FUNCTION] handle_signup (schema.sql L6973-L7059)
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

-- [RPC/FUNCTION] handle_signup (schema.sql L7065-L7198)
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

-- [RPC/FUNCTION] log_security_event (schema.sql L8629-L8725)
CREATE OR REPLACE FUNCTION "public"."log_security_event"("_clinic_id" "uuid", "_actor_user_id" "uuid", "_target_user_id" "uuid", "_event_type" "text", "_visibility_scope" "text" DEFAULT 'self'::"text", "_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

-- [RPC/FUNCTION] move_entity_to_trash (schema.sql L9027-L9139)
CREATE OR REPLACE FUNCTION "public"."move_entity_to_trash"("_entity_type" "text", "_entity_ids" "uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  _auth_user_id uuid := auth.uid();
  _clean_entity_type text := lower(trim(COALESCE(_entity_type, '')));
  _clinic_id uuid;
  _affected integer := 0;
  _has_session_delete boolean;
  _has_patient_delete boolean;
  _has_forms_manage boolean;
BEGIN
  -- 1. Validação de autenticação
  IF _auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  -- 2. Identificação da clínica ativa
  _clinic_id := COALESCE(
    NULLIF(auth.jwt() ->> 'active_clinic_id', '')::uuid,
    public.get_user_clinic_id(_auth_user_id)
  );

  IF _clinic_id IS NULL THEN
    RAISE EXCEPTION 'Clinica ativa nao identificada para o usuario.';
  END IF;

  IF public.is_clinic_read_only(_clinic_id) THEN
    RAISE EXCEPTION 'Clinica em modo apenas leitura. Operacao nao permitida.';
  END IF;

  IF _entity_ids IS NULL OR cardinality(_entity_ids) = 0 THEN
    RETURN jsonb_build_object('success', true, 'count', 0, 'entity_type', _clean_entity_type);
  END IF;

  -- 3. Validação e Execução por tipo de entidade
  IF _clean_entity_type IN ('sessions', 'session') THEN
    _clean_entity_type := 'sessions';
    _has_session_delete := public.current_user_can('sessions.delete', _clinic_id) OR public.current_user_is_clinic_manager(_clinic_id);

    -- Se não possui permissão clínica de deleção, exige ser o criador ou prestador de todos os atendimentos
    IF NOT _has_session_delete THEN
      IF EXISTS (
        SELECT 1 FROM public.sessions
        WHERE id = ANY(_entity_ids)
          AND clinic_id = _clinic_id
          AND user_id <> _auth_user_id
          AND (provider_id IS NULL OR provider_id <> _auth_user_id)
      ) THEN
        RAISE EXCEPTION 'Permissao negada: voce so pode mover para a lixeira atendimentos criados ou prestados por voce.';
      END IF;
    END IF;

    UPDATE public.sessions
    SET deleted_at = now(),
        deleted_by_user_id = _auth_user_id
    WHERE id = ANY(_entity_ids)
      AND clinic_id = _clinic_id
      AND deleted_at IS NULL;
    GET DIAGNOSTICS _affected = ROW_COUNT;

  ELSIF _clean_entity_type IN ('patients', 'patient') THEN
    _clean_entity_type := 'patients';
    _has_patient_delete := public.current_user_can('patients.delete', _clinic_id) OR public.current_user_is_clinic_manager(_clinic_id);

    IF NOT _has_patient_delete THEN
      RAISE EXCEPTION 'Permissao negada: requer permissao patients.delete.';
    END IF;

    UPDATE public.patients
    SET deleted_at = now(),
        deleted_by_user_id = _auth_user_id
    WHERE id = ANY(_entity_ids)
      AND clinic_id = _clinic_id
      AND deleted_at IS NULL;
    GET DIAGNOSTICS _affected = ROW_COUNT;

    -- Cascata em sessões ativas filhas do paciente
    UPDATE public.sessions
    SET deleted_at = now(),
        deleted_by_user_id = _auth_user_id
    WHERE patient_id = ANY(_entity_ids)
      AND clinic_id = _clinic_id
      AND deleted_at IS NULL;

  ELSIF _clean_entity_type IN ('forms', 'form', 'anamnesis_forms', 'anamnesis_form_templates') THEN
    _clean_entity_type := 'forms';
    _has_forms_manage := public.current_user_can('forms.manage', _clinic_id) OR public.current_user_is_clinic_manager(_clinic_id);

    IF NOT _has_forms_manage THEN
      RAISE EXCEPTION 'Permissao negada: requer permissao forms.manage.';
    END IF;

    UPDATE public.anamnesis_form_templates
    SET deleted_at = now(),
        deleted_by_user_id = _auth_user_id
    WHERE id = ANY(_entity_ids)
      AND clinic_id = _clinic_id
      AND deleted_at IS NULL;
    GET DIAGNOSTICS _affected = ROW_COUNT;

  ELSE
    RAISE EXCEPTION 'Tipo de entidade desconhecido para lixeira: %', _entity_type;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'count', _affected,
    'entity_type', _clean_entity_type
  );
END;
$$;

-- [RPC/FUNCTION] raise_exception_json (schema.sql L9780-L9786)
CREATE OR REPLACE FUNCTION "public"."raise_exception_json"("_message" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    AS $$
begin
  raise exception '%', _message;
end;
$$;

-- [RPC/FUNCTION] request_account_recovery_status (schema.sql L10206-L10342)
CREATE OR REPLACE FUNCTION "public"."request_account_recovery_status"("_identifier" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
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

-- [RPC/FUNCTION] restore_entity_from_trash (schema.sql L10495-L10599)
CREATE OR REPLACE FUNCTION "public"."restore_entity_from_trash"("_entity_type" "text", "_entity_ids" "uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  _auth_user_id uuid := auth.uid();
  _clean_entity_type text := lower(trim(COALESCE(_entity_type, '')));
  _clinic_id uuid;
  _affected integer := 0;
  _can_restore boolean;
BEGIN
  -- 1. Validação de autenticação
  IF _auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  -- 2. Identificação da clínica ativa
  _clinic_id := COALESCE(
    NULLIF(auth.jwt() ->> 'active_clinic_id', '')::uuid,
    public.get_user_clinic_id(_auth_user_id)
  );

  IF _clinic_id IS NULL THEN
    RAISE EXCEPTION 'Clinica ativa nao identificada para o usuario.';
  END IF;

  IF public.is_clinic_read_only(_clinic_id) THEN
    RAISE EXCEPTION 'Clinica em modo apenas leitura. Operacao nao permitida.';
  END IF;

  -- 3. Validação de permissões: clinic_trash.manage ou role owner/admin
  _can_restore := (
    public.current_user_can('clinic_trash.manage', _clinic_id)
    OR public.current_user_is_clinic_manager(_clinic_id)
    OR EXISTS (
      SELECT 1 FROM public.clinic_memberships cm
      WHERE cm.user_id = _auth_user_id
        AND cm.clinic_id = _clinic_id
        AND cm.is_active = true
        AND cm.membership_status = 'active'
        AND (cm.account_role = 'account_owner' OR cm.operational_role IN ('owner', 'admin'))
    )
  );

  IF NOT _can_restore THEN
    RAISE EXCEPTION 'Permissao negada para restaurar itens da lixeira. Requer perfil owner ou admin.';
  END IF;

  IF _entity_ids IS NULL OR cardinality(_entity_ids) = 0 THEN
    RETURN jsonb_build_object('success', true, 'count', 0, 'entity_type', _clean_entity_type);
  END IF;

  -- 4. Restauração por entidade
  IF _clean_entity_type IN ('sessions', 'session') THEN
    _clean_entity_type := 'sessions';

    UPDATE public.sessions
    SET deleted_at = NULL,
        deleted_by_user_id = NULL
    WHERE id = ANY(_entity_ids)
      AND clinic_id = _clinic_id
      AND deleted_at IS NOT NULL;
    GET DIAGNOSTICS _affected = ROW_COUNT;

  ELSIF _clean_entity_type IN ('patients', 'patient') THEN
    _clean_entity_type := 'patients';

    UPDATE public.patients
    SET deleted_at = NULL,
        deleted_by_user_id = NULL
    WHERE id = ANY(_entity_ids)
      AND clinic_id = _clinic_id
      AND deleted_at IS NOT NULL;
    GET DIAGNOSTICS _affected = ROW_COUNT;

    -- Restaura também sessões filhas vinculadas aos pacientes restaurados
    UPDATE public.sessions
    SET deleted_at = NULL,
        deleted_by_user_id = NULL
    WHERE patient_id = ANY(_entity_ids)
      AND clinic_id = _clinic_id
      AND deleted_at IS NOT NULL;

  ELSIF _clean_entity_type IN ('forms', 'form', 'anamnesis_forms', 'anamnesis_form_templates') THEN
    _clean_entity_type := 'forms';

    UPDATE public.anamnesis_form_templates
    SET deleted_at = NULL,
        deleted_by_user_id = NULL
    WHERE id = ANY(_entity_ids)
      AND clinic_id = _clinic_id
      AND deleted_at IS NOT NULL;
    GET DIAGNOSTICS _affected = ROW_COUNT;

  ELSE
    RAISE EXCEPTION 'Tipo de entidade desconhecido para lixeira: %', _entity_type;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'count', _affected,
    'entity_type', _clean_entity_type
  );
END;
$$;

-- [RPC/FUNCTION] set_updated_at (schema.sql L10847-L10854)
CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- [RPC/FUNCTION] slugify_text (schema.sql L10979-L11003)
CREATE OR REPLACE FUNCTION "public"."slugify_text"("_val" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $_$
declare
  clean_text text;
begin
  if _val is null or trim(_val) = '' then
    return null;
  end if;

  clean_text := lower(trim(_val));
  clean_text := translate(clean_text, 
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
  );
  clean_text := regexp_replace(clean_text, '[^a-z0-9]+', '-', 'g');
  clean_text := regexp_replace(clean_text, '^-+|-+$', '', 'g');

  if clean_text = '' then
    return null;
  end if;

  return clean_text;
end;
$_$;

-- [RPC/FUNCTION] trg_increment_row_version (schema.sql L11692-L11699)
CREATE OR REPLACE FUNCTION "public"."trg_increment_row_version"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.version := COALESCE(OLD.version, 1) + 1;
  RETURN NEW;
END;
$$;

-- [RPC/FUNCTION] update_updated_at_column (schema.sql L12700-L12708)
CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- [RPC/FUNCTION] verify_password_recovery_identity (schema.sql L13501-L13526)
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

-- [TABLE] agenda_events (schema.sql L13532-L13560)
CREATE TABLE IF NOT EXISTS "public"."agenda_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "patient_id" "uuid",
    "event_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "scheduled_for" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'aguardando_confirmacao'::"text" NOT NULL,
    "generated_by_recurring_patient" boolean DEFAULT false NOT NULL,
    "payment_plan_id" "uuid",
    "payment_plan_session_index" integer,
    "version" integer DEFAULT 1 NOT NULL,
    "duration_minutes" integer DEFAULT 60 NOT NULL,
    "reminder_configs" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "notify_team" boolean DEFAULT false NOT NULL,
    "notify_patient" boolean DEFAULT false NOT NULL,
    "notified_colleague_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "origin_timezone" "text",
    "origin_lat" double precision,
    "origin_lng" double precision,
    "origin_city" "text",
    CONSTRAINT "agenda_events_duration_minutes_check" CHECK ((("duration_minutes" > 0) AND ("duration_minutes" <= 1440))),
    CONSTRAINT "agenda_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['atendimento'::"text", 'reuniao'::"text", 'evento'::"text"]))),
    CONSTRAINT "agenda_events_payment_plan_session_index_check" CHECK ((("payment_plan_session_index" IS NULL) OR ("payment_plan_session_index" >= 1))),
    CONSTRAINT "agenda_events_status_check" CHECK (("status" = ANY (ARRAY['lembrete'::"text", 'aguardando_confirmacao'::"text", 'confirmado'::"text", 'cancelado'::"text", 'concluido'::"text"])))
);

-- [TABLE] security_events (schema.sql L14556-L14566)
CREATE TABLE IF NOT EXISTS "public"."security_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid",
    "actor_user_id" "uuid",
    "target_user_id" "uuid",
    "event_type" "text" NOT NULL,
    "visibility_scope" "text" DEFAULT 'self'::"text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "security_events_visibility_scope_check" CHECK (("visibility_scope" = ANY (ARRAY['self'::"text", 'admin'::"text"])))
);

-- [POLICY] Super admins manage all agenda events ON agenda_events (schema.sql L17077-L17077)
CREATE POLICY "Super admins manage all agenda events" ON "public"."agenda_events" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));

-- [POLICY] Users delete clinic agenda events ON agenda_events (schema.sql L17145-L17145)
CREATE POLICY "Users delete clinic agenda events" ON "public"."agenda_events" FOR DELETE TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('agenda.delete_events'::"text", "clinic_id")));

-- [POLICY] Users read clinic agenda events ON agenda_events (schema.sql L17211-L17211)
CREATE POLICY "Users read clinic agenda events" ON "public"."agenda_events" FOR SELECT TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND "public"."can_read_clinic_data"("clinic_id") AND "public"."current_user_can"('agenda.read'::"text", "clinic_id")));

-- [POLICY] Users update clinic agenda events ON agenda_events (schema.sql L17310-L17310)
CREATE POLICY "Users update clinic agenda events" ON "public"."agenda_events" FOR UPDATE TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('agenda.write'::"text", "clinic_id"))) WITH CHECK ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('agenda.write'::"text", "clinic_id")));

-- [POLICY] Users write clinic agenda events ON agenda_events (schema.sql L17346-L17346)
CREATE POLICY "Users write clinic agenda events" ON "public"."agenda_events" FOR INSERT TO "authenticated" WITH CHECK ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('agenda.write'::"text", "clinic_id")));

-- [POLICY] admins can read clinic security events ON security_events (schema.sql L17386-L17386)
CREATE POLICY "admins can read clinic security events" ON "public"."security_events" FOR SELECT USING ((("visibility_scope" = 'admin'::"text") AND ("clinic_id" = "public"."get_user_clinic_id"("auth"."uid"())) AND "public"."current_user_can"('subaccounts.manage'::"text", "clinic_id")));

-- [POLICY] users can read own security events ON security_events (schema.sql L17632-L17632)
CREATE POLICY "users can read own security events" ON "public"."security_events" FOR SELECT USING ((("actor_user_id" = "auth"."uid"()) OR ("target_user_id" = "auth"."uid"())));

-- [RPC/FUNCTION] rpc_get_available_slots (schema.sql L19245-L19252)
CREATE OR REPLACE FUNCTION public.rpc_get_available_slots(
  _clinic_id uuid,
  _provider_id uuid,
  _date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
