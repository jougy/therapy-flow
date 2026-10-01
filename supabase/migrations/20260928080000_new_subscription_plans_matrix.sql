-- Migration: 20260928080000_new_subscription_plans_matrix.sql
-- Descrição: Nova esteira de planos de assinatura Pluri-Health:
-- 1. Perfis e Tiers:
--    - Profissional:
--      * prof_basico (R$ 39,99/mês): 1 acesso simultâneo, 1 titular, max 1 formulário customizado ativo (1 padrão do sistema + 1 complementar).
--      * prof_medio (R$ 59,99/mês): 1 acesso simultâneo, 1 titular, formulários ilimitados (-1).
--      * prof_top (R$ 89,99/mês): 2 acessos simultâneos (titular + 1 apoio), max 2 membros (titular + apoio), formulários ilimitados (-1).
--    - Clínica:
--      * clinica_basico (R$ 99,00/mês): 2 acessos simultâneos base (+ extras a R$ 25/mês cada), colaboradores ilimitados no cadastro (subaccount_limit = 999999), formulários ilimitados (-1).
--      * clinica_medio (R$ 139,00/mês): 4 acessos simultâneos base (+ extras a R$ 25/mês cada), colaboradores ilimitados (subaccount_limit = 999999), formulários ilimitados (-1).
--      * clinica_top (R$ 199,00/mês): 8 acessos simultâneos base (+ extras a R$ 25/mês cada), colaboradores ilimitados (subaccount_limit = 999999), formulários ilimitados (-1).
--    - Retrocompatibilidade estrita:
--      * solo -> mapeia como prof_medio (1 acesso / 1 titular)
--      * clinic -> mapeia como clinica_medio (4 acessos base / R$ 25 extra)
--      * enterprise -> mapeia como clinica_top (8 a 10 acessos base)
-- 2. Cotas (check_clinic_plan_quota):
--    - patients e attendances: ILIMITADOS (-1) em todos os planos pagos!
--    - custom_forms: limitado a 1 modelo customizado apenas no prof_basico (além dos de sistema). Demais: ilimitado (-1).
-- 3. Sincronização de limites da clínica (sync_clinic_limits_from_subscription):
--    - Atualização para suportar novos planos e legados.
-- 4. RPCs:
--    - manage_clinic_subscription_plan atualizada com os novos planos e preços.
--    - change_clinic_subscription_plan criada como alias/extensão segura.
--    - update_clinic_concurrent_accesses e get_clinic_subscription_summary atualizadas.

-- 1. Suporte aos novos planos no ENUM public.subscription_plan de forma idempotente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
    WHERE pg_type.typname = 'subscription_plan' AND pg_enum.enumlabel = 'prof_basico'
  ) THEN
    ALTER TYPE public.subscription_plan ADD VALUE 'prof_basico';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
    WHERE pg_type.typname = 'subscription_plan' AND pg_enum.enumlabel = 'prof_medio'
  ) THEN
    ALTER TYPE public.subscription_plan ADD VALUE 'prof_medio';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
    WHERE pg_type.typname = 'subscription_plan' AND pg_enum.enumlabel = 'prof_top'
  ) THEN
    ALTER TYPE public.subscription_plan ADD VALUE 'prof_top';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
    WHERE pg_type.typname = 'subscription_plan' AND pg_enum.enumlabel = 'clinica_basico'
  ) THEN
    ALTER TYPE public.subscription_plan ADD VALUE 'clinica_basico';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
    WHERE pg_type.typname = 'subscription_plan' AND pg_enum.enumlabel = 'clinica_medio'
  ) THEN
    ALTER TYPE public.subscription_plan ADD VALUE 'clinica_medio';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
    WHERE pg_type.typname = 'subscription_plan' AND pg_enum.enumlabel = 'clinica_top'
  ) THEN
    ALTER TYPE public.subscription_plan ADD VALUE 'clinica_top';
  END IF;
END $$;

-- 2. Atualizar função de cotas: check_clinic_plan_quota
CREATE OR REPLACE FUNCTION public.check_clinic_plan_quota(
  p_clinic_id uuid,
  p_feature_type text -- 'attendances', 'patients', 'custom_forms', 'concurrent_access'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION public.check_clinic_plan_quota(uuid, text) TO authenticated, anon, service_role;

-- 3. Atualizar função de sincronização de limites da clínica: sync_clinic_limits_from_subscription
CREATE OR REPLACE FUNCTION public.sync_clinic_limits_from_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 4. Atualizar manage_clinic_subscription_plan com a nova esteira de 6 planos + legados
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

-- 5. RPC de Troca de Plano: change_clinic_subscription_plan
-- Suporta passagem do identificador de plano tanto como tipo subscription_plan quanto text
CREATE OR REPLACE FUNCTION public.change_clinic_subscription_plan(
  _clinic_id uuid,
  _new_plan public.subscription_plan,
  _billing_cycle text DEFAULT 'annual'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.manage_clinic_subscription_plan(_clinic_id, _new_plan, _billing_cycle);
END;
$$;

GRANT EXECUTE ON FUNCTION public.change_clinic_subscription_plan(uuid, public.subscription_plan, text) TO authenticated, service_role;

-- 6. Atualizar update_clinic_concurrent_accesses com a nova esteira de planos
CREATE OR REPLACE FUNCTION public.update_clinic_concurrent_accesses(
  _clinic_id uuid,
  _extra_concurrent integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION public.update_clinic_concurrent_accesses(uuid, integer) TO authenticated, service_role;

-- 7. Atualizar get_clinic_subscription_summary com limites canônicos dos novos planos
CREATE OR REPLACE FUNCTION public.get_clinic_subscription_summary(_clinic_id uuid)
RETURNS TABLE (
  subscription_id uuid,
  clinic_id uuid,
  account_owner_user_id uuid,
  plan_type public.subscription_plan,
  status text,
  billing_cycle text,
  payment_method text,
  base_monthly_price numeric(10,2),
  total_recurring_monthly_price numeric(10,2),
  base_subaccount_limit integer,
  purchased_subaccount_extra_count integer,
  total_subaccount_limit integer,
  base_concurrent_access_count integer,
  additional_concurrent_access_count integer,
  total_concurrent_access_limit integer,
  next_due_date date,
  current_period_start timestamptz,
  current_period_end timestamptz,
  expires_at timestamptz,
  period_duration_days integer,
  auto_renew boolean,
  days_remaining integer,
  is_expired boolean,
  asaas_customer_id text,
  asaas_subscription_id text,
  applied_coupon_id uuid,
  coupon_code text,
  discount_percentage numeric(5,2),
  discount_fixed_amount numeric(10,2),
  trial_ends_at timestamptz,
  override_reason text,
  override_by_user_id uuid,
  override_at timestamptz,
  cpf_cnpj text,
  billing_email text,
  billing_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
    cs.billing_name
  FROM public.clinic_subscriptions cs
  WHERE cs.clinic_id = _clinic_id
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_clinic_subscription_summary(uuid) TO authenticated, service_role;

-- 8. Atualizar permissões de RBAC canônicas para incluir os novos planos de clínica
CREATE OR REPLACE FUNCTION public.current_user_can_role_capability(
  _capability text,
  _clinic_id uuid DEFAULT NULL::uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _resolved_clinic_id uuid;
  _operational_role public.operational_role_type;
  _role_key text;
  _account_role public.account_role_type;
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
    IF _sub.status = 'TRIAL_EXPIRED' AND NOT _is_owner THEN
      RETURN false;
    END IF;

    IF public.is_clinic_read_only(_resolved_clinic_id) THEN
      _is_read_only := true;
      IF (_sub.status = 'TRIAL_EXPIRED' OR _sub.status = 'TRIAL' OR COALESCE(_sub.is_free_trial, false) = true) AND NOT _is_owner THEN
        RETURN false;
      END IF;
    END IF;

    IF _sub.status NOT IN ('BETA', 'TRIAL', 'COURTESY') AND COALESCE(_sub.is_courtesy, false) = false THEN
      IF _sub.expires_at IS NOT NULL AND _sub.expires_at < now() THEN
        _is_subscription_expired := true;
      ELSIF _sub.status IN ('EXPIRED', 'SUSPENDED') THEN
        _is_subscription_expired := true;
      END IF;
    END IF;
  END IF;

  IF _is_read_only OR _is_subscription_expired THEN
    IF _capability = 'subscription_billing.manage' AND _is_owner THEN
      RETURN true;
    END IF;

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

    RETURN false;
  END IF;

  IF _is_owner THEN
    RETURN true;
  END IF;

  IF _capability = 'subscription_billing.manage' THEN
    RETURN false;
  END IF;

  -- 2. Checagem de Override na tabela clinic_operational_role_capabilities
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
      RETURN false;
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_can_role_capability(text, uuid) TO authenticated, anon, service_role;
