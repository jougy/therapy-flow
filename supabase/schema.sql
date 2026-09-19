


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."account_role_type" AS ENUM (
    'account_owner'
);


ALTER TYPE "public"."account_role_type" OWNER TO "postgres";


CREATE TYPE "public"."app_role" AS ENUM (
    'super_admin',
    'clinic_admin',
    'user'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."feature_flag_scope" AS ENUM (
    'global',
    'clinic',
    'tag'
);


ALTER TYPE "public"."feature_flag_scope" OWNER TO "postgres";


CREATE TYPE "public"."membership_status_type" AS ENUM (
    'invited',
    'active',
    'inactive',
    'suspended'
);


ALTER TYPE "public"."membership_status_type" OWNER TO "postgres";


CREATE TYPE "public"."operational_role_type" AS ENUM (
    'owner',
    'admin',
    'professional',
    'assistant',
    'estagiario'
);


ALTER TYPE "public"."operational_role_type" OWNER TO "postgres";


CREATE TYPE "public"."patient_file_upload_category" AS ENUM (
    'anamnesis',
    'exam',
    'image',
    'document',
    'other'
);


ALTER TYPE "public"."patient_file_upload_category" OWNER TO "postgres";


CREATE TYPE "public"."patient_file_upload_status" AS ENUM (
    'pending',
    'uploaded',
    'failed',
    'deleted'
);


ALTER TYPE "public"."patient_file_upload_status" OWNER TO "postgres";


CREATE TYPE "public"."platform_admin_role" AS ENUM (
    'platform_owner'
);


ALTER TYPE "public"."platform_admin_role" OWNER TO "postgres";


CREATE TYPE "public"."platform_release_note_category" AS ENUM (
    'fixed',
    'added',
    'changed',
    'removed'
);


ALTER TYPE "public"."platform_release_note_category" OWNER TO "postgres";


CREATE TYPE "public"."subscription_plan" AS ENUM (
    'solo',
    'clinic',
    'enterprise'
);


ALTER TYPE "public"."subscription_plan" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_clinic_collaborator_invitation"("_token" "text", "_full_name" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _user_email text;
  _invitation public.clinic_collaborator_invitations%ROWTYPE;
  _profile_exists boolean;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta para aceitar o convite.';
  END IF;

  SELECT lower(email)
  INTO _user_email
  FROM auth.users
  WHERE id = _user_id;

  SELECT *
  INTO _invitation
  FROM public.clinic_collaborator_invitations
  WHERE token_hash = md5(coalesce(_token, ''))
  LIMIT 1;

  IF _invitation.id IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  IF _invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'Este convite não está mais pendente.';
  END IF;

  IF _invitation.expires_at < now() THEN
    UPDATE public.clinic_collaborator_invitations
    SET status = 'expired'
    WHERE id = _invitation.id;
    RAISE EXCEPTION 'Este convite expirou.';
  END IF;

  IF _user_email IS DISTINCT FROM lower(_invitation.email) THEN
    RAISE EXCEPTION 'Entre com o e-mail convidado para aceitar este acesso.';
  END IF;

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
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_security_settings (user_id, clinic_id)
  VALUES (_user_id, _invitation.clinic_id)
  ON CONFLICT (user_id) DO UPDATE
  SET clinic_id = COALESCE(public.user_security_settings.clinic_id, EXCLUDED.clinic_id);

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
    _invitation.clinic_id,
    _user_id,
    NULL,
    _invitation.operational_role,
    'active',
    true,
    _invitation.invited_by
  )
  ON CONFLICT (clinic_id, user_id)
  DO UPDATE SET
    operational_role = EXCLUDED.operational_role,
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
    accepted_at = now()
  WHERE id = _invitation.id;

  RETURN jsonb_build_object(
    'clinic_id', _invitation.clinic_id,
    'status', 'accepted'
  );
END;
$$;


ALTER FUNCTION "public"."accept_clinic_collaborator_invitation"("_token" "text", "_full_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_current_user_clinic_invitation"("_invitation_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _user_email text;
  _invitation public.clinic_collaborator_invitations%ROWTYPE;
  _profile_exists boolean;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta para aceitar o convite.';
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

  IF _invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'Este convite não está mais pendente.';
  END IF;

  IF _invitation.expires_at < now() THEN
    UPDATE public.clinic_collaborator_invitations
    SET status = 'expired'
    WHERE id = _invitation.id;
    RAISE EXCEPTION 'Este convite expirou.';
  END IF;

  IF lower(_invitation.email) IS DISTINCT FROM _user_email THEN
    RAISE EXCEPTION 'Este convite pertence a outro e-mail.';
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
    membership_status,
    is_active,
    invited_by
  )
  VALUES (
    _invitation.clinic_id,
    _user_id,
    NULL,
    _invitation.operational_role,
    'active',
    true,
    _invitation.invited_by
  )
  ON CONFLICT (clinic_id, user_id)
  DO UPDATE SET
    operational_role = EXCLUDED.operational_role,
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
    accepted_at = now()
  WHERE id = _invitation.id;

  RETURN jsonb_build_object(
    'clinic_id', _invitation.clinic_id,
    'status', 'accepted'
  );
END;
$$;


ALTER FUNCTION "public"."accept_current_user_clinic_invitation"("_invitation_id" "uuid") OWNER TO "postgres";


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


ALTER FUNCTION "public"."acknowledge_current_user_release_notes"("_release_id" "uuid") OWNER TO "postgres";


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


ALTER FUNCTION "public"."activate_clinic_free_trial"("_clinic_id" "uuid", "_plan_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."activate_clinic_free_trial"("_clinic_id" "uuid", "_plan_type" "public"."subscription_plan") RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.activate_clinic_free_trial(_clinic_id, _plan_type::text);
$$;


ALTER FUNCTION "public"."activate_clinic_free_trial"("_clinic_id" "uuid", "_plan_type" "public"."subscription_plan") OWNER TO "postgres";


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


ALTER FUNCTION "public"."apply_user_punishment"("_user_id" "uuid", "_punishment_type" "text", "_duration_minutes" integer, "_reason" "text", "_is_manual" boolean) OWNER TO "postgres";


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


ALTER FUNCTION "public"."assign_profile_public_code"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."buy_clinic_subaccount_extra_spaces"("_clinic_id" "uuid", "_quantity" integer, "_billing_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_community_template_fields_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.schema IS NOT NULL AND jsonb_typeof(NEW.schema) = 'array' THEN
    NEW.fields_count := jsonb_array_length(NEW.schema);
  ELSE
    NEW.fields_count := 0;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_community_template_fields_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_insert_session"("_clinic_id" "uuid", "_user_id" "uuid", "_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    _clinic_id = public.get_user_clinic_id((SELECT auth.uid()))
    AND _user_id = (SELECT auth.uid())
    AND _provider_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.clinic_memberships
      WHERE clinic_memberships.clinic_id = _clinic_id
        AND clinic_memberships.user_id = (SELECT auth.uid())
        AND clinic_memberships.operational_role IN ('owner', 'admin', 'professional', 'estagiario')
        AND clinic_memberships.is_active = true
        AND clinic_memberships.membership_status = 'active'
    );
$$;


ALTER FUNCTION "public"."can_insert_session"("_clinic_id" "uuid", "_user_id" "uuid", "_provider_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_perform_action"("_capability" "text", "_clinic_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _resolved_clinic_id uuid;
  _account_role public.account_role_type;
  _operational_role public.operational_role_type;
  _membership_status public.membership_status_type;
  _is_active boolean;
  _subscription_plan public.subscription_plan;
  _sub record;
  _is_subscription_expired boolean := false;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  _resolved_clinic_id := COALESCE(_clinic_id, public.get_user_clinic_id(_user_id));

  SELECT
    clinic_memberships.account_role,
    clinic_memberships.operational_role,
    clinic_memberships.membership_status,
    clinic_memberships.is_active,
    clinics.subscription_plan
  INTO
    _account_role,
    _operational_role,
    _membership_status,
    _is_active,
    _subscription_plan
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

  -- Checar se a assinatura esta expirada
  SELECT * INTO _sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = _resolved_clinic_id
  LIMIT 1;

  IF _sub IS NOT NULL AND _sub.status NOT IN ('BETA', 'TRIAL') THEN
    IF _sub.expires_at IS NOT NULL AND _sub.expires_at < now() THEN
      _is_subscription_expired := true;
    ELSIF _sub.status = 'EXPIRED' OR _sub.status = 'SUSPENDED' THEN
      _is_subscription_expired := true;
    END IF;
  END IF;

  -- Se a assinatura estiver expirada, permite APENAS leitura ou gerenciamento da assinatura para renovacao
  IF _is_subscription_expired THEN
    IF _capability = 'subscription_billing.manage' AND _account_role = 'account_owner' THEN
      RETURN true;
    END IF;
    -- Permite apenas acoes de leitura (.read)
    IF _capability IN ('patients.read', 'schedule.read', 'sessions.read', 'subaccounts_analytics.read') THEN
      RETURN true;
    END IF;
    -- Qualquer acao de escrita e bloqueada
    RETURN false;
  END IF;

  IF _account_role = 'account_owner' THEN
    RETURN true;
  END IF;

  CASE _capability
    WHEN 'clinic_profile.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'forms.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.manage' THEN
      RETURN _subscription_plan = 'clinic' AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_roles.manage' THEN
      RETURN _subscription_plan = 'clinic' AND _operational_role IN ('owner', 'admin');
    WHEN 'subscription_billing.manage' THEN
      RETURN false;
    WHEN 'treasury.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'agenda.delete_events' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_analytics.read' THEN
      RETURN _subscription_plan = 'clinic' AND _operational_role IN ('owner', 'admin');
    WHEN 'patients.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    WHEN 'patients.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    WHEN 'schedule.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    WHEN 'schedule.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    WHEN 'sessions.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    WHEN 'sessions.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    WHEN 'session.delete_draft' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    ELSE
      RETURN false;
  END CASE;
END;
$$;


ALTER FUNCTION "public"."can_perform_action"("_capability" "text", "_clinic_id" "uuid") OWNER TO "postgres";


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


ALTER FUNCTION "public"."can_read_clinic_data"("_clinic_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_read_session"("_session_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _session public.sessions%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT *
  INTO _session
  FROM public.sessions
  WHERE id = _session_id;

  IF _session.id IS NULL OR _session.clinic_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.current_user_can('sessions.read', _session.clinic_id) THEN
    RETURN false;
  END IF;

  IF public.current_user_is_clinic_manager(_session.clinic_id) THEN
    RETURN true;
  END IF;

  IF _session.user_id = _user_id OR _session.provider_id = _user_id THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.session_shares
    WHERE session_shares.session_id = _session.id
      AND session_shares.clinic_id = _session.clinic_id
      AND session_shares.shared_with_user_id = _user_id
      AND session_shares.revoked_at IS NULL
  );
END;
$$;


ALTER FUNCTION "public"."can_read_session"("_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_share_session"("_session_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _session public.sessions%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT *
  INTO _session
  FROM public.sessions
  WHERE id = _session_id;

  IF _session.id IS NULL OR _session.clinic_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.current_user_can('sessions.read', _session.clinic_id) THEN
    RETURN false;
  END IF;

  RETURN public.current_user_is_clinic_manager(_session.clinic_id)
    OR _session.user_id = _user_id
    OR _session.provider_id = _user_id;
END;
$$;


ALTER FUNCTION "public"."can_share_session"("_session_id" "uuid") OWNER TO "postgres";


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


ALTER FUNCTION "public"."cancel_clinic_collaborator_invitation"("_invitation_id" "uuid") OWNER TO "postgres";


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
BEGIN
  -- Buscar assinatura da clinica
  SELECT * INTO v_sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = p_clinic_id
  LIMIT 1;

  -- Se nao encontrou ou se for trial
  IF v_sub IS NULL OR v_sub.status = 'TRIAL' OR v_sub.is_free_trial = true OR v_sub.status = 'BETA' THEN
    v_is_trial := true;
  END IF;

  -- Checagem de Atendimentos
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
      v_limit := -1; -- Ilimitado
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
      v_limit := -1; -- Ilimitado
      v_allowed := true;
    END IF;

  -- Checagem de Modelos de Formulario Personalizados
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
    ELSE
      v_limit := -1; -- Ilimitado
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


ALTER FUNCTION "public"."check_clinic_plan_quota"("p_clinic_id" "uuid", "p_feature_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_telemetry_events"("_page_view_retention_days" integer DEFAULT 15, "_security_event_retention_days" integer DEFAULT 90) RETURNS TABLE("deleted_page_views" bigint, "deleted_security_events" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  v_deleted_page_views BIGINT := 0;
  v_deleted_security_events BIGINT := 0;
BEGIN
  -- Verify caller is platform owner
  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Acesso negado. Apenas o Backoffice Master pode executar a limpeza de telemetria.';
  END IF;

  -- Delete routine page_views older than retention limit
  WITH deleted_pv AS (
    DELETE FROM public.telemetry_events
    WHERE event_type = 'page_view'
      AND created_at < now() - (_page_view_retention_days || ' days')::INTERVAL
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_page_views FROM deleted_pv;

  -- Delete security events older than security retention limit
  WITH deleted_sec AS (
    DELETE FROM public.telemetry_events
    WHERE event_type IN ('print_screen', 'document_print', 'export_pdf')
      AND created_at < now() - (_security_event_retention_days || ' days')::INTERVAL
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_security_events FROM deleted_sec;

  RETURN QUERY SELECT v_deleted_page_views, v_deleted_security_events;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_telemetry_events"("_page_view_retention_days" integer, "_security_event_retention_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_user_security_sessions"("_user_id" "uuid" DEFAULT "auth"."uid"(), "_inactive_window" interval DEFAULT '00:15:00'::interval, "_retention_window" interval DEFAULT '30 days'::interval) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _stale_count integer := 0;
  _deleted_count integer := 0;
  _stale_session record;
  _clinic_id uuid;
  _has_other_active boolean;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  -- Identificar sessões que estão expirando agora por inatividade
  FOR _stale_session IN
    SELECT id, clinic_id, session_key
    FROM public.user_security_sessions
    WHERE user_id = _user_id
      AND ended_at IS NULL
      AND last_seen_at < now() - _inactive_window
  LOOP
    UPDATE public.user_security_sessions
    SET
      ended_at = COALESCE(last_seen_at, now()),
      updated_at = now()
    WHERE id = _stale_session.id;

    _stale_count := _stale_count + 1;

    -- Verificar se o usuário ficou totalmente offline na clínica
    _clinic_id := _stale_session.clinic_id;
    IF _clinic_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.user_security_sessions
        WHERE user_id = _user_id
          AND clinic_id = _clinic_id
          AND ended_at IS NULL
          AND force_signed_out_at IS NULL
          AND last_seen_at >= now() - INTERVAL '5 minutes'
      ) INTO _has_other_active;

      IF NOT _has_other_active THEN
        PERFORM public.notify_clinic_collaborator_presence(_clinic_id, _user_id, 'offline');
      END IF;
    END IF;
  END LOOP;

  DELETE FROM public.user_security_sessions
  WHERE user_id = _user_id
    AND ended_at IS NOT NULL
    AND ended_at < now() - _retention_window;

  GET DIAGNOSTICS _deleted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'deleted_count', _deleted_count,
    'stale_count', _stale_count,
    'user_id', _user_id
  );
END;
$$;


ALTER FUNCTION "public"."cleanup_user_security_sessions"("_user_id" "uuid", "_inactive_window" interval, "_retention_window" interval) OWNER TO "postgres";


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


ALTER FUNCTION "public"."clear_current_user_notifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_asaas_subscription_payment"("_asaas_payment_id" "text", "_clinic_id" "uuid", "_paid_value" numeric, "_payment_date" timestamp with time zone DEFAULT "now"(), "_billing_type" "text" DEFAULT 'PIX'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_sub public.clinic_subscriptions%ROWTYPE;
  v_duration_days integer := 30;
  v_new_expires_at timestamptz;
  v_new_due_date date;
BEGIN
  -- 1. Buscar assinatura da clínica
  SELECT * INTO v_sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = _clinic_id;

  IF v_sub.id IS NOT NULL THEN
    v_duration_days := CASE
      WHEN UPPER(v_sub.billing_cycle) = 'ANNUAL' THEN 365
      WHEN UPPER(v_sub.billing_cycle) = 'QUARTERLY' THEN 90
      ELSE 30
    END;

    v_new_expires_at := _payment_date + (v_duration_days || ' days')::interval;
    v_new_due_date := (_payment_date + (v_duration_days || ' days')::interval)::date;

    -- Atualizar assinatura para ACTIVE
    UPDATE public.clinic_subscriptions
    SET
      status = 'ACTIVE',
      is_free_trial = false,
      current_period_start = _payment_date,
      current_period_end = v_new_expires_at,
      expires_at = v_new_expires_at,
      next_due_date = v_new_due_date,
      period_duration_days = v_duration_days,
      payment_method = coalesce(_billing_type, payment_method),
      updated_at = now()
    WHERE id = v_sub.id;
  END IF;

  -- 2. Atualizar clínica para access_status active
  UPDATE public.clinics
  SET
    access_status = 'active',
    updated_at = now()
  WHERE id = _clinic_id;

  -- 3. Atualizar fatura em subscription_invoices
  UPDATE public.subscription_invoices
  SET
    status = 'RECEIVED',
    paid_at = _payment_date,
    payment_date = _payment_date,
    value = coalesce(_paid_value, value)
  WHERE asaas_payment_id = _asaas_payment_id;

  RETURN jsonb_build_object(
    'success', true,
    'clinic_id', _clinic_id,
    'status', 'ACTIVE',
    'expires_at', v_new_expires_at
  );
END;
$$;


ALTER FUNCTION "public"."confirm_asaas_subscription_payment"("_asaas_payment_id" "text", "_clinic_id" "uuid", "_paid_value" numeric, "_payment_date" timestamp with time zone, "_billing_type" "text") OWNER TO "postgres";


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


ALTER FUNCTION "public"."create_clinic_subaccount"("_email" "text", "_password" "text", "_full_name" "text", "_operational_role" "public"."operational_role_type", "_job_title" "text", "_specialty" "text", "_clinic_id" "uuid") OWNER TO "postgres";


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


ALTER FUNCTION "public"."create_current_user_notification"("_clinic_id" "uuid", "_category" "text", "_event_type" "text", "_title" "text", "_body" "text", "_action_label" "text", "_action_url" "text", "_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_due_agenda_reminder_notifications"("_lookahead" interval DEFAULT '00:30:00'::interval) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."create_due_agenda_reminder_notifications"("_lookahead" interval) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_patient_registration_link"("_patient_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  _patient public.patients%ROWTYPE;
  _link public.patient_registration_links%ROWTYPE;
  _password_prefix text;
  _token text;
  _caller_clinic_id uuid;
  _is_super_admin boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO _patient
  FROM public.patients
  WHERE id = _patient_id;

  IF _patient.id IS NULL THEN
    RAISE EXCEPTION 'Paciente não encontrado';
  END IF;

  SELECT public.get_user_clinic_id(auth.uid()) INTO _caller_clinic_id;
  SELECT public.has_role(auth.uid(), 'super_admin') INTO _is_super_admin;

  IF NOT _is_super_admin AND _patient.clinic_id IS DISTINCT FROM _caller_clinic_id THEN
    RAISE EXCEPTION 'Sem permissão para compartilhar este cadastro';
  END IF;

  -- 1. Pega os 6 primeiros dígitos do CPF próprio ou do responsável
  _password_prefix := left(regexp_replace(coalesce(_patient.cpf, _patient.responsible_cpf, ''), '\D', '', 'g'), 6);

  -- 2. Se ainda não tiver 6 dígitos, usa a data de nascimento (DDMMAA)
  IF length(_password_prefix) < 6 AND _patient.date_of_birth IS NOT NULL THEN
    _password_prefix := to_char(_patient.date_of_birth, 'DDMMYY');
  END IF;

  -- 3. Fallback para PIN seguro de 6 dígitos caso não haja CPF nem nascimento
  IF length(_password_prefix) < 6 THEN
    _password_prefix := lpad((floor(random() * 900000) + 100000)::text, 6, '0');
  END IF;

  _token := replace(gen_random_uuid()::text, '-', '');

  SELECT * INTO _link
  FROM public.patient_registration_links
  WHERE patient_id = _patient_id;

  IF _link.id IS NULL THEN
    INSERT INTO public.patient_registration_links (
      patient_id,
      clinic_id,
      token,
      password_prefix,
      created_by
    )
    VALUES (
      _patient.id,
      _patient.clinic_id,
      _token,
      _password_prefix,
      auth.uid()
    )
    RETURNING * INTO _link;
  ELSE
    UPDATE public.patient_registration_links
    SET
      clinic_id = _patient.clinic_id,
      token = _token,
      password_prefix = _password_prefix,
      completed_at = null,
      updated_at = now()
    WHERE id = _link.id
    RETURNING * INTO _link;
  END IF;

  RETURN jsonb_build_object(
    'token', _link.token,
    'password_prefix', _password_prefix,
    'completed', false
  );
END;
$$;


ALTER FUNCTION "public"."create_patient_registration_link"("_patient_id" "uuid") OWNER TO "postgres";


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


ALTER FUNCTION "public"."create_user_notification"("_user_id" "uuid", "_clinic_id" "uuid", "_actor_user_id" "uuid", "_category" "text", "_event_type" "text", "_title" "text", "_body" "text", "_action_label" "text", "_action_url" "text", "_payload" "jsonb", "_source_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_can"("_capability" "text", "_clinic_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _resolved_clinic_id uuid;
  _account_role public.account_role_type;
  _operational_role public.operational_role_type;
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
    clinic_memberships.membership_status,
    clinic_memberships.is_active,
    clinics.subscription_plan,
    clinics.account_owner_user_id
  INTO
    _account_role,
    _operational_role,
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
      RETURN (_subscription_plan IN ('clinic', 'enterprise')) AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.write' THEN
      RETURN (_subscription_plan IN ('clinic', 'enterprise')) AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.manage' THEN
      RETURN (_subscription_plan IN ('clinic', 'enterprise')) AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.delete' THEN
      RETURN (_subscription_plan IN ('clinic', 'enterprise')) AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_roles.read' THEN
      RETURN (_subscription_plan IN ('clinic', 'enterprise')) AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_roles.manage' THEN
      RETURN (_subscription_plan IN ('clinic', 'enterprise')) AND _operational_role IN ('owner', 'admin');
    WHEN 'subscription_billing.read' THEN
      RETURN _is_owner;
    WHEN 'team_development.manage' THEN
      RETURN (_subscription_plan IN ('clinic', 'enterprise')) AND _operational_role IN ('owner', 'admin');
    WHEN 'treasury.read' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'treasury.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'agenda.delete_events' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_analytics.read' THEN
      RETURN (_subscription_plan IN ('clinic', 'enterprise')) AND _operational_role IN ('owner', 'admin');
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
      RETURN _operational_role IN ('owner', 'admin', 'professional');
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


ALTER FUNCTION "public"."current_user_can"("_capability" "text", "_clinic_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_is_clinic_manager"("_clinic_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.current_user_can('subaccounts_roles.manage', _clinic_id);
$$;


ALTER FUNCTION "public"."current_user_is_clinic_manager"("_clinic_id" "uuid") OWNER TO "postgres";


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


ALTER FUNCTION "public"."decline_current_user_clinic_invitation"("_invitation_id" "uuid") OWNER TO "postgres";


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


ALTER FUNCTION "public"."delete_current_user_notification"("_notification_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."end_clinic_user_security_sessions"("_target_user_id" "uuid", "_clinic_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _requester_id uuid := auth.uid();
  _resolved_clinic_id uuid := COALESCE(_clinic_id, public.get_user_clinic_id(_requester_id));
  _affected_count integer := 0;
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  IF _target_user_id IS NULL THEN
    RAISE EXCEPTION 'Colaborador alvo nao informado.';
  END IF;

  IF NOT public.current_user_can('subaccounts.manage', _resolved_clinic_id) THEN
    RAISE EXCEPTION 'Sem permissao para gerenciar acessos desta clinica.';
  END IF;

  UPDATE public.user_security_sessions
  SET
    ended_at = now(),
    force_signed_out_at = now(),
    forced_out_by = _requester_id,
    updated_at = now()
  WHERE clinic_id = _resolved_clinic_id
    AND user_id = _target_user_id
    AND ended_at IS NULL;

  GET DIAGNOSTICS _affected_count = ROW_COUNT;

  PERFORM public.log_security_event(
    _resolved_clinic_id,
    _requester_id,
    _target_user_id,
    'subaccount_signed_out',
    'admin',
    jsonb_build_object('ended_count', _affected_count)
  );

  RETURN jsonb_build_object(
    'ended_count', _affected_count,
    'target_user_id', _target_user_id
  );
END;
$$;


ALTER FUNCTION "public"."end_clinic_user_security_sessions"("_target_user_id" "uuid", "_clinic_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."end_current_security_session"("_session_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _affected_count integer := 0;
  _session_row public.user_security_sessions%ROWTYPE;
  _clinic_id uuid;
  _is_completely_offline boolean := false;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  IF NULLIF(trim(COALESCE(_session_key, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Sessao invalida.';
  END IF;

  SELECT *
  INTO _session_row
  FROM public.user_security_sessions
  WHERE user_id = _user_id
    AND session_key = _session_key
  LIMIT 1;

  UPDATE public.user_security_sessions
  SET
    ended_at = now(),
    updated_at = now()
  WHERE user_id = _user_id
    AND session_key = _session_key
    AND ended_at IS NULL;

  GET DIAGNOSTICS _affected_count = ROW_COUNT;

  -- Presença: Se o usuário não tem mais nenhuma sessão ativa nessa clínica, notificar offline
  _clinic_id := COALESCE(_session_row.clinic_id, public.get_user_clinic_id(_user_id));
  IF _clinic_id IS NOT NULL THEN
    SELECT NOT EXISTS (
      SELECT 1
      FROM public.user_security_sessions
      WHERE user_id = _user_id
        AND clinic_id = _clinic_id
        AND session_key <> _session_key
        AND ended_at IS NULL
        AND force_signed_out_at IS NULL
        AND last_seen_at >= now() - INTERVAL '5 minutes'
    ) INTO _is_completely_offline;

    IF _is_completely_offline THEN
      PERFORM public.notify_clinic_collaborator_presence(_clinic_id, _user_id, 'offline');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ended_count', _affected_count,
    'user_id', _user_id
  );
END;
$$;


ALTER FUNCTION "public"."end_current_security_session"("_session_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."end_other_security_sessions"("_current_session_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _affected_count integer := 0;
  _clinic_id uuid := public.get_user_clinic_id(_user_id);
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  PERFORM public.cleanup_user_security_sessions(_user_id);

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


ALTER FUNCTION "public"."end_other_security_sessions"("_current_session_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."end_platform_clinic_access"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  _user_id uuid := auth.uid();
  _clinic_id uuid;
begin
  if not public.is_platform_owner_mfa_verified(_user_id) then
    raise exception 'Verificacao de dois fatores obrigatoria para acesso de plataforma.';
  end if;

  select clinic_id
  into _clinic_id
  from public.platform_clinic_access_sessions
  where actor_user_id = _user_id
    and ended_at is null
  order by started_at desc
  limit 1;

  update public.platform_clinic_access_sessions
  set ended_at = now(), last_seen_at = now()
  where actor_user_id = _user_id
    and ended_at is null;

  delete from public.user_active_clinic_contexts
  where user_id = _user_id
    and (_clinic_id is null or clinic_id = _clinic_id);

  if _clinic_id is not null then
    perform public.log_platform_audit_event('platform_clinic_access_ended', _clinic_id, null, '{}'::jsonb);
  end if;

  return jsonb_build_object('clinic_id', _clinic_id);
end;
$$;


ALTER FUNCTION "public"."end_platform_clinic_access"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."enforce_clinic_membership_integrity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_clinic_patient"("_clinic_id" "uuid", "_name" "text", "_name_key" "text", "_date_of_birth" "date", "_cpf" "text" DEFAULT NULL::"text", "_phone" "text" DEFAULT NULL::"text", "_email" "text" DEFAULT NULL::"text", "_uses_responsible_cpf" boolean DEFAULT false, "_gender" "text" DEFAULT NULL::"text", "_pronoun" "text" DEFAULT NULL::"text", "_rg" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $_$
DECLARE
  _actor uuid := auth.uid();
  _patient public.patients%ROWTYPE;
  _clean_name text := left(trim(coalesce(_name, '')), 160);
  _clean_name_key text := coalesce(nullif(trim(_name_key), ''), public.normalize_patient_name_key(_clean_name));
  _clean_cpf_digits text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  _clean_cpf text := null;
  _patient_cpf text := null;
  _responsible_cpf text := null;
  _phone_digits text := regexp_replace(coalesce(_phone, ''), '\D', '', 'g');
  _clean_phone text := null;
  _clean_email text := nullif(lower(left(trim(coalesce(_email, '')), 254)), '');
  _clean_gender text := nullif(trim(coalesce(_gender, '')), '');
  _clean_pronoun text := nullif(trim(coalesce(_pronoun, '')), '');
  _clean_rg text := nullif(trim(coalesce(_rg, '')), '');
  _matched_by text;
BEGIN
  IF _actor IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;

  IF _clinic_id IS NULL OR NOT public.current_user_can('patients.write', _clinic_id) THEN
    RAISE EXCEPTION 'Sem permissão para cadastrar pacientes nesta clínica';
  END IF;

  IF length(_clean_name) < 3 OR length(_clean_name_key) < 3 THEN
    RAISE EXCEPTION 'Informe um nome completo válido';
  END IF;

  IF _clean_cpf_digits <> '' THEN
    _clean_cpf := left(_clean_cpf_digits, 11);
    IF _clean_cpf !~ '^\d{11}$' THEN
      RAISE EXCEPTION 'CPF inválido';
    END IF;

    IF coalesce(_uses_responsible_cpf, false) THEN
      _responsible_cpf := _clean_cpf;
    ELSE
      _patient_cpf := _clean_cpf;
    END IF;
  END IF;

  _phone_digits := CASE
    WHEN length(_phone_digits) > 11 AND left(_phone_digits, 2) = '55' THEN substr(_phone_digits, 3)
    ELSE _phone_digits
  END;
  _clean_phone := nullif(left(_phone_digits, 11), '');

  IF _clean_phone IS NOT NULL AND _clean_phone !~ '^\d{10,11}$' THEN
    RAISE EXCEPTION 'Telefone inválido';
  END IF;

  IF _clean_email IS NOT NULL AND _clean_email !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]{2,}$' THEN
    RAISE EXCEPTION 'E-mail inválido';
  END IF;

  IF _date_of_birth IS NULL OR _date_of_birth > current_date OR _date_of_birth < (current_date - interval '130 years')::date THEN
    RAISE EXCEPTION 'Data de nascimento inválida';
  END IF;

  IF _patient_cpf IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(_clinic_id::text || ':patient:' || _patient_cpf, 0));
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_clinic_id::text || ':patient-name-birth:' || _clean_name_key || ':' || _date_of_birth::text, 0));

  IF _patient_cpf IS NOT NULL THEN
    SELECT * INTO _patient
    FROM public.patients
    WHERE clinic_id = _clinic_id
      AND cpf = _patient_cpf
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    LIMIT 1;

    IF _patient.id IS NOT NULL THEN
      _matched_by := 'cpf';
    END IF;
  END IF;

  IF _patient.id IS NULL THEN
    SELECT * INTO _patient
    FROM public.patients
    WHERE clinic_id = _clinic_id
      AND public.normalize_patient_name_key(name) = _clean_name_key
      AND date_of_birth = _date_of_birth
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    LIMIT 1;

    IF _patient.id IS NOT NULL THEN
      _matched_by := 'name_birth';
    END IF;
  END IF;

  IF _patient.id IS NOT NULL THEN
    UPDATE public.patients
    SET
      cpf = coalesce(nullif(cpf, ''), _patient_cpf),
      responsible_cpf = coalesce(nullif(responsible_cpf, ''), _responsible_cpf),
      uses_responsible_cpf = uses_responsible_cpf OR coalesce(_uses_responsible_cpf, false),
      date_of_birth = coalesce(date_of_birth, _date_of_birth),
      age = coalesce(age, extract(year from age(current_date, _date_of_birth))::integer),
      phone = coalesce(nullif(phone, ''), _clean_phone),
      email = coalesce(nullif(email, ''), _clean_email),
      gender = coalesce(nullif(gender, ''), _clean_gender),
      pronoun = coalesce(nullif(pronoun, ''), _clean_pronoun),
      rg = coalesce(nullif(rg, ''), _clean_rg),
      updated_at = now()
    WHERE id = _patient.id
    RETURNING * INTO _patient;

    RETURN jsonb_build_object(
      'id', _patient.id,
      'patient_code', _patient.patient_code,
      'status', 'existing',
      'matched_by', _matched_by,
      'name', _patient.name,
      'date_of_birth', _patient.date_of_birth,
      'cpf', _patient.cpf,
      'responsible_cpf', _patient.responsible_cpf,
      'uses_responsible_cpf', _patient.uses_responsible_cpf,
      'phone', _patient.phone,
      'email', _patient.email,
      'gender', _patient.gender,
      'pronoun', _patient.pronoun,
      'rg', _patient.rg
    );
  END IF;

  INSERT INTO public.patients (
    user_id,
    clinic_id,
    name,
    date_of_birth,
    age,
    cpf,
    responsible_cpf,
    uses_responsible_cpf,
    phone,
    email,
    gender,
    pronoun,
    rg,
    status,
    registration_complete
  )
  VALUES (
    _actor,
    _clinic_id,
    _clean_name,
    _date_of_birth,
    extract(year from age(current_date, _date_of_birth))::integer,
    _patient_cpf,
    _responsible_cpf,
    coalesce(_uses_responsible_cpf, false),
    _clean_phone,
    _clean_email,
    _clean_gender,
    _clean_pronoun,
    _clean_rg,
    'ativo',
    false
  )
  RETURNING * INTO _patient;

  RETURN jsonb_build_object(
    'id', _patient.id,
    'patient_code', _patient.patient_code,
    'status', 'created',
    'matched_by', 'created',
    'name', _patient.name,
    'date_of_birth', _patient.date_of_birth,
    'cpf', _patient.cpf,
    'responsible_cpf', _patient.responsible_cpf,
    'uses_responsible_cpf', _patient.uses_responsible_cpf,
    'phone', _patient.phone,
    'email', _patient.email,
    'gender', _patient.gender,
    'pronoun', _patient.pronoun,
    'rg', _patient.rg
  );
END;
$_$;


ALTER FUNCTION "public"."ensure_clinic_patient"("_clinic_id" "uuid", "_name" "text", "_name_key" "text", "_date_of_birth" "date", "_cpf" "text", "_phone" "text", "_email" "text", "_uses_responsible_cpf" boolean, "_gender" "text", "_pronoun" "text", "_rg" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_default_patient_group"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.patient_groups (
    user_id,
    patient_id,
    clinic_id,
    name,
    color,
    status,
    is_default
  )
  VALUES (
    NEW.user_id,
    NEW.id,
    NEW.clinic_id,
    'Sintomas não definidos',
    'gray',
    NULL,
    true
  )
  ON CONFLICT (patient_id) WHERE is_default = true
  DO UPDATE SET
    name = 'Sintomas não definidos',
    color = 'gray',
    status = NULL;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_default_patient_group"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "user_id" "uuid" NOT NULL,
    "sound_mode" "text" DEFAULT 'default'::"text" NOT NULL,
    "sound_key" "text" DEFAULT 'soft'::"text" NOT NULL,
    "notify_security" boolean DEFAULT true NOT NULL,
    "notify_clinic_access" boolean DEFAULT true NOT NULL,
    "notify_patient_saved" boolean DEFAULT true NOT NULL,
    "notify_session_activity" boolean DEFAULT true NOT NULL,
    "notify_event_reminders" boolean DEFAULT true NOT NULL,
    "notify_system" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notification_preferences_sound_key_check" CHECK (("sound_key" = ANY (ARRAY['soft'::"text", 'chime'::"text", 'pulse'::"text"]))),
    CONSTRAINT "notification_preferences_sound_mode_check" CHECK (("sound_mode" = ANY (ARRAY['default'::"text", 'silent'::"text"])))
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_notification_preferences"("_user_id" "uuid") RETURNS "public"."notification_preferences"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."ensure_notification_preferences"("_user_id" "uuid") OWNER TO "postgres";


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


ALTER FUNCTION "public"."ensure_team_development_profile"("_clinic_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_team_development_profile_from_membership"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.ensure_team_development_profile(NEW.clinic_id, NEW.user_id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_team_development_profile_from_membership"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expire_abandoned_security_sessions"("_abandoned_window" interval DEFAULT '7 days'::interval) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _affected_count integer := 0;
BEGIN
  UPDATE public.user_security_sessions
  SET
    ended_at = COALESCE(last_seen_at, now()),
    updated_at = now()
  WHERE ended_at IS NULL
    AND last_seen_at < now() - _abandoned_window;

  GET DIAGNOSTICS _affected_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'expired_count', _affected_count
  );
END;
$$;


ALTER FUNCTION "public"."expire_abandoned_security_sessions"("_abandoned_window" interval) OWNER TO "postgres";


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


ALTER FUNCTION "public"."finalize_overdue_agenda_events"("_batch_size" integer, "_timezone" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."finalize_overdue_agenda_events"("_batch_size" integer, "_timezone" "text") IS 'Converte agendamentos de atendimento vencidos em atendimentos cancelados e remove os eventos da agenda em lotes seguros.';



CREATE OR REPLACE FUNCTION "public"."generate_next_patient_code"("_clinic_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  max_num int := 0;
  next_code text;
begin
  select coalesce(max(cast(nullif(regexp_replace(patient_code, '[^0-9]', '', 'g'), '') as integer)), 0)
  into max_num
  from public.patients
  where clinic_id = _clinic_id;

  next_code := 'PAC-' || lpad((max_num + 1)::text, 3, '0');
  return next_code;
end;
$$;


ALTER FUNCTION "public"."generate_next_patient_code"("_clinic_id" "uuid") OWNER TO "postgres";


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


ALTER FUNCTION "public"."generate_profile_public_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_profile_public_code_for_clinic"("_clinic_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN public.generate_profile_public_code();
END;
$$;


ALTER FUNCTION "public"."generate_profile_public_code_for_clinic"("_clinic_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_active_platform_clinic_id"("_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select platform_clinic_access_sessions.clinic_id
  from public.platform_clinic_access_sessions
  where platform_clinic_access_sessions.actor_user_id = _user_id
    and platform_clinic_access_sessions.ended_at is null
    and public.is_platform_owner_mfa_verified(_user_id)
  order by platform_clinic_access_sessions.started_at desc
  limit 1
$$;


ALTER FUNCTION "public"."get_active_platform_clinic_id"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_asaas_webhook_logs"("_limit" integer DEFAULT 50, "_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "asaas_event_id" "text", "event_type" "text", "payload" "jsonb", "processed" boolean, "processed_at" timestamp with time zone, "error_message" "text", "signature" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not exists (
    select 1 from public.platform_admins
    where user_id = auth.uid() and is_active = true
  ) then
    raise exception 'Acesso negado: apenas administradores da plataforma podem acessar os logs de webhooks.';
  end if;

  return query
  select
    awe.id,
    awe.asaas_event_id,
    awe.event_type,
    awe.payload,
    awe.processed,
    awe.processed_at,
    awe.error_message,
    awe.signature,
    awe.created_at
  from public.asaas_webhook_events awe
  order by awe.created_at desc
  limit greatest(1, least(200, coalesce(_limit, 50)))
  offset greatest(0, coalesce(_offset, 0));
end;
$$;


ALTER FUNCTION "public"."get_asaas_webhook_logs"("_limit" integer, "_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_clinic_collaborator_invitation"("_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
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


ALTER FUNCTION "public"."get_clinic_collaborator_invitation"("_token" "text") OWNER TO "postgres";


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


ALTER FUNCTION "public"."get_clinic_dashboard_analytics"("_clinic_id" "uuid", "_year" integer) OWNER TO "postgres";


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


ALTER FUNCTION "public"."get_clinic_feature_flags"("_clinic_id" "uuid") OWNER TO "postgres";


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


ALTER FUNCTION "public"."get_clinic_pending_collaborator_invitations"("_clinic_id" "uuid") OWNER TO "postgres";


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


ALTER FUNCTION "public"."get_clinic_share_collaborators"("_clinic_id" "uuid") OWNER TO "postgres";


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

ALTER FUNCTION "public"."get_clinic_active_terms"("p_clinic_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_clinic_subscription_summary"("_clinic_id" "uuid") RETURNS TABLE("subscription_id" "uuid", "clinic_id" "uuid", "account_owner_user_id" "uuid", "plan_type" "public"."subscription_plan", "status" "text", "billing_cycle" "text", "payment_method" "text", "base_monthly_price" numeric, "total_recurring_monthly_price" numeric, "base_subaccount_limit" integer, "purchased_subaccount_extra_count" integer, "total_subaccount_limit" integer, "base_concurrent_access_count" integer, "additional_concurrent_access_count" integer, "total_concurrent_access_limit" integer, "next_due_date" "date", "current_period_start" timestamp with time zone, "current_period_end" timestamp with time zone, "expires_at" timestamp with time zone, "period_duration_days" integer, "auto_renew" boolean, "days_remaining" integer, "is_expired" boolean, "asaas_customer_id" "text", "asaas_subscription_id" "text", "applied_coupon_id" "uuid", "coupon_code" "text", "discount_percentage" numeric, "discount_fixed_amount" numeric, "trial_ends_at" timestamp with time zone, "override_reason" "text", "override_by_user_id" "uuid", "override_at" timestamp with time zone, "cpf_cnpj" "text", "billing_email" "text", "billing_name" "text")
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
      WHEN cs.plan_type = 'solo' THEN 1 
      WHEN cs.plan_type = 'enterprise' THEN (COALESCE(cs.base_subaccount_limit, 100) + COALESCE(cs.purchased_subaccount_extra_count, 0))
      ELSE (COALESCE(cs.base_subaccount_limit, 30) + COALESCE(cs.purchased_subaccount_extra_count, 0)) 
    END)::integer AS total_subaccount_limit,
    cs.base_concurrent_access_count,
    cs.additional_concurrent_access_count,
    (CASE 
      WHEN cs.plan_type = 'solo' THEN 1 
      WHEN cs.plan_type = 'enterprise' THEN (COALESCE(cs.base_concurrent_access_count, 10) + COALESCE(cs.additional_concurrent_access_count, 0))
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
    cs.billing_name
  FROM public.clinic_subscriptions cs
  WHERE cs.clinic_id = _clinic_id
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_clinic_subscription_summary"("_clinic_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_platform_role"() RETURNS "public"."platform_admin_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select platform_admins.role
  from public.platform_admins
  where platform_admins.user_id = auth.uid()
    and platform_admins.is_active = true
    and public.is_platform_owner_mfa_verified(auth.uid())
  limit 1
$$;


ALTER FUNCTION "public"."get_current_platform_role"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."get_current_user_pending_release_notes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_patient_registration_form"("_token" "text", "_password" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _link public.patient_registration_links%ROWTYPE;
  _patient public.patients%ROWTYPE;
  _normalized_password text := left(regexp_replace(coalesce(_password, ''), '\D', '', 'g'), 6);
  _completed boolean;
BEGIN
  SELECT * INTO _link
  FROM public.patient_registration_links
  WHERE token = _token;

  IF _link.id IS NULL THEN
    RAISE EXCEPTION 'Link inválido';
  END IF;

  IF _link.password_prefix IS DISTINCT FROM _normalized_password THEN
    RAISE EXCEPTION 'Senha inválida';
  END IF;

  SELECT * INTO _patient
  FROM public.patients
  WHERE id = _link.patient_id;

  IF _patient.id IS NULL THEN
    RAISE EXCEPTION 'Paciente não encontrado';
  END IF;

  _completed := coalesce(_patient.registration_complete, false) OR _link.completed_at IS NOT NULL;

  RETURN jsonb_build_object(
    'completed', _completed,
    'message', CASE
      WHEN _completed THEN 'Cadastro concluído! Caso precise atualizar alguma informação, informe o profissional que está te atendendo.'
      ELSE null
    END,
    'patient', jsonb_build_object(
      'id', _patient.id,
      'name', _patient.name,
      'cpf', _patient.cpf,
      'date_of_birth', _patient.date_of_birth,
      'phone', _patient.phone,
      'email', _patient.email,
      'gender', _patient.gender,
      'rg', _patient.rg,
      'blood_type', _patient.blood_type,
      'pronoun', _patient.pronoun,
      'profession', _patient.profession,
      'origin_type', _patient.origin_type,
      'origin_referrer_name', _patient.origin_referrer_name,
      'origin_insurance_provider', _patient.origin_insurance_provider,
      'origin_insurance_plan', _patient.origin_insurance_plan,
      'origin_insurance_member_id', _patient.origin_insurance_member_id,
      'origin_other_name', _patient.origin_other_name,
      'origin_other_description', _patient.origin_other_description,
      'cep', _patient.cep,
      'country', coalesce(_patient.country, 'Brasil'),
      'state', _patient.state,
      'city', _patient.city,
      'neighborhood', _patient.neighborhood,
      'street', _patient.street,
      'address_number', _patient.address_number,
      'address_complement', _patient.address_complement,
      'chronic_conditions', _patient.chronic_conditions,
      'surgeries', _patient.surgeries,
      'continuous_medications', _patient.continuous_medications,
      'allergies', _patient.allergies,
      'clinical_notes', _patient.clinical_notes,
      'clinical_profile', _patient.clinical_profile,
      'emergency_contact', _patient.emergency_contact
    )
  );
END;
$$;


ALTER FUNCTION "public"."get_patient_registration_form"("_token" "text", "_password" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_platform_clinic_detail"("_clinic_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select case
    when not public.is_platform_owner_mfa_verified(auth.uid()) then
      public.raise_exception_json('Verificacao de dois fatores obrigatoria para acesso de plataforma.')
    else (
      select jsonb_build_object(
        'clinic', to_jsonb(clinics),
        'owner', to_jsonb(owner_profile),
        'counts', jsonb_build_object(
          'collaborators', (select count(*) from public.clinic_memberships where clinic_id = clinics.id and is_active = true),
          'patients', (select count(*) from public.patients where clinic_id = clinics.id),
          'sessions', (select count(*) from public.sessions where clinic_id = clinics.id),
          'agendaEvents', (select count(*) from public.agenda_events where clinic_id = clinics.id)
        ),
        'memberships', coalesce((
          select jsonb_agg(member_row order by member_row.full_name nulls last, member_row.email nulls last)
          from (
            select
              clinic_memberships.id,
              clinic_memberships.user_id,
              clinic_memberships.account_role,
              clinic_memberships.operational_role,
              clinic_memberships.membership_status,
              clinic_memberships.is_active,
              clinic_memberships.joined_at,
              profiles.full_name,
              profiles.email
            from public.clinic_memberships
            left join public.profiles on profiles.id = clinic_memberships.user_id
            where clinic_memberships.clinic_id = clinics.id
          ) member_row
        ), '[]'::jsonb),
        'patients', coalesce((
          select jsonb_agg(patient_row order by patient_row.name nulls last, patient_row.created_at desc)
          from (
            select
              patients.id,
              patients.name,
              patients.email,
              patients.phone,
              patients.cpf,
              patients.status,
              patients.registration_complete,
              patients.created_at,
              patients.updated_at
            from public.patients
            where patients.clinic_id = clinics.id
            order by patients.created_at desc
            limit 120
          ) patient_row
        ), '[]'::jsonb)
      )
      from public.clinics
      left join public.profiles owner_profile on owner_profile.id = clinics.account_owner_user_id
      where clinics.id = _clinic_id
    )
  end
$$;


ALTER FUNCTION "public"."get_platform_clinic_detail"("_clinic_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_platform_clinic_detail_by_route_key"("_route_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
declare
  _clean_route_key text := nullif(trim(coalesce(_route_key, '')), '');
  _clinic_id uuid;
begin
  if not public.is_platform_owner_mfa_verified(auth.uid()) then
    raise exception 'Verificacao de dois fatores obrigatoria para acesso de plataforma.';
  end if;

  if _clean_route_key is null
    or char_length(_clean_route_key) > 80
    or _clean_route_key !~ '^[A-Za-z0-9_-]+$'
  then
    raise exception 'Rota de clinica invalida.';
  end if;

  select clinics.id
  into _clinic_id
  from public.clinics
  where clinics.route_key = _clean_route_key
  limit 1;

  if _clinic_id is null then
    raise exception 'Clinica nao encontrada.';
  end if;

  return public.get_platform_clinic_detail(_clinic_id);
end;
$_$;


ALTER FUNCTION "public"."get_platform_clinic_detail_by_route_key"("_route_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_platform_clinic_forms_summary_by_route_key"("_route_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
declare
  _clean_route_key text := nullif(trim(coalesce(_route_key, '')), '');
  _clinic_id uuid;
  _summary jsonb;
begin
  if not public.is_platform_owner_mfa_verified(auth.uid()) then
    raise exception 'Verificacao de dois fatores obrigatoria para acesso de plataforma.';
  end if;

  if _clean_route_key is null
    or char_length(_clean_route_key) > 80
    or _clean_route_key !~ '^[A-Za-z0-9_-]+$'
  then
    raise exception 'Rota de clinica invalida.';
  end if;

  select clinics.id
  into _clinic_id
  from public.clinics
  where clinics.route_key = _clean_route_key
  limit 1;

  if _clinic_id is null then
    raise exception 'Clinica nao encontrada.';
  end if;

  select jsonb_build_object(
    'base', jsonb_build_object(
      'field_count', coalesce((
        select count(*)::integer
        from jsonb_array_elements(coalesce(clinics.anamnesis_base_schema, '[]'::jsonb)) as field(value)
        where coalesce(field.value->>'type', '') not in ('section', 'horizontal_section', 'section_selector')
      ), 0),
      'section_count', coalesce((
        select count(*)::integer
        from jsonb_array_elements(coalesce(clinics.anamnesis_base_schema, '[]'::jsonb)) as field(value)
        where coalesce(field.value->>'type', '') in ('section', 'horizontal_section', 'section_selector')
      ), 0),
      'schema', coalesce(clinics.anamnesis_base_schema, '[]'::jsonb),
      'updated_at', clinics.updated_at
    ),
    'templates', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', templates.id,
          'name', templates.name,
          'description', templates.description,
          'field_count', coalesce((
            select count(*)::integer
            from jsonb_array_elements(coalesce(templates.schema, '[]'::jsonb)) as field(value)
            where coalesce(field.value->>'type', '') not in ('section', 'horizontal_section', 'section_selector')
          ), 0),
          'section_count', coalesce((
            select count(*)::integer
            from jsonb_array_elements(coalesce(templates.schema, '[]'::jsonb)) as field(value)
            where coalesce(field.value->>'type', '') in ('section', 'horizontal_section', 'section_selector')
          ), 0),
          'schema', coalesce(templates.schema, '[]'::jsonb),
          'usage_count', coalesce(template_usage.total, 0),
          'updated_at', templates.updated_at
        )
        order by templates.updated_at desc nulls last, templates.name
      )
      from public.anamnesis_form_templates templates
      left join lateral (
        select count(*)::integer as total
        from public.sessions
        where sessions.anamnesis_template_id = templates.id
      ) template_usage on true
      where templates.clinic_id = clinics.id
    ), '[]'::jsonb)
  )
  into _summary
  from public.clinics
  where clinics.id = _clinic_id;

  perform public.log_platform_audit_event(
    'platform_clinic_forms_summary_read',
    _clinic_id,
    null,
    jsonb_build_object('route_key', _clean_route_key)
  );

  return coalesce(_summary, jsonb_build_object('base', jsonb_build_object(), 'templates', '[]'::jsonb));
end;
$_$;


ALTER FUNCTION "public"."get_platform_clinic_forms_summary_by_route_key"("_route_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_platform_clinic_roles_overview"("_clinic_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _roles jsonb;
  _capabilities jsonb;
  _usage_counts jsonb;
BEGIN
  IF NOT public.is_platform_owner(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas operadores master da plataforma podem consultar papéis operacionais de clínicas.';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'clinic_id', r.clinic_id,
        'role_key', r.role_key,
        'label', r.label,
        'description', r.description,
        'base_operational_role', r.base_operational_role,
        'sort_order', r.sort_order,
        'is_system', r.is_system,
        'created_at', r.created_at,
        'updated_at', r.updated_at
      ) ORDER BY r.sort_order ASC, r.label ASC
    ),
    '[]'::jsonb
  )
  INTO _roles
  FROM public.clinic_operational_roles r
  WHERE r.clinic_id = _clinic_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'clinic_id', c.clinic_id,
        'operational_role', c.operational_role,
        'capability', c.capability,
        'enabled', c.enabled,
        'created_at', c.created_at,
        'updated_at', c.updated_at
      )
    ),
    '[]'::jsonb
  )
  INTO _capabilities
  FROM public.clinic_operational_role_capabilities c
  WHERE c.clinic_id = _clinic_id;

  SELECT COALESCE(
    jsonb_object_agg(sub.operational_role, sub.total),
    '{}'::jsonb
  )
  INTO _usage_counts
  FROM (
    SELECT cm.operational_role::text AS operational_role, count(*)::int AS total
    FROM public.clinic_memberships cm
    WHERE cm.clinic_id = _clinic_id
      AND cm.membership_status <> 'invited'
      AND cm.is_active = true
    GROUP BY cm.operational_role
  ) sub;

  RETURN jsonb_build_object(
    'roles', _roles,
    'capabilities', _capabilities,
    'usage_counts', _usage_counts
  );
END;
$$;


ALTER FUNCTION "public"."get_platform_clinic_roles_overview"("_clinic_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_platform_dashboard"() RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select case
    when not public.is_platform_owner_mfa_verified(auth.uid()) then
      (select raise_exception_json('Verificacao de dois fatores obrigatoria para acesso de plataforma.'))
    else jsonb_build_object(
      'totals', jsonb_build_object(
        'clinics', (select count(*) from public.clinics),
        'profiles', (select count(*) from public.profiles),
        'patients', (select count(*) from public.patients),
        'sessions', (select count(*) from public.sessions),
        'activeFeatureFlags', (
          select count(*)
          from public.feature_flags
          where coalesce(starts_at, '-infinity'::timestamptz) <= now()
            and coalesce(expires_at, 'infinity'::timestamptz) > now()
        )
      ),
      'recentAuditEvents', coalesce((
        select jsonb_agg(event_row order by created_at desc)
        from (
          select
            platform_audit_events.id,
            platform_audit_events.event_type,
            platform_audit_events.reason,
            platform_audit_events.created_at,
            platform_audit_events.clinic_id,
            clinics.name as clinic_name,
            profiles.email as actor_email,
            profiles.full_name as actor_name
          from public.platform_audit_events
          left join public.clinics on clinics.id = platform_audit_events.clinic_id
          left join public.profiles on profiles.id = platform_audit_events.actor_user_id
          order by platform_audit_events.created_at desc
          limit 12
        ) event_row
      ), '[]'::jsonb),
      'recentSecurityEvents', coalesce((
        select jsonb_agg(event_row order by created_at desc)
        from (
          select
            security_events.id,
            security_events.event_type,
            security_events.created_at,
            security_events.clinic_id,
            clinics.name as clinic_name,
            profiles.email as target_email
          from public.security_events
          left join public.clinics on clinics.id = security_events.clinic_id
          left join public.profiles on profiles.id = security_events.target_user_id
          order by security_events.created_at desc
          limit 12
        ) event_row
      ), '[]'::jsonb)
    )
  end
$$;


ALTER FUNCTION "public"."get_platform_dashboard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_platform_person_detail"("_item_type" "text", "_item_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  _result jsonb;
  _pending_invitation public.clinic_collaborator_invitations%ROWTYPE;
  _pending_clinic public.clinics%ROWTYPE;
  _pending_user auth.users%ROWTYPE;
  _auth_user auth.users%ROWTYPE;
BEGIN
  IF NOT public.is_platform_owner_mfa_verified(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado ao painel global.';
  END IF;

  IF _item_type = 'account' THEN
    SELECT * INTO _auth_user
    FROM auth.users
    WHERE id = _item_id;

    SELECT jsonb_build_object(
      'type', 'account',
      'profile', to_jsonb(profiles) || jsonb_build_object(
        'email_confirmed_at', _auth_user.email_confirmed_at,
        'email_confirmed', (_auth_user.email_confirmed_at IS NOT NULL),
        'status', CASE
          WHEN _auth_user.id IS NOT NULL AND _auth_user.email_confirmed_at IS NULL THEN 'E-mail não verificado'
          ELSE 'Ativo'
        END
      ),
      'memberships', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'membership_id', clinic_memberships.id,
          'clinic_id', clinic_memberships.clinic_id,
          'clinic_name', clinics.name,
          'clinic_route_key', clinics.route_key,
          'account_role', clinic_memberships.account_role,
          'operational_role', clinic_memberships.operational_role,
          'membership_status', clinic_memberships.membership_status,
          'is_active', clinic_memberships.is_active,
          'joined_at', clinic_memberships.joined_at
        ) ORDER BY clinic_memberships.joined_at DESC)
        FROM public.clinic_memberships
        JOIN public.clinics ON clinics.id = clinic_memberships.clinic_id
        WHERE clinic_memberships.user_id = profiles.id
      ), '[]'::jsonb),
      'counts', jsonb_build_object(
        'sessions_created', (SELECT count(*) FROM public.sessions WHERE sessions.user_id = profiles.id),
        'sessions_as_provider', (SELECT count(*) FROM public.sessions WHERE sessions.provider_id = profiles.id)
      )
    )
    INTO _result
    FROM public.profiles
    WHERE profiles.id = _item_id;

    -- Se não achou em profiles, procura em convites pendentes
    IF _result IS NULL THEN
      SELECT * INTO _pending_invitation
      FROM public.clinic_collaborator_invitations
      WHERE id = _item_id OR existing_user_id = _item_id
      LIMIT 1;

      IF _pending_invitation.id IS NOT NULL THEN
        SELECT * INTO _pending_clinic
        FROM public.clinics
        WHERE id = _pending_invitation.clinic_id;

        SELECT * INTO _pending_user
        FROM auth.users
        WHERE lower(email) = lower(_pending_invitation.email);

        _result := jsonb_build_object(
          'type', 'account',
          'is_pending_registration', true,
          'profile', jsonb_build_object(
            'id', COALESCE(_pending_user.id, _pending_invitation.id),
            'email', _pending_invitation.email,
            'full_name', _pending_invitation.email,
            'job_title', _pending_invitation.job_title,
            'specialty', _pending_invitation.specialty,
            'created_at', _pending_invitation.created_at,
            'updated_at', _pending_invitation.updated_at,
            'email_confirmed_at', _pending_user.email_confirmed_at,
            'email_confirmed', (_pending_user.email_confirmed_at IS NOT NULL),
            'status', CASE
              WHEN _pending_user.id IS NOT NULL AND _pending_user.email_confirmed_at IS NULL THEN 'E-mail não verificado'
              WHEN _pending_user.id IS NOT NULL THEN 'Aguardando login'
              ELSE 'Convite pendente'
            END
          ),
          'invitation', jsonb_build_object(
            'id', _pending_invitation.id,
            'clinic_id', _pending_invitation.clinic_id,
            'email', _pending_invitation.email,
            'operational_role', _pending_invitation.operational_role,
            'job_title', _pending_invitation.job_title,
            'specialty', _pending_invitation.specialty,
            'status', _pending_invitation.status,
            'created_at', _pending_invitation.created_at,
            'last_resent_at', _pending_invitation.last_resent_at,
            'expires_at', _pending_invitation.expires_at,
            'account_state', CASE
              WHEN _pending_user.id IS NOT NULL AND _pending_user.email_confirmed_at IS NULL THEN 'registered_unconfirmed'
              WHEN _pending_user.id IS NOT NULL THEN 'registered_confirmed_pending_acceptance'
              ELSE 'invite_sent'
            END
          ),
          'memberships', jsonb_build_array(
            jsonb_build_object(
              'membership_id', _pending_invitation.id,
              'clinic_id', _pending_clinic.id,
              'clinic_name', _pending_clinic.name,
              'clinic_route_key', _pending_clinic.route_key,
              'account_role', 'user',
              'operational_role', _pending_invitation.operational_role,
              'membership_status', 'invited',
              'is_active', false,
              'joined_at', _pending_invitation.created_at
            )
          ),
          'counts', jsonb_build_object(
            'sessions_created', 0,
            'sessions_as_provider', 0
          )
        );
      ELSE
        -- Procura em auth.users para usuário sem perfil (órfão)
        SELECT * INTO _pending_user
        FROM auth.users
        WHERE id = _item_id;

        IF _pending_user.id IS NOT NULL THEN
          _result := jsonb_build_object(
            'type', 'account',
            'is_pending_registration', true,
            'profile', jsonb_build_object(
              'id', _pending_user.id,
              'email', _pending_user.email,
              'full_name', coalesce(_pending_user.raw_user_meta_data->>'full_name', _pending_user.email),
              'cpf', _pending_user.raw_user_meta_data->>'cpf',
              'phone', _pending_user.raw_user_meta_data->>'phone',
              'created_at', _pending_user.created_at,
              'updated_at', _pending_user.updated_at,
              'email_confirmed_at', _pending_user.email_confirmed_at,
              'email_confirmed', (_pending_user.email_confirmed_at IS NOT NULL),
              'status', CASE
                WHEN _pending_user.email_confirmed_at IS NULL THEN 'E-mail não verificado'
                ELSE 'Aguardando finalização do perfil'
              END
            ),
            'memberships', '[]'::jsonb,
            'counts', jsonb_build_object('sessions_created', 0, 'sessions_as_provider', 0)
          );
        END IF;
      END IF;
    END IF;

  ELSIF _item_type = 'patient' THEN
    SELECT jsonb_build_object(
      'type', 'patient',
      'patient', to_jsonb(patients),
      'clinic', jsonb_build_object(
        'id', clinics.id,
        'name', clinics.name,
        'route_key', clinics.route_key,
        'cnpj', clinics.cnpj
      ),
      'counts', jsonb_build_object(
        'sessions', (SELECT count(*) FROM public.sessions WHERE sessions.patient_id = patients.id),
        'drafts', (SELECT count(*) FROM public.sessions WHERE sessions.patient_id = patients.id AND sessions.status = 'rascunho'),
        'completed', (SELECT count(*) FROM public.sessions WHERE sessions.patient_id = patients.id AND sessions.status = 'concluido')
      ),
      'recent_sessions', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', sessions.id,
          'session_date', sessions.session_date,
          'status', sessions.status,
          'payment_status', sessions.payment_status,
          'amount_charged_cents', sessions.amount_charged_cents,
          'amount_paid_cents', sessions.amount_paid_cents
        ) ORDER BY sessions.session_date DESC)
        FROM (
          SELECT *
          FROM public.sessions
          WHERE sessions.patient_id = patients.id
          ORDER BY sessions.session_date DESC
          LIMIT 10
        ) sessions
      ), '[]'::jsonb)
    )
    INTO _result
    FROM public.patients
    JOIN public.clinics ON clinics.id = patients.clinic_id
    WHERE patients.id = _item_id;
  ELSE
    RAISE EXCEPTION 'Tipo de detalhe inválido.';
  END IF;

  PERFORM public.log_platform_audit_event(
    'platform_directory_detail_read',
    coalesce((_result #>> '{clinic,id}')::uuid, null),
    null,
    jsonb_build_object('item_type', _item_type, 'item_id', _item_id)
  );

  RETURN _result;
END;
$$;


ALTER FUNCTION "public"."get_platform_person_detail"("_item_type" "text", "_item_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_session_share_recipients"("_session_id" "uuid") RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    json_agg(
      json_build_object(
        'id', session_shares.shared_with_user_id,
        'full_name', profiles.full_name,
        'email', profiles.email,
        'job_title', profiles.job_title,
        'operational_role', clinic_memberships.operational_role,
        'access_level', session_shares.access_level,
        'shared_by_user_id', session_shares.shared_by_user_id,
        'created_at', session_shares.created_at
      )
      order by profiles.full_name nulls last, profiles.email
    ),
    '[]'::json
  )
  from public.session_shares
  join public.profiles
    on profiles.id = session_shares.shared_with_user_id
  left join public.clinic_memberships
    on clinic_memberships.clinic_id = session_shares.clinic_id
    and clinic_memberships.user_id = session_shares.shared_with_user_id
  where session_shares.session_id = _session_id
    and session_shares.revoked_at is null
    and public.can_read_session(_session_id);
$$;


ALTER FUNCTION "public"."get_session_share_recipients"("_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_session_share_summary"("_session_ids" "uuid"[]) RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    json_agg(
      json_build_object(
        'session_id', summaries.session_id,
        'share_count', summaries.share_count,
        'recipients', summaries.recipients
      )
      order by summaries.session_id
    ),
    '[]'::json
  )
  from (
    select
      session_shares.session_id,
      count(*)::int as share_count,
      json_agg(
        json_build_object(
          'id', session_shares.shared_with_user_id,
          'full_name', profiles.full_name,
          'email', profiles.email,
          'job_title', profiles.job_title,
          'access_level', session_shares.access_level,
          'created_at', session_shares.created_at
        )
        order by profiles.full_name nulls last, profiles.email
      ) as recipients
    from public.session_shares
    join public.profiles
      on profiles.id = session_shares.shared_with_user_id
    where session_shares.session_id = any(_session_ids)
      and session_shares.revoked_at is null
      and public.can_read_session(session_shares.session_id)
    group by session_shares.session_id
  ) as summaries;
$$;


ALTER FUNCTION "public"."get_session_share_summary"("_session_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_active_governance"("_user_id" "uuid") RETURNS TABLE("punishment_id" "uuid", "punishment_type" "text", "applied_at" timestamp with time zone, "expires_at" timestamp with time zone, "reason" "text", "is_manual" boolean, "applied_by_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
BEGIN
  -- Auto-expire outdated punishments first
  UPDATE public.user_punishments
  SET is_active = false
  WHERE user_id = _user_id
    AND is_active = true
    AND expires_at IS NOT NULL
    AND expires_at < now();

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


ALTER FUNCTION "public"."get_user_active_governance"("_user_id" "uuid") OWNER TO "postgres";


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


ALTER FUNCTION "public"."get_user_clinic_id"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_personal_signup"("_user_id" "uuid", "_email" "text", "_full_name" "text" DEFAULT NULL::"text", "_cpf" "text" DEFAULT NULL::"text", "_phone" "text" DEFAULT NULL::"text", "_birth_date" "date" DEFAULT NULL::"date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."handle_personal_signup"("_user_id" "uuid", "_email" "text", "_full_name" "text", "_cpf" "text", "_phone" "text", "_birth_date" "date") OWNER TO "postgres";


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
  IF _email = 'admin@therapyflow.com' THEN
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


ALTER FUNCTION "public"."handle_signup"("_user_id" "uuid", "_email" "text", "_cnpj" "text", "_full_name" "text") OWNER TO "postgres";


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

  IF _email = 'admin@therapyflow.com' THEN
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


ALTER FUNCTION "public"."handle_signup"("_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscription_plan", "_full_name" "text") OWNER TO "postgres";


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


ALTER FUNCTION "public"."handle_signup"("_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscription_plan", "_full_name" "text", "_clinic_name" "text") OWNER TO "postgres";


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
BEGIN
  -- Verificar se ja existe clinica cadastrada com este CNPJ
  SELECT id, account_owner_user_id, name 
  INTO _existing_clinic_id, _existing_owner_user_id, _existing_clinic_name
  FROM public.clinics
  WHERE cnpj = _cnpj
  ORDER BY created_at ASC
  LIMIT 1;

  IF _existing_clinic_id IS NOT NULL THEN
    -- Caso 1: O CNPJ pertence a OUTRO usuario na plataforma
    IF _existing_owner_user_id IS DISTINCT FROM _user_id THEN
      RAISE EXCEPTION 'CNPJ_REGISTERED_TO_OTHER_USER';
    END IF;

    -- Caso 2: O CNPJ pertence ao MESMO usuario, mas ele ainda nao confirmou a duplicacao
    IF NOT _allow_duplicate_cnpj THEN
      RAISE EXCEPTION 'OWNER_HAS_CLINIC_WITH_CNPJ:%', _existing_clinic_name;
    END IF;
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
    'account_owner'::account_role_type,
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


ALTER FUNCTION "public"."handle_signup"("_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscription_plan", "_full_name" "text", "_clinic_name" "text", "_allow_duplicate_cnpj" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_community_template_import"("p_template_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.community_form_templates
  SET imports_count = imports_count + 1
  WHERE id = p_template_id AND is_published = true;
END;
$$;


ALTER FUNCTION "public"."increment_community_template_import"("p_template_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invite_clinic_collaborator"("_clinic_id" "uuid" DEFAULT NULL::"uuid", "_email" "text" DEFAULT NULL::"text", "_operational_role" "public"."operational_role_type" DEFAULT 'professional'::"public"."operational_role_type", "_job_title" "text" DEFAULT NULL::"text", "_specialty" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $_$
DECLARE
  _requester_id uuid := auth.uid();
  _resolved_clinic_id uuid;
  _normalized_email text := lower(trim(coalesce(_email, '')));
  _token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  _token_hash text := md5(_token);
  _existing_user_id uuid;
  _existing_membership_id uuid;
  _invitation_id uuid;
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.clinics
    WHERE clinics.id = _resolved_clinic_id
      AND clinics.subscription_plan = 'clinic'
  ) THEN
    RAISE EXCEPTION 'Convites de colaboradores estão disponíveis apenas no plano clinic.';
  END IF;

  IF _normalized_email = '' OR _normalized_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'Informe um e-mail válido para o convite.';
  END IF;

  IF _operational_role = 'owner' THEN
    RAISE EXCEPTION 'O papel owner não pode ser atribuído por convite operacional.';
  END IF;

  SELECT users.id
  INTO _existing_user_id
  FROM auth.users
  WHERE lower(users.email) = _normalized_email
  LIMIT 1;

  UPDATE public.clinic_collaborator_invitations
  SET status = 'cancelled'
  WHERE clinic_id = _resolved_clinic_id
    AND lower(email) = _normalized_email
    AND status = 'pending';

  INSERT INTO public.clinic_collaborator_invitations (
    clinic_id,
    email,
    operational_role,
    job_title,
    specialty,
    token_hash,
    invited_by,
    existing_user_id,
    status
  )
  VALUES (
    _resolved_clinic_id,
    _normalized_email,
    _operational_role,
    NULLIF(trim(_job_title), ''),
    NULLIF(trim(_specialty), ''),
    _token_hash,
    _requester_id,
    _existing_user_id,
    'pending'
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
      'operational_role', _operational_role,
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


ALTER FUNCTION "public"."invite_clinic_collaborator"("_clinic_id" "uuid", "_email" "text", "_operational_role" "public"."operational_role_type", "_job_title" "text", "_specialty" "text") OWNER TO "postgres";


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


ALTER FUNCTION "public"."is_active_clinic_member"("_clinic_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


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


ALTER FUNCTION "public"."is_clinic_read_only"("_clinic_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_clinic_subscription_manager"("_user_id" "uuid", "_clinic_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.clinic_memberships cm
    where cm.clinic_id = _clinic_id
      and cm.user_id = _user_id
      and cm.account_role = 'account_owner'
      and cm.is_active = true
      and cm.membership_status = 'active'
  )
  or exists (
    select 1 from public.platform_admins pa
    where pa.user_id = _user_id
      and pa.is_active = true
  )
$$;


ALTER FUNCTION "public"."is_clinic_subscription_manager"("_user_id" "uuid", "_clinic_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_platform_owner"("_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.platform_admins
    where platform_admins.user_id = _user_id
      and platform_admins.role = 'platform_owner'
      and platform_admins.is_active = true
  )
$$;


ALTER FUNCTION "public"."is_platform_owner"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_platform_owner_mfa_verified"("_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.is_platform_owner(_user_id)
    and coalesce(auth.jwt()->>'aal', '') = 'aal2'
$$;


ALTER FUNCTION "public"."is_platform_owner_mfa_verified"("_user_id" "uuid") OWNER TO "postgres";


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


ALTER FUNCTION "public"."leave_current_user_clinic"("_clinic_id" "uuid") OWNER TO "postgres";


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


ALTER FUNCTION "public"."list_current_user_clinic_invitations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_current_user_clinics"() RETURNS TABLE("membership_id" "uuid", "clinic_id" "uuid", "clinic_route_key" "text", "clinic_name" "text", "clinic_logo_url" "text", "clinic_subscription_plan" "public"."subscription_plan", "clinic_subaccount_limit" integer, "clinic_concurrent_access_limit" integer, "clinic_active_access_count" integer, "clinic_active_access_users" "jsonb", "clinic_account_owner_user_id" "uuid", "account_role" "public"."account_role_type", "operational_role" "public"."operational_role_type", "membership_status" "public"."membership_status_type", "is_active" boolean, "joined_at" timestamp with time zone)
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


ALTER FUNCTION "public"."list_current_user_clinics"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."list_current_user_notification_preferences"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."list_current_user_notifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_feature_flags"("_clinic_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "key" "text", "scope" "public"."feature_flag_scope", "clinic_id" "uuid", "tag_id" "uuid", "clinic_name" "text", "value" "jsonb", "description" "text", "starts_at" timestamp with time zone, "expires_at" timestamp with time zone, "reason" "text", "created_by" "uuid", "updated_by" "uuid", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "is_active_now" boolean)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    feature_flags.id,
    feature_flags.key,
    feature_flags.scope,
    feature_flags.clinic_id,
    feature_flags.tag_id,
    clinics.name,
    feature_flags.value,
    feature_flags.description,
    feature_flags.starts_at,
    feature_flags.expires_at,
    feature_flags.reason,
    feature_flags.created_by,
    feature_flags.updated_by,
    feature_flags.created_at,
    feature_flags.updated_at,
    coalesce(feature_flags.starts_at, '-infinity'::timestamptz) <= now()
      and coalesce(feature_flags.expires_at, 'infinity'::timestamptz) > now()
  from public.feature_flags
  left join public.clinics on clinics.id = feature_flags.clinic_id
  where public.is_platform_owner_mfa_verified(auth.uid())
    and (
      _clinic_id is null
      or feature_flags.scope::text = 'global'
      or (feature_flags.scope::text = 'clinic' and feature_flags.clinic_id = _clinic_id)
      or (feature_flags.scope::text = 'tag' and exists (
        select 1 from public.clinic_tag_relations ctr
        where ctr.clinic_id = _clinic_id and ctr.tag_id = feature_flags.tag_id
      ))
    )
  order by feature_flags.scope, feature_flags.key
$$;


ALTER FUNCTION "public"."list_feature_flags"("_clinic_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_platform_audit_events"("_clinic_id" "uuid" DEFAULT NULL::"uuid", "_limit" integer DEFAULT 80) RETURNS TABLE("id" "uuid", "actor_user_id" "uuid", "actor_email" "text", "actor_name" "text", "actor_platform_role" "public"."platform_admin_role", "clinic_id" "uuid", "clinic_name" "text", "event_type" "text", "reason" "text", "metadata" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    platform_audit_events.id,
    platform_audit_events.actor_user_id,
    actor_profile.email,
    actor_profile.full_name,
    platform_audit_events.actor_platform_role,
    platform_audit_events.clinic_id,
    clinics.name,
    platform_audit_events.event_type,
    platform_audit_events.reason,
    platform_audit_events.metadata,
    platform_audit_events.created_at
  from public.platform_audit_events
  left join public.profiles actor_profile on actor_profile.id = platform_audit_events.actor_user_id
  left join public.clinics on clinics.id = platform_audit_events.clinic_id
  where public.is_platform_owner_mfa_verified(auth.uid())
    and (_clinic_id is null or platform_audit_events.clinic_id = _clinic_id)
  order by platform_audit_events.created_at desc
  limit least(greatest(coalesce(_limit, 80), 1), 200)
$$;


ALTER FUNCTION "public"."list_platform_audit_events"("_clinic_id" "uuid", "_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_platform_clinics"() RETURNS TABLE("clinic_id" "uuid", "clinic_route_key" "text", "clinic_name" "text", "clinic_cnpj" "text", "clinic_subscription_plan" "public"."subscription_plan", "clinic_subaccount_limit" integer, "clinic_concurrent_access_limit" integer, "clinic_created_at" timestamp with time zone, "clinic_updated_at" timestamp with time zone, "owner_user_id" "uuid", "owner_name" "text", "owner_email" "text", "collaborators_count" bigint, "patients_count" bigint, "sessions_count" bigint, "active_flags_count" bigint, "last_activity_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    clinics.id,
    clinics.route_key,
    clinics.name,
    clinics.cnpj,
    clinics.subscription_plan,
    clinics.subaccount_limit,
    nullif(to_jsonb(clinics)->>'concurrent_access_limit', '')::integer,
    clinics.created_at,
    clinics.updated_at,
    clinics.account_owner_user_id,
    owner_profile.full_name,
    owner_profile.email,
    coalesce(membership_counts.total, 0),
    coalesce(patient_counts.total, 0),
    coalesce(session_counts.total, 0),
    coalesce(flag_counts.total, 0),
    greatest(
      clinics.updated_at,
      coalesce(patient_counts.last_activity_at, clinics.updated_at),
      coalesce(session_counts.last_activity_at, clinics.updated_at)
    )
  from public.clinics
  left join public.profiles owner_profile on owner_profile.id = clinics.account_owner_user_id
  left join lateral (
    select count(*) as total
    from public.clinic_memberships
    where clinic_memberships.clinic_id = clinics.id
      and clinic_memberships.is_active = true
      and clinic_memberships.membership_status = 'active'
  ) membership_counts on true
  left join lateral (
    select count(*) as total, max(updated_at) as last_activity_at
    from public.patients
    where patients.clinic_id = clinics.id
  ) patient_counts on true
  left join lateral (
    select count(*) as total, max(updated_at) as last_activity_at
    from public.sessions
    where sessions.clinic_id = clinics.id
  ) session_counts on true
  left join lateral (
    select count(*) as total
    from public.feature_flags
    where feature_flags.clinic_id = clinics.id
      and coalesce(feature_flags.starts_at, '-infinity'::timestamptz) <= now()
      and coalesce(feature_flags.expires_at, 'infinity'::timestamptz) > now()
  ) flag_counts on true
  where public.is_platform_owner_mfa_verified(auth.uid())
  order by clinics.updated_at desc nulls last, clinics.created_at desc
$$;


ALTER FUNCTION "public"."list_platform_clinics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_platform_directory"("_query" "text" DEFAULT NULL::"text", "_kind" "text" DEFAULT 'all'::"text", "_limit" integer DEFAULT 80) RETURNS TABLE("item_type" "text", "item_id" "uuid", "clinic_id" "uuid", "clinic_name" "text", "title" "text", "subtitle" "text", "primary_document" "text", "secondary_document" "text", "status" "text", "metadata" "jsonb", "updated_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT * FROM public.list_platform_directory(_query, _kind, 'all', null, _limit);
$$;


ALTER FUNCTION "public"."list_platform_directory"("_query" "text", "_kind" "text", "_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_platform_directory"("_query" "text" DEFAULT NULL::"text", "_kind" "text" DEFAULT 'all'::"text", "_status" "text" DEFAULT 'all'::"text", "_tag_id" "uuid" DEFAULT NULL::"uuid", "_limit" integer DEFAULT 80) RETURNS TABLE("item_type" "text", "item_id" "uuid", "clinic_id" "uuid", "clinic_name" "text", "title" "text", "subtitle" "text", "primary_document" "text", "secondary_document" "text", "status" "text", "metadata" "jsonb", "updated_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  WITH input AS (
    SELECT
      nullif(trim(coalesce(_query, '')), '') AS raw_query,
      public.platform_normalize_search(_query) AS normalized_query,
      CASE
        WHEN _kind IN ('clinic', 'account', 'owner', 'patient', 'pending_account') THEN _kind
        ELSE 'all'
      END AS kind,
      CASE
        WHEN _status IN ('active', 'pending', 'expiring_soon', 'expired', 'banned', 'paused') THEN _status
        ELSE 'all'
      END AS status_filter,
      _tag_id AS tag_id,
      least(greatest(coalesce(_limit, 80), 1), 200) AS row_limit
  ),
  clinics_rows AS (
    SELECT
      'clinic'::text AS item_type,
      clinics.id AS item_id,
      clinics.id AS clinic_id,
      clinics.name AS clinic_name,
      clinics.name AS title,
      coalesce(clinics.legal_name, clinics.email, 'Clínica sem razão social') AS subtitle,
      clinics.cnpj AS primary_document,
      owner_profile.email AS secondary_document,
      CASE
        WHEN clinics.access_status = 'banned' THEN 'banned'
        WHEN clinics.access_status = 'temporarily_paused' THEN 'paused'
        WHEN sub.expires_at IS NOT NULL AND sub.expires_at < now() THEN 'expired'
        WHEN sub.expires_at IS NOT NULL AND sub.expires_at <= now() + interval '7 days' THEN 'expiring_soon'
        WHEN clinics.access_status = 'payment_pending' THEN 'pending'
        ELSE coalesce(clinics.access_status, 'active')
      END AS status,
      jsonb_build_object(
        'route_key', clinics.route_key,
        'owner_user_id', clinics.account_owner_user_id,
        'owner_name', owner_profile.full_name,
        'owner_email', owner_profile.email,
        'team_count', coalesce(membership_counts.total, 0),
        'patients_count', coalesce(patient_counts.total, 0),
        'sessions_count', coalesce(session_counts.total, 0),
        'flags_count', coalesce(flag_counts.total, 0),
        'subaccount_limit', clinics.subaccount_limit,
        'access_status', clinics.access_status,
        'subscription_plan', clinics.subscription_plan,
        'expires_at', sub.expires_at,
        'concurrent_access_limit', CASE
          WHEN clinics.subscription_plan = 'solo' THEN 1
          ELSE greatest(clinics.subaccount_limit, 4)
        END
      ) AS metadata,
      clinics.updated_at
    FROM public.clinics
    LEFT JOIN public.profiles owner_profile ON owner_profile.id = clinics.account_owner_user_id
    LEFT JOIN public.clinic_subscriptions sub ON sub.clinic_id = clinics.id
    LEFT JOIN LATERAL (
      SELECT count(*)::integer AS total
      FROM public.clinic_memberships
      WHERE clinic_memberships.clinic_id = clinics.id
        AND clinic_memberships.is_active = true
        AND clinic_memberships.membership_status = 'active'
    ) membership_counts ON true
    LEFT JOIN LATERAL (
      SELECT count(*)::integer AS total
      FROM public.patients
      WHERE patients.clinic_id = clinics.id
    ) patient_counts ON true
    LEFT JOIN LATERAL (
      SELECT count(*)::integer AS total
      FROM public.sessions
      WHERE sessions.clinic_id = clinics.id
    ) session_counts ON true
    LEFT JOIN LATERAL (
      SELECT count(*)::integer AS total
      FROM public.feature_flags
      WHERE feature_flags.clinic_id = clinics.id
        AND feature_flags.scope = 'clinic'
    ) flag_counts ON true
    CROSS JOIN input
    WHERE public.is_platform_owner_mfa_verified(auth.uid())
      AND input.kind IN ('all', 'clinic')
      AND (input.tag_id IS NULL OR EXISTS (
        SELECT 1 FROM public.clinic_tag_relations ctr
        WHERE ctr.clinic_id = clinics.id AND ctr.tag_id = input.tag_id
      ))
      AND (
        input.raw_query IS NULL
        OR public.platform_normalize_search(clinics.name || ' ' || clinics.cnpj || ' ' || coalesce(clinics.legal_name, '') || ' ' || coalesce(owner_profile.email, '') || ' ' || coalesce(owner_profile.full_name, '')) LIKE '%' || input.normalized_query || '%'
      )
  ),
  account_rows AS (
    SELECT
      'account'::text AS item_type,
      profiles.id AS item_id,
      user_clinics.primary_clinic_id AS clinic_id,
      coalesce(user_clinics.primary_clinic_name, 'Conta Pessoal / Sem clínica') AS clinic_name,
      coalesce(profiles.full_name, profiles.email, 'Conta sem nome') AS title,
      coalesce(profiles.email, profiles.phone, 'Sem contato principal') AS subtitle,
      profiles.cpf AS primary_document,
      profiles.phone AS secondary_document,
      CASE
        WHEN user_clinics.has_banned THEN 'banned'
        WHEN user_clinics.has_paused THEN 'paused'
        WHEN user_clinics.has_expired THEN 'expired'
        WHEN user_clinics.has_expiring_soon THEN 'expiring_soon'
        WHEN user_clinics.clinics_count = 0 THEN 'personal'
        ELSE 'active'
      END AS status,
      jsonb_build_object(
        'email', profiles.email,
        'phone', profiles.phone,
        'birth_date', profiles.birth_date,
        'age', CASE
          WHEN profiles.birth_date IS NULL THEN NULL
          ELSE extract(year FROM age(current_date, profiles.birth_date))::integer
        END,
        'job_title', profiles.job_title,
        'account_role', CASE WHEN user_clinics.is_owner THEN 'account_owner' ELSE 'user' END,
        'operational_role', coalesce(user_clinics.primary_operational_role, 'professional'),
        'is_active', true,
        'is_pending_registration', false,
        'is_owner', user_clinics.is_owner,
        'clinics_count', user_clinics.clinics_count,
        'clinics', user_clinics.clinics_list,
        'joined_at', user_clinics.first_joined_at
      ) AS metadata,
      greatest(profiles.last_seen_at, profiles.updated_at, user_clinics.latest_update) AS updated_at
    FROM public.profiles
    LEFT JOIN LATERAL (
      SELECT
        count(c.id)::integer AS clinics_count,
        bool_or(m.account_role = 'account_owner' OR c.account_owner_user_id = profiles.id) AS is_owner,
        bool_or(c.access_status = 'banned' OR m.membership_status::text IN ('suspended', 'blocked')) AS has_banned,
        bool_or(c.access_status = 'temporarily_paused' OR m.membership_status::text IN ('inactive', 'paused')) AS has_paused,
        bool_or(sub.expires_at IS NOT NULL AND sub.expires_at < now()) AS has_expired,
        bool_or(sub.expires_at IS NOT NULL AND sub.expires_at <= now() + interval '7 days' AND sub.expires_at >= now()) AS has_expiring_soon,
        min(m.joined_at) AS first_joined_at,
        max(greatest(m.updated_at, c.updated_at)) AS latest_update,
        (
          SELECT c_sub.id FROM public.clinic_memberships m_sub
          JOIN public.clinics c_sub ON c_sub.id = m_sub.clinic_id
          WHERE m_sub.user_id = profiles.id
          ORDER BY (m_sub.account_role = 'account_owner' OR c_sub.account_owner_user_id = profiles.id) DESC, m_sub.created_at ASC
          LIMIT 1
        ) AS primary_clinic_id,
        (
          SELECT c_sub.name FROM public.clinic_memberships m_sub
          JOIN public.clinics c_sub ON c_sub.id = m_sub.clinic_id
          WHERE m_sub.user_id = profiles.id
          ORDER BY (m_sub.account_role = 'account_owner' OR c_sub.account_owner_user_id = profiles.id) DESC, m_sub.created_at ASC
          LIMIT 1
        ) AS primary_clinic_name,
        (
          SELECT m_sub.operational_role::text FROM public.clinic_memberships m_sub
          WHERE m_sub.user_id = profiles.id
          ORDER BY (m_sub.account_role = 'account_owner') DESC, m_sub.created_at ASC
          LIMIT 1
        ) AS primary_operational_role,
        coalesce(jsonb_agg(
          jsonb_build_object(
            'clinic_id', c.id,
            'clinic_name', c.name,
            'route_key', c.route_key,
            'account_role', m.account_role,
            'is_owner', (m.account_role = 'account_owner' OR c.account_owner_user_id = profiles.id),
            'status', c.access_status
          ) ORDER BY (m.account_role = 'account_owner' OR c.account_owner_user_id = profiles.id) DESC, c.name ASC
        ) FILTER (WHERE c.id IS NOT NULL), '[]'::jsonb) AS clinics_list
      FROM public.clinic_memberships m
      JOIN public.clinics c ON c.id = m.clinic_id
      LEFT JOIN public.clinic_subscriptions sub ON sub.clinic_id = c.id
      WHERE m.user_id = profiles.id
    ) user_clinics ON true
    CROSS JOIN input
    WHERE public.is_platform_owner_mfa_verified(auth.uid())
      AND (
        (input.kind = 'all')
        OR (input.kind = 'account' AND (user_clinics.is_owner IS NULL OR user_clinics.is_owner = false))
        OR (input.kind = 'owner' AND user_clinics.is_owner = true)
      )
      AND (input.tag_id IS NULL OR EXISTS (
        SELECT 1 FROM public.clinic_memberships m_tag
        JOIN public.clinic_tag_relations ctr ON ctr.clinic_id = m_tag.clinic_id
        WHERE m_tag.user_id = profiles.id AND ctr.tag_id = input.tag_id
      ))
      AND (
        input.raw_query IS NULL
        OR public.platform_normalize_search(coalesce(profiles.full_name, '') || ' ' || coalesce(profiles.email, '') || ' ' || coalesce(profiles.cpf, '') || ' ' || coalesce(profiles.phone, '') || ' ' || coalesce(profiles.job_title, '') || ' ' || coalesce(user_clinics.primary_clinic_name, '')) LIKE '%' || input.normalized_query || '%'
        OR (profiles.birth_date IS NOT NULL AND extract(year FROM age(current_date, profiles.birth_date))::integer::text = input.raw_query)
      )
  ),
  pending_account_rows AS (
    SELECT
      'account'::text AS item_type,
      COALESCE(u.id, i.id) AS item_id,
      i.clinic_id,
      clinics.name AS clinic_name,
      COALESCE(p.full_name, i.email, 'Colaborador convidado') AS title,
      i.email AS subtitle,
      COALESCE(p.cpf, 'Cadastro incompleto') AS primary_document,
      COALESCE(p.phone, i.job_title, 'Sem telefone') AS secondary_document,
      'pending' AS status,
      jsonb_build_object(
        'email', i.email,
        'phone', p.phone,
        'invitation_id', i.id,
        'user_id', u.id,
        'job_title', i.job_title,
        'specialty', i.specialty,
        'operational_role', i.operational_role,
        'is_active', false,
        'is_pending_registration', true,
        'last_resent_at', i.last_resent_at,
        'created_at', i.created_at,
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
      ) AS metadata,
      COALESCE(i.last_resent_at, i.updated_at, i.created_at) AS updated_at
    FROM public.clinic_collaborator_invitations i
    LEFT JOIN public.clinics ON clinics.id = i.clinic_id
    LEFT JOIN auth.users u ON lower(u.email) = lower(i.email)
    LEFT JOIN public.profiles p ON p.id = u.id
    CROSS JOIN input
    WHERE public.is_platform_owner_mfa_verified(auth.uid())
      AND i.status = 'pending'
      AND input.kind IN ('all', 'account', 'pending_account')
      AND (input.tag_id IS NULL OR (i.clinic_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.clinic_tag_relations ctr
        WHERE ctr.clinic_id = i.clinic_id AND ctr.tag_id = input.tag_id
      )))
      AND (
        input.raw_query IS NULL
        OR public.platform_normalize_search(i.email || ' ' || coalesce(p.full_name, '') || ' ' || coalesce(i.job_title, '') || ' ' || coalesce(clinics.name, '')) LIKE '%' || input.normalized_query || '%'
      )
  ),
  orphan_auth_users AS (
    SELECT
      'account'::text AS item_type,
      u.id AS item_id,
      NULL::uuid AS clinic_id,
      'Cadastro sem perfil'::text AS clinic_name,
      coalesce(u.raw_user_meta_data->>'full_name', u.email, 'Usuário pendente') AS title,
      u.email AS subtitle,
      coalesce(u.raw_user_meta_data->>'cpf', 'Sem CPF no perfil') AS primary_document,
      coalesce(u.raw_user_meta_data->>'phone', 'Sem telefone') AS secondary_document,
      'pending' AS status,
      jsonb_build_object(
        'email', u.email,
        'user_id', u.id,
        'is_active', false,
        'is_pending_registration', true,
        'account_state', CASE WHEN u.email_confirmed_at IS NULL THEN 'registered_unconfirmed' ELSE 'registered_confirmed' END,
        'pending_reason', 'Usuário registrado no Auth sem perfil completo finalizado.'
      ) AS metadata,
      u.created_at AS updated_at
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    CROSS JOIN input
    WHERE public.is_platform_owner_mfa_verified(auth.uid())
      AND p.id IS NULL
      AND input.kind IN ('all', 'account', 'pending_account')
      AND input.tag_id IS NULL
      AND (
        input.raw_query IS NULL
        OR public.platform_normalize_search(u.email || ' ' || coalesce(u.raw_user_meta_data->>'full_name', '') || ' ' || coalesce(u.raw_user_meta_data->>'cpf', '')) LIKE '%' || input.normalized_query || '%'
      )
  ),
  patient_rows AS (
    SELECT
      'patient'::text AS item_type,
      patients.id AS item_id,
      patients.clinic_id,
      clinics.name AS clinic_name,
      patients.name AS title,
      coalesce(patients.email, patients.phone, 'Paciente sem contato principal') AS subtitle,
      patients.cpf AS primary_document,
      patients.rg AS secondary_document,
      patients.status AS status,
      jsonb_build_object(
        'age', coalesce(patients.age, CASE WHEN patients.date_of_birth IS NULL THEN NULL ELSE extract(year FROM age(current_date, patients.date_of_birth))::integer END),
        'phone', patients.phone,
        'email', patients.email,
        'rg', patients.rg,
        'date_of_birth', patients.date_of_birth,
        'gender', patients.gender,
        'pronoun', patients.pronoun,
        'profession', patients.profession,
        'origin_type', patients.origin_type,
        'blood_type', patients.blood_type,
        'city', patients.city,
        'state', patients.state,
        'registration_complete', patients.registration_complete
      ) AS metadata,
      patients.updated_at
    FROM public.patients
    JOIN public.clinics ON clinics.id = patients.clinic_id
    CROSS JOIN input
    WHERE public.is_platform_owner_mfa_verified(auth.uid())
      AND input.kind IN ('all', 'patient')
      AND (input.tag_id IS NULL OR EXISTS (
        SELECT 1 FROM public.clinic_tag_relations ctr
        WHERE ctr.clinic_id = clinics.id AND ctr.tag_id = input.tag_id
      ))
      AND (
        input.raw_query IS NULL
        OR public.platform_normalize_search(patients.name || ' ' || coalesce(patients.cpf, '') || ' ' || coalesce(patients.rg, '') || ' ' || coalesce(patients.email, '') || ' ' || coalesce(patients.phone, '') || ' ' || clinics.name) LIKE '%' || input.normalized_query || '%'
        OR (patients.age IS NOT NULL AND patients.age::text = input.raw_query)
        OR (patients.date_of_birth IS NOT NULL AND extract(year FROM age(current_date, patients.date_of_birth))::integer::text = input.raw_query)
      )
  ),
  combined_results AS (
    SELECT * FROM clinics_rows
    UNION ALL
    SELECT * FROM account_rows
    UNION ALL
    SELECT * FROM pending_account_rows
    UNION ALL
    SELECT * FROM orphan_auth_users
    UNION ALL
    SELECT * FROM patient_rows
  )
  SELECT
    combined_results.item_type,
    combined_results.item_id,
    combined_results.clinic_id,
    combined_results.clinic_name,
    combined_results.title,
    combined_results.subtitle,
    combined_results.primary_document,
    combined_results.secondary_document,
    combined_results.status,
    combined_results.metadata,
    combined_results.updated_at
  FROM combined_results
  CROSS JOIN input
  WHERE (
    input.status_filter = 'all'
    OR (input.status_filter = 'active' AND combined_results.status IN ('active', 'Ativo', 'Ativa', 'personal'))
    OR (input.status_filter = 'pending' AND (combined_results.status IN ('pending', 'pending_invite', 'unconfirmed_email', 'pending_login') OR (combined_results.metadata->>'is_pending_registration')::boolean = true))
    OR (input.status_filter = 'expiring_soon' AND combined_results.status = 'expiring_soon')
    OR (input.status_filter = 'expired' AND combined_results.status = 'expired')
    OR (input.status_filter = 'banned' AND combined_results.status IN ('banned', 'blocked'))
    OR (input.status_filter = 'paused' AND combined_results.status IN ('paused', 'temporarily_paused'))
  )
  ORDER BY combined_results.updated_at DESC
  LIMIT (SELECT row_limit FROM input);
$$;


ALTER FUNCTION "public"."list_platform_directory"("_query" "text", "_kind" "text", "_status" "text", "_tag_id" "uuid", "_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_platform_telemetry_events"("_clinic_id" "uuid", "_limit" integer DEFAULT 100) RETURNS TABLE("id" "uuid", "clinic_id" "uuid", "user_id" "uuid", "user_name" "text", "event_type" "text", "pathname" "text", "resource_type" "text", "resource_id" "text", "metadata" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
BEGIN
  -- Verify caller is platform owner
  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Acesso negado. Apenas o Backoffice Master pode visualizar eventos de telemetria.';
  END IF;

  RETURN QUERY
  SELECT 
    t.id,
    t.clinic_id,
    t.user_id,
    t.user_name,
    t.event_type,
    t.pathname,
    t.resource_type,
    t.resource_id,
    t.metadata,
    t.created_at
  FROM public.telemetry_events t
  WHERE t.clinic_id = _clinic_id
  ORDER BY t.created_at DESC
  LIMIT LEAST(_limit, 500);
END;
$$;


ALTER FUNCTION "public"."list_platform_telemetry_events"("_clinic_id" "uuid", "_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_platform_user_telemetry_events"("_user_id" "uuid", "_limit" integer DEFAULT 100) RETURNS TABLE("id" "uuid", "clinic_id" "uuid", "user_id" "uuid", "user_name" "text", "event_type" "text", "pathname" "text", "resource_type" "text", "resource_id" "text", "metadata" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
BEGIN
  -- Verify caller is platform owner
  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Acesso negado. Apenas o Backoffice Master pode visualizar estatísticas individuais de usuários.';
  END IF;

  RETURN QUERY
  SELECT 
    t.id,
    t.clinic_id,
    t.user_id,
    t.user_name,
    t.event_type,
    t.pathname,
    t.resource_type,
    t.resource_id,
    t.metadata,
    t.created_at
  FROM public.telemetry_events t
  WHERE t.user_id = _user_id
  ORDER BY t.created_at DESC
  LIMIT LEAST(_limit, 500);
END;
$$;


ALTER FUNCTION "public"."list_platform_user_telemetry_events"("_user_id" "uuid", "_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_platform_audit_event"("_event_type" "text", "_clinic_id" "uuid" DEFAULT NULL::"uuid", "_reason" "text" DEFAULT NULL::"text", "_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  _user_id uuid := auth.uid();
  _role public.platform_admin_role;
  _event_id uuid;
begin
  if _user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  select public.get_current_platform_role() into _role;

  if _role is null then
    raise exception 'Acesso de plataforma indisponivel.';
  end if;

  insert into public.platform_audit_events (
    actor_user_id,
    actor_platform_role,
    clinic_id,
    event_type,
    reason,
    metadata
  )
  values (
    _user_id,
    _role,
    _clinic_id,
    left(btrim(_event_type), 120),
    nullif(left(coalesce(_reason, ''), 1000), ''),
    coalesce(_metadata, '{}'::jsonb)
  )
  returning id into _event_id;

  update public.platform_admins
  set last_used_at = now()
  where user_id = _user_id;

  return _event_id;
end;
$$;


ALTER FUNCTION "public"."log_platform_audit_event"("_event_type" "text", "_clinic_id" "uuid", "_reason" "text", "_metadata" "jsonb") OWNER TO "postgres";


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

  IF (position('@' in _trimmed) = 0 AND _clean_digits <> '') THEN
    IF length(_clean_digits) <> 11 THEN
      RETURN jsonb_build_object('status', 'invalid_cpf');
    END IF;

    SELECT p.id, p.email, p.cpf
    INTO _profile_user_id, _user_email, _profile_cpf
    FROM public.profiles p
    WHERE regexp_replace(coalesce(p.cpf, ''), '\D', '', 'g') = _clean_digits
    LIMIT 1;

    IF _profile_user_id IS NULL THEN
      RETURN jsonb_build_object('status', 'cpf_not_found');
    END IF;

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
    _user_email := lower(_trimmed);

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


ALTER FUNCTION "public"."request_account_recovery_status"("_identifier" "text") OWNER TO "postgres";


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


ALTER FUNCTION "public"."complete_unregistered_cpf_profile"("_full_name" "text", "_cpf" "text", "_phone" "text", "_birth_date" "date") OWNER TO "postgres";


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


ALTER FUNCTION "public"."log_security_event"("_clinic_id" "uuid", "_actor_user_id" "uuid", "_target_user_id" "uuid", "_event_type" "text", "_visibility_scope" "text", "_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_session_edit_history"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.session_edit_history (
      session_id,
      clinic_id,
      editor_user_id
    )
    VALUES (
      NEW.id,
      NEW.clinic_id,
      auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_session_edit_history"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."manage_clinic_subscription_plan"("_clinic_id" "uuid", "_new_plan" "public"."subscription_plan", "_billing_cycle" "text" DEFAULT 'annual'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_current_user_id uuid := auth.uid();
  v_active_subaccounts_count integer;
  v_owner_user_id uuid;
  v_sub_record public.clinic_subscriptions%ROWTYPE;
  v_cycle text := LOWER(coalesce(_billing_cycle, 'annual'));
  v_base_price numeric(10,2);
  v_extra_price numeric(10,2);
  v_base_subaccounts integer;
  v_base_concurrent integer;
  v_current_extra_seats integer := 0;
BEGIN
  IF NOT public.is_clinic_subscription_manager(v_current_user_id, _clinic_id) THEN
    RAISE EXCEPTION 'Acesso negado: apenas o responsável pela clínica (account_owner) pode alterar o plano.';
  END IF;

  SELECT account_owner_user_id INTO v_owner_user_id
  FROM public.clinics
  WHERE id = _clinic_id;

  v_owner_user_id := coalesce(v_owner_user_id, v_current_user_id);

  -- Validação no Downgrade para Solo: Não pode ter colaboradores ativos cadastrados
  IF _new_plan = 'solo' THEN
    SELECT COUNT(*)::integer INTO v_active_subaccounts_count
    FROM public.clinic_memberships
    WHERE clinic_id = _clinic_id
      AND is_active = true
      AND membership_status = 'active'
      AND account_role NOT IN ('account_owner', 'owner');

    IF v_active_subaccounts_count > 0 THEN
      RAISE EXCEPTION 'Não é possível alterar para o plano Solo enquanto houver % colaborador(es) ativo(s) cadastrado(s). Desative ou remova os colaboradores primeiro.', v_active_subaccounts_count;
    END IF;
  END IF;

  -- Matriz Oficial de Preços e Cotas
  IF _new_plan = 'solo' THEN
    v_base_price := CASE
      WHEN v_cycle = 'monthly' THEN 59.00
      WHEN v_cycle = 'quarterly' THEN 53.00
      ELSE 44.00
    END;
    v_extra_price := 35.00;
    v_base_subaccounts := 1;
    v_base_concurrent := 1;
    v_current_extra_seats := 0;
  ELSIF _new_plan = 'enterprise' THEN
    v_base_price := CASE
      WHEN v_cycle = 'monthly' THEN 299.00
      WHEN v_cycle = 'quarterly' THEN 269.00
      ELSE 224.00
    END;
    v_extra_price := 15.00;
    v_base_subaccounts := 100;
    v_base_concurrent := 10;

    SELECT additional_concurrent_access_count INTO v_current_extra_seats
    FROM public.clinic_subscriptions
    WHERE clinic_id = _clinic_id;

    v_current_extra_seats := coalesce(v_current_extra_seats, 0);
  ELSE -- 'clinic'
    v_base_price := CASE
      WHEN v_cycle = 'monthly' THEN 139.00
      WHEN v_cycle = 'quarterly' THEN 125.00
      ELSE 104.00
    END;
    v_extra_price := 25.00;
    v_base_subaccounts := 30;
    v_base_concurrent := 4;

    SELECT additional_concurrent_access_count INTO v_current_extra_seats
    FROM public.clinic_subscriptions
    WHERE clinic_id = _clinic_id;

    v_current_extra_seats := coalesce(v_current_extra_seats, 0);
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
    plan_type = EXCLUDED.plan_type,
    billing_cycle = EXCLUDED.billing_cycle,
    base_monthly_price = EXCLUDED.base_monthly_price,
    base_subaccount_limit = EXCLUDED.base_subaccount_limit,
    base_concurrent_access_count = EXCLUDED.base_concurrent_access_count,
    additional_concurrent_access_count = CASE WHEN EXCLUDED.plan_type = 'solo' THEN 0 ELSE clinic_subscriptions.additional_concurrent_access_count END,
    additional_concurrent_access_price = EXCLUDED.additional_concurrent_access_price,
    total_recurring_monthly_price = EXCLUDED.base_monthly_price + (
      CASE WHEN EXCLUDED.plan_type = 'solo' THEN 0 ELSE clinic_subscriptions.additional_concurrent_access_count END * EXCLUDED.additional_concurrent_access_price
    ),
    updated_at = now()
  RETURNING * INTO v_sub_record;

  RETURN jsonb_build_object(
    'success', true,
    'clinic_id', _clinic_id,
    'plan_type', v_sub_record.plan_type,
    'billing_cycle', v_sub_record.billing_cycle,
    'base_subaccount_limit', v_sub_record.base_subaccount_limit,
    'base_concurrent_access_count', v_sub_record.base_concurrent_access_count,
    'total_recurring_monthly_price', v_sub_record.total_recurring_monthly_price
  );
END;
$$;


ALTER FUNCTION "public"."manage_clinic_subscription_plan"("_clinic_id" "uuid", "_new_plan" "public"."subscription_plan", "_billing_cycle" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_patient_name_key"("_value" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT lower(regexp_replace(translate(
    coalesce(_value, ''),
    'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
  ), '[^[:alnum:]]+', '', 'g'));
$$;


ALTER FUNCTION "public"."normalize_patient_name_key"("_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notification_category_enabled"("_preferences" "public"."notification_preferences", "_category" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."notification_category_enabled"("_preferences" "public"."notification_preferences", "_category" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_clinic_access_session_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."notify_clinic_access_session_created"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."notify_clinic_collaborator_presence"("_clinic_id" "uuid", "_user_id" "uuid", "_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_session_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."notify_session_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."platform_create_clinic"("_name" "text", "_cnpj" "text", "_subscription_plan" "public"."subscription_plan" DEFAULT 'clinic'::"public"."subscription_plan", "_subaccount_limit" integer DEFAULT 4, "_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  _clinic public.clinics%rowtype;
  _clean_name text := nullif(trim(coalesce(_name, '')), '');
  _clean_cnpj text := nullif(trim(coalesce(_cnpj, '')), '');
  _clean_reason text := nullif(trim(coalesce(_reason, '')), '');
begin
  if not public.is_platform_owner_mfa_verified(auth.uid()) then
    raise exception 'Acesso negado ao painel global.';
  end if;

  if _clean_name is null or char_length(_clean_name) < 3 or char_length(_clean_name) > 120 then
    raise exception 'Informe um nome de clinica entre 3 e 120 caracteres.';
  end if;

  if _clean_cnpj is null or char_length(regexp_replace(_clean_cnpj, '[^0-9]', '', 'g')) not in (11, 14) then
    raise exception 'Informe um CPF/CNPJ administrativo valido para iniciar a clinica.';
  end if;

  insert into public.clinics (name, cnpj, subscription_plan, subaccount_limit)
  values (
    _clean_name,
    _clean_cnpj,
    coalesce(_subscription_plan, 'clinic'),
    least(greatest(coalesce(_subaccount_limit, 4), 0), 200)
  )
  returning * into _clinic;

  perform public.log_platform_audit_event(
    'platform_clinic_created',
    _clinic.id,
    _clean_reason,
    jsonb_build_object(
      'clinic_id', _clinic.id,
      'clinic_name', _clinic.name,
      'subscription_plan', _clinic.subscription_plan,
      'subaccount_limit', _clinic.subaccount_limit
    )
  );

  return jsonb_build_object(
    'clinic_id', _clinic.id,
    'route_key', _clinic.route_key,
    'name', _clinic.name
  );
end;
$$;


ALTER FUNCTION "public"."platform_create_clinic"("_name" "text", "_cnpj" "text", "_subscription_plan" "public"."subscription_plan", "_subaccount_limit" integer, "_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."platform_normalize_search"("_value" "text") RETURNS "text"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select lower(regexp_replace(coalesce(_value, ''), '[^[:alnum:]]+', '', 'g'));
$$;


ALTER FUNCTION "public"."platform_normalize_search"("_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."platform_override_clinic_subscription"("_clinic_id" "uuid", "_new_plan" "public"."subscription_plan" DEFAULT NULL::"public"."subscription_plan", "_status" "text" DEFAULT NULL::"text", "_subaccount_limit" integer DEFAULT NULL::integer, "_concurrent_access_limit" integer DEFAULT NULL::integer, "_next_due_date" "date" DEFAULT NULL::"date", "_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_caller_id uuid := auth.uid();
  v_is_platform_admin boolean;
  v_sub_record public.clinic_subscriptions%rowtype;
  v_owner_id uuid;
begin
  -- Exige permissão de Administrador da Plataforma
  select exists (
    select 1 from public.platform_admins
    where user_id = v_caller_id and is_active = true
  ) into v_is_platform_admin;

  if not v_is_platform_admin then
    raise exception 'Acesso negado: apenas administradores da plataforma podem realizar overrides operacionais.';
  end if;

  if _reason is null or trim(_reason) = '' then
    raise exception 'Justificativa (motivo) é obrigatória para realizar override de assinatura.';
  end if;

  -- Busca owner da clínica
  select account_owner_user_id into v_owner_id from public.clinics where id = _clinic_id;
  v_owner_id := coalesce(v_owner_id, v_caller_id);

  -- Garante registro de assinatura
  select * into v_sub_record from public.clinic_subscriptions where clinic_id = _clinic_id;
  if v_sub_record.id is null then
    insert into public.clinic_subscriptions (
      clinic_id, account_owner_user_id, plan_type, base_monthly_price,
      base_subaccount_limit, base_concurrent_access_count, status
    )
    values (
      _clinic_id, v_owner_id, coalesce(_new_plan, 'clinic'),
      case when coalesce(_new_plan, 'clinic') = 'solo' then 50.00 else 60.00 end,
      case when coalesce(_new_plan, 'clinic') = 'solo' then 1 else 30 end,
      case when coalesce(_new_plan, 'clinic') = 'solo' then 1 else 2 end,
      coalesce(_status, 'ACTIVE')
    )
    returning * into v_sub_record;
  end if;

  update public.clinic_subscriptions
  set
    plan_type = coalesce(_new_plan, plan_type),
    status = coalesce(_status, status),
    base_subaccount_limit = coalesce(_subaccount_limit, base_subaccount_limit),
    additional_concurrent_access_count = case
      when _concurrent_access_limit is not null then greatest(0, _concurrent_access_limit - base_concurrent_access_count)
      else additional_concurrent_access_count
    end,
    next_due_date = coalesce(_next_due_date, next_due_date),
    override_reason = trim(_reason),
    override_by_user_id = v_caller_id,
    override_at = now(),
    updated_at = now()
  where clinic_id = _clinic_id
  returning * into v_sub_record;

  return jsonb_build_object(
    'success', true,
    'clinic_id', _clinic_id,
    'plan_type', v_sub_record.plan_type,
    'status', v_sub_record.status,
    'subaccount_limit', v_sub_record.base_subaccount_limit + v_sub_record.purchased_subaccount_extra_count,
    'concurrent_access_limit', v_sub_record.base_concurrent_access_count + v_sub_record.additional_concurrent_access_count,
    'next_due_date', v_sub_record.next_due_date,
    'override_reason', v_sub_record.override_reason,
    'override_at', v_sub_record.override_at
  );
end;
$$;


ALTER FUNCTION "public"."platform_override_clinic_subscription"("_clinic_id" "uuid", "_new_plan" "public"."subscription_plan", "_status" "text", "_subaccount_limit" integer, "_concurrent_access_limit" integer, "_next_due_date" "date", "_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_default_patient_group_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF (OLD.is_default OR OLD.group_kind IN ('default', 'cancelados'))
    AND EXISTS (
      SELECT 1
      FROM public.patients
      WHERE id = OLD.patient_id
    ) THEN
    RAISE EXCEPTION 'Os grupos reservados do paciente não podem ser excluídos.';
  END IF;

  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."prevent_default_patient_group_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."raise_exception_json"("_message" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    AS $$
begin
  raise exception '%', _message;
end;
$$;


ALTER FUNCTION "public"."raise_exception_json"("_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_asaas_webhook_event"("_event_id" "text", "_event_type" "text", "_payload" "jsonb", "_signature" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_existing public.asaas_webhook_events%ROWTYPE;
  v_event_id uuid;
BEGIN
  -- Verificar se o evento já foi registrado
  SELECT * INTO v_existing
  FROM public.asaas_webhook_events
  WHERE asaas_event_id = _event_id;

  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'already_processed', coalesce(v_existing.processed, false),
      'event_id', v_existing.id,
      'status', 'EXISTING'
    );
  END IF;

  -- Inserir novo evento
  INSERT INTO public.asaas_webhook_events (
    asaas_event_id,
    event_type,
    payload,
    signature,
    processed,
    created_at
  )
  VALUES (
    _event_id,
    _event_type,
    _payload,
    _signature,
    false,
    now()
  )
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'already_processed', false,
    'event_id', v_event_id,
    'status', 'INSERTED'
  );
END;
$$;


ALTER FUNCTION "public"."record_asaas_webhook_event"("_event_id" "text", "_event_type" "text", "_payload" "jsonb", "_signature" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."register_current_security_session"("_session_key" "text", "_browser" "text" DEFAULT NULL::"text", "_platform" "text" DEFAULT NULL::"text", "_device_label" "text" DEFAULT NULL::"text", "_user_agent" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _clinic_id uuid := public.get_user_clinic_id(_user_id);
  _existing_row public.user_security_sessions%ROWTYPE;
  _reactivated boolean := false;
  _is_different_device boolean := false;
  _should_notify boolean := false;
  _was_offline boolean := false;
  _normalized_device_label text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  IF NULLIF(trim(COALESCE(_session_key, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Sessao invalida.';
  END IF;

  PERFORM public.cleanup_user_security_sessions(_user_id);

  _normalized_device_label := COALESCE(
    NULLIF(trim(_device_label), ''),
    NULLIF(trim(CONCAT_WS(' • ', NULLIF(trim(_browser), ''), NULLIF(trim(_platform), ''))), ''),
    'Dispositivo desconhecido'
  );

  SELECT *
  INTO _existing_row
  FROM public.user_security_sessions
  WHERE session_key = _session_key
  LIMIT 1;

  IF FOUND AND _existing_row.user_id <> _user_id THEN
    RAISE EXCEPTION 'Sessao invalida.';
  END IF;

  IF FOUND AND _existing_row.force_signed_out_at IS NOT NULL THEN
    RAISE EXCEPTION 'Sessao encerrada pela administracao da clinica. Entre novamente para continuar.';
  END IF;

  IF NOT FOUND THEN
    BEGIN
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
        _normalized_device_label,
        NULLIF(trim(_user_agent), '')
      )
      RETURNING * INTO _existing_row;

      _reactivated := true;
    EXCEPTION
      WHEN unique_violation THEN
        SELECT *
        INTO _existing_row
        FROM public.user_security_sessions
        WHERE session_key = _session_key
        LIMIT 1;

        IF NOT FOUND OR _existing_row.user_id <> _user_id THEN
          RAISE EXCEPTION 'Sessao invalida.';
        END IF;

        _reactivated := _existing_row.ended_at IS NOT NULL;
    END;
  ELSE
    _reactivated := _existing_row.ended_at IS NOT NULL;
  END IF;

  -- Atualizar a sessão atual
  UPDATE public.user_security_sessions
  SET
    clinic_id = COALESCE(_clinic_id, clinic_id),
    browser = COALESCE(NULLIF(trim(_browser), ''), browser),
    platform = COALESCE(NULLIF(trim(_platform), ''), platform),
    device_label = COALESCE(_normalized_device_label, device_label),
    user_agent = COALESCE(NULLIF(trim(_user_agent), ''), user_agent),
    signed_in_at = CASE WHEN _reactivated THEN now() ELSE signed_in_at END,
    ended_at = NULL,
    force_signed_out_at = NULL,
    forced_out_by = NULL,
    last_seen_at = now(),
    updated_at = now()
  WHERE id = _existing_row.id
  RETURNING * INTO _existing_row;

  -- 1. Alerta de Segurança: Notificar APENAS se for login em NOVO / OUTRO dispositivo
  IF _reactivated THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_security_sessions
      WHERE user_id = _user_id
        AND id <> _existing_row.id
        AND (
          COALESCE(platform, '') <> COALESCE(NULLIF(trim(_platform), ''), '')
          OR COALESCE(browser, '') <> COALESCE(NULLIF(trim(_browser), ''), '')
        )
    ) INTO _is_different_device;

    IF _is_different_device THEN
      SELECT NOT EXISTS (
        SELECT 1
        FROM public.security_events
        WHERE target_user_id = _user_id
          AND event_type = 'session_started'
          AND created_at > now() - INTERVAL '24 hours'
          AND (
            COALESCE(payload->>'platform', '') = COALESCE(NULLIF(trim(_platform), ''), '')
            AND COALESCE(payload->>'browser', '') = COALESCE(NULLIF(trim(_browser), ''), '')
          )
      ) INTO _should_notify;

      IF _should_notify THEN
        PERFORM public.log_security_event(
          _clinic_id,
          _user_id,
          _user_id,
          'session_started',
          'self',
          jsonb_build_object(
            'browser', NULLIF(trim(_browser), ''),
            'platform', NULLIF(trim(_platform), ''),
            'device_label', _normalized_device_label,
            'user_agent', NULLIF(trim(_user_agent), ''),
            'session_key', _session_key,
            'is_new_device', true
          )
        );
      END IF;
    END IF;
  END IF;

  -- 2. Presença de Equipe: Notificar outros membros da clínica se o usuário ficou ONLINE
  IF _clinic_id IS NOT NULL THEN
    SELECT NOT EXISTS (
      SELECT 1
      FROM public.user_security_sessions
      WHERE user_id = _user_id
        AND clinic_id = _clinic_id
        AND id <> _existing_row.id
        AND ended_at IS NULL
        AND force_signed_out_at IS NULL
        AND last_seen_at >= now() - INTERVAL '5 minutes'
    ) INTO _was_offline;

    IF _was_offline THEN
      PERFORM public.notify_clinic_collaborator_presence(_clinic_id, _user_id, 'online');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'session_id', _existing_row.id,
    'user_id', _user_id
  );
END;
$$;


ALTER FUNCTION "public"."register_current_security_session"("_session_key" "text", "_browser" "text", "_platform" "text", "_device_label" "text", "_user_agent" "text") OWNER TO "postgres";


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
      expires_at = now() + interval '14 days'
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


ALTER FUNCTION "public"."resend_clinic_collaborator_invitation"("_invitation_id" "uuid") OWNER TO "postgres";


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


ALTER FUNCTION "public"."revoke_clinic_member_access"("_membership_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_session_share"("_session_id" "uuid", "_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _updated_count integer := 0;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT public.can_share_session(_session_id) THEN
    RAISE EXCEPTION 'Sem permissão para remover compartilhamento';
  END IF;

  UPDATE public.session_shares
  SET
    revoked_at = now(),
    revoked_by_user_id = _actor_id
  WHERE session_id = _session_id
    AND shared_with_user_id = _user_id
    AND revoked_at IS NULL;

  GET DIAGNOSTICS _updated_count = ROW_COUNT;

  RETURN json_build_object('revoked_count', _updated_count);
END;
$$;


ALTER FUNCTION "public"."revoke_session_share"("_session_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


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


ALTER FUNCTION "public"."revoke_user_punishment"("_punishment_id" "uuid", "_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_clinic_subscriptions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;


ALTER FUNCTION "public"."set_clinic_subscriptions_updated_at"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."set_current_user_active_clinic"("_clinic_id" "uuid") OWNER TO "postgres";


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


ALTER FUNCTION "public"."set_current_user_active_clinic_by_route_key"("_route_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."share_sessions_with_collaborators"("_session_ids" "uuid"[], "_user_ids" "uuid"[]) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _session_id uuid;
  _target_user_id uuid;
  _session public.sessions%ROWTYPE;
  _inserted_count integer := 0;
  _row_count integer := 0;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF COALESCE(array_length(_session_ids, 1), 0) = 0 OR COALESCE(array_length(_user_ids, 1), 0) = 0 THEN
    RETURN json_build_object('shared_count', 0);
  END IF;

  FOR _session_id IN
    SELECT DISTINCT item
    FROM unnest(_session_ids) AS item
    WHERE item IS NOT NULL
  LOOP
    SELECT *
    INTO _session
    FROM public.sessions
    WHERE id = _session_id;

    IF _session.id IS NULL OR _session.clinic_id IS NULL THEN
      RAISE EXCEPTION 'Ficha de atendimento não encontrada';
    END IF;

    IF NOT public.can_share_session(_session.id) THEN
      RAISE EXCEPTION 'Sem permissão para compartilhar uma ou mais fichas';
    END IF;

    FOR _target_user_id IN
      SELECT DISTINCT item
      FROM unnest(_user_ids) AS item
      WHERE item IS NOT NULL
    LOOP
      IF _target_user_id = _session.user_id OR _target_user_id = _session.provider_id THEN
        CONTINUE;
      END IF;

      IF NOT public.is_active_clinic_member(_session.clinic_id, _target_user_id) THEN
        RAISE EXCEPTION 'Um dos colaboradores selecionados não pertence à clínica';
      END IF;

      INSERT INTO public.session_shares (
        clinic_id,
        session_id,
        shared_with_user_id,
        shared_by_user_id,
        access_level
      )
      VALUES (
        _session.clinic_id,
        _session.id,
        _target_user_id,
        _actor_id,
        'read'
      )
      ON CONFLICT (session_id, shared_with_user_id) WHERE revoked_at IS NULL DO NOTHING;

      GET DIAGNOSTICS _row_count = ROW_COUNT;
      _inserted_count := _inserted_count + _row_count;
    END LOOP;
  END LOOP;

  RETURN json_build_object('shared_count', _inserted_count);
END;
$$;


ALTER FUNCTION "public"."share_sessions_with_collaborators"("_session_ids" "uuid"[], "_user_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."share_sessions_with_collaborators"("_session_ids" "uuid"[], "_user_ids" "uuid"[], "_access_level" "text" DEFAULT 'can_evolve'::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  _actor_id uuid := auth.uid();
  _session_id uuid;
  _target_user_id uuid;
  _session public.sessions%rowtype;
  _inserted_count integer := 0;
  _row_count integer := 0;
  _level text := coalesce(_access_level, 'can_evolve');
begin
  if _actor_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if coalesce(array_length(_session_ids, 1), 0) = 0 or coalesce(array_length(_user_ids, 1), 0) = 0 then
    return json_build_object('shared_count', 0);
  end if;

  if _level not in ('read', 'read_only', 'can_evolve') then
    _level := 'can_evolve';
  end if;

  for _session_id in
    select distinct item
    from unnest(_session_ids) as item
    where item is not null
  loop
    select *
    into _session
    from public.sessions
    where id = _session_id;

    if _session.id is null or _session.clinic_id is null then
      raise exception 'Ficha de atendimento não encontrada';
    end if;

    if not public.can_share_session(_session.id) then
      raise exception 'Sem permissão para compartilhar uma ou mais fichas';
    end if;

    for _target_user_id in
      select distinct item
      from unnest(_user_ids) as item
      where item is not null
    loop
      if _target_user_id = _session.user_id or _target_user_id = _session.provider_id then
        continue;
      end if;

      if not public.is_active_clinic_member(_session.clinic_id, _target_user_id) then
        raise exception 'Um dos colaboradores selecionados não pertence à clínica';
      end if;

      insert into public.session_shares (
        clinic_id,
        session_id,
        shared_with_user_id,
        shared_by_user_id,
        access_level
      )
      values (
        _session.clinic_id,
        _session.id,
        _target_user_id,
        _actor_id,
        _level
      )
      on conflict (session_id, shared_with_user_id) where revoked_at is null do update
      set access_level = excluded.access_level,
          shared_by_user_id = excluded.shared_by_user_id,
          created_at = now();

      get diagnostics _row_count = row_count;
      _inserted_count := _inserted_count + _row_count;
    end loop;
  end loop;

  return json_build_object('shared_count', _inserted_count);
end;
$$;


ALTER FUNCTION "public"."share_sessions_with_collaborators"("_session_ids" "uuid"[], "_user_ids" "uuid"[], "_access_level" "text") OWNER TO "postgres";


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


ALTER FUNCTION "public"."slugify_text"("_val" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."start_platform_clinic_access"("_clinic_id" "uuid", "_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  _user_id uuid := auth.uid();
  _clinic public.clinics%rowtype;
  _reason_clean text := nullif(left(btrim(coalesce(_reason, '')), 1000), '');
begin
  if not public.is_platform_owner_mfa_verified(_user_id) then
    raise exception 'Verificacao de dois fatores obrigatoria para acesso de plataforma.';
  end if;

  if _reason_clean is null then
    raise exception 'Informe o motivo para acessar a clinica.';
  end if;

  select *
  into _clinic
  from public.clinics
  where id = _clinic_id;

  if _clinic.id is null then
    raise exception 'Clinica nao encontrada.';
  end if;

  update public.platform_clinic_access_sessions
  set ended_at = now(), last_seen_at = now()
  where actor_user_id = _user_id
    and ended_at is null;

  insert into public.platform_clinic_access_sessions (actor_user_id, clinic_id, reason)
  values (_user_id, _clinic_id, _reason_clean);

  insert into public.user_active_clinic_contexts (user_id, clinic_id, updated_at)
  values (_user_id, _clinic_id, now())
  on conflict (user_id)
  do update set clinic_id = excluded.clinic_id, updated_at = now();

  perform public.log_platform_audit_event(
    'platform_clinic_access_started',
    _clinic_id,
    _reason_clean,
    jsonb_build_object('clinic_name', _clinic.name, 'clinic_route_key', _clinic.route_key)
  );

  return jsonb_build_object(
    'clinic', jsonb_build_object(
      'id', _clinic.id,
      'name', _clinic.name,
      'logo_url', _clinic.logo_url,
      'route_key', _clinic.route_key,
      'subscription_plan', _clinic.subscription_plan,
      'subaccount_limit', _clinic.subaccount_limit,
      'concurrent_access_limit', nullif(to_jsonb(_clinic)->>'concurrent_access_limit', '')::integer,
      'account_owner_user_id', _clinic.account_owner_user_id
    ),
    'reason', _reason_clean
  );
end;
$$;


ALTER FUNCTION "public"."start_platform_clinic_access"("_clinic_id" "uuid", "_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_patient_registration_form"("_token" "text", "_password" "text", "_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  _link public.patient_registration_links%ROWTYPE;
  _patient public.patients%ROWTYPE;
  _normalized_password text := left(regexp_replace(coalesce(_password, ''), '\D', '', 'g'), 6);
  _birth_date date;
  _birth_text text := nullif(trim(coalesce(_payload->>'date_of_birth', '')), '');
  _completed boolean;
  _origin_type text;
  _name text := left(trim(coalesce(_payload->>'name', '')), 160);
  _email text := nullif(lower(left(trim(coalesce(_payload->>'email', '')), 254)), '');
  _phone_digits text := regexp_replace(coalesce(_payload->>'phone', ''), '\D', '', 'g');
  _emergency_phone_digits text := regexp_replace(coalesce(_payload->'emergency_contact'->>'phone', ''), '\D', '', 'g');
  _phone text;
  _emergency_phone text;
BEGIN
  _phone_digits := CASE
    WHEN length(_phone_digits) > 11 AND left(_phone_digits, 2) = '55' THEN substr(_phone_digits, 3)
    ELSE _phone_digits
  END;
  _phone := nullif(left(_phone_digits, 11), '');
  _emergency_phone_digits := CASE
    WHEN length(_emergency_phone_digits) > 11 AND left(_emergency_phone_digits, 2) = '55' THEN substr(_emergency_phone_digits, 3)
    ELSE _emergency_phone_digits
  END;
  _emergency_phone := nullif(left(_emergency_phone_digits, 11), '');

  SELECT * INTO _link
  FROM public.patient_registration_links
  WHERE token = _token;

  IF _link.id IS NULL THEN
    RAISE EXCEPTION 'Link inválido';
  END IF;

  IF _link.password_prefix IS DISTINCT FROM _normalized_password THEN
    RAISE EXCEPTION 'Senha inválida';
  END IF;

  SELECT * INTO _patient
  FROM public.patients
  WHERE id = _link.patient_id;

  IF _patient.id IS NULL THEN
    RAISE EXCEPTION 'Paciente não encontrado';
  END IF;

  _completed := coalesce(_patient.registration_complete, false) OR _link.completed_at IS NOT NULL;

  IF _completed THEN
    RETURN jsonb_build_object(
      'completed', true,
      'message', 'Cadastro concluído! Caso precise atualizar alguma informação, informe o profissional que está te atendendo.'
    );
  END IF;

  IF length(_name) < 3 THEN
    RAISE EXCEPTION 'Informe um nome completo válido';
  END IF;

  IF _birth_text IS NOT NULL THEN
    IF _birth_text !~ '^\d{4}-\d{2}-\d{2}$' THEN
      RAISE EXCEPTION 'Data de nascimento inválida';
    END IF;

    BEGIN
      _birth_date := _birth_text::date;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Data de nascimento inválida';
    END;

    IF _birth_date > current_date OR _birth_date < (current_date - interval '130 years')::date THEN
      RAISE EXCEPTION 'Data de nascimento inválida';
    END IF;
  END IF;

  IF _phone IS NOT NULL AND _phone !~ '^\d{10,11}$' THEN
    RAISE EXCEPTION 'Telefone inválido';
  END IF;

  IF _email IS NOT NULL AND _email !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]{2,}$' THEN
    RAISE EXCEPTION 'E-mail inválido';
  END IF;

  _origin_type := coalesce(nullif(trim(_payload->>'origin_type'), ''), 'outros');

  IF _origin_type NOT IN ('particular', 'indicacao', 'convenio', 'filantropia', 'outros') THEN
    _origin_type := 'outros';
  END IF;

  UPDATE public.patients
  SET
    name = _name,
    date_of_birth = _birth_date,
    age = CASE
      WHEN _birth_date IS NOT NULL THEN extract(year from age(current_date, _birth_date))::integer
      ELSE null
    END,
    phone = _phone,
    email = _email,
    gender = left(nullif(trim(coalesce(_payload->>'gender', '')), ''), 240),
    rg = left(nullif(trim(coalesce(_payload->>'rg', '')), ''), 32),
    blood_type = left(nullif(trim(coalesce(_payload->>'blood_type', '')), ''), 8),
    pronoun = left(nullif(trim(coalesce(_payload->>'pronoun', '')), ''), 240),
    profession = left(nullif(trim(coalesce(_payload->>'profession', '')), ''), 120),
    origin_type = _origin_type,
    origin_referrer_name = CASE WHEN _origin_type = 'indicacao' THEN left(nullif(trim(_payload->>'origin_referrer_name'), ''), 120) ELSE null END,
    origin_insurance_provider = CASE WHEN _origin_type = 'convenio' THEN left(nullif(trim(_payload->>'origin_insurance_provider'), ''), 120) ELSE null END,
    origin_insurance_plan = CASE WHEN _origin_type = 'convenio' THEN left(nullif(trim(_payload->>'origin_insurance_plan'), ''), 120) ELSE null END,
    origin_insurance_member_id = CASE WHEN _origin_type = 'convenio' THEN left(nullif(trim(_payload->>'origin_insurance_member_id'), ''), 80) ELSE null END,
    origin_other_name = CASE
      WHEN _origin_type = 'outros'
      THEN left(coalesce(nullif(trim(_payload->>'origin_other_name'), ''), 'Não informado'), 120)
      ELSE null
    END,
    origin_other_description = CASE
      WHEN _origin_type = 'outros'
      THEN left(coalesce(nullif(trim(_payload->>'origin_other_description'), ''), 'Por favor, adicione uma opção de origem para este paciente'), 500)
      ELSE null
    END,
    cep = nullif(left(regexp_replace(coalesce(_payload->>'cep', ''), '\D', '', 'g'), 8), ''),
    country = coalesce(left(nullif(trim(_payload->>'country'), ''), 80), 'Brasil'),
    state = left(nullif(trim(coalesce(_payload->>'state', '')), ''), 40),
    city = left(nullif(trim(coalesce(_payload->>'city', '')), ''), 120),
    neighborhood = left(nullif(trim(coalesce(_payload->>'neighborhood', '')), ''), 240),
    street = left(nullif(trim(coalesce(_payload->>'street', '')), ''), 160),
    address_number = left(nullif(trim(coalesce(_payload->>'address_number', '')), ''), 40),
    address_complement = left(nullif(trim(coalesce(_payload->>'address_complement', '')), ''), 120),
    chronic_conditions = left(nullif(trim(coalesce(_payload->>'chronic_conditions', '')), ''), 2000),
    surgeries = left(nullif(trim(coalesce(_payload->>'surgeries', '')), ''), 2000),
    continuous_medications = left(nullif(trim(coalesce(_payload->>'continuous_medications', '')), ''), 2000),
    allergies = left(nullif(trim(coalesce(_payload->>'allergies', '')), ''), 2000),
    clinical_notes = left(nullif(trim(coalesce(_payload->>'clinical_notes', '')), ''), 2000),
    clinical_profile = nullif(
      jsonb_strip_nulls(
        jsonb_build_object(
          'diagnoses', left(nullif(trim(coalesce(_payload->'clinical_profile'->>'diagnoses', '')), ''), 2000),
          'clinical_alerts', left(nullif(trim(coalesce(_payload->'clinical_profile'->>'clinical_alerts', '')), ''), 2000),
          'congenital_genetic_conditions', left(nullif(trim(coalesce(_payload->'clinical_profile'->>'congenital_genetic_conditions', '')), ''), 2000),
          'implants_devices', left(nullif(trim(coalesce(_payload->'clinical_profile'->>'implants_devices', '')), ''), 2000),
          'family_history', left(nullif(trim(coalesce(_payload->'clinical_profile'->>'family_history', '')), ''), 2000),
          'lifestyle_notes', left(nullif(trim(coalesce(_payload->'clinical_profile'->>'lifestyle_notes', '')), ''), 2000),
          'falls_history', left(nullif(trim(coalesce(_payload->'clinical_profile'->>'falls_history', '')), ''), 2000),
          'mobility_aids', left(nullif(trim(coalesce(_payload->'clinical_profile'->>'mobility_aids', '')), ''), 2000),
          'risk_flags', (
            select nullif(jsonb_agg(flag), '[]'::jsonb)
            from jsonb_array_elements_text(
              case
                when jsonb_typeof(_payload->'clinical_profile'->'risk_flags') = 'array'
                then _payload->'clinical_profile'->'risk_flags'
                else '[]'::jsonb
              end
            ) as risk(flag)
            where flag in (
              'fall_risk',
              'allergy',
              'pregnant',
              'high_risk_pregnancy',
              'elderly',
              'aggressive',
              'escape_risk',
              'pediatric',
              'pressure_injury',
              'limb_preservation',
              'infection_risk',
              'diabetes',
              'neuropathy',
              'seizure_risk',
              'speech_difficulty'
            )
          ),
          'functional_independence', left(nullif(trim(coalesce(_payload->'clinical_profile'->>'functional_independence', '')), ''), 80),
          'substance_use_history', _payload->'clinical_profile'->'substance_use_history',
          'treatment_goals', left(nullif(trim(coalesce(_payload->'clinical_profile'->>'treatment_goals', '')), ''), 2000)
        )
      ),
      '{}'::jsonb
    ),
    emergency_contact = nullif(
      jsonb_strip_nulls(
        jsonb_build_object(
          'name', left(nullif(trim(coalesce(_payload->'emergency_contact'->>'name', '')), ''), 160),
          'relationship', left(nullif(trim(coalesce(_payload->'emergency_contact'->>'relationship', '')), ''), 240),
          'phone', _emergency_phone
        )
      ),
      '{}'::jsonb
    ),
    registration_complete = true,
    updated_at = now()
  WHERE id = _patient.id;

  UPDATE public.patient_registration_links
  SET
    completed_at = now(),
    updated_at = now()
  WHERE id = _link.id;

  RETURN jsonb_build_object(
    'completed', true,
    'message', 'Cadastro concluído! Caso precise atualizar alguma informação, informe o profissional que está te atendendo.'
  );
END;
$_$;


ALTER FUNCTION "public"."submit_patient_registration_form"("_token" "text", "_password" "text", "_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_user_platform_feedback"("_clinic_id" "uuid", "_ratings" "jsonb", "_problem_report" "text" DEFAULT NULL::"text", "_opinion" "text" DEFAULT NULL::"text", "_page_url" "text" DEFAULT NULL::"text", "_user_agent" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _user_email text;
  _user_name text;
  _clinic_name text;
  _feedback_id uuid;
  _avg_rating numeric(3,2) := 0;
  _item jsonb;
  _sum numeric := 0;
  _count numeric := 0;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  -- 1. Obter dados do usuário
  SELECT email, COALESCE(NULLIF(trim(full_name), ''), NULLIF(trim(social_name), ''), email)
  INTO _user_email, _user_name
  FROM public.profiles
  WHERE id = _user_id;

  -- 2. Obter dados da clínica se informada
  IF _clinic_id IS NOT NULL THEN
    SELECT name
    INTO _clinic_name
    FROM public.clinics
    WHERE id = _clinic_id;
  END IF;

  -- 3. Calcular média de estrelas
  IF _ratings IS NOT NULL AND jsonb_array_length(_ratings) > 0 THEN
    FOR _item IN SELECT * FROM jsonb_array_elements(_ratings)
    LOOP
      IF (_item->>'rating') IS NOT NULL AND (_item->>'rating')::numeric > 0 THEN
        _sum := _sum + (_item->>'rating')::numeric;
        _count := _count + 1;
      END IF;
    END LOOP;

    IF _count > 0 THEN
      _avg_rating := ROUND((_sum / _count)::numeric, 2);
    END IF;
  END IF;

  -- 4. Inserir feedback
  INSERT INTO public.platform_feedbacks (
    user_id,
    clinic_id,
    user_email,
    user_name,
    clinic_name,
    ratings,
    average_rating,
    problem_report,
    opinion,
    page_url,
    user_agent,
    status
  )
  VALUES (
    _user_id,
    _clinic_id,
    _user_email,
    _user_name,
    _clinic_name,
    COALESCE(_ratings, '[]'::jsonb),
    _avg_rating,
    NULLIF(trim(_problem_report), ''),
    NULLIF(trim(_opinion), ''),
    NULLIF(trim(_page_url), ''),
    NULLIF(trim(_user_agent), ''),
    'pending'
  )
  RETURNING id INTO _feedback_id;

  RETURN _feedback_id;
END;
$$;


ALTER FUNCTION "public"."submit_user_platform_feedback"("_clinic_id" "uuid", "_ratings" "jsonb", "_problem_report" "text", "_opinion" "text", "_page_url" "text", "_user_agent" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_clinic_limits_from_subscription"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_effective_subaccount_limit integer;
  v_effective_concurrent_access_limit integer;
  v_base_subaccounts integer;
  v_base_concurrent integer;
BEGIN
  IF NEW.plan_type = 'solo' THEN
    v_base_subaccounts := 1;
    v_base_concurrent := 1;
  ELSIF NEW.plan_type = 'enterprise' THEN
    v_base_subaccounts := coalesce(NEW.base_subaccount_limit, 100);
    v_base_concurrent := coalesce(NEW.base_concurrent_access_count, 10);
  ELSE
    v_base_subaccounts := coalesce(NEW.base_subaccount_limit, 30);
    v_base_concurrent := coalesce(NEW.base_concurrent_access_count, 4);
  END IF;

  v_effective_subaccount_limit := v_base_subaccounts + coalesce(NEW.purchased_subaccount_extra_count, 0);
  v_effective_concurrent_access_limit := v_base_concurrent + coalesce(NEW.additional_concurrent_access_count, 0);

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


ALTER FUNCTION "public"."sync_clinic_limits_from_subscription"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_community_template_like"("p_template_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_liked boolean;
  v_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF EXISTS (SELECT 1 FROM public.community_form_template_likes WHERE template_id = p_template_id AND user_id = v_user_id) THEN
    DELETE FROM public.community_form_template_likes WHERE template_id = p_template_id AND user_id = v_user_id;
    UPDATE public.community_form_templates
    SET likes_count = GREATEST(0, likes_count - 1)
    WHERE id = p_template_id;
    v_liked := false;
  ELSE
    INSERT INTO public.community_form_template_likes (template_id, user_id)
    VALUES (p_template_id, v_user_id)
    ON CONFLICT DO NOTHING;
    UPDATE public.community_form_templates
    SET likes_count = likes_count + 1
    WHERE id = p_template_id;
    v_liked := true;
  END IF;

  SELECT likes_count INTO v_count FROM public.community_form_templates WHERE id = p_template_id;

  RETURN jsonb_build_object('liked', v_liked, 'likes_count', COALESCE(v_count, 0));
END;
$$;


ALTER FUNCTION "public"."toggle_community_template_like"("p_template_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_subscription_auto_renew"("_clinic_id" "uuid", "_auto_renew" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  -- Verificar se quem esta chamando e o owner da clinica ou admin da plataforma
  SELECT account_owner_user_id INTO v_owner_id
  FROM public.clinics
  WHERE id = _clinic_id;

  IF v_owner_id IS DISTINCT FROM auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Apenas o proprietário da clínica pode alterar a renovação automática.';
  END IF;

  UPDATE public.clinic_subscriptions
  SET auto_renew = _auto_renew,
      updated_at = now()
  WHERE clinic_id = _clinic_id;

  RETURN jsonb_build_object(
    'success', true,
    'auto_renew', _auto_renew
  );
END;
$$;


ALTER FUNCTION "public"."toggle_subscription_auto_renew"("_clinic_id" "uuid", "_auto_renew" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_notification_preferences_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."touch_notification_preferences_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_platform_feedbacks_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."touch_platform_feedbacks_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_auto_assign_patient_code"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if new.patient_code is null or trim(new.patient_code) = '' then
    if new.clinic_id is not null then
      new.patient_code := public.generate_next_patient_code(new.clinic_id);
    else
      new.patient_code := 'PAC-' || lpad((floor(extract(epoch from now()))::bigint % 100000)::text, 5, '0');
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_auto_assign_patient_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_patient_groups_set_clinic_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.clinic_id IS NULL THEN
    NEW.clinic_id := public.get_user_clinic_id(COALESCE(auth.uid(), NEW.user_id));
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_patient_groups_set_clinic_id"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."trim_user_notifications"("_user_id" "uuid") OWNER TO "postgres";


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


ALTER FUNCTION "public"."update_clinic_collaborator_invitation"("_invitation_id" "uuid", "_operational_role" "public"."operational_role_type", "_job_title" "text", "_specialty" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_clinic_concurrent_accesses"("_clinic_id" "uuid", "_extra_concurrent" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_current_user_id uuid := auth.uid();
  v_sub_record public.clinic_subscriptions%ROWTYPE;
  v_extra_seat_price numeric(10,2);
  v_base_monthly_price numeric(10,2);
  v_cycle text;
BEGIN
  IF NOT public.is_clinic_subscription_manager(v_current_user_id, _clinic_id) THEN
    RAISE EXCEPTION 'Acesso negado: apenas o responsável pela clínica pode ajustar os acessos simultâneos.';
  END IF;

  IF coalesce(_extra_concurrent, 0) < 0 THEN
    RAISE EXCEPTION 'Quantidade de acessos extras inválida.';
  END IF;

  SELECT * INTO v_sub_record FROM public.clinic_subscriptions WHERE clinic_id = _clinic_id;
  IF v_sub_record.id IS NULL THEN
    INSERT INTO public.clinic_subscriptions (
      clinic_id, account_owner_user_id, plan_type, billing_cycle,
      base_monthly_price, base_subaccount_limit, base_concurrent_access_count, status
    )
    VALUES (_clinic_id, v_current_user_id, 'clinic', 'ANNUAL', 104.00, 30, 4, 'PENDING')
    RETURNING * INTO v_sub_record;
  END IF;

  IF v_sub_record.plan_type = 'solo' THEN
    RAISE EXCEPTION 'Não é possível adicionar acessos simultâneos extras no plano Solo. Faça upgrade para o plano Clínica Pro ou Enterprise primeiro.';
  END IF;

  v_cycle := LOWER(coalesce(v_sub_record.billing_cycle, 'annual'));

  -- Determinar preços baseado no plano e ciclo
  IF v_sub_record.plan_type = 'enterprise' THEN
    v_extra_seat_price := 15.00;
    v_base_monthly_price := CASE
      WHEN v_cycle = 'monthly' THEN 299.00
      WHEN v_cycle = 'quarterly' THEN 269.00
      ELSE 224.00
    END;
  ELSE -- 'clinic'
    v_extra_seat_price := 25.00;
    v_base_monthly_price := CASE
      WHEN v_cycle = 'monthly' THEN 139.00
      WHEN v_cycle = 'quarterly' THEN 125.00
      ELSE 104.00
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


ALTER FUNCTION "public"."update_clinic_concurrent_accesses"("_clinic_id" "uuid", "_extra_concurrent" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_clinic_member_operational_fields"("_membership_id" "uuid", "_job_title" "text" DEFAULT NULL::"text", "_specialty" "text" DEFAULT NULL::"text", "_working_hours" "text" DEFAULT NULL::"text", "_operational_role" "public"."operational_role_type" DEFAULT NULL::"public"."operational_role_type", "_membership_status" "public"."membership_status_type" DEFAULT NULL::"public"."membership_status_type") RETURNS "jsonb"
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

  IF _target_membership.account_role = 'account_owner' THEN
    RAISE EXCEPTION 'A conta principal nao pode ser editada por este fluxo.';
  END IF;

  IF NOT (
    public.current_user_can('subaccounts.manage', _target_membership.clinic_id)
    OR public.current_user_can('subaccounts.write', _target_membership.clinic_id)
  ) THEN
    RAISE EXCEPTION 'Sem permissao para editar colaboradores nesta clinica.';
  END IF;

  IF _operational_role IS NOT NULL AND NOT public.current_user_can('subaccounts_roles.manage', _target_membership.clinic_id) THEN
    RAISE EXCEPTION 'Sem permissao para alterar a hierarquia deste colaborador.';
  END IF;

  IF _operational_role = 'owner' THEN
    RAISE EXCEPTION 'O papel owner fica reservado para a conta principal.';
  END IF;

  IF _membership_status IS NOT NULL AND _membership_status = 'invited' THEN
    RAISE EXCEPTION 'Status convidado e controlado pelo fluxo de convites.';
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
    operational_role = COALESCE(_operational_role, operational_role),
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

  RETURN jsonb_build_object('membership_id', _membership_id);
END;
$$;


ALTER FUNCTION "public"."update_clinic_member_operational_fields"("_membership_id" "uuid", "_job_title" "text", "_specialty" "text", "_working_hours" "text", "_operational_role" "public"."operational_role_type", "_membership_status" "public"."membership_status_type") OWNER TO "postgres";


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


ALTER FUNCTION "public"."update_clinic_subaccount"("_membership_id" "uuid", "_full_name" "text", "_email" "text", "_cpf" "text", "_professional_license" "text", "_phone" "text", "_specialty" "text", "_job_title" "text", "_operational_role" "public"."operational_role_type", "_membership_status" "public"."membership_status_type", "_new_password" "text", "_working_hours" "text") OWNER TO "postgres";


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


ALTER FUNCTION "public"."update_clinic_subaccount_profile"("_membership_id" "uuid", "_full_name" "text", "_social_name" "text", "_email" "text", "_phone" "text", "_birth_date" "date", "_cpf" "text", "_professional_license" "text", "_specialty" "text", "_job_title" "text", "_bio" "text", "_working_hours" "text", "_address" "jsonb", "_operational_role" "public"."operational_role_type", "_membership_status" "public"."membership_status_type", "_new_password" "text") OWNER TO "postgres";


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


ALTER FUNCTION "public"."update_current_profile"("_full_name" "text", "_social_name" "text", "_email" "text", "_phone" "text", "_birth_date" "date", "_cpf" "text", "_professional_license" "text", "_specialty" "text", "_job_title" "text", "_bio" "text", "_working_hours" "text", "_address" "jsonb", "_new_password" "text") OWNER TO "postgres";


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


ALTER FUNCTION "public"."update_current_user_notification_preferences"("_sound_mode" "text", "_sound_key" "text", "_notify_security" boolean, "_notify_clinic_access" boolean, "_notify_patient_saved" boolean, "_notify_session_activity" boolean, "_notify_event_reminders" boolean, "_notify_system" boolean) OWNER TO "postgres";


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


ALTER FUNCTION "public"."update_team_development_profile"("_user_id" "uuid", "_development_status" "text", "_internal_level" "text", "_goals" "text", "_review_notes" "text", "_last_review_at" "date", "_next_review_at" "date", "_onboarding_flow_read" boolean, "_onboarding_initial_training" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."upsert_current_user_security_settings"("_alert_password_changed" boolean, "_alert_new_login" boolean, "_alert_other_sessions_ended" boolean, "_alert_access_change" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_feature_flag"("_key" "text", "_scope" "public"."feature_flag_scope", "_clinic_id" "uuid" DEFAULT NULL::"uuid", "_tag_id" "uuid" DEFAULT NULL::"uuid", "_value" "jsonb" DEFAULT 'false'::"jsonb", "_description" "text" DEFAULT NULL::"text", "_starts_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "_expires_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "_reason" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  _user_id uuid := auth.uid();
  _clean_key text := lower(regexp_replace(btrim(coalesce(_key, '')), '[^a-zA-Z0-9_.:-]+', '_', 'g'));
  _target_id uuid;
  _previous jsonb;
  _next jsonb;
begin
  if not public.is_platform_owner_mfa_verified(_user_id) then
    raise exception 'Acesso de plataforma indisponivel.';
  end if;

  if _clean_key = '' then
    raise exception 'Informe uma chave de feature flag.';
  end if;

  if _scope = 'global' then
    _clinic_id := null;
    _tag_id := null;
  elsif _scope = 'tag' then
    _clinic_id := null;
    if _tag_id is null then
      raise exception 'Informe uma tag_id para flag por tag.';
    end if;
  elsif _scope = 'clinic' then
    _tag_id := null;
    if _clinic_id is null then
      raise exception 'Informe uma clinica para flag por clinica.';
    end if;
  end if;

  select to_jsonb(feature_flags.*)
  into _previous
  from public.feature_flags
  where feature_flags.key = _clean_key
    and feature_flags.scope = _scope
    and feature_flags.clinic_id is not distinct from _clinic_id
    and feature_flags.tag_id is not distinct from _tag_id
  limit 1;

  if _scope = 'global' then
    insert into public.feature_flags (
      key,
      scope,
      clinic_id,
      tag_id,
      value,
      description,
      starts_at,
      expires_at,
      reason,
      created_by,
      updated_by
    )
    values (
      _clean_key,
      _scope,
      _clinic_id,
      _tag_id,
      coalesce(_value, 'false'::jsonb),
      nullif(left(coalesce(_description, ''), 500), ''),
      _starts_at,
      _expires_at,
      nullif(left(coalesce(_reason, ''), 1000), ''),
      _user_id,
      _user_id
    )
    on conflict (key) where scope = 'global'
    do nothing;

    update public.feature_flags
    set
      value = coalesce(_value, 'false'::jsonb),
      description = nullif(left(coalesce(_description, ''), 500), ''),
      starts_at = _starts_at,
      expires_at = _expires_at,
      reason = nullif(left(coalesce(_reason, ''), 1000), ''),
      updated_by = _user_id,
      updated_at = now()
    where key = _clean_key
      and scope = 'global'
    returning id into _target_id;
  elsif _scope = 'tag' then
    insert into public.feature_flags (
      key,
      scope,
      clinic_id,
      tag_id,
      value,
      description,
      starts_at,
      expires_at,
      reason,
      created_by,
      updated_by
    )
    values (
      _clean_key,
      _scope,
      _clinic_id,
      _tag_id,
      coalesce(_value, 'false'::jsonb),
      nullif(left(coalesce(_description, ''), 500), ''),
      _starts_at,
      _expires_at,
      nullif(left(coalesce(_reason, ''), 1000), ''),
      _user_id,
      _user_id
    )
    on conflict (tag_id, key) where scope = 'tag'
    do nothing;

    update public.feature_flags
    set
      value = coalesce(_value, 'false'::jsonb),
      description = nullif(left(coalesce(_description, ''), 500), ''),
      starts_at = _starts_at,
      expires_at = _expires_at,
      reason = nullif(left(coalesce(_reason, ''), 1000), ''),
      updated_by = _user_id,
      updated_at = now()
    where key = _clean_key
      and scope = 'tag'
      and tag_id = _tag_id
    returning id into _target_id;
  elsif _scope = 'clinic' then
    insert into public.feature_flags (
      key,
      scope,
      clinic_id,
      tag_id,
      value,
      description,
      starts_at,
      expires_at,
      reason,
      created_by,
      updated_by
    )
    values (
      _clean_key,
      _scope,
      _clinic_id,
      _tag_id,
      coalesce(_value, 'false'::jsonb),
      nullif(left(coalesce(_description, ''), 500), ''),
      _starts_at,
      _expires_at,
      nullif(left(coalesce(_reason, ''), 1000), ''),
      _user_id,
      _user_id
    )
    on conflict (clinic_id, key) where scope = 'clinic'
    do nothing;

    update public.feature_flags
    set
      value = coalesce(_value, 'false'::jsonb),
      description = nullif(left(coalesce(_description, ''), 500), ''),
      starts_at = _starts_at,
      expires_at = _expires_at,
      reason = nullif(left(coalesce(_reason, ''), 1000), ''),
      updated_by = _user_id,
      updated_at = now()
    where key = _clean_key
      and scope = 'clinic'
      and clinic_id = _clinic_id
    returning id into _target_id;
  end if;

  select to_jsonb(feature_flags.*)
  into _next
  from public.feature_flags
  where id = _target_id;

  perform public.log_platform_audit_event(
    'feature_flag_upserted',
    _clinic_id,
    _reason,
    jsonb_build_object('before', coalesce(_previous, 'null'::jsonb), 'after', _next)
  );

  return _target_id;
end;
$$;


ALTER FUNCTION "public"."upsert_feature_flag"("_key" "text", "_scope" "public"."feature_flag_scope", "_clinic_id" "uuid", "_tag_id" "uuid", "_value" "jsonb", "_description" "text", "_starts_at" timestamp with time zone, "_expires_at" timestamp with time zone, "_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_user_telemetry_summary"("_clinic_id" "uuid", "_user_name" "text", "_page_views" integer, "_prints_detected" integer, "_docs_printed" integer, "_pdf_exported" integer, "_dwell_seconds" integer, "_top_routes" "jsonb", "_is_spam_flagged" boolean DEFAULT false, "_spam_reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
BEGIN
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
    updated_at
  )
  VALUES (
    auth.uid(),
    _clinic_id,
    CURRENT_DATE,
    _user_name,
    GREATEST(0, _page_views),
    GREATEST(0, _prints_detected),
    GREATEST(0, _docs_printed),
    GREATEST(0, _pdf_exported),
    GREATEST(0, _dwell_seconds),
    COALESCE(_top_routes, '{}'::jsonb),
    _is_spam_flagged,
    _spam_reason,
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
    top_routes = COALESCE(user_telemetry_summaries.top_routes, '{}'::jsonb) || EXCLUDED.top_routes,
    is_spam_flagged = user_telemetry_summaries.is_spam_flagged OR EXCLUDED.is_spam_flagged,
    spam_reason = COALESCE(EXCLUDED.spam_reason, user_telemetry_summaries.spam_reason),
    updated_at = now();
END;
$$;


ALTER FUNCTION "public"."upsert_user_telemetry_summary"("_clinic_id" "uuid", "_user_name" "text", "_page_views" integer, "_prints_detected" integer, "_docs_printed" integer, "_pdf_exported" integer, "_dwell_seconds" integer, "_top_routes" "jsonb", "_is_spam_flagged" boolean, "_spam_reason" "text") OWNER TO "postgres";


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


ALTER FUNCTION "public"."user_has_active_clinic_membership"("_user_id" "uuid", "_clinic_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_subscription_coupon"("_code" "text", "_plan_type" "text" DEFAULT 'clinic'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_normalized_code text;
  v_coupon public.subscription_coupons%rowtype;
begin
  if _code is null or trim(_code) = '' then
    return jsonb_build_object(
      'valid', false,
      'message', 'Código do cupom não informado.'
    );
  end if;

  v_normalized_code := upper(trim(_code));

  select * into v_coupon
  from public.subscription_coupons
  where code = v_normalized_code;

  if v_coupon.id is null then
    return jsonb_build_object(
      'valid', false,
      'message', 'Cupom inválido ou não encontrado.'
    );
  end if;

  if not v_coupon.is_active then
    return jsonb_build_object(
      'valid', false,
      'message', 'Este cupom não está mais ativo.'
    );
  end if;

  if v_coupon.valid_from > now() then
    return jsonb_build_object(
      'valid', false,
      'message', 'Este cupom ainda não está vigente.'
    );
  end if;

  if v_coupon.valid_until is not null and v_coupon.valid_until < now() then
    return jsonb_build_object(
      'valid', false,
      'message', 'Este cupom expirou.'
    );
  end if;

  if v_coupon.max_redemptions is not null and v_coupon.times_redeemed >= v_coupon.max_redemptions then
    return jsonb_build_object(
      'valid', false,
      'message', 'Limite máximo de resgates deste cupom atingido.'
    );
  end if;

  if v_coupon.applicable_plans is not null and array_length(v_coupon.applicable_plans, 1) > 0 then
    if not (_plan_type = any(v_coupon.applicable_plans)) then
      return jsonb_build_object(
        'valid', false,
        'message', 'Este cupom não é aplicável ao plano selecionado.'
      );
    end if;
  end if;

  return jsonb_build_object(
    'valid', true,
    'coupon_id', v_coupon.id,
    'code', v_coupon.code,
    'description', v_coupon.description,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'message', 'Cupom aplicado com sucesso!'
  );
end;
$$;


ALTER FUNCTION "public"."validate_subscription_coupon"("_code" "text", "_plan_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_subscription_coupon"("_code" "text", "_plan_type" "text" DEFAULT 'clinic'::"text", "_clinic_id" "uuid" DEFAULT NULL::"uuid", "_billing_cycle" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_normalized_code text;
  v_coupon public.subscription_coupons%rowtype;
  v_rules jsonb;
  v_clinic record;
  v_collaborator_count integer;
  v_session_count integer;
  v_patient_count integer;
  v_paid_invoices_count integer;
  v_is_winback boolean;
  v_mode text;
  v_after date;
  v_before date;
  v_op text;
  v_val integer;
  v_allowed_cycles jsonb;
  v_allowed_states jsonb;
begin
  if _code is null or trim(_code) = '' then
    return jsonb_build_object(
      'valid', false,
      'message', 'Código do cupom não informado.'
    );
  end if;

  v_normalized_code := upper(trim(_code));

  select * into v_coupon
  from public.subscription_coupons
  where code = v_normalized_code;

  if v_coupon.id is null then
    return jsonb_build_object(
      'valid', false,
      'message', 'Cupom inválido ou não encontrado.'
    );
  end if;

  -- 1. Status manual
  if not v_coupon.is_active then
    return jsonb_build_object(
      'valid', false,
      'message', 'Este cupom está temporariamente pausado ou desativado.'
    );
  end if;

  -- 2. Vigência temporal inicial
  if v_coupon.valid_from > now() then
    return jsonb_build_object(
      'valid', false,
      'message', 'Este cupom ainda não está vigente (inicia em ' || to_char(v_coupon.valid_from, 'DD/MM/YYYY') || ').'
    );
  end if;

  -- 3. Vigência temporal final
  if v_coupon.valid_until is not null and v_coupon.valid_until < now() then
    return jsonb_build_object(
      'valid', false,
      'message', 'Este cupom expirou em ' || to_char(v_coupon.valid_until, 'DD/MM/YYYY') || '.'
    );
  end if;

  -- 4. Limite de resgates
  if v_coupon.max_redemptions is not null and v_coupon.times_redeemed >= v_coupon.max_redemptions then
    return jsonb_build_object(
      'valid', false,
      'message', 'O limite máximo de resgates deste cupom foi atingido.'
    );
  end if;

  -- 5. Planos aplicáveis
  if v_coupon.applicable_plans is not null and array_length(v_coupon.applicable_plans, 1) > 0 then
    if not (_plan_type = any(v_coupon.applicable_plans)) then
      return jsonb_build_object(
        'valid', false,
        'message', 'Este cupom não é aplicável ao plano selecionado (' || _plan_type || ').'
      );
    end if;
  end if;

  v_rules := coalesce(v_coupon.eligibility_rules, '{}'::jsonb);

  -- 6. Validação de Ciclos de Cobrança Alvo (se informado)
  v_allowed_cycles := v_rules->'target_billing_cycles';
  if v_allowed_cycles is not null and jsonb_typeof(v_allowed_cycles) = 'array' and jsonb_array_length(v_allowed_cycles) > 0 then
    if _billing_cycle is not null and trim(_billing_cycle) <> '' then
      if not (v_allowed_cycles ? lower(trim(_billing_cycle))) then
        return jsonb_build_object(
          'valid', false,
          'message', 'Este cupom é exclusivo para ciclos de cobrança específicos (ex: ' || coalesce(v_rules->>'target_billing_cycles_label', 'outro ciclo') || ').'
        );
      end if;
    end if;
  end if;

  -- 7. Validação de Condições da Conta / Clínica (se _clinic_id for fornecido)
  if _clinic_id is not null then
    select id, created_at, address_state, access_status
    into v_clinic
    from public.clinics
    where id = _clinic_id;

    if v_clinic.id is not null then
      -- 7.1 Data de Criação da Clínica
      if v_rules->'account_creation' is not null then
        v_mode := v_rules->'account_creation'->>'mode';
        if v_mode = 'after' and (v_rules->'account_creation'->>'after_date') is not null then
          v_after := (v_rules->'account_creation'->>'after_date')::date;
          if v_clinic.created_at::date < v_after then
            return jsonb_build_object(
              'valid', false,
              'message', 'Este cupom é válido apenas para clínicas cadastradas a partir de ' || to_char(v_after, 'DD/MM/YYYY') || '.'
            );
          end if;
        elsif v_mode = 'before' and (v_rules->'account_creation'->>'before_date') is not null then
          v_before := (v_rules->'account_creation'->>'before_date')::date;
          if v_clinic.created_at::date > v_before then
            return jsonb_build_object(
              'valid', false,
              'message', 'Este cupom é válido apenas para clínicas cadastradas antes de ' || to_char(v_before, 'DD/MM/YYYY') || '.'
            );
          end if;
        elsif v_mode = 'between' then
          v_after := (v_rules->'account_creation'->>'after_date')::date;
          v_before := (v_rules->'account_creation'->>'before_date')::date;
          if v_after is not null and v_clinic.created_at::date < v_after then
            return jsonb_build_object(
              'valid', false,
              'message', 'Este cupom é válido apenas para contas criadas entre ' || to_char(v_after, 'DD/MM/YYYY') || ' e ' || to_char(v_before, 'DD/MM/YYYY') || '.'
            );
          end if;
          if v_before is not null and v_clinic.created_at::date > v_before then
            return jsonb_build_object(
              'valid', false,
              'message', 'Este cupom é válido apenas para contas criadas entre ' || to_char(v_after, 'DD/MM/YYYY') || ' e ' || to_char(v_before, 'DD/MM/YYYY') || '.'
            );
          end if;
        end if;
      end if;

      -- 7.2 Quantidade de Colaboradores Registrados
      if (v_rules->'collaborators'->>'enabled')::boolean is true then
        v_op := coalesce(v_rules->'collaborators'->>'operator', 'gte');
        v_val := coalesce((v_rules->'collaborators'->>'value')::integer, 0);

        select count(*)::integer into v_collaborator_count
        from public.clinic_memberships
        where clinic_id = _clinic_id and is_active = true;

        if v_op = 'gte' and v_collaborator_count < v_val then
          return jsonb_build_object(
            'valid', false,
            'message', 'Sua clínica precisa ter pelo menos ' || v_val || ' colaboradores ativos para aplicar este cupom (atual: ' || v_collaborator_count || ').'
          );
        elsif v_op = 'lte' and v_collaborator_count > v_val then
          return jsonb_build_object(
            'valid', false,
            'message', 'Este cupom é restrito a equipes de até ' || v_val || ' colaboradores (atual: ' || v_collaborator_count || ').'
          );
        elsif v_op = 'eq' and v_collaborator_count <> v_val then
          return jsonb_build_object(
            'valid', false,
            'message', 'Este cupom exige exatamente ' || v_val || ' colaboradores registrados (atual: ' || v_collaborator_count || ').'
          );
        end if;
      end if;

      -- 7.3 Quantidade de Atendimentos Realizados (sessões clínicas)
      if (v_rules->'sessions'->>'enabled')::boolean is true then
        v_op := coalesce(v_rules->'sessions'->>'operator', 'gte');
        v_val := coalesce((v_rules->'sessions'->>'value')::integer, 0);

        select count(*)::integer into v_session_count
        from public.sessions
        where clinic_id = _clinic_id;

        if v_op = 'gte' and v_session_count < v_val then
          return jsonb_build_object(
            'valid', false,
            'message', 'Sua clínica precisa ter no mínimo ' || v_val || ' atendimentos registrados para desbloquear este cupom (atual: ' || v_session_count || ').'
          );
        elsif v_op = 'lte' and v_session_count > v_val then
          return jsonb_build_object(
            'valid', false,
            'message', 'Este cupom é exclusivo para clínicas com até ' || v_val || ' atendimentos (atual: ' || v_session_count || ').'
          );
        elsif v_op = 'eq' and v_session_count <> v_val then
          return jsonb_build_object(
            'valid', false,
            'message', 'Este cupom exige exatamente ' || v_val || ' atendimentos realizados (atual: ' || v_session_count || ').'
          );
        end if;
      end if;

      -- 7.4 Sugestão 1: Apenas Primeira Assinatura / Novos Clientes
      if (v_rules->>'first_subscription_only')::boolean is true then
        select count(*)::integer into v_paid_invoices_count
        from public.subscription_invoices
        where clinic_id = _clinic_id and status in ('CONFIRMED', 'RECEIVED');

        if v_paid_invoices_count > 0 then
          return jsonb_build_object(
            'valid', false,
            'message', 'Este cupom de boas-vindas é exclusivo para novos clientes na primeira contratação.'
          );
        end if;
      end if;

      -- 7.5 Sugestão 2: Quantidade de Pacientes Cadastrados
      if (v_rules->'patients'->>'enabled')::boolean is true then
        v_op := coalesce(v_rules->'patients'->>'operator', 'gte');
        v_val := coalesce((v_rules->'patients'->>'value')::integer, 0);

        select count(*)::integer into v_patient_count
        from public.patients
        where clinic_id = _clinic_id;

        if v_op = 'gte' and v_patient_count < v_val then
          return jsonb_build_object(
            'valid', false,
            'message', 'Sua clínica precisa ter pelo menos ' || v_val || ' pacientes cadastrados para este cupom (atual: ' || v_patient_count || ').'
          );
        elsif v_op = 'lte' and v_patient_count > v_val then
          return jsonb_build_object(
            'valid', false,
            'message', 'Este cupom é voltado para consultórios com até ' || v_val || ' pacientes (atual: ' || v_patient_count || ').'
          );
        elsif v_op = 'eq' and v_patient_count <> v_val then
          return jsonb_build_object(
            'valid', false,
            'message', 'Este cupom exige exatamente ' || v_val || ' pacientes cadastrados (atual: ' || v_patient_count || ').'
          );
        end if;
      end if;

      -- 7.6 Sugestão 4: Condição Winback (Apenas Clínicas Inativas/Canceladas)
      if (v_rules->>'winback_only')::boolean is true then
        select exists (
          select 1 from public.clinic_subscriptions
          where clinic_id = _clinic_id
            and status in ('CANCELED', 'EXPIRED', 'SUSPENDED', 'OVERDUE')
        ) into v_is_winback;

        if not v_is_winback and v_clinic.access_status not in ('suspended', 'blocked', 'past_due') then
          return jsonb_build_object(
            'valid', false,
            'message', 'Este cupom de reativação é exclusivo para contas inativas ou que estão retornando à plataforma.'
          );
        end if;
      end if;

      -- 7.7 Sugestão 5: Filtro Regional por Estado (UF)
      v_allowed_states := v_rules->'allowed_states';
      if v_allowed_states is not null and jsonb_typeof(v_allowed_states) = 'array' and jsonb_array_length(v_allowed_states) > 0 then
        if v_clinic.address_state is null or not (v_allowed_states ? upper(trim(v_clinic.address_state))) then
          return jsonb_build_object(
            'valid', false,
            'message', 'Este cupom é restrito a clínicas sediadas em estados específicos atendidos pela parceria regional.'
          );
        end if;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'valid', true,
    'coupon_id', v_coupon.id,
    'code', v_coupon.code,
    'description', v_coupon.description,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'discount_duration_type', v_coupon.discount_duration_type,
    'discount_duration_months', v_coupon.discount_duration_months,
    'message', 'Cupom aplicado com sucesso!'
  );
end;
$$;


ALTER FUNCTION "public"."validate_subscription_coupon"("_code" "text", "_plan_type" "text", "_clinic_id" "uuid", "_billing_cycle" "text") OWNER TO "postgres";


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


ALTER FUNCTION "public"."validate_user_clinic"("_user_id" "uuid", "_cnpj" "text") OWNER TO "postgres";


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


ALTER FUNCTION "public"."verify_password_recovery_identity"("_email" "text", "_cpf" "text") OWNER TO "postgres";


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
    CONSTRAINT "agenda_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['atendimento'::"text", 'reuniao'::"text", 'evento'::"text"]))),
    CONSTRAINT "agenda_events_payment_plan_session_index_check" CHECK ((("payment_plan_session_index" IS NULL) OR ("payment_plan_session_index" >= 1))),
    CONSTRAINT "agenda_events_status_check" CHECK (("status" = ANY (ARRAY['lembrete'::"text", 'aguardando_confirmacao'::"text", 'confirmado'::"text", 'cancelado'::"text"])))
);


ALTER TABLE "public"."agenda_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."anamnesis_form_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "schema" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_system_default" boolean DEFAULT false NOT NULL,
    CONSTRAINT "anamnesis_form_templates_schema_shape_check" CHECK ((("jsonb_typeof"("schema") = 'array'::"text") AND
CASE
    WHEN ("jsonb_typeof"("schema") = 'array'::"text") THEN ("jsonb_array_length"("schema") <= 200)
    ELSE false
END))
);


ALTER TABLE "public"."anamnesis_form_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "clinic_id" "uuid",
    "actor_user_id" "uuid",
    "category" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "action_label" "text",
    "action_url" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source_event_id" "uuid",
    "read_at" timestamp with time zone,
    "dismissed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "app_notifications_body_check" CHECK ((("char_length"("body") >= 1) AND ("char_length"("body") <= 1000))),
    CONSTRAINT "app_notifications_category_check" CHECK (("category" = ANY (ARRAY['security'::"text", 'clinic_access'::"text", 'patient'::"text", 'session'::"text", 'reminder'::"text", 'system'::"text"]))),
    CONSTRAINT "app_notifications_event_type_check" CHECK ((("char_length"("event_type") >= 1) AND ("char_length"("event_type") <= 120))),
    CONSTRAINT "app_notifications_title_check" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 160)))
);


ALTER TABLE "public"."app_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."asaas_webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "asaas_event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "processed" boolean DEFAULT false,
    "processed_at" timestamp with time zone,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "signature" "text"
);


ALTER TABLE "public"."asaas_webhook_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clinic_collaborator_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "operational_role" "public"."operational_role_type" DEFAULT 'professional'::"public"."operational_role_type" NOT NULL,
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
    CONSTRAINT "clinic_collaborator_invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'cancelled'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."clinic_collaborator_invitations" OWNER TO "postgres";


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


ALTER TABLE "public"."clinic_group_color_slots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clinic_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "account_role" "public"."account_role_type",
    "operational_role" "public"."operational_role_type" DEFAULT 'professional'::"public"."operational_role_type" NOT NULL,
    "membership_status" "public"."membership_status_type" DEFAULT 'active'::"public"."membership_status_type" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "invited_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."clinic_memberships" OWNER TO "postgres";


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

ALTER TABLE ONLY "public"."clinic_operational_role_capabilities" REPLICA IDENTITY FULL;


ALTER TABLE "public"."clinic_operational_role_capabilities" OWNER TO "postgres";


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


ALTER TABLE "public"."clinic_operational_roles" OWNER TO "postgres";


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
    CONSTRAINT "clinic_subscriptions_discount_fixed_amount_check" CHECK (("discount_fixed_amount" >= (0)::numeric)),
    CONSTRAINT "clinic_subscriptions_discount_percentage_check" CHECK ((("discount_percentage" >= (0)::numeric) AND ("discount_percentage" <= (100)::numeric))),
    CONSTRAINT "clinic_subscriptions_status_check" CHECK (("status" = ANY (ARRAY['ACTIVE'::"text", 'PENDING'::"text", 'TRIAL'::"text", 'TRIAL_EXPIRED'::"text", 'BETA'::"text", 'OVERDUE'::"text", 'PAUSED'::"text", 'CANCELED'::"text", 'SUSPENDED'::"text", 'EXPIRED'::"text", 'COURTESY'::"text"])))
);


ALTER TABLE "public"."clinic_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clinic_tag_relations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."clinic_tag_relations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clinic_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#808080'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."clinic_tags" OWNER TO "postgres";


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


ALTER TABLE "public"."clinic_terms" OWNER TO "postgres";


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
    CONSTRAINT "clinics_access_status_check" CHECK (("access_status" = ANY (ARRAY['active'::"text", 'payment_pending'::"text", 'temporarily_paused'::"text", 'banned'::"text"]))),
    CONSTRAINT "clinics_anamnesis_base_schema_shape_check" CHECK ((("jsonb_typeof"("anamnesis_base_schema") = 'array'::"text") AND
CASE
    WHEN ("jsonb_typeof"("anamnesis_base_schema") = 'array'::"text") THEN ("jsonb_array_length"("anamnesis_base_schema") <= 200)
    ELSE false
END))
);


ALTER TABLE "public"."clinics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_form_template_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "author_name" "text" NOT NULL,
    "clinic_name" "text",
    "content" "text" NOT NULL,
    "rating" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "community_form_template_comments_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."community_form_template_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_form_template_likes" (
    "template_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."community_form_template_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_form_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "author_name" "text" NOT NULL,
    "clinic_name" "text",
    "title" "text" NOT NULL,
    "description" "text",
    "category" "text" DEFAULT 'Geral'::"text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "schema" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "kind" "text" DEFAULT 'template'::"text" NOT NULL,
    "imports_count" integer DEFAULT 0 NOT NULL,
    "likes_count" integer DEFAULT 0 NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "is_published" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fields_count" smallint DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."community_form_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feature_flags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "scope" "public"."feature_flag_scope" DEFAULT 'global'::"public"."feature_flag_scope" NOT NULL,
    "clinic_id" "uuid",
    "value" "jsonb" DEFAULT 'false'::"jsonb" NOT NULL,
    "description" "text",
    "starts_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "reason" "text",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tag_id" "uuid",
    CONSTRAINT "feature_flags_key_not_blank" CHECK (("btrim"("key") <> ''::"text")),
    CONSTRAINT "feature_flags_scope_check" CHECK ((((("scope")::"text" = 'global'::"text") AND ("clinic_id" IS NULL) AND ("tag_id" IS NULL)) OR ((("scope")::"text" = 'clinic'::"text") AND ("clinic_id" IS NOT NULL) AND ("tag_id" IS NULL)) OR ((("scope")::"text" = 'tag'::"text") AND ("tag_id" IS NOT NULL) AND ("clinic_id" IS NULL))))
);


ALTER TABLE "public"."feature_flags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."governance_rules" (
    "key" "text" NOT NULL,
    "value" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."governance_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patient_clinical_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "change_note" "text",
    "changed_fields" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "change_summary" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "snapshot_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."patient_clinical_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patient_evolution_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "custom_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."patient_evolution_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patient_file_uploads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "session_id" "uuid",
    "uploaded_by_user_id" "uuid" NOT NULL,
    "provider" "text" DEFAULT 'backblaze_b2'::"text" NOT NULL,
    "bucket_name" "text" NOT NULL,
    "object_key" "text" NOT NULL,
    "original_filename" "text" NOT NULL,
    "content_type" "text" NOT NULL,
    "byte_size" bigint NOT NULL,
    "checksum_sha256" "text",
    "category" "public"."patient_file_upload_category" DEFAULT 'other'::"public"."patient_file_upload_category" NOT NULL,
    "status" "public"."patient_file_upload_status" DEFAULT 'pending'::"public"."patient_file_upload_status" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "upload_expires_at" timestamp with time zone DEFAULT ("now"() + '00:15:00'::interval) NOT NULL,
    "uploaded_at" timestamp with time zone,
    "last_accessed_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "original_byte_size" bigint DEFAULT 0,
    "stored_byte_size" bigint DEFAULT 0,
    "original_content_type" "text",
    "stored_content_type" "text",
    "storage_encoding" "text",
    "compression_profile" "text" DEFAULT 'original'::"text",
    "image_width" integer,
    "image_height" integer,
    "page_count" integer,
    CONSTRAINT "patient_file_uploads_bucket_not_blank" CHECK (("btrim"("bucket_name") <> ''::"text")),
    CONSTRAINT "patient_file_uploads_deleted_status_valid" CHECK (((("status" = 'deleted'::"public"."patient_file_upload_status") AND ("deleted_at" IS NOT NULL)) OR ("status" <> 'deleted'::"public"."patient_file_upload_status"))),
    CONSTRAINT "patient_file_uploads_filename_not_blank" CHECK (("btrim"("original_filename") <> ''::"text")),
    CONSTRAINT "patient_file_uploads_image_dimensions_valid" CHECK (((("image_width" IS NULL) AND ("image_height" IS NULL)) OR ((COALESCE("image_width", 0) > 0) AND (COALESCE("image_height", 0) > 0) AND ("image_width" <= 20000) AND ("image_height" <= 20000)))),
    CONSTRAINT "patient_file_uploads_object_key_not_blank" CHECK (("btrim"("object_key") <> ''::"text")),
    CONSTRAINT "patient_file_uploads_original_size_valid" CHECK ((("original_byte_size" IS NULL) OR ("original_byte_size" >= 0))),
    CONSTRAINT "patient_file_uploads_page_count_valid" CHECK ((("page_count" IS NULL) OR ("page_count" > 0))),
    CONSTRAINT "patient_file_uploads_provider_valid" CHECK (("provider" = 'backblaze_b2'::"text")),
    CONSTRAINT "patient_file_uploads_sha256_valid" CHECK ((("checksum_sha256" IS NULL) OR ("checksum_sha256" ~ '^[a-f0-9]{64}$'::"text"))),
    CONSTRAINT "patient_file_uploads_size_valid" CHECK ((("byte_size" > 0) AND ("byte_size" <= 52428800))),
    CONSTRAINT "patient_file_uploads_storage_encoding_valid" CHECK ((("storage_encoding" IS NULL) OR ("storage_encoding" = ANY (ARRAY['gzip'::"text", 'deflate'::"text"])))),
    CONSTRAINT "patient_file_uploads_stored_size_valid" CHECK ((("stored_byte_size" IS NULL) OR ("stored_byte_size" >= 0))),
    CONSTRAINT "patient_file_uploads_uploaded_status_valid" CHECK (((("status" = 'uploaded'::"public"."patient_file_upload_status") AND ("uploaded_at" IS NOT NULL)) OR ("status" <> 'uploaded'::"public"."patient_file_upload_status")))
);


ALTER TABLE "public"."patient_file_uploads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patient_group_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "normalized_name" "text" NOT NULL,
    "color" "text" DEFAULT 'lavender'::"text" NOT NULL,
    "status" "text" DEFAULT 'em_andamento'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "clinic_color_slot_id" "uuid",
    CONSTRAINT "patient_group_templates_name_not_blank" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "patient_group_templates_normalized_name_not_blank" CHECK (("btrim"("normalized_name") <> ''::"text")),
    CONSTRAINT "patient_group_templates_status_check" CHECK (("status" = ANY (ARRAY['em_andamento'::"text", 'pausado'::"text", 'concluido'::"text", 'cancelado'::"text", 'inativo'::"text"])))
);


ALTER TABLE "public"."patient_group_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patient_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT 'lavender'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "clinic_id" "uuid",
    "status" "text" DEFAULT 'em_andamento'::"text",
    "is_default" boolean DEFAULT false NOT NULL,
    "clinic_color_slot_id" "uuid",
    "group_kind" "text" DEFAULT 'custom'::"text" NOT NULL,
    CONSTRAINT "patient_groups_group_kind_check" CHECK (("group_kind" = ANY (ARRAY['custom'::"text", 'default'::"text", 'cancelados'::"text"]))),
    CONSTRAINT "patient_groups_status_check" CHECK ((("status" IS NULL) OR ("status" = ANY (ARRAY['em_andamento'::"text", 'pausado'::"text", 'concluido'::"text", 'cancelado'::"text", 'inativo'::"text"]))))
);


ALTER TABLE "public"."patient_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patient_payment_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "name" "text" DEFAULT 'Pacote de Sessões'::"text" NOT NULL,
    "total_sessions" integer NOT NULL,
    "used_sessions" integer DEFAULT 0 NOT NULL,
    "total_amount_cents" bigint DEFAULT 0 NOT NULL,
    "session_unit_amount_cents" bigint DEFAULT 0 NOT NULL,
    "payment_method" "text" DEFAULT 'nao_informado'::"text" NOT NULL,
    "payment_installments" integer DEFAULT 1 NOT NULL,
    "payment_status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "payment_status_date" "date",
    "start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_user_id" "uuid",
    CONSTRAINT "patient_payment_plans_payment_installments_check" CHECK (("payment_installments" >= 1)),
    CONSTRAINT "patient_payment_plans_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['pendente'::"text", 'pago'::"text", 'parcial'::"text", 'cancelado'::"text"]))),
    CONSTRAINT "patient_payment_plans_session_unit_amount_cents_check" CHECK (("session_unit_amount_cents" >= 0)),
    CONSTRAINT "patient_payment_plans_total_amount_cents_check" CHECK (("total_amount_cents" >= 0)),
    CONSTRAINT "patient_payment_plans_total_sessions_check" CHECK (("total_sessions" > 0)),
    CONSTRAINT "patient_payment_plans_used_sessions_check" CHECK (("used_sessions" >= 0))
);


ALTER TABLE "public"."patient_payment_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patient_registration_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "clinic_id" "uuid",
    "token" "text" DEFAULT "replace"(("gen_random_uuid"())::"text", '-'::"text", ''::"text") NOT NULL,
    "password_prefix" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."patient_registration_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "age" integer,
    "phone" "text",
    "cpf" "text",
    "status" "text" DEFAULT 'ativo'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "clinic_id" "uuid",
    "date_of_birth" "date",
    "email" "text",
    "gender" "text",
    "rg" "text",
    "blood_type" "text",
    "pronoun" "text",
    "profession" "text",
    "cep" "text",
    "country" "text" DEFAULT 'Brasil'::"text",
    "state" "text",
    "city" "text",
    "neighborhood" "text",
    "street" "text",
    "address_number" "text",
    "address_complement" "text",
    "chronic_conditions" "text",
    "surgeries" "text",
    "continuous_medications" "text",
    "allergies" "text",
    "clinical_notes" "text",
    "registration_complete" boolean DEFAULT false NOT NULL,
    "clinical_profile" "jsonb",
    "emergency_contact" "jsonb",
    "origin_type" "text" DEFAULT 'outros'::"text" NOT NULL,
    "origin_referrer_name" "text",
    "origin_insurance_provider" "text",
    "origin_insurance_plan" "text",
    "origin_insurance_member_id" "text",
    "origin_other_name" "text",
    "origin_other_description" "text",
    "is_recurring" boolean DEFAULT false NOT NULL,
    "recurring_weekdays" integer[] DEFAULT '{}'::integer[] NOT NULL,
    "recurring_time" "text" DEFAULT '09:00'::"text" NOT NULL,
    "responsible_cpf" "text",
    "uses_responsible_cpf" boolean DEFAULT false NOT NULL,
    "patient_code" "text",
    CONSTRAINT "patients_origin_fields_lengths" CHECK ((("char_length"(COALESCE("origin_referrer_name", ''::"text")) <= 120) AND ("char_length"(COALESCE("origin_insurance_provider", ''::"text")) <= 120) AND ("char_length"(COALESCE("origin_insurance_plan", ''::"text")) <= 120) AND ("char_length"(COALESCE("origin_insurance_member_id", ''::"text")) <= 80) AND ("char_length"(COALESCE("origin_other_name", ''::"text")) <= 120) AND ("char_length"(COALESCE("origin_other_description", ''::"text")) <= 500))),
    CONSTRAINT "patients_origin_type_valid" CHECK (("origin_type" = ANY (ARRAY['particular'::"text", 'indicacao'::"text", 'convenio'::"text", 'filantropia'::"text", 'outros'::"text"]))),
    CONSTRAINT "patients_recurring_time_valid" CHECK (("recurring_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'::"text")),
    CONSTRAINT "patients_recurring_weekdays_valid" CHECK ((("cardinality"("recurring_weekdays") <= 7) AND ("recurring_weekdays" <@ ARRAY[0, 1, 2, 3, 4, 5, 6])))
);


ALTER TABLE "public"."patients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_admins" (
    "user_id" "uuid" NOT NULL,
    "role" "public"."platform_admin_role" DEFAULT 'platform_owner'::"public"."platform_admin_role" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "last_used_at" timestamp with time zone
);


ALTER TABLE "public"."platform_admins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_audit_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid" NOT NULL,
    "actor_platform_role" "public"."platform_admin_role" NOT NULL,
    "clinic_id" "uuid",
    "event_type" "text" NOT NULL,
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."platform_audit_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_clinic_access_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid" NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."platform_clinic_access_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_feedbacks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "clinic_id" "uuid",
    "user_email" "text",
    "user_name" "text",
    "clinic_name" "text",
    "ratings" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "average_rating" numeric(3,2),
    "problem_report" "text",
    "opinion" "text",
    "page_url" "text",
    "user_agent" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "admin_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "platform_feedbacks_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."platform_feedbacks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_release_note_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "release_id" "uuid" NOT NULL,
    "category" "public"."platform_release_note_category" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "platform_release_note_items_title_not_blank" CHECK (("btrim"("title") <> ''::"text"))
);


ALTER TABLE "public"."platform_release_note_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_releases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "version" "text" NOT NULL,
    "version_order" integer NOT NULL,
    "title" "text" NOT NULL,
    "summary" "text",
    "published_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "platform_releases_title_not_blank" CHECK (("btrim"("title") <> ''::"text")),
    CONSTRAINT "platform_releases_version_not_blank" CHECK (("btrim"("version") <> ''::"text")),
    CONSTRAINT "platform_releases_version_order_positive" CHECK (("version_order" > 0))
);


ALTER TABLE "public"."platform_releases" OWNER TO "postgres";


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
    "specialties" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "professional_license" "text",
    "bio" "text",
    "avatar_url" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cpf" "text",
    "last_seen_at" timestamp with time zone,
    "working_hours" "text",
    "public_code" "text" NOT NULL,
    "address" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_password_changed_at" timestamp with time zone,
    "password_temporary" boolean DEFAULT false NOT NULL,
    "owner_terms_accepted_at" timestamp with time zone
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


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


ALTER TABLE "public"."security_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_edit_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "editor_user_id" "uuid" NOT NULL,
    "edited_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."session_edit_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_shares" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "shared_with_user_id" "uuid" NOT NULL,
    "shared_by_user_id" "uuid" NOT NULL,
    "access_level" "text" DEFAULT 'read'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    "revoked_by_user_id" "uuid",
    CONSTRAINT "session_shares_access_level_check" CHECK (("access_level" = ANY (ARRAY['read'::"text", 'read_only'::"text", 'can_evolve'::"text"])))
);


ALTER TABLE "public"."session_shares" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "group_id" "uuid",
    "session_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'rascunho'::"text" NOT NULL,
    "anamnesis" "jsonb" DEFAULT '{}'::"jsonb",
    "treatment" "jsonb" DEFAULT '{}'::"jsonb",
    "pain_score" integer DEFAULT 0,
    "complexity_score" integer DEFAULT 0,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "clinic_id" "uuid",
    "anamnesis_template_id" "uuid",
    "anamnesis_form_response" "jsonb" DEFAULT '{}'::"jsonb",
    "provider_id" "uuid",
    "scheduled_start_at" timestamp with time zone,
    "patient_arrived_at" timestamp with time zone,
    "payment_status" "text" DEFAULT 'nao_cobrado'::"text" NOT NULL,
    "amount_charged_cents" integer DEFAULT 0 NOT NULL,
    "amount_paid_cents" integer DEFAULT 0 NOT NULL,
    "amount_original_cents" integer DEFAULT 0 NOT NULL,
    "payment_adjustment_reason" "text",
    "payment_status_date" "date",
    "payment_method" "text" DEFAULT 'nao_informado'::"text" NOT NULL,
    "payment_installments" smallint DEFAULT 1 NOT NULL,
    "payment_plan_id" "uuid",
    "payment_plan_session_index" integer,
    "parent_session_id" "uuid",
    "evolution_group_id" "uuid",
    CONSTRAINT "sessions_amount_charged_cents_nonnegative" CHECK (("amount_charged_cents" >= 0)),
    CONSTRAINT "sessions_amount_charged_cents_reasonable" CHECK ((("amount_charged_cents" >= 0) AND ("amount_charged_cents" <= 10000000))),
    CONSTRAINT "sessions_amount_original_cents_range" CHECK ((("amount_original_cents" >= 0) AND ("amount_original_cents" <= 10000000))),
    CONSTRAINT "sessions_amount_paid_cents_nonnegative" CHECK (("amount_paid_cents" >= 0)),
    CONSTRAINT "sessions_amount_paid_cents_reasonable" CHECK ((("amount_paid_cents" >= 0) AND ("amount_paid_cents" <= 10000000))),
    CONSTRAINT "sessions_patient_arrived_at_reasonable" CHECK ((("patient_arrived_at" IS NULL) OR (("patient_arrived_at" >= '2000-01-01 00:00:00+00'::timestamp with time zone) AND ("patient_arrived_at" < '2101-01-01 00:00:00+00'::timestamp with time zone)))),
    CONSTRAINT "sessions_payment_adjustment_reason_length" CHECK ((("payment_adjustment_reason" IS NULL) OR ("char_length"("payment_adjustment_reason") <= 240))),
    CONSTRAINT "sessions_payment_installments_range" CHECK ((("payment_installments" >= 1) AND ("payment_installments" <= 12))),
    CONSTRAINT "sessions_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['dinheiro'::"text", 'pix'::"text", 'cartao_debito'::"text", 'cartao_credito'::"text", 'convenio'::"text", 'transferencia'::"text", 'credito_usado'::"text", 'cortesia'::"text", 'nao_informado'::"text"]))),
    CONSTRAINT "sessions_payment_plan_session_index_check" CHECK ((("payment_plan_session_index" IS NULL) OR ("payment_plan_session_index" >= 1))),
    CONSTRAINT "sessions_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['nao_cobrado'::"text", 'pendente'::"text", 'parcial'::"text", 'pago'::"text", 'credito'::"text", 'cortesia'::"text"]))),
    CONSTRAINT "sessions_payment_status_date_range" CHECK ((("payment_status_date" IS NULL) OR (("payment_status_date" >= '2000-01-01'::"date") AND ("payment_status_date" <= '2100-12-31'::"date")))),
    CONSTRAINT "sessions_scheduled_start_at_reasonable" CHECK ((("scheduled_start_at" IS NULL) OR (("scheduled_start_at" >= '2000-01-01 00:00:00+00'::timestamp with time zone) AND ("scheduled_start_at" < '2101-01-01 00:00:00+00'::timestamp with time zone))))
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_coupons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "description" "text",
    "discount_type" "text" NOT NULL,
    "discount_value" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "max_redemptions" integer,
    "times_redeemed" integer DEFAULT 0 NOT NULL,
    "valid_from" timestamp with time zone DEFAULT "now"() NOT NULL,
    "valid_until" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "applicable_plans" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "discount_duration_type" "text" DEFAULT 'FOREVER'::"text" NOT NULL,
    "discount_duration_months" integer,
    "eligibility_rules" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "subscription_coupons_code_check" CHECK ((("code" = "upper"(TRIM(BOTH FROM "code"))) AND ("length"("code") >= 3))),
    CONSTRAINT "subscription_coupons_discount_duration_months_check" CHECK ((("discount_duration_months" IS NULL) OR ("discount_duration_months" > 0))),
    CONSTRAINT "subscription_coupons_discount_duration_type_check" CHECK (("discount_duration_type" = ANY (ARRAY['ONCE'::"text", 'REPEATING'::"text", 'FOREVER'::"text"]))),
    CONSTRAINT "subscription_coupons_discount_type_check" CHECK (("discount_type" = ANY (ARRAY['PERCENTAGE'::"text", 'FIXED_AMOUNT'::"text", 'TRIAL_DAYS'::"text"]))),
    CONSTRAINT "subscription_coupons_discount_value_check" CHECK (("discount_value" >= (0)::numeric)),
    CONSTRAINT "subscription_coupons_max_redemptions_check" CHECK ((("max_redemptions" IS NULL) OR ("max_redemptions" > 0))),
    CONSTRAINT "subscription_coupons_times_redeemed_check" CHECK (("times_redeemed" >= 0))
);


ALTER TABLE "public"."subscription_coupons" OWNER TO "postgres";


COMMENT ON COLUMN "public"."subscription_coupons"."discount_duration_type" IS 'Duração do desconto: ONCE (1ª fatura), REPEATING (por X meses), FOREVER (vitalício/todas as faturas)';



COMMENT ON COLUMN "public"."subscription_coupons"."discount_duration_months" IS 'Quantidade de meses/renovações quando discount_duration_type = REPEATING';



COMMENT ON COLUMN "public"."subscription_coupons"."eligibility_rules" IS 'Configurações de elegibilidade da conta: data de criação, colaboradores, sessões, novos clientes, pacientes, ciclos, winback, estados';



CREATE TABLE IF NOT EXISTS "public"."subscription_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "subscription_id" "uuid",
    "asaas_payment_id" "text" NOT NULL,
    "charge_type" "text" DEFAULT 'RECURRING_SUBSCRIPTION'::"text" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "value" numeric(10,2) NOT NULL,
    "net_value" numeric(10,2),
    "due_date" "date" NOT NULL,
    "payment_date" timestamp with time zone,
    "billing_type" "text",
    "invoice_url" "text",
    "bank_slip_url" "text",
    "pix_qr_code" "text",
    "pix_copy_paste" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "asaas_customer_id" "text",
    "asaas_subscription_id" "text",
    "discount_amount" numeric(10,2) DEFAULT 0.00,
    "original_value" numeric(10,2),
    "pix_expiration_date" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "installment_number" integer DEFAULT 1,
    "total_installments" integer DEFAULT 1,
    CONSTRAINT "subscription_invoices_charge_type_check" CHECK (("charge_type" = ANY (ARRAY['RECURRING_SUBSCRIPTION'::"text", 'ONE_TIME_SUBACCOUNT_EXPANSION'::"text"]))),
    CONSTRAINT "subscription_invoices_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'RECEIVED'::"text", 'CONFIRMED'::"text", 'OVERDUE'::"text", 'REFUNDED'::"text", 'DELETED'::"text", 'DUNNING_RECEIVED'::"text", 'RECEIVED_IN_CASH'::"text", 'AWAITING_PAYMENT'::"text"])))
);


ALTER TABLE "public"."subscription_invoices" OWNER TO "postgres";


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


ALTER TABLE "public"."team_development_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."telemetry_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid",
    "user_id" "uuid",
    "user_name" "text",
    "event_type" "text" NOT NULL,
    "pathname" "text" NOT NULL,
    "resource_type" "text",
    "resource_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."telemetry_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_active_clinic_contexts" (
    "user_id" "uuid" NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_active_clinic_contexts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_governance_overrides" (
    "user_id" "uuid" NOT NULL,
    "max_actions" integer DEFAULT 150 NOT NULL,
    "time_window_minutes" integer DEFAULT 5 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_governance_overrides" OWNER TO "postgres";


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


ALTER TABLE "public"."user_punishments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_release_note_states" (
    "user_id" "uuid" NOT NULL,
    "last_seen_release_id" "uuid",
    "last_seen_release_order" integer DEFAULT 0 NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_release_note_states" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_security_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "clinic_id" "uuid",
    "session_key" "text" NOT NULL,
    "browser" "text",
    "platform" "text",
    "device_label" "text",
    "user_agent" "text",
    "signed_in_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "force_signed_out_at" timestamp with time zone,
    "forced_out_by" "uuid"
);


ALTER TABLE "public"."user_security_sessions" OWNER TO "postgres";


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


ALTER TABLE "public"."user_security_settings" OWNER TO "postgres";


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
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_telemetry_summaries" OWNER TO "postgres";


ALTER TABLE ONLY "public"."agenda_events"
    ADD CONSTRAINT "agenda_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."anamnesis_form_templates"
    ADD CONSTRAINT "anamnesis_form_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_notifications"
    ADD CONSTRAINT "app_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."asaas_webhook_events"
    ADD CONSTRAINT "asaas_webhook_events_asaas_event_id_key" UNIQUE ("asaas_event_id");



ALTER TABLE ONLY "public"."asaas_webhook_events"
    ADD CONSTRAINT "asaas_webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clinic_collaborator_invitations"
    ADD CONSTRAINT "clinic_collaborator_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clinic_collaborator_invitations"
    ADD CONSTRAINT "clinic_collaborator_invitations_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."clinic_group_color_slots"
    ADD CONSTRAINT "clinic_group_color_slots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clinic_memberships"
    ADD CONSTRAINT "clinic_memberships_clinic_id_user_id_key" UNIQUE ("clinic_id", "user_id");



ALTER TABLE ONLY "public"."clinic_memberships"
    ADD CONSTRAINT "clinic_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clinic_operational_role_capabilities"
    ADD CONSTRAINT "clinic_operational_role_capabilities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clinic_operational_role_capabilities"
    ADD CONSTRAINT "clinic_operational_role_capabilities_unique" UNIQUE ("clinic_id", "operational_role", "capability");



ALTER TABLE ONLY "public"."clinic_operational_roles"
    ADD CONSTRAINT "clinic_operational_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clinic_operational_roles"
    ADD CONSTRAINT "clinic_operational_roles_unique" UNIQUE ("clinic_id", "role_key");



ALTER TABLE ONLY "public"."clinic_subscriptions"
    ADD CONSTRAINT "clinic_subscriptions_clinic_id_key" UNIQUE ("clinic_id");



ALTER TABLE ONLY "public"."clinic_subscriptions"
    ADD CONSTRAINT "clinic_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clinic_tag_relations"
    ADD CONSTRAINT "clinic_tag_relations_clinic_id_tag_id_key" UNIQUE ("clinic_id", "tag_id");



ALTER TABLE ONLY "public"."clinic_tag_relations"
    ADD CONSTRAINT "clinic_tag_relations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clinic_tags"
    ADD CONSTRAINT "clinic_tags_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."clinic_tags"
    ADD CONSTRAINT "clinic_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clinic_terms"
    ADD CONSTRAINT "clinic_terms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clinic_terms"
    ADD CONSTRAINT "clinic_terms_clinic_type_unique" UNIQUE ("clinic_id", "term_type");



ALTER TABLE ONLY "public"."clinics"
    ADD CONSTRAINT "clinics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_form_template_comments"
    ADD CONSTRAINT "community_form_template_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_form_template_likes"
    ADD CONSTRAINT "community_form_template_likes_pkey" PRIMARY KEY ("template_id", "user_id");



ALTER TABLE ONLY "public"."community_form_templates"
    ADD CONSTRAINT "community_form_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feature_flags"
    ADD CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."governance_rules"
    ADD CONSTRAINT "governance_rules_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."patient_clinical_snapshots"
    ADD CONSTRAINT "patient_clinical_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_evolution_groups"
    ADD CONSTRAINT "patient_evolution_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_file_uploads"
    ADD CONSTRAINT "patient_file_uploads_bucket_key_unique" UNIQUE ("bucket_name", "object_key");



ALTER TABLE ONLY "public"."patient_file_uploads"
    ADD CONSTRAINT "patient_file_uploads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_group_templates"
    ADD CONSTRAINT "patient_group_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_groups"
    ADD CONSTRAINT "patient_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_payment_plans"
    ADD CONSTRAINT "patient_payment_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_registration_links"
    ADD CONSTRAINT "patient_registration_links_patient_id_key" UNIQUE ("patient_id");



ALTER TABLE ONLY "public"."patient_registration_links"
    ADD CONSTRAINT "patient_registration_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_registration_links"
    ADD CONSTRAINT "patient_registration_links_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_admins"
    ADD CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."platform_audit_events"
    ADD CONSTRAINT "platform_audit_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_clinic_access_sessions"
    ADD CONSTRAINT "platform_clinic_access_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_feedbacks"
    ADD CONSTRAINT "platform_feedbacks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_release_note_items"
    ADD CONSTRAINT "platform_release_note_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_releases"
    ADD CONSTRAINT "platform_releases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_events"
    ADD CONSTRAINT "security_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_edit_history"
    ADD CONSTRAINT "session_edit_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_shares"
    ADD CONSTRAINT "session_shares_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_coupons"
    ADD CONSTRAINT "subscription_coupons_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."subscription_coupons"
    ADD CONSTRAINT "subscription_coupons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_invoices"
    ADD CONSTRAINT "subscription_invoices_asaas_payment_id_key" UNIQUE ("asaas_payment_id");



ALTER TABLE ONLY "public"."subscription_invoices"
    ADD CONSTRAINT "subscription_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_development_profiles"
    ADD CONSTRAINT "team_development_profiles_clinic_id_user_id_key" UNIQUE ("clinic_id", "user_id");



ALTER TABLE ONLY "public"."team_development_profiles"
    ADD CONSTRAINT "team_development_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."telemetry_events"
    ADD CONSTRAINT "telemetry_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_active_clinic_contexts"
    ADD CONSTRAINT "user_active_clinic_contexts_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_governance_overrides"
    ADD CONSTRAINT "user_governance_overrides_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_punishments"
    ADD CONSTRAINT "user_punishments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_release_note_states"
    ADD CONSTRAINT "user_release_note_states_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "public"."user_security_sessions"
    ADD CONSTRAINT "user_security_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_security_sessions"
    ADD CONSTRAINT "user_security_sessions_session_key_key" UNIQUE ("session_key");



ALTER TABLE ONLY "public"."user_security_settings"
    ADD CONSTRAINT "user_security_settings_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_telemetry_summaries"
    ADD CONSTRAINT "user_telemetry_summaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_telemetry_summaries"
    ADD CONSTRAINT "user_telemetry_summary_unique" UNIQUE ("user_id", "clinic_id", "summary_date");



CREATE UNIQUE INDEX "clinics_route_key_key" ON "public"."clinics" USING "btree" ("route_key");



CREATE UNIQUE INDEX "feature_flags_clinic_key_key" ON "public"."feature_flags" USING "btree" ("clinic_id", "key") WHERE ("scope" = 'clinic'::"public"."feature_flag_scope");



CREATE UNIQUE INDEX "feature_flags_global_key_key" ON "public"."feature_flags" USING "btree" ("key") WHERE ("scope" = 'global'::"public"."feature_flag_scope");



CREATE UNIQUE INDEX "feature_flags_tag_key_key" ON "public"."feature_flags" USING "btree" ("tag_id", "key") WHERE ("scope" = 'tag'::"public"."feature_flag_scope");



CREATE INDEX "idx_agenda_events_auto_cancel_due" ON "public"."agenda_events" USING "btree" ("scheduled_for") WHERE (("event_type" = 'atendimento'::"text") AND ("patient_id" IS NOT NULL) AND ("status" <> 'cancelado'::"text"));



CREATE INDEX "idx_agenda_events_clinic_id" ON "public"."agenda_events" USING "btree" ("clinic_id");



CREATE INDEX "idx_agenda_events_generated_recurrence" ON "public"."agenda_events" USING "btree" ("patient_id", "scheduled_for") WHERE ("generated_by_recurring_patient" = true);



CREATE INDEX "idx_agenda_events_patient_id" ON "public"."agenda_events" USING "btree" ("patient_id");



CREATE INDEX "idx_agenda_events_payment_plan_id" ON "public"."agenda_events" USING "btree" ("payment_plan_id");



CREATE INDEX "idx_agenda_events_scheduled_for" ON "public"."agenda_events" USING "btree" ("scheduled_for");



CREATE INDEX "idx_agenda_events_status" ON "public"."agenda_events" USING "btree" ("status");



CREATE INDEX "idx_agenda_events_user_id" ON "public"."agenda_events" USING "btree" ("user_id");



CREATE INDEX "idx_anamnesis_form_templates_clinic_id" ON "public"."anamnesis_form_templates" USING "btree" ("clinic_id");



CREATE UNIQUE INDEX "idx_app_notifications_source_event_id" ON "public"."app_notifications" USING "btree" ("source_event_id") WHERE ("source_event_id" IS NOT NULL);



CREATE INDEX "idx_app_notifications_user_created" ON "public"."app_notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_app_notifications_user_unread" ON "public"."app_notifications" USING "btree" ("user_id", "created_at" DESC) WHERE ("read_at" IS NULL);



CREATE INDEX "idx_app_notifications_user_visible_created" ON "public"."app_notifications" USING "btree" ("user_id", "dismissed_at", "created_at" DESC);



CREATE INDEX "idx_asaas_webhook_events_asaas_event_id" ON "public"."asaas_webhook_events" USING "btree" ("asaas_event_id");



CREATE INDEX "idx_clinic_collaborator_invitations_clinic_id" ON "public"."clinic_collaborator_invitations" USING "btree" ("clinic_id");



CREATE INDEX "idx_clinic_collaborator_invitations_email" ON "public"."clinic_collaborator_invitations" USING "btree" ("lower"("email"));



CREATE INDEX "idx_clinic_group_color_slots_clinic_id" ON "public"."clinic_group_color_slots" USING "btree" ("clinic_id");



CREATE UNIQUE INDEX "idx_clinic_group_color_slots_clinic_slot" ON "public"."clinic_group_color_slots" USING "btree" ("clinic_id", "slot_index");



CREATE INDEX "idx_clinic_memberships_clinic_id" ON "public"."clinic_memberships" USING "btree" ("clinic_id");



CREATE INDEX "idx_clinic_memberships_user_active_joined" ON "public"."clinic_memberships" USING "btree" ("user_id", "is_active", "membership_status", "joined_at");



CREATE INDEX "idx_clinic_memberships_user_id" ON "public"."clinic_memberships" USING "btree" ("user_id");



CREATE INDEX "idx_clinic_subscriptions_asaas_customer_id" ON "public"."clinic_subscriptions" USING "btree" ("asaas_customer_id");



CREATE INDEX "idx_clinic_subscriptions_asaas_subscription_id" ON "public"."clinic_subscriptions" USING "btree" ("asaas_subscription_id");



CREATE INDEX "idx_clinic_subscriptions_clinic_id" ON "public"."clinic_subscriptions" USING "btree" ("clinic_id");



CREATE INDEX "idx_clinic_subscriptions_coupon_code" ON "public"."clinic_subscriptions" USING "btree" ("coupon_code");



CREATE INDEX "idx_clinic_terms_clinic_id" ON "public"."clinic_terms" USING "btree" ("clinic_id");



CREATE INDEX "idx_clinics_id_access_status" ON "public"."clinics" USING "btree" ("id", "access_status");



CREATE INDEX "idx_community_form_template_likes_user" ON "public"."community_form_template_likes" USING "btree" ("user_id");



CREATE INDEX "idx_community_form_templates_created_at" ON "public"."community_form_templates" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_community_form_templates_published" ON "public"."community_form_templates" USING "btree" ("is_published", "category");



CREATE INDEX "idx_community_form_templates_user_id" ON "public"."community_form_templates" USING "btree" ("user_id");



CREATE INDEX "idx_community_template_comments_template" ON "public"."community_form_template_comments" USING "btree" ("template_id", "created_at" DESC);



CREATE INDEX "idx_community_template_comments_user" ON "public"."community_form_template_comments" USING "btree" ("user_id");



CREATE INDEX "idx_community_templates_active_catalog" ON "public"."community_form_templates" USING "btree" ("category", "imports_count" DESC, "created_at" DESC) WHERE ("is_published" = true);



CREATE INDEX "idx_feature_flags_scope_clinic" ON "public"."feature_flags" USING "btree" ("scope", "clinic_id");



CREATE INDEX "idx_feature_flags_scope_tag" ON "public"."feature_flags" USING "btree" ("scope", "tag_id");



CREATE INDEX "idx_patient_clinical_snapshots_patient_created_at" ON "public"."patient_clinical_snapshots" USING "btree" ("patient_id", "created_at" DESC);



CREATE INDEX "idx_patient_evolution_groups_clinic_id" ON "public"."patient_evolution_groups" USING "btree" ("clinic_id");



CREATE INDEX "idx_patient_evolution_groups_patient_id" ON "public"."patient_evolution_groups" USING "btree" ("patient_id");



CREATE INDEX "idx_patient_file_uploads_patient_created" ON "public"."patient_file_uploads" USING "btree" ("clinic_id", "patient_id", "created_at" DESC);



CREATE INDEX "idx_patient_file_uploads_session" ON "public"."patient_file_uploads" USING "btree" ("session_id", "created_at" DESC) WHERE ("session_id" IS NOT NULL);



CREATE INDEX "idx_patient_file_uploads_status" ON "public"."patient_file_uploads" USING "btree" ("status", "upload_expires_at") WHERE ("status" = 'pending'::"public"."patient_file_upload_status");



CREATE INDEX "idx_patient_group_templates_clinic_id" ON "public"."patient_group_templates" USING "btree" ("clinic_id");



CREATE UNIQUE INDEX "idx_patient_group_templates_clinic_normalized_name" ON "public"."patient_group_templates" USING "btree" ("clinic_id", "normalized_name");



CREATE UNIQUE INDEX "idx_patient_groups_cancelados_kind_per_patient" ON "public"."patient_groups" USING "btree" ("patient_id") WHERE ("group_kind" = 'cancelados'::"text");



CREATE INDEX "idx_patient_groups_clinic_id" ON "public"."patient_groups" USING "btree" ("clinic_id");



CREATE UNIQUE INDEX "idx_patient_groups_default_kind_per_patient" ON "public"."patient_groups" USING "btree" ("patient_id") WHERE ("group_kind" = 'default'::"text");



CREATE UNIQUE INDEX "idx_patient_groups_default_per_patient" ON "public"."patient_groups" USING "btree" ("patient_id") WHERE "is_default";



CREATE INDEX "idx_patient_groups_patient_id" ON "public"."patient_groups" USING "btree" ("patient_id");



CREATE INDEX "idx_patient_payment_plans_clinic_id" ON "public"."patient_payment_plans" USING "btree" ("clinic_id");



CREATE INDEX "idx_patient_payment_plans_patient_id" ON "public"."patient_payment_plans" USING "btree" ("patient_id");



CREATE INDEX "idx_patient_registration_links_patient_id" ON "public"."patient_registration_links" USING "btree" ("patient_id");



CREATE INDEX "idx_patient_registration_links_token" ON "public"."patient_registration_links" USING "btree" ("token");



CREATE INDEX "idx_patients_clinic_cpf_lookup" ON "public"."patients" USING "btree" ("clinic_id", "cpf") WHERE (("clinic_id" IS NOT NULL) AND ("cpf" IS NOT NULL) AND ("cpf" <> ''::"text"));



CREATE INDEX "idx_patients_clinic_name_birth_lookup" ON "public"."patients" USING "btree" ("clinic_id", "public"."normalize_patient_name_key"("name"), "date_of_birth") WHERE (("clinic_id" IS NOT NULL) AND ("name" IS NOT NULL) AND ("btrim"("name") <> ''::"text") AND ("date_of_birth" IS NOT NULL));



CREATE INDEX "idx_patients_clinic_name_key_lookup" ON "public"."patients" USING "btree" ("clinic_id", "public"."normalize_patient_name_key"("name")) WHERE (("clinic_id" IS NOT NULL) AND ("name" IS NOT NULL) AND ("btrim"("name") <> ''::"text"));



CREATE INDEX "idx_patients_clinic_updated_desc" ON "public"."patients" USING "btree" ("clinic_id", "updated_at" DESC);



CREATE INDEX "idx_patients_recurrence" ON "public"."patients" USING "btree" ("clinic_id", "is_recurring") WHERE ("is_recurring" = true);



CREATE INDEX "idx_patients_user_id" ON "public"."patients" USING "btree" ("user_id");



CREATE INDEX "idx_platform_audit_events_clinic_created_at" ON "public"."platform_audit_events" USING "btree" ("clinic_id", "created_at" DESC);



CREATE INDEX "idx_platform_audit_events_created_at" ON "public"."platform_audit_events" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "idx_platform_clinic_access_sessions_one_active" ON "public"."platform_clinic_access_sessions" USING "btree" ("actor_user_id") WHERE ("ended_at" IS NULL);



CREATE INDEX "idx_platform_feedbacks_clinic_id" ON "public"."platform_feedbacks" USING "btree" ("clinic_id");



CREATE INDEX "idx_platform_feedbacks_created_at_desc" ON "public"."platform_feedbacks" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_platform_feedbacks_status" ON "public"."platform_feedbacks" USING "btree" ("status");



CREATE INDEX "idx_platform_feedbacks_user_id" ON "public"."platform_feedbacks" USING "btree" ("user_id");



CREATE INDEX "idx_platform_release_note_items_release_category" ON "public"."platform_release_note_items" USING "btree" ("release_id", "category", "sort_order", "created_at");



CREATE INDEX "idx_platform_releases_active_order" ON "public"."platform_releases" USING "btree" ("version_order" DESC) WHERE ("is_active" = true);



CREATE INDEX "idx_profiles_clinic_id" ON "public"."profiles" USING "btree" ("clinic_id");



CREATE INDEX "idx_profiles_clean_cpf" ON "public"."profiles" USING "btree" (regexp_replace(coalesce("cpf", ''), '\D', '', 'g')) WHERE ("cpf" IS NOT NULL AND "cpf" <> '');



CREATE INDEX "idx_profiles_lower_email" ON "public"."profiles" USING "btree" (lower("email")) WHERE ("email" IS NOT NULL AND "email" <> '');



CREATE INDEX "idx_security_events_clinic_id" ON "public"."security_events" USING "btree" ("clinic_id", "created_at" DESC);



CREATE INDEX "idx_security_events_target_user_id" ON "public"."security_events" USING "btree" ("target_user_id", "created_at" DESC);



CREATE INDEX "idx_session_edit_history_edited_at" ON "public"."session_edit_history" USING "btree" ("edited_at" DESC);



CREATE INDEX "idx_session_edit_history_session_id" ON "public"."session_edit_history" USING "btree" ("session_id");



CREATE UNIQUE INDEX "idx_session_shares_active_unique" ON "public"."session_shares" USING "btree" ("session_id", "shared_with_user_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "idx_session_shares_clinic_id" ON "public"."session_shares" USING "btree" ("clinic_id");



CREATE INDEX "idx_session_shares_session_id" ON "public"."session_shares" USING "btree" ("session_id");



CREATE INDEX "idx_session_shares_shared_with_user_id" ON "public"."session_shares" USING "btree" ("shared_with_user_id");



CREATE INDEX "idx_sessions_anamnesis_template_id" ON "public"."sessions" USING "btree" ("anamnesis_template_id");



CREATE INDEX "idx_sessions_clinic_date_desc" ON "public"."sessions" USING "btree" ("clinic_id", "session_date" DESC);



CREATE INDEX "idx_sessions_clinic_patient" ON "public"."sessions" USING "btree" ("clinic_id", "patient_id");



CREATE INDEX "idx_sessions_evolution_group_id" ON "public"."sessions" USING "btree" ("evolution_group_id");



CREATE INDEX "idx_sessions_parent_session_id" ON "public"."sessions" USING "btree" ("parent_session_id");



CREATE INDEX "idx_sessions_patient_id" ON "public"."sessions" USING "btree" ("patient_id");



CREATE INDEX "idx_sessions_payment_method" ON "public"."sessions" USING "btree" ("payment_method");



CREATE INDEX "idx_sessions_payment_plan_id" ON "public"."sessions" USING "btree" ("payment_plan_id");



CREATE INDEX "idx_sessions_payment_status" ON "public"."sessions" USING "btree" ("payment_status");



CREATE INDEX "idx_sessions_scheduled_start_at" ON "public"."sessions" USING "btree" ("scheduled_start_at");



CREATE INDEX "idx_sessions_user_id" ON "public"."sessions" USING "btree" ("user_id");



CREATE INDEX "idx_subscription_coupons_code" ON "public"."subscription_coupons" USING "btree" ("code");



CREATE INDEX "idx_subscription_coupons_is_active" ON "public"."subscription_coupons" USING "btree" ("is_active");



CREATE INDEX "idx_subscription_invoices_asaas_payment_id" ON "public"."subscription_invoices" USING "btree" ("asaas_payment_id");



CREATE INDEX "idx_subscription_invoices_clinic_id" ON "public"."subscription_invoices" USING "btree" ("clinic_id");



CREATE INDEX "idx_subscription_invoices_status" ON "public"."subscription_invoices" USING "btree" ("status");



CREATE INDEX "idx_telemetry_events_clinic" ON "public"."telemetry_events" USING "btree" ("clinic_id");



CREATE INDEX "idx_telemetry_events_created_at" ON "public"."telemetry_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_telemetry_events_event_type" ON "public"."telemetry_events" USING "btree" ("event_type");



CREATE INDEX "idx_telemetry_events_user" ON "public"."telemetry_events" USING "btree" ("user_id");



CREATE INDEX "idx_user_punishments_active" ON "public"."user_punishments" USING "btree" ("user_id", "is_active");



CREATE INDEX "idx_user_punishments_expires" ON "public"."user_punishments" USING "btree" ("expires_at") WHERE ("expires_at" IS NOT NULL);



CREATE INDEX "idx_user_punishments_type" ON "public"."user_punishments" USING "btree" ("punishment_type");



CREATE INDEX "idx_user_security_sessions_active_clinic" ON "public"."user_security_sessions" USING "btree" ("clinic_id", "last_seen_at" DESC) WHERE (("ended_at" IS NULL) AND ("force_signed_out_at" IS NULL));



CREATE INDEX "idx_user_security_sessions_active_user_last_seen" ON "public"."user_security_sessions" USING "btree" ("user_id", "last_seen_at" DESC) WHERE ("ended_at" IS NULL);



CREATE INDEX "idx_user_security_sessions_last_seen_at" ON "public"."user_security_sessions" USING "btree" ("last_seen_at" DESC);



CREATE INDEX "idx_user_security_sessions_stale_cleanup" ON "public"."user_security_sessions" USING "btree" ("user_id", "ended_at", "last_seen_at");



CREATE INDEX "idx_user_security_sessions_user_id" ON "public"."user_security_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_user_telemetry_summaries_clinic" ON "public"."user_telemetry_summaries" USING "btree" ("clinic_id");



CREATE INDEX "idx_user_telemetry_summaries_date" ON "public"."user_telemetry_summaries" USING "btree" ("summary_date" DESC);



CREATE INDEX "idx_user_telemetry_summaries_spam" ON "public"."user_telemetry_summaries" USING "btree" ("is_spam_flagged") WHERE ("is_spam_flagged" = true);



CREATE INDEX "idx_user_telemetry_summaries_user" ON "public"."user_telemetry_summaries" USING "btree" ("user_id");



CREATE UNIQUE INDEX "patients_clinic_id_patient_code_key" ON "public"."patients" USING "btree" ("clinic_id", "patient_code") WHERE (("clinic_id" IS NOT NULL) AND ("patient_code" IS NOT NULL));



CREATE UNIQUE INDEX "platform_releases_version_key" ON "public"."platform_releases" USING "btree" ("version");



CREATE UNIQUE INDEX "platform_releases_version_order_key" ON "public"."platform_releases" USING "btree" ("version_order");



CREATE OR REPLACE TRIGGER "assign_profile_public_code_on_insert" BEFORE INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."assign_profile_public_code"();



CREATE OR REPLACE TRIGGER "create_default_group_for_patient" AFTER INSERT ON "public"."patients" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_default_patient_group"();



CREATE OR REPLACE TRIGGER "enforce_clinic_membership_integrity" BEFORE INSERT OR UPDATE ON "public"."clinic_memberships" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_clinic_membership_integrity"();



CREATE OR REPLACE TRIGGER "ensure_team_development_profile_from_membership" AFTER INSERT ON "public"."clinic_memberships" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_team_development_profile_from_membership"();



CREATE OR REPLACE TRIGGER "log_session_edit_history_on_update" AFTER UPDATE ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."log_session_edit_history"();



CREATE OR REPLACE TRIGGER "notification_preferences_updated_at" BEFORE UPDATE ON "public"."notification_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."touch_notification_preferences_updated_at"();



CREATE OR REPLACE TRIGGER "notify_clinic_access_session_after_insert" AFTER INSERT ON "public"."user_security_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."notify_clinic_access_session_created"();



CREATE OR REPLACE TRIGGER "notify_session_created_after_insert" AFTER INSERT ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."notify_session_created"();



CREATE OR REPLACE TRIGGER "prevent_default_group_delete" BEFORE DELETE ON "public"."patient_groups" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_default_patient_group_delete"();



CREATE OR REPLACE TRIGGER "set_clinic_operational_role_capabilities_updated_at" BEFORE UPDATE ON "public"."clinic_operational_role_capabilities" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_clinic_operational_roles_updated_at" BEFORE UPDATE ON "public"."clinic_operational_roles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_patient_code_before_insert" BEFORE INSERT ON "public"."patients" FOR EACH ROW EXECUTE FUNCTION "public"."trg_auto_assign_patient_code"();



CREATE OR REPLACE TRIGGER "tr_patient_groups_set_clinic_id" BEFORE INSERT ON "public"."patient_groups" FOR EACH ROW EXECUTE FUNCTION "public"."trg_patient_groups_set_clinic_id"();



CREATE OR REPLACE TRIGGER "trg_platform_feedbacks_updated_at" BEFORE UPDATE ON "public"."platform_feedbacks" FOR EACH ROW EXECUTE FUNCTION "public"."touch_platform_feedbacks_updated_at"();



CREATE OR REPLACE TRIGGER "trg_set_clinic_subscriptions_updated_at" BEFORE UPDATE ON "public"."clinic_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."set_clinic_subscriptions_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sync_clinic_limits_from_subscription" AFTER INSERT OR UPDATE OF "plan_type", "base_subaccount_limit", "purchased_subaccount_extra_count", "base_concurrent_access_count", "additional_concurrent_access_count" ON "public"."clinic_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."sync_clinic_limits_from_subscription"();



CREATE OR REPLACE TRIGGER "trigger_calculate_community_template_fields_count" BEFORE INSERT OR UPDATE OF "schema" ON "public"."community_form_templates" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_community_template_fields_count"();



CREATE OR REPLACE TRIGGER "update_agenda_events_updated_at" BEFORE UPDATE ON "public"."agenda_events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_anamnesis_form_templates_updated_at" BEFORE UPDATE ON "public"."anamnesis_form_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_clinic_collaborator_invitations_updated_at" BEFORE UPDATE ON "public"."clinic_collaborator_invitations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_clinic_group_color_slots_updated_at" BEFORE UPDATE ON "public"."clinic_group_color_slots" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_clinic_memberships_updated_at" BEFORE UPDATE ON "public"."clinic_memberships" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_clinics_updated_at" BEFORE UPDATE ON "public"."clinics" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_clinic_terms_updated_at" BEFORE UPDATE ON "public"."clinic_terms" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_community_form_template_comments_updated_at" BEFORE UPDATE ON "public"."community_form_template_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_community_form_templates_updated_at" BEFORE UPDATE ON "public"."community_form_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_feature_flags_updated_at" BEFORE UPDATE ON "public"."feature_flags" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_patient_evolution_groups_updated_at" BEFORE UPDATE ON "public"."patient_evolution_groups" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_patient_file_uploads_updated_at" BEFORE UPDATE ON "public"."patient_file_uploads" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_patient_group_templates_updated_at" BEFORE UPDATE ON "public"."patient_group_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_patient_payment_plans_updated_at" BEFORE UPDATE ON "public"."patient_payment_plans" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_patients_updated_at" BEFORE UPDATE ON "public"."patients" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_platform_releases_updated_at" BEFORE UPDATE ON "public"."platform_releases" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_sessions_updated_at" BEFORE UPDATE ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_team_development_profiles_updated_at" BEFORE UPDATE ON "public"."team_development_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_active_clinic_contexts_updated_at" BEFORE UPDATE ON "public"."user_active_clinic_contexts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_release_note_states_updated_at" BEFORE UPDATE ON "public"."user_release_note_states" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."agenda_events"
    ADD CONSTRAINT "agenda_events_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agenda_events"
    ADD CONSTRAINT "agenda_events_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."agenda_events"
    ADD CONSTRAINT "agenda_events_payment_plan_id_fkey" FOREIGN KEY ("payment_plan_id") REFERENCES "public"."patient_payment_plans"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."agenda_events"
    ADD CONSTRAINT "agenda_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."anamnesis_form_templates"
    ADD CONSTRAINT "anamnesis_form_templates_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."anamnesis_form_templates"
    ADD CONSTRAINT "anamnesis_form_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."app_notifications"
    ADD CONSTRAINT "app_notifications_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clinic_collaborator_invitations"
    ADD CONSTRAINT "clinic_collaborator_invitations_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clinic_collaborator_invitations"
    ADD CONSTRAINT "clinic_collaborator_invitations_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clinic_collaborator_invitations"
    ADD CONSTRAINT "clinic_collaborator_invitations_existing_user_id_fkey" FOREIGN KEY ("existing_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clinic_collaborator_invitations"
    ADD CONSTRAINT "clinic_collaborator_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clinic_group_color_slots"
    ADD CONSTRAINT "clinic_group_color_slots_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clinic_memberships"
    ADD CONSTRAINT "clinic_memberships_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clinic_memberships"
    ADD CONSTRAINT "clinic_memberships_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clinic_memberships"
    ADD CONSTRAINT "clinic_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clinic_operational_role_capabilities"
    ADD CONSTRAINT "clinic_operational_role_capabilities_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clinic_operational_roles"
    ADD CONSTRAINT "clinic_operational_roles_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clinic_subscriptions"
    ADD CONSTRAINT "clinic_subscriptions_account_owner_user_id_fkey" FOREIGN KEY ("account_owner_user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."clinic_subscriptions"
    ADD CONSTRAINT "clinic_subscriptions_applied_coupon_id_fkey" FOREIGN KEY ("applied_coupon_id") REFERENCES "public"."subscription_coupons"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clinic_subscriptions"
    ADD CONSTRAINT "clinic_subscriptions_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clinic_subscriptions"
    ADD CONSTRAINT "clinic_subscriptions_override_by_user_id_fkey" FOREIGN KEY ("override_by_user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."clinic_tag_relations"
    ADD CONSTRAINT "clinic_tag_relations_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clinic_tag_relations"
    ADD CONSTRAINT "clinic_tag_relations_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."clinic_tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clinic_terms"
    ADD CONSTRAINT "clinic_terms_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clinic_terms"
    ADD CONSTRAINT "clinic_terms_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clinics"
    ADD CONSTRAINT "clinics_account_owner_user_id_fkey" FOREIGN KEY ("account_owner_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."community_form_template_comments"
    ADD CONSTRAINT "community_form_template_comments_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."community_form_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_form_template_comments"
    ADD CONSTRAINT "community_form_template_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_form_template_likes"
    ADD CONSTRAINT "community_form_template_likes_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."community_form_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_form_template_likes"
    ADD CONSTRAINT "community_form_template_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_form_templates"
    ADD CONSTRAINT "community_form_templates_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."community_form_templates"
    ADD CONSTRAINT "community_form_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feature_flags"
    ADD CONSTRAINT "feature_flags_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feature_flags"
    ADD CONSTRAINT "feature_flags_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feature_flags"
    ADD CONSTRAINT "feature_flags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."clinic_tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feature_flags"
    ADD CONSTRAINT "feature_flags_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."patient_clinical_snapshots"
    ADD CONSTRAINT "patient_clinical_snapshots_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_clinical_snapshots"
    ADD CONSTRAINT "patient_clinical_snapshots_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."patient_clinical_snapshots"
    ADD CONSTRAINT "patient_clinical_snapshots_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_evolution_groups"
    ADD CONSTRAINT "patient_evolution_groups_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_evolution_groups"
    ADD CONSTRAINT "patient_evolution_groups_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_file_uploads"
    ADD CONSTRAINT "patient_file_uploads_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_file_uploads"
    ADD CONSTRAINT "patient_file_uploads_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_file_uploads"
    ADD CONSTRAINT "patient_file_uploads_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."patient_file_uploads"
    ADD CONSTRAINT "patient_file_uploads_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."patient_group_templates"
    ADD CONSTRAINT "patient_group_templates_clinic_color_slot_id_fkey" FOREIGN KEY ("clinic_color_slot_id") REFERENCES "public"."clinic_group_color_slots"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."patient_group_templates"
    ADD CONSTRAINT "patient_group_templates_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_group_templates"
    ADD CONSTRAINT "patient_group_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."patient_groups"
    ADD CONSTRAINT "patient_groups_clinic_color_slot_id_fkey" FOREIGN KEY ("clinic_color_slot_id") REFERENCES "public"."clinic_group_color_slots"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."patient_groups"
    ADD CONSTRAINT "patient_groups_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_groups"
    ADD CONSTRAINT "patient_groups_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_groups"
    ADD CONSTRAINT "patient_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_payment_plans"
    ADD CONSTRAINT "patient_payment_plans_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_payment_plans"
    ADD CONSTRAINT "patient_payment_plans_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."patient_payment_plans"
    ADD CONSTRAINT "patient_payment_plans_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_registration_links"
    ADD CONSTRAINT "patient_registration_links_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_registration_links"
    ADD CONSTRAINT "patient_registration_links_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_admins"
    ADD CONSTRAINT "platform_admins_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."platform_admins"
    ADD CONSTRAINT "platform_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_audit_events"
    ADD CONSTRAINT "platform_audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_audit_events"
    ADD CONSTRAINT "platform_audit_events_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."platform_clinic_access_sessions"
    ADD CONSTRAINT "platform_clinic_access_sessions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_clinic_access_sessions"
    ADD CONSTRAINT "platform_clinic_access_sessions_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_feedbacks"
    ADD CONSTRAINT "platform_feedbacks_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."platform_feedbacks"
    ADD CONSTRAINT "platform_feedbacks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."platform_release_note_items"
    ADD CONSTRAINT "platform_release_note_items_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "public"."platform_releases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_events"
    ADD CONSTRAINT "security_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."security_events"
    ADD CONSTRAINT "security_events_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."security_events"
    ADD CONSTRAINT "security_events_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."session_edit_history"
    ADD CONSTRAINT "session_edit_history_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_edit_history"
    ADD CONSTRAINT "session_edit_history_editor_user_id_fkey" FOREIGN KEY ("editor_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_edit_history"
    ADD CONSTRAINT "session_edit_history_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_shares"
    ADD CONSTRAINT "session_shares_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_shares"
    ADD CONSTRAINT "session_shares_revoked_by_user_id_fkey" FOREIGN KEY ("revoked_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."session_shares"
    ADD CONSTRAINT "session_shares_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_shares"
    ADD CONSTRAINT "session_shares_shared_by_user_id_fkey" FOREIGN KEY ("shared_by_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_shares"
    ADD CONSTRAINT "session_shares_shared_with_user_id_fkey" FOREIGN KEY ("shared_with_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_anamnesis_template_id_fkey" FOREIGN KEY ("anamnesis_template_id") REFERENCES "public"."anamnesis_form_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_evolution_group_id_fkey" FOREIGN KEY ("evolution_group_id") REFERENCES "public"."patient_evolution_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."patient_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_parent_session_id_fkey" FOREIGN KEY ("parent_session_id") REFERENCES "public"."sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_payment_plan_id_fkey" FOREIGN KEY ("payment_plan_id") REFERENCES "public"."patient_payment_plans"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscription_invoices"
    ADD CONSTRAINT "subscription_invoices_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscription_invoices"
    ADD CONSTRAINT "subscription_invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."clinic_subscriptions"("id");



ALTER TABLE ONLY "public"."team_development_profiles"
    ADD CONSTRAINT "team_development_profiles_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_development_profiles"
    ADD CONSTRAINT "team_development_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."telemetry_events"
    ADD CONSTRAINT "telemetry_events_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."telemetry_events"
    ADD CONSTRAINT "telemetry_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_active_clinic_contexts"
    ADD CONSTRAINT "user_active_clinic_contexts_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_active_clinic_contexts"
    ADD CONSTRAINT "user_active_clinic_contexts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_governance_overrides"
    ADD CONSTRAINT "user_governance_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_punishments"
    ADD CONSTRAINT "user_punishments_applied_by_fkey" FOREIGN KEY ("applied_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_punishments"
    ADD CONSTRAINT "user_punishments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_release_note_states"
    ADD CONSTRAINT "user_release_note_states_last_seen_release_id_fkey" FOREIGN KEY ("last_seen_release_id") REFERENCES "public"."platform_releases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_release_note_states"
    ADD CONSTRAINT "user_release_note_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_security_sessions"
    ADD CONSTRAINT "user_security_sessions_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_security_sessions"
    ADD CONSTRAINT "user_security_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_security_settings"
    ADD CONSTRAINT "user_security_settings_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_security_settings"
    ADD CONSTRAINT "user_security_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_telemetry_summaries"
    ADD CONSTRAINT "user_telemetry_summaries_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_telemetry_summaries"
    ADD CONSTRAINT "user_telemetry_summaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Anyone authenticated can view governance rules" ON "public"."governance_rules" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone authenticated can view published community templates" ON "public"."community_form_templates" FOR SELECT TO "authenticated" USING ((("is_published" = true) OR ("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."is_platform_owner"("auth"."uid"())));



CREATE POLICY "Authenticated users can insert comments" ON "public"."community_form_template_comments" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Authenticated users can insert registration links" ON "public"."patient_registration_links" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "Authenticated users can insert telemetry events" ON "public"."telemetry_events" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can manage their own likes" ON "public"."community_form_template_likes" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Authenticated users can publish community templates" ON "public"."community_form_templates" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Authenticated users can read comments" ON "public"."community_form_template_comments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can remove their own likes" ON "public"."community_form_template_likes" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Authenticated users can update their own registration links" ON "public"."patient_registration_links" FOR UPDATE TO "authenticated" USING (("created_by" = "auth"."uid"()));



CREATE POLICY "Authenticated users can view template likes" ON "public"."community_form_template_likes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view their own registration links" ON "public"."patient_registration_links" FOR SELECT TO "authenticated" USING (("created_by" = "auth"."uid"()));



CREATE POLICY "Authenticated users insert own feedback" ON "public"."platform_feedbacks" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR ("user_id" IS NULL)));



CREATE POLICY "Authenticated users read platform releases" ON "public"."platform_releases" FOR SELECT TO "authenticated" USING ((("is_active" = true) OR "public"."is_platform_owner"("auth"."uid"())));



CREATE POLICY "Authenticated users read release note items" ON "public"."platform_release_note_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."platform_releases"
  WHERE (("platform_releases"."id" = "platform_release_note_items"."release_id") AND (("platform_releases"."is_active" = true) OR "public"."is_platform_owner"("auth"."uid"()))))));



CREATE POLICY "Authors, super admins and platform owners can delete community templates" ON "public"."community_form_templates" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."is_platform_owner"("auth"."uid"())));



CREATE POLICY "Authors, super admins and platform owners can update community templates" ON "public"."community_form_templates" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."is_platform_owner"("auth"."uid"()))) WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."is_platform_owner"("auth"."uid"())));



CREATE POLICY "Managers insert clinic memberships" ON "public"."clinic_memberships" FOR INSERT TO "authenticated" WITH CHECK (("public"."current_user_can"('subaccounts.manage'::"text", "clinic_id") AND (EXISTS ( SELECT 1
   FROM "public"."clinics"
  WHERE (("clinics"."id" = "clinic_memberships"."clinic_id") AND ("clinics"."subscription_plan" = 'clinic'::"public"."subscription_plan"))))));



CREATE POLICY "Managers read clinic collaborator invitations" ON "public"."clinic_collaborator_invitations" FOR SELECT TO "authenticated" USING ("public"."current_user_can"('subaccounts.manage'::"text", "clinic_id"));



CREATE POLICY "Managers update clinic memberships" ON "public"."clinic_memberships" FOR UPDATE TO "authenticated" USING ("public"."current_user_can"('subaccounts.manage'::"text", "clinic_id")) WITH CHECK ("public"."current_user_can"('subaccounts.manage'::"text", "clinic_id"));



CREATE POLICY "Managers update clinic profiles" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ("public"."current_user_can"('subaccounts.manage'::"text", "clinic_id")) WITH CHECK ("public"."current_user_can"('subaccounts.manage'::"text", "clinic_id"));



CREATE POLICY "Owners e gestores podem ver a assinatura" ON "public"."clinic_subscriptions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."clinic_memberships" "cm"
  WHERE (("cm"."clinic_id" = "clinic_subscriptions"."clinic_id") AND ("cm"."user_id" = "auth"."uid"()) AND ("cm"."is_active" = true) AND ("cm"."membership_status" = 'active'::"public"."membership_status_type") AND (("cm"."account_role" = 'account_owner'::"public"."account_role_type") OR "public"."current_user_can"('subscription_billing.read'::"text", "clinic_subscriptions"."clinic_id"))))));



CREATE POLICY "Owners e gestores podem ver as faturas" ON "public"."subscription_invoices" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."clinic_memberships" "cm"
  WHERE (("cm"."clinic_id" = "subscription_invoices"."clinic_id") AND ("cm"."user_id" = "auth"."uid"()) AND ("cm"."is_active" = true) AND ("cm"."membership_status" = 'active'::"public"."membership_status_type") AND (("cm"."account_role" = 'account_owner'::"public"."account_role_type") OR "public"."current_user_can"('subscription_billing.read'::"text", "subscription_invoices"."clinic_id"))))));



CREATE POLICY "Platform admins podem ver eventos de webhook" ON "public"."asaas_webhook_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."platform_admins" "pa"
  WHERE (("pa"."user_id" = "auth"."uid"()) AND ("pa"."is_active" = true)))));



CREATE POLICY "Platform admins podem ver todas as assinaturas" ON "public"."clinic_subscriptions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."platform_admins" "pa"
  WHERE (("pa"."user_id" = "auth"."uid"()) AND ("pa"."is_active" = true)))));



CREATE POLICY "Platform admins podem ver todas as faturas" ON "public"."subscription_invoices" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."platform_admins" "pa"
  WHERE (("pa"."user_id" = "auth"."uid"()) AND ("pa"."is_active" = true)))));



CREATE POLICY "Platform admins possuem controle total dos cupons" ON "public"."subscription_coupons" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."platform_admins" "pa"
  WHERE (("pa"."user_id" = "auth"."uid"()) AND ("pa"."is_active" = true)))));



CREATE POLICY "Platform owner manage feedbacks" ON "public"."platform_feedbacks" TO "authenticated" USING ("public"."is_platform_owner"(( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ("public"."is_platform_owner"(( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Platform owners can manage governance overrides" ON "public"."user_governance_overrides" TO "authenticated" USING ("public"."is_platform_owner"()) WITH CHECK ("public"."is_platform_owner"());



CREATE POLICY "Platform owners can manage governance rules" ON "public"."governance_rules" TO "authenticated" USING ("public"."is_platform_owner"()) WITH CHECK ("public"."is_platform_owner"());



CREATE POLICY "Platform owners can manage user punishments" ON "public"."user_punishments" TO "authenticated" USING ("public"."is_platform_owner"()) WITH CHECK ("public"."is_platform_owner"());



CREATE POLICY "Platform owners can view all summaries" ON "public"."user_telemetry_summaries" FOR SELECT TO "authenticated" USING ("public"."is_platform_owner"());



CREATE POLICY "Platform owners can view all telemetry events" ON "public"."telemetry_events" FOR SELECT TO "authenticated" USING ("public"."is_platform_owner"());



CREATE POLICY "Platform owners manage clinic_tag_relations" ON "public"."clinic_tag_relations" USING ("public"."is_platform_owner"("auth"."uid"()));



CREATE POLICY "Platform owners manage clinic_tags" ON "public"."clinic_tags" USING ("public"."is_platform_owner"("auth"."uid"()));



CREATE POLICY "Platform owners manage feature flags" ON "public"."feature_flags" TO "authenticated" USING ("public"."is_platform_owner_mfa_verified"("auth"."uid"())) WITH CHECK ("public"."is_platform_owner_mfa_verified"("auth"."uid"()));



CREATE POLICY "Platform owners manage platform release note items" ON "public"."platform_release_note_items" TO "authenticated" USING ("public"."is_platform_owner"("auth"."uid"())) WITH CHECK ("public"."is_platform_owner"("auth"."uid"()));



CREATE POLICY "Platform owners manage platform releases" ON "public"."platform_releases" TO "authenticated" USING ("public"."is_platform_owner"("auth"."uid"())) WITH CHECK ("public"."is_platform_owner"("auth"."uid"()));



CREATE POLICY "Platform owners read platform admins" ON "public"."platform_admins" FOR SELECT TO "authenticated" USING (("public"."is_platform_owner_mfa_verified"("auth"."uid"()) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "Platform owners read platform audit" ON "public"."platform_audit_events" FOR SELECT TO "authenticated" USING ("public"."is_platform_owner_mfa_verified"("auth"."uid"()));



CREATE POLICY "Platform owners read support sessions" ON "public"."platform_clinic_access_sessions" FOR SELECT TO "authenticated" USING (("public"."is_platform_owner_mfa_verified"("auth"."uid"()) AND ("actor_user_id" = "auth"."uid"())));



CREATE POLICY "Super admins manage all agenda events" ON "public"."agenda_events" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins manage all anamnesis form templates" ON "public"."anamnesis_form_templates" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins manage all clinics" ON "public"."clinics" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins manage all evolution groups" ON "public"."patient_evolution_groups" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins manage all patient_groups" ON "public"."patient_groups" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins manage all patients" ON "public"."patients" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins manage all payment plans" ON "public"."patient_payment_plans" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins manage all profiles" ON "public"."profiles" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins manage all roles" ON "public"."user_roles" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins manage all sessions" ON "public"."sessions" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Todos autenticados e anonimos podem consultar cupons ativos" ON "public"."subscription_coupons" FOR SELECT USING ((("is_active" = true) AND (("valid_until" IS NULL) OR ("valid_until" >= "now"()))));



CREATE POLICY "Users and admins can delete own comments" ON "public"."community_form_template_comments" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Users can read own active punishments" ON "public"."user_punishments" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR "public"."is_platform_owner"()));



CREATE POLICY "Users can read own overrides" ON "public"."user_governance_overrides" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR "public"."is_platform_owner"()));



CREATE POLICY "Users can upsert own summary row" ON "public"."user_telemetry_summaries" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users delete clinic agenda events" ON "public"."agenda_events" FOR DELETE TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('agenda.delete_events'::"text", "clinic_id")));



CREATE POLICY "Users delete clinic anamnesis forms" ON "public"."anamnesis_form_templates" FOR DELETE TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('forms.manage'::"text", "clinic_id")));



CREATE POLICY "Users delete clinic draft sessions" ON "public"."sessions" FOR DELETE TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('session.delete_draft'::"text", "clinic_id") AND ("public"."current_user_is_clinic_manager"("clinic_id") OR (("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."clinic_memberships"
  WHERE (("clinic_memberships"."clinic_id" = "sessions"."clinic_id") AND ("clinic_memberships"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("clinic_memberships"."operational_role" = 'professional'::"public"."operational_role_type") AND ("clinic_memberships"."is_active" = true) AND ("clinic_memberships"."membership_status" = 'active'::"public"."membership_status_type"))))))));



CREATE POLICY "Users delete clinic patients" ON "public"."patients" FOR DELETE TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('clinic_profile.manage'::"text", "clinic_id")));



CREATE POLICY "Users delete clinic terms" ON "public"."clinic_terms" FOR DELETE TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('clinic_terms.manage'::"text", "clinic_id")));



CREATE POLICY "Users delete own app notifications" ON "public"."app_notifications" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users delete patient file uploads" ON "public"."patient_file_uploads" FOR DELETE TO "authenticated" USING ((("clinic_id" IS NOT NULL) AND "public"."current_user_can"('patients.write'::"text", "clinic_id")));



CREATE POLICY "Users insert allowed session shares" ON "public"."session_shares" FOR INSERT TO "authenticated" WITH CHECK ((("clinic_id" = "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid"))) AND ("shared_by_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("revoked_at" IS NULL) AND "public"."can_share_session"("session_id") AND "public"."is_active_clinic_member"("clinic_id", "shared_with_user_id")));



CREATE POLICY "Users insert clinic session edit history" ON "public"."session_edit_history" FOR INSERT WITH CHECK ((("editor_user_id" = "auth"."uid"()) AND ("clinic_id" = "public"."get_user_clinic_id"("auth"."uid"())) AND "public"."current_user_can"('sessions.write'::"text", "clinic_id")));



CREATE POLICY "Users insert clinic sessions" ON "public"."sessions" FOR INSERT TO "authenticated" WITH CHECK ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('sessions.write'::"text", "clinic_id")));



CREATE POLICY "Users insert clinic terms" ON "public"."clinic_terms" FOR INSERT TO "authenticated" WITH CHECK ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('clinic_terms.manage'::"text", "clinic_id")));



CREATE POLICY "Users insert patient file uploads" ON "public"."patient_file_uploads" FOR INSERT TO "authenticated" WITH CHECK ((("uploaded_by_user_id" = "auth"."uid"()) AND ("clinic_id" IS NOT NULL) AND "public"."current_user_can"('patients.write'::"text", "clinic_id")));



CREATE POLICY "Users manage clinic payment plans" ON "public"."patient_payment_plans" TO "authenticated" USING (("clinic_id" = "public"."get_user_clinic_id"("auth"."uid"()))) WITH CHECK (("clinic_id" = "public"."get_user_clinic_id"("auth"."uid"())));



CREATE POLICY "Users manage own notification preferences" ON "public"."notification_preferences" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users read clinic agenda events" ON "public"."agenda_events" FOR SELECT TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND "public"."can_read_clinic_data"("clinic_id") AND "public"."current_user_can"('agenda.read'::"text", "clinic_id")));



CREATE POLICY "Users read clinic anamnesis forms" ON "public"."anamnesis_form_templates" FOR SELECT TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND "public"."can_read_clinic_data"("clinic_id") AND ("public"."current_user_can"('forms.read'::"text", "clinic_id") OR "public"."current_user_can"('anamnesis_forms.read'::"text", "clinic_id"))));



CREATE POLICY "Users read clinic evolution groups" ON "public"."patient_evolution_groups" FOR SELECT TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND "public"."can_read_clinic_data"("clinic_id") AND "public"."current_user_can"('sessions.read'::"text", "clinic_id")));



CREATE POLICY "Users read clinic memberships" ON "public"."clinic_memberships" FOR SELECT TO "authenticated" USING (("clinic_id" = "public"."get_user_clinic_id"("auth"."uid"())));



CREATE POLICY "Users read clinic patient_group_templates" ON "public"."patient_group_templates" FOR SELECT TO "authenticated" USING ((("clinic_id" = "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid"))) AND "public"."current_user_can"('patients.read'::"text", "clinic_id")));



CREATE POLICY "Users read clinic patient_groups" ON "public"."patient_groups" FOR SELECT TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND "public"."can_read_clinic_data"("clinic_id") AND ("public"."current_user_can"('patient_groups.read'::"text", "clinic_id") OR "public"."current_user_can"('patients_groups.read'::"text", "clinic_id") OR "public"."current_user_can"('patients.read'::"text", "clinic_id") OR "public"."current_user_can"('sessions.read'::"text", "clinic_id"))));



CREATE POLICY "Users read clinic patients" ON "public"."patients" FOR SELECT TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND "public"."can_read_clinic_data"("clinic_id") AND "public"."current_user_can"('patients.read'::"text", "clinic_id")));



CREATE POLICY "Users read clinic profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role") AS "has_role") OR (("clinic_id" IS NOT NULL) AND ("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id"))) OR (EXISTS ( SELECT 1
   FROM ("public"."clinic_memberships" "requester_membership"
     JOIN "public"."clinic_memberships" "target_membership" ON (("target_membership"."clinic_id" = "requester_membership"."clinic_id")))
  WHERE (("requester_membership"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("requester_membership"."is_active" = true) AND ("target_membership"."user_id" = "profiles"."id"))))));



CREATE POLICY "Users read clinic session edit history" ON "public"."session_edit_history" FOR SELECT USING ((("clinic_id" = "public"."get_user_clinic_id"("auth"."uid"())) AND "public"."current_user_can"('sessions.read'::"text", "clinic_id")));



CREATE POLICY "Users read clinic sessions" ON "public"."sessions" FOR SELECT TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND "public"."can_read_clinic_data"("clinic_id") AND "public"."current_user_can"('sessions.read'::"text", "clinic_id")));



CREATE POLICY "Users read clinic terms" ON "public"."clinic_terms" FOR SELECT TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND "public"."can_read_clinic_data"("clinic_id") AND ("public"."current_user_can"('patients.read'::"text", "clinic_id") OR "public"."current_user_can"('clinic_terms.manage'::"text", "clinic_id") OR "public"."current_user_can"('clinic_profile.read'::"text", "clinic_id"))));



CREATE POLICY "Users read clinic_group_color_slots" ON "public"."clinic_group_color_slots" FOR SELECT TO "authenticated" USING ((("clinic_id" = "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid"))) AND "public"."current_user_can"('patients.read'::"text", "clinic_id")));



CREATE POLICY "Users read own active clinic context" ON "public"."user_active_clinic_contexts" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users read own app notifications" ON "public"."app_notifications" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users read own clinic" ON "public"."clinics" FOR SELECT TO "authenticated" USING (("id" = "public"."get_user_clinic_id"("auth"."uid"())));



CREATE POLICY "Users read own feedback" ON "public"."platform_feedbacks" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR "public"."is_platform_owner"(( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Users read own release note state" ON "public"."user_release_note_states" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users read own roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users read patient file uploads" ON "public"."patient_file_uploads" FOR SELECT TO "authenticated" USING ((("clinic_id" IS NOT NULL) AND "public"."current_user_can"('patients.read'::"text", "clinic_id")));



CREATE POLICY "Users read patient_clinical_snapshots" ON "public"."patient_clinical_snapshots" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND "public"."current_user_can"('patients.read'::"text", "clinic_id")));



CREATE POLICY "Users read session shares they can access" ON "public"."session_shares" FOR SELECT TO "authenticated" USING ((("clinic_id" = "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid"))) AND "public"."can_read_session"("session_id")));



CREATE POLICY "Users update clinic agenda events" ON "public"."agenda_events" FOR UPDATE TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('agenda.write'::"text", "clinic_id"))) WITH CHECK ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('agenda.write'::"text", "clinic_id")));



CREATE POLICY "Users update clinic anamnesis forms" ON "public"."anamnesis_form_templates" FOR UPDATE TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('forms.manage'::"text", "clinic_id"))) WITH CHECK ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('forms.manage'::"text", "clinic_id")));



CREATE POLICY "Users update clinic patients" ON "public"."patients" FOR UPDATE TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('patients.write'::"text", "clinic_id"))) WITH CHECK ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('patients.write'::"text", "clinic_id")));



CREATE POLICY "Users update clinic sessions" ON "public"."sessions" FOR UPDATE TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('sessions.write'::"text", "clinic_id"))) WITH CHECK ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('sessions.write'::"text", "clinic_id")));



CREATE POLICY "Users update clinic terms" ON "public"."clinic_terms" FOR UPDATE TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('clinic_terms.manage'::"text", "clinic_id"))) WITH CHECK ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('clinic_terms.manage'::"text", "clinic_id")));



CREATE POLICY "Users update managed clinic" ON "public"."clinics" FOR UPDATE TO "authenticated" USING ("public"."current_user_can"('clinic_profile.manage'::"text", "id")) WITH CHECK ("public"."current_user_can"('clinic_profile.manage'::"text", "id"));



CREATE POLICY "Users update own app notifications" ON "public"."app_notifications" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Users update patient file uploads" ON "public"."patient_file_uploads" FOR UPDATE TO "authenticated" USING ((("clinic_id" IS NOT NULL) AND "public"."current_user_can"('patients.write'::"text", "clinic_id"))) WITH CHECK ((("clinic_id" IS NOT NULL) AND "public"."current_user_can"('patients.write'::"text", "clinic_id")));



CREATE POLICY "Users write clinic agenda events" ON "public"."agenda_events" FOR INSERT TO "authenticated" WITH CHECK ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('agenda.write'::"text", "clinic_id")));



CREATE POLICY "Users write clinic anamnesis forms" ON "public"."anamnesis_form_templates" FOR INSERT TO "authenticated" WITH CHECK ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('forms.manage'::"text", "clinic_id")));



CREATE POLICY "Users write clinic evolution groups" ON "public"."patient_evolution_groups" TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('sessions.write'::"text", "clinic_id"))) WITH CHECK ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('sessions.write'::"text", "clinic_id")));



CREATE POLICY "Users write clinic patient_group_templates" ON "public"."patient_group_templates" TO "authenticated" USING ((("clinic_id" = "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid"))) AND "public"."current_user_can"('patients.write'::"text", "clinic_id"))) WITH CHECK ((("clinic_id" = "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid"))) AND "public"."current_user_can"('patients.write'::"text", "clinic_id")));



CREATE POLICY "Users write clinic patient_groups" ON "public"."patient_groups" TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND ("public"."current_user_can"('patients.manage_groups'::"text", "clinic_id") OR "public"."current_user_can"('patient_groups.write'::"text", "clinic_id") OR "public"."current_user_can"('sessions.write'::"text", "clinic_id")))) WITH CHECK ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND ("public"."current_user_can"('patients.manage_groups'::"text", "clinic_id") OR "public"."current_user_can"('patient_groups.write'::"text", "clinic_id") OR "public"."current_user_can"('sessions.write'::"text", "clinic_id"))));



CREATE POLICY "Users write clinic patients" ON "public"."patients" FOR INSERT TO "authenticated" WITH CHECK ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('patients.write'::"text", "clinic_id")));



CREATE POLICY "Users write clinic_group_color_slots" ON "public"."clinic_group_color_slots" TO "authenticated" USING ((("clinic_id" = "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid"))) AND "public"."current_user_can"('patients.write'::"text", "clinic_id"))) WITH CHECK ((("clinic_id" = "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid"))) AND "public"."current_user_can"('patients.write'::"text", "clinic_id")));



CREATE POLICY "Users write patient_clinical_snapshots" ON "public"."patient_clinical_snapshots" FOR INSERT WITH CHECK ((("auth"."uid"() IS NOT NULL) AND "public"."current_user_can"('patients.write'::"text", "clinic_id")));



CREATE POLICY "admins can read clinic security events" ON "public"."security_events" FOR SELECT USING ((("visibility_scope" = 'admin'::"text") AND ("clinic_id" = "public"."get_user_clinic_id"("auth"."uid"())) AND "public"."current_user_can"('subaccounts.manage'::"text", "clinic_id")));



ALTER TABLE "public"."agenda_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."anamnesis_form_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."asaas_webhook_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clinic_collaborator_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clinic_group_color_slots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clinic_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clinic_operational_role_capabilities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clinic_operational_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clinic_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clinic_tag_relations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clinic_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clinic_terms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clinics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."community_form_template_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."community_form_template_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."community_form_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feature_flags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."governance_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "operational roles are manageable by role admins" ON "public"."clinic_operational_roles" USING ("public"."current_user_can"('subaccounts_roles.manage'::"text", "clinic_id")) WITH CHECK ("public"."current_user_can"('subaccounts_roles.manage'::"text", "clinic_id"));



CREATE POLICY "operational roles are readable by clinic members" ON "public"."clinic_operational_roles" FOR SELECT USING ("public"."user_has_active_clinic_membership"("auth"."uid"(), "clinic_id"));



ALTER TABLE "public"."patient_clinical_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patient_evolution_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patient_file_uploads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patient_group_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patient_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patient_payment_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patient_registration_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform owners can manage all clinic operational role capabili" ON "public"."clinic_operational_role_capabilities" USING ("public"."is_platform_owner"("auth"."uid"())) WITH CHECK ("public"."is_platform_owner"("auth"."uid"()));



CREATE POLICY "platform owners can manage all clinic operational roles" ON "public"."clinic_operational_roles" USING ("public"."is_platform_owner"("auth"."uid"())) WITH CHECK ("public"."is_platform_owner"("auth"."uid"()));



CREATE POLICY "platform owners can read all clinic operational role capabiliti" ON "public"."clinic_operational_role_capabilities" FOR SELECT USING ("public"."is_platform_owner"("auth"."uid"()));



CREATE POLICY "platform owners can read all clinic operational roles" ON "public"."clinic_operational_roles" FOR SELECT USING ("public"."is_platform_owner"("auth"."uid"()));



ALTER TABLE "public"."platform_admins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_audit_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_clinic_access_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_feedbacks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_release_note_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_releases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "role capabilities are manageable by role admins" ON "public"."clinic_operational_role_capabilities" USING ("public"."current_user_can"('subaccounts_roles.manage'::"text", "clinic_id")) WITH CHECK ("public"."current_user_can"('subaccounts_roles.manage'::"text", "clinic_id"));



CREATE POLICY "role capabilities are readable by clinic members" ON "public"."clinic_operational_role_capabilities" FOR SELECT USING ("public"."user_has_active_clinic_membership"("auth"."uid"(), "clinic_id"));



ALTER TABLE "public"."security_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_edit_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_shares" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_coupons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team development readable by clinic admins or self" ON "public"."team_development_profiles" FOR SELECT USING ((("clinic_id" = "public"."get_user_clinic_id"("auth"."uid"())) AND ("public"."current_user_can"('subaccounts_analytics.read'::"text", "clinic_id") OR ("user_id" = "auth"."uid"()))));



ALTER TABLE "public"."team_development_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."telemetry_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_active_clinic_contexts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_governance_overrides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_punishments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_release_note_states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_security_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_security_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_telemetry_summaries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users can read own security events" ON "public"."security_events" FOR SELECT USING ((("actor_user_id" = "auth"."uid"()) OR ("target_user_id" = "auth"."uid"())));



CREATE POLICY "users can read own security sessions" ON "public"."user_security_sessions" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users can read own security settings" ON "public"."user_security_settings" FOR SELECT USING (("user_id" = "auth"."uid"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."clinic_operational_role_capabilities";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."accept_clinic_collaborator_invitation"("_token" "text", "_full_name" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."accept_clinic_collaborator_invitation"("_token" "text", "_full_name" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."accept_current_user_clinic_invitation"("_invitation_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."accept_current_user_clinic_invitation"("_invitation_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."acknowledge_current_user_release_notes"("_release_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."acknowledge_current_user_release_notes"("_release_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."acknowledge_current_user_release_notes"("_release_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."activate_clinic_free_trial"("_clinic_id" "uuid", "_plan_type" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."activate_clinic_free_trial"("_clinic_id" "uuid", "_plan_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."activate_clinic_free_trial"("_clinic_id" "uuid", "_plan_type" "text") TO "anon";



GRANT ALL ON FUNCTION "public"."activate_clinic_free_trial"("_clinic_id" "uuid", "_plan_type" "public"."subscription_plan") TO "service_role";
GRANT ALL ON FUNCTION "public"."activate_clinic_free_trial"("_clinic_id" "uuid", "_plan_type" "public"."subscription_plan") TO "authenticated";
GRANT ALL ON FUNCTION "public"."activate_clinic_free_trial"("_clinic_id" "uuid", "_plan_type" "public"."subscription_plan") TO "anon";



GRANT ALL ON FUNCTION "public"."apply_user_punishment"("_user_id" "uuid", "_punishment_type" "text", "_duration_minutes" integer, "_reason" "text", "_is_manual" boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."apply_user_punishment"("_user_id" "uuid", "_punishment_type" "text", "_duration_minutes" integer, "_reason" "text", "_is_manual" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."assign_profile_public_code"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assign_profile_public_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."buy_clinic_subaccount_extra_spaces"("_clinic_id" "uuid", "_quantity" integer, "_billing_type" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."buy_clinic_subaccount_extra_spaces"("_clinic_id" "uuid", "_quantity" integer, "_billing_type" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."calculate_community_template_fields_count"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_insert_session"("_clinic_id" "uuid", "_user_id" "uuid", "_provider_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_insert_session"("_clinic_id" "uuid", "_user_id" "uuid", "_provider_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."can_insert_session"("_clinic_id" "uuid", "_user_id" "uuid", "_provider_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."can_perform_action"("_capability" "text", "_clinic_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."can_perform_action"("_capability" "text", "_clinic_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_perform_action"("_capability" "text", "_clinic_id" "uuid") TO "anon";



GRANT ALL ON FUNCTION "public"."can_read_clinic_data"("_clinic_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."can_read_clinic_data"("_clinic_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_read_clinic_data"("_clinic_id" "uuid") TO "anon";



REVOKE ALL ON FUNCTION "public"."can_read_session"("_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_read_session"("_session_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."can_read_session"("_session_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."can_share_session"("_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_share_session"("_session_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."can_share_session"("_session_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."cancel_clinic_collaborator_invitation"("_invitation_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."cancel_clinic_collaborator_invitation"("_invitation_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."check_clinic_plan_quota"("p_clinic_id" "uuid", "p_feature_type" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."check_clinic_plan_quota"("p_clinic_id" "uuid", "p_feature_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_clinic_plan_quota"("p_clinic_id" "uuid", "p_feature_type" "text") TO "anon";



GRANT ALL ON FUNCTION "public"."cleanup_old_telemetry_events"("_page_view_retention_days" integer, "_security_event_retention_days" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."cleanup_old_telemetry_events"("_page_view_retention_days" integer, "_security_event_retention_days" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."cleanup_user_security_sessions"("_user_id" "uuid", "_inactive_window" interval, "_retention_window" interval) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_user_security_sessions"("_user_id" "uuid", "_inactive_window" interval, "_retention_window" interval) TO "service_role";
GRANT ALL ON FUNCTION "public"."cleanup_user_security_sessions"("_user_id" "uuid", "_inactive_window" interval, "_retention_window" interval) TO "authenticated";



GRANT ALL ON FUNCTION "public"."clear_current_user_notifications"() TO "service_role";
GRANT ALL ON FUNCTION "public"."clear_current_user_notifications"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."confirm_asaas_subscription_payment"("_asaas_payment_id" "text", "_clinic_id" "uuid", "_paid_value" numeric, "_payment_date" timestamp with time zone, "_billing_type" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_clinic_subaccount"("_email" "text", "_password" "text", "_full_name" "text", "_operational_role" "public"."operational_role_type", "_job_title" "text", "_specialty" "text", "_clinic_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_clinic_subaccount"("_email" "text", "_password" "text", "_full_name" "text", "_operational_role" "public"."operational_role_type", "_job_title" "text", "_specialty" "text", "_clinic_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."create_clinic_subaccount"("_email" "text", "_password" "text", "_full_name" "text", "_operational_role" "public"."operational_role_type", "_job_title" "text", "_specialty" "text", "_clinic_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."create_current_user_notification"("_clinic_id" "uuid", "_category" "text", "_event_type" "text", "_title" "text", "_body" "text", "_action_label" "text", "_action_url" "text", "_payload" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."create_current_user_notification"("_clinic_id" "uuid", "_category" "text", "_event_type" "text", "_title" "text", "_body" "text", "_action_label" "text", "_action_url" "text", "_payload" "jsonb") TO "authenticated";



GRANT ALL ON FUNCTION "public"."create_due_agenda_reminder_notifications"("_lookahead" interval) TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_patient_registration_link"("_patient_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_patient_registration_link"("_patient_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."create_patient_registration_link"("_patient_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."create_user_notification"("_user_id" "uuid", "_clinic_id" "uuid", "_actor_user_id" "uuid", "_category" "text", "_event_type" "text", "_title" "text", "_body" "text", "_action_label" "text", "_action_url" "text", "_payload" "jsonb", "_source_event_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."create_user_notification"("_user_id" "uuid", "_clinic_id" "uuid", "_actor_user_id" "uuid", "_category" "text", "_event_type" "text", "_title" "text", "_body" "text", "_action_label" "text", "_action_url" "text", "_payload" "jsonb", "_source_event_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."current_user_can"("_capability" "text", "_clinic_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_user_can"("_capability" "text", "_clinic_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."current_user_can"("_capability" "text", "_clinic_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_can"("_capability" "text", "_clinic_id" "uuid") TO "anon";



REVOKE ALL ON FUNCTION "public"."current_user_is_clinic_manager"("_clinic_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_user_is_clinic_manager"("_clinic_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."current_user_is_clinic_manager"("_clinic_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."decline_current_user_clinic_invitation"("_invitation_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."decline_current_user_clinic_invitation"("_invitation_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."delete_current_user_notification"("_notification_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."delete_current_user_notification"("_notification_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."end_clinic_user_security_sessions"("_target_user_id" "uuid", "_clinic_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."end_clinic_user_security_sessions"("_target_user_id" "uuid", "_clinic_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."end_clinic_user_security_sessions"("_target_user_id" "uuid", "_clinic_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."end_current_security_session"("_session_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."end_current_security_session"("_session_key" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."end_current_security_session"("_session_key" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."end_other_security_sessions"("_current_session_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."end_other_security_sessions"("_current_session_key" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."end_other_security_sessions"("_current_session_key" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."end_platform_clinic_access"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."end_platform_clinic_access"() TO "service_role";
GRANT ALL ON FUNCTION "public"."end_platform_clinic_access"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."enforce_clinic_membership_integrity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_clinic_membership_integrity"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."ensure_clinic_patient"("_clinic_id" "uuid", "_name" "text", "_name_key" "text", "_date_of_birth" "date", "_cpf" "text", "_phone" "text", "_email" "text", "_uses_responsible_cpf" boolean, "_gender" "text", "_pronoun" "text", "_rg" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ensure_clinic_patient"("_clinic_id" "uuid", "_name" "text", "_name_key" "text", "_date_of_birth" "date", "_cpf" "text", "_phone" "text", "_email" "text", "_uses_responsible_cpf" boolean, "_gender" "text", "_pronoun" "text", "_rg" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."ensure_clinic_patient"("_clinic_id" "uuid", "_name" "text", "_name_key" "text", "_date_of_birth" "date", "_cpf" "text", "_phone" "text", "_email" "text", "_uses_responsible_cpf" boolean, "_gender" "text", "_pronoun" "text", "_rg" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."ensure_default_patient_group"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ensure_default_patient_group"() TO "service_role";



GRANT ALL ON TABLE "public"."notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_notification_preferences"("_user_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."ensure_notification_preferences"("_user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."ensure_team_development_profile"("_clinic_id" "uuid", "_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ensure_team_development_profile"("_clinic_id" "uuid", "_user_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."ensure_team_development_profile"("_clinic_id" "uuid", "_user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."ensure_team_development_profile_from_membership"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ensure_team_development_profile_from_membership"() TO "service_role";



GRANT ALL ON FUNCTION "public"."expire_abandoned_security_sessions"("_abandoned_window" interval) TO "service_role";
GRANT ALL ON FUNCTION "public"."expire_abandoned_security_sessions"("_abandoned_window" interval) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."finalize_overdue_agenda_events"("_batch_size" integer, "_timezone" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalize_overdue_agenda_events"("_batch_size" integer, "_timezone" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_next_patient_code"("_clinic_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."generate_profile_public_code"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_profile_public_code"() TO "service_role";
GRANT ALL ON FUNCTION "public"."generate_profile_public_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_profile_public_code"() TO "anon";



REVOKE ALL ON FUNCTION "public"."generate_profile_public_code_for_clinic"("_clinic_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_profile_public_code_for_clinic"("_clinic_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."generate_profile_public_code_for_clinic"("_clinic_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_profile_public_code_for_clinic"("_clinic_id" "uuid") TO "anon";



GRANT ALL ON FUNCTION "public"."get_active_platform_clinic_id"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_asaas_webhook_logs"("_limit" integer, "_offset" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_asaas_webhook_logs"("_limit" integer, "_offset" integer) TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_clinic_collaborator_invitation"("_token" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_clinic_collaborator_invitation"("_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_clinic_collaborator_invitation"("_token" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_clinic_dashboard_analytics"("_clinic_id" "uuid", "_year" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_clinic_dashboard_analytics"("_clinic_id" "uuid", "_year" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_clinic_dashboard_analytics"("_clinic_id" "uuid", "_year" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_clinic_feature_flags"("_clinic_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_clinic_feature_flags"("_clinic_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_clinic_feature_flags"("_clinic_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_clinic_pending_collaborator_invitations"("_clinic_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_clinic_pending_collaborator_invitations"("_clinic_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_clinic_share_collaborators"("_clinic_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_clinic_share_collaborators"("_clinic_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_clinic_share_collaborators"("_clinic_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_clinic_active_terms"("p_clinic_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_clinic_active_terms"("p_clinic_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_clinic_subscription_summary"("_clinic_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_clinic_subscription_summary"("_clinic_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_current_platform_role"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_current_platform_role"() TO "service_role";
GRANT ALL ON FUNCTION "public"."get_current_platform_role"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_current_user_pending_release_notes"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_current_user_pending_release_notes"() TO "service_role";
GRANT ALL ON FUNCTION "public"."get_current_user_pending_release_notes"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_patient_registration_form"("_token" "text", "_password" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_patient_registration_form"("_token" "text", "_password" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_patient_registration_form"("_token" "text", "_password" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_patient_registration_form"("_token" "text", "_password" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_platform_clinic_detail"("_clinic_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_platform_clinic_detail"("_clinic_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_platform_clinic_detail"("_clinic_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_platform_clinic_detail_by_route_key"("_route_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_platform_clinic_detail_by_route_key"("_route_key" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_platform_clinic_detail_by_route_key"("_route_key" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_platform_clinic_forms_summary_by_route_key"("_route_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_platform_clinic_forms_summary_by_route_key"("_route_key" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_platform_clinic_forms_summary_by_route_key"("_route_key" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_platform_clinic_roles_overview"("_clinic_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_platform_clinic_roles_overview"("_clinic_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_platform_clinic_roles_overview"("_clinic_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_platform_dashboard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_platform_dashboard"() TO "service_role";
GRANT ALL ON FUNCTION "public"."get_platform_dashboard"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_platform_person_detail"("_item_type" "text", "_item_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_platform_person_detail"("_item_type" "text", "_item_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_platform_person_detail"("_item_type" "text", "_item_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_session_share_recipients"("_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_session_share_recipients"("_session_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_session_share_recipients"("_session_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_session_share_summary"("_session_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_session_share_summary"("_session_ids" "uuid"[]) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_session_share_summary"("_session_ids" "uuid"[]) TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_user_active_governance"("_user_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_user_active_governance"("_user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_user_clinic_id"("_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_clinic_id"("_user_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_user_clinic_id"("_user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."handle_personal_signup"("_user_id" "uuid", "_email" "text", "_full_name" "text", "_cpf" "text", "_phone" "text", "_birth_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_personal_signup"("_user_id" "uuid", "_email" "text", "_full_name" "text", "_cpf" "text", "_phone" "text", "_birth_date" "date") TO "service_role";
GRANT ALL ON FUNCTION "public"."handle_personal_signup"("_user_id" "uuid", "_email" "text", "_full_name" "text", "_cpf" "text", "_phone" "text", "_birth_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_personal_signup"("_user_id" "uuid", "_email" "text", "_full_name" "text", "_cpf" "text", "_phone" "text", "_birth_date" "date") TO "anon";



REVOKE ALL ON FUNCTION "public"."request_account_recovery_status"("_identifier" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."request_account_recovery_status"("_identifier" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."request_account_recovery_status"("_identifier" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_account_recovery_status"("_identifier" "text") TO "anon";



REVOKE ALL ON FUNCTION "public"."complete_unregistered_cpf_profile"("_full_name" "text", "_cpf" "text", "_phone" "text", "_birth_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."complete_unregistered_cpf_profile"("_full_name" "text", "_cpf" "text", "_phone" "text", "_birth_date" "date") TO "service_role";
GRANT ALL ON FUNCTION "public"."complete_unregistered_cpf_profile"("_full_name" "text", "_cpf" "text", "_phone" "text", "_birth_date" "date") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."handle_signup"("_user_id" "uuid", "_email" "text", "_cnpj" "text", "_full_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_signup"("_user_id" "uuid", "_email" "text", "_cnpj" "text", "_full_name" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."handle_signup"("_user_id" "uuid", "_email" "text", "_cnpj" "text", "_full_name" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."handle_signup"("_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscription_plan", "_full_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_signup"("_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscription_plan", "_full_name" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."handle_signup"("_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscription_plan", "_full_name" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."handle_signup"("_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscription_plan", "_full_name" "text", "_clinic_name" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."handle_signup"("_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscription_plan", "_full_name" "text", "_clinic_name" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."handle_signup"("_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscription_plan", "_full_name" "text", "_clinic_name" "text", "_allow_duplicate_cnpj" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";



GRANT ALL ON FUNCTION "public"."increment_community_template_import"("p_template_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."invite_clinic_collaborator"("_clinic_id" "uuid", "_email" "text", "_operational_role" "public"."operational_role_type", "_job_title" "text", "_specialty" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."invite_clinic_collaborator"("_clinic_id" "uuid", "_email" "text", "_operational_role" "public"."operational_role_type", "_job_title" "text", "_specialty" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_active_clinic_member"("_clinic_id" "uuid", "_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_active_clinic_member"("_clinic_id" "uuid", "_user_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."is_active_clinic_member"("_clinic_id" "uuid", "_user_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_clinic_read_only"("_clinic_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."is_clinic_read_only"("_clinic_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_clinic_read_only"("_clinic_id" "uuid") TO "anon";



GRANT ALL ON FUNCTION "public"."is_clinic_subscription_manager"("_user_id" "uuid", "_clinic_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."is_clinic_subscription_manager"("_user_id" "uuid", "_clinic_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_platform_owner"("_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_platform_owner"("_user_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."is_platform_owner"("_user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_platform_owner_mfa_verified"("_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_platform_owner_mfa_verified"("_user_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."is_platform_owner_mfa_verified"("_user_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."leave_current_user_clinic"("_clinic_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."leave_current_user_clinic"("_clinic_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."list_current_user_clinic_invitations"() TO "service_role";
GRANT ALL ON FUNCTION "public"."list_current_user_clinic_invitations"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."list_current_user_clinics"() TO "service_role";
GRANT ALL ON FUNCTION "public"."list_current_user_clinics"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."list_current_user_notification_preferences"() TO "service_role";
GRANT ALL ON FUNCTION "public"."list_current_user_notification_preferences"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."list_current_user_notifications"() TO "service_role";
GRANT ALL ON FUNCTION "public"."list_current_user_notifications"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."list_feature_flags"("_clinic_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_feature_flags"("_clinic_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."list_feature_flags"("_clinic_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."list_platform_audit_events"("_clinic_id" "uuid", "_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_platform_audit_events"("_clinic_id" "uuid", "_limit" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."list_platform_audit_events"("_clinic_id" "uuid", "_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."list_platform_clinics"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_platform_clinics"() TO "service_role";
GRANT ALL ON FUNCTION "public"."list_platform_clinics"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."list_platform_directory"("_query" "text", "_kind" "text", "_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_platform_directory"("_query" "text", "_kind" "text", "_limit" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."list_platform_directory"("_query" "text", "_kind" "text", "_limit" integer) TO "authenticated";



GRANT ALL ON FUNCTION "public"."list_platform_directory"("_query" "text", "_kind" "text", "_status" "text", "_tag_id" "uuid", "_limit" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."list_platform_directory"("_query" "text", "_kind" "text", "_status" "text", "_tag_id" "uuid", "_limit" integer) TO "authenticated";



GRANT ALL ON FUNCTION "public"."list_platform_telemetry_events"("_clinic_id" "uuid", "_limit" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."list_platform_telemetry_events"("_clinic_id" "uuid", "_limit" integer) TO "authenticated";



GRANT ALL ON FUNCTION "public"."list_platform_user_telemetry_events"("_user_id" "uuid", "_limit" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."list_platform_user_telemetry_events"("_user_id" "uuid", "_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."log_platform_audit_event"("_event_type" "text", "_clinic_id" "uuid", "_reason" "text", "_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_platform_audit_event"("_event_type" "text", "_clinic_id" "uuid", "_reason" "text", "_metadata" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."log_platform_audit_event"("_event_type" "text", "_clinic_id" "uuid", "_reason" "text", "_metadata" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."log_security_event"("_clinic_id" "uuid", "_actor_user_id" "uuid", "_target_user_id" "uuid", "_event_type" "text", "_visibility_scope" "text", "_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_security_event"("_clinic_id" "uuid", "_actor_user_id" "uuid", "_target_user_id" "uuid", "_event_type" "text", "_visibility_scope" "text", "_payload" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."log_security_event"("_clinic_id" "uuid", "_actor_user_id" "uuid", "_target_user_id" "uuid", "_event_type" "text", "_visibility_scope" "text", "_payload" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."log_session_edit_history"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_session_edit_history"() TO "service_role";



GRANT ALL ON FUNCTION "public"."manage_clinic_subscription_plan"("_clinic_id" "uuid", "_new_plan" "public"."subscription_plan", "_billing_cycle" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."manage_clinic_subscription_plan"("_clinic_id" "uuid", "_new_plan" "public"."subscription_plan", "_billing_cycle" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."normalize_patient_name_key"("_value" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."normalize_patient_name_key"("_value" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."normalize_patient_name_key"("_value" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."notification_category_enabled"("_preferences" "public"."notification_preferences", "_category" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_clinic_access_session_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_clinic_collaborator_presence"("_clinic_id" "uuid", "_user_id" "uuid", "_status" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."notify_clinic_collaborator_presence"("_clinic_id" "uuid", "_user_id" "uuid", "_status" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."notify_session_created"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."platform_create_clinic"("_name" "text", "_cnpj" "text", "_subscription_plan" "public"."subscription_plan", "_subaccount_limit" integer, "_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."platform_create_clinic"("_name" "text", "_cnpj" "text", "_subscription_plan" "public"."subscription_plan", "_subaccount_limit" integer, "_reason" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."platform_create_clinic"("_name" "text", "_cnpj" "text", "_subscription_plan" "public"."subscription_plan", "_subaccount_limit" integer, "_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."platform_normalize_search"("_value" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."platform_normalize_search"("_value" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."platform_normalize_search"("_value" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."platform_override_clinic_subscription"("_clinic_id" "uuid", "_new_plan" "public"."subscription_plan", "_status" "text", "_subaccount_limit" integer, "_concurrent_access_limit" integer, "_next_due_date" "date", "_reason" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."platform_override_clinic_subscription"("_clinic_id" "uuid", "_new_plan" "public"."subscription_plan", "_status" "text", "_subaccount_limit" integer, "_concurrent_access_limit" integer, "_next_due_date" "date", "_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."prevent_default_patient_group_delete"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prevent_default_patient_group_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."raise_exception_json"("_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_asaas_webhook_event"("_event_id" "text", "_event_type" "text", "_payload" "jsonb", "_signature" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."register_current_security_session"("_session_key" "text", "_browser" "text", "_platform" "text", "_device_label" "text", "_user_agent" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."register_current_security_session"("_session_key" "text", "_browser" "text", "_platform" "text", "_device_label" "text", "_user_agent" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."register_current_security_session"("_session_key" "text", "_browser" "text", "_platform" "text", "_device_label" "text", "_user_agent" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."resend_clinic_collaborator_invitation"("_invitation_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."resend_clinic_collaborator_invitation"("_invitation_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."revoke_clinic_member_access"("_membership_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."revoke_clinic_member_access"("_membership_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."revoke_session_share"("_session_id" "uuid", "_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."revoke_session_share"("_session_id" "uuid", "_user_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."revoke_session_share"("_session_id" "uuid", "_user_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."revoke_user_punishment"("_punishment_id" "uuid", "_reason" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."revoke_user_punishment"("_punishment_id" "uuid", "_reason" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."set_clinic_subscriptions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_current_user_active_clinic"("_clinic_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."set_current_user_active_clinic"("_clinic_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."set_current_user_active_clinic_by_route_key"("_route_key" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."set_current_user_active_clinic_by_route_key"("_route_key" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."share_sessions_with_collaborators"("_session_ids" "uuid"[], "_user_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."share_sessions_with_collaborators"("_session_ids" "uuid"[], "_user_ids" "uuid"[]) TO "service_role";
GRANT ALL ON FUNCTION "public"."share_sessions_with_collaborators"("_session_ids" "uuid"[], "_user_ids" "uuid"[]) TO "authenticated";



GRANT ALL ON FUNCTION "public"."share_sessions_with_collaborators"("_session_ids" "uuid"[], "_user_ids" "uuid"[], "_access_level" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."slugify_text"("_val" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."start_platform_clinic_access"("_clinic_id" "uuid", "_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."start_platform_clinic_access"("_clinic_id" "uuid", "_reason" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."start_platform_clinic_access"("_clinic_id" "uuid", "_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."submit_patient_registration_form"("_token" "text", "_password" "text", "_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_patient_registration_form"("_token" "text", "_password" "text", "_payload" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."submit_patient_registration_form"("_token" "text", "_password" "text", "_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_patient_registration_form"("_token" "text", "_password" "text", "_payload" "jsonb") TO "authenticated";



GRANT ALL ON FUNCTION "public"."submit_user_platform_feedback"("_clinic_id" "uuid", "_ratings" "jsonb", "_problem_report" "text", "_opinion" "text", "_page_url" "text", "_user_agent" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."submit_user_platform_feedback"("_clinic_id" "uuid", "_ratings" "jsonb", "_problem_report" "text", "_opinion" "text", "_page_url" "text", "_user_agent" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."sync_clinic_limits_from_subscription"() TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_community_template_like"("p_template_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_subscription_auto_renew"("_clinic_id" "uuid", "_auto_renew" boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."toggle_subscription_auto_renew"("_clinic_id" "uuid", "_auto_renew" boolean) TO "authenticated";



GRANT ALL ON FUNCTION "public"."touch_notification_preferences_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_platform_feedbacks_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_auto_assign_patient_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_patient_groups_set_clinic_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trim_user_notifications"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_clinic_collaborator_invitation"("_invitation_id" "uuid", "_operational_role" "public"."operational_role_type", "_job_title" "text", "_specialty" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."update_clinic_collaborator_invitation"("_invitation_id" "uuid", "_operational_role" "public"."operational_role_type", "_job_title" "text", "_specialty" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."update_clinic_concurrent_accesses"("_clinic_id" "uuid", "_extra_concurrent" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."update_clinic_concurrent_accesses"("_clinic_id" "uuid", "_extra_concurrent" integer) TO "authenticated";



GRANT ALL ON FUNCTION "public"."update_clinic_member_operational_fields"("_membership_id" "uuid", "_job_title" "text", "_specialty" "text", "_working_hours" "text", "_operational_role" "public"."operational_role_type", "_membership_status" "public"."membership_status_type") TO "service_role";
GRANT ALL ON FUNCTION "public"."update_clinic_member_operational_fields"("_membership_id" "uuid", "_job_title" "text", "_specialty" "text", "_working_hours" "text", "_operational_role" "public"."operational_role_type", "_membership_status" "public"."membership_status_type") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."update_clinic_subaccount"("_membership_id" "uuid", "_full_name" "text", "_email" "text", "_cpf" "text", "_professional_license" "text", "_phone" "text", "_specialty" "text", "_job_title" "text", "_operational_role" "public"."operational_role_type", "_membership_status" "public"."membership_status_type", "_new_password" "text", "_working_hours" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_clinic_subaccount"("_membership_id" "uuid", "_full_name" "text", "_email" "text", "_cpf" "text", "_professional_license" "text", "_phone" "text", "_specialty" "text", "_job_title" "text", "_operational_role" "public"."operational_role_type", "_membership_status" "public"."membership_status_type", "_new_password" "text", "_working_hours" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."update_clinic_subaccount"("_membership_id" "uuid", "_full_name" "text", "_email" "text", "_cpf" "text", "_professional_license" "text", "_phone" "text", "_specialty" "text", "_job_title" "text", "_operational_role" "public"."operational_role_type", "_membership_status" "public"."membership_status_type", "_new_password" "text", "_working_hours" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."update_clinic_subaccount_profile"("_membership_id" "uuid", "_full_name" "text", "_social_name" "text", "_email" "text", "_phone" "text", "_birth_date" "date", "_cpf" "text", "_professional_license" "text", "_specialty" "text", "_job_title" "text", "_bio" "text", "_working_hours" "text", "_address" "jsonb", "_operational_role" "public"."operational_role_type", "_membership_status" "public"."membership_status_type", "_new_password" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_clinic_subaccount_profile"("_membership_id" "uuid", "_full_name" "text", "_social_name" "text", "_email" "text", "_phone" "text", "_birth_date" "date", "_cpf" "text", "_professional_license" "text", "_specialty" "text", "_job_title" "text", "_bio" "text", "_working_hours" "text", "_address" "jsonb", "_operational_role" "public"."operational_role_type", "_membership_status" "public"."membership_status_type", "_new_password" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."update_clinic_subaccount_profile"("_membership_id" "uuid", "_full_name" "text", "_social_name" "text", "_email" "text", "_phone" "text", "_birth_date" "date", "_cpf" "text", "_professional_license" "text", "_specialty" "text", "_job_title" "text", "_bio" "text", "_working_hours" "text", "_address" "jsonb", "_operational_role" "public"."operational_role_type", "_membership_status" "public"."membership_status_type", "_new_password" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."update_current_profile"("_full_name" "text", "_social_name" "text", "_email" "text", "_phone" "text", "_birth_date" "date", "_cpf" "text", "_professional_license" "text", "_specialty" "text", "_job_title" "text", "_bio" "text", "_working_hours" "text", "_address" "jsonb", "_new_password" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_current_profile"("_full_name" "text", "_social_name" "text", "_email" "text", "_phone" "text", "_birth_date" "date", "_cpf" "text", "_professional_license" "text", "_specialty" "text", "_job_title" "text", "_bio" "text", "_working_hours" "text", "_address" "jsonb", "_new_password" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."update_current_profile"("_full_name" "text", "_social_name" "text", "_email" "text", "_phone" "text", "_birth_date" "date", "_cpf" "text", "_professional_license" "text", "_specialty" "text", "_job_title" "text", "_bio" "text", "_working_hours" "text", "_address" "jsonb", "_new_password" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."update_current_user_notification_preferences"("_sound_mode" "text", "_sound_key" "text", "_notify_security" boolean, "_notify_clinic_access" boolean, "_notify_patient_saved" boolean, "_notify_session_activity" boolean, "_notify_event_reminders" boolean, "_notify_system" boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."update_current_user_notification_preferences"("_sound_mode" "text", "_sound_key" "text", "_notify_security" boolean, "_notify_clinic_access" boolean, "_notify_patient_saved" boolean, "_notify_session_activity" boolean, "_notify_event_reminders" boolean, "_notify_system" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."update_team_development_profile"("_user_id" "uuid", "_development_status" "text", "_internal_level" "text", "_goals" "text", "_review_notes" "text", "_last_review_at" "date", "_next_review_at" "date", "_onboarding_flow_read" boolean, "_onboarding_initial_training" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_team_development_profile"("_user_id" "uuid", "_development_status" "text", "_internal_level" "text", "_goals" "text", "_review_notes" "text", "_last_review_at" "date", "_next_review_at" "date", "_onboarding_flow_read" boolean, "_onboarding_initial_training" boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."update_team_development_profile"("_user_id" "uuid", "_development_status" "text", "_internal_level" "text", "_goals" "text", "_review_notes" "text", "_last_review_at" "date", "_next_review_at" "date", "_onboarding_flow_read" boolean, "_onboarding_initial_training" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."update_updated_at_column"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."upsert_current_user_security_settings"("_alert_password_changed" boolean, "_alert_new_login" boolean, "_alert_other_sessions_ended" boolean, "_alert_access_change" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_current_user_security_settings"("_alert_password_changed" boolean, "_alert_new_login" boolean, "_alert_other_sessions_ended" boolean, "_alert_access_change" boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."upsert_current_user_security_settings"("_alert_password_changed" boolean, "_alert_new_login" boolean, "_alert_other_sessions_ended" boolean, "_alert_access_change" boolean) TO "authenticated";



GRANT ALL ON FUNCTION "public"."upsert_feature_flag"("_key" "text", "_scope" "public"."feature_flag_scope", "_clinic_id" "uuid", "_tag_id" "uuid", "_value" "jsonb", "_description" "text", "_starts_at" timestamp with time zone, "_expires_at" timestamp with time zone, "_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_user_telemetry_summary"("_clinic_id" "uuid", "_user_name" "text", "_page_views" integer, "_prints_detected" integer, "_docs_printed" integer, "_pdf_exported" integer, "_dwell_seconds" integer, "_top_routes" "jsonb", "_is_spam_flagged" boolean, "_spam_reason" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."upsert_user_telemetry_summary"("_clinic_id" "uuid", "_user_name" "text", "_page_views" integer, "_prints_detected" integer, "_docs_printed" integer, "_pdf_exported" integer, "_dwell_seconds" integer, "_top_routes" "jsonb", "_is_spam_flagged" boolean, "_spam_reason" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."user_has_active_clinic_membership"("_user_id" "uuid", "_clinic_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."user_has_active_clinic_membership"("_user_id" "uuid", "_clinic_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."validate_subscription_coupon"("_code" "text", "_plan_type" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."validate_subscription_coupon"("_code" "text", "_plan_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_subscription_coupon"("_code" "text", "_plan_type" "text") TO "anon";



GRANT ALL ON FUNCTION "public"."validate_subscription_coupon"("_code" "text", "_plan_type" "text", "_clinic_id" "uuid", "_billing_cycle" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."validate_subscription_coupon"("_code" "text", "_plan_type" "text", "_clinic_id" "uuid", "_billing_cycle" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_subscription_coupon"("_code" "text", "_plan_type" "text", "_clinic_id" "uuid", "_billing_cycle" "text") TO "anon";



REVOKE ALL ON FUNCTION "public"."validate_user_clinic"("_user_id" "uuid", "_cnpj" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_user_clinic"("_user_id" "uuid", "_cnpj" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."validate_user_clinic"("_user_id" "uuid", "_cnpj" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."verify_password_recovery_identity"("_email" "text", "_cpf" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verify_password_recovery_identity"("_email" "text", "_cpf" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."verify_password_recovery_identity"("_email" "text", "_cpf" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_password_recovery_identity"("_email" "text", "_cpf" "text") TO "authenticated";


















GRANT ALL ON TABLE "public"."agenda_events" TO "anon";
GRANT ALL ON TABLE "public"."agenda_events" TO "authenticated";
GRANT ALL ON TABLE "public"."agenda_events" TO "service_role";



GRANT ALL ON TABLE "public"."anamnesis_form_templates" TO "anon";
GRANT ALL ON TABLE "public"."anamnesis_form_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."anamnesis_form_templates" TO "service_role";



GRANT ALL ON TABLE "public"."app_notifications" TO "anon";
GRANT ALL ON TABLE "public"."app_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."app_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."asaas_webhook_events" TO "anon";
GRANT ALL ON TABLE "public"."asaas_webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."asaas_webhook_events" TO "service_role";



GRANT ALL ON TABLE "public"."clinic_collaborator_invitations" TO "anon";
GRANT ALL ON TABLE "public"."clinic_collaborator_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."clinic_collaborator_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."clinic_group_color_slots" TO "anon";
GRANT ALL ON TABLE "public"."clinic_group_color_slots" TO "authenticated";
GRANT ALL ON TABLE "public"."clinic_group_color_slots" TO "service_role";



GRANT ALL ON TABLE "public"."clinic_memberships" TO "anon";
GRANT ALL ON TABLE "public"."clinic_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."clinic_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."clinic_operational_role_capabilities" TO "anon";
GRANT ALL ON TABLE "public"."clinic_operational_role_capabilities" TO "authenticated";
GRANT ALL ON TABLE "public"."clinic_operational_role_capabilities" TO "service_role";



GRANT ALL ON TABLE "public"."clinic_operational_roles" TO "anon";
GRANT ALL ON TABLE "public"."clinic_operational_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."clinic_operational_roles" TO "service_role";



GRANT ALL ON TABLE "public"."clinic_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."clinic_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."clinic_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."clinic_tag_relations" TO "anon";
GRANT ALL ON TABLE "public"."clinic_tag_relations" TO "authenticated";
GRANT ALL ON TABLE "public"."clinic_tag_relations" TO "service_role";



GRANT ALL ON TABLE "public"."clinic_tags" TO "anon";
GRANT ALL ON TABLE "public"."clinic_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."clinic_tags" TO "service_role";



GRANT ALL ON TABLE "public"."clinic_terms" TO "authenticated";
GRANT ALL ON TABLE "public"."clinic_terms" TO "service_role";



GRANT ALL ON TABLE "public"."clinics" TO "anon";
GRANT ALL ON TABLE "public"."clinics" TO "authenticated";
GRANT ALL ON TABLE "public"."clinics" TO "service_role";



GRANT ALL ON TABLE "public"."community_form_template_comments" TO "anon";
GRANT ALL ON TABLE "public"."community_form_template_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."community_form_template_comments" TO "service_role";



GRANT ALL ON TABLE "public"."community_form_template_likes" TO "anon";
GRANT ALL ON TABLE "public"."community_form_template_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."community_form_template_likes" TO "service_role";



GRANT ALL ON TABLE "public"."community_form_templates" TO "anon";
GRANT ALL ON TABLE "public"."community_form_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."community_form_templates" TO "service_role";



GRANT ALL ON TABLE "public"."feature_flags" TO "anon";
GRANT ALL ON TABLE "public"."feature_flags" TO "authenticated";
GRANT ALL ON TABLE "public"."feature_flags" TO "service_role";



GRANT ALL ON TABLE "public"."governance_rules" TO "anon";
GRANT ALL ON TABLE "public"."governance_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."governance_rules" TO "service_role";



GRANT ALL ON TABLE "public"."patient_clinical_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."patient_clinical_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_clinical_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."patient_evolution_groups" TO "anon";
GRANT ALL ON TABLE "public"."patient_evolution_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_evolution_groups" TO "service_role";



GRANT ALL ON TABLE "public"."patient_file_uploads" TO "anon";
GRANT ALL ON TABLE "public"."patient_file_uploads" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_file_uploads" TO "service_role";



GRANT ALL ON TABLE "public"."patient_group_templates" TO "anon";
GRANT ALL ON TABLE "public"."patient_group_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_group_templates" TO "service_role";



GRANT ALL ON TABLE "public"."patient_groups" TO "anon";
GRANT ALL ON TABLE "public"."patient_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_groups" TO "service_role";



GRANT ALL ON TABLE "public"."patient_payment_plans" TO "anon";
GRANT ALL ON TABLE "public"."patient_payment_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_payment_plans" TO "service_role";



GRANT ALL ON TABLE "public"."patient_registration_links" TO "anon";
GRANT ALL ON TABLE "public"."patient_registration_links" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_registration_links" TO "service_role";



GRANT ALL ON TABLE "public"."patients" TO "anon";
GRANT ALL ON TABLE "public"."patients" TO "authenticated";
GRANT ALL ON TABLE "public"."patients" TO "service_role";



GRANT ALL ON TABLE "public"."platform_admins" TO "anon";
GRANT ALL ON TABLE "public"."platform_admins" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_admins" TO "service_role";



GRANT ALL ON TABLE "public"."platform_audit_events" TO "anon";
GRANT ALL ON TABLE "public"."platform_audit_events" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_audit_events" TO "service_role";



GRANT ALL ON TABLE "public"."platform_clinic_access_sessions" TO "anon";
GRANT ALL ON TABLE "public"."platform_clinic_access_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_clinic_access_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."platform_feedbacks" TO "anon";
GRANT ALL ON TABLE "public"."platform_feedbacks" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_feedbacks" TO "service_role";



GRANT ALL ON TABLE "public"."platform_release_note_items" TO "anon";
GRANT ALL ON TABLE "public"."platform_release_note_items" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_release_note_items" TO "service_role";



GRANT ALL ON TABLE "public"."platform_releases" TO "anon";
GRANT ALL ON TABLE "public"."platform_releases" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_releases" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."security_events" TO "anon";
GRANT ALL ON TABLE "public"."security_events" TO "authenticated";
GRANT ALL ON TABLE "public"."security_events" TO "service_role";



GRANT ALL ON TABLE "public"."session_edit_history" TO "anon";
GRANT ALL ON TABLE "public"."session_edit_history" TO "authenticated";
GRANT ALL ON TABLE "public"."session_edit_history" TO "service_role";



GRANT ALL ON TABLE "public"."session_shares" TO "anon";
GRANT ALL ON TABLE "public"."session_shares" TO "authenticated";
GRANT ALL ON TABLE "public"."session_shares" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_coupons" TO "anon";
GRANT ALL ON TABLE "public"."subscription_coupons" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_coupons" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_invoices" TO "anon";
GRANT ALL ON TABLE "public"."subscription_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_invoices" TO "service_role";



GRANT ALL ON TABLE "public"."team_development_profiles" TO "anon";
GRANT ALL ON TABLE "public"."team_development_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."team_development_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."telemetry_events" TO "anon";
GRANT ALL ON TABLE "public"."telemetry_events" TO "authenticated";
GRANT ALL ON TABLE "public"."telemetry_events" TO "service_role";



GRANT ALL ON TABLE "public"."user_active_clinic_contexts" TO "anon";
GRANT ALL ON TABLE "public"."user_active_clinic_contexts" TO "authenticated";
GRANT ALL ON TABLE "public"."user_active_clinic_contexts" TO "service_role";



GRANT ALL ON TABLE "public"."user_governance_overrides" TO "anon";
GRANT ALL ON TABLE "public"."user_governance_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."user_governance_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."user_punishments" TO "anon";
GRANT ALL ON TABLE "public"."user_punishments" TO "authenticated";
GRANT ALL ON TABLE "public"."user_punishments" TO "service_role";



GRANT ALL ON TABLE "public"."user_release_note_states" TO "anon";
GRANT ALL ON TABLE "public"."user_release_note_states" TO "authenticated";
GRANT ALL ON TABLE "public"."user_release_note_states" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_security_sessions" TO "anon";
GRANT ALL ON TABLE "public"."user_security_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_security_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."user_security_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_security_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_security_settings" TO "service_role";



GRANT ALL ON TABLE "public"."user_telemetry_summaries" TO "anon";
GRANT ALL ON TABLE "public"."user_telemetry_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."user_telemetry_summaries" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































