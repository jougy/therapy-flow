-- ==========================================================================
-- DOMÍNIO: STORAGE_FILES (Gerado automaticamente por npm run schema:index)
-- Fonte SSOT: supabase/schema.sql
-- ==========================================================================

-- [RPC/FUNCTION] assign_profile_public_code (schema.sql L990-L1001)
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

-- [RPC/FUNCTION] complete_unregistered_cpf_profile (schema.sql L2291-L2347)
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

-- [RPC/FUNCTION] ensure_team_development_profile (schema.sql L4193-L4247)
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

-- [RPC/FUNCTION] ensure_team_development_profile_from_membership (schema.sql L4253-L4261)
CREATE OR REPLACE FUNCTION "public"."ensure_team_development_profile_from_membership"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.ensure_team_development_profile(NEW.clinic_id, NEW.user_id);
  RETURN NEW;
END;
$$;

-- [RPC/FUNCTION] generate_profile_public_code (schema.sql L4458-L4478)
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

-- [RPC/FUNCTION] generate_profile_public_code_for_clinic (schema.sql L4484-L4491)
CREATE OR REPLACE FUNCTION "public"."generate_profile_public_code_for_clinic"("_clinic_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN public.generate_profile_public_code();
END;
$$;

-- [RPC/FUNCTION] get_clinic_storage_usage (schema.sql L5450-L5460)
CREATE OR REPLACE FUNCTION "public"."get_clinic_storage_usage"("_clinic_id" "uuid") RETURNS TABLE("total_bytes" bigint, "total_files" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT 
    COALESCE(SUM(COALESCE(stored_byte_size, byte_size)), 0)::bigint AS total_bytes,
    COUNT(*)::bigint AS total_files
  FROM public.patient_file_uploads
  WHERE clinic_id = _clinic_id
    AND status = 'uploaded';
$$;

-- [RPC/FUNCTION] update_clinic_subaccount_profile (schema.sql L13894-L14061)
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

-- [RPC/FUNCTION] update_current_profile (schema.sql L14067-L14188)
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

-- [RPC/FUNCTION] update_team_development_profile (schema.sql L14282-L14348)
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

-- [TABLE] profiles (schema.sql L16595-L16629)
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
    "gender" "text",
    "preferred_pronoun" "text",
    "signup_origin" "text",
    "signup_utm" "jsonb",
    "totp_secret" "text",
    "totp_enabled" boolean DEFAULT false NOT NULL,
    "totp_enabled_at" timestamp with time zone,
    "signature_webp_url" "text"
);

-- [TABLE] team_development_profiles (schema.sql L16882-L16898)
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

-- [POLICY] Managers update clinic profiles ON profiles (schema.sql L19696-L19696)
CREATE POLICY "Managers update clinic profiles" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ("public"."current_user_can"('subaccounts.manage'::"text", "clinic_id")) WITH CHECK ("public"."current_user_can"('subaccounts.manage'::"text", "clinic_id"));

-- [POLICY] Super admins manage all profiles ON profiles (schema.sql L19952-L19952)
CREATE POLICY "Super admins manage all profiles" ON "public"."profiles" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));

-- [POLICY] Users can insert own profile ON profiles (schema.sql L19976-L19976)
CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));

-- [POLICY] Users read clinic profiles ON profiles (schema.sql L20132-L20135)
CREATE POLICY "Users read clinic profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role") AS "has_role") OR (("clinic_id" IS NOT NULL) AND ("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id"))) OR (EXISTS ( SELECT 1
   FROM ("public"."clinic_memberships" "requester_membership"
     JOIN "public"."clinic_memberships" "target_membership" ON (("target_membership"."clinic_id" = "requester_membership"."clinic_id")))
  WHERE (("requester_membership"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("requester_membership"."is_active" = true) AND ("target_membership"."user_id" = "profiles"."id"))))));

-- [POLICY] Users update own profile ON profiles (schema.sql L20235-L20235)
CREATE POLICY "Users update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));

-- [POLICY] team development readable by clinic admins or self ON team_development_profiles (schema.sql L20537-L20537)
CREATE POLICY "team development readable by clinic admins or self" ON "public"."team_development_profiles" FOR SELECT USING ((("clinic_id" = "public"."get_user_clinic_id"("auth"."uid"())) AND ("public"."current_user_can"('subaccounts_analytics.read'::"text", "clinic_id") OR ("user_id" = "auth"."uid"()))));
