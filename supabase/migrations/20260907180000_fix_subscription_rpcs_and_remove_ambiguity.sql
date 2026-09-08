-- Migration: 20260907180000_fix_subscription_rpcs_and_remove_ambiguity.sql
-- Descrição: Remove sobrecarga ambígua de manage_clinic_subscription_plan (eliminando erro "Cannot coerce the result to a single JSON object"),
-- atualiza a matriz de preços para os 3 Tiers (Solo R$ 59, Clínica Pro R$ 139, Enterprise R$ 299)
-- e atualiza get_clinic_subscription_summary e update_clinic_concurrent_accesses.

-- 1. Eliminar a função antiga de 2 parâmetros que causava ambiguidade no PostgREST
DROP FUNCTION IF EXISTS public.manage_clinic_subscription_plan(uuid, public.subscription_plan);

-- 2. Atualizar manage_clinic_subscription_plan com a nova matriz de 3 Tiers
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

GRANT EXECUTE ON FUNCTION public.manage_clinic_subscription_plan(uuid, public.subscription_plan, text) TO authenticated;

-- 3. Atualizar get_clinic_subscription_summary com limites base canônicos (Solo: 1/1, Clinic: 30/4, Enterprise: 100/10)
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

GRANT EXECUTE ON FUNCTION public.get_clinic_subscription_summary(uuid) TO authenticated;

-- 4. Atualizar update_clinic_concurrent_accesses com suporte a Enterprise (taxa de R$ 15) e Clinic (R$ 25)
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

GRANT EXECUTE ON FUNCTION public.update_clinic_concurrent_accesses(uuid, integer) TO authenticated;
