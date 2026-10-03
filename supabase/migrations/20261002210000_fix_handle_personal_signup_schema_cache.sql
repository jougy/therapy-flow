-- Migration: 20261002210000_fix_handle_personal_signup_schema_cache.sql
-- Descrição:
-- 1. Remove a assinatura legada de 6 parâmetros de public.handle_personal_signup para eliminar o risco de PGRST203 ou schema cache mismatch.
-- 2. Recria a função canônica única de 8 parâmetros com valores DEFAULT NULL explícitos.
-- 3. Garante permissões adequadas (authenticated, anon, service_role).
-- 4. Executa NOTIFY pgrst, 'reload schema' para recarregar instantaneamente o PostgREST.
-- 5. Executa a conciliação imediata para criar os consultórios solos pendentes de usuários que sofreram a falha.

-- 1. Remover assinatura legada de 6 parâmetros se existir
DROP FUNCTION IF EXISTS public.handle_personal_signup(uuid, text, text, text, text, date);

-- 2. Recriar função canônica única de 8 parâmetros
CREATE OR REPLACE FUNCTION public.handle_personal_signup(
  _user_id uuid,
  _email text,
  _full_name text DEFAULT NULL,
  _cpf text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _birth_date date DEFAULT NULL,
  _profession text DEFAULT NULL,
  _council_number text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

-- Permissões de execução da RPC handle_personal_signup
REVOKE ALL ON FUNCTION public.handle_personal_signup(uuid, text, text, text, text, date, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_personal_signup(uuid, text, text, text, text, date, text, text) TO authenticated, anon, service_role;

-- Recarregar cache do PostgREST imediatamente
NOTIFY pgrst, 'reload schema';

-- Executar conciliação imediata para criar clínicas de contas que ficaram sem clínica
SELECT public.reconcile_legacy_users_solo_clinic();
