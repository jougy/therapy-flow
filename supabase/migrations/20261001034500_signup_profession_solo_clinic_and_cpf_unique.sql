-- Migration: 20261001034500_signup_profession_solo_clinic_and_cpf_unique.sql
-- Descrição:
-- 1. Criação de índice único parcial em public.profiles para CPF higienizado (não nulo e não vazio).
-- 2. Adição de colunas profession e council_name na tabela public.profiles.
-- 3. Atualização da RPC public.handle_personal_signup:
--    - Suporte a _profession e _council_number.
--    - Validação atômica e explícita de CPF pré-existente (erro 'Este CPF já está cadastrado em outra conta.', código 23505).
--    - Gravação atômica de profession, council_name ('CREFITO') e professional_license (_council_number).
--    - Geração do ID Global (public_code) via public.generate_profile_public_code().
--    - Provisionamento automático de clínica solo gratuita para o usuário se ele não for owner de nenhuma clínica:
--      * name: 'Consultório - ' || COALESCE(_full_name, 'Profissional')
--      * route_key: 'consultorio-' || lower(regexp_replace(v_public_code, '^PLR-|-', '', 'g'))
--      * subscription_plan: 'prof_basico'
--      * subscription_status: 'trialing'
--      * is_free_trial: true
--      * trial_ends_at: now() + interval '7 days'
--      * trial_max_attendances: 20
--      * max_concurrent_accesses: 1
--      * created_by: _user_id
--      * clinic_memberships: account_owner, operational_role 'owner', role_key 'owner', status 'active'.
-- 4. Rotina/função para conciliação de usuários legados que não possuem clínica própria.

-- ==============================================================================
-- 1. ÍNDICE ÚNICO PARCIAL DE CPF EM public.profiles
-- ==============================================================================

-- Deduplicação segura prévia: anula CPFs duplicados legados mantendo o primeiro registro
UPDATE public.profiles
SET cpf = NULL
WHERE id NOT IN (
  SELECT min(id::text)::uuid
  FROM public.profiles
  WHERE cpf IS NOT NULL AND cpf != ''
  GROUP BY cpf
)
AND cpf IS NOT NULL AND cpf != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_cpf_unique
  ON public.profiles (cpf)
  WHERE cpf IS NOT NULL AND cpf != '';

-- ==============================================================================
-- 2. COLUNAS profession E council_name EM public.profiles
-- ==============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profession text,
  ADD COLUMN IF NOT EXISTS council_name text DEFAULT 'CREFITO';

COMMENT ON COLUMN public.profiles.profession IS 'Profissão do titular da conta (ex: fisioterapeuta, terapeuta_ocupacional).';
COMMENT ON COLUMN public.profiles.council_name IS 'Nome do conselho profissional de classe (padrão: CREFITO).';

-- ==============================================================================
-- 3. RPC handle_personal_signup ATUALIZADA
-- ==============================================================================

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

    -- Inserir assinatura em degustação trial (7 dias, 20 atendimentos, 1 acesso)
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

-- ==============================================================================
-- 4. ROTINA DE CONCILIAÇÃO DE USUÁRIOS LEGADOS
-- ==============================================================================
-- Qualquer usuário existente sem clínica própria criada e que não seja owner
-- provisiona seu consultório solo de 7 dias com 20 atendimentos.

CREATE OR REPLACE FUNCTION public.reconcile_legacy_users_solo_clinic()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
  LOOP
    v_trial_end := now() + interval '7 days';
    v_public_code := COALESCE(NULLIF(trim(v_rec.public_code), ''), public.generate_profile_public_code());

    -- Atualiza public_code caso estivesse ausente
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

    -- Contexto ativo
    INSERT INTO public.user_active_clinic_contexts (user_id, clinic_id, updated_at)
    VALUES (v_rec.user_id, v_clinic_id, now())
    ON CONFLICT (user_id) DO UPDATE
    SET clinic_id = EXCLUDED.clinic_id, updated_at = now();

    UPDATE public.profiles
    SET clinic_id = COALESCE(clinic_id, v_clinic_id)
    WHERE id = v_rec.user_id;

    v_provisioned_count := v_provisioned_count + 1;
  END LOOP;

  RETURN v_provisioned_count;
END;
$$;

-- Executar a conciliação imediata na migração
SELECT public.reconcile_legacy_users_solo_clinic();
