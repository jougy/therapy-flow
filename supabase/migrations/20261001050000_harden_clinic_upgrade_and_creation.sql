-- Migration: 20261001050000_harden_clinic_upgrade_and_creation.sql
-- Descrição:
-- 1. Atualizar public.handle_signup para mapear corretamente os limites iniciais da nova matriz de 6 planos
--    (clinica_basico: 999999 colabs / 2 seats, clinica_medio: 999999 / 4, clinica_top: 999999 / 8, prof_top: 2 / 2, etc.)
-- 2. Atualizar public.manage_clinic_subscription_plan para garantir preservação explícita e imutabilidade de
--    account_owner_user_id (COALESCE(clinic_subscriptions.account_owner_user_id, EXCLUDED.account_owner_user_id))
--    e atualizar clinics.account_owner_user_id atomicamente.
-- 3. Atualizar public.is_clinic_subscription_manager para reconhecer de forma direta tanto clinics.account_owner_user_id
--    quanto clinic_memberships (account_owner / owner) e platform_admins.

-- ==============================================================================
-- 1. ATUALIZAR is_clinic_subscription_manager COM SUPORTE TOTAL A OWNER
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_clinic_subscription_manager(_user_id uuid, _clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION public.is_clinic_subscription_manager(uuid, uuid) TO authenticated, service_role;

-- ==============================================================================
-- 2. ATUALIZAR handle_signup COM A NOVA MATRIZ DE PLANOS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_signup(
  _user_id uuid,
  _email text,
  _cnpj text,
  _subscription_plan public.subscription_plan DEFAULT 'solo',
  _full_name text DEFAULT NULL,
  _clinic_name text DEFAULT NULL,
  _allow_duplicate_cnpj boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION public.handle_signup(uuid, text, text, public.subscription_plan, text, text, boolean) TO service_role;

-- ==============================================================================
-- 3. ATUALIZAR manage_clinic_subscription_plan (PRESERVAÇÃO DO OWNER NO UPGRADE)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.manage_clinic_subscription_plan(
  _clinic_id uuid,
  _new_plan public.subscription_plan,
  _billing_cycle text DEFAULT 'annual'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  -- Trimestral: ~10% OFF
  -- Anual: ~25% OFF
  IF v_plan_str = 'prof_basico' THEN
    v_base_price := CASE
      WHEN v_cycle = 'monthly' THEN 39.99
      WHEN v_cycle = 'quarterly' THEN 35.99
      ELSE 29.99
    END;
    v_extra_price := 0.00;
    v_base_subaccounts := 1;
    v_base_concurrent := 1;
    v_current_extra_seats := 0;

  ELSIF v_plan_str IN ('prof_medio', 'solo') THEN
    v_base_price := CASE
      WHEN v_cycle = 'monthly' THEN 59.99
      WHEN v_cycle = 'quarterly' THEN 53.99
      ELSE 44.99
    END;
    v_extra_price := 0.00;
    v_base_subaccounts := 1;
    v_base_concurrent := 1;
    v_current_extra_seats := 0;

  ELSIF v_plan_str = 'prof_top' THEN
    v_base_price := CASE
      WHEN v_cycle = 'monthly' THEN 89.99
      WHEN v_cycle = 'quarterly' THEN 80.99
      ELSE 67.49
    END;
    v_extra_price := 0.00;
    v_base_subaccounts := 2;
    v_base_concurrent := 2;
    v_current_extra_seats := 0;

  ELSIF v_plan_str = 'clinica_basico' THEN
    v_base_price := CASE
      WHEN v_cycle = 'monthly' THEN 99.00
      WHEN v_cycle = 'quarterly' THEN 89.10
      ELSE 74.25
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
      WHEN v_cycle = 'quarterly' THEN 125.10
      ELSE 104.25
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
      WHEN v_cycle = 'quarterly' THEN 179.10
      ELSE 149.25
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

  -- Upsert atômico em clinic_subscriptions preservando estritamente o owner original
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

GRANT EXECUTE ON FUNCTION public.manage_clinic_subscription_plan(uuid, public.subscription_plan, text) TO authenticated, service_role;
